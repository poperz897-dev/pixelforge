// Populates a fresh database with demo users, artwork built from the
// original sprite set in seedSprites.js, some likes, and a few forum
// threads -- so `npm run dev` doesn't open onto an empty gallery and empty
// forum. Safe to re-run: it checks for the first demo user and exits
// early if the data is already there instead of hitting the users.username
// UNIQUE constraint.
//
// Run with: npm run seed  (from backend/)

import bcrypt from 'bcryptjs';
import db from './connection.js';
import { generateThumbnail } from '../utils/thumbnail.js';
import { SPRITES } from './seedSprites.js';

const DEMO_PASSWORD = 'pixelforge-demo';

const USERS = [
  { username: 'pixel_aria', email: 'aria@example.com' },
  { username: 'wrenbit8', email: 'wren@example.com' },
  { username: 'mara_forge', email: 'mara@example.com' },
];

// index into USERS below; sprite key must exist in SPRITES
const ARTWORKS = [
  { sprite: 'sword', title: 'Iron Sword', user: 0, project_type: 'game_asset', category: 'item', visibility: 'public', daysAgo: 12, likedBy: [1, 2] },
  { sprite: 'health_potion', title: 'Health Potion', user: 0, project_type: 'game_asset', category: 'item', visibility: 'public', daysAgo: 11, likedBy: [1] },
  { sprite: 'mana_potion', title: 'Mana Potion (WIP)', user: 0, project_type: 'game_asset', category: 'item', visibility: 'private', daysAgo: 2, likedBy: [] },
  { sprite: 'grass_tile', title: 'Grass Tile', user: 1, project_type: 'game_asset', category: 'tile', visibility: 'public', daysAgo: 10, likedBy: [0, 2] },
  { sprite: 'stone_tile', title: 'Stone Brick Tile', user: 1, project_type: 'game_asset', category: 'tile', visibility: 'public', daysAgo: 9, likedBy: [2] },
  { sprite: 'slime', title: 'Slime', user: 1, project_type: 'game_asset', category: 'mob', visibility: 'public', daysAgo: 8, likedBy: [0, 2] },
  { sprite: 'apprentice_wizard', title: 'Apprentice Wizard', user: 2, project_type: 'game_asset', category: 'character', visibility: 'public', daysAgo: 7, likedBy: [0, 1] },
  { sprite: 'gold_coin', title: 'Gold Coin', user: 2, project_type: 'game_asset', category: 'item', visibility: 'public', daysAgo: 6, likedBy: [0] },
  { sprite: 'crystal_gem', title: 'Crystal Gem', user: 2, project_type: 'game_asset', category: 'item', visibility: 'public', daysAgo: 5, likedBy: [0, 1] },
  { sprite: 'heart_vessel', title: 'Heart Container', user: 0, project_type: 'game_asset', category: 'ui', visibility: 'public', daysAgo: 4, likedBy: [1, 2] },
  { sprite: 'treasure_chest', title: 'Treasure Chest (unfinished)', user: 1, project_type: 'game_asset', category: 'item', visibility: 'private', daysAgo: 1, likedBy: [] },
  { sprite: 'campfire', title: 'Campfire', user: 2, project_type: 'misc', category: 'icon', visibility: 'public', daysAgo: 3, likedBy: [0] },
  { sprite: 'space_cruiser', title: 'Space Cruiser', user: 0, project_type: 'misc', category: 'icon', visibility: 'public', daysAgo: 2, likedBy: [1, 2] },
];

const THREADS = [
  {
    user: 0,
    category: 'showcase',
    title: 'Finally finished this sword — feedback welcome',
    body: "Spent way longer than I'd like to admit getting the blade shading right on this one. Went with a bright ridge down the center instead of a side highlight so it stays readable at 16px. Curious what people think of the guard proportions.",
    daysAgo: 12,
    replies: [
      { user: 2, body: "The two-tier guard is a nice touch, most 16x16 swords just do a flat bar. Reads clearly even at actual size.", daysAgo: 11 },
      { user: 1, body: 'Agreed on the guard. Only thing I\'d nudge is the pommel — feels a touch small next to the grip.', daysAgo: 11 },
    ],
  },
  {
    user: 1,
    category: 'help',
    title: 'What grid size do you default to for tiles vs. characters?',
    body: "I've been using 16x16 for everything and it's starting to feel cramped for characters with any kind of pose. What's everyone else's default, and do you switch per asset type?",
    daysAgo: 9,
    replies: [
      { user: 0, body: "16x16 for tiles, 24x24 or 32x32 for characters is a pretty common split — gives you room for a pose without the tile grid stopping lining up.", daysAgo: 9 },
      { user: 2, body: 'Same here. I only go up to 32x32 if the character needs to hold something, otherwise 24 is plenty.', daysAgo: 8 },
    ],
  },
  {
    user: 2,
    category: 'critique',
    title: 'Does this gem read as glass/crystal, or just flat cyan?',
    body: "Trying to get a faceted-crystal look without going overboard on colors. Would love a second opinion on whether the violet facet accents are doing their job or just look like noise.",
    daysAgo: 5,
    replies: [
      { user: 0, body: "They read fine to me — the placement right at the widest point is exactly where a cut gem would actually catch light.", daysAgo: 4 },
    ],
  },
  {
    user: 0,
    category: 'general',
    title: "What's everyone working on this week?",
    body: 'Mostly item icons on my end — potions, a coin, a gem. Slowly building up enough of a set to actually dress out a full inventory screen. What about the rest of you?',
    daysAgo: 4,
    replies: [
      { user: 1, body: 'Tiles, mostly. Trying to get a grass and stone set that tile seamlessly before I let myself draw anything fun.', daysAgo: 4 },
      { user: 2, body: "A tiny wizard! First character sprite I've been happy with in a while.", daysAgo: 3 },
    ],
  },
  {
    user: 1,
    category: 'help',
    title: 'How do you keep a palette consistent across a whole set?',
    body: "Every piece I make individually looks fine, but lined up next to each other the colors clash more than I'd like. Do people build a fixed palette up front, or adjust after the fact?",
    daysAgo: 2,
    replies: [],
  },
];

function tsFrom(daysAgo, hour = 12) {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function run() {
  const already = db.prepare('SELECT id FROM users WHERE username = ?').get(USERS[0].username);
  if (already) {
    console.log('Seed data already present (found user "%s") — skipping.', USERS[0].username);
    return;
  }

  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const userIds = USERS.map((u) =>
    Number(
      db
        .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
        .run(u.username, u.email, passwordHash).lastInsertRowid
    )
  );

  const insertArtwork = db.prepare(
    `INSERT INTO artworks (user_id, title, project_type, category, width, height, pixel_data, thumbnail, visibility, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertLike = db.prepare('INSERT INTO likes (artwork_id, user_id, created_at) VALUES (?, ?, ?)');

  let artworkCount = 0;
  let likeCount = 0;
  for (const a of ARTWORKS) {
    const grid = SPRITES[a.sprite];
    if (!grid) {
      console.warn('No sprite data for "%s", skipping', a.sprite);
      continue;
    }
    const width = grid[0].length;
    const height = grid.length;
    const thumbnail = generateThumbnail(grid, width, height);
    const createdAt = tsFrom(a.daysAgo);

    const info = insertArtwork.run(
      userIds[a.user],
      a.title,
      a.project_type,
      a.category,
      width,
      height,
      JSON.stringify(grid),
      JSON.stringify(thumbnail),
      a.visibility,
      createdAt,
      createdAt
    );
    artworkCount++;

    for (const likerIdx of a.likedBy) {
      insertLike.run(Number(info.lastInsertRowid), userIds[likerIdx], tsFrom(Math.max(0, a.daysAgo - 1)));
      likeCount++;
    }
  }

  const insertThread = db.prepare(
    `INSERT INTO forum_threads (user_id, title, body, category, created_at) VALUES (?, ?, ?, ?, ?)`
  );
  const insertReply = db.prepare(
    `INSERT INTO forum_replies (thread_id, user_id, body, created_at) VALUES (?, ?, ?, ?)`
  );

  let threadCount = 0;
  let replyCount = 0;
  for (const t of THREADS) {
    const info = insertThread.run(userIds[t.user], t.title, t.body, t.category, tsFrom(t.daysAgo));
    threadCount++;
    const threadId = Number(info.lastInsertRowid);
    for (const r of t.replies) {
      insertReply.run(threadId, userIds[r.user], r.body, tsFrom(r.daysAgo));
      replyCount++;
    }
  }

  console.log(
    'Seeded %d users, %d artworks, %d likes, %d forum threads, %d replies.',
    userIds.length,
    artworkCount,
    likeCount,
    threadCount,
    replyCount
  );
  console.log('Demo login for any of them: <username>@example.com / %s', DEMO_PASSWORD);
}

run();
