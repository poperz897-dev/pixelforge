import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { isoGridToScreen, isoScreenToGrid, isValidIsoCell } from '../utils/isoGrid.js';

const DEFAULT_DIM = 12;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;

// --- Dummy movement -------------------------------------------------------
//
// Movement is continuous, not grid-hopped: every animation frame the dummy
// moves `DUMMY_SPEED_CELLS_PER_SEC` cells' worth of distance (in screen/
// world px, before zoom) along whatever direction the held arrow keys (or
// patrol mode) currently indicate. There is no per-step duration and no
// "wait for the previous hop to finish" gate — holding a key just keeps
// producing nonzero velocity for as long as it's held.
//
// Speed is expressed as "cells per second" and scaled by cellWidth (not
// cellHeight) so it stays consistent with how the sprite itself is sized
// (see the cellW comment in heroSpriteAssets.js) regardless of how tall/
// wide a particular grid's cells are.
const DUMMY_SPEED_CELLS_PER_SEC = 3.3;

// Arrow key -> unit screen-space vector. Deliberately NOT grid-axis-locked
// (that was the old bug) -- up/down/left/right always mean up/down/left/
// right on screen, for both grid shapes. Holding two keys sums and
// normalizes to a diagonal at the same speed as a single key (8-way input,
// constant-speed output), rather than moving faster on the diagonal.
const KEY_ORDER = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const KEY_VECTORS = {
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
};

function makeEmpty(dim) { return Array.from({ length: dim }, () => Array(dim).fill(null)); }
function clampZoom(z) { return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Which of the square dummy's 4 sprite rows (up/down/left/right) a screen-
// space movement vector should face: whichever axis the vector is mostly
// aligned with wins. This is what gives 8-way (and effectively free-angle)
// movement a sensible 4-row sprite to animate with, per the project's
// existing sprite art.
function squareFacing(dx, dy) {
  if (dx === 0 && dy === 0) return null;
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'down' : 'up');
}

// Which of the iso dummy's 4 sprite rows (nw/ne/sw/se) a screen-space
// vector should face. Under the OLD grid-locked movement, each of these
// four directions corresponded to a fixed screen quadrant regardless of
// the iso ratio -- e.g. stepping (dCol:0,dRow:-1) ("nw") always produced
// a (+x,-y) screen delta (see isoGridToScreen). Movement is no longer
// confined to those four axes, but the sprite still only has frames for
// them, so any screen heading gets bucketed into whichever of those four
// quadrants it's closest to -- the same quadrants the old code already
// associated with each row, just now reachable from any angle instead of
// only dead-on.
function isoFacing(dx, dy) {
  if (dx === 0 && dy === 0) return null;
  if (dx >= 0) return dy <= 0 ? 'nw' : 'ne';
  return dy <= 0 ? 'sw' : 'se';
}

function pickPatrolTarget(dim, exclude) {
  if (dim <= 1) return { col: 0, row: 0 };
  let col, row, tries = 0;
  do {
    col = Math.floor(Math.random() * dim);
    row = Math.floor(Math.random() * dim);
    tries++;
  } while (exclude && col === exclude.col && row === exclude.row && tries < 8);
  return { col, row };
}

export function useTileTester() {
  const [dim, setDim] = useState(DEFAULT_DIM);
  const [gridShape, setGridShape] = useState('square');
  const [cellWidth, setCellWidth] = useState(64);
  const [cellHeight, setCellHeight] = useState(32);
  const [isoRatioW, setIsoRatioW] = useState(2);
  const [isoRatioH, setIsoRatioH] = useState(1);
  const [zoom, setZoomRaw] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [tiles, setTiles] = useState(() => makeEmpty(DEFAULT_DIM));

  const [paintMode, setPaintMode] = useState('paint'); // 'paint' | 'erase'
  const [selectedTile, setSelectedTile] = useState(null);

  // dummyScreenPos is now the one true source of movement: a continuous
  // world/unscaled position, advanced every frame by velocity * deltaTime.
  // dummyPos (the "which cell is the dummy on" reading used by the HUD,
  // patrol waypoints, etc.) is derived FROM it below, never the other way
  // around -- the grid-cell concept still exists, it's just no longer what
  // movement itself is quantized to.
  const [dummyScreenPos, setDummyScreenPos] = useState({ x: 0, y: 0 });
  const [dummyDirection, setDummyDirection] = useState('se');
  const [walkCycle, setWalkCycle] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const [patrolMode, setPatrolMode] = useState(false);

  const posRef = useRef({ x: 0, y: 0 }); // authoritative position for the rAF loop (avoids stale-closure reads of React state)
  const lastFrameRef = useRef(null);
  const patrolTargetRef = useRef(null);
  const heldKeysRef = useRef(new Set());

  const setZoom = useCallback((z) => setZoomRaw(clampZoom(z)), []);
  const resetView = useCallback(() => { setZoomRaw(1); setPan({ x: 0, y: 0 }); }, []);
  const panBy = useCallback((dx, dy) => setPan((p) => ({ x: p.x + dx, y: p.y + dy })), []);

  // Screen position (world/unscaled units — zoom is applied later as a
  // camera transform) of a grid cell's top-left corner.
  const getCellScreenPos = useCallback((col, row) => {
    if (gridShape === 'square') {
      return { x: col * cellWidth, y: row * cellHeight };
    }
    return isoGridToScreen(col, row, cellWidth, cellHeight);
  }, [gridShape, cellWidth, cellHeight]);

  // Inverse of getCellScreenPos. Used only to (a) clamp continuous
  // movement to the grid's bounds and (b) report the nearest cell for the
  // HUD/patrol targeting — never to quantize movement itself.
  const screenToCellFrac = useCallback((x, y) => {
    if (gridShape === 'square') return { col: x / cellWidth, row: y / cellHeight };
    return isoScreenToGrid(x, y, cellWidth, cellHeight);
  }, [gridShape, cellWidth, cellHeight]);

  // Clamp a candidate continuous position to stay within the grid: convert
  // to fractional (col,row), clamp each axis independently, convert back.
  // Round-trips exactly (no-op) anywhere in the interior since the two
  // conversions are exact inverses; only actually changes anything right
  // at an edge/corner, where it naturally lets the dummy slide along the
  // boundary instead of just freezing.
  const clampToGrid = useCallback((pos) => {
    const frac = screenToCellFrac(pos.x, pos.y);
    const col = clamp(frac.col, 0, dim - 1);
    const row = clamp(frac.row, 0, dim - 1);
    if (col === frac.col && row === frac.row) return pos;
    return getCellScreenPos(col, row);
  }, [screenToCellFrac, getCellScreenPos, dim]);

  // The nearest cell under the dummy's feet, derived from the continuous
  // position every render. This is what "Hero pos: col, row", patrol
  // waypoints, and any future tile-collision testing should read.
  const dummyPos = useMemo(() => {
    const frac = screenToCellFrac(dummyScreenPos.x, dummyScreenPos.y);
    return {
      col: clamp(Math.round(frac.col), 0, dim - 1),
      row: clamp(Math.round(frac.row), 0, dim - 1),
    };
  }, [dummyScreenPos, screenToCellFrac, dim]);

  // Teleport the dummy to a specific cell (used for init/reset/resize —
  // never for ordinary walking). Keeps posRef (the animation loop's
  // authoritative value) and React state in sync, and drops any in-flight
  // patrol target since it may no longer be valid for the new geometry.
  const placeDummyAtCell = useCallback((col, row) => {
    const p = getCellScreenPos(col, row);
    posRef.current = p;
    setDummyScreenPos({ ...p });
    setIsMoving(false);
    setWalkCycle(0);
    patrolTargetRef.current = null;
  }, [getCellScreenPos]);

  // Re-center the dummy whenever the grid's own geometry changes under it.
  useEffect(() => {
    placeDummyAtCell(Math.floor(dim / 2), Math.floor(dim / 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellWidth, cellHeight, gridShape, dim]);

  // Called by the page on keydown/keyup for the four arrow keys. Movement
  // itself happens inside the animation loop below, every frame, for as
  // long as a key stays held.
  const setDirectionHeld = useCallback((key, held) => {
    if (held) heldKeysRef.current.add(key);
    else heldKeysRef.current.delete(key);
  }, []);

  // Single continuous movement + animation loop — the only place that
  // writes to posRef/dummyScreenPos during normal walking or patrolling.
  useEffect(() => {
    let id;

    const tick = (time) => {
      const last = lastFrameRef.current;
      const dt = last == null ? 0 : Math.min(0.1, (time - last) / 1000); // clamp so a backgrounded tab doesn't teleport the dummy on return
      lastFrameRef.current = time;

      const speed = DUMMY_SPEED_CELLS_PER_SEC * Math.max(cellWidth, 1); // px/sec
      // `moving` drives animation (facing + walk-cycle/idle pose); `posChanged`
      // just tracks whether posRef was actually written this frame, so the
      // displayed dummyScreenPos can never fall a frame behind posRef even
      // on an exact-arrival frame where the traveled distance rounds to
      // ~0 and `moving` comes out false.
      let dx = 0, dy = 0, moving = false, posChanged = false;

      if (patrolMode) {
        let target = patrolTargetRef.current;
        if (!target) {
          target = pickPatrolTarget(dim);
          patrolTargetRef.current = target;
        }
        const dest = getCellScreenPos(target.col, target.row);
        const toX = dest.x - posRef.current.x;
        const toY = dest.y - posRef.current.y;
        const dist = Math.hypot(toX, toY);
        const step = speed * dt;

        if (dist <= step) {
          // Arrive exactly, then immediately line up the next waypoint —
          // walking continuously toward a chosen point and picking a new
          // one on arrival, with no pause/hop cadence in between.
          dx = toX; dy = toY;
          moving = dist > 0.01;
          posRef.current = dest;
          posChanged = true;
          patrolTargetRef.current = pickPatrolTarget(dim, target);
        } else if (dt > 0) {
          dx = (toX / dist) * step;
          dy = (toY / dist) * step;
          moving = true;
          posChanged = true;
          posRef.current = clampToGrid({ x: posRef.current.x + dx, y: posRef.current.y + dy });
        }
      } else if (dt > 0) {
        let vx = 0, vy = 0;
        for (const k of KEY_ORDER) {
          if (!heldKeysRef.current.has(k)) continue;
          vx += KEY_VECTORS[k].dx;
          vy += KEY_VECTORS[k].dy;
        }
        const len = Math.hypot(vx, vy);
        if (len > 0) {
          vx /= len; vy /= len; // normalize so a diagonal (two keys) isn't faster than one key
          dx = vx * speed * dt;
          dy = vy * speed * dt;
          moving = true;
          posChanged = true;
          posRef.current = clampToGrid({ x: posRef.current.x + dx, y: posRef.current.y + dy });
        }
      }

      if (moving) {
        setDummyDirection((prevDir) => {
          const facing = gridShape === 'isometric' ? isoFacing(dx, dy) : squareFacing(dx, dy);
          return facing ?? prevDir;
        });
        // One full stride cycle per cell crossed, at the dummy's actual
        // current speed -- this is the direct fix for the old bug, where
        // a fixed 160ms leg-swing timer ran independently of the (also
        // fixed) 260ms hop duration and drifted out of sync with it
        // (260/160 = 1.625 strides per tile). Deriving the rate from the
        // same speed constant that drives movement makes them agree by
        // construction, and a stationary dummy simply never advances this
        // (see the `else` branch below), so it shows a true idle pose.
        setWalkCycle((wc) => (wc + DUMMY_SPEED_CELLS_PER_SEC * dt) % 1);
      } else {
        setWalkCycle(0);
      }
      setIsMoving(moving);
      if (posChanged) setDummyScreenPos({ ...posRef.current });

      id = requestAnimationFrame(tick);
    };

    id = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(id);
      lastFrameRef.current = null;
    };
  }, [patrolMode, dim, gridShape, cellWidth, cellHeight, getCellScreenPos, clampToGrid]);

  // Public single-step mover (instant, non-animated — for programmatic/
  // external callers; ordinary walking never calls this).
  const moveDummy = useCallback((dCol, dRow, dir) => {
    const nextCol = clamp(dummyPos.col + dCol, 0, dim - 1);
    const nextRow = clamp(dummyPos.row + dRow, 0, dim - 1);
    if (dir) setDummyDirection(dir);
    placeDummyAtCell(nextCol, nextRow);
  }, [dummyPos, dim, placeDummyAtCell]);

  const placeTile = useCallback((tile, col, row) => {
    setTiles((prev) => {
      if (!isValidIsoCell(col, row, dim)) return prev;
      const next = prev.map((r) => [...r]);
      next[row][col] = tile;
      return next;
    });
  }, [dim]);

  const removeTile = useCallback((col, row) => {
    setTiles((prev) => {
      if (!isValidIsoCell(col, row, dim)) return prev;
      if (!prev[row]?.[col]) return prev;
      const next = prev.map((r) => [...r]);
      next[row][col] = null;
      return next;
    });
  }, [dim]);

  // High-level paint-mode actions used by the continuous click-drag brush.
  const paintAtCell = useCallback((col, row) => {
    if (!selectedTile) return;
    placeTile(selectedTile, col, row);
  }, [selectedTile, placeTile]);

  const eraseAtCell = useCallback((col, row) => removeTile(col, row), [removeTile]);

  const clearGrid = useCallback(() => {
    setTiles(makeEmpty(dim));
    const c = Math.floor(dim / 2);
    placeDummyAtCell(c, c);
  }, [dim, placeDummyAtCell]);

  const resetDummy = useCallback(() => {
    const c = Math.floor(dim / 2);
    placeDummyAtCell(c, c);
  }, [dim, placeDummyAtCell]);

  // Used ONLY for the one-time hand-off from the Editor ("test this tile
  // I just made") — it's reasonable for a fresh, empty tester to configure
  // itself to match the tile you arrived with. Deliberately NOT used for
  // ordinary library clicks (see selectTile below) — that was the cause of
  // the grid feeling "predisposed"/stuck: selecting any tile mid-session
  // silently overwrote whatever grid shape/size/ratio you'd already set up.
  const configureFromTile = useCallback((tile) => {
    setSelectedTile(tile);
    setPaintMode('paint');
    setGridShape(tile.grid_shape);
    setCellWidth(tile.width);
    setCellHeight(tile.height);
    if (tile.grid_shape === 'isometric') {
      setIsoRatioW(tile.iso_ratio_w || 2);
      setIsoRatioH(tile.iso_ratio_h || 1);
      const r = (tile.iso_ratio_w || 2) / (tile.iso_ratio_h || 1);
      setCellHeight(Math.round(tile.width / r));
    }
    const c = Math.floor(dim / 2);
    placeDummyAtCell(c, c);
  }, [dim, placeDummyAtCell]);

  // Arms a tile for painting only — the grid's shape/size/ratio (which the
  // toolbar controls) is left exactly as the user configured it. This is
  // what clicking a tile in the library should call.
  const selectTile = useCallback((tile) => {
    setSelectedTile(tile);
    setPaintMode('paint');
  }, []);

  // Explicit, opt-in version of the grid-matching behavior above — for
  // when the user actually wants the grid reshaped to fit a specific tile,
  // rather than it happening as a surprise side effect of selection.
  const matchGridToTile = useCallback((tile) => {
    if (!tile) return;
    setGridShape(tile.grid_shape);
    setCellWidth(tile.width);
    setCellHeight(tile.height);
    if (tile.grid_shape === 'isometric') {
      setIsoRatioW(tile.iso_ratio_w || 2);
      setIsoRatioH(tile.iso_ratio_h || 1);
      const r = (tile.iso_ratio_w || 2) / (tile.iso_ratio_h || 1);
      setCellHeight(Math.round(tile.width / r));
    }
  }, []);

  const resizeGrid = useCallback((newDim) => {
    const clamped = Math.max(4, Math.min(64, newDim || 4));
    setDim(clamped);
    setTiles(makeEmpty(clamped));
    const c = Math.floor(clamped / 2);
    placeDummyAtCell(c, c);
  }, [placeDummyAtCell]);

  return {
    dim, setDim, resizeGrid,
    gridShape, setGridShape,
    cellWidth, setCellWidth, cellHeight, setCellHeight,
    isoRatioW, setIsoRatioW, isoRatioH, setIsoRatioH,
    zoom, setZoom, pan, setPan, panBy, resetView,
    tiles, placeTile, removeTile,
    paintMode, setPaintMode, selectedTile, setSelectedTile, paintAtCell, eraseAtCell,
    dummyPos, dummyScreenPos, dummyDirection, isMoving, walkCycle,
    moveDummy, setDirectionHeld, clearGrid, resetDummy,
    configureFromTile, selectTile, matchGridToTile,
    patrolMode, setPatrolMode,
    getCellScreenPos,
  };
}
