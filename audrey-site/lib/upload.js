// Shared by api/cover and api/font: decode a base64 upload, check it, store it.
import { putFile, readLocalFile } from './storage.js';
import { send } from './http.js';

export function slug(s, fallback) {
  const out = String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  return out || fallback;
}

export async function handleUpload(res, body, { folder, types, maxBytes }) {
  const ext = String(body.ext || '').toLowerCase().replace(/^\./, '');
  const type = types[ext];
  if (!type) return send(res, 400, { error: 'File type not allowed (' + Object.keys(types).join(', ') + ')' });
  if (typeof body.data !== 'string' || !body.data) return send(res, 400, { error: 'Empty file' });
  const buf = Buffer.from(body.data, 'base64');
  if (!buf.length) return send(res, 400, { error: 'Empty file' });
  if (buf.length > maxBytes) return send(res, 413, { error: 'File too large (max ' + Math.round(maxBytes / 1048576) + ' MB)' });
  const name = slug(body.name, folder === 'fonts' ? 'font' : 'image') + '-' + Date.now().toString(36) + '.' + ext;
  const url = await putFile(folder, name, buf, type);
  send(res, 200, { url });
}

// Local development only: serve a file saved under .data/files/<folder>.
export async function serveLocal(res, folder, filename, types) {
  const ext = String(filename || '').split('.').pop().toLowerCase();
  const buf = types[ext] ? await readLocalFile(folder, String(filename)) : null;
  if (!buf) return send(res, 404, { error: 'Not found' });
  res.statusCode = 200;
  res.setHeader('Content-Type', types[ext]);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(buf);
}
