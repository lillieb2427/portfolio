// One-off: converts Audrey's Archive content.js into the site's content format.
// Usage: node seed/build-seed.mjs <path-to-Archive/assets/data/content.js>
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import { sanitizeContent } from '../lib/sanitize.js';

const src = readFileSync(process.argv[2], 'utf8');
const ctx = { window: {} };
vm.runInNewContext(src, ctx);
const S = ctx.window.SITE;

// Palette reused from the original design, cycled per entry.
const PALETTE = [
  { bg: '#9EA3C4', text: '#F3D163', font: 'Anton' },
  { bg: '#EC7448', text: '#1C2440', font: 'Archivo' },
  { bg: '#7DB59E', text: '#DFEFFB', font: 'Space Grotesk' },
  { bg: '#EE6E8C', text: '#F3D163', font: 'Bebas Neue' },
  { bg: '#C9A43A', text: '#1C2440', font: 'Archivo' },
  { bg: '#9AA5E8', text: '#1C2440', font: 'Anton' },
  { bg: '#9AA6AE', text: '#D63F64', font: 'Bebas Neue' },
  { bg: '#B9BD3A', text: '#1C2440', font: 'Anton' },
  { bg: '#A5AE9A', text: '#521028', font: 'DM Serif Display' },
  { bg: '#D98EA8', text: '#E3F1FB', font: 'Archivo' },
];
const SHELF = [
  { bg: '#002e7a', text: '#ff8647', font: 'Archivo' },
  { bg: '#3f7a0a', text: '#ff5fa2', font: 'Bebas Neue' },
  { bg: '#f7c93c', text: '#2a6d5c', font: 'Space Mono' },
  { bg: '#ffd6e4', text: '#2a6d5c', font: 'Anton' },
  { bg: '#461052', text: '#f3d163', font: 'Bebas Neue' },
  { bg: '#fff6b8', text: '#1f4fd8', font: 'Anton' },
  { bg: '#a9c6ff', text: '#e8a13a', font: 'Archivo' },
  { bg: '#d9c6ff', text: '#4f9a1e', font: 'Anton' },
];
const link = (u) => (u && u !== '#' ? u : '');
const isPlaceholder = (s) => /^(One line about|add involvements|A short (line|note) about|Say a couple of sentences)/i.test(String(s || '').trim());
const clean = (s) => (isPlaceholder(s) ? '' : String(s || '').trim());

const tabs = Object.fromEntries(S.about.tabs.map((t) => [t.key, t]));

// Experience + education as dated rows (renderText turns "2025 — present — …" into a row).
function years(date) {
  const m = String(date).match(/(\d{4})\D+(\d{4}|present)/i);
  return m ? m[1] + ' — ' + m[2].toLowerCase() : String(date);
}
function block(items) {
  return items.map((it) => {
    const lines = [years(it.date) + ' — ' + it.role + ', ' + it.company];
    const d = clean(it.desc);
    if (d) lines.push(d);
    return lines.join('\n');
  }).join('\n\n');
}
const cvText = block(tabs.experience.items);
const eduText = block(tabs.education.items);

const socials = Object.fromEntries(tabs.connect.links.map((l) => [l.platform.toLowerCase(), l]));

const content = {
  youtube: {
    clients: S.home.projects.map((p, i) => ({
      id: 'work-' + (i + 1),
      name: p.name,
      ...PALETTE[i % PALETTE.length],
      finish: '',
      desc: clean(p.description),
      projects: [{ id: 'work-' + (i + 1) + '-1', title: p.name, url: link(p.link), role: '', desc: '', photos: [] }],
    })),
  },
  brand: {
    clients: S.clients.map((c, i) => ({
      id: 'client-' + (i + 1),
      name: c.name,
      ...SHELF[i % SHELF.length],
      finish: '',
      desc: clean(c.desc),
      projects: [{ id: 'client-' + (i + 1) + '-1', title: c.name, url: link(c.link), role: '', desc: '', photos: [] }],
    })),
  },
  shorts: {
    ratio: 'portrait',
    items: S.gallery.map((g, i) => ({
      id: 'gal-' + (i + 1),
      title: g.title.toUpperCase(),
      role: '',
      url: link(g.link),
      cover: '',
      bg: g.color || PALETTE[i % PALETTE.length].bg,
      text: '#FFFFFF',
      font: 'Anton',
    })),
  },
  fonts: { custom: [] },
  about: {
    photo: S.about.photo,
    name: S.about.name,
    title: S.about.title,
    stamp: S.about.stamp,
    note: '',
    cards: {
      desc: { label: tabs.bio.label, text: tabs.bio.paragraphs.join('\n\n') },
      cv: { label: tabs.experience.label, text: cvText },
      edu: { label: tabs.education.label, text: eduText },
      hobbies: { label: tabs.hobbies.label, text: 'a list of things I love:\n\n' + tabs.hobbies.list.map((h) => '- ' + h).join('\n') },
      content: {
        label: 'CONTENT CREATION',
        text: 'I also make content on my own channels. Come say hi ✧',
      },
    },
    how: clean(S.about.howIWork),
    photos: [],
    fonts: { type: '', body: '', hand: '' },
    social: {
      handle: socials.instagram ? socials.instagram.handle : '',
      platforms: [
        { kind: 'instagram', url: socials.instagram?.url || '', followers: '' },
        { kind: 'tiktok', url: socials.tiktok?.url || '', followers: '' },
        { kind: 'twitch', url: '', followers: '' },
        { kind: 'youtube', url: socials.youtube?.url || '', followers: '' },
      ],
      videos: [], collabs: [], photos: [],
    },
  },
  contact: {
    photo: S.contact.photo,
    first: 'Audrey-Lillie',
    last: 'BING',
    title: S.contact.status.toUpperCase(),
    email: S.contact.email,
    phone: S.contact.phone,
    note: S.contact.note,
  },
};

// Photos were copied into public/assets/img under audrey-* names.
content.about.photo = 'assets/img/audrey-about.jpg';
content.contact.photo = 'assets/img/audrey-contact.jpg';

const out = sanitizeContent(content);
writeFileSync(new URL('./content.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
writeFileSync(new URL('../public/data/content.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log('wrote seed/content.json and public/data/content.json');
