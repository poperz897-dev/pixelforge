import { Router } from 'express';
import db from '../db/connection.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/palettes -- public palettes plus the current user's own
router.get('/', optionalAuth, (req, res) => {
  const rows = req.user
    ? db.prepare('SELECT * FROM palettes WHERE is_public = 1 OR user_id = ? ORDER BY created_at DESC').all(req.user.id)
    : db.prepare('SELECT * FROM palettes WHERE is_public = 1 ORDER BY created_at DESC').all();

  res.json(rows.map((p) => ({ ...p, colors: JSON.parse(p.colors) })));
});

// POST /api/palettes -- save a custom palette
router.post('/', requireAuth, (req, res) => {
  const { name, colors, is_public = false } = req.body;
  if (!name || !Array.isArray(colors) || colors.length === 0) {
    return res.status(400).json({ error: 'name and a non-empty colors array are required' });
  }

  const info = db
    .prepare('INSERT INTO palettes (user_id, name, colors, is_public) VALUES (?, ?, ?, ?)')
    .run(req.user.id, name, JSON.stringify(colors), is_public ? 1 : 0);

  res.status(201).json({ id: info.lastInsertRowid });
});

export default router;
