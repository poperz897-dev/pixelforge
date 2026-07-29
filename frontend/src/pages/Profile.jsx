import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ArtworkCard from '../components/gallery/ArtworkCard.jsx';
import PixelLoader from '../components/ui/PixelLoader.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { RocketIcon } from '../components/ui/icons.jsx';
import { api } from '../api/client.js';

export default function Profile() {
  const [artworks, setArtworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .listArtworks({ mine: 'true', limit: 60 })
      .then((data) => setArtworks(data.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="font-pixel text-base sm:text-lg text-slate-100 mb-6">My artwork</h1>

      {loading && (
        <div className="flex justify-center py-20">
          <PixelLoader label="Fetching your pieces…" />
        </div>
      )}
      {error && <p className="text-red-400">{error}</p>}
      {!loading && !error && artworks.length === 0 && (
        <EmptyState
          title="You haven't made anything yet"
          message="Everything you draw — public or private — will show up here."
          action={
            <Link
              to="/editor"
              className="glow-hover inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded transition-colors"
            >
              <RocketIcon size={16} />
              Head to the editor
            </Link>
          }
        />
      )}

      {!loading && artworks.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {artworks.map((art) => (
            <div key={art.id} className="relative">
              <ArtworkCard artwork={art} />
              {art.visibility === 'private' && (
                <span className="absolute top-2 right-2 text-xs bg-void/80 text-slate-300 px-1.5 py-0.5 rounded z-10">
                  🔒
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
