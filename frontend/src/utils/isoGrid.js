/**
 * PixelForge — Mathematically Exact Isometric Grid System
 * 
 * Every diamond is computed with exact symmetry guarantees.
 * All edges have mathematically identical slopes.
 * No rounding asymmetries.
 */

export const ISO_RATIO_PRESETS = [
  { key: '2:1',   label: '2:1 — classic isometric (26.565°)',     w: 2,   h: 1 },
  { key: '1:1',   label: '1:1 — diamond (45°)',                   w: 1,   h: 1 },
  { key: '4:3',   label: '4:3 — flatter isometric (36.87°)',      w: 4,   h: 3 },
  { key: 'true',  label: '√3:1 — true isometric (30°)',           w: Math.sqrt(3), h: 1 },
  { key: 'custom', label: 'Custom ratio…',                        w: null, h: null },
];

export const ISO_GRID_SIZES = [16, 24, 32, 48, 64, 96, 128];
export const ISO_TILE_SIZES = [32, 64, 96, 128];

/* ------------------------------------------------------------------ */
/*  MATHEMATICAL CORE                                                  */
/*                                                                      */
/*  Symmetric BY CONSTRUCTION, not by after-the-fact patching.         */
/*  Every row/column span is built directly from its (symmetric)      */
/*  distance to the exact geometric center, so a left/right or        */
/*  top/bottom mismatch is structurally impossible — there is no      */
/*  "if asymmetric, force it" branch anywhere in this file.            */
/* ------------------------------------------------------------------ */

function getDiamondDimensions(n, ratioW, ratioH) {
  const r = ratioW / ratioH;
  const cx = (n - 1) / 2;
  const cy = (n - 1) / 2;

  if (r >= 1) {
    const halfW = n / 2;
    const halfH = n / (2 * r);
    return { cx, cy, halfW, halfH, wide: true };
  } else {
    const halfW = (n * r) / 2;
    const halfH = n / 2;
    return { cx, cy, halfW, halfH, wide: false };
  }
}

export function computeDiamondVertices(n, ratioW, ratioH) {
  const { cx, cy, halfW, halfH } = getDiamondDimensions(n, ratioW, ratioH);
  return {
    top:    { x: cx,         y: cy - halfH },
    right:  { x: cx + halfW, y: cy },
    bottom: { x: cx,         y: cy + halfH },
    left:   { x: cx - halfW, y: cy },
  };
}

/**
 * Where the drawable diamond actually sits within a tile's native n×n
 * square canvas, in pixel coordinates: { x, y, width, height }.
 *
 * This matters because a tile's advertised width/height (n×n) is the
 * *padded* square canvas, not the diamond's own content size — e.g. a
 * 32×32 canvas at a 2:1 ratio only has a 32×16 drawable diamond,
 * vertically centered with 8px of empty padding above and below it.
 * Anything that needs to fit a tile's real content into a target box
 * (the tile tester placing a tile into a cell, an export crop, etc.)
 * should scale against THIS box, not against n×n directly — scaling
 * against the padded square makes the visible content come out at half
 * size (or whatever the padding ratio works out to).
 */
export function getIsoContentBox(n, ratioW, ratioH) {
  const { halfW, halfH, wide } = getDiamondDimensions(n, ratioW, ratioH);
  const width = halfW * 2;
  const height = halfH * 2;
  return {
    x: wide ? 0 : (n - width) / 2,
    y: wide ? (n - height) / 2 : 0,
    width,
    height,
  };
}

/**
 * Round `value` to the nearest number sharing the given fractional part
 * (0 for an odd grid, 0.5 for an even grid). This is what makes the span
 * math below land exactly on integer pixel columns/rows while staying
 * perfectly centered — `center - k` and `center + k` are guaranteed to
 * both be integers because k is built to match center's own fraction.
 */
function roundToFrac(value, frac) {
  return Math.round(value - frac) + frac;
}

/**
 * Compute one span per row (wide diamonds) or per column (tall diamonds).
 * Each span is derived purely from `dist = |coord - center|`, which is
 * mirror-invariant by definition — so mirroring the coordinate can never
 * change the result. There is nothing to "check" or "force" afterward.
 */
function computeIsoSpans(n, ratioW, ratioH) {
  const { cx, cy, halfW, halfH, wide } = getDiamondDimensions(n, ratioW, ratioH);
  const center = wide ? cy : cx;
  const halfShort = wide ? halfH : halfW;
  const halfLong = wide ? halfW : halfH;
  const frac = (n % 2 === 0) ? 0.5 : 0;
  const spans = new Array(n).fill(null);

  if (halfShort <= 0 || halfLong <= 0) return { wide, spans };

  for (let i = 0; i < n; i++) {
    const dist = Math.abs(i - center);
    if (dist > halfShort + 1e-9) continue;
    const half = halfLong * (1 - dist / halfShort);
    if (half < 0) continue;
    const k = roundToFrac(half, frac);
    if (k < 0) continue;
    const otherCenter = wide ? cx : cy;
    let start = Math.round(otherCenter - k);
    let end = Math.round(otherCenter + k);
    start = Math.max(0, start);
    end = Math.min(n - 1, end);
    if (start <= end) spans[i] = { start, end };
  }
  return { wide, spans };
}

/* ------------------------------------------------------------------ */
/*  PUBLIC API                                                         */
/* ------------------------------------------------------------------ */

export function isValidIsoCombo(gridSize, ratioW, ratioH) {
  const r = ratioW / ratioH;
  const halfShort = r >= 1 ? gridSize / (2 * r) : (gridSize * r) / 2;
  return halfShort >= 2.5;
}

export function findIsoRatioPreset(w, h) {
  if (!w || !h) return '2:1';
  const target = w / h;
  const match = ISO_RATIO_PRESETS.find((p) => p.w != null && Math.abs(p.w / p.h - target) < 0.01);
  return match ? match.key : 'custom';
}

export function isInsideIsoDiamond(x, y, n, ratioW, ratioH) {
  if (x < 0 || y < 0 || x >= n || y >= n) return false;
  const { wide, spans } = computeIsoSpans(n, ratioW, ratioH);
  if (wide) {
    const row = spans[y];
    return !!row && x >= row.start && x <= row.end;
  }
  const col = spans[x];
  return !!col && y >= col.start && y <= col.end;
}

export function computeIsoMask(n, ratioW, ratioH) {
  const { wide, spans } = computeIsoSpans(n, ratioW, ratioH);
  const mask = Array.from({ length: n }, () => new Array(n).fill(false));

  if (wide) {
    for (let y = 0; y < n; y++) {
      const row = spans[y];
      if (!row) continue;
      for (let x = row.start; x <= row.end; x++) mask[y][x] = true;
    }
  } else {
    for (let x = 0; x < n; x++) {
      const col = spans[x];
      if (!col) continue;
      for (let y = col.start; y <= col.end; y++) mask[y][x] = true;
    }
  }
  return mask;
}

/**
 * Remove redundant collinear points from a polyline (three consecutive
 * points where the middle one adds no shape information). Purely
 * cosmetic — never changes what area the outline encloses.
 */
function simplifyCollinear(pts) {
  if (pts.length < 3) return pts;
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    const dx1 = cur.x - prev.x, dy1 = cur.y - prev.y;
    const dx2 = next.x - cur.x, dy2 = next.y - cur.y;
    const cross = dx1 * dy2 - dy1 * dx2;
    const dot = dx1 * dx2 + dy1 * dy2;
    if (Math.abs(cross) < 1e-9 && dot > 0) continue; // redundant midpoint
    out.push(cur);
  }
  return out;
}

/**
 * Trace the pixel-perfect stepped outline of the diamond.
 *
 * This is deliberately NOT computed from the vertex/line-intersection
 * geometry — it is built directly from the exact same `spans` data used
 * by computeIsoMask(). That means the outline and the fill mask can
 * never disagree with each other: no protrusions, no gaps, no
 * duplicated edge pixels, by construction rather than by inspection.
 */
export function computeIsoOutline(n, ratioW, ratioH) {
  const { wide, spans } = computeIsoSpans(n, ratioW, ratioH);
  const pts = [];

  if (wide) {
    let top = -1, bot = -1;
    for (let y = 0; y < n; y++) if (spans[y]) { if (top < 0) top = y; bot = y; }
    if (top < 0) return [];

    // Right edge, walking top -> bottom
    for (let y = top; y <= bot; y++) {
      const s = spans[y];
      pts.push({ x: s.end + 1, y });
      pts.push({ x: s.end + 1, y: y + 1 });
    }
    // Left edge, walking bottom -> top (closes the polygon)
    for (let y = bot; y >= top; y--) {
      const s = spans[y];
      pts.push({ x: s.start, y: y + 1 });
      pts.push({ x: s.start, y });
    }
  } else {
    let left = -1, right = -1;
    for (let x = 0; x < n; x++) if (spans[x]) { if (left < 0) left = x; right = x; }
    if (left < 0) return [];

    // Bottom edge, walking left -> right
    for (let x = left; x <= right; x++) {
      const s = spans[x];
      pts.push({ x, y: s.end + 1 });
      pts.push({ x: x + 1, y: s.end + 1 });
    }
    // Top edge, walking right -> left (closes the polygon)
    for (let x = right; x >= left; x--) {
      const s = spans[x];
      pts.push({ x: x + 1, y: s.start });
      pts.push({ x, y: s.start });
    }
  }

  return simplifyCollinear(pts);
}

export function isoClipPathPercent(n, ratioW, ratioH) {
  const pts = computeIsoOutline(n, ratioW, ratioH);
  if (!pts.length) return 'none';
  return `polygon(${pts.map((p) => `${((p.x / n) * 100).toFixed(3)}% ${((p.y / n) * 100).toFixed(3)}%`).join(', ')})`;
}

export function validateCustomRatio(w, h) {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return 'Ratio values must be positive numbers';
  }
  if (w > 20 || h > 20) return 'Ratio values must be 20 or less';
  if (w / h > 10 || h / w > 10) return 'Ratio cannot exceed 10:1 or be less than 1:10';
  return null;
}

/* ------------------------------------------------------------------ */
/*  ISOMETRIC TILEMAP ENGINE                                           */
/* ------------------------------------------------------------------ */

/**
 * Convert grid (col,row) to isometric screen coordinates.
 * Classic formula: screen moves half-tile in X and Y per grid step.
 */
export function isoGridToScreen(col, row, tileWidth, tileHeight) {
  const halfW = tileWidth / 2;
  const halfH = tileHeight / 2;
  return {
    x: (col - row) * halfW,
    y: (col + row) * halfH,
  };
}

/**
 * Convert screen coordinates back to grid.
 */
export function isoScreenToGrid(screenX, screenY, tileWidth, tileHeight) {
  const halfW = tileWidth / 2;
  const halfH = tileHeight / 2;
  const diff = screenX / halfW;
  const sum = screenY / halfH;
  return {
    col: (sum + diff) / 2,
    row: (sum - diff) / 2,
  };
}

/**
 * Compute the full bounding box of an isometric tilemap.
 */
export function computeIsoMapBounds(dim, tileWidth, tileHeight) {
  const corners = [
    isoGridToScreen(0, 0, tileWidth, tileHeight),
    isoGridToScreen(dim - 1, 0, tileWidth, tileHeight),
    isoGridToScreen(0, dim - 1, tileWidth, tileHeight),
    isoGridToScreen(dim - 1, dim - 1, tileWidth, tileHeight),
  ];
  
  const minX = Math.min(...corners.map((c) => c.x));
  const maxX = Math.max(...corners.map((c) => c.x)) + tileWidth;
  const minY = Math.min(...corners.map((c) => c.y));
  const maxY = Math.max(...corners.map((c) => c.y)) + tileHeight;
  
  return {
    minX, minY, maxX, maxY,
    width: maxX - minX,
    height: maxY - minY,
    offsetX: -minX,
    offsetY: -minY,
  };
}

export function isValidIsoCell(col, row, dim) {
  return col >= 0 && row >= 0 && col < dim && row < dim;
}

export function getIsoCells(dim) {
  const cells = [];
  for (let row = 0; row < dim; row++) {
    for (let col = 0; col < dim; col++) {
      cells.push({ col, row });
    }
  }
  return cells;
}

export function getIsoNeighbors(col, row, dim) {
  const dirs = [
    { col, row: row - 1, dir: 'nw' },
    { col: col + 1, row, dir: 'ne' },
    { col: col - 1, row, dir: 'sw' },
    { col, row: row + 1, dir: 'se' },
  ];
  return dirs.filter((d) => isValidIsoCell(d.col, d.row, dim));
}

/**
 * Get the 4 diamond corners of a tile in screen space.
 */
export function getIsoTileCorners(col, row, tileWidth, tileHeight) {
  const base = isoGridToScreen(col, row, tileWidth, tileHeight);
  const halfW = tileWidth / 2;
  const halfH = tileHeight / 2;
  
  return {
    top:    { x: base.x + halfW, y: base.y },
    right:  { x: base.x + tileWidth, y: base.y + halfH },
    bottom: { x: base.x + halfW, y: base.y + tileHeight },
    left:   { x: base.x, y: base.y + halfH },
  };
}

/**
 * Draw a single isometric diamond tile.
 */
export function drawIsoTileBase(ctx, col, row, tileWidth, tileHeight, fill, stroke, lineWidth = 1) {
  const c = getIsoTileCorners(col, row, tileWidth, tileHeight);
  
  ctx.beginPath();
  ctx.moveTo(c.top.x, c.top.y);
  ctx.lineTo(c.right.x, c.right.y);
  ctx.lineTo(c.bottom.x, c.bottom.y);
  ctx.lineTo(c.left.x, c.left.y);
  ctx.closePath();
  
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

/**
 * Point-in-diamond test for isometric tiles.
 */
export function isPointInIsoTile(screenX, screenY, col, row, tileWidth, tileHeight) {
  const c = getIsoTileCorners(col, row, tileWidth, tileHeight);
  
  // Cross-product signs for all 4 edges
  const cross = (ax, ay, bx, by, px, py) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  
  const c1 = cross(c.top.x, c.top.y, c.right.x, c.right.y, screenX, screenY);
  const c2 = cross(c.right.x, c.right.y, c.bottom.x, c.bottom.y, screenX, screenY);
  const c3 = cross(c.bottom.x, c.bottom.y, c.left.x, c.left.y, screenX, screenY);
  const c4 = cross(c.left.x, c.left.y, c.top.x, c.top.y, screenX, screenY);
  
  return (c1 >= 0 && c2 >= 0 && c3 >= 0 && c4 >= 0) ||
         (c1 <= 0 && c2 <= 0 && c3 <= 0 && c4 <= 0);
}

/**
 * Compute proper tile dimensions for advertised size and ratio.
 */
export function computeIsoTileDimensions(advertisedWidth, advertisedHeight, ratioW, ratioH) {
  const r = ratioW / ratioH;
  const boxR = advertisedWidth / advertisedHeight;
  
  if (Math.abs(r - boxR) < 0.01) {
    return { tileW: advertisedWidth, tileH: advertisedHeight };
  } else if (r > boxR) {
    return { tileW: advertisedWidth, tileH: advertisedWidth / r };
  } else {
    return { tileH: advertisedHeight, tileW: advertisedHeight * r };
  }
}

function pointInPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y;
    const xj = pts[j].x, yj = pts[j].y;
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Verification function — checks the properties the drawing grid spec
 * actually requires: perfect left/right and top/bottom symmetry, no
 * holes inside a row/column (a single contiguous run of filled pixels),
 * and the traced outline enclosing exactly the same pixels as the mask
 * (no protrusions, no missing/duplicate pixels).
 */
export function verifyIsoTileSize(n, ratioW, ratioH) {
  const mask = computeIsoMask(n, ratioW, ratioH);
  const outline = computeIsoOutline(n, ratioW, ratioH);

  let hSymErrors = 0, vSymErrors = 0, contiguityErrors = 0, outlineMismatches = 0;

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < Math.floor(n / 2); x++) {
      if (mask[y][x] !== mask[y][n - 1 - x]) hSymErrors++;
    }
  }
  for (let y = 0; y < Math.floor(n / 2); y++) {
    for (let x = 0; x < n; x++) {
      if (mask[y][x] !== mask[n - 1 - y][x]) vSymErrors++;
    }
  }

  for (let y = 0; y < n; y++) {
    let sawFill = false, sawGapAfterFill = false;
    for (let x = 0; x < n; x++) {
      if (mask[y][x]) { if (sawGapAfterFill) contiguityErrors++; sawFill = true; }
      else if (sawFill) sawGapAfterFill = true;
    }
  }

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const inPoly = pointInPolygon(x + 0.5, y + 0.5, outline);
      if (inPoly !== mask[y][x]) outlineMismatches++;
    }
  }

  return {
    size: n, ratio: `${ratioW}:${ratioH}`,
    hSymErrors, vSymErrors, contiguityErrors, outlineMismatches,
    isPerfect: hSymErrors === 0 && vSymErrors === 0 && contiguityErrors === 0 && outlineMismatches === 0,
  };
}

export function verifyAllIsoSizes() {
  const results = [];
  const ratios = [
    { w: 2, h: 1, name: '2:1' },
    { w: 1, h: 1, name: '1:1' },
    { w: 4, h: 3, name: '4:3' },
    { w: Math.sqrt(3), h: 1, name: 'true' },
    { w: 3, h: 2, name: '3:2 (custom)' },
    { w: 1, h: 3, name: '1:3 (tall custom)' },
  ];
  for (const size of ISO_GRID_SIZES) {
    for (const ratio of ratios) {
      results.push(verifyIsoTileSize(size, ratio.w, ratio.h));
    }
  }
  return results;
}
