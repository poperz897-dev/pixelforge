import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import PixelLoader from '../components/ui/PixelLoader.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { ChatIcon, PlusIcon, UserIcon } from '../components/ui/icons.jsx';

const CATEGORIES = [
  { value: '', label: 'All topics' },
  { value: 'general', label: 'General' },
  { value: 'critique', label: 'Critique' },
  { value: 'help', label: 'Help' },
  { value: 'showcase', label: 'Showcase' },
];

const CATEGORY_STYLE = {
  general: 'bg-slate-700 text-slate-300',
  critique: 'bg-starviolet/20 text-starviolet',
  help: 'bg-starcyan/20 text-starcyan',
  showcase: 'bg-gold/20 text-gold',
};

// SQLite's CURRENT_TIMESTAMP is UTC but formatted as "YYYY-MM-DD HH:MM:SS"
// (space, no zone) -- swap in a T and Z so every engine parses it as UTC
// instead of some silently treating it as local time.
function toDate(sqliteTimestamp) {
  return new Date(sqliteTimestamp.replace(' ', 'T') + 'Z');
}

function timeAgo(iso) {
  const diffMs = Date.now() - toDate(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return toDate(iso).toLocaleDateString();
}

function NewThreadForm({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="glow-hover flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded transition-colors"
      >
        <PlusIcon size={16} />
        New thread
      </button>
    );
  }

  const submit = async () => {
    if (!title.trim() || !body.trim()) {
      setError('A title and a first post are both required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { id } = await api.createThread({ title: title.trim(), body: body.trim(), category });
      onCreated(id);
    } catch (e) {
      setError(e.message === 'Not authenticated' ? 'Log in to start a thread.' : e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pixel-frame bg-panel backdrop-blur-sm p-4 space-y-3 w-full sm:w-[26rem]">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-wide text-slate-400">New thread</h3>
        <button onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
          Cancel
        </button>
      </div>
      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={140}
        className="w-full bg-slate-700 text-slate-100 text-sm rounded px-2 py-1.5 placeholder:text-slate-500"
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="w-full bg-slate-700 text-slate-100 text-sm rounded px-2 py-1.5"
      >
        {CATEGORIES.filter((c) => c.value).map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <textarea
        placeholder="What's on your mind?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        maxLength={4000}
        className="w-full bg-slate-700 text-slate-100 text-sm rounded px-2 py-1.5 placeholder:text-slate-500 resize-none"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        onClick={submit}
        disabled={saving}
        className="glow-hover w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded px-2 py-2 disabled:opacity-50"
      >
        {saving ? 'Posting…' : 'Post thread'}
      </button>
    </div>
  );
}

export default function Forum() {
  const navigate = useNavigate();
  const [threads, setThreads] = useState([]);
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = category ? { category, page: 1 } : { page: 1 };
      const data = await api.listThreads(params);
      setThreads(data.items);
      setPage(1);
      setHasMore(data.hasMore);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const params = category ? { category, page: page + 1 } : { page: page + 1 };
      const data = await api.listThreads(params);
      setThreads((prev) => [...prev, ...data.items]);
      setPage((p) => p + 1);
      setHasMore(data.hasMore);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <ChatIcon size={22} className="text-starcyan" />
          <h1 className="font-pixel text-base sm:text-lg text-slate-100">Forum</h1>
        </div>
        <NewThreadForm onCreated={(id) => navigate(`/forum/${id}`)} />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-6">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={`glow-hover text-sm px-3 py-1.5 rounded transition-colors ${
              category === c.value ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <PixelLoader label="Loading threads…" />
        </div>
      )}
      {error && <p className="text-red-400 mt-6">{error}</p>}

      {!loading && !error && threads.length === 0 && (
        <EmptyState
          title="No threads here yet"
          message="Ask a question, share what you're working on, or just say hello."
        />
      )}

      {!loading && threads.length > 0 && (
        <ul className="space-y-2">
          {threads.map((t) => (
            <li key={t.id}>
              <Link
                to={`/forum/${t.id}`}
                className="glow-hover pixel-frame-sm flex items-center gap-3 bg-panel backdrop-blur-sm p-3.5 transition-transform hover:-translate-y-0.5"
              >
                <span className={`shrink-0 font-mono text-[10px] uppercase tracking-wide px-1.5 py-1 rounded ${CATEGORY_STYLE[t.category]}`}>
                  {t.category}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-100 truncate">{t.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                    <UserIcon size={11} />
                    {t.author} · {timeAgo(t.created_at)}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-slate-400 font-mono">
                  {t.reply_count} {t.reply_count === 1 ? 'reply' : 'replies'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
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
