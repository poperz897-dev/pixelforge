const BASE = '/api';

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include', // send/receive the httpOnly auth cookie
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  register: (username, email, password) =>
    request('/auth/register', { method: 'POST', body: { username, email, password } }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),

  listArtworks: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/artworks${qs ? `?${qs}` : ''}`);
  },
  getArtwork: (id) => request(`/artworks/${id}`),
  createArtwork: (payload) => request('/artworks', { method: 'POST', body: payload }),
  updateArtwork: (id, payload) => request(`/artworks/${id}`, { method: 'PUT', body: payload }),
  deleteArtwork: (id) => request(`/artworks/${id}`, { method: 'DELETE' }),

  toggleLike: (id) => request(`/likes/${id}`, { method: 'POST' }),

  listPalettes: () => request('/palettes'),
  savePalette: (payload) => request('/palettes', { method: 'POST', body: payload }),

  listThreads: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/forum/threads${qs ? `?${qs}` : ''}`);
  },
  getThread: (id) => request(`/forum/threads/${id}`),
  createThread: (payload) => request('/forum/threads', { method: 'POST', body: payload }),
  deleteThread: (id) => request(`/forum/threads/${id}`, { method: 'DELETE' }),
  replyToThread: (id, body) => request(`/forum/threads/${id}/replies`, { method: 'POST', body: { body } }),
  deleteReply: (id) => request(`/forum/replies/${id}`, { method: 'DELETE' }),
};
