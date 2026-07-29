import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import PixelLoader from '../components/ui/PixelLoader.jsx';
import { TrashIcon, UserIcon } from '../components/ui/icons.jsx';

const CATEGORY_STYLE = {
  general: 'bg-slate-700 text-slate-300',
  critique: 'bg-starviolet/20 text-starviolet',
  help: 'bg-starcyan/20 text-starcyan',
  showcase: 'bg-gold/20 text-gold',
};

function toDate(sqliteTimestamp) {
  return new Date(sqliteTimestamp.replace(' ', 'T') + 'Z');
}

function Post({ author, body, created_at, isOwner, onDelete, accent = false }) {
  return (
    <div className={`pixel-frame-sm bg-panel backdrop-blur-sm p-4 ${accent ? 'shadow-glow' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          <UserIcon size={12} />
          <span className="text-slate-200 font-medium">{author}</span>
          <span>· {toDate(created_at).toLocaleString()}</span>
        </p>
        {isOwner && onDelete && (
          <button onClick={onDelete} className="text-slate-500 hover:text-red-400 transition-colors shrink-0" aria-label="Delete">
            <TrashIcon size={14} />
          </button>
        )}
      </div>
      <p className="text-sm text-slate-200 mt-2.5 whitespace-pre-wrap leading-relaxed">{body}</p>
    </div>
  );
}

export default function ForumThread() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [thread, setThread] = useState(null);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyError, setReplyError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.getThread(id);
      setThread(data);
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const submitReply = async () => {
    if (!reply.trim()) return;
    setPosting(true);
    setReplyError('');
    try {
      const newReply = await api.replyToThread(id, reply.trim());
      setThread((t) => ({ ...t, replies: [...t.replies, newReply] }));
      setReply('');
    } catch (e) {
      setReplyError(e.message === 'Not authenticated' ? 'Log in to reply.' : e.message);
    } finally {
      setPosting(false);
    }
  };

  const deleteThread = async () => {
    if (!confirm('Delete this thread and all its replies? This cannot be undone.')) return;
    try {
      await api.deleteThread(id);
      navigate('/forum');
    } catch (e) {
      setError(e.message);
    }
  };

  const deleteReply = async (replyId) => {
    if (!confirm('Delete this reply?')) return;
    try {
      await api.deleteReply(replyId);
      setThread((t) => ({ ...t, replies: t.replies.filter((r) => r.id !== replyId) }));
    } catch (e) {
      setError(e.message);
    }
  };

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-red-400">{error}</p>
        <Link to="/forum" className="text-indigo-400 text-sm mt-2 inline-block hover:text-indigo-300 transition-colors">
          ← Back to forum
        </Link>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="flex justify-center py-24">
        <PixelLoader label="Loading thread…" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link to="/forum" className="text-indigo-400 text-sm hover:text-indigo-300 transition-colors">
        ← Back to forum
      </Link>

      <div className="flex items-center gap-2 mt-4 mb-1">
        <span className={`font-mono text-[10px] uppercase tracking-wide px-1.5 py-1 rounded ${CATEGORY_STYLE[thread.category]}`}>
          {thread.category}
        </span>
      </div>
      <h1 className="font-display text-xl font-semibold text-slate-100">{thread.title}</h1>

      <div className="mt-4">
        <Post author={thread.author} body={thread.body} created_at={thread.created_at} isOwner={thread.is_owner} onDelete={deleteThread} accent />
      </div>

      <div className="pixel-divider my-6" />

      <h2 className="text-xs uppercase tracking-wide text-slate-400 mb-3">
        {thread.replies.length} {thread.replies.length === 1 ? 'reply' : 'replies'}
      </h2>

      <div className="space-y-3">
        {thread.replies.map((r) => (
          <Post key={r.id} author={r.author} body={r.body} created_at={r.created_at} isOwner={r.is_owner} onDelete={() => deleteReply(r.id)} />
        ))}
      </div>

      <div className="pixel-frame bg-panel backdrop-blur-sm p-4 mt-6 space-y-3">
        <h3 className="text-xs uppercase tracking-wide text-slate-400">Add a reply</h3>
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Share your thoughts…"
          rows={3}
          maxLength={4000}
          className="w-full bg-slate-700 text-slate-100 text-sm rounded px-2 py-1.5 placeholder:text-slate-500 resize-none"
        />
        {replyError && <p className="text-xs text-red-400">{replyError}</p>}
        <button
          onClick={submitReply}
          disabled={posting || !reply.trim()}
          className="glow-hover bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded px-4 py-2 disabled:opacity-50"
        >
          {posting ? 'Posting…' : 'Post reply'}
        </button>
      </div>
    </div>
  );
}
