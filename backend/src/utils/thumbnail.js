const MAX_THUMB_DIM = 24;

// Downsamples a width x height pixel grid (2D array of hex color / null) to
// at most MAX_THUMB_DIM on its longest side, using nearest-neighbor sampling.
// Returns { width, height, pixels } with pixels as a flat row-major array --
// flat is more compact as JSON than nested arrays and is what the gallery
// card renderer expects.
//
// Why not a real rendered PNG: that would need a native canvas/image library
// (e.g. `canvas`, which needs system Cairo) which is heavier to install and
// risk in a minimal server setup. A downsampled grid gets the actual point of
// a thumbnail -- the gallery list stops shipping full-resolution pixel data
// (up to 64x64 = 4096 cells) and instead sends at most 24x24 = 576 cells --
// while staying dependency-free and trivially fast.
export function generateThumbnail(grid, width, height) {
  if (width <= MAX_THUMB_DIM && height <= MAX_THUMB_DIM) {
    return { width, height, pixels: grid.flat() };
  }

  const scale = MAX_THUMB_DIM / Math.max(width, height);
  const tw = Math.max(1, Math.round(width * scale));
  const th = Math.max(1, Math.round(height * scale));
  const pixels = new Array(tw * th);

  for (let y = 0; y < th; y++) {
    const sy = Math.min(height - 1, Math.floor((y * height) / th));
    for (let x = 0; x < tw; x++) {
      const sx = Math.min(width - 1, Math.floor((x * width) / tw));
      pixels[y * tw + x] = grid[sy][sx];
    }
  }

  return { width: tw, height: th, pixels };
}
