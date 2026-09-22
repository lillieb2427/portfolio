// GET ?url=<instagram post/reel URL> -> the post's preview image.
// Instagram doesn't publish thumbnails, so we read the og:image of the public
// page server-side and proxy the picture. On failure: 404, and the site keeps
// its coloured card.
import { route, send, methodNotAllowed, query } from '../lib/http.js';

const POST_URL = /^https:\/\/(www\.)?instagram\.com\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/;
const IMG_HOST = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

function decodeHtml(s) {
  return s.replace(/&amp;/g, '&').replace(/&#x2F;/gi, '/').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}

export default route(async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  const m = String(query(req).url || '').match(POST_URL);
  if (!m) return send(res, 400, { error: 'Expected an Instagram post or reel URL' });
  const kind = m[2] === 'reels' ? 'reel' : m[2];
  const page = await fetch('https://www.instagram.com/' + kind + '/' + m[3] + '/', {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
    redirect: 'follow',
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!page || !page.ok) return send(res, 404, { error: 'Thumbnail unavailable' });
  const html = await page.text();
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (!og) return send(res, 404, { error: 'Thumbnail unavailable' });
  let img;
  try { img = new URL(decodeHtml(og[1])); } catch (e) { return send(res, 404, { error: 'Thumbnail unavailable' }); }
  if (img.protocol !== 'https:' || !IMG_HOST.test(img.hostname)) return send(res, 404, { error: 'Thumbnail unavailable' });
  const pic = await fetch(img, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  const type = pic && pic.headers.get('content-type') || '';
  if (!pic || !pic.ok || !/^image\//.test(type)) return send(res, 404, { error: 'Thumbnail unavailable' });
  res.statusCode = 200;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  res.end(Buffer.from(await pic.arrayBuffer()));
});
