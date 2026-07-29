import { Link } from 'react-router-dom';
import { IsometricTileGlyph, PlusIcon } from './icons.jsx';

// Used to be a permanent redirect to a "coming soon" stub while the
// isometric grid tool was being built in a separate pass -- that tool is
// merged in now (see the editor's grid-shape picker), so this links
// straight into it instead. `?shape=isometric` is read by Editor.jsx to
// preselect Isometric on load, so clicking through actually lands you
// somewhere ready to draw, not just the general editor.
export default function IsometricTileCTA({ to = '/editor?shape=isometric', compact = false }) {
  return (
    <Link
      to={to}
      className="glow-hover group relative flex flex-col items-center justify-center gap-3 pixel-frame pixel-frame-gold bg-gradient-to-b from-panel to-indigo-950/40 backdrop-blur-sm text-center overflow-hidden border border-gold/30 hover:border-gold/60 transition-colors"
      style={{ padding: compact ? '1.5rem 1rem' : '2.25rem 1.5rem' }}
    >
      <span className="absolute top-2.5 right-2.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-emerald-300 bg-void/60 rounded px-1.5 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
        Available now
      </span>

      <div className="relative flex items-center justify-center text-starviolet group-hover:text-starcyan transition-colors">
        <IsometricTileGlyph size={compact ? 64 : 92} />
        <PlusIcon size={compact ? 22 : 28} className="absolute text-gold drop-shadow-[0_0_6px_rgba(255,205,117,0.8)]" />
      </div>

      <div>
        <p className="font-display font-medium text-slate-100 text-sm">Create an isometric tile</p>
        <p className="text-xs text-slate-400 mt-1 max-w-[16rem] mx-auto">
          A grid built for isometric tiles specifically — no manual math, no overspill. Ready when you are.
        </p>
      </div>
    </Link>
  );
}
