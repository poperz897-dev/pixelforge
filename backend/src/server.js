// Must be the very first import: it loads .env into process.env before
// anything else (like middleware/auth.js reading JWT_SECRET) gets imported.
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/auth.js';
import artworkRoutes from './routes/artworks.js';
import likeRoutes from './routes/likes.js';
import paletteRoutes from './routes/palettes.js';
import forumRoutes from './routes/forum.js';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// credentials: true + an explicit origin (not '*') is required for the
// browser to actually send/accept the httpOnly auth cookie cross-origin.
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '5mb' })); // pixel_data JSON can get sizeable on larger canvases

app.use('/api/auth', authRoutes);
app.use('/api/artworks', artworkRoutes);
app.use('/api/likes', likeRoutes);
app.use('/api/palettes', paletteRoutes);
app.use('/api/forum', forumRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Pixel art API running on http://localhost:${PORT}`);
});
