import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, NavLink, Navigate, useNavigate } from 'react-router-dom';
import PixelUniverse from './components/background/PixelUniverse.jsx';
import PixelLoader from './components/ui/PixelLoader.jsx';
import Footer from './components/layout/Footer.jsx';
import { GhostIcon } from './components/ui/icons.jsx';
import Home from './pages/Home.jsx';
import Editor from './pages/Editor.jsx';
import TileTester from './pages/TileTester.jsx';
import Gallery from './pages/Gallery.jsx';
import ArtworkDetail from './pages/ArtworkDetail.jsx';
import Forum from './pages/Forum.jsx';
import ForumThread from './pages/ForumThread.jsx';
import Profile from './pages/Profile.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import { api } from './api/client.js';

// isActive comes from react-router's NavLink and already accounts for
// nested routes (e.g. /forum/3 keeps the "Forum" link marked active).
const navLinkClass = ({ isActive }) =>
  `text-sm transition-colors shrink-0 ${isActive ? 'text-white font-medium' : 'text-slate-300 hover:text-white'}`;

function Nav({ loggedIn, authChecked, onLogout }) {
  const navigate = useNavigate();
  return (
    <nav className="scanlines border-b border-panel-border bg-void/70 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6 overflow-x-auto whitespace-nowrap">
        <Link
          to="/"
          className="flex items-center gap-1.5 font-display font-bold text-slate-100 tracking-tight glow-hover rounded px-1 -mx-1 shrink-0"
        >
          <GhostIcon size={18} />
          PixelForge
        </Link>
        <NavLink to="/" end className={navLinkClass}>
          Home
        </NavLink>
        <NavLink to="/gallery" className={navLinkClass}>
          Gallery
        </NavLink>
        <NavLink to="/editor" className={navLinkClass}>
          Create
        </NavLink>
        <NavLink to="/tester" className={navLinkClass}>
          Test
        </NavLink>
        <NavLink to="/forum" className={navLinkClass}>
          Forum
        </NavLink>
        {/* Wait for the auth check so this link doesn't flash in and back out. */}
        {authChecked && loggedIn && (
          <NavLink to="/profile" className={navLinkClass}>
            My art
          </NavLink>
        )}
        <div className="ml-auto flex items-center gap-3 shrink-0">
          {!authChecked ? null : loggedIn ? (
            <button
              onClick={() => {
                onLogout();
                navigate('/gallery');
              }}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Log out
            </button>
          ) : (
            <>
              <Link to="/login" className="text-sm text-slate-300 hover:text-white transition-colors">
                Log in
              </Link>
              <Link
                to="/register"
                className="glow-hover text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded transition-colors"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  // The auth token lives in an httpOnly cookie now, so JS can't read it
  // directly to know if we're logged in -- we ask the server instead.
  const [loggedIn, setLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    api
      .me()
      .then(() => setLoggedIn(true))
      .catch(() => setLoggedIn(false))
      .finally(() => setAuthChecked(true));
  }, []);

  const handleLogout = () => {
    api.logout().catch(() => {}); // clear server-side cookie; UI state below is what actually matters
    setLoggedIn(false);
  };

  return (
    <BrowserRouter>
      {/* Always mounted, first, unconditionally -- the background used to
          live inside the same tree as the auth check below and disappeared
          along with everything else while that request was in flight. It
          no longer depends on anything async. */}
      <PixelUniverse />

      {/* z-10 on real (non-negative) stacking is deliberate: it guarantees
          this sits above the background regardless of what any ancestor
          does in the future, instead of relying on the background holding
          a negative z-index correctly forever. flex-col + the routes div
          taking flex-1 is what pins the footer to the bottom even on
          short-content pages instead of it floating mid-page. */}
      <div className="relative z-10 min-h-screen flex flex-col">
        <Nav loggedIn={loggedIn} authChecked={authChecked} onLogout={handleLogout} />

        {!authChecked ? (
          <div className="flex justify-center py-24">
            <PixelLoader label="Warming up the studio…" />
          </div>
        ) : (
          <div className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/editor" element={<Editor />} />
              <Route path="/editor/:id" element={<Editor />} />
              <Route path="/tester" element={<TileTester />} />
              <Route path="/artwork/:id" element={<ArtworkDetail />} />
              <Route path="/forum" element={<Forum />} />
              <Route path="/forum/:id" element={<ForumThread />} />
              <Route path="/profile" element={loggedIn ? <Profile /> : <Navigate to="/login" replace />} />
              <Route path="/login" element={<Login onAuth={() => setLoggedIn(true)} />} />
              <Route path="/register" element={<Register onAuth={() => setLoggedIn(true)} />} />
            </Routes>
          </div>
        )}

        <Footer />
      </div>
    </BrowserRouter>
  );
}
