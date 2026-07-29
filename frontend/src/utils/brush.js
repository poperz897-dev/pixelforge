// Brush footprints and stroke interpolation, shared by pencil/eraser
// freehand stamping and the line/rect/ellipse shape tools (which reuse
// linePoints for their own edges/previews).

export const BRUSH_SIZE_PRESETS = [1, 2, 3, 4, 6, 8];
export const MIN_BRUSH_SIZE = 1;
export const MAX_BRUSH_SIZE = 16;

// Offsets (relative to a center cell) covering a size x size square or the
// inscribed circle of that square. size=1 is always just the center cell.
export function brushOffsets(size, shape) {
  if (size <= 1) return [{ dx: 0, dy: 0 }];
  const lo = -Math.floor((size - 1) / 2);
  const hi = Math.ceil((size - 1) / 2);
  const r = size / 2;
  const offsets = [];
  for (let dy = lo; dy <= hi; dy++) {
    for (let dx = lo; dx <= hi; dx++) {
      if (shape === 'circle') {
        // +0.25 slack keeps small even-numbered circles (2px, 4px) from
        // rounding down to a plus-sign shape instead of a blob.
        if (dx * dx + dy * dy <= r * r + 0.25) offsets.push({ dx, dy });
      } else {
        offsets.push({ dx, dy });
      }
    }
  }
  return offsets;
}

// Bresenham -- every integer cell a straight line from (x0,y0) to (x1,y1)
// passes through, endpoints included. Used both to fill the gap between two
// pointermove samples (so fast drags don't leave holes) and as the line
// shape tool's own pixel list.
export function linePoints(x0, y0, x1, y1) {
  const points = [];
  let x = x0, y = y0;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    points.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
  return points;
}

// De-duplicated set of cells covered by a brush stamp swept from
// (x0,y0) to (x1,y1) -- pass the same point twice for a single dab.
export function strokeCells(x0, y0, x1, y1, size, shape) {
  const offsets = brushOffsets(size, shape);
  const seen = new Set();
  const cells = [];
  for (const { x, y } of linePoints(x0, y0, x1, y1)) {
    for (const { dx, dy } of offsets) {
      const cx = x + dx, cy = y + dy;
      const key = `${cx},${cy}`;
      if (!seen.has(key)) {
        seen.add(key);
        cells.push({ x: cx, y: cy });
      }
    }
  }
  return cells;
}
