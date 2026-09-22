// Local development server: serves public/ with clean URLs (/about ->
// about.html, like Vercel's cleanUrls) and runs the api/*.js handlers.
// Data is stored under ./.data. Usage: npm run dev  (reads .env if present)
import http from 'node:http';
import { promises as fs, readFileSync } from 'node:fs';
import path from 'node:path';

try {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
} catch (e) { /* no .env */ }

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.resolve('public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
};
const handlers = {};

async function api(name, req, res) {
  if (!/^[a-z]+$/.test(name)) return false;
  if (!handlers[name]) {
    try { handlers[name] = (await import('./api/' + name + '.js')).default; } catch (e) { return false; }
  }
  await handlers[name](req, res);
  return true;
}

async function file(p) {
  try {
    const st = await fs.stat(p);
    return st.isFile() ? p : null;
  } catch (e) { return null; }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.startsWith('/api/') && await api(pathname.slice(5), req, res)) return;
  if (pathname.endsWith('.html')) {  // Vercel cleanUrls redirects /about.html -> /about
    res.writeHead(308, { Location: pathname.replace(/(index)?\.html$/, '') + url.search });
    return res.end();
  }
  const target = path.join(PUBLIC, path.normalize(pathname));
  if (!target.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  const found = await file(target) || await file(target + '.html') || await file(path.join(target, 'index.html'));
  if (!found) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(found).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  res.end(await fs.readFile(found));
}).listen(PORT, () => {
  console.log('audrey-site running at http://localhost:' + PORT + '  (admin: /admin)');
  if (!process.env.ADMIN_PASSWORD) console.log('  ! ADMIN_PASSWORD is not set: create a .env file (see .env.example) to use the admin.');
});
