# audrey-lillie — portfolio website

Your portfolio site, plus a private admin page where you edit everything yourself — text, photos, projects, colours and fonts — without touching any code.

| Page     | What's on it |
|----------|--------------|
| Home     | Your name and the four stars |
| About me | The cardboard folder: photo, bio, experience, education, hobbies, content creation |
| Design   | Your projects, as coloured file dividers |
| Gallery  | Vertical clips on a globe you can spin |
| Collabs  | Brands and collabs, as books on a shelf |
| Contact  | The badge that pops up from the menu on any page |

---

## 1. Put it online (once, about 15 minutes)

You need a free [Vercel](https://vercel.com) account and a free [GitHub](https://github.com) account.

1. **Upload the code.** On GitHub, create a new repository and upload this folder's contents to it.
2. **Import it into Vercel.** In Vercel: *Add New → Project*, pick that repository, and press **Deploy**. Leave every setting as it is. When it finishes you'll have a live link like `audrey-lillie.vercel.app`.
3. **Choose your admin password.** In Vercel, open the project → *Settings* → *Environment Variables*. Add:
   - Name: `ADMIN_PASSWORD`
   - Value: the password you want for your admin page
4. **Turn on storage** (this is where your text and photos are kept). In Vercel: *Storage* → *Create Database* → **Blob** → connect it to this project.
5. **Optional — visitor stats.** Same place: *Storage* → *Create Database* → **Upstash Redis** → connect it. This fills the "Data" tab in your admin. Skip it if you don't want stats.
6. **Redeploy.** Go to *Deployments*, open the latest one, and choose *Redeploy*. This is what makes steps 3–5 take effect.

Your own domain (like `audreylillie.com`) can be added later under *Settings → Domains*.

## 2. Edit your site

Go to **your-site-link/admin**, enter your password, and you're in.

- **Tabs across the top:** Design, Gallery, Collabs, About, Contact, Fonts, Data — one per part of the site.
- **Press Save** (bottom right) when you're done. Nothing goes live until you do.
- **Photos:** use the *Choose File* buttons. Pictures are shrunk automatically, so phone photos are fine.
- **Videos:** paste a link from YouTube, TikTok, Instagram or Vimeo. The preview picture is fetched for you.
- **Site live / Maintenance** (top right): flip it to hide the site behind a "back very soon" screen while you work. Your admin keeps working, and you can still preview the site.
- **Export JSON** saves a backup of all your text to your computer. Worth doing now and then.

### What's still placeholder

The Design, Gallery and Collabs pages are filled with sample entries ("PROJECT ONE", "Reel one", "CLIENT A", "SAMPLE") carried over from your old site. Replace them with your real work in the admin. Also worth a look:

- the sticky note "How I ♥ to work" on the About page is empty — write a couple of sentences in About → *Sticky note text*;
- your YouTube link points at `@aureylils` — check the spelling in About → *Content creation*;
- "New brunswick" in your Education card could be "New Brunswick".

## 3. Run it on your own computer (optional)

Only needed if you want to try things offline. Requires [Node.js](https://nodejs.org) (version 20 or newer).

```bash
npm install          # once
cp .env.example .env # once — then open .env and set your password
npm run dev
```

The site is then at **http://localhost:3000** and the admin at **http://localhost:3000/admin**. Anything you save here stays on your computer, in a `.data` folder; it doesn't touch the live site.

---

## Good to know

- **One password** protects the admin. Anyone with it can edit the site, so keep it to yourself. To change it, edit `ADMIN_PASSWORD` in Vercel and redeploy.
- **Your content is saved with a history** — the last 20 versions are kept, so a mistake can be undone.
- **Visitor stats are anonymous:** no cookies, no names, no IP addresses stored. Visitors who ask not to be tracked aren't counted.
- **Dark mode** follows the sun/moon button in the corner of the site.

Technical details are in [docs/DEVELOPER.md](docs/DEVELOPER.md).
