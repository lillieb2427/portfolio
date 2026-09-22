// Cleans and bounds the content document before it is saved.
// Mirrors the shape the pages and the admin read (see mergeAbout / mergeContact
// in the front-end): unknown keys are dropped, strings are capped, colours and
// URLs are validated, list lengths are limited.

const MAX_CLIENTS = 40;
const MAX_PROJECTS = 40;
const MAX_PHOTOS = 30;
const MAX_SHORTS = 60;
const MAX_TILES = 40;
const MAX_FONTS = 40;

const FINISHES = ['cuir', 'vernis', 'mat'];           // leather / gloss / matte (internal keys)
const FORMATS = ['landscape', 'portrait'];
const PLATFORMS = ['instagram', 'tiktok', 'twitch', 'youtube'];
const ABOUT_CARDS = ['desc', 'cv', 'edu', 'hobbies', 'content'];
const CONTACT_KEYS = ['photo', 'first', 'last', 'title', 'title_en', 'email', 'phone', 'note', 'note_en'];

// Same filters as the front-end.
const PHOTO_URL = /^(https?:\/\/|\/?api\/cover\?|assets\/)/i;
const LINK_URL = /^https?:\/\//i;
const FONT_URL = /^(https?:\/\/|\/?api\/font\?|assets\/)/i;

function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
function list(v) { return Array.isArray(v) ? v : []; }

function str(v, max) {
  if (typeof v !== 'string') return '';
  // Strip control characters except tab and newline.
  const s = v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '');
  return s.length > max ? s.slice(0, max) : s;
}

function color(v) {
  return typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v.trim()) ? v.trim() : '';
}

function url(v, re) {
  const s = str(v, 2000).trim();
  if (!s || !re.test(s) || /[\s"'<>]/.test(s)) return '';
  return s;
}

function id(v, prefix) {
  if (typeof v === 'string' && /^[a-z0-9][a-z0-9-]{0,59}$/i.test(v)) return v;
  return prefix + '-' + Math.random().toString(36).slice(2, 10);
}

function oneOf(v, allowed) { return allowed.includes(v) ? v : ''; }

// Base field + its English twin.
function pair(out, src, key, max) {
  out[key] = str(src[key], max);
  out[key + '_en'] = str(src[key + '_en'], max);
}

function project(p, prefix) {
  p = obj(p);
  const out = { id: id(p.id, prefix) };
  pair(out, p, 'title', 200);
  out.url = url(p.url, LINK_URL);
  pair(out, p, 'role', 200);
  pair(out, p, 'desc', 3000);
  out.bg = color(p.bg);
  out.text = color(p.text);
  out.font = str(p.font, 80);
  out.format = oneOf(p.format, FORMATS);
  out.photos = list(p.photos).map((u) => url(u, PHOTO_URL)).filter(Boolean).slice(0, MAX_PHOTOS);
  return out;
}

function client(c, prefix) {
  c = obj(c);
  const out = { id: id(c.id, prefix) };
  out.name = str(c.name, 80);
  out.bg = color(c.bg);
  out.text = color(c.text);
  out.font = str(c.font, 80);
  out.finish = oneOf(c.finish, FINISHES);
  pair(out, c, 'desc', 3000);
  out.projects = list(c.projects).slice(0, MAX_PROJECTS).map((p) => project(p, out.id));
  return out;
}

function short(s) {
  s = obj(s);
  const out = { id: id(s.id, 'sh') };
  pair(out, s, 'title', 200);
  pair(out, s, 'role', 200);
  out.url = url(s.url, LINK_URL);
  out.cover = url(s.cover, PHOTO_URL);
  out.bg = color(s.bg);
  out.text = color(s.text);
  out.font = str(s.font, 80);
  return out;
}

function tile(t) {
  t = obj(t);
  return { url: url(t.url, LINK_URL), cover: url(t.cover, PHOTO_URL), title: str(t.title, 120), title_en: str(t.title_en, 120) };
}

function about(a) {
  a = obj(a);
  const out = {
    photo: url(a.photo, PHOTO_URL),
    name: str(a.name, 80),
  };
  pair(out, a, 'title', 160);
  pair(out, a, 'stamp', 60);
  pair(out, a, 'note', 400);
  out.cards = {};
  for (const k of ABOUT_CARDS) {
    const c = obj(obj(a.cards)[k]);
    out.cards[k] = {
      label: str(c.label, 80), text: str(c.text, 8000),
      label_en: str(c.label_en, 80), text_en: str(c.text_en, 8000),
    };
  }
  pair(out, a, 'how', 1500);
  out.photos = list(a.photos).map((u) => url(u, PHOTO_URL)).filter(Boolean).slice(0, MAX_PHOTOS);
  const f = obj(a.fonts);
  out.fonts = { type: str(f.type, 80), body: str(f.body, 80), hand: str(f.hand, 80) };
  const s = obj(a.social);
  const given = list(s.platforms).map(obj);
  out.social = {
    handle: str(s.handle, 60),
    platforms: PLATFORMS.map((kind) => {
      const p = given.find((g) => g.kind === kind) || {};
      return { kind, url: url(p.url, LINK_URL), followers: str(p.followers, 20) };
    }),
    videos: list(s.videos).slice(0, MAX_TILES).map(tile),
    collabs: list(s.collabs).slice(0, MAX_TILES).map(tile),
    photos: list(s.photos).slice(0, MAX_TILES).map((p) => {
      p = obj(p);
      return { img: url(p.img, PHOTO_URL), link: url(p.link, LINK_URL) };
    }),
  };
  return out;
}

function contact(c) {
  c = obj(c);
  const out = {};
  for (const k of CONTACT_KEYS) out[k] = str(c[k], k === 'note' || k === 'note_en' ? 300 : 120);
  out.photo = url(c.photo, PHOTO_URL);
  return out;
}

function fonts(f) {
  const seen = new Set();
  const custom = [];
  for (const item of list(obj(f).custom)) {
    const x = obj(item);
    const name = str(x.name, 80).trim();
    if (!name || seen.has(name)) continue;
    const kind = x.kind === 'file' ? 'file' : 'google';
    const u = kind === 'file' ? url(x.url, FONT_URL) : '';
    if (kind === 'file' && !u) continue;
    seen.add(name);
    custom.push({ name, url: u, kind });
    if (custom.length >= MAX_FONTS) break;
  }
  return { custom };
}

export function sanitizeContent(input) {
  const c = obj(input);
  return {
    version: 1,
    youtube: { clients: list(obj(c.youtube).clients).slice(0, MAX_CLIENTS).map((x) => client(x, 'yt')) },
    brand: { clients: list(obj(c.brand).clients).slice(0, MAX_CLIENTS).map((x) => client(x, 'br')) },
    shorts: {
      ratio: obj(c.shorts).ratio === 'landscape' ? 'landscape' : 'portrait',
      items: list(obj(c.shorts).items).slice(0, MAX_SHORTS).map(short),
    },
    fonts: fonts(c.fonts),
    about: about(c.about),
    contact: contact(c.contact),
  };
}
