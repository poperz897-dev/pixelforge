// frontend/src/components/editor/AnimationPreview.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useDocumentModel } from '../../hooks/useDocumentModel';
import { flattenDocument } from '../../utils/compositing';

export function AnimationPreview({ isOpen, onClose }) {
  const { document, width, height, layers, frames } = useDocumentModel();
  const [playing, setPlaying] = useState(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);

  // Playback loop
  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    let idx = 0;
    const play = () => {
      setCurrentFrameIndex(idx);
      idx = (idx + 1) % frames.length;
    };
    play(); // Show first frame immediately
    intervalRef.current = setInterval(play, frames[idx]?.duration_ms || 100);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [playing, frames]);

  // Render current frame onto canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const frame = frames[currentFrameIndex];
    if (!frame) return;

    // Flatten the document for this frame
    const flat = flattenDocument({
      layers,
      cels: document.cels,
      frameId: frame.id,
      width,
      height,
    });

    const scale = Math.min(4, Math.floor(400 / Math.max(width, height))); // auto-fit
    const cw = width * scale;
    const ch = height * scale;
    canvas.width = cw;
    canvas.height = ch;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cw, ch);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const color = flat[y]?.[x];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }
  }, [currentFrameIndex, frames, layers, document.cels, width, height]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="pixel-frame bg-panel p-6 max-w-2xl w-full border border-panel-border">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm text-slate-100 font-semibold">Animation Preview</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-xl">✕</button>
        </div>
        <div className="flex justify-center bg-void rounded p-2">
          <canvas ref={canvasRef} className="border border-slate-700 rounded" style={{ imageRendering: 'pixelated' }} />
        </div>
        <div className="flex justify-center items-center gap-4 mt-4">
          <button onClick={() => setPlaying(!playing)} className="glow-hover px-4 py-2 rounded bg-indigo-600 text-white text-sm">
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
          <button onClick={() => setCurrentFrameIndex(0)} className="text-sm text-slate-400 hover:text-slate-200">⏮ Rewind</button>
          <span className="text-xs text-slate-400">Frame {currentFrameIndex+1} / {frames.length}</span>
        </div>
      </div>
    </div>
  );
}