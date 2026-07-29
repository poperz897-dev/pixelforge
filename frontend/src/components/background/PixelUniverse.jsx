import { useEffect, useRef } from 'react';

/**
 * Ambient, site-wide animated backdrop: a slow-drifting pixel-art starfield
 * with nebula haze, a small moon, and the occasional shooting star.
 *
 * Rendered at a deliberately low internal resolution (one canvas pixel per
 * PIXEL_SIZE screen pixels) and scaled up with nearest-neighbor sampling
 * (see the global `canvas { image-rendering: pixelated }` rule in
 * index.css), so drifting stars read as chunky pixel-art rather than smooth
 * vector motion. Purely decorative: pointer-events are disabled and it's
 * marked aria-hidden, and it renders a single static frame instead of
 * animating when the user has requested reduced motion.
 */

const PIXEL_SIZE = 3; // screen px per "big pixel"

const SKY_TOP = '#05060f';
const SKY_BOTTOM = '#0d1130';
const STAR_COLORS_FAR = ['#f4f4f4', '#c7d2f0', '#94b0c2'];
const STAR_COLORS_NEAR = ['#a5b4fc', '#73eff7', '#c4b5fd', '#f4f4f4'];
const NEBULA_COLORS = ['#312e81', '#1e1b4b', '#4338ca'];
const MOON_SHADES = { body: '#8b93b8', rim: '#6b7299', shadow: '#4a4f75', crater: '#5d6390' };
const MOON_DIAMETER = 22; // in buffer px

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const rand = (min, max) => Math.random() * (max - min) + min;
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

// Procedurally draws a small circular moon (with a few craters and a soft
// shadowed edge) onto its own offscreen canvas once, so the animation loop
// can cheaply blit it every frame instead of redrawing ~300 cells at 60fps.
function buildMoonCanvas() {
  const d = MOON_DIAMETER;
  const c = document.createElement('canvas');
  c.width = d;
  c.height = d;
  const ctx = c.getContext('2d');
  const radius = d / 2;
  const center = radius - 0.5;
  const craters = [
    { x: 0.32, y: 0.28, r: 0.13 },
    { x: 0.63, y: 0.4, r: 0.1 },
    { x: 0.42, y: 0.68, r: 0.11 },
  ];
  for (let y = 0; y < d; y++) {
    for (let x = 0; x < d; x++) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.hypot(dx, dy);
      if (dist > radius) continue;
      let shade = 'body';
      if (dx - dy > radius * 0.5 && dist > radius * 0.4) shade = 'shadow';
      if (dist > radius - 1.1) shade = shade === 'shadow' ? 'shadow' : 'rim';
      for (const cr of craters) {
        if (Math.hypot(x - cr.x * d, y - cr.y * d) < cr.r * d) shade = 'crater';
      }
      ctx.fillStyle = MOON_SHADES[shade];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

// One depth layer of stars: `driftX`/`driftY` set the layer's overall
// parallax speed (buffer px/sec), with a little per-star jitter added so it
// doesn't look mechanical.
function makeStarLayer(count, bufferW, bufferH, { colors, sizes, driftX, driftY }) {
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand(0, bufferW),
      y: rand(0, bufferH),
      size: pick(sizes),
      color: pick(colors),
      baseAlpha: rand(0.35, 0.9),
      amp: rand(0.15, 0.4),
      speed: rand(0.7, 2.2),
      phase: rand(0, Math.PI * 2),
      vx: driftX + rand(-0.4, 0.4),
      vy: driftY + rand(-0.15, 0.15),
    });
  }
  return stars;
}

// A soft, low-alpha scatter of pixels inside an ellipse -- baked onto its
// own offscreen canvas once, then drifted across the sky and respawned on
// the opposite edge once it drifts fully offscreen.
function spawnNebulaBlob(bufferW, bufferH) {
  const w = Math.round(rand(40, 90));
  const h = Math.round(rand(20, 45));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const color = pick(NEBULA_COLORS);
  const cx = w / 2;
  const cy = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x - cx) / cx, (y - cy) / cy);
      if (d > 1) continue;
      const a = (1 - d) * rand(0.02, 0.09);
      if (a < 0.015) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const fromLeft = Math.random() < 0.5;
  return {
    canvas: c,
    x: fromLeft ? -w : bufferW,
    y: rand(0, Math.max(1, bufferH - h)),
    vx: (fromLeft ? 1 : -1) * rand(2.2, 4.6),
    w,
    h,
  };
}

export default function PixelUniverse() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // alpha: false -- this layer always paints a fully opaque sky, so telling
    // the browser not to bother with alpha compositing avoids a class of
    // "canvas looks washed out / shows the page behind it" bugs for free.
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return; // extremely rare (e.g. context limit hit) -- CSS gradient fallback in index.css still covers this

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let bufferW = 0;
    let bufferH = 0;
    let farStars = [];
    let midStars = [];
    let nearStars = [];
    let nebulaBlobs = [];
    let moonX = 0;
    let moonBaseY = 0;
    const moonCanvas = buildMoonCanvas();
    const shootingStars = [];
    let nextShootAt = performance.now() + rand(2500, 6000);
    let rafId = null;
    let lastTime = performance.now();
    let resizeTimer = null;
    let skyGradient = null;

    function layout() {
      bufferW = Math.ceil(window.innerWidth / PIXEL_SIZE);
      bufferH = Math.ceil(window.innerHeight / PIXEL_SIZE);
      canvas.width = bufferW;
      canvas.height = bufferH;
      // Assigning canvas.width/height clears the 2D context AND resets its
      // state (imageSmoothingEnabled, fillStyle, etc.) back to defaults --
      // so this has to be re-applied here, not once outside layout(), or
      // every resize silently turns pixel-crisp rendering back into a blur.
      ctx.imageSmoothingEnabled = false;

      // Sky only depends on bufferH, which is stable between resizes, so
      // build the gradient once here instead of every single frame.
      skyGradient = ctx.createLinearGradient(0, 0, 0, bufferH);
      skyGradient.addColorStop(0, SKY_TOP);
      skyGradient.addColorStop(1, SKY_BOTTOM);

      const area = bufferW * bufferH;
      // Drift speeds are ~1.7x the original pass -- the old values (-1.2 /
      // -2.6 / -5.5 buffer px/sec) were technically smooth but read as
      // inert at a glance, which is what "laggy" meant here: nothing was
      // actually dropping frames, the motion itself was just too subtle to
      // register as motion. Parallax ratio between layers is unchanged.
      farStars = makeStarLayer(clamp(Math.round(area / 2200), 70, 240), bufferW, bufferH, {
        colors: STAR_COLORS_FAR,
        sizes: [1, 1, 1, 2],
        driftX: -2.1,
        driftY: 0.5,
      });
      midStars = makeStarLayer(clamp(Math.round(area / 5200), 26, 90), bufferW, bufferH, {
        colors: STAR_COLORS_FAR,
        sizes: [1, 1, 2],
        driftX: -4.4,
        driftY: 1.2,
      });
      nearStars = makeStarLayer(clamp(Math.round(area / 15000), 8, 30), bufferW, bufferH, {
        colors: STAR_COLORS_NEAR,
        sizes: [2, 2, 3],
        driftX: -9.3,
        driftY: 2.4,
      });
      nebulaBlobs = [spawnNebulaBlob(bufferW, bufferH), spawnNebulaBlob(bufferW, bufferH), spawnNebulaBlob(bufferW, bufferH)];

      const margin = Math.round(bufferW * 0.06);
      moonX = bufferW - MOON_DIAMETER - margin;
      moonBaseY = Math.round(bufferH * 0.1);
    }

    function wrapStar(s) {
      if (s.x < -2) s.x = bufferW + 2;
      if (s.x > bufferW + 2) s.x = -2;
      if (s.y < -2) s.y = bufferH + 2;
      if (s.y > bufferH + 2) s.y = -2;
    }

    function drawStars(list, dt, now) {
      for (const s of list) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        wrapStar(s);
        const rawAlpha = clamp(s.baseAlpha + Math.sin(now * 0.001 * s.speed + s.phase) * s.amp, 0.08, 1);
        // Snap to a handful of discrete steps rather than a smooth fade --
        // twinkling should read as pixel-art, not as vector animation.
        ctx.globalAlpha = Math.round(rawAlpha * 5) / 5;
        ctx.fillStyle = s.color;
        ctx.fillRect(Math.round(s.x), Math.round(s.y), s.size, s.size);
      }
      ctx.globalAlpha = 1;
    }

    function drawNebula(dt) {
      for (let i = nebulaBlobs.length - 1; i >= 0; i--) {
        const b = nebulaBlobs[i];
        b.x += b.vx * dt;
        ctx.drawImage(b.canvas, Math.round(b.x), Math.round(b.y));
        if (b.x < -b.w - 20 || b.x > bufferW + 20) {
          nebulaBlobs[i] = spawnNebulaBlob(bufferW, bufferH);
        }
      }
    }

    function drawMoon(now) {
      const bob = Math.sin(now * 0.0002) * 3;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(moonCanvas, moonX, Math.round(moonBaseY + bob));
      ctx.globalAlpha = 1;
    }

    function maybeSpawnShootingStar(now) {
      if (now < nextShootAt || shootingStars.length > 0) return;
      const fromLeft = Math.random() < 0.5;
      shootingStars.push({
        x: fromLeft ? -10 : bufferW + 10,
        y: rand(0, bufferH * 0.45),
        vx: (fromLeft ? 1 : -1) * rand(150, 230),
        vy: rand(60, 95),
        trail: [],
      });
      nextShootAt = now + rand(6000, 15000);
    }

    function drawShootingStars(dt) {
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i];
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.trail.unshift({ x: s.x, y: s.y });
        if (s.trail.length > 7) s.trail.pop();
        s.trail.forEach((p, idx) => {
          ctx.globalAlpha = clamp(1 - idx / s.trail.length, 0, 1) * 0.9;
          ctx.fillStyle = '#f4f4f4';
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
        });
        ctx.globalAlpha = 1;
        if (s.x < -20 || s.x > bufferW + 20 || s.y > bufferH + 20) shootingStars.splice(i, 1);
      }
    }

    function drawSky() {
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, bufferW, bufferH);
    }

    function renderFrame(now) {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      drawSky();
      drawNebula(dt);
      drawStars(farStars, dt, now);
      drawStars(midStars, dt, now);
      drawMoon(now);
      drawStars(nearStars, dt, now);
      maybeSpawnShootingStar(now);
      drawShootingStars(dt);
    }

    function loop(now) {
      renderFrame(now);
      rafId = requestAnimationFrame(loop);
    }

    layout();

    if (reduceMotion) {
      renderFrame(performance.now());
    } else {
      rafId = requestAnimationFrame(loop);
    }

    function handleResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        layout();
        if (reduceMotion) renderFrame(performance.now());
      }, 150);
    }
    window.addEventListener('resize', handleResize);

    function handleVisibility() {
      if (reduceMotion) return;
      if (document.hidden) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
      } else if (!rafId) {
        lastTime = performance.now();
        rafId = requestAnimationFrame(loop);
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
