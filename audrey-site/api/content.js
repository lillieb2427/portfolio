// GET  -> the site content (public). During maintenance visitors only get
//         { maintenance: true }; the admin (x-admin-password) gets everything.
// POST { content, base, force } (admin) -> saves. `base` is the updatedAt the
//         admin loaded; if the stored content changed since, answers 409 unless
//         `force` is set, so two tabs can't silently overwrite each other.
import { promises as fs } from 'node:fs';
import { route, send, readBody, methodNotAllowed, isAdmin, requireAdmin } from '../lib/http.js';
import { getDoc, putDoc } from '../lib/storage.js';
import { sanitizeContent } from '../lib/sanitize.js';

let seedCache = null;
async function seed() {
  if (!seedCache) {
    seedCache = JSON.parse(await fs.readFile(new URL('../seed/content.json', import.meta.url), 'utf8'));
  }
  return seedCache;
}

async function maintenanceOn() {
  const m = await getDoc('maintenance');
  return !!(m && m.on === true);
}

export default route(async (req, res) => {
  if (req.method === 'GET') {
    const [stored, maint] = await Promise.all([getDoc('content'), maintenanceOn()]);
    if (maint && !isAdmin(req)) return send(res, 200, { maintenance: true });
    const content = stored || { ...sanitizeContent(await seed()), updatedAt: '' };
    return send(res, 200, { ...content, maintenance: maint });
  }
  if (req.method === 'POST') {
    if (!(await requireAdmin(req, res))) return;
    const body = await readBody(req);
    if (!body.content || typeof body.content !== 'object') return send(res, 400, { error: 'Missing content' });
    const current = await getDoc('content');
    const currentAt = (current && current.updatedAt) || '';
    if (currentAt && body.force !== true && body.base !== currentAt) {
      return send(res, 409, {
        stale: true,
        error: 'The live content was changed somewhere else (another tab or device) after you opened the admin. Saving now would overwrite those changes.',
        updatedAt: currentAt,
      });
    }
    const clean = sanitizeContent(body.content);
    clean.updatedAt = new Date().toISOString();
    await putDoc('content', clean);
    return send(res, 200, { ok: true, updatedAt: clean.updatedAt });
  }
  methodNotAllowed(res, ['GET', 'POST']);
});
