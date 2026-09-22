// POST { name, ext, data(base64) } (admin) -> { url } of the stored font file.
// GET ?f=<file> -> serves a font stored locally (development only).
import { route, readBody, methodNotAllowed, requireAdmin, query } from '../lib/http.js';
import { handleUpload, serveLocal } from '../lib/upload.js';

const TYPES = { woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' };

export default route(async (req, res) => {
  if (req.method === 'GET') return serveLocal(res, 'fonts', query(req).f, TYPES);
  if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);
  if (!(await requireAdmin(req, res))) return;
  // Vercel caps request bodies at 4.5 MB and base64 adds a third: ~3 MB of font.
  await handleUpload(res, await readBody(req), { folder: 'fonts', types: TYPES, maxBytes: 3 * 1024 * 1024 });
});
