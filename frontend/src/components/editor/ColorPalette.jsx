import ColorWheel from './ColorWheel.jsx';

const DEFAULT_PALETTE = [
  '#000000', '#1a1c2c', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75',
  '#a7f070', '#38b764', '#257179', '#29366f', '#3b5dc9', '#41a6f6',
  '#73eff7', '#f4f4f4', '#94b0c2', '#566c86', '#333c57', '#ffffff',
  '#f4b41b', '#e83b3b', '#7a2e2e', '#4b692f', '#8f974a', '#8a6f30',
];

function Swatches({ colors, activeColor, onSelect, title }) {
  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">{title}</h3>
      <div className="grid grid-cols-6 gap-1.5">
        {colors.map((color, i) => (
          <button
            key={`${color}-${i}`}
            onClick={() => onSelect(color)}
            className={`glow-hover w-7 h-7 rounded-sm border transition-transform hover:scale-110 ${
              activeColor === color ? 'border-starcyan ring-1 ring-starcyan scale-110' : 'border-slate-600/70 hover:border-slate-400'
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </div>
  );
}

// Wheel is the primary picker now (adopted from pixelforge-complete as-is,
// see CHANGES.md there for its own history) -- everything below it is
// still there for quick reuse of colors you've already committed to.
export default function ColorPalette({ activeColor, onSelect, customColors, onAddCustom, recentColors = [] }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2.5">Color Wheel</h3>
        <ColorWheel color={activeColor} onChange={onSelect} />
        <button
          onClick={() => onAddCustom(activeColor)}
          className="glow-hover w-full mt-3 text-xs px-3 py-2 rounded bg-slate-700/60 hover:bg-slate-700 text-slate-200 transition-colors flex items-center justify-center gap-2"
        >
          <span>+</span> Save color
        </button>
      </div>

      {recentColors.length > 0 && <Swatches colors={recentColors} activeColor={activeColor} onSelect={onSelect} title="Recent" />}

      <Swatches colors={DEFAULT_PALETTE} activeColor={activeColor} onSelect={onSelect} title="Palette" />

      {customColors.length > 0 && (
        <Swatches colors={customColors} activeColor={activeColor} onSelect={onSelect} title="Your Colors" />
      )}

      <div className="pixel-frame-sm pt-1 flex items-center gap-3 p-2 bg-panel border border-panel-border">
        <div className="w-8 h-8 rounded-sm border border-starcyan/60 shadow-glow" style={{ backgroundColor: activeColor }} />
        <div className="flex-1">
          <span className="text-xs text-slate-400 font-mono tracking-wide">{activeColor}</span>
          <div className="flex gap-1 mt-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: activeColor, opacity: 0.3 }} />
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: activeColor, opacity: 0.6 }} />
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: activeColor, opacity: 1 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
