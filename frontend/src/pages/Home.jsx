import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import ArtworkCard from '../components/gallery/ArtworkCard.jsx';
import IsometricTileCTA from '../components/ui/IsometricTileCTA.jsx';
import PixelLoader from '../components/ui/PixelLoader.jsx';
import { ChatIcon, GhostIcon, GlobeIcon, RocketIcon } from '../components/ui/icons.jsx';

// Positions + colors for the small squares that "materialize" around the
// hero ghost on load -- a light nod to the site's whole premise (pixels
// assembling into art) without needing a bespoke illustration.
const DUST = [
  { top: '6%', left: '4%', size: 10, color: '#ffcd75', delay: '0ms' },
  { top: '14%', left: '86%', size: 7, color: '#73eff7', delay: '80ms' },
  { top: '78%', left: '90%', size: 9, color: '#c4b5fd', delay: '160ms' },
  { top: '86%', left: '10%', size: 6, color: '#73eff7', delay: '260ms' },
  { top: '4%', left: '48%', size: 6, color: '#c4b5fd', delay: '340ms' },
  { top: '92%', left: '52%', size: 8, color: '#ffcd75', delay: '420ms' },
];

function Feature({ icon, title, children }) {
  return (
    <div className="pixel-frame bg-panel backdrop-blur-sm p-5">
      <div className="w-9 h-9 rounded flex items-center justify-center bg-indigo-600/20 text-starcyan">{icon}</div>
      <h3 className="font-display font-medium text-slate-100 text-sm mt-3">{title}</h3>
      <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">{children}</p>
    </div>
  );
}

export default function Home() {
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listArtworks({ sort: 'trending', limit: 8 })
      .then((data) => setTrending(data.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14">
      {/* ---------------------------------------------------------- Hero */}
      <section className="grid md:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-starcyan">Pixel art, made and shared</p>
          <h1 className="font-pixel text-lg sm:text-2xl text-slate-100 leading-relaxed mt-3">
            Forge every pixel on purpose.
          </h1>
          <p className="text-slate-400 mt-4 max-w-md leading-relaxed">
            Draw tiles, characters and items on a real grid editor — square or isometric — keep the drafts to
            yourself, and publish the rest to a gallery other people actually browse. No account needed to
            look around.
          </p>
          <div className="flex flex-wrap gap-3 mt-7">
            <Link
              to="/editor"
              className="glow-hover flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-5 py-2.5 rounded transition-colors"
            >
              <RocketIcon size={16} />
              Start creating
            </Link>
            <Link
              to="/gallery"
              className="glow-hover flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm px-5 py-2.5 rounded transition-colors"
            >
              <GlobeIcon size={16} />
              Browse the gallery
            </Link>
          </div>
        </div>

        <div className="relative flex items-center justify-center py-6">
          <div
            className="absolute w-48 h-48 rounded-full opacity-40 blur-2xl"
            style={{ background: 'radial-gradient(circle, rgba(196,181,253,0.5), transparent 70%)' }}
            aria-hidden="true"
          />
          {DUST.map((d, i) => (
            <span
              key={i}
              className="absolute rounded-sm animate-materialize"
              style={{
                top: d.top,
                left: d.left,
                width: d.size,
                height: d.size,
                background: d.color,
                animationDelay: d.delay,
                boxShadow: `0 0 8px 0 ${d.color}`,
              }}
              aria-hidden="true"
            />
          ))}
          <GhostIcon size={172} className="relative animate-float drop-shadow-[0_0_28px_rgba(196,181,253,0.45)]" />
        </div>
      </section>

      {/* ------------------------------------------------------ Features */}
      <section className="grid sm:grid-cols-3 gap-4 mt-16">
        <Feature icon={<RocketIcon size={18} />} title="Draw on a real grid">
          Pencil, eraser, fill, eyedropper, undo/redo, a real HSV color wheel, and grids from 8×8 up to
          128×128. Export a PNG whenever you want a copy outside the app.
        </Feature>
        <Feature icon={<GlobeIcon size={18} />} title="Public or private, your call">
          Every piece is private until you say otherwise. Publish to the gallery when it's ready, keep
          drafts and experiments to yourself for as long as you like.
        </Feature>
        <Feature icon={<ChatIcon size={18} />} title="Talk to other pixel artists">
          The forum is for critique, questions, and show-and-tell — a place to actually talk to whoever
          made the thing you just liked.
        </Feature>
      </section>

      {/* ------------------------------------------------------ Isometric */}
      <section className="mt-16">
        <div className="grid md:grid-cols-[minmax(0,1fr)_20rem] gap-4 items-stretch">
          <div className="pixel-frame bg-panel backdrop-blur-sm p-6 flex flex-col justify-center">
            <p className="font-mono text-xs uppercase tracking-widest text-starcyan">Now live</p>
            <h2 className="font-display text-lg font-semibold text-slate-100 mt-2">A grid built for isometric tiles</h2>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed max-w-xl">
              Instead of eyeballing where a diamond-shaped tile sits inside a square grid, every cell in this
              one is already isometric — draw right up to the edge and it simply can't overspill. Then take
              it straight to the Tile Tester: drop tiles onto a real tilemap and walk a hero around them to
              see how they actually read together.
            </p>
            <Link
              to="/tester"
              className="glow-hover inline-flex items-center gap-1.5 text-sm text-starcyan hover:text-starcyan/80 transition-colors mt-4 w-fit"
            >
              <span aria-hidden="true">🧪</span> Try the Tile Tester →
            </Link>
          </div>
          <IsometricTileCTA />
        </div>
      </section>

      {/* -------------------------------------------------------- Trending */}
      <section className="mt-16">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-semibold text-slate-100">Trending this week</h2>
          <Link to="/gallery" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
            See the full gallery →
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <PixelLoader label="Pulling up recent favorites…" />
          </div>
        ) : trending.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">
            Nothing trending yet — <Link to="/editor" className="text-indigo-400 hover:text-indigo-300">be the first to publish something.</Link>
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {trending.slice(0, 8).map((art) => (
              <ArtworkCard key={art.id} artwork={art} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
