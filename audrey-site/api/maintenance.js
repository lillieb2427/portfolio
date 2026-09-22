// POST { on } (admin) -> switches the maintenance screen on or off, right away.
// Stored apart from the content so toggling never conflicts with a pending save.
import { route, send, readBody, methodNotAllowed, requireAdmin } from '../lib/http.js';
import { putDoc } from '../lib/storage.js';

export default route(async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (!(await requireAdmin(req, res))) return;
  const { on } = await readBody(req);
  await putDoc('maintenance', { on: on === true, at: new Date().toISOString() });
  send(res, 200, { on: on === true });
});
