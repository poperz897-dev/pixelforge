import { Router } from 'express';
import db from '../db/connection.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { generateThumbnail } from '../utils/thumbnail.js';
import { getDocument, saveDocument, syncCompositeAndThumbnail, documentFromLegacyGrid } from '../db/documentModel.js';

const router = Router();

const VALID_PROJECT_TYPES = ['game_asset', 'misc'];
const VALID_GRID_SHAPES = ['square', 'isometric'];
const MAX_SQUARE_DIM = 64;
const MAX_ISO_DIM = 128;
const MIN_ISO_RATIO = 0.1;
const MAX_ISO_RATIO = 10;
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 60;

// GET /api/artworks
// Public gallery by default. Pass ?mine=true (requires auth) to list the
// current user's own artworks instead (public + private).
// Filters: ?project_type=game_asset&category=tile
// Sort:    ?sort=newest | most_liked | trending   (default: newest)
// Paging:  ?page=1&limit=24  (1-indexed; limit capped at 60)
router.get('/', optionalAuth, (req, res) => {
  const { project_type, category, sort = 'newest', mine } = req.query;

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;

  const where = [];
  const params = [];

  if (mine === 'true') {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    where.push('a.user_id = ?');
    params.push(req.user.id);
  } else {
    where.push("a.visibility = 'public'");
  }

  if (project_type && VALID_PROJECT_TYPES.includes(project_type)) {
    where.push('a.project_type = ?');
    params.push(project_type);
  }
  if (category) {
    where.push('a.category = ?');
    params.push(category);
  }

  const whereClause = where.join(' AND ');

  let orderBy = 'a.created_at DESC';
  if (sort === 'most_liked') orderBy = 'like_count DESC, a.created_at DESC';
  else if (sort === 'trending') orderBy = 'recent_like_count DESC, a.created_at DESC';

  const total = db
    .prepare(`SELECT COUNT(*) AS c FROM artworks a WHERE ${whereClause}`)
    .get(...params).c;

  // Gallery cards only need a small thumbnail, not the full-resolution grid
  // (which can be up to 64x64 = 4096 cells) -- keeps list payloads small.
  const rows = db
    .prepare(
      `SELECT
         a.id, a.title, a.project_type, a.category, a.width, a.height,
         a.grid_shape, a.iso_ratio_w, a.iso_ratio_h,
         a.visibility, a.thumbnail, a.created_at, u.username AS author,
         (SELECT COUNT(*) FROM likes l WHERE l.artwork_id = a.id) AS like_count,
         (SELECT COUNT(*) FROM likes l WHERE l.artwork_id = a.id
            AND l.created_at >= datetime('now', '-7 days')) AS recent_like_count
       FROM artworks a
       JOIN users u ON u.id = a.user_id
       WHERE ${whereClause}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  res.json({
    items: rows.map((r) => ({ ...r, thumbnail: r.thumbnail ? JSON.parse(r.thumbnail) : null })),
    page,
    limit,
    total,
    hasMore: offset + rows.length < total,
  });
});

// GET /api/artworks/:id
router.get('/:id', optionalAuth, (req, res) => {
  const artwork = db
    .prepare(
      `SELECT a.*, u.username AS author,
         (SELECT COUNT(*) FROM likes l WHERE l.artwork_id = a.id) AS like_count
       FROM artworks a JOIN users u ON u.id = a.user_id
       WHERE a.id = ?`
    )
    .get(req.params.id);

  if (!artwork) return res.status(404).json({ error: 'Artwork not found' });

  const isOwner = !!req.user && req.user.id === artwork.user_id;
  if (artwork.visibility === 'private' && !isOwner) {
    // Same response as "doesn't exist" -- never confirm a private artwork's existence
    return res.status(404).json({ error: 'Artwork not found' });
  }

  const liked_by_me = req.user
    ? !!db.prepare('SELECT 1 FROM likes WHERE artwork_id = ? AND user_id = ?').get(artwork.id, req.user.id)
    : false;

  // `document` is the real layers x frames x cels structure (migrated
  // lazily from the old single-grid shape if this artwork predates it).
  // `pixel_data` stays a flattened composite of frame 0 for consumers that
  // only need one grid (Tile Tester, ArtworkDetail preview, etc).
  const document = getDocument(db, artwork.id);

  res.json({
    ...artwork,
    pixel_data: JSON.parse(artwork.pixel_data),
    thumbnail: artwork.thumbnail ? JSON.parse(artwork.thumbnail) : null,
    document,
    is_owner: isOwner,
    liked_by_me,
  });
});

// POST /api/artworks
router.post('/', requireAuth, (req, res) => {
  const {
    title, project_type, category, width, height, pixel_data, document: documentPayload, visibility = 'private',
    grid_shape = 'square', iso_ratio_w, iso_ratio_h,
  } = req.body;

  // Accept either the new full document (layers x frames x cels) or the
  // old flat `pixel_data` grid, which gets wrapped into a one-layer,
  // one-frame document -- keeps any caller still on the old shape working.
  const document = documentPayload || (pixel_data ? documentFromLegacyGrid(pixel_data) : null);

  if (!title || !project_type || !category || !width || !height || !document) {
    return res
      .status(400)
      .json({ error: 'title, project_type, category, width, height and pixel_data (or document) are required' });
  }
  if (!VALID_PROJECT_TYPES.includes(project_type)) {
    return res.status(400).json({ error: `project_type must be one of: ${VALID_PROJECT_TYPES.join(', ')}` });
  }
  if (!VALID_GRID_SHAPES.includes(grid_shape)) {
    return res.status(400).json({ error: `grid_shape must be one of: ${VALID_GRID_SHAPES.join(', ')}` });
  }

  const maxDim = grid_shape === 'isometric' ? MAX_ISO_DIM : MAX_SQUARE_DIM;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > maxDim || height > maxDim) {
    return res.status(400).json({ error: `width and height must be whole numbers between 1 and ${maxDim} for ${grid_shape} grids` });
  }

  let ratioW = null;
  let ratioH = null;
  if (grid_shape === 'isometric') {
    ratioW = Number(iso_ratio_w);
    ratioH = Number(iso_ratio_h);
    const validRatio = (n) => Number.isFinite(n) && n >= MIN_ISO_RATIO && n <= MAX_ISO_RATIO;
    if (!validRatio(ratioW) || !validRatio(ratioH)) {
      return res
        .status(400)
        .json({ error: `iso_ratio_w and iso_ratio_h are required for isometric grids, between ${MIN_ISO_RATIO} and ${MAX_ISO_RATIO}` });
    }
  }

  // Every cel's grid has to match the declared width/height, or compositing
  // and thumbnail generation index past the end of a row/column below.
  const badCel = (document.cels || []).find(
    (c) => !Array.isArray(c.pixel_data) || c.pixel_data.length !== height || c.pixel_data.some((row) => !Array.isArray(row) || row.length !== width)
  );
  if (!document.layers?.length || !document.frames?.length || badCel) {
    return res.status(400).json({ error: `document must have at least one layer and frame, with cels sized ${height}-row by ${width}-column` });
  }

  // Insert the artwork row first with placeholder composite/thumbnail --
  // saveDocument needs a real artwork_id to attach layers/frames/cels to,
  // and syncCompositeAndThumbnail (right after) fills in the real values.
  const placeholderGrid = Array.from({ length: height }, () => Array(width).fill(null));
  const info = db
    .prepare(
      `INSERT INTO artworks (user_id, title, project_type, category, width, height, pixel_data, thumbnail, visibility, grid_shape, iso_ratio_w, iso_ratio_h)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.id,
      title,
      project_type,
      category,
      width,
      height,
      JSON.stringify(placeholderGrid),
      JSON.stringify(generateThumbnail(placeholderGrid, width, height)),
      visibility,
      grid_shape,
      ratioW,
      ratioH
    );

  const artworkId = Number(info.lastInsertRowid);
  saveDocument(db, artworkId, document);
  syncCompositeAndThumbnail(db, artworkId, width, height);

  res.status(201).json({ id: artworkId });
});

// PUT /api/artworks/:id  (owner only) -- used for edits and for the public/private toggle
// Grid size and project_type are intentionally not editable here: changing
// dimensions would invalidate the stored pixel_data shape, and switching
// project_type would invalidate the current category. Create a new artwork
// for either of those instead.
router.put('/:id', requireAuth, (req, res) => {
  const artwork = db.prepare('SELECT * FROM artworks WHERE id = ?').get(req.params.id);
  if (!artwork) return res.status(404).json({ error: 'Artwork not found' });
  if (artwork.user_id !== req.user.id) return res.status(403).json({ error: 'Not your artwork' });

  const { title, category, pixel_data, document: documentPayload, visibility } = req.body;

  // Same either/or as create: a full document replaces layers/frames/cels
  // wholesale, a bare pixel_data grid is wrapped into a one-layer document
  // first so old-shaped callers still work.
  const document = documentPayload || (pixel_data ? documentFromLegacyGrid(pixel_data) : null);
  if (document) {
    saveDocument(db, artwork.id, document);
    syncCompositeAndThumbnail(db, artwork.id, artwork.width, artwork.height);
  }

  db.prepare(
    `UPDATE artworks
     SET title = COALESCE(?, title),
         category = COALESCE(?, category),
         visibility = COALESCE(?, visibility),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(
    title ?? null,
    category ?? null,
    visibility ?? null,
    req.params.id
  );

  res.json({ success: true });
});

// DELETE /api/artworks/:id  (owner only)
router.delete('/:id', requireAuth, (req, res) => {
  const artwork = db.prepare('SELECT * FROM artworks WHERE id = ?').get(req.params.id);
  if (!artwork) return res.status(404).json({ error: 'Artwork not found' });
  if (artwork.user_id !== req.user.id) return res.status(403).json({ error: 'Not your artwork' });

  db.prepare('DELETE FROM artworks WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
