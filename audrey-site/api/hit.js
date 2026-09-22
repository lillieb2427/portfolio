// POST (sendBeacon, text/plain JSON) -> records one page view or event.
// Always answers 204: the page never waits on it and never sees errors.
import { route, readBody } from '../lib/http.js';
import { classify, record } from '../lib/stats.js';

export default route(async (req, res) => {
  if (req.method === 'POST' && req.headers.dnt !== '1') {
    try {
      const payload = await readBody(req, 8 * 1024);
      await record(classify(req, payload));
    } catch (e) {
      console.error('hit:', e.message);
    }
  }
  res.statusCode = 204;
  res.setHeader('Cache-Control', 'no-store');
  res.end();
});
