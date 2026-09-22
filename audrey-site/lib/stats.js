// Anonymous, cookie-free audience stats.
//
// Backends:
//   - Redis over REST (Upstash / Vercel KV): KV_REST_API_URL + KV_REST_API_TOKEN,
//     or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
//   - Local JSON file (.data/stats.json) in development.
// Visitors are counted with a daily-salted hash of IP + user agent: nothing is
// stored in the browser and the raw IP never leaves this function.

import crypto from 'node:crypto';
import { mode, readLocalJSON, writeLocalJSON } from './storage.js';

const TTL = 60 * 60 * 24 * 400;

function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

export function statsBackend() {
  if (redisConfig()) return 'redis';
  if (mode() === 'local') return 'local';
  return null;
}

async function redis(commands) {
  const { url, token } = redisConfig();
  const r = await fetch(url + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error('Redis HTTP ' + r.status);
  const out = await r.json();
  return out.map((x) => {
    if (x.error) throw new Error('Redis: ' + x.error);
    return x.result;
  });
}

function today() { return new Date().toISOString().slice(0, 10); }

function dayList(n) {
  const out = [];
  const now = Date.now();
  for (let i = n - 1; i >= 0; i--) out.push(new Date(now - i * 86400000).toISOString().slice(0, 10));
  return out;
}

/* ---------- Classifying a hit ---------- */

const SOURCES = [
  ['instagram', /(^|\.)instagram\.com$|^l\.instagram\.com$/],
  ['tiktok', /(^|\.)tiktok\.com$/],
  ['linkedin', /(^|\.)linkedin\.com$|^lnkd\.in$/],
  ['google', /(^|\.)google\.[a-z.]+$/],
  ['youtube', /(^|\.)youtube\.com$|^youtu\.be$/],
  ['facebook', /(^|\.)facebook\.com$|^fb\.me$|^l\.facebook\.com$/],
  ['x', /(^|\.)(twitter|x)\.com$|^t\.co$/],
  ['snapchat', /(^|\.)snapchat\.com$/],
  ['pinterest', /(^|\.)pinterest\.[a-z.]+$|^pin\.it$/],
];

function source(referrer, pageUrl, ownHost) {
  // utm_source on the landing URL wins over the referrer.
  try {
    const utm = new URL(pageUrl).searchParams.get('utm_source');
    if (utm) {
      const u = utm.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40);
      const known = SOURCES.find(([k]) => u.includes(k));
      if (known) return known[0];
      if (u) return 'other:' + u;
    }
  } catch (e) { /* ignore */ }
  if (!referrer) return 'direct';
  let host = '';
  try { host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return 'direct'; }
  if (!host || host === ownHost) return 'direct';
  const known = SOURCES.find(([, re]) => re.test(host));
  return known ? known[0] : 'other:' + host.slice(0, 60);
}

function visitorId(req, day) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  const ua = String(req.headers['user-agent'] || '');
  const salt = process.env.STATS_SALT || process.env.ADMIN_PASSWORD || 'audrey-site';
  return crypto.createHash('sha256').update(salt + '|' + day + '|' + ip + '|' + ua).digest('hex').slice(0, 20);
}

const PAGES = ['/', '/about', '/youtube', '/shorts', '/brand'];

// Turns a beacon payload into the counters to bump. Returns null to ignore it.
export function classify(req, payload) {
  const ua = String(req.headers['user-agent'] || '');
  if (/bot|crawl|spider|slurp|preview|headless|lighthouse/i.test(ua)) return null;
  const day = today();
  if (typeof payload.e === 'string' && payload.e) {
    const e = payload.e.slice(0, 80);
    if (e !== 'contact' && !/^(book|yt|short):/.test(e)) return null;
    return { day, event: e };
  }
  if (typeof payload.p !== 'string') return null;
  const ownHost = String(req.headers.host || '').toLowerCase().replace(/^www\./, '').split(':')[0];
  const country = String(req.headers['x-vercel-ip-country'] || '').toUpperCase();
  return {
    day,
    page: PAGES.includes(payload.p) ? payload.p : 'other',
    ref: source(String(payload.r || ''), String(payload.u || ''), ownHost),
    geo: /^[A-Z]{2}$/.test(country) ? country : 'XX',
    dev: payload.d === 'phone' ? 'phone' : 'desktop',
    lang: payload.l === 'fr' ? 'fr' : 'en',
    visitor: visitorId(req, day),
  };
}

/* ---------- Recording ---------- */

export async function record(hit) {
  const backend = statsBackend();
  if (!backend || !hit) return;
  const k = 'st:' + hit.day + ':';
  if (backend === 'redis') {
    if (hit.event) {
      await redis([['HINCRBY', k + 'e', hit.event, 1], ['INCR', k + 'ec'], ['EXPIRE', k + 'e', TTL], ['EXPIRE', k + 'ec', TTL]]);
      return;
    }
    await redis([
      ['INCR', k + 'v'], ['PFADD', k + 'u', hit.visitor],
      ['HINCRBY', k + 'p', hit.page, 1], ['HINCRBY', k + 'r', hit.ref, 1], ['HINCRBY', k + 'g', hit.geo, 1],
      ['HINCRBY', k + 'd', hit.dev, 1], ['HINCRBY', k + 'l', hit.lang, 1],
      ...['v', 'u', 'p', 'r', 'g', 'd', 'l'].map((s) => ['EXPIRE', k + s, TTL]),
    ]);
    return;
  }
  // Local file: fine for development (no concurrency guarantees).
  const db = await readLocalJSON('stats.json', {});
  const d = db[hit.day] || (db[hit.day] = { v: 0, u: [], p: {}, r: {}, g: {}, d: {}, l: {}, e: {}, ec: 0 });
  const inc = (m, key) => { m[key] = (m[key] || 0) + 1; };
  if (hit.event) { inc(d.e, hit.event); d.ec++; }
  else {
    d.v++;
    if (!d.u.includes(hit.visitor)) d.u.push(hit.visitor);
    inc(d.p, hit.page); inc(d.r, hit.ref); inc(d.g, hit.geo); inc(d.d, hit.dev); inc(d.l, hit.lang);
  }
  await writeLocalJSON('stats.json', db);
}

/* ---------- Report for the admin "Data" tab ---------- */

function toMap(v) {
  // Upstash returns HGETALL as a flat [field, value, ...] array.
  const out = {};
  if (Array.isArray(v)) for (let i = 0; i + 1 < v.length; i += 2) out[v[i]] = Number(v[i + 1]) || 0;
  else if (v && typeof v === 'object') for (const [a, b] of Object.entries(v)) out[a] = Number(b) || 0;
  return out;
}

function addInto(target, src) {
  for (const [k, n] of Object.entries(src)) target[k] = (target[k] || 0) + n;
}

export async function report(nDays) {
  const backend = statsBackend();
  if (!backend) {
    return {
      configured: false,
      hint: 'Stats need a Redis database: create an Upstash Redis store in Vercel Storage, connect it to the project (it sets KV_REST_API_URL and KV_REST_API_TOKEN), then redeploy.',
    };
  }
  const days = dayList(nDays);
  const rows = [];
  let totalUniques = 0;
  if (backend === 'redis') {
    const cmds = [];
    for (const d of days) {
      const k = 'st:' + d + ':';
      cmds.push(['GET', k + 'v'], ['PFCOUNT', k + 'u'], ['HGETALL', k + 'p'], ['HGETALL', k + 'r'], ['HGETALL', k + 'g'],
        ['HGETALL', k + 'd'], ['HGETALL', k + 'l'], ['HGETALL', k + 'e'], ['GET', k + 'ec']);
    }
    cmds.push(['PFCOUNT', ...days.map((d) => 'st:' + d + ':u')]);
    const res = await redis(cmds);
    days.forEach((d, i) => {
      const r = res.slice(i * 9, i * 9 + 9);
      rows.push({ day: d, v: Number(r[0]) || 0, u: Number(r[1]) || 0, p: toMap(r[2]), r: toMap(r[3]), g: toMap(r[4]), d: toMap(r[5]), l: toMap(r[6]), e: toMap(r[7]), ec: Number(r[8]) || 0 });
    });
    totalUniques = Number(res[res.length - 1]) || 0;
  } else {
    const db = await readLocalJSON('stats.json', {});
    const all = new Set();
    for (const d of days) {
      const x = db[d] || {};
      (x.u || []).forEach((v) => all.add(v));
      rows.push({ day: d, v: x.v || 0, u: (x.u || []).length, p: x.p || {}, r: x.r || {}, g: x.g || {}, d: x.d || {}, l: x.l || {}, e: x.e || {}, ec: x.ec || 0 });
    }
    totalUniques = all.size;
  }
  const out = { configured: true, totals: { views: 0, uniques: totalUniques, events: 0 }, days: [], pages: {}, refs: {}, geo: {}, dev: {}, lang: {}, ev: {} };
  for (const r of rows) {
    out.totals.views += r.v;
    out.totals.events += r.ec;
    out.days.push({ day: r.day, views: r.v, uniques: r.u });
    addInto(out.pages, r.p); addInto(out.refs, r.r); addInto(out.geo, r.g);
    addInto(out.dev, r.d); addInto(out.lang, r.l); addInto(out.ev, r.e);
  }
  return out;
}
