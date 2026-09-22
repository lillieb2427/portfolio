// End-to-end tests: starts server.js on a free port with a temporary data
// folder and exercises every API route in local-storage mode.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PW = 'test-password';
const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = 'http://127.0.0.1:' + PORT;
let server;
let dataDir;

const admin = { 'x-admin-password': PW };
const json = (h = {}) => ({ 'Content-Type': 'application/json', ...h });
async function get(p, headers) {
  const r = await fetch(BASE + p, { headers, redirect: 'manual' });
  const type = r.headers.get('content-type') || '';
  return { status: r.status, headers: r.headers, body: type.includes('json') ? await r.json() : await r.arrayBuffer() };
}
async function post(p, body, headers = {}) {
  const r = await fetch(BASE + p, { method: 'POST', headers: json(headers), body: JSON.stringify(body) });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
}

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'audrey-site-test-'));
  const env = { ...process.env, PORT: String(PORT), ADMIN_PASSWORD: PW, DATA_DIR: dataDir };
  for (const k of ['VERCEL', 'BLOB_READ_WRITE_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']) delete env[k];
  server = spawn(process.execPath, ['server.js'], { env, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (d) => { if (String(d).includes('running at')) resolve(); });
    server.on('exit', (c) => reject(new Error('server exited ' + c)));
  });
});

after(() => {
  server.kill();
  rmSync(dataDir, { recursive: true, force: true });
});

test('pages are served with clean URLs', async () => {
  const home = await get('/');
  assert.equal(home.status, 200);
  assert.equal((await get('/about')).status, 200);
  assert.equal((await get('/admin')).status, 200);
  const redirect = await get('/about.html');
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('location'), '/about');
  assert.equal((await get('/../server.js')).status, 404);
});

test('status reports local storage', async () => {
  const r = await get('/api/status');
  assert.equal(r.status, 200);
  assert.equal(r.body.canSave, true);
  assert.equal(r.body.mode, 'local');
  assert.equal(r.body.stats, true);
});

test('auth accepts only the right password', async () => {
  assert.equal((await post('/api/auth', { password: PW })).status, 200);
  assert.equal((await post('/api/auth', { password: 'nope' })).status, 401);
  assert.equal((await post('/api/auth', {})).status, 401);
});

test('content starts from the seed', async () => {
  const r = await get('/api/content');
  assert.equal(r.status, 200);
  assert.equal(r.body.maintenance, false);
  assert.equal(r.body.updatedAt, '');
  assert.equal(r.body.about.name, 'audrey-lillie');
  assert.equal(r.body.contact.email, 'audreylilliebing@gmail.com');
  assert.ok(r.body.youtube.clients.length > 0);
});

test('saving content: auth, sanitising, conflict detection', async () => {
  const { body: loaded } = await get('/api/content', admin);
  const content = structuredClone(loaded);
  delete content.updatedAt;
  delete content.maintenance;
  content.about.title = 'GRAPHIC DESIGNER';
  content.youtube.clients[0].bg = 'red; background:url(x)';          // bad colour
  content.youtube.clients[0].projects[0].url = 'javascript:alert(1)'; // bad link
  content.contact.photo = 'data:image/png;base64,AAAA';               // bad photo URL
  content.extra = 'dropped';

  assert.equal((await post('/api/content', { content, base: '' })).status, 401);

  const first = await post('/api/content', { content, base: '' }, admin);
  assert.equal(first.status, 200);
  assert.match(first.body.updatedAt, /^\d{4}-\d\d-\d\dT/);

  const saved = (await get('/api/content')).body;
  assert.equal(saved.about.title, 'GRAPHIC DESIGNER');
  assert.equal(saved.youtube.clients[0].bg, '');
  assert.equal(saved.youtube.clients[0].projects[0].url, '');
  assert.equal(saved.contact.photo, '');
  assert.equal(saved.extra, undefined);
  assert.equal(saved.updatedAt, first.body.updatedAt);

  // A second tab still holding the old base gets a 409…
  const stale = await post('/api/content', { content, base: '' }, admin);
  assert.equal(stale.status, 409);
  assert.equal(stale.body.stale, true);
  // …unless it forces the save.
  assert.equal((await post('/api/content', { content, base: '', force: true }, admin)).status, 200);
});

test('maintenance hides the content from visitors only', async () => {
  assert.equal((await post('/api/maintenance', { on: true })).status, 401);
  const on = await post('/api/maintenance', { on: true }, admin);
  assert.deepEqual(on.body, { on: true });

  const visitor = (await get('/api/content')).body;
  assert.deepEqual(visitor, { maintenance: true });
  const owner = (await get('/api/content', admin)).body;
  assert.equal(owner.maintenance, true);
  assert.ok(owner.about);

  await post('/api/maintenance', { on: false }, admin);
  assert.equal((await get('/api/content')).body.maintenance, false);
});

test('cover upload stores and serves images', async () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
  assert.equal((await post('/api/cover', { name: 'x', ext: 'png', data: png.toString('base64') })).status, 401);
  assert.equal((await post('/api/cover', { name: 'x', ext: 'svg', data: 'PHN2Zz4=' }, admin)).status, 400);

  const up = await post('/api/cover', { name: 'My Photo!', ext: 'png', data: png.toString('base64') }, admin);
  assert.equal(up.status, 200);
  assert.match(up.body.url, /^api\/cover\?f=my-photo-[a-z0-9]+\.png$/);

  const served = await get('/' + up.body.url);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(served.body), png);

  assert.equal((await get('/api/cover?f=' + encodeURIComponent('../docs/content.json'))).status, 404);
});

test('font upload accepts font files only', async () => {
  assert.equal((await post('/api/font', { name: 'F', ext: 'exe', data: 'AAAA' }, admin)).status, 400);
  const up = await post('/api/font', { name: 'My Font', ext: 'woff2', data: Buffer.from('wOF2fake').toString('base64') }, admin);
  assert.equal(up.status, 200);
  assert.match(up.body.url, /^api\/font\?f=my-font-[a-z0-9]+\.woff2$/);
  assert.equal((await get('/' + up.body.url)).headers.get('content-type'), 'font/woff2');
});

test('hits are counted and reported', async () => {
  const beacon = (payload, ua = 'Mozilla/5.0 test') => fetch(BASE + '/api/hit', {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'User-Agent': ua }, body: JSON.stringify(payload),
  });
  assert.equal((await beacon({ p: '/about', r: 'https://l.instagram.com/', l: 'en', d: 'phone', u: BASE + '/about' })).status, 204);
  await beacon({ p: '/', r: '', l: 'en', d: 'desktop', u: BASE + '/?utm_source=tiktok' });
  await beacon({ e: 'book:SCRAPS' });
  await beacon({ e: 'not-an-event' });                               // ignored
  await beacon({ p: '/', r: '' }, 'Googlebot/2.1');                  // bots ignored
  assert.equal((await fetch(BASE + '/api/hit', { method: 'POST', body: '{broken' })).status, 204);

  assert.equal((await get('/api/stats?days=7')).status, 401);
  const r = (await get('/api/stats?days=7', admin)).body;
  assert.equal(r.configured, true);
  assert.equal(r.totals.views, 2);
  assert.equal(r.totals.uniques, 1);
  assert.equal(r.totals.events, 1);
  assert.equal(r.days.length, 7);
  assert.equal(r.refs.instagram, 1);
  assert.equal(r.refs.tiktok, 1);
  assert.equal(r.pages['/about'], 1);
  assert.equal(r.dev.phone, 1);
  assert.equal(r.ev['book:SCRAPS'], 1);
});

test('thumb only accepts Instagram URLs', async () => {
  assert.equal((await get('/api/thumb?url=' + encodeURIComponent('http://169.254.169.254/'))).status, 400);
  assert.equal((await get('/api/thumb?url=' + encodeURIComponent('https://evil.com/p/abc'))).status, 400);
});
