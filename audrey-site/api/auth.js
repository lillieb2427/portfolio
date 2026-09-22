// POST { password } -> 200 if it matches ADMIN_PASSWORD, 401 otherwise.
import { route, send, readBody, methodNotAllowed, checkPassword, passwordConfigured } from '../lib/http.js';

export default route(async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const { password } = await readBody(req);
  if (checkPassword(password)) return send(res, 200, { ok: true });
  await new Promise((r) => setTimeout(r, 400)); // slow down guessing
  send(res, 401, { error: passwordConfigured() ? 'Wrong password' : 'ADMIN_PASSWORD is not set on the server' });
});
