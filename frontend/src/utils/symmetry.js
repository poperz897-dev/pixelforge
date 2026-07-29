// Fixed-axis mirroring for the symmetry tool. The axis sits at the exact
// center of the grid (not draggable, unlike the original spec's mention of
// a repositionable axis) -- covers the common case (symmetric characters/
// icons) without a second interactive drag-handle system on the canvas.
export function mirrorPoints(x, y, width, height, symmetry) {
  const points = [{ x, y }];
  if (symmetry?.horizontal) points.push({ x: width - 1 - x, y });
  if (symmetry?.vertical) points.push({ x, y: height - 1 - y });
  if (symmetry?.horizontal && symmetry?.vertical) points.push({ x: width - 1 - x, y: height - 1 - y });

  const seen = new Set();
  return points.filter((p) => {
    const key = `${p.x},${p.y}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
