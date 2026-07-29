import { makeEmptyGrid } from './compositing.js';

// In-memory document shape used by useDocumentModel:
//   { layers: [{id, parent_id, is_group, name, position, visible, locked, opacity, blend_mode}],
//     frames: [{id, position, duration_ms}],
//     cels: Map<"layerId:frameId", grid> }
// IDs are opaque strings -- either a small client-generated id (new
// layers/frames not yet saved) or the real numeric DB id (stringified) once
// loaded from/saved to the server. Cels are addressed by (layer, frame)
// exactly like the backend's artwork_cels table.

let nextTempId = 1;
export function tempId(prefix) {
  return `${prefix}-new-${nextTempId++}`;
}

export function celKey(layerId, frameId) {
  return `${layerId}:${frameId}`;
}

export function createDefaultDocument(width, height) {
  const layerId = tempId('layer');
  const frameId = tempId('frame');
  const cels = new Map();
  cels.set(celKey(layerId, frameId), makeEmptyGrid(width, height));
  return {
    layers: [{ id: layerId, parent_id: null, is_group: false, name: 'Layer 1', position: 0, visible: true, locked: false, opacity: 1, blend_mode: 'normal' }],
    frames: [{ id: frameId, position: 0, duration_ms: 100 }],
    cels,
  };
}

// Converts the API's { layers, frames, cels: [{layer_id, frame_id, pixel_data}] }
// response shape into the in-memory shape above.
export function fromServerDocument(serverDoc) {
  const layers = (serverDoc.layers || []).map((l) => ({
    id: String(l.id),
    parent_id: l.parent_id != null ? String(l.parent_id) : null,
    is_group: !!l.is_group,
    name: l.name,
    position: l.position,
    visible: !!l.visible,
    locked: !!l.locked,
    opacity: l.opacity,
    blend_mode: l.blend_mode,
  }));
  const frames = (serverDoc.frames || []).map((f) => ({ id: String(f.id), position: f.position, duration_ms: f.duration_ms }));
  const cels = new Map();
  for (const c of serverDoc.cels || []) {
    cels.set(celKey(String(c.layer_id), String(c.frame_id)), c.pixel_data);
  }
  return { layers, frames, cels };
}

// Converts the in-memory shape back into the API payload shape for
// POST/PUT. IDs are passed through as-is (client temp ids for new
// layers/frames, real ids for existing ones); the backend resolves
// references when persisting.
export function toServerPayload(document) {
  const cels = [];
  for (const layer of document.layers) {
    for (const frame of document.frames) {
      const grid = document.cels.get(celKey(layer.id, frame.id));
      if (grid) cels.push({ layer_id: layer.id, frame_id: frame.id, pixel_data: grid });
    }
  }
  return { layers: document.layers, frames: document.frames, cels };
}

function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

export function cloneDocument(document) {
  const cels = new Map();
  for (const [key, grid] of document.cels) cels.set(key, cloneGrid(grid));
  return {
    layers: document.layers.map((l) => ({ ...l })),
    frames: document.frames.map((f) => ({ ...f })),
    cels,
  };
}

// Grid size/shape changes clear all cels (non-destructive resize is a
// later section) -- every layer's cel at every frame gets replaced with a
// fresh empty grid at the new dimensions.
export function resizeDocument(document, newWidth, newHeight) {
  const cels = new Map();
  for (const layer of document.layers) {
    for (const frame of document.frames) {
      cels.set(celKey(layer.id, frame.id), makeEmptyGrid(newWidth, newHeight));
    }
  }
  return { layers: document.layers.map((l) => ({ ...l })), frames: document.frames.map((f) => ({ ...f })), cels };
}

// True if every cel in the document is entirely empty -- used where the
// old code checked `grid.flat().some(Boolean)` before warning that a
// destructive change (resize/shape change) will clear the drawing.
export function documentHasContent(document) {
  for (const grid of document.cels.values()) {
    if (grid.some((row) => row.some(Boolean))) return true;
  }
  return false;
}
