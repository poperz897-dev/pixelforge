import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { computeCanvasSize, computeCellPx, drawPixelGrid } from '../../utils/renderGrid.js';
import { isInsideIsoDiamond, isoClipPathPercent } from '../../utils/isoGrid.js';
import { brushOffsets, strokeCells } from '../../utils/brush.js';
import { linePoints, rectPixels, ellipsePixels, boundsFromCorner, boundsFromCenter, snapLineEnd } from '../../utils/shapes.js';
import { mirrorPoints } from '../../utils/symmetry.js';

const STARCYAN = '115, 239, 247';
const SHAPE_TOOLS = new Set(['line', 'rect', 'ellipse']);

// Helper functions for tint mixing
function hexToRgb(hex) {
  const v = hex.replace('#', '');
  return [parseInt(v.slice(0,2),16), parseInt(v.slice(2,4),16), parseInt(v.slice(4,6),16)];
}

function rgbToHex([r,g,b]) {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return '#' + [r,g,b].map(v => clamp(v).toString(16).padStart(2,'0')).join('');
}

export default function Canvas({
  grid, width, height, gridShape = 'square', isoRatioW, isoRatioH,
  tool, activeColor, onPixel, onFillStart, onFillEnd, onFloodFill, onEyedrop, onColorReplace,
  showGridLines = true,
  brushSize = 1, brushShape = 'square', pixelPerfect = false, shapeFilled = false,
  symmetry = { horizontal: false, vertical: false },
  onionLayers = { before: [], after: [] },
}) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [previewCells, setPreviewCells] = useState([]);
  const [hoverCell, setHoverCell] = useState(null);
  const lastCellRef = useRef(null);
  const shapeStartRef = useRef(null);
  // Per-stroke bookkeeping for pixel-perfect mode: the ordered trail of
  // points actually stamped, plus what was under each one before this
  // stroke touched it (so a corner pixel we later decide to drop can be
  // reverted instead of just erased).
  const strokeRef = useRef({ points: [], originals: new Map() });

  const isIso = gridShape === 'isometric';
  const n = Math.max(width, height);
  const cellPx = computeCellPx(n);
  const hasSymmetry = !!(symmetry?.horizontal || symmetry?.vertical);

  // Isometric tiles only occupy the diamond inscribed in their square
  // buffer -- everything outside it is transparent padding that drawing/
  // fill should never touch.
  const isAllowed = useCallback(
    (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return false;
      if (!isIso) return true;
      return isInsideIsoDiamond(x, y, n, isoRatioW, isoRatioH);
    },
    [isIso, n, isoRatioW, isoRatioH, width, height]
  );

  const { canvasWidth, canvasHeight } = computeCanvasSize({ width, height, cellPx });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!grid?.length || grid.length !== height || !grid[0] || grid[0].length !== width) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Render onion skins (before frames)
    const renderOnionLayer = (onion, scale, offsetX, offsetY) => {
      const { grid: onionGrid, opacity, tint } = onion;
      if (!onionGrid) return;
      const tintRgb = hexToRgb(tint);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const color = onionGrid[y]?.[x];
          if (!color) continue;
          const srcRgb = hexToRgb(color);
          const mixed = [
            Math.round(srcRgb[0] * (1 - opacity) + tintRgb[0] * opacity),
            Math.round(srcRgb[1] * (1 - opacity) + tintRgb[1] * opacity),
            Math.round(srcRgb[2] * (1 - opacity) + tintRgb[2] * opacity),
          ];
          ctx.fillStyle = rgbToHex(mixed);
          ctx.fillRect(offsetX + x * scale, offsetY + y * scale, scale, scale);
        }
      }
    };

    // Draw before onions
    onionLayers.before.forEach(onion => renderOnionLayer(onion, cellPx, 0, 0));

    // Draw current frame
    drawPixelGrid(ctx, { grid, width, height, gridShape, isoRatioW, isoRatioH, cellPx, showCheckerboard: false, showGridLines });

    if (previewCells.length) {
      ctx.fillStyle = activeColor;
      for (const { x, y } of previewCells) ctx.fillRect(x * cellPx, y * cellPx, cellPx, cellPx);
    }

    if (hasSymmetry) {
      ctx.save();
      ctx.strokeStyle = `rgba(${STARCYAN}, 0.45)`;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      if (symmetry.horizontal) {
        const gx = (width / 2) * cellPx;
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, height * cellPx); ctx.stroke();
      }
      if (symmetry.vertical) {
        const gy = (height / 2) * cellPx;
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(width * cellPx, gy); ctx.stroke();
      }
      ctx.restore();
    }

    // Draw after onions
    onionLayers.after.forEach(onion => renderOnionLayer(onion, cellPx, 0, 0));

    if (hoverCell && !isDrawing && (tool === 'pencil' || tool === 'eraser') && isAllowed(hoverCell.x, hoverCell.y)) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1;
      for (const { dx, dy } of brushOffsets(brushSize, brushShape)) {
        const px = hoverCell.x + dx, py = hoverCell.y + dy;
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        ctx.strokeRect(px * cellPx + 0.5, py * cellPx + 0.5, cellPx - 1, cellPx - 1);
      }
      ctx.restore();
    }
  }, [
    grid, width, height, gridShape, isoRatioW, isoRatioH, cellPx, showGridLines,
    previewCells, activeColor, hasSymmetry, symmetry, hoverCell, isDrawing, tool, brushSize, brushShape, isAllowed, onionLayers,
  ]);

  const cellFromEvent = useCallback(
    (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;
      const x = Math.floor(((e.clientX - rect.left) * scaleX) / cellPx);
      const y = Math.floor(((e.clientY - rect.top) * scaleY) / cellPx);
      if (x < 0 || y < 0 || x >= width || y >= height) return null;
      return { x, y };
    },
    [width, height, cellPx]
  );

  // Writes one pixel and, if a corner in the last three stamped points
  // forms the "double diagonal" stair-step, reverts that corner pixel to
  // whatever was under it before this stroke -- the standard pixel-perfect
  // freehand-line technique. Only meaningful at brush size 1; callers gate
  // on that.
  const pixelPerfectStamp = useCallback(
    (x, y, color) => {
      const state = strokeRef.current;
      const key = `${x},${y}`;
      if (!state.originals.has(key)) state.originals.set(key, grid[y]?.[x] ?? null);
      onPixel(x, y, color);
      state.points.push({ x, y });
      if (state.points.length >= 3) {
        const [a, b, c] = state.points.slice(-3);
        const isDiagonalStep = Math.abs(c.x - a.x) === 1 && Math.abs(c.y - a.y) === 1;
        const isCorner = isDiagonalStep && ((b.x === a.x && b.y === c.y) || (b.y === a.y && b.x === c.x));
        if (isCorner) {
          const bKey = `${b.x},${b.y}`;
          const original = state.originals.has(bKey) ? state.originals.get(bKey) : null;
          onPixel(b.x, b.y, original);
          state.points.splice(state.points.length - 2, 1);
        }
      }
    },
    [grid, onPixel]
  );

  // Pencil/eraser: sweep the brush footprint along the segment from the
  // last sampled point to this one (so fast drags don't leave gaps),
  // mirroring through the symmetry axis when enabled.
  const applyStamp = useCallback(
    (x0, y0, x1, y1) => {
      const color = tool === 'eraser' ? null : activeColor;
      const usePixelPerfect = tool === 'pencil' && pixelPerfect && brushSize === 1;
      const cells = strokeCells(x0, y0, x1, y1, brushSize, brushShape);
      for (const { x, y } of cells) {
        if (!isAllowed(x, y)) continue;
        if (usePixelPerfect) pixelPerfectStamp(x, y, color);
        else onPixel(x, y, color);
        if (hasSymmetry) {
          for (const p of mirrorPoints(x, y, width, height, symmetry)) {
            if ((p.x !== x || p.y !== y) && isAllowed(p.x, p.y)) onPixel(p.x, p.y, color);
          }
        }
      }
    },
    [tool, activeColor, pixelPerfect, brushSize, brushShape, isAllowed, onPixel, pixelPerfectStamp, hasSymmetry, width, height, symmetry]
  );

  const computeShapeCells = useCallback(
    (start, end, e) => {
      const constrain = !!e.shiftKey;
      const fromCenter = !!e.altKey;
      let cells = [];
      if (tool === 'line') {
        const endPoint = constrain ? snapLineEnd(start.x, start.y, end.x, end.y) : end;
        cells = linePoints(start.x, start.y, endPoint.x, endPoint.y);
      } else {
        const bounds = fromCenter
          ? boundsFromCenter(start.x, start.y, end.x, end.y, constrain)
          : boundsFromCorner(start.x, start.y, end.x, end.y, constrain);
        if (tool === 'rect') {
          cells = rectPixels(bounds.x0, bounds.y0, bounds.x1, bounds.y1, shapeFilled);
        } else {
          const cx = (bounds.x0 + bounds.x1) / 2, cy = (bounds.y0 + bounds.y1) / 2;
          const rx = Math.abs(bounds.x1 - bounds.x0) / 2, ry = Math.abs(bounds.y1 - bounds.y0) / 2;
          cells = ellipsePixels(cx, cy, rx, ry, shapeFilled);
        }
      }
      const seen = new Set();
      const withMirror = [];
      for (const { x, y } of cells) {
        for (const p of mirrorPoints(x, y, width, height, symmetry)) {
          if (!isAllowed(p.x, p.y)) continue;
          const key = `${p.x},${p.y}`;
          if (!seen.has(key)) { seen.add(key); withMirror.push(p); }
        }
      }
      return withMirror;
    },
    [tool, shapeFilled, symmetry, width, height, isAllowed]
  );

  const handlePointerDown = (e) => {
    try {
      const cell = cellFromEvent(e);
      if (!cell || !isAllowed(cell.x, cell.y)) return;
      onFillStart();
      strokeRef.current = { points: [], originals: new Map() };
      lastCellRef.current = cell;
      shapeStartRef.current = cell;

      if (tool === 'fill') {
        onFloodFill(cell.x, cell.y, activeColor, isIso ? isAllowed : undefined);
        onFillEnd();
        return;
      }
      if (tool === 'eyedrop') {
        const color = grid[cell.y]?.[cell.x] ?? null;
        if (color) onEyedrop(color);
        onFillEnd();
        return;
      }
      if (tool === 'colorReplace') {
        onColorReplace(cell.x, cell.y, activeColor);
        onFillEnd();
        return;
      }
      if (SHAPE_TOOLS.has(tool)) {
        setPreviewCells(computeShapeCells(cell, cell, e));
        setIsDrawing(true);
        return;
      }
      // pencil / eraser
      applyStamp(cell.x, cell.y, cell.x, cell.y);
      setIsDrawing(true);
    } catch (err) {
      console.error('Pointer down error:', err);
    }
  };

  const handlePointerMove = (e) => {
    try {
      if (!isDrawing) {
        setHoverCell(cellFromEvent(e));
        return;
      }
      const cell = cellFromEvent(e);
      if (!cell) return;
      if (SHAPE_TOOLS.has(tool)) {
        setPreviewCells(computeShapeCells(shapeStartRef.current, cell, e));
      } else if (tool === 'pencil' || tool === 'eraser') {
        applyStamp(lastCellRef.current.x, lastCellRef.current.y, cell.x, cell.y);
        lastCellRef.current = cell;
      }
    } catch (err) {
      console.error('Pointer move error:', err);
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    try {
      if (SHAPE_TOOLS.has(tool)) {
        for (const { x, y } of previewCells) onPixel(x, y, activeColor);
        setPreviewCells([]);
      }
      onFillEnd();
    } catch (err) {
      console.error('Fill end error:', err);
    } finally {
      setIsDrawing(false);
    }
  };

  // CSS clip-path to the exact diamond outline -- this is what makes an
  // isometric tile's canvas actually *read* as diamond-shaped rather than
  // a square with a diamond drawn inside it.
  const clipPath = useMemo(() => {
    if (!isIso) return undefined;
    return isoClipPathPercent(n, isoRatioW, isoRatioH);
  }, [isIso, n, isoRatioW, isoRatioH]);

  return (
    <div
      className={`inline-block transition-transform duration-200 ${isIso ? '' : 'border-2 border-panel-border rounded-lg shadow-glow'}`}
      style={{ filter: isIso ? 'drop-shadow(0 8px 24px rgba(0,0,0,0.6))' : undefined }}
    >
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="touch-none block"
        style={{
          cursor: tool === 'eyedrop' || tool === 'colorReplace' || SHAPE_TOOLS.has(tool) ? 'crosshair' : 'cell',
          clipPath: clipPath,
          WebkitClipPath: clipPath,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          setHoverCell(null);
          handlePointerUp();
        }}
      />
    </div>
  );
}