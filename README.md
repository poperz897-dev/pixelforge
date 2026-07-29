# PixelForge — pixel art creator

A full-stack pixel art creator: draw on a square or isometric grid, save it public or private,
browse a gallery sorted by newest / most liked / trending, organize work by type (game assets:
tiles, characters, mobs, items, UI — or miscellaneous: icons, avatars, banners), test isometric
tiles on a real drag-and-drop tilemap with a walkable hero, and talk to other people making
pixel art in the forum.

Rename "PixelForge" to whatever you like; it's just a placeholder (in `frontend/index.html`
and `frontend/src/App.jsx`).

## Changelog

### This pass — homepage + forum
Merged in a real homepage (`/`, previously just a redirect straight to the gallery) and a forum,
both adapted from a third, separately-developed build. Scope was deliberately narrow — homepage
and forum only, not that build's other unrelated tweaks (a few emoji→icon swaps in the toolbar,
profile visibility tabs) — see the full breakdown below for what was and wasn't brought over.
- **Home page** (`pages/Home.jsx`): hero section, a 3-up feature summary, a dedicated isometric
  callout, and a "trending this week" strip pulling live from the gallery API.
- **The isometric callout used to be a "coming soon" teaser** (`IsometricTileCTA.jsx`, and the
  screenshot that prompted this — dashed border, "in progress" badge, "landing here soon"
  copy). Since isometric grids are real now, this pass rewrote it: solid border, an "available
  now" badge, and the card actually links into a working editor session
  (`/editor?shape=isometric`, which `Editor.jsx` now reads on load to preselect Isometric —
  only for a new piece, never overriding an existing artwork's saved shape). The old
  `/isometric` stub page this used to redirect to is retired.
- Because the Tile Tester didn't exist yet in whatever build this homepage was designed
  against, the isometric section undersold what's actually there now — it's been extended to
  also point at `/tester`, since a walkable hero on a tilemap is arguably the most "game" this
  app gets.
- **Forum** (`pages/Forum.jsx`, `ForumThread.jsx`, `backend/routes/forum.js`): threads with four
  categories (general/critique/help/showcase), replies, owner-only delete, "most recently
  active" sort by default. New `forum_threads`/`forum_replies` tables (see schema.sql) — flat,
  no nested replies, on purpose.
- **Seed data** (`backend/src/db/seed.js`, `npm run seed`): 3 demo users, 13 sprites (hand-drawn
  for this project, not sourced from anywhere), a spread of public/private artwork, and 5 forum
  threads with real multi-reply conversations. Opt-in, idempotent (safe to run more than once),
  and directly aimed at the original "it's too empty" complaint this whole project started
  from — a fresh install no longer opens onto an empty gallery and an empty forum.
  Demo login for any seeded user: `<username>@example.com` / `pixelforge-demo`.
- **Nav/footer**: switched to `NavLink` so the current section stays visibly highlighted, added
  a footer, both now include the Tile Tester link the source homepage didn't know about.
- **Background motion tuned up** — found in the same reference build, not explicitly requested
  this round, but a strict improvement so it's included: star/shooting-star drift speeds are
  ~1.7x faster across the board. Comment in `PixelUniverse.jsx` explains why (the old values
  were smooth but read as inert, not actually dropping frames).
- **Not brought over** (out of the stated scope for this pass): emoji→real-icon swaps in the
  toolbar/artwork cards/editor, and profile page visibility tabs. All three are cosmetic-only
  and would layer in cleanly later if wanted — `icons.jsx` already has every icon they'd need,
  since that file was adopted wholesale (it's a strict superset of what was already here).

### Isometric grid support + Tile Tester
Two projects were merged: this one (background reliability + modernization, see below) and a
separately-developed isometric-grid/tile-testing build. The grid math, rendering pipeline,
tile-tester camera, and hero sprite are adopted **unmodified** from that build — that code had
its own careful verification history (see `frontend/scripts/verify-iso-grid.mjs`, still passing
all 42 grid-size × ratio combinations after the merge). What changed in this pass:
- **Isometric grids**: square (up to 64×64) or isometric (up to 128×128, ratio presets or
  custom w:h) — chosen per-artwork in the editor, locked once saved. New `grid_shape` /
  `iso_ratio_w` / `iso_ratio_h` columns on `artworks`, validated in
  `backend/src/routes/artworks.js`.
- **Tile Tester** (`/tester`): a pannable/zoomable tilemap — drag tiles from your library onto
  a square or isometric grid, paint/erase, and walk a hero sprite around with arrow keys.
  `frontend/src/pages/TileTester.jsx` + `components/tester/`.
- **Real color wheel**: replaced the native `<input type="color">` with an HSV wheel + value
  slider (`components/editor/ColorWheel.jsx`). This is *a* real wheel, adopted as-is from the
  other build — not yet the specific bespoke design that was separately requested, so it may
  still change once that reference arrives.
- **Gallery/artwork-detail thumbnails made isometric-aware** — this was the one real gap:
  those pages were kept from the modernization pass as requested, but they originally only
  knew how to render square grids, which would have shown isometric saves squashed and wrong.
  `ArtworkCard.jsx` and `ArtworkDetail.jsx` now render through the shape-aware
  `PixelGridPreview`, with a small "◆ ISO" badge on cards.
- **Quick-start tutorials carried over and extended**: the dismissible/reopenable tutorial
  pattern now covers both Create and Test, each with its own tips and "seen" state.
- Chrome (panels, buttons, sliders) restyled to the existing design system; none of the
  isometric math, canvas rendering, or tile-tester camera/drag logic was touched.

### Background reliability + modernization
- **Fixed the background not showing.** The real cause: `App.jsx` returned `null` for the
  *entire* app — background included — until an async login check finished, so a slow/failed
  request meant a flat dark screen with nothing on it. The background and nav now mount
  immediately and unconditionally; only the routed page content waits on the auth check, with
  a proper loading state in its place. Also replaced the negative-`z-index` trick the
  background used to hide itself behind content with a positive-stacking wrapper, which
  doesn't silently break if some future ancestor element gains a `transform` or `overflow`.
  See `frontend/src/App.jsx` and `frontend/src/components/background/PixelUniverse.jsx`.
- **Design system**: colors pulled from the starfield's own palette, a 4-font type system
  (Space Grotesk for headings, Inter for body copy, Press Start 2P reserved for page titles
  only, JetBrains Mono for hex/technical readouts), a recurring "cut-corner panel" motif, and
  a hover-glow used consistently across buttons/cards/nav.
- **Color history**: colors picked from the wheel, palette, or eyedropper are tracked
  automatically in a "Recent" section (`frontend/src/hooks/useRecentColors.js`), independent
  of the curated "My colors" list. Wheel drags are debounced before recording so one gesture
  doesn't flood the history with intermediate values.
- **Empty/loading states**: gallery, profile, and artwork-detail pages had bare "Loading…"
  text and blank empty states; these now use a pixel-block loading indicator and a small
  mascot-and-message empty state.
- **Three real icons** (ghost, rocket, sparkle) adapted from the MIT-licensed
  [shuqikhor/pixel-icons](https://github.com/shuqikhor/pixel-icons), recolored onto this
  project's palette. See `THIRD_PARTY_LICENSES.md` for attribution. Used deliberately
  sparingly — a handful of spots, not plastered everywhere.

### Earlier pass
- Moved auth off `localStorage` and onto an httpOnly cookie.
- Wired the `palettes` API into the editor (save/load named color palettes).
- Added an "edit existing artwork" flow and gallery pagination.
- First attempt at the `PixelUniverse` starfield background — this is the version that had
  the mounting bug described above.

## Stack
- **Frontend**: React + Vite + Tailwind, canvas-based pixel editor
- **Backend**: Node + Express, JWT auth (httpOnly cookie)
- **Database**: SQLite via Node's built-in `node:sqlite` module — a single file, zero setup, and no native compilation step (needs Node **22.5+**; check with `node -v`)

## Project structure
```
pixelart-creator/
├── frontend/
│   ├── src/            React app (editor, gallery, tester, auth pages)
│   └── scripts/         verify-iso-grid.mjs — standalone isometric-math regression check
├── backend/              Express API (auth, artworks, likes, palettes)
└── database/             SQLite file lives here (created automatically on first run)
```

## Setup

**1. Backend**
```bash
cd backend
npm install
cp .env.example .env      # then edit JWT_SECRET to any random string
npm run dev
```
Runs on http://localhost:3001. The SQLite database and its tables (including the isometric
grid and forum tables) are created/migrated automatically the first time the server starts.

Optionally, populate it with demo content so the gallery and forum aren't empty on first look:
```bash
npm run seed
```
Safe to run more than once — it checks for existing seed data and skips if found. Demo login
for any of the seeded users: `<username>@example.com` / `pixelforge-demo` (see `src/db/seed.js`
for the actual usernames).

**2. Frontend** (in a new terminal)
```bash
cd frontend
npm install
npm run dev
```
Runs on http://localhost:5173 and proxies `/api` calls to the backend, so there's no CORS
setup needed in dev.

Open http://localhost:5173, register an account, and start drawing.

**Important**: the frontend still renders (background included) even if you skip step 1 or
the backend isn't reachable — you'll just be stuck logged-out with gallery/save calls failing.
If everything looks blank instead, that's a real bug, not this one — see Verification below.

## How the pieces fit together

- **Public/private**: every artwork has a `visibility` column. The gallery query only returns
  `public` rows unless you're asking for your own (`?mine=true`, which requires auth). The
  single-artwork endpoint 404s on private art unless you're the owner — this is enforced in
  `backend/src/routes/artworks.js`, never just hidden by the frontend.
- **Rankings**: "most liked" and "trending" aren't separate systems — they're the `artworks`
  query sorted by a `COUNT(likes)` subquery (trending narrows that count to the last 7 days).
  See the `GET /api/artworks` route.
- **Categories**: `project_type` (`game_asset` / `misc`) gates which `category` options are
  shown — tiles/characters/mobs/items/UI for game assets, icons/avatars/banners/other for misc.
  Both are plain columns, so filtering is just a `WHERE` clause. Add more types/categories in
  `backend/src/routes/artworks.js` (VALID_PROJECT_TYPES) and the matching `CATEGORIES` objects
  in `Editor.jsx` / `FilterBar.jsx`.
- **Grid shapes**: `grid_shape` (`square` / `isometric`) plus `iso_ratio_w`/`iso_ratio_h` are
  set once at creation and locked afterward (same philosophy as width/height — see
  `backend/src/routes/artworks.js`, the PUT route deliberately doesn't accept them). All the
  actual geometry — masking, outline tracing, content-box cropping so a tile always fills
  exactly one tester cell — lives in `frontend/src/utils/isoGrid.js` and `renderGrid.js`, and
  is exercised by `npm run verify:iso` (see Verification below).
- **Colors**: an HSV wheel (`ColorWheel.jsx`) + a curated default palette + a "Recent" history
  (auto-tracked, local to the browser, works for guests too) + "My colors" (manually saved) +
  server-backed named palettes via the `palettes` table.
- **Tile Tester**: `useTileTester.js` owns all state (camera pan/zoom, placed tiles, hero
  position/animation); `TestGrid.jsx` is purely a renderer + input handler for that state. A
  tile sent from the editor hands off via `sessionStorage` (`tileTesterDraft`), read once on
  mount.
- **Background**: `PixelUniverse.jsx` is a single `<canvas>`, animated with `requestAnimationFrame`,
  rendered at a deliberately low internal resolution and scaled up with nearest-neighbor
  sampling for the chunky pixel look. It respects `prefers-reduced-motion` (renders one static
  frame instead of animating) and pauses its loop when the tab is hidden.
- **Forum**: flat threads + replies (no nesting), four fixed categories, sorted by most recent
  activity by default (`COALESCE(last_reply_at, created_at)`, see `routes/forum.js`). Entirely
  separate from likes/comments on artwork — this is general discussion, not per-piece feedback.

## Where to take this next
- Swap in the specific bespoke color-wheel design once that reference is available
- Real keyboard shortcuts for the toolbar (B/E/F/I are currently shown as hints but not wired
  to a keydown handler — a pre-existing gap, not something this pass introduced or fixed)
- The emoji→icon and profile-visibility-tabs polish that was deliberately left out of this pass
  (see Changelog) — `icons.jsx` already has everything needed for it
- Swap SQLite for Postgres if you need concurrent writes at real scale

## Verification (this pass)

**Background/reliability** (unchanged from the previous pass, still holds after the merge):
1. `cd frontend && npm install && npm run dev` — open the URL it prints. The starfield should
   be visible **immediately**, before you log in or the backend responds to anything.
2. Open the browser console — there should be nothing red on load.
3. Hard refresh (Ctrl/Cmd+Shift+R) a few times in a row — the background should never flash
   away to a flat color, even for a frame.
4. Stop the backend (or block `localhost:3001`) and reload — you should see the background,
   nav, and a "Warming up the studio…" loader (not a blank page) before it settles into a
   logged-out gallery.
5. System Settings → reduce motion → reload — stars should be present but static.
6. Tab through forms/toolbar with keyboard only — every focused element should show a visible
   cyan outline.

**Isometric grid + Tile Tester:**
7. `cd frontend && npm run verify:iso` — standalone check, no browser needed, should print
   `PASS` for all 42 combinations.
8. In the editor: switch to Isometric, try a couple of ratio presets and a custom ratio (e.g.
   `3:2`) — the canvas should re-clip to a diamond and the grid-size dropdown should only
   offer sizes that are actually valid for that ratio.
9. Draw something, hit **Send to Tile Tester** — it should land as a draft tile, pre-selected,
   with the grid already matching its shape/ratio.
10. On `/tester`: drag the draft tile onto the grid: it should exactly fill one cell regardless
    of zoom. Right-click erases. Arrow keys walk the hero continuously while held (not one
    stuttery step per press). Scroll zooms toward the cursor; middle-drag pans.
11. Save an isometric piece, then check it renders correctly (as a diamond, not squashed into
    a square) on both the Gallery card and its Artwork Detail page.

**New this pass — homepage + forum:**
12. `npm run seed` in `backend/`, then load `/` — hero, feature cards, the isometric callout,
    and a trending strip should all render with real data, not placeholders.
13. Click **Create an isometric tile** on the homepage — it should land in the editor with
    Isometric already selected, not the plain square default.
14. `/forum` should list the 5 seeded threads with reply counts; opening one shows the full
    conversation. Post a thread and a reply while logged in; confirm you can delete your own
    but there's no delete option on someone else's.
15. Confirm the nav's current section stays visibly highlighted as you move between pages, and
    that the footer's links (including Tile Tester, which the original homepage design
    predates) all resolve correctly.
