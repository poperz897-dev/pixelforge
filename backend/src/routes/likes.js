import { Router } from 'express';
import db from '../db/connection.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /api/likes/:artworkId -- toggles like on/off for the current user
router.post('/:artworkId', requireAuth, (req, res) => {
  const artwork = db.prepare('SELECT id, visibility, user_id FROM artworks WHERE id = ?').get(req.params.artworkId);
  if (!artwork) return res.status(404).json({ error: 'Artwork not found' });
  if (artwork.visibility === 'private' && artwork.user_id !== req.user.id) {
    return res.status(404).json({ error: 'Artwork not found' });
  }

  const existing = db
    .prepare('SELECT id FROM likes WHERE artwork_id = ? AND user_id = ?')
    .get(req.params.artworkId, req.user.id);

  if (existing) {
    db.prepare('DELETE FROM likes WHERE id = ?').run(existing.id);
  } else {
    db.prepare('INSERT INTO likes (artwork_id, user_id) VALUES (?, ?)').run(req.params.artworkId, req.user.id);
  }

  const like_count = db.prepare('SELECT COUNT(*) AS c FROM likes WHERE artwork_id = ?').get(req.params.artworkId).c;
  res.json({ liked: !existing, like_count });
});

export default router;
