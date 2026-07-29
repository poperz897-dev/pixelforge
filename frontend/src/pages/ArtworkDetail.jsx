import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import PixelLoader from '../components/ui/PixelLoader.jsx';
import PixelGridPreview from '../components/ui/PixelGridPreview.jsx';
import { ISO_RATIO_PRESETS } from '../utils/isoGrid.js';

function isoRatioLabel(w, h) {
  const preset = ISO_RATIO_PRESETS.find((p) => p.w != null && Math.abs(p.w / p.h - w / h) < 0.01);
  return preset ? preset.label.split(' — ')[0] : `${w.toFixed(2)}:${h.toFixed(2)}`;
}

export default function ArtworkDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [artwork, setArtwork] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getArtwork(id);
      setArtwork(data);
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleLike = async () => {
    setBusy(true);
    try {
      const { liked, like_count } = await api.toggleLike(id);
      setArtwork((a) => ({ ...a, liked_by_me: liked, like_count }));
    } catch (e) {
      setError(e.message === 'Not authenticated' ? 'Log in to like artwork.' : e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleVisibility = async () => {
    const next = artwork.visibility === 'public' ? 'private' : 'public';
    setBusy(true);
    try {
      await api.updateArtwork(id, { visibility: next });
      setArtwork((a) => ({ ...a, visibility: next }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this artwork? This cannot be undone.')) return;
    setBusy(true);
    try {
      await api.deleteArtwork(id);
      navigate('/gallery');
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-red-400">{error}</p>
        <Link to="/gallery" className="text-indigo-400 text-sm mt-2 inline-block hover:text-indigo-300 transition-colors">
          ← Back to gallery
        </Link>
      </div>
    );
  }

  if (!artwork) {
    return (
      <div className="flex justify-center py-24">
        <PixelLoader label="Loading artwork…" />
      </div>
    );
  }

  const scale = Math.min(16, Math.floor(480 / Math.max(artwork.width, artwork.height)));
  const isIso = artwork.grid_shape === 'isometric';

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link to="/gallery" className="text-indigo-400 text-sm hover:text-indigo-300 transition-colors">
        ← Back to gallery
      </Link>

      <div className="pixel-frame mt-4 bg-panel backdrop-blur-sm p-6">
        <div className="flex justify-center mb-4">
          <PixelGridPreview
            pixels={artwork.pixel_data.flat()}
            width={artwork.width}
            height={artwork.height}
            gridShape={artwork.grid_shape}
            isoRatioW={artwork.iso_ratio_w}
            isoRatioH={artwork.iso_ratio_h}
            cellPx={scale}
            className="bg-void rounded border border-panel-border shadow-glow"
          />
        </div>

        <h1 className="font-display text-xl font-semibold text-slate-100">{artwork.title}</h1>
        <p className="text-sm text-slate-400 mt-1">
          by {artwork.author} · {artwork.category} · {artwork.width}×{artwork.height}
          {isIso && <> · isometric {isoRatioLabel(artwork.iso_ratio_w, artwork.iso_ratio_h)}</>}
        </p>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={toggleLike}
            disabled={busy}
            className={`glow-hover text-sm px-3 py-1.5 rounded transition-colors ${
              artwork.liked_by_me ? 'bg-pink-600 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
            }`}
          >
            {artwork.liked_by_me ? '❤ Liked' : '♡ Like'} · {artwork.like_count}
          </button>

          {artwork.is_owner && (
            <>
              <Link
                to={`/editor/${artwork.id}`}
                className="glow-hover text-sm px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
              >
                ✏️ Edit
              </Link>
              <button
                onClick={toggleVisibility}
                disabled={busy}
                className="glow-hover text-sm px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
              >
                {artwork.visibility === 'public' ? '🌐 Public — click to make private' : '🔒 Private — click to make public'}
              </button>
              <button
                onClick={handleDelete}
                disabled={busy}
                className="text-sm px-3 py-1.5 rounded bg-red-900/50 hover:bg-red-900 text-red-200 ml-auto transition-colors"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
