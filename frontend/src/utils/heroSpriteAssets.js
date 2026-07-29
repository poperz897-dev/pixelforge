/**
 * PixelForge Hero Sprite Assets
 *
 * Loads the two real, found-online sprite sheets used as an alternative to
 * the procedural dummy in heroSprite.js, and exposes the frame-lookup data
 * needed to slice + animate them on a <canvas>.
 *
 * square-dummy-walk.png
 *   Composited from the Liberated Pixel Cup "Universal LPC Spritesheet"
 *   (body + pants + shortsleeve shirt + bedhead hair layers), a true
 *   top-down 4-directional (up/left/down/right) walk cycle.
 *   License: CC-BY-SA 3.0 / GPL 3.0 (dual-licensed) — see THIRD_PARTY_LICENSES.md.
 *
 * iso-dummy-walk.png
 *   Composited from Flare (flareteam/flare-game)'s open-source isometric
 *   avatar art (feet + legs + hands + chest + head layers), an 8-directional
 *   run cycle, re-sliced down to the 4 diagonal directions this project's
 *   isometric grid actually uses (nw/ne/sw/se). Reused across all 4 iso
 *   ratio presets — see the note in heroSprite.js for why one sprite covers
 *   every ratio.
 *   License: CC BY-SA 3.0 — see THIRD_PARTY_LICENSES.md.
 *
 * Both sheets are bundled as static assets, so Vite fingerprints/serves them
 * like any other imported file — no network fetch at runtime.
 */

import squareSrc from '../assets/sprites/square-dummy-walk.png';
import isoSrc from '../assets/sprites/iso-dummy-walk.png';

export const SPRITE_SHEETS = {
  square: {
    src: squareSrc,
    frameW: 64,
    frameH: 64,
    frames: 9,
    rows: { up: 0, left: 1, down: 2, right: 3 },
    // Fraction of the frame's height, from the top, where the feet touch
    // the ground — measured from the sheet's actual pixel content so the
    // character's feet land on the tile instead of floating or sinking.
    groundFrac: 0.96,
    // Character height as a multiple of the tile's cell width. Using
    // cellWidth (rather than the tile's height/size) keeps the dummy a
    // consistent apparent size regardless of grid settings.
    displayScale: 1.35,
  },
  iso: {
    src: isoSrc,
    frameW: 197,
    frameH: 193,
    frames: 8,
    rows: { nw: 0, ne: 1, sw: 2, se: 3 },
    groundFrac: 0.808,
    displayScale: 1.5,
  },
};

const loadedImages = {};

function startLoading(key) {
  if (loadedImages[key]) return loadedImages[key];
  const img = new Image();
  img.src = SPRITE_SHEETS[key].src;
  loadedImages[key] = img;
  return img;
}

// Kick off loading for both sheets as soon as this module is first imported
// (i.e. as soon as the Tile Tester page mounts) so they're usually ready
// well before a person actually looks at the dummy.
startLoading('square');
startLoading('iso');

/** Returns the cached <img> for a sheet, loading it on first access. */
export function getSpriteImage(type) {
  const key = type === 'square' ? 'square' : 'iso';
  return startLoading(key);
}

/** True once the sheet has actually finished decoding and has real pixels. */
export function isSpriteReady(type) {
  const img = getSpriteImage(type);
  return !!img && img.complete && img.naturalWidth > 0;
}
