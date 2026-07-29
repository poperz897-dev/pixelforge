import { computeIsoMask, computeIsoOutline } from './isoGrid.js';

// Medium slate checker — clearly distinct from typical paint colors
// (unlike the original dark purple, which was too close to plausible
// painted colors) without being a stark light/white square dropped into
// an otherwise dark UI (which the first attempt at this fix got wrong).
// Matches the slate tones already used elsewhere in the app's dark theme.
const CHECKER_A = '#64748b';
const CHECKER_B = '#475569';
const GRID_LINE = 'rgba(255,255,255,0.07)';
const ISO_GRID_LINE = 'rgba(255,255,255,0.10)';
const OUTLINE = 'rgba(255,255,255,0.65)';

export function computeCanvasSize({ width, height, cellPx }) {
  return { canvasWidth: width * cellPx, canvasHeight: height * cellPx };
}

export function computeCellPx(n) {
  const TARGET = 520;
  const MIN = 4;
  const MAX = 40;
  return Math.min(MAX, Math.max(MIN, Math.floor(TARGET / n)));
}

/**
 * Checkerboard parity for a single cell.
 *
 * For isometric grids the checker sits underneath a mask that is
 * guaranteed mirror-symmetric (see isoGrid.js), so the checker itself
 * must also be mirror-symmetric or the "transparent" backdrop will look
 * inverted between the left/right (or top/bottom) halves even though
 * the drawable shape is fine. Using distance-from-center (which is
 * mirror-invariant by definition) instead of raw (x+y) parity fixes
 * this for every grid size, including the even sizes (16/24/32/48/64/
 * 96/128) where plain (x+y)%2 flips 100% of cells across the center.
 *
 * Square grids have no such symmetry requirement, so they keep the
 * simple, standard (x+y)%2 checker.
 */
function checkerIsLight(x, y, width, height, isIso) {
  if (isIso) {
    const cx = (width - 1) / 2;
    const cy = (height - 1) / 2;
    const dx = Math.floor(Math.abs(x - cx));
    const dy = Math.floor(Math.abs(y - cy));
    return (dx + dy) % 2 === 0;
  }
  return (x + y) % 2 === 0;
}

export function drawPixelGrid(ctx, { grid, width, height, gridShape, isoRatioW, isoRatioH, cellPx, showCheckerboard = true, showGridLines = false, showOutline = true }) {
  const isIso = gridShape === 'isometric';
  const n = Math.max(width, height);

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const mask = isIso ? computeIsoMask(n, isoRatioW, isoRatioH) : null;

  // Draw checkerboard / pixels
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask && !mask[y]?.[x]) continue;

      if (showCheckerboard) {
        ctx.fillStyle = checkerIsLight(x, y, width, height, isIso) ? CHECKER_A : CHECKER_B;
        ctx.fillRect(x * cellPx, y * cellPx, cellPx, cellPx);
      }

      const color = grid[y]?.[x];
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(x * cellPx, y * cellPx, cellPx, cellPx);
      }
    }
  }

  // Per-pixel reference grid. Drawn the same way for square AND iso grids —
  // a uniform rectangular grid over the full n×n box is trivially symmetric
  // (there's no direction for it to be lopsided in), and for iso grids the
  // canvas element already has a CSS clip-path applied to its exact diamond
  // outline (see isoClipPathPercent / Canvas.jsx), so anything drawn outside
  // the drawable area is automatically clipped away. That combination is
  // what guarantees these lines always land exactly on real pixel-cell
  // boundaries, instead of an interpolated decorative lattice that can
  // visually degrade to just a couple of lines at small grid sizes.
  if (showGridLines) {
    ctx.strokeStyle = isIso ? ISO_GRID_LINE : GRID_LINE;
    ctx.lineWidth = 1;
    for (let x = 0; x <= n; x++) {
      ctx.beginPath(); ctx.moveTo(x * cellPx, 0); ctx.lineTo(x * cellPx, n * cellPx); ctx.stroke();
    }
    for (let y = 0; y <= n; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * cellPx); ctx.lineTo(n * cellPx, y * cellPx); ctx.stroke();
    }
  }

  // Isometric outline — traced directly from the same mask data, so it
  // always matches the drawable area exactly. Gated behind showOutline so
  // callers rendering an isolated tile bitmap (e.g. the tile tester, which
  // draws its own per-cell boundary separately at the grid level) can
  // suppress it — otherwise every placed tile carries its own extra border
  // and neighboring tiles can never look like they connect.
  if (isIso && showOutline) {
    const pts = computeIsoOutline(n, isoRatioW, isoRatioH);
    if (pts.length) {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0].x * cellPx, pts[0].y * cellPx);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * cellPx, pts[i].y * cellPx);
      ctx.closePath();
      ctx.stroke();
    }
  }

  return mask;
}
