// Request helpers shared by the API routes (work on Vercel and in server.js).

import crypto from 'node:crypto';

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  send(res, 405, { error: 'Method not allowed' });
}

// Vercel pre-parses JSON bodies into req.body; text/plain (sendBeacon) arrives
// as a string. Also handles a raw stream when nothing parsed it.
export async function readBody(req, limit = 6 * 1024 * 1024) {
  let b = req.body;
  if (b === undefined) {
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > limit) throw Object.assign(new Error('Request too large'), { status: 413 });
      chunks.push(c);
    }
    b = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.isBuffer(b)) b = b.toString('utf8');
  if (typeof b === 'string') {
    if (!b.trim()) return {};
    try { b = JSON.parse(b); } catch (e) { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
  }
  return b && typeof b === 'object' ? b : {};
}

export function query(req) {
  if (req.query) return req.query;
  const u = new URL(req.url, 'http://localhost');
  return Object.fromEntries(u.searchParams);
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function passwordConfigured() {
  return typeof process.env.ADMIN_PASSWORD === 'string' && process.env.ADMIN_PASSWORD.length > 0;
}

export function checkPassword(pw) {
  if (!passwordConfigured() || typeof pw !== 'string' || !pw) return false;
  return safeEqual(pw, process.env.ADMIN_PASSWORD);
}

export function isAdmin(req) {
  const h = req.headers['x-admin-password'];
  return checkPassword(Array.isArray(h) ? h[0] : h);
}

// Guard for admin-only routes. Returns true if the request may continue.
export async function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  await new Promise((r) => setTimeout(r, 400)); // slow down guessing
  send(res, 401, { error: passwordConfigured() ? 'Wrong password, sign in again' : 'ADMIN_PASSWORD is not set on the server' });
  return false;
}

// Wraps a handler so thrown errors become JSON responses.
export function route(fn) {
  return async function handler(req, res) {
    try {
      await fn(req, res);
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error(e);
      if (!res.headersSent) send(res, status, { error: e.message || 'Server error' });
    }
  };
}
