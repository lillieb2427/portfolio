// GET -> whether the admin can save, and whether stats are set up.
import { route, send, methodNotAllowed } from '../lib/http.js';
import { status } from '../lib/storage.js';
import { statsBackend } from '../lib/stats.js';

export default route(async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  send(res, 200, { ...status(), stats: statsBackend() !== null });
});
