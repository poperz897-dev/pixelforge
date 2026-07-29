// Flattens a document (layers x frames, each cel a 2D grid) down to a single
// width x height grid -- "draw the one grid" from the old single-layer model
// becomes "composite all visible layers at the current frame, respecting
// opacity and blend mode." Mirrors backend/src/utils/compositing.js; kept as
// a separate copy since frontend and backend don't share a module boundary
// in this project.

export function makeEmptyGrid(width, height) {
  return Array.from({ length: height }, () => Array(width).fill(null));
}

function hexToRgb(hex) {
  const v = hex.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function rgbToHex([r, g, b]) {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('');
}

function applyBlendMode(mode, backdrop, source) {
  switch (mode) {
    case 'multiply':
      return backdrop.map((b, i) => (b * source[i]) / 255);
    case 'screen':
      return backdrop.map((b, i) => 255 - ((255 - b) * (255 - source[i])) / 255);
    case 'overlay':
      return backdrop.map((b, i) => (b < 128 ? (2 * b * source[i]) / 255 : 255 - (2 * (255 - b) * (255 - source[i])) / 255));
    case 'add':
      return backdrop.map((b, i) => b + source[i]);
    case 'normal':
    default:
      return source;
  }
}

function mixRgb(a, b, t) {
  return a.map((v, i) => v + (b[i] - v) * t);
}

// existingHex: whatever is already composited beneath this layer (or null
// for "nothing painted yet"). sourceHex: this layer's pixel at this cell
// (or null for "this layer has nothing here"). Blend modes are only
// meaningful against an actual backdrop color -- with nothing beneath,
// there's nothing to blend against, so the source shows through as-is.
function blendPixel(existingHex, sourceHex, mode, opacity) {
  if (!sourceHex) return existingHex;
  if (opacity <= 0) return existingHex;
  if (!existingHex) return sourceHex;
  const backdrop = hexToRgb(existingHex);
  const source = hexToRgb(sourceHex);
  const blended = applyBlendMode(mode, backdrop, source);
  return rgbToHex(mixRgb(backdrop, blended, Math.min(1, opacity)));
}

function isVisible(layer, byId) {
  let cur = layer;
  while (cur) {
    if (!cur.visible) return false;
    cur = cur.parent_id != null ? byId.get(cur.parent_id) : null;
  }
  return true;
}

function effectiveOpacity(layer, byId) {
  let o = 1;
  let cur = layer;
  while (cur) {
    o *= cur.opacity;
    cur = cur.parent_id != null ? byId.get(cur.parent_id) : null;
  }
  return o;
}

// Bottom-to-top draw order across the whole layer tree: walk each group's
// children in `position` order, recursing into groups but only emitting
// leaf (paintable) layers -- a group itself has no pixels of its own.
function drawOrder(layers) {
  const byId = new Map(layers.map((l) => [l.id, l]));
  const childrenOf = new Map();
  for (const l of layers) {
    const key = l.parent_id ?? null;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key).push(l);
  }
  for (const arr of childrenOf.values()) arr.sort((a, b) => a.position - b.position);

  const order = [];
  const walk = (parentId) => {
    for (const layer of childrenOf.get(parentId) || []) {
      if (layer.is_group) walk(layer.id);
      else order.push(layer);
    }
  };
  walk(null);
  return { order, byId };
}

// layers: [{id, parent_id, is_group, position, visible, locked, opacity, blend_mode}]
// cels: Map or plain object keyed by `${layer_id}:${frame_id}` -> 2D grid
export function flattenDocument({ layers, cels, frameId, width, height }) {
  const { order, byId } = drawOrder(layers);
  const result = makeEmptyGrid(width, height);
  const getCel = (layerId) => (cels instanceof Map ? cels.get(`${layerId}:${frameId}`) : cels[`${layerId}:${frameId}`]);

  for (const layer of order) {
    if (!isVisible(layer, byId)) continue;
    const grid = getCel(layer.id);
    if (!grid) continue;
    const opacity = effectiveOpacity(layer, byId);
    const mode = layer.blend_mode || 'normal';
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const source = grid[y]?.[x] ?? null;
        if (!source) continue;
        result[y][x] = blendPixel(result[y][x], source, mode, opacity);
      }
    }
  }

  return result;
}
