import { useRef, useEffect, useCallback, useState } from 'react';

const SIZE = 152;
const RADIUS = SIZE / 2;

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('');
}

function hexToHsv(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return { h: 0, s: 0, v: 1 };
  const r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export default function ColorWheel({ color, onChange }) {
  const wheelRef = useRef(null);
  const dragging = useRef(false);
  const [hsv, setHsv] = useState(() => hexToHsv(color));

  useEffect(() => { if (dragging.current) return; setHsv(hexToHsv(color)); }, [color]);

  useEffect(() => {
    const canvas = wheelRef.current;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(SIZE, SIZE);
    for (let py = 0; py < SIZE; py++) {
      for (let px = 0; px < SIZE; px++) {
        const dx = px - RADIUS, dy = py - RADIUS;
        const r = Math.sqrt(dx * dx + dy * dy);
        const i = (py * SIZE + px) * 4;
        if (r > RADIUS) { img.data[i + 3] = 0; continue; }
        let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (angle < 0) angle += 360;
        const [rr, gg, bb] = hsvToRgb(angle, Math.min(1, r / RADIUS), 1);
        img.data[i] = rr; img.data[i + 1] = gg; img.data[i + 2] = bb; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, []);

  const pickFromEvent = useCallback((e) => {
    const rect = wheelRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left - RADIUS;
    const py = e.clientY - rect.top - RADIUS;
    const r = Math.min(RADIUS, Math.sqrt(px * px + py * py));
    let angle = (Math.atan2(py, px) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    const s = r / RADIUS;
    setHsv((prev) => {
      const next = { h: angle, s, v: prev.v };
      const [rr, gg, bb] = hsvToRgb(next.h, next.s, next.v);
      onChange(rgbToHex(rr, gg, bb));
      return next;
    });
  }, [onChange]);

  const handlePointerDown = (e) => { dragging.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); pickFromEvent(e); };
  const handlePointerMove = (e) => { if (dragging.current) pickFromEvent(e); };
  const stopDrag = () => { dragging.current = false; };

  const handleValueChange = (e) => {
    const v = Number(e.target.value) / 100;
    setHsv((prev) => {
      const next = { ...prev, v };
      const [rr, gg, bb] = hsvToRgb(next.h, next.s, next.v);
      onChange(rgbToHex(rr, gg, bb));
      return next;
    });
  };

  const markerX = RADIUS + Math.cos((hsv.h * Math.PI) / 180) * hsv.s * RADIUS;
  const markerY = RADIUS + Math.sin((hsv.h * Math.PI) / 180) * hsv.s * RADIUS;

  return (
    <div className="space-y-2">
      <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
        <canvas ref={wheelRef} width={SIZE} height={SIZE} className="rounded-full cursor-crosshair touch-none"
          onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={stopDrag} onPointerLeave={stopDrag} />
        <div className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow pointer-events-none"
          style={{ left: markerX, top: markerY, backgroundColor: color, transform: 'translate(-50%, -50%)' }} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-slate-400 w-4">V</span>
        <input type="range" min="0" max="100" value={Math.round(hsv.v * 100)} onChange={handleValueChange} className="flex-1 accent-indigo-500" />
      </div>
    </div>
  );
}