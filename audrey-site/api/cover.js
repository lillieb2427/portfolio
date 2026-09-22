// POST { name, ext, data(base64) } (admin) -> { url } of the stored image.
// GET ?f=<file> -> serves an image stored locally (development only).
import { route, readBody, methodNotAllowed, requireAdmin, query } from '../lib/http.js';
import { handleUpload, serveLocal } from '../lib/upload.js';

// No SVG: it can carry scripts and, locally, would be served from the site's origin.
const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' };

export default route(async (req, res) => {
  if (req.method === 'GET') return serveLocal(res, 'covers', query(req).f, TYPES);
  if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);
  if (!(await requireAdmin(req, res))) return;
  await handleUpload(res, await readBody(req), { folder: 'covers', types: TYPES, maxBytes: 4 * 1024 * 1024 });
});
