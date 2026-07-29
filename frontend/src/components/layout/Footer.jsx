import { Link } from 'react-router-dom';
import { GhostIcon } from '../ui/icons.jsx';

export default function Footer() {
  return (
    <footer className="border-t border-panel-border mt-20">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center gap-4 sm:gap-0 justify-between">
        <div className="flex items-center gap-2 text-slate-400">
          <GhostIcon size={16} />
          <span className="font-mono text-xs">PixelForge — draw, save and share pixel art in the browser.</span>
        </div>
        <nav className="flex flex-wrap justify-center items-center gap-x-5 gap-y-1.5 text-xs text-slate-400">
          <Link to="/gallery" className="hover:text-slate-200 transition-colors">
            Gallery
          </Link>
          <Link to="/forum" className="hover:text-slate-200 transition-colors">
            Forum
          </Link>
          <Link to="/editor" className="hover:text-slate-200 transition-colors">
            Create
          </Link>
          <Link to="/tester" className="hover:text-slate-200 transition-colors">
            Tile Tester
          </Link>
          <Link to="/editor?shape=isometric" className="hover:text-slate-200 transition-colors">
            Isometric tiles
          </Link>
        </nav>
      </div>
    </footer>
  );
}
