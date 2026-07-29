/**
 * PixelForge Hero Sprite System
 *
 * A small pixel-art style character with:
 * - 4-directional idle animation
 * - 4-directional walk animation
 * - Distinct front/back/left/right facing (not just a left/right mirror —
 *   facing away from the camera actually looks different from facing it)
 * - Smooth movement with bobbing
 *
 * As of the sprite-dummy update, this is now one of two renderers behind
 * drawHero(): the hand-coded canvas shapes below (kept as-is, and still the
 * fallback while a sheet is loading), or the real found-online sprite sheets
 * in heroSpriteAssets.js. See setDummyRenderMode() / getDummyRenderMode().
 *
 * Why one iso sprite covers all 4 isometric ratios: pixel-art sprite packs
 * are essentially only ever made for the 2:1 "classic" projection (non-2:1
 * diagonals render jagged at pixel scale, so artists avoid them) — sprites
 * pre-drawn at exactly 45°/36.87°/30° don't really exist in the wild. This
 * matches how real isometric games handle it too: the floor tiles carry the
 * projection's skew, but character sprites are drawn "billboarded" (upright,
 * unskewed) regardless of the floor's exact angle. resolveHeroType() below
 * already reflected that (square vs. one shared iso look) before this file
 * had any real art in it — the sprite renderer just continues that choice.
 */

import { SPRITE_SHEETS, getSpriteImage, isSpriteReady } from './heroSpriteAssets.js';

const HERO_PALETTES = {
  square: {
    primary: '#4ade80', secondary: '#22c55e', dark: '#15803d',
    highlight: '#86efac', shadow: '#14532d',
    skin: '#fde68a', skinShadow: '#d97706',
    hair: '#78350f',
    eye: '#1e293b', eyeHighlight: '#ffffff'
  },
  iso: {
    primary: '#60a5fa', secondary: '#3b82f6', dark: '#1d4ed8',
    highlight: '#93c5fd', shadow: '#1e3a8a',
    skin: '#fde68a', skinShadow: '#d97706',
    hair: '#78350f',
    eye: '#1e293b', eyeHighlight: '#ffffff'
  }
};

export function resolveHeroType(gridShape, isoRatioW, isoRatioH) {
  if (gridShape === 'square') return 'square';
  return 'iso';
}

// Which renderer drawHero() uses: 'sprite' draws the real sheets from
// heroSpriteAssets.js; 'procedural' draws the hand-coded canvas shapes
// below. Defaults to 'sprite' so that's what people see the first time they
// open the tester. This is a plain module variable rather than React state
// on purpose — drawHero runs inside TestGrid's requestAnimationFrame loop,
// which already re-executes every frame regardless of React re-renders, so
// a change here takes effect on the very next frame with no extra plumbing.
let dummyRenderMode = 'sprite';

export function setDummyRenderMode(mode) {
  dummyRenderMode = mode === 'procedural' ? 'procedural' : 'sprite';
}

export function getDummyRenderMode() {
  return dummyRenderMode;
}

/**
 * Draw a hero character — either the real sprite sheet (default) or the
 * procedural canvas dummy, per setDummyRenderMode().
 *
 * Directions: 'nw', 'ne', 'sw', 'se' (isometric) or 'up', 'down', 'left', 'right' (square)
 *
 * `cellW` (optional) is the grid's current cell width in px. Only the
 * sprite renderer uses it, to keep the dummy a consistent apparent size
 * across the four isometric ratio presets (see heroSpriteAssets.js for why
 * that has to be cell width rather than `size`). Omitting it falls back to
 * an approximation derived from `size`, matching pre-sprite behavior.
 */
export function drawHero(ctx, type, cx, cy, size, direction, time, walkCycle = 0, isMoving = false, cellW = null) {
  const palette = type === 'square' ? HERO_PALETTES.square : HERO_PALETTES.iso;
  const s = size / 2;

  const idleBob = Math.sin(time * 0.004) * 2;
  const walkBob = isMoving ? Math.abs(Math.sin(walkCycle * Math.PI * 2)) * 3.5 : 0;
  const bob = isMoving ? walkBob : idleBob;

  const baseY = cy + bob;

  // Shadow — stays anchored to the ground regardless of bob
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + size * 0.45, s * 0.5, s * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  if (dummyRenderMode === 'sprite') {
    const drawn = drawSpriteHero(ctx, type, cx, cy, size, bob, direction, walkCycle, isMoving, cellW ?? size / 0.7);
    if (drawn) return;
    // Sheet hasn't finished decoding yet (typically only the first frame or
    // two) — fall straight through to the procedural dummy so there's never
    // a blank gap while the image loads.
  }

  if (type === 'square') {
    drawSquareHero(ctx, cx, baseY, s, palette, direction, walkCycle, isMoving);
  } else {
    drawIsoHero(ctx, cx, baseY, s, palette, direction, walkCycle, isMoving);
  }
}

/**
 * Draws one frame of the real sprite sheet, choosing the row (direction)
 * and column (walk-cycle frame) to slice. Returns false without drawing
 * anything if the sheet isn't loaded yet or has no row for this direction,
 * so the caller can fall back to the procedural dummy.
 */
function drawSpriteHero(ctx, type, cx, cy, size, bob, direction, walkCycle, isMoving, cellW) {
  if (!isSpriteReady(type)) return false;
  const sheet = SPRITE_SHEETS[type];
  const row = sheet.rows[direction];
  if (row == null) return false;

  const img = getSpriteImage(type);
  const frameIndex = isMoving ? Math.min(sheet.frames - 1, Math.floor(walkCycle * sheet.frames)) : 0;
  const sx = frameIndex * sheet.frameW;
  const sy = row * sheet.frameH;

  const drawH = cellW * sheet.displayScale;
  const drawW = drawH * (sheet.frameW / sheet.frameH);
  // Same ground anchor as the shadow above (cy + size * 0.45), plus the
  // same gentle bob the procedural dummy uses, so switching render modes
  // doesn't shift the dummy relative to its own shadow.
  const groundY = cy + size * 0.45 + bob;
  const dx = cx - drawW / 2;
  const dy = groundY - drawH * sheet.groundFrac;

  const prevSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, sy, sheet.frameW, sheet.frameH, dx, dy, drawW, drawH);
  ctx.imageSmoothingEnabled = prevSmoothing;
  return true;
}

function drawSquareHero(ctx, cx, cy, s, c, direction, walkCycle, isMoving) {
  const facingRight = direction === 'right';
  const facingLeft = direction === 'left';
  const facingBack = direction === 'up';   // walking away from camera
  const facingFront = direction === 'down' || (!facingRight && !facingLeft && !facingBack);

  const bodyW = s * 0.7;
  const bodyH = s * 0.8;
  const bodyX = cx - bodyW / 2;
  const bodyY = cy - bodyH * 0.3;

  ctx.fillStyle = c.shadow;
  roundRect(ctx, bodyX + 2, bodyY + 2, bodyW, bodyH, 4);
  ctx.fill();

  const bodyGrad = ctx.createLinearGradient(bodyX, bodyY, bodyX, bodyY + bodyH);
  bodyGrad.addColorStop(0, c.highlight);
  bodyGrad.addColorStop(0.5, c.primary);
  bodyGrad.addColorStop(1, c.secondary);
  ctx.fillStyle = bodyGrad;
  roundRect(ctx, bodyX, bodyY, bodyW, bodyH, 4);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(bodyX + 3, bodyY + 3, 3, bodyH - 6);

  // Head
  const headSize = s * 0.45;
  const headX = cx - headSize / 2 + (facingRight ? 2 : facingLeft ? -2 : 0);
  const headY = bodyY - headSize * 0.7;

  ctx.fillStyle = c.skinShadow;
  ctx.beginPath();
  ctx.arc(headX + headSize / 2 + 1, headY + headSize / 2 + 1, headSize / 2, 0, Math.PI * 2);
  ctx.fill();

  const headGrad = ctx.createRadialGradient(headX + headSize * 0.3, headY + headSize * 0.3, 2, headX + headSize / 2, headY + headSize / 2, headSize / 2);
  headGrad.addColorStop(0, c.skin);
  headGrad.addColorStop(1, c.skinShadow);
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(headX + headSize / 2, headY + headSize / 2, headSize / 2, 0, Math.PI * 2);
  ctx.fill();

  if (facingBack) {
    // Back of the head — a patch of hair, no face
    ctx.fillStyle = c.hair;
    ctx.beginPath();
    ctx.arc(headX + headSize / 2, headY + headSize * 0.42, headSize * 0.48, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(headX + headSize * 0.3, headY + headSize * 0.15, headSize * 0.1, headSize * 0.5);
  } else {
    const eyeY = headY + headSize * 0.42;
    const eyeSize = headSize * 0.16;
    let eyeOffsetX = headSize * 0.16;
    if (facingLeft) eyeOffsetX = headSize * 0.02;
    else if (facingRight) eyeOffsetX = headSize * 0.3;

    for (const dir of [-1, 1]) {
      // Skip the far eye when looking hard to one side, for a believable turn
      if (facingLeft && dir === 1) continue;
      if (facingRight && dir === -1) continue;
      const ex = headX + headSize / 2 + dir * eyeOffsetX;
      ctx.fillStyle = c.eye;
      ctx.beginPath(); ctx.arc(ex, eyeY, eyeSize, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c.eyeHighlight;
      ctx.beginPath(); ctx.arc(ex - eyeSize * 0.2, eyeY - eyeSize * 0.2, eyeSize * 0.35, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Legs
  const legW = s * 0.12;
  const legH = s * 0.35;
  const legY = bodyY + bodyH - 2;

  if (isMoving) {
    const swing1 = Math.sin(walkCycle * Math.PI * 2) * s * 0.15;
    const swing2 = Math.sin((walkCycle + 0.5) * Math.PI * 2) * s * 0.15;
    ctx.fillStyle = c.dark;
    roundRect(ctx, cx - s * 0.2 + swing1, legY, legW, legH, 2); ctx.fill();
    roundRect(ctx, cx + s * 0.08 + swing2, legY, legW, legH, 2); ctx.fill();
  } else {
    ctx.fillStyle = c.dark;
    roundRect(ctx, cx - s * 0.2, legY, legW, legH, 2); ctx.fill();
    roundRect(ctx, cx + s * 0.08, legY, legW, legH, 2); ctx.fill();
  }

  // Arms
  const armW = s * 0.1;
  const armH = s * 0.3;
  const armY = bodyY + s * 0.15;

  if (isMoving) {
    const armSwing1 = Math.sin((walkCycle + 0.5) * Math.PI * 2) * s * 0.1;
    const armSwing2 = Math.sin(walkCycle * Math.PI * 2) * s * 0.1;
    ctx.fillStyle = c.secondary;
    roundRect(ctx, cx - s * 0.35 + armSwing1, armY, armW, armH, 2); ctx.fill();
    roundRect(ctx, cx + s * 0.25 + armSwing2, armY, armW, armH, 2); ctx.fill();
  } else {
    ctx.fillStyle = c.secondary;
    roundRect(ctx, cx - s * 0.35, armY + 2, armW, armH, 2); ctx.fill();
    roundRect(ctx, cx + s * 0.25, armY + 2, armW, armH, 2); ctx.fill();
  }
}

function drawIsoHero(ctx, cx, cy, s, c, direction, walkCycle, isMoving) {
  // 'se'/'sw' walk toward the camera (front), 'ne'/'nw' walk away (back)
  const facing = direction === 'se' || direction === 'ne' ? 'right' : 'left';
  const isFront = direction === 'se' || direction === 'sw';

  const bodyW = s * 0.5;
  const bodyH = s * 0.7;
  const bodyX = cx - bodyW / 2;
  const bodyY = cy - bodyH * 0.4;

  const bodyGrad = ctx.createLinearGradient(
    facing === 'right' ? bodyX : bodyX + bodyW, bodyY,
    facing === 'right' ? bodyX + bodyW : bodyX, bodyY
  );
  // Facing away reads slightly darker/cooler than facing the camera —
  // a cheap but effective way to sell "the back of the character."
  bodyGrad.addColorStop(0, isFront ? c.highlight : c.primary);
  bodyGrad.addColorStop(0.5, isFront ? c.primary : c.dark);
  bodyGrad.addColorStop(1, c.dark);
  ctx.fillStyle = bodyGrad;
  roundRect(ctx, bodyX, bodyY, bodyW, bodyH, 3);
  ctx.fill();

  const headSize = s * 0.35;
  const headX = cx - headSize / 2 + (facing === 'right' ? 2 : -2);
  const headY = bodyY - headSize * 0.6;

  const headGrad = ctx.createRadialGradient(
    headX + headSize * 0.3, headY + headSize * 0.3, 1,
    headX + headSize / 2, headY + headSize / 2, headSize / 2
  );
  headGrad.addColorStop(0, isFront ? c.skin : c.skinShadow);
  headGrad.addColorStop(1, c.skinShadow);
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(headX + headSize / 2, headY + headSize / 2, headSize / 2, 0, Math.PI * 2);
  ctx.fill();

  if (isFront) {
    // Face — one eye visible on the near side (classic 3/4 pixel-art view)
    const eyeY = headY + headSize * 0.45;
    const eyeSize = headSize * 0.18;
    const eyeShift = facing === 'right' ? headSize * 0.16 : -headSize * 0.16;
    ctx.fillStyle = c.eye;
    ctx.beginPath(); ctx.arc(cx + eyeShift, eyeY, eyeSize, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.eyeHighlight;
    ctx.beginPath(); ctx.arc(cx + eyeShift - eyeSize * 0.3, eyeY - eyeSize * 0.3, eyeSize * 0.4, 0, Math.PI * 2); ctx.fill();
  } else {
    // Back of the head — a hair patch, no face
    ctx.fillStyle = c.hair;
    ctx.beginPath();
    ctx.arc(headX + headSize / 2, headY + headSize * 0.4, headSize * 0.46, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();
  }

  // Legs
  const legW = s * 0.1;
  const legH = s * 0.3;
  const legY = bodyY + bodyH - 2;

  if (isMoving) {
    const swing = Math.sin(walkCycle * Math.PI * 2) * s * 0.12;
    const swing2 = Math.sin((walkCycle + 0.5) * Math.PI * 2) * s * 0.12;
    ctx.fillStyle = c.dark;
    roundRect(ctx, cx - s * 0.15 + swing, legY, legW, legH, 2); ctx.fill();
    roundRect(ctx, cx + s * 0.05 + swing2, legY, legW, legH, 2); ctx.fill();
  } else {
    ctx.fillStyle = c.dark;
    roundRect(ctx, cx - s * 0.15, legY, legW, legH, 2); ctx.fill();
    roundRect(ctx, cx + s * 0.05, legY, legW, legH, 2); ctx.fill();
  }

  // Backpack/cape — worn on the back, so it shows on the far side when
  // facing the camera and swings toward-camera-visible when facing away
  ctx.fillStyle = c.shadow;
  const capeW = s * 0.15;
  const capeH = s * 0.25;
  const capeX = facing === 'right' ? bodyX - capeW + 2 : bodyX + bodyW - 2;
  roundRect(ctx, capeX, bodyY + s * 0.1, capeW, capeH, 2);
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
