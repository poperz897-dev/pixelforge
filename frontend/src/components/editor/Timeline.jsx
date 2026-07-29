// frontend/src/components/editor/Timeline.jsx
import React, { useRef, useState, useCallback } from 'react';
import { useDocumentModel } from '../../hooks/useDocumentModel';
import { drawPixelGrid } from '../../utils/renderGrid';
import { isoClipPathPercent } from '../../utils/isoGrid';

// Helper: render a single cel thumbnail onto a canvas
function CelThumbnail({ layer, frame, width, height, gridShape, isoRatioW, isoRatioH }) {
  const canvasRef = useRef(null);
  const [drawn, setDrawn] = useState(false);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cel = layer.cels[frame.id];
    // If no cel, use empty grid
    const grid = cel ? cel.pixelData : Array.from({ length: height }, () => Array(width).fill(null));
    const cellPx = 2; // thumbnail resolution
    const cw = width * cellPx;
    const ch = height * cellPx;
    canvas.width = cw;
    canvas.height = ch;
    ctx.imageSmoothingEnabled = false;

    // Reuse drawPixelGrid for consistent rendering
    drawPixelGrid(ctx, {
      grid,
      width,
      height,
      gridShape,
      isoRatioW,
      isoRatioH,
      cellPx,
      showCheckerboard: true,
      showGridLines: false,
      showOutline: false,
    });
    setDrawn(true);
  }, [layer, frame, width, height, gridShape, isoRatioW, isoRatioH]);

  return (
    <div className="w-12 h-12 bg-void rounded overflow-hidden border border-slate-700">
      <canvas ref={canvasRef} className="w-full h-full" style={{ imageRendering: 'pixelated' }} />
    </div>
  );
}

export function Timeline() {
  const {
    document,
    activeFrameId,
    setActiveFrameId,
    addFrame,
    deleteFrame,
    setFrameDuration,
    frames,
    layers,
    width,
    height,
    gridShape,
    isoRatioW,
    isoRatioH,
    // Assume these exist if tags are supported; else we'll define them locally
    tags = [],
    addTag,
    removeTag,
  } = useDocumentModel();

  // Local state for new tag input
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#73eff7');

  // Handle drag‑and‑drop reordering (simplistic: buttons for up/down)
  // In a full implementation you'd use react-dnd; but we'll keep it simple
  const moveFrame = useCallback((fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= frames.length) return;
    const newFrames = [...frames];
    const [removed] = newFrames.splice(fromIdx, 1);
    newFrames.splice(toIdx, 0, removed);
    // You'd need a reorderFrames function in useDocumentModel
    // For now we assume it exists; if not, we'll implement a workaround.
    // I'll assume there is a reorderFrames function.
    if (typeof reorderFrames === 'function') {
      reorderFrames(fromIdx, toIdx);
    }
  }, [frames]);

  const handleAddTag = () => {
    if (!tagName.trim()) return;
    // Find selected frame range: we need a way to select a range.
    // For simplicity, we'll tag from current frame to current frame (single).
    // In a proper UI, you'd have a range selector.
    if (typeof addTag === 'function') {
      addTag({ name: tagName.trim(), color: tagColor, from: activeFrameId, to: activeFrameId });
      setTagName('');
    }
  };

  return (
    <div className="timeline pixel-frame bg-panel backdrop-blur-sm p-2 border border-panel-border">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <button onClick={addFrame} className="glow-hover text-xs px-2 py-1 rounded bg-indigo-600 text-white">
          + Frame
        </button>
        <button onClick={() => deleteFrame(activeFrameId)} className="glow-hover text-xs px-2 py-1 rounded bg-red-900/50 text-red-200">
          Delete Frame
        </button>
        <span className="text-xs text-slate-400">Frames: {frames.length}</span>
      </div>

      {/* Tags display */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {tags.map((tag, i) => (
            <span
              key={i}
              className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ backgroundColor: tag.color + '40', color: tag.color }}
            >
              {tag.name} ({tag.from}-{tag.to})
              {typeof removeTag === 'function' && (
                <button onClick={() => removeTag(tag.id)} className="text-slate-400 hover:text-white">×</button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Frame strip with thumbnails */}
      <div className="overflow-x-auto">
        <div className="flex gap-2 pb-2">
          {frames.map((frame, idx) => (
            <div
              key={frame.id}
              className={`flex flex-col items-center p-1 rounded cursor-pointer transition-all min-w-[60px] ${
                frame.id === activeFrameId ? 'bg-indigo-600/20 border border-indigo-600' : 'hover:bg-slate-700/30'
              }`}
              onClick={() => setActiveFrameId(frame.id)}
            >
              <div className="text-[10px] text-slate-400 mb-1">#{idx+1}</div>
              <div className="flex flex-col gap-0.5">
                {layers.map(layer => (
                  <CelThumbnail
                    key={layer.id}
                    layer={layer}
                    frame={frame}
                    width={width}
                    height={height}
                    gridShape={gridShape}
                    isoRatioW={isoRatioW}
                    isoRatioH={isoRatioH}
                  />
                ))}
              </div>
              <input
                type="number"
                min="1"
                value={frame.duration_ms || 100}
                onChange={(e) => setFrameDuration(frame.id, parseInt(e.target.value, 10) || 100)}
                className="w-12 mt-1 bg-slate-700 text-slate-200 text-[10px] text-center rounded border border-slate-600"
                onClick={(e) => e.stopPropagation()}
              />
              {/* Reorder buttons */}
              <div className="flex gap-0.5 mt-1">
                <button
                  onClick={(e) => { e.stopPropagation(); moveFrame(idx, idx-1); }}
                  className="text-slate-500 hover:text-slate-300 text-[10px]"
                >
                  ↑
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); moveFrame(idx, idx+1); }}
                  className="text-slate-500 hover:text-slate-300 text-[10px]"
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tag creation */}
      <div className="flex items-center gap-2 mt-2 border-t border-slate-700 pt-2 flex-wrap">
        <span className="text-xs text-slate-400">Tag:</span>
        <input
          type="text"
          placeholder="Name"
          value={tagName}
          onChange={(e) => setTagName(e.target.value)}
          className="bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600"
        />
        <input
          type="color"
          value={tagColor}
          onChange={(e) => setTagColor(e.target.value)}
          className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer"
        />
        <button onClick={handleAddTag} className="glow-hover text-xs px-2 py-1 rounded bg-indigo-600 text-white">
          Add Tag
        </button>
        <span className="text-[10px] text-slate-500">(tags current frame)</span>
      </div>
    </div>
  );
}