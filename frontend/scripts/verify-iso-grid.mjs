/**
 * Standalone correctness check for the isometric grid math.
 *
 * Run with:  npm run verify:iso
 *
 * This does NOT rely on visual inspection. It checks, per pixel, for
 * every grid size the app offers plus several custom ratios:
 *   - the mask is mirror-symmetric left/right and top/bottom
 *   - every row/column is a single contiguous run (no holes)
 *   - the traced outline encloses EXACTLY the same pixels as the mask
 *     (no protrusions, no missing pixels, no duplicated edge pixels)
 *
 * If a future change reintroduces an asymmetry bug, this script will
 * fail loudly instead of it being discovered by eye later.
 */
import { verifyAllIsoSizes, ISO_GRID_SIZES } from '../src/utils/isoGrid.js';

const results = verifyAllIsoSizes();
const failures = results.filter((r) => !r.isPerfect);

console.log(`Checked ${results.length} (grid size × ratio) combinations across sizes: ${ISO_GRID_SIZES.join(', ')}`);

if (failures.length === 0) {
  console.log('PASS — every combination is symmetric, contiguous, and the outline exactly matches the mask.');
  process.exit(0);
} else {
  console.error(`FAIL — ${failures.length} combination(s) violated the grid invariants:`);
  for (const f of failures) {
    console.error(
      `  size=${f.size} ratio=${f.ratio}  hSymErrors=${f.hSymErrors} vSymErrors=${f.vSymErrors} ` +
      `contiguityErrors=${f.contiguityErrors} outlineMismatches=${f.outlineMismatches}`
    );
  }
  process.exit(1);
}
