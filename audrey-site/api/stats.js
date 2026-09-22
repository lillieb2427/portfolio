// GET ?days=N (admin) -> aggregated audience report for the admin "Data" tab.
import { route, send, methodNotAllowed, requireAdmin, query } from '../lib/http.js';
import { report } from '../lib/stats.js';

export default route(async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  if (!(await requireAdmin(req, res))) return;
  const n = Math.min(365, Math.max(1, parseInt(query(req).days, 10) || 7));
  send(res, 200, await report(n));
});
