import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { GhostIcon } from '../components/ui/icons.jsx';

export default function Login({ onAuth }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.login(email, password);
      onAuth();
      navigate('/gallery');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <div className="pixel-frame bg-panel backdrop-blur-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <GhostIcon size={28} />
          <h1 className="font-pixel text-sm text-slate-100">Log in</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-700 text-slate-100 text-sm rounded px-3 py-2 placeholder:text-slate-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-700 text-slate-100 text-sm rounded px-3 py-2 placeholder:text-slate-500"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            disabled={busy}
            className="glow-hover w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded px-3 py-2 disabled:opacity-50 transition-colors"
          >
            {busy ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p className="text-sm text-slate-400 mt-4">
          No account?{' '}
          <Link to="/register" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
