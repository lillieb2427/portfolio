// Storage layer shared by every API route.
//
// Two backends, picked from the environment:
//   - "blob":  Vercel Blob (BLOB_READ_WRITE_TOKEN set). Used in production.
//   - "local": files under ./.data (local development with `npm run dev`).
// On Vercel without a Blob token nothing can be saved: status() says so and
// the admin shows a warning instead of pretending to save.
//
// Documents (content, maintenance flag) are stored as versioned JSON files:
// every save writes a new immutable file and reads pick the newest one. That
// sidesteps CDN caching of overwritten blobs and keeps a short history.

import { promises as fs } from 'node:fs';
import path from 'node:path';

const LOCAL_ROOT = path.resolve(process.env.DATA_DIR || '.data');
const KEEP_VERSIONS = 20;

export function mode() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return 'blob';
  if (process.env.VERCEL) return 'none';
  return 'local';
}

export function status() {
  const m = mode();
  if (m === 'blob') return { canSave: true, mode: m, detail: '' };
  if (m === 'local') return { canSave: true, mode: m, detail: '' };
  return {
    canSave: false,
    mode: m,
    detail: 'no Blob store is connected to this project (BLOB_READ_WRITE_TOKEN is missing). Create a Blob store in Vercel Storage, connect it to the project, then redeploy.',
  };
}

let blobLib = null;
async function blob() {
  if (!blobLib) blobLib = await import('@vercel/blob');
  return blobLib;
}

function assertName(name) {
  if (!/^[a-z0-9-]{1,40}$/.test(name)) throw new Error('bad document name');
}

/* ---------- Versioned JSON documents ---------- */

// Returns the newest saved version of a document, or null if it was never saved.
// Throws if the storage can't be read (callers must not treat that as "empty").
export async function getDoc(name) {
  assertName(name);
  const m = mode();
  if (m === 'local') {
    try {
      return JSON.parse(await fs.readFile(path.join(LOCAL_ROOT, 'docs', name + '.json'), 'utf8'));
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }
  if (m === 'none') return null;
  const { list } = await blob();
  const { blobs } = await list({ prefix: 'docs/' + name + '/', limit: 1000 });
  if (!blobs.length) return null;
  blobs.sort((a, b) => String(b.pathname).localeCompare(String(a.pathname)));
  const r = await fetch(blobs[0].url, { cache: 'no-store' });
  if (!r.ok) throw new Error('could not read ' + name + ' (HTTP ' + r.status + ')');
  return r.json();
}

export async function putDoc(name, value) {
  assertName(name);
  const m = mode();
  const body = JSON.stringify(value);
  if (m === 'local') {
    const dir = path.join(LOCAL_ROOT, 'docs');
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, name + '.json');
    const tmp = file + '.' + process.pid + '.tmp';
    await fs.writeFile(tmp, body);
    await fs.rename(tmp, file);
    return;
  }
  if (m === 'none') throw new Error(status().detail);
  const { put, list, del } = await blob();
  // Zero-padded timestamp: lexical order == chronological order.
  const stamp = String(Date.now()).padStart(15, '0');
  await put('docs/' + name + '/' + stamp + '.json', body, {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: true,
    cacheControlMaxAge: 60 * 60 * 24 * 365,
  });
  // Prune old versions (best effort).
  try {
    const { blobs } = await list({ prefix: 'docs/' + name + '/', limit: 1000 });
    blobs.sort((a, b) => String(b.pathname).localeCompare(String(a.pathname)));
    const old = blobs.slice(KEEP_VERSIONS).map((b) => b.url);
    if (old.length) await del(old);
  } catch (e) { /* keeping a few extra versions is harmless */ }
}

/* ---------- Uploaded files (covers, fonts) ---------- */

// Saves a file and returns the URL the site should reference.
// folder: 'covers' | 'fonts'. Local files are served back by api/cover and api/font.
export async function putFile(folder, filename, buffer, contentType) {
  const m = mode();
  if (m === 'local') {
    const dir = path.join(LOCAL_ROOT, 'files', folder);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filename), buffer);
    return (folder === 'fonts' ? 'api/font' : 'api/cover') + '?f=' + encodeURIComponent(filename);
  }
  if (m === 'none') throw new Error(status().detail);
  const { put } = await blob();
  const res = await put(folder + '/' + filename, buffer, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60 * 60 * 24 * 365,
  });
  return res.url;
}

// Local mode only: reads back an uploaded file. Returns null if absent.
export async function readLocalFile(folder, filename) {
  if (mode() !== 'local') return null;
  if (!/^[a-z0-9][a-z0-9._-]{0,120}$/i.test(filename) || filename.includes('..')) return null;
  try {
    return await fs.readFile(path.join(LOCAL_ROOT, 'files', folder, filename));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

/* ---------- Small JSON file for local stats ---------- */

export async function readLocalJSON(name, fallback) {
  try {
    return JSON.parse(await fs.readFile(path.join(LOCAL_ROOT, name), 'utf8'));
  } catch (e) {
    return fallback;
  }
}

export async function writeLocalJSON(name, value) {
  await fs.mkdir(LOCAL_ROOT, { recursive: true });
  const file = path.join(LOCAL_ROOT, name);
  const tmp = file + '.' + process.pid + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(value));
  await fs.rename(tmp, file);
}
