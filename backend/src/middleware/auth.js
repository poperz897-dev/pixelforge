import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const COOKIE_NAME = 'token';

// Blocks the request unless a valid token is present.
// Use on routes that always require a logged-in user (create, update, delete, like).
export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Attaches req.user if a valid token is present, but never blocks the request.
// Use on routes logged-out users can still hit (browsing public art).
export function optionalAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];

  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
      // invalid/expired token on an optional route -> just treat as logged out
    }
  }
  next();
}

export { JWT_SECRET, COOKIE_NAME };
