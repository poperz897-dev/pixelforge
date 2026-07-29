// Uses Node's built-in SQLite module instead of the `better-sqlite3` npm
// package. better-sqlite3 needs native compilation (node-gyp + Python) on
// install, which fails on machines without a working Python/build-tools
// setup -- node:sqlite ships with Node itself (22.5+), so there's nothing
// to compile. The API (prepare/run/get/all, lastInsertRowid) is close
// enough to better-sqlite3 that the rest of the app didn't need to change.
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../../database/pixelart.db');
const schemaPath = path.join(__dirname, 'schema.sql');

// Make sure the /database folder exists before opening the file
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// CREATE TABLE IF NOT EXISTS makes this safe to run on every startup
db.exec(fs.readFileSync(schemaPath, 'utf-8'));

// Migration guard: databases created before the thumbnail feature existed
// won't have this column yet (CREATE TABLE IF NOT EXISTS above is a no-op
// for them), so add it explicitly if missing.
const artworkCols = db.prepare('PRAGMA table_info(artworks)').all().map((c) => c.name);
if (!artworkCols.includes('thumbnail')) {
  db.exec('ALTER TABLE artworks ADD COLUMN thumbnail TEXT');
}
// Same story for the isometric-grid columns added later.
if (!artworkCols.includes('grid_shape')) {
  db.exec("ALTER TABLE artworks ADD COLUMN grid_shape TEXT NOT NULL DEFAULT 'square'");
}
if (!artworkCols.includes('iso_ratio_w')) {
  db.exec('ALTER TABLE artworks ADD COLUMN iso_ratio_w REAL');
}
if (!artworkCols.includes('iso_ratio_h')) {
  db.exec('ALTER TABLE artworks ADD COLUMN iso_ratio_h REAL');
}

export default db;
