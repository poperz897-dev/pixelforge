import { useState, useCallback, useMemo, useRef } from 'react';
import { flattenDocument, makeEmptyGrid } from '../utils/compositing.js';
import { celKey, cloneDocument, createDefaultDocument, fromServerDocument, resizeDocument, tempId } from '../utils/documentModel.js';

const MAX_HISTORY = 50;

function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

// Manages the full layers x frames x cels document -- the Section 2
// replacement for usePixelGrid's single grid. Undo/redo covers both
// per-stroke pixel edits (one history entry per mouse-down -> up, same
// feel as before) and structural edits (add/remove layer, add frame,
// reorder, etc. -- one history entry per action, since those are already
// atomic single actions rather than a continuous gesture).
export function useDocumentModel(width, height, initialServerDocument = null) {
  const [document, setDocument] = useState(() =>
    initialServerDocument ? fromServerDocument(initialServerDocument) : createDefaultDocument(width, height)
  );
  const [activeLayerId, setActiveLayerId] = useState(() => document.layers.find((l) => !l.is_group)?.id ?? document.layers[0]?.id);
  const [activeFrameId, setActiveFrameId] = useState(() => document.frames[0]?.id);

  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const strokeStartRef = useRef(null);

  // Structural edits (add/remove/reorder layer or frame, opacity, blend
  // mode, etc.) are atomic -- snapshot immediately before applying.
  const commit = useCallback((mutate) => {
    setDocument((prev) => {
      setHistory((h) => [...h.slice(-MAX_HISTORY + 1), cloneDocument(prev)]);
      setFuture([]);
      return mutate(prev);
    });
  }, []);

  const beginStroke = useCallback(() => {
    strokeStartRef.current = cloneDocument(document);
  }, [document]);

  const endStroke = useCallback(() => {
    if (!strokeStartRef.current) return;
    setHistory((h) => [...h.slice(-MAX_HISTORY + 1), strokeStartRef.current]);
    setFuture([]);
    strokeStartRef.current = null;
  }, []);

  const activeCelKey = useMemo(() => celKey(activeLayerId, activeFrameId), [activeLayerId, activeFrameId]);

  const setPixel = useCallback(
    (x, y, color) => {
      setDocument((prev) => {
        const layer = prev.layers.find((l) => l.id === activeLayerId);
        if (!layer || layer.locked) return prev;
        const grid = prev.cels.get(activeCelKey);
        if (!grid) return prev;
        if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return prev;
        if (grid[y][x] === color) return prev;
        const nextGrid = cloneGrid(grid);
        nextGrid[y][x] = color;
        const cels = new Map(prev.cels);
        cels.set(activeCelKey, nextGrid);
        return { ...prev, cels };
      });
    },
    [activeCelKey, activeLayerId]
  );

  // Replaces every occurrence of the color under (x, y) within the active
  // layer's current cel -- scoped to that cel only, matching how setPixel/
  // floodFill are also scoped to the active layer rather than the
  // flattened multi-layer composite.
  const replaceColor = useCallback(
    (x, y, newColor) => {
      setDocument((prev) => {
        const layer = prev.layers.find((l) => l.id === activeLayerId);
        if (!layer || layer.locked) return prev;
        const grid = prev.cels.get(activeCelKey);
        if (!grid) return prev;
        if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return prev;
        const targetColor = grid[y][x];
        if (targetColor === newColor) return prev;
        const nextGrid = grid.map((row) => row.map((c) => (c === targetColor ? newColor : c)));
        const cels = new Map(prev.cels);
        cels.set(activeCelKey, nextGrid);
        return { ...prev, cels };
      });
    },
    [activeCelKey, activeLayerId]
  );

  // isAllowed(x, y) optionally restricts fill to a sub-region of the square
  // buffer -- used for isometric tiles, see usePixelGrid's original comment.
  const floodFill = useCallback(
    (x, y, color, isAllowed) => {
      setDocument((prev) => {
        const layer = prev.layers.find((l) => l.id === activeLayerId);
        if (!layer || layer.locked) return prev;
        const grid = prev.cels.get(activeCelKey);
        if (!grid) return prev;
        if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return prev;
        if (isAllowed && !isAllowed(x, y)) return prev;
        const target = grid[y][x];
        if (target === color) return prev;
        const nextGrid = cloneGrid(grid);
        const stack = [[x, y]];
        let safety = 0;
        const maxIterations = width * height * 4 + 100;
        while (stack.length && safety < maxIterations) {
          safety++;
          const [cx, cy] = stack.pop();
          if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
          if (isAllowed && !isAllowed(cx, cy)) continue;
          if (nextGrid[cy][cx] !== target) continue;
          nextGrid[cy][cx] = color;
          stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
        }
        const cels = new Map(prev.cels);
        cels.set(activeCelKey, nextGrid);
        return { ...prev, cels };
      });
    },
    [activeCelKey, activeLayerId, width, height]
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prevState = h[h.length - 1];
      setDocument((cur) => {
        setFuture((f) => [cur, ...f]);
        return prevState;
      });
      return h.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const [nextState, ...rest] = f;
      setDocument((cur) => {
        setHistory((h) => [...h, cur]);
        return nextState;
      });
      return rest;
    });
  }, []);

  // Clears the active layer's cel at the active frame -- matches Aseprite's
  // "clear" acting on the current layer, not the whole flattened document.
  const clear = useCallback(() => {
    commit((prev) => {
      const cels = new Map(prev.cels);
      cels.set(activeCelKey, makeEmptyGrid(width, height));
      return { ...prev, cels };
    });
  }, [commit, activeCelKey, width, height]);

  // Grid size/shape change -- old undo history doesn't apply to
  // different-shaped cels, so it resets cleanly rather than leaving
  // stale, wrongly-sized entries (same rationale as the old resize()).
  const resize = useCallback((newWidth, newHeight) => {
    setDocument((prev) => resizeDocument(prev, newWidth, newHeight));
    setHistory([]);
    setFuture([]);
    strokeStartRef.current = null;
  }, []);

  // --- Layer operations (data-model support for Section 4's Layers panel) ---

  const addLayer = useCallback(
    ({ name = 'Layer', parentId = null } = {}) => {
      commit((prev) => {
        const siblings = prev.layers.filter((l) => (l.parent_id ?? null) === (parentId ?? null));
        const newLayer = {
          id: tempId('layer'),
          parent_id: parentId,
          is_group: false,
          name,
          position: siblings.length,
          visible: true,
          locked: false,
          opacity: 1,
          blend_mode: 'normal',
        };
        const cels = new Map(prev.cels);
        for (const frame of prev.frames) cels.set(celKey(newLayer.id, frame.id), makeEmptyGrid(width, height));
        return { ...prev, layers: [...prev.layers, newLayer], cels };
      });
    },
    [commit, width, height]
  );

  const addGroup = useCallback(
    ({ name = 'Group', parentId = null } = {}) => {
      commit((prev) => {
        const siblings = prev.layers.filter((l) => (l.parent_id ?? null) === (parentId ?? null));
        const newGroup = {
          id: tempId('layer'),
          parent_id: parentId,
          is_group: true,
          name,
          position: siblings.length,
          visible: true,
          locked: false,
          opacity: 1,
          blend_mode: 'normal',
        };
        return { ...prev, layers: [...prev.layers, newGroup] };
      });
    },
    [commit]
  );

  const duplicateLayer = useCallback(
    (layerId) => {
      commit((prev) => {
        const source = prev.layers.find((l) => l.id === layerId);
        if (!source) return prev;
        const siblings = prev.layers.filter((l) => (l.parent_id ?? null) === (source.parent_id ?? null));
        const copy = { ...source, id: tempId('layer'), name: `${source.name} copy`, position: siblings.length };
        const cels = new Map(prev.cels);
        for (const frame of prev.frames) {
          const grid = prev.cels.get(celKey(layerId, frame.id));
          if (grid) cels.set(celKey(copy.id, frame.id), cloneGrid(grid));
        }
        return { ...prev, layers: [...prev.layers, copy], cels };
      });
    },
    [commit]
  );

  const removeLayer = useCallback(
    (layerId) => {
      commit((prev) => {
        if (prev.layers.length <= 1) return prev; // always keep at least one paintable layer
        // Removing a group removes its descendants too.
        const toRemove = new Set([layerId]);
        let grew = true;
        while (grew) {
          grew = false;
          for (const l of prev.layers) {
            if (l.parent_id != null && toRemove.has(l.parent_id) && !toRemove.has(l.id)) {
              toRemove.add(l.id);
              grew = true;
            }
          }
        }
        const layers = prev.layers.filter((l) => !toRemove.has(l.id));
        const cels = new Map();
        for (const [key, grid] of prev.cels) {
          const [lid] = key.split(':');
          if (!toRemove.has(lid)) cels.set(key, grid);
        }
        return { ...prev, layers, cels };
      });
    },
    [commit]
  );

  const renameLayer = useCallback(
    (layerId, name) => {
      commit((prev) => ({ ...prev, layers: prev.layers.map((l) => (l.id === layerId ? { ...l, name } : l)) }));
    },
    [commit]
  );

  const toggleLayerVisible = useCallback(
    (layerId) => {
      commit((prev) => ({ ...prev, layers: prev.layers.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l)) }));
    },
    [commit]
  );

  const toggleLayerLocked = useCallback(
    (layerId) => {
      commit((prev) => ({ ...prev, layers: prev.layers.map((l) => (l.id === layerId ? { ...l, locked: !l.locked } : l)) }));
    },
    [commit]
  );

  const setLayerOpacity = useCallback(
    (layerId, opacity) => {
      commit((prev) => ({ ...prev, layers: prev.layers.map((l) => (l.id === layerId ? { ...l, opacity: Math.max(0, Math.min(1, opacity)) } : l)) }));
    },
    [commit]
  );

  const setLayerBlendMode = useCallback(
    (layerId, blendMode) => {
      commit((prev) => ({ ...prev, layers: prev.layers.map((l) => (l.id === layerId ? { ...l, blend_mode: blendMode } : l)) }));
    },
    [commit]
  );

  // Moves a layer to a new position among the siblings of `newParentId`
  // (drag-to-reorder / drag-into-group support for Section 4).
  const reorderLayer = useCallback(
    (layerId, newParentId, newIndex) => {
      commit((prev) => {
        const layers = prev.layers.map((l) => ({ ...l }));
        const moving = layers.find((l) => l.id === layerId);
        if (!moving) return prev;
        moving.parent_id = newParentId;
        const siblings = layers.filter((l) => l.id !== layerId && (l.parent_id ?? null) === (newParentId ?? null));
        siblings.sort((a, b) => a.position - b.position);
        siblings.splice(newIndex, 0, moving);
        siblings.forEach((l, i) => (l.position = i));
        return { ...prev, layers };
      });
    },
    [commit]
  );

  // --- Frame operations (data-model support for Section 5's Timeline) ---

  const addFrame = useCallback(
    ({ afterFrameId = null, durationMs = 100 } = {}) => {
      commit((prev) => {
        const afterIndex = afterFrameId ? prev.frames.findIndex((f) => f.id === afterFrameId) : prev.frames.length - 1;
        const insertAt = afterIndex + 1;
        const newFrame = { id: tempId('frame'), position: insertAt, duration_ms: durationMs };
        const frames = [...prev.frames.slice(0, insertAt), newFrame, ...prev.frames.slice(insertAt)].map((f, i) => ({ ...f, position: i }));
        const cels = new Map(prev.cels);
        for (const layer of prev.layers) if (!layer.is_group) cels.set(celKey(layer.id, newFrame.id), makeEmptyGrid(width, height));
        return { ...prev, frames, cels };
      });
    },
    [commit, width, height]
  );

  const duplicateFrame = useCallback(
    (frameId) => {
      commit((prev) => {
        const sourceIndex = prev.frames.findIndex((f) => f.id === frameId);
        if (sourceIndex === -1) return prev;
        const source = prev.frames[sourceIndex];
        const newFrame = { id: tempId('frame'), position: sourceIndex + 1, duration_ms: source.duration_ms };
        const frames = [...prev.frames.slice(0, sourceIndex + 1), newFrame, ...prev.frames.slice(sourceIndex + 1)].map((f, i) => ({ ...f, position: i }));
        const cels = new Map(prev.cels);
        for (const layer of prev.layers) {
          const grid = prev.cels.get(celKey(layer.id, frameId));
          if (grid) cels.set(celKey(layer.id, newFrame.id), cloneGrid(grid));
        }
        return { ...prev, frames, cels };
      });
    },
    [commit]
  );

  const removeFrame = useCallback(
    (frameId) => {
      commit((prev) => {
        if (prev.frames.length <= 1) return prev; // always keep at least one frame
        const frames = prev.frames.filter((f) => f.id !== frameId).map((f, i) => ({ ...f, position: i }));
        const cels = new Map();
        for (const [key, grid] of prev.cels) {
          const [, fid] = key.split(':');
          if (fid !== frameId) cels.set(key, grid);
        }
        return { ...prev, frames, cels };
      });
    },
    [commit]
  );

  const setFrameDuration = useCallback(
    (frameId, durationMs) => {
      commit((prev) => ({ ...prev, frames: prev.frames.map((f) => (f.id === frameId ? { ...f, duration_ms: Math.max(10, durationMs) } : f)) }));
    },
    [commit]
  );

  const reorderFrame = useCallback(
    (frameId, newIndex) => {
      commit((prev) => {
        const frames = prev.frames.map((f) => ({ ...f })).sort((a, b) => a.position - b.position);
        const idx = frames.findIndex((f) => f.id === frameId);
        if (idx === -1) return prev;
        const [moving] = frames.splice(idx, 1);
        frames.splice(newIndex, 0, moving);
        frames.forEach((f, i) => (f.position = i));
        return { ...prev, frames };
      });
    },
    [commit]
  );

  // The flattened grid for the active frame -- what Canvas actually
  // renders, and what export/thumbnail/"send to Tile Tester" read.
  const compositeGrid = useMemo(
    () => flattenDocument({ layers: document.layers, cels: document.cels, frameId: activeFrameId, width, height }),
    [document, activeFrameId, width, height]
  );

  const activeLayer = useMemo(() => document.layers.find((l) => l.id === activeLayerId) ?? null, [document.layers, activeLayerId]);

  return {
    document,
    compositeGrid,
    activeLayerId,
    activeFrameId,
    activeLayer,
    setActiveLayerId,
    setActiveFrameId,

    setPixel,
    floodFill,
    replaceColor,
    beginStroke,
    endStroke,
    undo,
    redo,
    clear,
    resize,
    canUndo: history.length > 0,
    canRedo: future.length > 0,

    addLayer,
    addGroup,
    duplicateLayer,
    removeLayer,
    renameLayer,
    toggleLayerVisible,
    toggleLayerLocked,
    setLayerOpacity,
    setLayerBlendMode,
    reorderLayer,

    addFrame,
    duplicateFrame,
    removeFrame,
    setFrameDuration,
    reorderFrame,
  };
}
