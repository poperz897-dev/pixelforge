// The document model: an artwork's real content lives in artwork_layers x
// artwork_frames x artwork_cels (see schema.sql). This module is the only
// place that reads/writes those three tables, plus the small amount of
// glue that keeps `artworks.pixel_data/width/height` in sync as a flattened
// "frame 0, all visible layers" composite for older/simpler consumers.
import { flattenDocument } from '../utils/compositing.js';
import { generateThumbnail } from '../utils/thumbnail.js';

function makeEmptyGrid(width, height) {
  return Array.from({ length: height }, () => Array(width).fill(null));
}

// True once an artwork has been migrated into the layers/frames/cels
// tables. Older rows (created before this rework, or inserted directly
// like the seed script does) won't have any layer rows yet.
function hasDocument(db, artworkId) {
  return !!db.prepare('SELECT 1 FROM artwork_layers WHERE artwork_id = ? LIMIT 1').get(artworkId);
}

// One existing `pixel_data` grid becomes one layer, one frame, in the new
// structure -- run lazily the first time an old artwork's document is
// requested, so nothing needs a big upfront migration pass and no old save
// is ever silently dropped.
function migrateLegacyArtwork(db, artworkId) {
  const artwork = db.prepare('SELECT pixel_data FROM artworks WHERE id = ?').get(artworkId);
  if (!artwork) return;
  const grid = JSON.parse(artwork.pixel_data);

  db.exec('BEGIN');
  try {
    const layer = db
      .prepare(`INSERT INTO artwork_layers (artwork_id, parent_id, is_group, name, position, visible, locked, opacity, blend_mode)
                VALUES (?, NULL, 0, 'Layer 1', 0, 1, 0, 1, 'normal')`)
      .run(artworkId);
    const frame = db.prepare('INSERT INTO artwork_frames (artwork_id, position, duration_ms) VALUES (?, 0, 100)').run(artworkId);
    db.prepare('INSERT INTO artwork_cels (layer_id, frame_id, pixel_data) VALUES (?, ?, ?)').run(
      Number(layer.lastInsertRowid),
      Number(frame.lastInsertRowid),
      JSON.stringify(grid)
    );
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// Reads the full document for an artwork, migrating it in-place first if
// it's still on the old single-grid shape.
export function getDocument(db, artworkId) {
  if (!hasDocument(db, artworkId)) migrateLegacyArtwork(db, artworkId);

  const layers = db.prepare('SELECT * FROM artwork_layers WHERE artwork_id = ? ORDER BY position').all(artworkId);
  const frames = db.prepare('SELECT * FROM artwork_frames WHERE artwork_id = ? ORDER BY position').all(artworkId);
  const layerIds = layers.map((l) => l.id);
  const cels = layerIds.length
    ? db
        .prepare(`SELECT * FROM artwork_cels WHERE layer_id IN (${layerIds.map(() => '?').join(',')})`)
        .all(...layerIds)
        .map((c) => ({ ...c, pixel_data: JSON.parse(c.pixel_data) }))
    : [];

  return { layers, frames, cels };
}

// Replaces an artwork's entire document (used on save from the editor,
// which always sends the full current layers/frames/cels rather than a
// diff -- documents here are small enough that this is simple and fast).
// `document.layers`/`frames` may omit `id` for newly-created rows; cels are
// matched to their (layer index, frame index) pair positionally.
export function saveDocument(db, artworkId, document) {
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM artwork_layers WHERE artwork_id = ?').run(artworkId); // cascades to cels
    db.prepare('DELETE FROM artwork_frames WHERE artwork_id = ?').run(artworkId); // cascades to cels

    // clientId -> real DB id, so parent_id/layer_id/frame_id references
    // from the client (which doesn't know real ids for new rows) resolve.
    const layerIdMap = new Map();
    const insertLayer = db.prepare(
      `INSERT INTO artwork_layers (artwork_id, parent_id, is_group, name, position, visible, locked, opacity, blend_mode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    // Insert groups/top-level-first order doesn't matter for parent_id
    // resolution as long as we insert parents before children; layers are
    // already a tree of depth-limited nesting, so a couple of passes over
    // any ordering converges. Simplest correct approach: insert layers with
    // no parent first, then repeatedly insert any whose parent is now known.
    let remaining = [...(document.layers || [])];
    let guard = 0;
    while (remaining.length && guard < 100) {
      guard++;
      const next = [];
      for (const l of remaining) {
        const parentClientId = l.parent_id ?? null;
        if (parentClientId != null && !layerIdMap.has(parentClientId)) {
          next.push(l);
          continue;
        }
        const realParentId = parentClientId != null ? layerIdMap.get(parentClientId) : null;
        const info = insertLayer.run(
          artworkId,
          realParentId,
          l.is_group ? 1 : 0,
          l.name || 'Layer',
          l.position ?? 0,
          l.visible === false ? 0 : 1,
          l.locked ? 1 : 0,
          typeof l.opacity === 'number' ? l.opacity : 1,
          l.blend_mode || 'normal'
        );
        layerIdMap.set(l.id, Number(info.lastInsertRowid));
      }
      remaining = next;
    }

    const frameIdMap = new Map();
    const insertFrame = db.prepare('INSERT INTO artwork_frames (artwork_id, position, duration_ms) VALUES (?, ?, ?)');
    for (const f of document.frames || []) {
      const info = insertFrame.run(artworkId, f.position ?? 0, f.duration_ms ?? 100);
      frameIdMap.set(f.id, Number(info.lastInsertRowid));
    }

    const insertCel = db.prepare('INSERT INTO artwork_cels (layer_id, frame_id, pixel_data) VALUES (?, ?, ?)');
    for (const c of document.cels || []) {
      const layerId = layerIdMap.get(c.layer_id);
      const frameId = frameIdMap.get(c.frame_id);
      if (!layerId || !frameId) continue; // stale reference to a layer/frame that no longer exists
      insertCel.run(layerId, frameId, JSON.stringify(c.pixel_data));
    }

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  return getDocument(db, artworkId);
}

// Flattens a document down to the single grid + thumbnail that
// `artworks.pixel_data`/`thumbnail` store, and writes both back -- keeps
// every consumer that only knows about a flat grid (gallery cards, the
// Tile Tester, ArtworkDetail) working without any changes on their end.
export function syncCompositeAndThumbnail(db, artworkId, width, height) {
  const document = getDocument(db, artworkId);
  const firstFrame = document.frames[0];
  const composite = firstFrame
    ? flattenDocument({ layers: document.layers, cels: document.cels, frameId: firstFrame.id, width, height })
    : makeEmptyGrid(width, height);
  const thumbnail = generateThumbnail(composite, width, height);

  db.prepare('UPDATE artworks SET pixel_data = ?, thumbnail = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
    JSON.stringify(composite),
    JSON.stringify(thumbnail),
    artworkId
  );

  return composite;
}

// Builds a fresh one-layer, one-frame document from a plain grid -- used
// when a client still POSTs the old `pixel_data` shape (e.g. a script, or
// a not-yet-updated caller) instead of a full `document` payload.
export function documentFromLegacyGrid(grid) {
  return {
    layers: [{ id: 'layer-1', parent_id: null, is_group: false, name: 'Layer 1', position: 0, visible: true, locked: false, opacity: 1, blend_mode: 'normal' }],
    frames: [{ id: 'frame-1', position: 0, duration_ms: 100 }],
    cels: [{ layer_id: 'layer-1', frame_id: 'frame-1', pixel_data: grid }],
  };
}
