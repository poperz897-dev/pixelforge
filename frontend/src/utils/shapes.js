import { linePoints } from './brush.js';

export { linePoints };

export function rectPixels(x0, y0, x1, y1, filled) {
  const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
  const points = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (filled || x === minX || x === maxX || y === minY || y === maxY) {
        points.push({ x, y });
      }
    }
  }
  return points;
}

// cx/cy/rx/ry may be fractional (a rect drawn between two integer corners
// has a center that often isn't). Outline = an inside cell with at least
// one 4-neighbor outside -- correct at any size, not a fixed-width ring.
export function ellipsePixels(cx, cy, rx, ry, filled) {
  rx = Math.max(rx, 0);
  ry = Math.max(ry, 0);
  const inside = (x, y) => {
    if (rx < 0.5 || ry < 0.5) return Math.round(cx) === x && Math.round(cy) === y;
    const nx = (x - cx) / (rx + 0.5);
    const ny = (y - cy) / (ry + 0.5);
    return nx * nx + ny * ny <= 1;
  };
  const minX = Math.floor(cx - rx), maxX = Math.ceil(cx + rx);
  const minY = Math.floor(cy - ry), maxY = Math.ceil(cy + ry);
  const points = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!inside(x, y)) continue;
      if (filled) {
        points.push({ x, y });
      } else if (!inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1)) {
        points.push({ x, y });
      }
    }
  }
  return points;
}

// Shift modifier for rect/ellipse: force width === height, growing from
// whichever corner the drag started at.
export function boundsFromCorner(sx, sy, ex, ey, constrain) {
  let dx = ex - sx, dy = ey - sy;
  if (constrain) {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    dx = (dx < 0 ? -1 : 1) * side;
    dy = (dy < 0 ? -1 : 1) * side;
  }
  return { x0: sx, y0: sy, x1: sx + dx, y1: sy + dy };
}

// Alt modifier: the press point is the center rather than a corner.
export function boundsFromCenter(sx, sy, ex, ey, constrain) {
  let rx = Math.abs(ex - sx), ry = Math.abs(ey - sy);
  if (constrain) {
    const r = Math.max(rx, ry);
    rx = r; ry = r;
  }
  return { x0: sx - rx, y0: sy - ry, x1: sx + rx, y1: sy + ry };
}

// Shift modifier for the line tool: snap the drag angle to 15° increments,
// keeping the drawn length the same.
export function snapLineEnd(sx, sy, ex, ey, stepDegrees = 15) {
  const dx = ex - sx, dy = ey - sy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return { x: ex, y: ey };
  const step = (stepDegrees * Math.PI) / 180;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: Math.round(sx + Math.cos(angle) * dist), y: Math.round(sy + Math.sin(angle) * dist) };
}
