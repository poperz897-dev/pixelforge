import { Router } from 'express';
import db from '../db/connection.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = Router();

const VALID_CATEGORIES = ['general', 'critique', 'help', 'showcase'];
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_TITLE = 140;
const MAX_BODY = 4000;

// GET /api/forum/threads
// Filters: ?category=critique   Sort: ?sort=newest | active (default: active)
// Paging:  ?page=1&limit=20
router.get('/threads', optionalAuth, (req, res) => {
  const { category, sort = 'active' } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;

  const where = [];
  const params = [];
  if (category && VALID_CATEGORIES.includes(category)) {
    where.push('t.category = ?');
    params.push(category);
  }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // "active" = most recently active (last reply, or thread creation if no
  // replies yet) first -- the usual default for a forum list. "newest" is
  // just thread creation time, for people who want to see what's new
  // regardless of reply activity.
  const orderBy = sort === 'newest' ? 't.created_at DESC' : 'COALESCE(last_reply_at, t.created_at) DESC';

  const total = db.prepare(`SELECT COUNT(*) AS c FROM forum_threads t ${whereClause}`).get(...params).c;

  const rows = db
    .prepare(
      `SELECT
         t.id, t.title, t.category, t.created_at, u.username AS author,
         (SELECT COUNT(*) FROM forum_replies r WHERE r.thread_id = t.id) AS reply_count,
         (SELECT MAX(r.created_at) FROM forum_replies r WHERE r.thread_id = t.id) AS last_reply_at
       FROM forum_threads t
       JOIN users u ON u.id = t.user_id
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  res.json({ items: rows, page, limit, total, hasMore: offset + rows.length < total });
});

// GET /api/forum/threads/:id -- thread body plus every reply, oldest first
router.get('/threads/:id', optionalAuth, (req, res) => {
  const thread = db
    .prepare(
      `SELECT t.*, u.username AS author
       FROM forum_threads t JOIN users u ON u.id = t.user_id
       WHERE t.id = ?`
    )
    .get(req.params.id);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });

  const replies = db
    .prepare(
      `SELECT r.id, r.body, r.created_at, r.user_id, u.username AS author
       FROM forum_replies r JOIN users u ON u.id = r.user_id
       WHERE r.thread_id = ?
       ORDER BY r.created_at ASC`
    )
    .all(req.params.id);

  res.json({
    ...thread,
    is_owner: !!req.user && req.user.id === thread.user_id,
    replies: replies.map((r) => ({ ...r, is_owner: !!req.user && req.user.id === r.user_id })),
  });
});

// POST /api/forum/threads
router.post('/threads', requireAuth, (req, res) => {
  const { title, body, category = 'general' } = req.body;
  if (!title?.trim() || !body?.trim()) {
    return res.status(400).json({ error: 'title and body are required' });
  }
  if (title.trim().length > MAX_TITLE) {
    return res.status(400).json({ error: `title must be ${MAX_TITLE} characters or fewer` });
  }
  if (body.trim().length > MAX_BODY) {
    return res.status(400).json({ error: `body must be ${MAX_BODY} characters or fewer` });
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
  }

  const info = db
    .prepare('INSERT INTO forum_threads (user_id, title, body, category) VALUES (?, ?, ?, ?)')
    .run(req.user.id, title.trim(), body.trim(), category);

  res.status(201).json({ id: info.lastInsertRowid });
});

// DELETE /api/forum/threads/:id (owner only)
router.delete('/threads/:id', requireAuth, (req, res) => {
  const thread = db.prepare('SELECT user_id FROM forum_threads WHERE id = ?').get(req.params.id);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });
  if (thread.user_id !== req.user.id) return res.status(403).json({ error: 'Not your thread' });

  db.prepare('DELETE FROM forum_threads WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/forum/threads/:id/replies
router.post('/threads/:id/replies', requireAuth, (req, res) => {
  const thread = db.prepare('SELECT id FROM forum_threads WHERE id = ?').get(req.params.id);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });

  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'body is required' });
  if (body.trim().length > MAX_BODY) {
    return res.status(400).json({ error: `body must be ${MAX_BODY} characters or fewer` });
  }

  const info = db
    .prepare('INSERT INTO forum_replies (thread_id, user_id, body) VALUES (?, ?, ?)')
    .run(req.params.id, req.user.id, body.trim());

  const reply = db
    .prepare(
      `SELECT r.id, r.body, r.created_at, r.user_id, u.username AS author
       FROM forum_replies r JOIN users u ON u.id = r.user_id WHERE r.id = ?`
    )
    .get(info.lastInsertRowid);

  res.status(201).json({ ...reply, is_owner: true });
});

// DELETE /api/forum/replies/:id (owner only)
router.delete('/replies/:id', requireAuth, (req, res) => {
  const reply = db.prepare('SELECT user_id, thread_id FROM forum_replies WHERE id = ?').get(req.params.id);
  if (!reply) return res.status(404).json({ error: 'Reply not found' });
  if (reply.user_id !== req.user.id) return res.status(403).json({ error: 'Not your reply' });

  db.prepare('DELETE FROM forum_replies WHERE id = ?').run(req.params.id);
  res.json({ success: true, thread_id: reply.thread_id });
});

export default router;
