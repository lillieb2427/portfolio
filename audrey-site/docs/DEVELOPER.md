# Developer notes

Technical reference for this site. For setup and everyday use, see [README.md](../README.md).

| Page     | URL        | Admin tab |
|----------|------------|-----------|
| Home     | `/`        | —         |
| About me | `/about`   | About     |
| Design   | `/youtube` | Design    |
| Gallery  | `/shorts`  | Gallery   |
| Collabs  | `/brand`   | Collabs   |
| Contact badge (every page) | — | Contact |

The URLs keep their original names (`/youtube`, `/shorts`, `/brand`); only the labels changed.

## Run locally

```bash
npm install
cp .env.example .env     # then set ADMIN_PASSWORD
npm run dev              # http://localhost:3000, admin at /admin
npm test                 # API tests
```

Locally, everything the admin saves (content, uploaded images and fonts, stats) goes to `.data/`. Delete that folder to start over from the seed content.

## Deploy (Vercel)

1. Push this folder to a GitHub repo and import it in Vercel (Framework preset: **Other**; `vercel.json` already sets the output directory and clean URLs).
2. **Settings → Environment Variables**: add `ADMIN_PASSWORD`.
3. **Storage → Create → Blob**, connect it to the project. This sets `BLOB_READ_WRITE_TOKEN`. Content, images and fonts are stored there.
4. Optional, for the admin's Data tab: **Storage → Create → Upstash Redis** (Marketplace), connect it. This sets `KV_REST_API_URL` / `KV_REST_API_TOKEN`.
5. Redeploy, open `/admin`, log in, check everything and press **Save** once. Until the first save the site serves the seed content.

If the Blob store is missing, the admin shows a red "Can't save" bar instead of silently losing edits.

## How it fits together

```
public/           static site (HTML/CSS/JS), served as-is
  data/content.json   fallback content if the API is unreachable
api/              serverless functions (Vercel) — also run by server.js locally
  content.js      GET content (public) / POST save (admin, with 409 conflict check)
  auth.js         POST password check
  maintenance.js  POST toggle the maintenance screen (admin)
  cover.js        POST image upload (admin) / GET local file
  font.js         POST font upload (admin) / GET local file
  hit.js          POST anonymous page view / event beacon
  stats.js        GET audience report (admin)
  status.js       GET can-the-admin-save + stats configured
  thumb.js        GET Instagram preview image (server-side og:image)
lib/              storage (Blob or local), validation, stats, helpers
seed/content.json initial content (built from Audrey's previous site)
server.js         local dev server
```

- **Auth:** the admin sends the password in an `x-admin-password` header on each request (kept in `sessionStorage` for the tab). One shared password, set by `ADMIN_PASSWORD`.
- **Content** is saved as versioned JSON in Blob (`docs/content/…`, last 20 kept), so an older version can be restored from the Vercel Blob browser if needed. Every save is cleaned by `lib/sanitize.js`: unknown fields dropped, lengths capped, colours and URLs validated.
- **Stats** are anonymous and cookie-free: a daily-salted hash of IP + browser counts unique visitors; no raw IPs are stored. Visitors with Do Not Track on aren't counted.
- **Uploads:** images are resized in the browser (1600 px, WebP) before upload, max 4 MB. Fonts max 3 MB (Vercel's 4.5 MB request limit, after base64).

## Rebuilding the seed

`seed/build-seed.mjs` converts the old site's `content.js` into this format:

```bash
node seed/build-seed.mjs ~/Downloads/Archive/assets/data/content.js
```

It overwrites `seed/content.json` and `public/data/content.json`. Once the site is live, edit content in the admin instead.
