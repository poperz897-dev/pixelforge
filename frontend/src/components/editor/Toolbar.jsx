import { useState } from 'react';

const TOOLS = [
  { id: 'pencil', label: 'Pencil', icon: '✏️', shortcut: 'B' },
  { id: 'eraser', label: 'Eraser', icon: '🧽', shortcut: 'E' },
  { id: 'fill', label: 'Fill', icon: '🪣', shortcut: 'F' },
  { id: 'eyedrop', label: 'Pick', icon: '💧', shortcut: 'I' },
  { id: 'line', label: 'Line', icon: '📏', shortcut: 'L' },
  { id: 'rect', label: 'Rect', icon: '▭', shortcut: 'R' },
  { id: 'ellipse', label: 'Ellipse', icon: '⬭', shortcut: 'O' },
  { id: 'colorReplace', label: 'Replace', icon: '🔁', shortcut: 'G' },
  { id: 'selectRect', label: 'Select Rect', icon: '▭', shortcut: 'S' },
  { id: 'selectEllipse', label: 'Select Ellipse', icon: '⬭', shortcut: 'Shift+S' },
  { id: 'lasso', label: 'Lasso', icon: '✏️', shortcut: 'L' },
  { id: 'polyLasso', label: 'Poly Lasso', icon: '✏️', shortcut: 'P' },
  { id: 'magicWand', label: 'Magic Wand', icon: '✨', shortcut: 'W' },
  { id: 'move', label: 'Move', icon: '✋', shortcut: 'V' },
  { id: 'gradient', label: 'Gradient', icon: '🌈', shortcut: 'G' },
  { id: 'spray', label: 'Spray', icon: '💨', shortcut: 'A' },
];

export default function Toolbar({
  tool,
  onToolChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClear,
  onExport,
  showGrid,
  onToggleGrid,
  onHelp,
  brushSize,
  onBrushSizeChange,
  brushShape,
  onBrushShapeChange,
  pixelPerfect,
  onTogglePixelPerfect,
  shapeFilled,
  onToggleShapeFilled,
  symmetry,
  onToggleSymmetry,
  selection,
  onTransform,
  width,
  height,
}) {
  const [showBrushOptions, setShowBrushOptions] = useState(false);

  return (
    <div className="space-y-4">
      {/* Tool Grid */}
      <div className="space-y-2">
        <h3 className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Tools</h3>
        <div className="grid grid-cols-2 gap-1.5">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => onToolChange(t.id)}
              title={`${t.label} (${t.shortcut})`}
              className={`glow-hover text-xs px-2 py-1.5 rounded-lg transition-colors font-medium ${
                tool === t.id
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-slate-700/60 text-slate-200 hover:bg-slate-700'
              }`}
            >
              {t.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Undo/Redo */}
      <div className="flex gap-1.5">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo"
          className="glow-hover flex-1 text-sm px-2 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          ↶
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo"
          className="glow-hover flex-1 text-sm px-2 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          ↷
        </button>
      </div>

      {/* Clear */}
      <button
        onClick={onClear}
        className="glow-hover w-full text-xs px-2 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-900/60 text-red-300 transition-colors"
      >
        Clear
      </button>

      {/* Export */}
      <button
        onClick={onExport}
        className="glow-hover w-full text-xs px-2 py-1.5 rounded-lg bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-300 transition-colors"
      >
        Export PNG
      </button>

      {/* Grid Toggle */}
      <button
        onClick={onToggleGrid}
        className={`glow-hover w-full text-xs px-2 py-1.5 rounded-lg transition-colors ${
          showGrid
            ? 'bg-indigo-600/40 text-indigo-300 hover:bg-indigo-600/60'
            : 'bg-slate-700/60 text-slate-400 hover:bg-slate-700'
        }`}
      >
        {showGrid ? '⊞ Grid' : '○ Grid'}
      </button>

      {/* Brush Options */}
      {(tool === 'pencil' || tool === 'eraser' || tool === 'spray') && (
        <div className="space-y-2.5">
          <h3 className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Brush</h3>
          
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-slate-400">Size</label>
            <input
              type="range"
              min="1"
              max="16"
              value={brushSize}
              onChange={(e) => onBrushSizeChange(Number(e.target.value))}
              className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-[10px] text-slate-300 w-6 text-right">{brushSize}</span>
          </div>

          <div className="flex gap-1.5">
            <button
              onClick={() => onBrushShapeChange('square')}
              className={`glow-hover flex-1 text-xs px-2 py-1 rounded-lg transition-colors ${
                brushShape === 'square'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700/60 text-slate-200 hover:bg-slate-700'
              }`}
            >
              ▭ Square
            </button>
            <button
              onClick={() => onBrushShapeChange('circle')}
              className={`glow-hover flex-1 text-xs px-2 py-1 rounded-lg transition-colors ${
                brushShape === 'circle'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700/60 text-slate-200 hover:bg-slate-700'
              }`}
            >
              ● Circle
            </button>
          </div>

          {tool === 'pencil' && (
            <button
              onClick={onTogglePixelPerfect}
              className={`glow-hover w-full text-xs px-2 py-1.5 rounded-lg transition-colors ${
                pixelPerfect
                  ? 'bg-indigo-600/40 text-indigo-300 hover:bg-indigo-600/60'
                  : 'bg-slate-700/60 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {pixelPerfect ? '✓ Pixel Perfect' : '○ Pixel Perfect'}
            </button>
          )}
        </div>
      )}

      {/* Shape Options */}
      {(tool === 'line' || tool === 'rect' || tool === 'ellipse') && (
        <div className="space-y-2.5">
          <h3 className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Shape</h3>
          <button
            onClick={onToggleShapeFilled}
            className={`glow-hover w-full text-xs px-2 py-1.5 rounded-lg transition-colors ${
              shapeFilled
                ? 'bg-indigo-600/40 text-indigo-300 hover:bg-indigo-600/60'
                : 'bg-slate-700/60 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {shapeFilled ? '✓ Filled' : '○ Outline'}
          </button>
        </div>
      )}

      {/* Transform Options */}
      {tool === 'move' && selection?.hasSelection && (
        <div className="space-y-2.5">
          <h3 className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Transform</h3>
          <div className="flex gap-2">
            <button
              onClick={() => onTransform('flipH')}
              className="glow-hover flex-1 text-xs px-2 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-200"
            >
              ↔ Flip H
            </button>
            <button
              onClick={() => onTransform('flipV')}
              className="glow-hover flex-1 text-xs px-2 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-200"
            >
              ↕ Flip V
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onTransform('rotate', -90)}
              className="glow-hover flex-1 text-xs px-2 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-200"
            >
              ↺ Rot -90
            </button>
            <button
              onClick={() => onTransform('rotate', 90)}
              className="glow-hover flex-1 text-xs px-2 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-200"
            >
              ↻ Rot +90
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onTransform('scale', 0.5)}
              className="glow-hover flex-1 text-xs px-2 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-200"
            >
              ½×
            </button>
            <button
              onClick={() => onTransform('scale', 2)}
              className="glow-hover flex-1 text-xs px-2 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-200"
            >
              2×
            </button>
          </div>
        </div>
      )}

      {/* Symmetry */}
      <div className="space-y-2.5">
        <h3 className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Symmetry</h3>
        <div className="flex gap-2">
          <button
            onClick={() => onToggleSymmetry('horizontal')}
            className={`glow-hover flex-1 text-xs px-2 py-1.5 rounded-lg transition-colors ${
              symmetry.horizontal
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-700/60 text-slate-200 hover:bg-slate-700'
            }`}
          >
            ↔ H
          </button>
          <button
            onClick={() => onToggleSymmetry('vertical')}
            className={`glow-hover flex-1 text-xs px-2 py-1.5 rounded-lg transition-colors ${
              symmetry.vertical
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-700/60 text-slate-200 hover:bg-slate-700'
            }`}
          >
            ↕ V
          </button>
        </div>
      </div>

      {/* Help */}
      <button
        onClick={onHelp}
        className="glow-hover w-full text-xs px-2 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-200 transition-colors"
      >
        ?
      </button>
    </div>
  );
}