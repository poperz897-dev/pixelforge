import { useState, useCallback } from 'react';

const MAX_HISTORY = 50;

function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

function makeEmptyGrid(w, h) {
  return Array.from({ length: h }, () => Array(w).fill(null));
}

// Manages a width x height grid of colors (or null for empty/transparent),
// plus undo/redo history and flood fill. One history entry is pushed per
// stroke (mouse down -> up), not per pixel, so undo feels natural.
export function usePixelGrid(width, height, initialData = null) {
  const [grid, setGrid] = useState(() => initialData || makeEmptyGrid(width, height));
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [strokeStart, setStrokeStart] = useState(null);

  const beginStroke = useCallback(() => {
    setStrokeStart(cloneGrid(grid));
  }, [grid]);

  const endStroke = useCallback(() => {
    if (!strokeStart) return;
    setHistory((h) => [...h.slice(-MAX_HISTORY + 1), strokeStart]);
    setFuture([]);
    setStrokeStart(null);
  }, [strokeStart]);

  const setPixel = useCallback((x, y, color) => {
    setGrid((prev) => {
      if (y < 0 || y >= prev.length || x < 0 || x >= prev[0].length) return prev;
      if (prev[y][x] === color) return prev;
      const next = cloneGrid(prev);
      next[y][x] = color;
      return next;
    });
  }, []);

  // isAllowed(x, y) optionally restricts fill to a sub-region of the square
  // buffer -- used for isometric tiles, where only the inscribed diamond is
  // drawable and the rest is transparent padding that fill should never
  // leak into. Omitted entirely for plain square grids.
  const floodFill = useCallback(
    (x, y, color, isAllowed) => {
      setGrid((prev) => {
        if (y < 0 || y >= prev.length || x < 0 || x >= prev[0].length) return prev;
        if (isAllowed && !isAllowed(x, y)) return prev;
        const target = prev[y][x];
        if (target === color) return prev;
        const next = cloneGrid(prev);
        const stack = [[x, y]];
        // Defensive cap: a grid-shaped stack can't legitimately need more
        // than ~4 pushes per cell, so this only ever triggers on a genuine
        // bug rather than a slow-but-valid fill.
        let safety = 0;
        const maxIterations = width * height * 4 + 100;
        while (stack.length && safety < maxIterations) {
          safety++;
          const [cx, cy] = stack.pop();
          if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
          if (isAllowed && !isAllowed(cx, cy)) continue;
          if (next[cy][cx] !== target) continue;
          next[cy][cx] = color;
          stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
        }
        return next;
      });
    },
    [width, height]
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prevState = h[h.length - 1];
      setFuture((f) => [grid, ...f]);
      setGrid(prevState);
      return h.slice(0, -1);
    });
  }, [grid]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const [nextState, ...rest] = f;
      setHistory((h) => [...h, grid]);
      setGrid(nextState);
      return rest;
    });
  }, [grid]);

  const clear = useCallback(() => {
    setHistory((h) => [...h.slice(-MAX_HISTORY + 1), cloneGrid(grid)]);
    setFuture([]);
    setGrid(makeEmptyGrid(width, height));
  }, [grid, width, height]);

  // Used when the grid's own dimensions change (grid size or shape
  // picker) -- old undo history doesn't apply to a different-shaped grid,
  // so it resets cleanly rather than leaving stale, wrongly-sized entries.
  const resize = useCallback((newWidth, newHeight) => {
    setGrid(makeEmptyGrid(newWidth, newHeight));
    setHistory([]);
    setFuture([]);
    setStrokeStart(null);
  }, []);

  return {
    grid,
    setPixel,
    floodFill,
    beginStroke,
    endStroke,
    undo,
    redo,
    clear,
    resize,
    canUndo: history.length > 0,
    canRedo: future.length > 0,
  };
}
