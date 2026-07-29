import { BRUSH_SIZE_PRESETS, MIN_BRUSH_SIZE, MAX_BRUSH_SIZE } from '../../utils/brush.js';

const TOOLS = [
  { id: 'pencil', label: 'Pencil', icon: '✏️', shortcut: 'B' },
  { id: 'eraser', label: 'Eraser', icon: '🧽', shortcut: 'E' },
  { id: 'fill', label: 'Fill', icon: '🪣', shortcut: 'F' },
  { id: 'eyedrop', label: 'Pick', icon: '💧', shortcut: 'I' },
  { id: 'line', label: 'Line', icon: '📏', shortcut: 'L' },
  { id: 'rect', label: 'Rect', icon: '▭', shortcut: 'R' },
  { id: 'ellipse', label: 'Ellipse', icon: '⬭', shortcut: 'O' },
  { id: 'colorReplace', label: 'Replace', icon: '🔁', shortcut: 'G' },
];

const BRUSH_TOOLS = new Set(['pencil', 'eraser']);
const SHAPE_TOOLS = new Set(['line', 'rect', 'ellipse']);

export default function Toolbar({
  tool, onToolChange, onUndo, onRedo, canUndo, canRedo, onClear, onExport, showGrid, onToggleGrid, onHelp,
  brushSize, onBrushSizeChange, brushShape, onBrushShapeChange,
  pixelPerfect, onTogglePixelPerfect,
  shapeFilled, onToggleShapeFilled,
  symmetry, onToggleSymmetry,
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Tools</h3>
          <button
            onClick={onHelp}
            title="Quick start guide"
            aria-label="Open quick start guide"
            className="glow-hover w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-mono text-slate-400 border border-slate-600 hover:text-starcyan hover:border-starcyan transition-colors"
          >
            ?
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => onToolChange(t.id)}
              title={t.id === 'colorReplace' ? 'Replace every pixel of one color on this layer with another' : undefined}
              className={`glow-hover flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 group ${
                tool === t.id ? 'bg-indigo-600 text-white' : 'bg-slate-700/60 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <span className="text-base group-hover:scale-110 transition-transform">{t.icon}</span>
              <span className="flex-1">{t.label}</span>
              <kbd>{t.shortcut}</kbd>
            </button>
          ))}
        </div>
      </div>

      {BRUSH_TOOLS.has(tool) && (
        <div className="space-y-2.5">
          <h3 className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Brush</h3>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {BRUSH_SIZE_PRESETS.map((size) => (
                <button
                  key={size}
                  onClick={() => onBrushSizeChange(size)}
                  className={`glow-hover w-7 h-7 rounded text-xs font-mono flex items-center justify-center transition-colors ${
                    brushSize === size ? 'bg-indigo-600 text-white' : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={MIN_BRUSH_SIZE}
              max={MAX_BRUSH_SIZE}
              value={brushSize}
              onChange={(e) => {
                const v = Math.round(Number(e.target.value));
                if (Number.isFinite(v)) onBrushSizeChange(Math.max(MIN_BRUSH_SIZE, Math.min(MAX_BRUSH_SIZE, v)));
              }}
              className="w-12 bg-slate-700 text-slate-100 text-xs text-center rounded px-1 py-1.5 border border-slate-600"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onBrushShapeChange('square')}
              className={`glow-hover flex-1 text-xs px-2 py-1.5 rounded-lg transition-colors ${
                brushShape === 'square' ? 'bg-indigo-600 text-white' : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
              }`}
            >
              ▪ Square
            </button>
            <button
              onClick={() => onBrushShapeChange('circle')}
              className={`glow-hover flex-1 text-xs px-2 py-1.5 rounded-lg transition-colors ${
                brushShape === 'circle' ? 'bg-indigo-600 text-white' : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
              }`}
            >
              ● Circle
            </button>
          </div>
          {tool === 'pencil' && (
            <button
              onClick={onTogglePixelPerfect}
              disabled={brushSize !== 1}
              title={brushSize !== 1 ? 'Pixel-perfect only applies at brush size 1' : 'Clean up stair-step diagonals in freehand strokes'}
              className={`glow-hover w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-30 ${
                pixelPerfect ? 'bg-indigo-600 text-white' : 'bg-slate-700/60 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <span>Pixel-perfect line</span>
              <span className="opacity-70">{pixelPerfect ? 'On' : 'Off'}</span>
            </button>
          )}
        </div>
      )}

      {(tool === 'rect' || tool === 'ellipse') && (
        <div className="space-y-2.5">
          <h3 className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Shape</h3>
          <button
            onClick={onToggleShapeFilled}
            className={`glow-hover w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              shapeFilled ? 'bg-indigo-600 text-white' : 'bg-slate-700/60 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <span>{shapeFilled ? 'Filled' : 'Outline'}</span>
            <span className="opacity-70">Shift: square/circle · Alt: from center</span>
          </button>
        </div>
      )}
      {tool === 'line' && (
        <div className="text-[10px] text-slate-500 leading-snug -mt-2">Hold Shift to snap the angle to 15° steps.</div>
      )}

      <div>
        <h3 className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2.5">View</h3>
        <button
          onClick={onToggleGrid}
          className={`glow-hover w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
            showGrid ? 'bg-indigo-600 text-white' : 'bg-slate-700/60 text-slate-200 hover:bg-slate-700'
          }`}
        >
          <span className="text-base">▦</span>
          <span className="flex-1 text-left">Grid Lines</span>
          <span className="text-[10px] opacity-70">{showGrid ? 'On' : 'Off'}</span>
        </button>
      </div>

      <div className="space-y-2.5">
        <h3 className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Symmetry</h3>
        <div className="flex gap-2">
          <button
            onClick={() => onToggleSymmetry('horizontal')}
            title="Mirror strokes across a vertical axis at the canvas center"
            className={`glow-hover flex-1 text-xs px-2 py-1.5 rounded-lg transition-colors ${
              symmetry.horizontal ? 'bg-indigo-600 text-white' : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
            }`}
          >
            ↔ Horizontal
          </button>
          <button
            onClick={() => onToggleSymmetry('vertical')}
            title="Mirror strokes across a horizontal axis at the canvas center"
            className={`glow-hover flex-1 text-xs px-2 py-1.5 rounded-lg transition-colors ${
              symmetry.vertical ? 'bg-indigo-600 text-white' : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
            }`}
          >
            ↕ Vertical
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="flex-1 px-3 py-2 rounded-lg text-sm bg-slate-700/60 hover:bg-slate-700 text-slate-200 disabled:opacity-30 disabled:hover:bg-slate-700/60 transition-colors flex items-center justify-center gap-1"
        >
          <span>↶</span> Undo
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="flex-1 px-3 py-2 rounded-lg text-sm bg-slate-700/60 hover:bg-slate-700 text-slate-200 disabled:opacity-30 disabled:hover:bg-slate-700/60 transition-colors flex items-center justify-center gap-1"
        >
          <span>↷</span> Redo
        </button>
      </div>

      <button
        onClick={onClear}
        className="px-3 py-2 rounded-lg text-sm bg-red-900/30 hover:bg-red-900/50 text-red-200 border border-red-900/20 transition-colors flex items-center justify-center gap-2"
      >
        <span>🗑</span> Clear canvas
      </button>
      <button
        onClick={onExport}
        className="glow-hover px-3 py-2 rounded-lg text-sm bg-emerald-700 hover:bg-emerald-600 text-white transition-colors flex items-center justify-center gap-2"
      >
        <span>⬇</span> Export PNG
      </button>
    </div>
  );
}
