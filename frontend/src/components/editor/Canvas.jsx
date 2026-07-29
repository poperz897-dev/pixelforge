import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { computeCanvasSize, computeCellPx, drawPixelGrid } from '../../utils/renderGrid.js';
import { isInsideIsoDiamond, isoClipPathPercent } from '../../utils/isoGrid.js';
import { brushOffsets, strokeCells } from '../../utils/brush.js';
import { linePoints, rectPixels, ellipsePixels, boundsFromCorner, boundsFromCenter, snapLineEnd } from '../../utils/shapes.js';
import { mirrorPoints } from '../../utils/symmetry.js';

const STARCYAN = '115, 239, 247';
const SHAPE_TOOLS = new Set(['line', 'rect', 'ellipse']);
const SELECTION_TOOLS = new Set(['selectRect', 'selectEllipse', 'lasso', 'polyLasso', 'magicWand']);

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
  selectionMode = 'none',
  setSelectionMode = () => {},
  selection = { bounds: null, content: null, hasSelection: false },
  setSelection = () => {},
  isSelecting = false,
  setIsSelecting = () => {},
  points = [],
  setPoints = () => {},
  startPos = null,
  setStartPos = () => {},
  endPos = null,
  setEndPos = () => {},
  extractRegion = () => {},
  createSelectionFromMask = () => {},
  clearSelection = () => {},
  flipContent = () => {},
  rotateContent = () => {},
  scaleContent = () => {},
  onTransform = () => {},
}) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [previewCells, setPreviewCells] = useState([]);
  const [hoverCell, setHoverCell] = useState(null);
  const lastCellRef = useRef(null);
  const shapeStartRef = useRef(null);
  const sprayIntervalRef = useRef(null);
  const strokeRef = useRef({ points: [], originals: new Map() });

  const isIso = gridShape === 'isometric';
  const n = Math.max(width, height);
  const cellPx = computeCellPx(n);
  const hasSymmetry = !!(symmetry?.horizontal || symmetry?.vertical);

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

    onionLayers.before.forEach(onion => renderOnionLayer(onion, cellPx, 0, 0));
    drawPixelGrid(ctx, { grid, width, height, gridShape, isoRatioW, isoRatioH, cellPx, showCheckerboard: false, showGridLines });

    if (previewCells.length) {
      ctx.fillStyle = activeColor;
      for (const { x, y } of previewCells) ctx.fillRect(x * cellPx, y * cellPx, cellPx, cellPx);
    }

    // Draw selection box
    if (selection.hasSelection && selection.bounds) {
      ctx.save();
      ctx.strokeStyle = `rgba(${STARCYAN}, 0.85)`;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      const { x0, y0, x1, y1 } = selection.bounds;
      ctx.strokeRect(x0 * cellPx, y0 * cellPx, (x1 - x0 + 1) * cellPx, (y1 - y0 + 1) * cellPx);
      ctx.restore();
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

    onionLayers.after.forEach(onion => renderOnionLayer(onion, cellPx, 0, 0));

    if (hoverCell && !isDrawing && !isSelecting && (tool === 'pencil' || tool === 'eraser') && isAllowed(hoverCell.x, hoverCell.y)) {
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
    previewCells, activeColor, hasSymmetry, symmetry, hoverCell, isDrawing, isSelecting, tool, brushSize, brushShape, isAllowed, onionLayers, selection,
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

  const computeSelectionPreview = useCallback((start, end, isEllipse) => {
    const cells = [];
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    if (isEllipse) {
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const rx = (maxX - minX) / 2;
      const ry = (maxY - minY) / 2;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (((x - cx) / (rx + 0.5)) ** 2 + ((y - cy) / (ry + 0.5)) ** 2 <= 1) {
            cells.push({ x, y });
          }
        }
      }
    } else {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          cells.push({ x, y });
        }
      }
    }
    return cells;
  }, []);

  const computeGradientCells = useCallback((start, end) => {
    const cells = [];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.max(1, Math.sqrt(dx*dx + dy*dy));
    const color1 = activeColor;
    const color2 = '#ffffff';
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    for (let i = 0; i <= steps; i++) {
      const t = steps > 0 ? i / steps : 0;
      const x = Math.round(start.x + dx * t);
      const y = Math.round(start.y + dy * t);
      if (x >= 0 && y >= 0 && x < width && y < height && isAllowed(x, y)) {
        const mixed = [
          Math.round(rgb1[0] + (rgb2[0] - rgb1[0]) * t),
          Math.round(rgb1[1] + (rgb2[1] - rgb1[1]) * t),
          Math.round(rgb1[2] + (rgb2[2] - rgb1[2]) * t),
        ];
        const color = rgbToHex(mixed);
        cells.push({ x, y, color });
      }
    }
    return cells;
  }, [activeColor, width, height, isAllowed]);

  const handlePointerDown = (e) => {
    try {
      const cell = cellFromEvent(e);
      if (!cell || !isAllowed(cell.x, cell.y)) return;
      onFillStart();
      strokeRef.current = { points: [], originals: new Map() };
      lastCellRef.current = cell;
      shapeStartRef.current = cell;

      // Selection Tools
      if (tool === 'selectRect' || tool === 'selectEllipse') {
        setSelectionMode(tool === 'selectRect' ? 'rect' : 'ellipse');
        setIsSelecting(true);
        setStartPos(cell);
        setEndPos(cell);
        return;
      }

      if (tool === 'lasso') {
        setSelectionMode('lasso');
        setIsSelecting(true);
        setPoints([cell]);
        return;
      }

      if (tool === 'polyLasso') {
        setSelectionMode('poly');
        if (!isSelecting) {
          setIsSelecting(true);
          setPoints([cell]);
        } else {
          setPoints(prev => [...prev, cell]);
        }
        return;
      }

      if (tool === 'magicWand') {
        const visited = new Set();
        const queue = [cell];
        const targetColor = grid[cell.y]?.[cell.x];
        const mask = Array.from({ length: height }, () => Array(width).fill(false));
        while (queue.length) {
          const { x, y } = queue.shift();
          const key = `${x},${y}`;
          if (visited.has(key)) continue;
          visited.add(key);
          if (!isAllowed(x, y)) continue;
          if (grid[y]?.[x] !== targetColor) continue;
          mask[y][x] = true;
          for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
              queue.push({ x: nx, y: ny });
            }
          }
        }
        createSelectionFromMask(mask, grid);
        onFillEnd();
        return;
      }

      // Move Tool
      if (tool === 'move') {
        if (selection.hasSelection) {
          const { bounds } = selection;
          if (cell.x >= bounds.x0 && cell.x <= bounds.x1 && cell.y >= bounds.y0 && cell.y <= bounds.y1) {
            setSelectionMode('move');
            setIsSelecting(true);
            setStartPos(cell);
            return;
          }
        }
        clearSelection();
        return;
      }

      // Gradient Tool
      if (tool === 'gradient') {
        setSelectionMode('gradient');
        setIsSelecting(true);
        setStartPos(cell);
        setEndPos(cell);
        return;
      }

      // Spray Tool
      if (tool === 'spray') {
        const applySpray = () => {
          const radius = brushSize;
          const count = radius * 2;
          for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * radius;
            const sx = Math.round(cell.x + Math.cos(angle) * dist);
            const sy = Math.round(cell.y + Math.sin(angle) * dist);
            if (sx >= 0 && sy >= 0 && sx < width && sy < height && isAllowed(sx, sy)) {
              onPixel(sx, sy, activeColor);
            }
          }
        };
        applySpray();
        sprayIntervalRef.current = setInterval(applySpray, 50);
        setIsDrawing(true);
        return;
      }

      // Existing Tools
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
      
      applyStamp(cell.x, cell.y, cell.x, cell.y);
      setIsDrawing(true);
    } catch (err) {
      console.error('Pointer down error:', err);
    }
  };

  const handlePointerMove = (e) => {
    try {
      const cell = cellFromEvent(e);
      if (!cell) return;

      if (!isDrawing && !isSelecting) {
        setHoverCell(cell);
        return;
      }

      // Selection Tools
      if (tool === 'selectRect' || tool === 'selectEllipse') {
        setEndPos(cell);
        const previewCells = computeSelectionPreview(startPos, cell, tool === 'selectEllipse');
        setPreviewCells(previewCells);
        return;
      }

      if (tool === 'lasso') {
        setPoints(prev => [...prev, cell]);
        return;
      }

      if (tool === 'move') {
        if (selection.hasSelection && startPos) {
          const dx = cell.x - startPos.x;
          const dy = cell.y - startPos.y;
          setEndPos(cell);
        }
        return;
      }

      if (tool === 'gradient') {
        setEndPos(cell);
        const cells = computeGradientCells(startPos, cell);
        setPreviewCells(cells);
        return;
      }

      // Shape/Drawing Tools
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
    if (!isDrawing && !isSelecting) return;
    try {
      // Selection finalization
      if (tool === 'selectRect' || tool === 'selectEllipse') {
        if (startPos && endPos) {
          const { region } = extractRegion(grid, startPos.x, startPos.y, endPos.x, endPos.y);
          const bounds = {
            x0: Math.min(startPos.x, endPos.x),
            y0: Math.min(startPos.y, endPos.y),
            x1: Math.max(startPos.x, endPos.x),
            y1: Math.max(startPos.y, endPos.y),
          };
          setSelection({ bounds, content: region, hasSelection: true });
        }
        setStartPos(null);
        setEndPos(null);
        setIsSelecting(false);
        setPreviewCells([]);
        onFillEnd();
        return;
      }

      if (tool === 'lasso' || tool === 'polyLasso') {
        const pts = points;
        if (pts.length > 2) {
          const mask = Array.from({ length: height }, () => Array(width).fill(false));
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              let inside = false;
              for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
                const xi = pts[i].x, yi = pts[i].y;
                const xj = pts[j].x, yj = pts[j].y;
                const intersect = ((yi > y) !== (yj > y)) &&
                  (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
                if (intersect) inside = !inside;
              }
              if (inside) mask[y][x] = true;
            }
          }
          createSelectionFromMask(mask, grid);
        }
        setPoints([]);
        setIsSelecting(false);
        onFillEnd();
        return;
      }

      if (tool === 'move') {
        if (selection.hasSelection && startPos && endPos) {
          const dx = endPos.x - startPos.x;
          const dy = endPos.y - startPos.y;
          const newGrid = grid.map(row => [...row]);
          const { bounds } = selection;
          for (let y = bounds.y0; y <= bounds.y1; y++) {
            for (let x = bounds.x0; x <= bounds.x1; x++) {
              newGrid[y][x] = null;
            }
          }
          const newX0 = bounds.x0 + dx;
          const newY0 = bounds.y0 + dy;
          const newBounds = {
            x0: newX0,
            y0: newY0,
            x1: newX0 + (bounds.x1 - bounds.x0),
            y1: newY0 + (bounds.y1 - bounds.y0),
          };
          for (let y = 0; y < selection.content.length; y++) {
            for (let x = 0; x < selection.content[0].length; x++) {
              const targetX = newX0 + x;
              const targetY = newY0 + y;
              if (targetX >= 0 && targetY >= 0 && targetX < width && targetY < height && isAllowed(targetX, targetY)) {
                newGrid[targetY][targetX] = selection.content[y][x];
              }
            }
          }
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              onPixel(x, y, newGrid[y][x]);
            }
          }
          setSelection(prev => ({ ...prev, bounds: newBounds }));
        }
        setStartPos(null);
        setEndPos(null);
        setIsSelecting(false);
        onFillEnd();
        return;
      }

      if (tool === 'gradient') {
        if (startPos && endPos) {
          const cells = computeGradientCells(startPos, endPos);
          for (const { x, y, color } of cells) {
            onPixel(x, y, color);
          }
          setPreviewCells([]);
        }
        setStartPos(null);
        setEndPos(null);
        setIsSelecting(false);
        onFillEnd();
        return;
      }

      if (tool === 'spray') {
        if (sprayIntervalRef.current) {
          clearInterval(sprayIntervalRef.current);
          sprayIntervalRef.current = null;
        }
        setIsDrawing(false);
        onFillEnd();
        return;
      }

      if (SHAPE_TOOLS.has(tool)) {
        for (const { x, y } of previewCells) onPixel(x, y, activeColor);
        setPreviewCells([]);
      }
      onFillEnd();
    } catch (err) {
      console.error('Pointer up error:', err);
    } finally {
      setIsDrawing(false);
      setIsSelecting(false);
    }
  };

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