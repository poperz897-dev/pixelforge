import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { drawPixelGrid } from '../../utils/renderGrid.js';
import { drawHero, resolveHeroType } from '../../utils/heroSprite.js';
import {
  isoGridToScreen,
  computeIsoMapBounds,
  isValidIsoCell,
  getIsoTileCorners,
  drawIsoTileBase,
  isPointInIsoTile,
  getIsoContentBox,
} from '../../utils/isoGrid.js';

const ZOOM_STEP = 1.12;

export default function TestGrid({
  gridShape, cellWidth, cellHeight, isoRatioW, isoRatioH,
  tiles, dummyScreenPos, dummyDirection, dummyWalkCycle, dummyIsMoving,
  onPlaceTile, onPaintCell, onEraseCell,
  paintMode, selectedTile,
  zoom, pan, setZoom, setPan,
  dim,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [viewport, setViewport] = useState({ width: 800, height: 560 });
  const [hoverCell, setHoverCell] = useState(null);
  const tileCache = useRef(new Map());
  const dragRef = useRef({ mode: null, lastCell: null, panStart: null, panOrigin: null });

  const heroType = resolveHeroType(gridShape, isoRatioW, isoRatioH);

  // Responsive, device-pixel-ratio-aware viewport sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0].contentRect;
      setViewport({ width: Math.max(200, box.width), height: Math.max(200, box.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The center of the map content in "world" (unzoomed) coordinates.
  // Because the render transform always centers this point on the
  // viewport before panning, the map stays centered by construction
  // whenever pan is {0,0} — no special-case recentering is needed when
  // grid size, cell size, or ratio changes.
  const mapCenter = useMemo(() => {
    if (gridShape === 'square') {
      return { x: (dim * cellWidth) / 2, y: (dim * cellHeight) / 2 };
    }
    const b = computeIsoMapBounds(dim, cellWidth, cellHeight);
    return { x: b.minX + b.width / 2, y: b.minY + b.height / 2 };
  }, [gridShape, dim, cellWidth, cellHeight]);

  const worldToScreen = useCallback((wx, wy) => ({
    x: viewport.width / 2 + pan.x + (wx - mapCenter.x) * zoom,
    y: viewport.height / 2 + pan.y + (wy - mapCenter.y) * zoom,
  }), [viewport, pan, zoom, mapCenter]);

  const screenToWorld = useCallback((sx, sy) => ({
    x: (sx - viewport.width / 2 - pan.x) / zoom + mapCenter.x,
    y: (sy - viewport.height / 2 - pan.y) / zoom + mapCenter.y,
  }), [viewport, pan, zoom, mapCenter]);

  // Renders a tile at its own native 1:1 resolution — no scaling here at
  // all. Scaling to fit a cell happens at draw time (drawTileIntoCell),
  // via an explicit crop-to-content-box + stretch-to-destination-size,
  // which is what actually guarantees "one tile exactly fills one cell"
  // regardless of the tile's own ratio. Caching at a fixed native size
  // also means this never needs to be rebuilt when the grid's cell size
  // or zoom changes — only when the tile itself does.
  const getTileCanvas = useCallback((tile) => {
    const key = `${tile.id}-${tile.grid_shape}-${tile.iso_ratio_w}-${tile.iso_ratio_h}-${tile.width}-${tile.height}`;
    if (!tileCache.current.has(key)) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, tile.width);
      c.height = Math.max(1, tile.height);
      const cx = c.getContext('2d');
      drawPixelGrid(cx, {
        grid: tile.pixel_data, width: tile.width, height: tile.height,
        gridShape: tile.grid_shape, isoRatioW: tile.iso_ratio_w, isoRatioH: tile.iso_ratio_h,
        cellPx: 1, showCheckerboard: false, showGridLines: false, showOutline: false,
      });
      tileCache.current.set(key, c);
    }
    return tileCache.current.get(key);
  }, []);

  // Where a tile's actual drawable content sits within its own cached
  // bitmap — for iso tiles that's the diamond, not the full padded square
  // canvas (see getIsoContentBox for why that distinction matters).
  const getTileContentBox = useCallback((tile) => {
    if (tile.grid_shape !== 'isometric') {
      return { x: 0, y: 0, width: tile.width, height: tile.height };
    }
    return getIsoContentBox(Math.max(tile.width, tile.height), tile.iso_ratio_w, tile.iso_ratio_h);
  }, []);

  // Crops a tile's cached bitmap down to its real content and stretches
  // that crop to exactly (dw, dh) at (dx, dy) — the single place that
  // decides how a tile fills a cell, so "always exactly one cell" can't
  // drift out of sync between the grid, the ghost preview, and drag/drop.
  const drawTileIntoCell = useCallback((ctx, tile, dx, dy, dw, dh, alpha = 1) => {
    const tc = getTileCanvas(tile);
    const box = getTileContentBox(tile);
    if (box.width <= 0 || box.height <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(tc, box.x, box.y, box.width, box.height, dx, dy, dw, dh);
    ctx.restore();
  }, [getTileCanvas, getTileContentBox]);


  // Size the actual canvas backing store for crisp rendering at the
  // current device pixel ratio. This must NOT live inside the render loop
  // effect below — that effect legitimately re-runs on every animation
  // frame while the hero is walking, and reassigning canvas.width/height
  // resets (and reallocates) the backing store, which would silently cost
  // a full canvas reallocation ~60 times a second during any movement.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(viewport.width * dpr);
    canvas.height = Math.round(viewport.height * dpr);
  }, [viewport]);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let id;

    const frame = (time) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, viewport.width, viewport.height);

      drawBackground(ctx, viewport.width, viewport.height);

      ctx.save();
      ctx.translate(viewport.width / 2 + pan.x, viewport.height / 2 + pan.y);
      ctx.scale(zoom, zoom);
      ctx.translate(-mapCenter.x, -mapCenter.y);

      if (gridShape === 'square') {
        renderSquareGrid(ctx, time);
      } else {
        renderIsoGrid(ctx, time);
      }

      ctx.restore();
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport, pan, zoom, mapCenter, gridShape, tiles, hoverCell, dummyScreenPos, dummyDirection, dummyWalkCycle, dummyIsMoving, heroType, drawTileIntoCell, cellWidth, cellHeight, dim, isoRatioW, isoRatioH, paintMode, selectedTile]);

  function drawBackground(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#182238');
    g.addColorStop(1, '#131b2e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
    ctx.lineWidth = 1;
    const gridSize = 32;
    const offX = (pan.x % gridSize + gridSize) % gridSize;
    const offY = (pan.y % gridSize + gridSize) % gridSize;
    for (let x = offX; x < w; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = offY; y < h; y += gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  }

  function drawGhostTile(ctx, x, y, w, h) {
    if (!selectedTile || paintMode !== 'paint' || !hoverCell) return;
    drawTileIntoCell(ctx, selectedTile, x, y, w, h, 0.55);
  }

  function renderSquareGrid(ctx, time) {
    // Crisp outer bounds so the map's extent reads at a glance
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, dim * cellWidth, dim * cellHeight);

    for (let row = 0; row < dim; row++) {
      for (let col = 0; col < dim; col++) {
        const x = col * cellWidth;
        const y = row * cellHeight;
        const isEven = (col + row) % 2 === 0;

        ctx.fillStyle = isEven ? 'rgba(71, 85, 105, 0.85)' : 'rgba(51, 65, 85, 0.85)';
        ctx.fillRect(x, y, cellWidth, cellHeight);

        ctx.strokeStyle = 'rgba(226, 232, 240, 0.14)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, cellWidth - 1, cellHeight - 1);

        const tile = tiles[row]?.[col];
        if (tile) {
          drawTileIntoCell(ctx, tile, x, y, cellWidth, cellHeight);
        }

        const isHover = hoverCell && hoverCell.col === col && hoverCell.row === row;
        if (isHover) {
          ctx.fillStyle = paintMode === 'erase' ? 'rgba(248, 113, 113, 0.22)' : 'rgba(99, 102, 241, 0.28)';
          ctx.fillRect(x, y, cellWidth, cellHeight);
          ctx.strokeStyle = paintMode === 'erase' ? 'rgba(248, 113, 113, 0.7)' : 'rgba(129, 140, 248, 0.8)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2);
          if (!tile) drawGhostTile(ctx, x, y, cellWidth, cellHeight);
        }
      }
    }

    if (heroType) {
      const dx = dummyScreenPos.x;
      const dy = dummyScreenPos.y;
      drawHero(ctx, heroType, dx + cellWidth / 2, dy + cellHeight / 2, Math.min(cellWidth, cellHeight) * 0.8, dummyDirection, time, dummyWalkCycle, dummyIsMoving, cellWidth);
    }
  }

  function renderIsoGrid(ctx, time) {
    const renderOrder = [];
    for (let row = 0; row < dim; row++) {
      for (let col = 0; col < dim; col++) renderOrder.push({ col, row, sum: col + row });
    }
    renderOrder.sort((a, b) => a.sum - b.sum);

    for (const { col, row } of renderOrder) {
      const depth = (col + row) / (dim * 2);
      const baseLight = 58 + depth * 20;
      const baseColor = `rgba(${baseLight + 14}, ${baseLight + 20}, ${baseLight + 34}, 0.92)`;
      const edgeColor = `rgba(226, 232, 240, 0.22)`;

      drawIsoTileBase(ctx, col, row, cellWidth, cellHeight, baseColor, edgeColor, 1);

      const isHover = hoverCell && hoverCell.col === col && hoverCell.row === row;
      if (isHover) {
        const hoverFill = paintMode === 'erase' ? 'rgba(248, 113, 113, 0.28)' : 'rgba(99, 102, 241, 0.28)';
        const hoverEdge = paintMode === 'erase' ? 'rgba(248, 113, 113, 0.85)' : 'rgba(129, 140, 248, 0.9)';
        drawIsoTileBase(ctx, col, row, cellWidth, cellHeight, hoverFill, hoverEdge, 2);
      }
    }

    for (const { col, row } of renderOrder) {
      const tile = tiles[row]?.[col];
      const pos = isoGridToScreen(col, row, cellWidth, cellHeight);

      if (!tile) {
        const isHover = hoverCell && hoverCell.col === col && hoverCell.row === row;
        if (isHover) drawGhostTile(ctx, pos.x, pos.y, cellWidth, cellHeight);
        continue;
      }

      const corners = getIsoTileCorners(col, row, cellWidth, cellHeight);
      const shadowOffset = 3;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.moveTo(corners.top.x + shadowOffset, corners.top.y + shadowOffset);
      ctx.lineTo(corners.right.x + shadowOffset, corners.right.y + shadowOffset);
      ctx.lineTo(corners.bottom.x + shadowOffset, corners.bottom.y + shadowOffset);
      ctx.lineTo(corners.left.x + shadowOffset, corners.left.y + shadowOffset);
      ctx.closePath();
      ctx.fill();

      drawTileIntoCell(ctx, tile, pos.x, pos.y, cellWidth, cellHeight);
    }

    if (heroType) {
      const hx = dummyScreenPos.x + cellWidth / 2;
      const hy = dummyScreenPos.y + cellHeight / 2;

      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(hx, hy + cellHeight * 0.35, cellWidth * 0.25, cellHeight * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();

      drawHero(ctx, heroType, hx, hy, Math.min(cellWidth, cellHeight) * 0.7, dummyDirection, time, dummyWalkCycle, dummyIsMoving, cellWidth);
    }
  }

  // Event handling
  const eventToCell = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x: wx, y: wy } = screenToWorld(sx, sy);

    if (gridShape === 'square') {
      const c = Math.floor(wx / cellWidth);
      const r = Math.floor(wy / cellHeight);
      if (isValidIsoCell(c, r, dim)) return { col: c, row: r };
      return null;
    }
    for (let sum = dim * 2 - 2; sum >= 0; sum--) {
      for (let col = 0; col < dim; col++) {
        const row = sum - col;
        if (row < 0 || row >= dim) continue;
        if (isPointInIsoTile(wx, wy, col, row, cellWidth, cellHeight)) return { col, row };
      }
    }
    return null;
  }, [gridShape, cellWidth, cellHeight, dim, screenToWorld]);

  const applyDragAction = useCallback((mode, cell) => {
    if (!cell) return;
    if (mode === 'paint') onPaintCell(cell.col, cell.row);
    else if (mode === 'erase') onEraseCell(cell.col, cell.row);
  }, [onPaintCell, onEraseCell]);

  const handlePointerDown = useCallback((e) => {
    if (e.button === 1) {
      e.preventDefault();
      dragRef.current = { mode: 'pan', lastCell: null, panStart: { x: e.clientX, y: e.clientY }, panOrigin: { ...pan } };
      canvasRef.current.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button === 2) {
      const cell = eventToCell(e);
      dragRef.current = { mode: 'erase', lastCell: cell, panStart: null, panOrigin: null };
      applyDragAction('erase', cell);
      canvasRef.current.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button === 0) {
      const mode = paintMode === 'erase' ? 'erase' : (selectedTile ? 'paint' : null);
      if (!mode) return;
      const cell = eventToCell(e);
      dragRef.current = { mode, lastCell: cell, panStart: null, panOrigin: null };
      applyDragAction(mode, cell);
      canvasRef.current.setPointerCapture(e.pointerId);
    }
  }, [eventToCell, applyDragAction, pan, paintMode, selectedTile]);

  const handlePointerMove = useCallback((e) => {
    const drag = dragRef.current;
    if (drag.mode === 'pan' && drag.panStart) {
      setPan({ x: drag.panOrigin.x + (e.clientX - drag.panStart.x), y: drag.panOrigin.y + (e.clientY - drag.panStart.y) });
      return;
    }
    const cell = eventToCell(e);
    setHoverCell(cell);
    if ((drag.mode === 'paint' || drag.mode === 'erase') &&
        cell && (!drag.lastCell || drag.lastCell.col !== cell.col || drag.lastCell.row !== cell.row)) {
      drag.lastCell = cell;
      applyDragAction(drag.mode, cell);
    }
  }, [eventToCell, applyDragAction, setPan]);

  const endDrag = useCallback((e) => {
    dragRef.current = { mode: null, lastCell: null, panStart: null, panOrigin: null };
    if (e?.pointerId != null && canvasRef.current?.hasPointerCapture?.(e.pointerId)) {
      canvasRef.current.releasePointerCapture(e.pointerId);
    }
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const before = screenToWorld(sx, sy);
    const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    const newZoom = Math.max(0.25, Math.min(4, zoom * factor));
    const newPanX = sx - viewport.width / 2 - (before.x - mapCenter.x) * newZoom;
    const newPanY = sy - viewport.height / 2 - (before.y - mapCenter.y) * newZoom;
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  }, [screenToWorld, zoom, viewport, mapCenter, setZoom, setPan]);

  const cursorClass = dragRef.current.mode === 'pan'
    ? 'cursor-grabbing'
    : paintMode === 'erase' ? 'cursor-not-allowed' : selectedTile ? 'cursor-crosshair' : 'cursor-default';

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl border border-panel-border shadow-2xl shadow-black/50 overflow-hidden bg-panel flex-1 min-h-[420px] w-full"
    >
      <canvas
        ref={canvasRef}
        style={{ width: viewport.width, height: viewport.height }}
        className={`touch-none block ${cursorClass}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerLeave={(e) => { endDrag(e); setHoverCell(null); }}
        onPointerCancel={endDrag}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        onDragOver={(e) => { e.preventDefault(); setHoverCell(eventToCell(e)); }}
        onDrop={(e) => {
          e.preventDefault();
          setHoverCell(null);
          const cell = eventToCell(e);
          if (!cell) return;
          try {
            const tile = JSON.parse(e.dataTransfer.getData('application/json'));
            onPlaceTile(tile, cell.col, cell.row);
          } catch { /* ignore malformed drag payloads */ }
        }}
        onDragLeave={() => setHoverCell(null)}
      />
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-[10px] font-mono text-slate-400/80 bg-void/60 backdrop-blur px-2 py-1 rounded-lg pointer-events-none select-none">
        <span>Scroll to zoom</span><span className="opacity-40">•</span><span>Middle-drag to pan</span>
      </div>
    </div>
  );
}
