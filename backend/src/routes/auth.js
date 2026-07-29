import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/connection.js';
import { JWT_SECRET, COOKIE_NAME, requireAuth } from '../middleware/auth.js';

const router = Router();
const isProd = process.env.NODE_ENV === 'production';

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true, // not readable from JS -- the whole point of moving off localStorage
    sameSite: 'lax',
    secure: isProd, // requires https, so only turn on once actually deployed behind one
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, matches the JWT's own expiry below
  });
}

router.post('/register', (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
  if (existing) {
    return res.status(409).json({ error: 'Username or email already in use' });
  }

  const password_hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
    .run(username, email, password_hash);

  const token = jwt.sign({ id: info.lastInsertRowid, username }, JWT_SECRET, { expiresIn: '7d' });
  setAuthCookie(res, token);
  res.status(201).json({ user: { id: info.lastInsertRowid, username, email } });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  setAuthCookie(res, token);
  res.json({ user: { id: user.id, username: user.username, email: user.email } });
});

// GET /api/auth/me -- lets the frontend recover "am I logged in" on page
// load without ever touching the token itself (it can't -- it's httpOnly).
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, username, email FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ success: true });
});

export default router;
