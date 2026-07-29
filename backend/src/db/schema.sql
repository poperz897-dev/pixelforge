-- Users
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Artworks
-- project_type gates which categories make sense (enforced app-side, see routes/artworks.js):
--   game_asset -> tile | character | mob | item | ui
--   misc       -> icon | avatar | banner | other
CREATE TABLE IF NOT EXISTS artworks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  project_type TEXT NOT NULL CHECK (project_type IN ('game_asset', 'misc')),
  category     TEXT NOT NULL,
  width        INTEGER NOT NULL,
  height       INTEGER NOT NULL,
  pixel_data   TEXT NOT NULL,               -- JSON: 2D array of hex colors / null
  thumbnail    TEXT,                        -- JSON: {width,height,pixels[]} downsampled grid, for gallery lists
  grid_shape   TEXT NOT NULL DEFAULT 'square', -- 'square' | 'isometric'
  iso_ratio_w  REAL,                        -- only set when grid_shape = 'isometric'
  iso_ratio_h  REAL,
  visibility   TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Likes (one per user per artwork, enforced by UNIQUE)
CREATE TABLE IF NOT EXISTS likes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  artwork_id  INTEGER NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (artwork_id, user_id)
);

-- Saved color palettes (default ones ship in the frontend; this table is for user-saved ones)
CREATE TABLE IF NOT EXISTS palettes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  colors     TEXT NOT NULL,                 -- JSON array of hex strings
  is_public  INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_artworks_visibility ON artworks(visibility);
CREATE INDEX IF NOT EXISTS idx_artworks_user ON artworks(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_artwork ON likes(artwork_id);

-- Document model: an artwork is layers x frames, each intersection holding
-- a cel (a pixel grid). `artworks.pixel_data`/`width`/`height` above are kept
-- as a denormalized, always-up-to-date flattened composite of frame 0 -- it
-- exists purely so older/simpler consumers (gallery thumbnails, the Tile
-- Tester, ArtworkDetail) can keep reading a single flat grid without knowing
-- the document model exists. The layers/frames/cels tables below are the
-- real source of truth once an artwork has been migrated into them.
CREATE TABLE IF NOT EXISTS artwork_layers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  artwork_id  INTEGER NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  -- NULL parent = top-level layer/group; non-NULL = nested inside that group.
  parent_id   INTEGER REFERENCES artwork_layers(id) ON DELETE CASCADE,
  is_group    INTEGER NOT NULL DEFAULT 0,
  name        TEXT NOT NULL DEFAULT 'Layer',
  position    INTEGER NOT NULL DEFAULT 0,   -- draw order among siblings sharing parent_id; ascending = bottom-to-top
  visible     INTEGER NOT NULL DEFAULT 1,
  locked      INTEGER NOT NULL DEFAULT 0,
  opacity     REAL NOT NULL DEFAULT 1,      -- 0..1
  blend_mode  TEXT NOT NULL DEFAULT 'normal' CHECK (blend_mode IN ('normal','multiply','screen','overlay','add')),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS artwork_frames (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  artwork_id  INTEGER NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,   -- playback order, ascending
  duration_ms INTEGER NOT NULL DEFAULT 100,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS artwork_cels (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  layer_id    INTEGER NOT NULL REFERENCES artwork_layers(id) ON DELETE CASCADE,
  frame_id    INTEGER NOT NULL REFERENCES artwork_frames(id) ON DELETE CASCADE,
  pixel_data  TEXT NOT NULL,                -- JSON 2D array of hex colors / null, same width x height as the artwork
  UNIQUE (layer_id, frame_id)
);

CREATE INDEX IF NOT EXISTS idx_layers_artwork ON artwork_layers(artwork_id);
CREATE INDEX IF NOT EXISTS idx_frames_artwork ON artwork_frames(artwork_id);
CREATE INDEX IF NOT EXISTS idx_cels_layer ON artwork_cels(layer_id);
CREATE INDEX IF NOT EXISTS idx_cels_frame ON artwork_cels(frame_id);

-- Forum: the site's interuser-communication surface, separate from likes/
-- comments on individual artworks. Deliberately flat (no nested replies) --
-- a thread and its replies in arrival order covers critique/questions/
-- show-and-tell without needing a second reply-to-reply system.
CREATE TABLE IF NOT EXISTS forum_threads (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'critique', 'help', 'showcase')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS forum_replies (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id  INTEGER NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_forum_threads_category ON forum_threads(category);
CREATE INDEX IF NOT EXISTS idx_forum_replies_thread ON forum_replies(thread_id);
