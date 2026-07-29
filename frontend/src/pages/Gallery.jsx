import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import ArtworkCard from '../components/gallery/ArtworkCard.jsx';
import FilterBar from '../components/gallery/FilterBar.jsx';
import PixelLoader from '../components/ui/PixelLoader.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { RocketIcon } from '../components/ui/icons.jsx';

const PAGE_SIZE = 24;

export default function Gallery() {
  const [artworks, setArtworks] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ project_type: '', category: '', sort: 'newest' });

  // Filter/sort changes reset back to page 1 and replace the list.
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const data = await api.listArtworks({ ...params, page: 1, limit: PAGE_SIZE });
      setArtworks(data.items);
      setPage(1);
      setHasMore(data.hasMore);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const nextPage = page + 1;
      const data = await api.listArtworks({ ...params, page: nextPage, limit: PAGE_SIZE });
      setArtworks((prev) => [...prev, ...data.items]);
      setPage(nextPage);
      setHasMore(data.hasMore);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-pixel text-base sm:text-lg text-slate-100">Gallery</h1>
        <Link
          to="/editor"
          className="glow-hover flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded transition-colors"
        >
          <RocketIcon size={16} />
          New artwork
        </Link>
      </div>

      <FilterBar filters={filters} onChange={setFilters} />

      {loading && (
        <div className="flex justify-center py-20">
          <PixelLoader label="Loading the gallery…" />
        </div>
      )}
      {error && <p className="text-red-400 mt-6">{error}</p>}
      {!loading && !error && artworks.length === 0 && (
        <EmptyState
          title="Nothing here yet"
          message="No public artwork matches these filters — be the first to fill this space."
          action={
            <Link
              to="/editor"
              className="glow-hover inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded transition-colors"
            >
              <RocketIcon size={16} />
              Start creating
            </Link>
          }
        />
      )}

      {!loading && artworks.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
          {artworks.map((art) => (
            <ArtworkCard key={art.id} artwork={art} />
          ))}
        </div>
      )}

      {!loading && hasMore && (
        <div className="flex justify-center mt-8">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="glow-hover text-sm px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-50 transition-colors"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
