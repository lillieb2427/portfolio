/* About me page — the kraft folder.
   A clipped photo stack on the left, four stacked tabbed cards on the right
   (the red one holds the "content creation" hub: handle, platforms, videos,
   photos, collabs), a post-it at the bottom: everything is drawn here
   (createElement + textContent; only static SVG templates go through
   innerHTML, never user-entered values). */
(function () {
  'use strict';

  // The four cards are fixed: keys, visual tab order, i18n labels.
  var KEYS = ['desc', 'cv', 'edu', 'hobbies', 'content'];
  // "2024 — present — Role · Client" or "2019 — Master": dated line in two columns.
  var DATED = /^(\d{4}(?:\s*[—–-]\s*(?:\d{4}|present|now|auj\.?|aujourd'hui))?)\s*[—–-]\s+(.+)$/i;
  // "- text" or "• text"; a lone dash (empty bullet) is matched too, so it is
  // skipped rather than rendered as a "-" paragraph.
  var BULLET = /^[-•](?:\s+|$)/;
  // Safety net if animationend never fires (tab sent to the background).
  var LIFT_FALLBACK_MS = 600;

  var wrap = document.getElementById('folder');
  var order = KEYS.slice();     // index = depth; order[0] is in front
  var cards = {};
  var tabs = {};
  var bodies = {};
  var howText = null;
  var about = null;             // merged content on display, re-read on language change
  var labelEls = {};            // card key -> { title, tab } (card label)
  var textEls = {};             // card key -> { box, body, hub } (card text)
  var hubTiles = [];            // hub video / collab tiles: { el, thumb, t }
  var endLift = null;           // ends the running "card pulled out" animation
  var reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  // Same condition as the "vertical sheet" @media block in about.css (keep them
  // in sync): in this mode cards don't slide and only one is shown. Width
  // only: a wide but short window (MacBook + Safari bar, ≈ 1280 × 620) keeps
  // the desktop layout and scrolls.
  var phoneQuery = window.matchMedia ? matchMedia('(max-width: 1000px)') : null;
  function isPhone() { return !!(phoneQuery && phoneQuery.matches); }

  // Platforms of the "content creation" hub, in sketch order (fixed).
  var PLATFORMS = ['instagram', 'tiktok', 'twitch', 'youtube'];
  var PLATFORM_NAMES = { instagram: 'Instagram', tiktok: 'TikTok', twitch: 'Twitch', youtube: 'YouTube' };
  var MAX_PHOTOS = 30;          // photos in the stack (same caps as the API)
  var MAX_TILES = 40;           // hub videos, collabs, photos
  // Safety net if animationend never fires (print sent to the back).
  var PRINT_FALLBACK_MS = 650;

  /* ---------- Data ---------- */
  function str(v) { return typeof v === 'string' ? v : ''; }
  function list(v) { return Array.isArray(v) ? v : []; }
  function obj(v) { return v && typeof v === 'object' ? v : {}; }
  // Hub video tiles: without a link there's nothing to open — the tile is skipped.
  function tiles(v) {
    return list(v).map(function (t) { t = obj(t); return { url: str(t.url), cover: str(t.cover), title: str(t.title), title_en: str(t.title_en) }; })
      .filter(function (t) { return t.url; }).slice(0, MAX_TILES);
  }
  // Completes a partial `about` object (older content without this key, a
  // missing field): the page never reads an absent property. English twins
  // ("_en", read via Site.tr) are kept.
  function merge(a) {
    a = obj(a);
    var out = { cards: {} };
    ['photo', 'name', 'title', 'stamp', 'note', 'how'].forEach(function (k) { out[k] = str(a[k]); });
    ['title', 'stamp', 'note', 'how'].forEach(function (k) { out[k + '_en'] = str(a[k + '_en']); });
    KEYS.forEach(function (k) {
      var c = obj(a.cards && a.cards[k]);
      out.cards[k] = { label: str(c.label), text: str(c.text), label_en: str(c.label_en), text_en: str(c.text_en) };
    });
    // Photo stack (`photo` stays first, see build).
    out.photos = list(a.photos).filter(function (u) { return typeof u === 'string' && u; }).slice(0, MAX_PHOTOS);
    // Folder fonts: '' = the stylesheet's default font.
    var f = obj(a.fonts);
    out.fonts = { type: str(f.type), body: str(f.body), hand: str(f.hand) };
    // "Content creation" hub: four fixed platforms, always present.
    var s = obj(a.social);
    var given = list(s.platforms);
    out.social = {
      handle: str(s.handle),
      platforms: PLATFORMS.map(function (kind) {
        var p = {};
        for (var i = 0; i < given.length; i++) if (obj(given[i]).kind === kind) { p = obj(given[i]); break; }
        return { kind: kind, url: str(p.url), followers: str(p.followers) };
      }),
      videos: tiles(s.videos),
      collabs: tiles(s.collabs),
      photos: list(s.photos).map(function (p) { p = obj(p); return { img: str(p.img), link: str(p.link) }; })
        .filter(function (p) { return p.img; }).slice(0, MAX_TILES),
    };
    return out;
  }

  /* ---------- SVG templates (static) ---------- */
  // Office clips from the reference board: colored sheet-metal bulldog clips
  // and a binder clip with chrome arms. The metal uses currentColor — each
  // clip's color is set in CSS (color); relief comes from translucent
  // gradients layered on top.
  function layer(fill, shapes) { return '<g fill="' + fill + '">' + shapes + '</g>'; }
  // Bulldog, viewBox 0 0 96 72: two spring levers, flat tab with an eyelet
  // (real hole, fill-rule evenodd), folded face, spring roll.
  var BD_LEVERS = '<rect x="11" y="22" width="17" height="16" rx="2.5" transform="rotate(-14 19.5 30)"/>' +
    '<rect x="68" y="22" width="17" height="16" rx="2.5" transform="rotate(14 76.5 30)"/>';
  var BD_TAB_D = 'M34 44V17a14 14 0 0 1 28 0v27zM43.5 17a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0z';
  var BD_TAB = '<path fill-rule="evenodd" d="' + BD_TAB_D + '"/>';
  var BD_FACE = '<rect x="4" y="40" width="88" height="28" rx="3"/>';
  var BD_ROLL = '<rect x="4" y="33" width="88" height="11" rx="5"/>';
  function bulldog(id, tabDecor, faceDecor) {
    return '<symbol id="' + id + '" viewBox="0 0 96 72" overflow="visible">' +
      layer('currentColor', BD_LEVERS) + layer('url(#ab-shade)', BD_LEVERS) +
      '<g fill="none" stroke="rgba(0,0,0,.28)">' + BD_LEVERS + '</g>' +
      layer('currentColor', BD_TAB) + (tabDecor || '') + layer('url(#ab-shade)', BD_TAB) +
      '<path fill="none" stroke="rgba(0,0,0,.3)" d="' + BD_TAB_D + '"/>' +
      layer('currentColor', BD_FACE) + (faceDecor || '') + layer('url(#ab-shade)', BD_FACE) +
      '<rect x="4.5" y="40.5" width="87" height="27" rx="3" fill="none" stroke="rgba(0,0,0,.3)"/>' +
      layer('currentColor', BD_ROLL) + layer('url(#ab-roll)', BD_ROLL) +
      '<rect x="4.5" y="33.5" width="87" height="10" rx="5" fill="none" stroke="rgba(0,0,0,.3)"/>' +
      '<path d="M5 44.5h86" stroke="rgba(0,0,0,.28)"/>' +                                    // fold line
      '<rect x="9" y="46" width="78" height="1.6" rx=".8" fill="#fff" fill-opacity=".5"/>' +  // thin highlight
      '</symbol>';
  }
  var DOTS_TAB = layer('url(#ab-dots)', BD_TAB);
  var DOTS_FACE = layer('url(#ab-dots)', BD_FACE);
  // Small white logo stamped in the middle of the face (oval + two bars).
  var LOGO = '<g fill="#fff" fill-opacity=".92"><ellipse cx="48" cy="54.5" rx="14" ry="6.5" fill="none" stroke="#fff" stroke-opacity=".92" stroke-width="1.5"/>' +
    '<rect x="40" y="52" width="16" height="2.2" rx="1.1"/><rect x="43" y="55.8" width="10" height="1.5" rx=".75"/></g>';
  // Binder clip, viewBox 0 0 72 72: two raised chrome wire arms, flat back,
  // face bevelled down to the mouth.
  var BC_ARMS_D = 'M18 30V13a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v17M38 30V13a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v17';
  var BC_FACE = '<path d="M8 36h56l-9 28H17z"/>';
  var BC_BACK = '<rect x="8" y="27" width="56" height="10" rx="2"/>';
  var BINDER = '<symbol id="ab-binder" viewBox="0 0 72 72" overflow="visible">' +
    '<path d="' + BC_ARMS_D + '" fill="none" stroke="rgba(0,0,0,.38)" stroke-width="4" stroke-linecap="round"/>' +   // dark wire outline
    '<path d="' + BC_ARMS_D + '" fill="none" stroke="url(#ab-chrome)" stroke-width="2.8" stroke-linecap="round"/>' +
    '<path d="M18.9 28V13a5.1 5.1 0 0 1 5.1-5.1h4M38.9 28V13a5.1 5.1 0 0 1 5.1-5.1h4" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width=".8" stroke-linecap="round"/>' +
    layer('currentColor', BC_FACE) + layer('url(#ab-shade)', BC_FACE) +
    layer('currentColor', BC_BACK) + layer('url(#ab-roll)', BC_BACK) +
    '<path d="M17.5 64h37" stroke="rgba(0,0,0,.5)" stroke-width="2.4" stroke-linecap="round"/>' +
    '<path d="M8.5 27.5h55v9l-9 27.5H17.5l-9-27.5z" fill="none" stroke="rgba(0,0,0,.32)"/>' +
    '</symbol>';
  // Platform logos (simple monochrome glyphs: currentColor), for the hub chips
  // and the tile badge.
  var PLATFORM_ICONS =
    '<symbol id="ab-instagram" viewBox="0 0 24 24" fill="currentColor"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.6" cy="6.4" r="1.4"/></symbol>' +
    '<symbol id="ab-tiktok" viewBox="0 0 24 24" fill="currentColor"><path d="M12.53.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></symbol>' +
    '<symbol id="ab-twitch" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/></symbol>' +
    '<symbol id="ab-youtube" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></symbol>';
  var DEFS = '<svg class="about-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>' +
    '<linearGradient id="ab-shade" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".5" stop-color="#fff" stop-opacity=".06"/>' +
    '<stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient>' +
    '<linearGradient id="ab-roll" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#000" stop-opacity=".18"/><stop offset=".3" stop-color="#fff" stop-opacity=".55"/>' +
    '<stop offset="1" stop-color="#000" stop-opacity=".42"/></linearGradient>' +
    '<linearGradient id="ab-chrome" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#f4f6f8"/><stop offset=".5" stop-color="#9ba2a9"/><stop offset="1" stop-color="#e2e6e9"/></linearGradient>' +
    '<pattern id="ab-dots" width="12" height="12" patternUnits="userSpaceOnUse">' +
    '<circle cx="3" cy="3" r="2.1" fill="#fff" fill-opacity=".9"/><circle cx="9" cy="9" r="2.1" fill="#fff" fill-opacity=".9"/></pattern>' +
    bulldog('ab-bulldog') + bulldog('ab-bulldog-dots', DOTS_TAB, DOTS_FACE) + bulldog('ab-bulldog-logo', '', LOGO) + BINDER +
    '<symbol id="ab-heart" viewBox="0 0 64 60" overflow="visible"><path d="M32 56 C10 40 2 30 2 18 A12 12 0 0 1 32 12 A12 12 0 0 1 62 18 C62 30 54 40 32 56Z"/></symbol>' +
    '<symbol id="ab-star" viewBox="0 0 64 64" overflow="visible"><path d="M32 3 L40.5 23 L62 25 L45.5 39 L50.5 61 L32 49 L13.5 61 L18.5 39 L2 25 L23.5 23Z"/></symbol>' +
    PLATFORM_ICONS +
    '</defs></svg>';

  function fromHtml(html) {
    var d = document.createElement('div');
    d.innerHTML = html;
    return d.firstElementChild;
  }
  // Symbol instance: <svg class="…"><use href="#…"></use></svg>.
  function useSvg(cls, id, viewBox, extra) {
    return fromHtml('<svg class="' + cls + '" viewBox="' + viewBox + '" aria-hidden="true" focusable="false"' +
      (extra || '') + '><use href="#' + id + '"></use></svg>');
  }
  function make(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  // Translated label: Site.applyLang() re-translates it on its own.
  function i18n(tag, key) {
    var n = make(tag, null, Site.t(key));
    n.setAttribute('data-i18n', key);
    return n;
  }

  /* ---------- Plain text → paragraphs, bullets, dated lines ---------- */
  function renderText(text, box) {
    var lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    var cur = null;             // current <p> or <ul>
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/\s+$/, '');
      if (!line.trim()) { cur = null; continue; }
      var m;
      if (BULLET.test(line)) {
        var item = line.replace(BULLET, '');
        if (!item) continue;                     // empty bullet: nothing to show
        if (!cur || cur.tagName !== 'UL') { cur = make('ul'); box.appendChild(cur); }
        cur.appendChild(make('li', null, item));
      } else if ((m = line.match(DATED))) {
        cur = null;
        var row = make('div', 'dated');
        row.appendChild(make('span', 'dated-when', m[1]));
        row.appendChild(make('span', 'dated-what', m[2]));
        box.appendChild(row);
      } else {
        if (!cur || cur.tagName !== 'P') { cur = make('p'); box.appendChild(cur); }
        else cur.appendChild(make('br'));
        cur.appendChild(document.createTextNode(line));
      }
    }
    if (!box.firstChild) {
      var empty = i18n('p', 'about.empty');
      empty.className = 'card-empty';
      box.appendChild(empty);
    }
  }

  /* ---------- Print stack in the perforated frame ---------- */
  // One photo: a single print, as before. Several: the first in front, two
  // more visible behind (offset, slightly rotated); click, Enter/Space or a
  // swipe sends the top print to the back. Returns the pagination dots (to
  // place under the frame) or null.
  function buildPhotos(frame, photos, name) {
    var stack = make('div', 'photo-stack');
    frame.appendChild(stack);
    var prints = [];
    var dots = null;
    var cur = 0;
    var busy = false;
    function showEmpty() {
      stack.textContent = '';
      stack.className = 'photo-stack';
      stack.removeAttribute('tabindex');
      stack.removeAttribute('role');
      stack.removeAttribute('aria-label');
      var print = make('div', 'photo-print pos-0');
      var empty = make('div', 'photo-empty');
      empty.appendChild(i18n('span', 'about.nophoto'));
      print.appendChild(empty);
      stack.appendChild(print);
      if (dots) { dots.remove(); dots = null; }
    }
    function place() {
      var n = prints.length;
      prints.forEach(function (p, i) {
        var pos = (i - cur + n) % n;
        p.className = 'photo-print ' + (pos < 3 ? 'pos-' + pos : 'pos-back');
        p.setAttribute('aria-hidden', pos ? 'true' : 'false');
      });
      if (dots) {
        for (var k = 0; k < dots.children.length; k++) {
          dots.children[k].classList.toggle('is-on', k === cur);
          dots.children[k].setAttribute('aria-current', k === cur ? 'true' : 'false');
        }
      }
      stack.setAttribute('aria-label', name + ' · ' + (cur + 1) + ' / ' + n);
    }
    function goTo(i) {
      var n = prints.length;
      if (n < 2 || busy || i === cur) return;
      var leaving = prints[cur];
      var forward = i === (cur + 1) % n;
      cur = i;
      place();
      // Only moving to the next one plays "print goes to the back"; a jump via
      // the dots just uses the position transition.
      if (!forward || reduceMotion) return;
      busy = true;
      leaving.classList.add('leaving');
      var done = false;
      var timer = null;
      function finish() {
        if (done) return;
        done = true;
        clearTimeout(timer);
        leaving.removeEventListener('animationend', onEnd);
        leaving.classList.remove('leaving');
        busy = false;
      }
      function onEnd(e) { if (e.target === leaving && e.animationName === 'abPrintOut') finish(); }
      leaving.addEventListener('animationend', onEnd);
      timer = setTimeout(finish, PRINT_FALLBACK_MS);
    }
    function next() { goTo((cur + 1) % prints.length); }
    // Image not found: the print leaves the stack (no broken frame).
    function drop(print) {
      var i = prints.indexOf(print);
      if (i === -1) return;
      prints.splice(i, 1);
      print.remove();
      if (dots && dots.children[i]) dots.removeChild(dots.children[i]);
      if (!prints.length) { showEmpty(); return; }
      if (i < cur) cur--;
      if (cur >= prints.length) cur = 0;
      if (prints.length < 2 && dots) { dots.remove(); dots = null; }
      place();
    }
    if (!photos.length) { showEmpty(); return null; }
    // All images are in the DOM from the start: preloaded.
    photos.forEach(function (u) {
      var print = make('div', 'photo-print');
      var img = make('img', 'photo');
      img.alt = name;
      img.decoding = 'async';
      img.draggable = false;
      img.onerror = function () { drop(print); };
      img.src = u;
      print.appendChild(img);
      stack.appendChild(print);
      prints.push(print);
    });
    if (photos.length > 1) {
      stack.className = 'photo-stack is-pile';
      stack.tabIndex = 0;
      stack.setAttribute('role', 'button');
      dots = make('div', 'photo-dots');
      photos.forEach(function (_, i) {
        var b = make('button', 'dot');
        b.type = 'button';
        b.title = String(i + 1);
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          goTo(Array.prototype.indexOf.call(dots.children, b));
        });
        dots.appendChild(b);
      });
      var sx = 0, sy = 0, swiped = 0;
      stack.addEventListener('click', function () { if (Date.now() - swiped > 400) next(); });
      stack.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); }
      });
      // Finger swipe (touch-action: pan-y in CSS): the click that follows a
      // swipe is ignored so it doesn't advance twice.
      stack.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; }, { passive: true });
      stack.addEventListener('pointerup', function (e) {
        if (e.pointerType === 'mouse') return;
        var dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) { swiped = Date.now(); next(); }
      }, { passive: true });
    }
    place();
    return dots;
  }

  /* ---------- "Content creation" hub (red card) ---------- */
  // Platform of a link, for the tile badge: Twitch isn't a playable video
  // (Site.parseVideo ignores it), so it is detected here.
  function platformOf(url) {
    if (/twitch\.tv\//i.test(url || '')) return 'twitch';
    var info = Site.parseVideo(url);
    return info && PLATFORMS.indexOf(info.type) !== -1 ? info.type : '';
  }
  // External link (new tab); without a URL, a plain container.
  function extLink(tag, url) {
    var n = make(url ? 'a' : tag);
    if (url) { n.href = url; n.target = '_blank'; n.rel = 'noopener'; }
    return n;
  }
  // Video tile: thumbnail (cover image, else the platform's automatic
  // thumbnail, else a colored title card), platform badge, title revealed on
  // hover.
  function tileNode(t, i, ratioCls, a, content) {
    var bg = Site.PALETTE_MAIN[i % Site.PALETTE_MAIN.length];
    var tile = extLink('div', t.url);
    tile.className = 'hub-tile ' + ratioCls;
    var thumb = Site.thumbNode({ title: t.title, title_en: t.title_en, url: t.url, cover: t.cover, bg: bg, text: Site.contrast(bg), font: a.fonts.type || 'Special Elite' }, content);
    if (t.title || t.title_en) thumb.appendChild(make('div', 'tile-label'));
    var kind = platformOf(t.url);
    if (kind) thumb.appendChild(useSvg('hub-badge', 'ab-' + kind, '0 0 24 24'));
    tile.appendChild(thumb);
    var ref = { el: tile, thumb: thumb, t: t };
    hubTiles.push(ref);
    titleTile(ref);
    return tile;
  }
  // Tile title in the site language: aria-label, hover label and colored card
  // (Site.thumbNode set it initially).
  function titleTile(ref) {
    var title = Site.tr(ref.t, 'title');
    if (title) ref.el.setAttribute('aria-label', title); else ref.el.removeAttribute('aria-label');
    var label = ref.thumb.querySelector('.tile-label');
    if (label) label.textContent = title;
    var card = ref.thumb.querySelector('.thumb-card');
    if (card) {
      card.textContent = title;
      card.style.fontSize = Site.titleSize(title) + 'cqw';
    }
  }
  function hubSection(key, nodes) {
    if (!nodes.length) return null;
    var sec = make('section', 'hub-section hub-' + key);
    sec.appendChild(i18n('h3', 'about.' + key));
    var grid = make('div', 'hub-grid');
    nodes.forEach(function (n) { grid.appendChild(n); });
    sec.appendChild(grid);
    return sec;
  }
  // The whole hub, or null if nothing is filled in (the card stays as before).
  function buildHub(a, content) {
    var s = a.social;
    var hub = make('div', 'hub');
    var head = make('header', 'hub-head');
    if (s.handle) head.appendChild(make('p', 'hub-handle', s.handle));
    var chips = make('div', 'hub-platforms');
    s.platforms.forEach(function (p) {
      if (!p.url && !p.followers) return;
      var chip = extLink('span', p.url);
      chip.className = 'hub-chip hub-chip-' + p.kind;
      chip.title = PLATFORM_NAMES[p.kind];
      chip.appendChild(useSvg('hub-icon', 'ab-' + p.kind, '0 0 24 24'));
      if (p.followers) {
        var count = make('span', 'hub-count');
        count.appendChild(make('b', null, p.followers));
        count.appendChild(i18n('span', 'about.followers'));
        chip.appendChild(count);
      }
      chips.appendChild(chip);
    });
    if (chips.firstChild) head.appendChild(chips);
    if (head.firstChild) hub.appendChild(head);
    var sections = [
      hubSection('videos', s.videos.map(function (t, i) { return tileNode(t, i, 'tile-9x16', a, content); })),
      hubSection('photos', s.photos.map(function (p) {
        var n = extLink('div', p.link);
        n.className = 'hub-photo';
        var img = make('img');
        img.alt = '';
        img.decoding = 'async';
        img.loading = 'lazy';
        img.onerror = function () { n.classList.add('is-broken'); };
        img.src = p.img;
        n.appendChild(img);
        return n;
      })),
      hubSection('collab', s.collabs.map(function (t, i) { return tileNode(t, i + 3, 'tile-16x9', a, content); })),
    ];
    sections.forEach(function (sec) { if (sec) hub.appendChild(sec); });
    return hub.firstChild ? hub : null;
  }

  /* ---------- Measure: bottom fade when text overflows ---------- */
  function overflowing(el) {
    return el.scrollTop + el.clientHeight < el.scrollHeight - 2;
  }
  /* ---------- Enlarged post-it ---------- */
  // The large post-it is a copy (title + full text) placed in a fixed layer:
  // the small one stays put, nothing moves in the folder.
  var howOpen = null;   // { ov, card, body, onKey }
  function openHow(card) {
    if (howOpen) return;
    var text = Site.tr(about, 'how');
    var ov = make('div', 'how-overlay');
    var back = make('div', 'how-backdrop');
    var big = make('article', 'how-card how-big');
    big.setAttribute('role', 'dialog');
    big.setAttribute('aria-modal', 'true');
    big.appendChild(make('span', 'tape'));
    var title = make('h3', 'how-title');
    title.appendChild(i18n('span', 'about.how.a'));
    title.appendChild(document.createTextNode(' '));
    title.appendChild(useSvg('how-heart', 'ab-heart', '0 0 64 60'));
    title.appendChild(document.createTextNode(' '));
    title.appendChild(i18n('span', 'about.how.b'));
    big.appendChild(title);
    var body = make('div', 'how-text how-full');
    renderText(text, body);
    big.appendChild(body);
    big.appendChild(useSvg('sticker sticker-heart', 'ab-heart', '0 0 64 60'));
    big.appendChild(useSvg('sticker sticker-star', 'ab-star', '0 0 64 64'));
    var close = make('button', 'how-close');
    close.type = 'button';
    close.textContent = '✕';
    close.setAttribute('data-i18n-label', 'divider.close');
    close.setAttribute('aria-label', Site.t('divider.close'));
    close.title = Site.t('divider.close');
    big.appendChild(close);
    ov.appendChild(back);
    ov.appendChild(big);
    // Inside .about-root: the folder tokens (--postit, --hand, --ink-paper…)
    // are defined there; outside it the post-it would be grey and unstyled.
    (document.querySelector('.about-root') || document.body).appendChild(ov);
    function onKey(e) { if (e.key === 'Escape') closeHow(); }
    back.addEventListener('click', closeHow);
    close.addEventListener('click', closeHow);
    document.addEventListener('keydown', onKey);
    howOpen = { ov: ov, card: card, body: body, onKey: onKey };
    card.setAttribute('aria-expanded', 'true');
    // Two steps: the layer is painted, then the enter transition starts.
    requestAnimationFrame(function () { ov.classList.add('in'); close.focus(); });
  }
  function closeHow() {
    if (!howOpen) return;
    var h = howOpen;
    howOpen = null;
    document.removeEventListener('keydown', h.onKey);
    h.card.setAttribute('aria-expanded', 'false');
    h.ov.classList.remove('in');
    Site.afterTransition(h.ov, 'opacity', function () {
      if (h.ov.parentNode) h.ov.parentNode.removeChild(h.ov);
    }, 400);
    try { h.card.focus(); } catch (e) {}
  }

  /* ---------- Photo frame size (desktop) ---------- */
  // The largest square that fits the left column: bounded by its width (10 px
  // right margin) and by the folder height, so the post-it (150 px, placed
  // under the note when there is one, else 26 px under the frame) never drops
  // more than 30 px below the folder's inner edge (it stays in its margin, as
  // at 1440 × 900). On a short window the frame follows the height; without a
  // note it takes over the note's space. Never under 266 px; on phones, CSS
  // decides alone.
  var FRAME_MIN = 266, FRAME_MAX = 440, HOW_H = 150, HANG = 30, FRAME_TOP = 36;
  function fitFrame() {
    var root = wrap.closest('.about-root') || document.body;
    var folderEl = wrap.querySelector('.folder'), left = wrap.querySelector('.col-left'), frame = wrap.querySelector('.photo-frame');
    if (!folderEl || !left || !frame || wrap.hidden || isPhone()) {
      root.style.removeProperty('--frame-h');
      root.style.removeProperty('--how-gap');
      return;
    }
    var fcs = getComputedStyle(folderEl);
    var innerH = folderEl.clientHeight - (parseFloat(fcs.paddingTop) || 0) - (parseFloat(fcs.paddingBottom) || 0);
    var frameLeft = parseFloat(getComputedStyle(frame).left) || 20;
    // The post-it sits in the folder (origin: its inner top edge), the frame
    // and note in the column (colTop from that edge): everything is converted
    // to folder coordinates.
    var colTop = left.offsetTop || 0;
    var note = left.querySelector('.note');
    var howGap = colTop + FRAME_TOP + (note ? note.offsetHeight + 12 : 26);
    var byW = left.clientWidth - frameLeft - 10;
    var byH = colTop + innerH + HANG - howGap - HOW_H;
    var size = Math.round(Math.max(FRAME_MIN, Math.min(FRAME_MAX, byW, byH)));
    root.style.setProperty('--frame-h', size + 'px');
    root.style.setProperty('--how-gap', howGap + 'px');
  }

  function measureScroll() {
    var body = bodies[order[0]];
    if (body) body.classList.toggle('scrolls', overflowing(body));
    if (howText) howText.classList.toggle('scrolls', overflowing(howText));
  }

  /* ---------- Bilingual texts ---------- */
  // Card label (title and tab): the custom one in the site language if set,
  // else translated automatically (data-i18n).
  function setLabel(el, c, key) {
    var lab = Site.tr(c, 'label');
    el.textContent = '';
    if (lab) el.textContent = lab;
    else el.appendChild(i18n('span', 'about.tab.' + key));
  }
  // Card text in the site language. The "content creation" card without text
  // keeps only its hub: the text block is removed from the DOM.
  function setCardText(key) {
    var r = textEls[key];
    if (!r) return;
    var c = about.cards[key];
    var s = Site.tr(c, 'text');
    r.box.textContent = '';
    if (s.trim() || !r.hub) renderText(s, r.box);
    var inDom = r.box.parentNode === r.body;
    if (r.box.firstChild && !inDom) r.body.insertBefore(r.box, r.hub || null);
    else if (!r.box.firstChild && inDom) r.body.removeChild(r.box);
  }
  // Language change: title, stamp, note, card labels and texts, post-it (small
  // and enlarged), hub tile titles, all rewritten in place — the front card,
  // photo stack and open post-it stay as they are.
  function retranslate() {
    if (!about) return;
    var q = function (sel) { return wrap.querySelector(sel); };
    var n;
    if ((n = q('.label-title'))) n.textContent = Site.tr(about, 'title');
    if ((n = q('.stamp'))) n.textContent = Site.tr(about, 'stamp');
    if ((n = q('.col-left > .note'))) n.textContent = Site.tr(about, 'note');
    KEYS.forEach(function (key) {
      if (labelEls[key]) {
        setLabel(labelEls[key].title, about.cards[key], key);
        setLabel(labelEls[key].tab, about.cards[key], key);
      }
      setCardText(key);
    });
    if (howText) { howText.textContent = ''; renderText(Site.tr(about, 'how'), howText); }
    if (howOpen) { howOpen.body.textContent = ''; renderText(Site.tr(about, 'how'), howOpen.body); }
    hubTiles.forEach(titleTile);
    measureScroll();
  }
  document.addEventListener('cc:lang', retranslate);

  /* ---------- Depth ---------- */
  function applyDepth() {
    for (var d = 0; d < order.length; d++) {
      var key = order[d];
      var card = cards[key];
      var tab = tabs[key];
      var front = d === 0;
      card.setAttribute('data-depth', String(d));
      tab.setAttribute('data-depth', String(d));
      card.classList.toggle('is-front', front);
      // A back card only shows its paper edge: its body is hidden from screen
      // readers and inert (the edge itself stays clickable).
      if (front) { card.removeAttribute('aria-hidden'); bodies[key].removeAttribute('inert'); }
      else { card.setAttribute('aria-hidden', 'true'); bodies[key].setAttribute('inert', ''); }
      tab.setAttribute('aria-selected', front ? 'true' : 'false');
      tab.tabIndex = front ? 0 : -1;
    }
  }

  function raise(key, on) {
    cards[key].classList.toggle('raised', on);
    tabs[key].classList.toggle('raised', on);
  }

  // Brings a card to the front; the others keep their relative order.
  function select(key, animate) {
    var d0 = order.indexOf(key);
    if (d0 <= 0) return;
    order.splice(d0, 1);
    order.unshift(key);
    var card = cards[key];
    var tab = tabs[key];
    raise(key, false);
    if (endLift) endLift();
    if (animate && !reduceMotion && !isPhone()) {
      // Animation starting point = previous depth position.
      var pair = [card, tab];
      pair.forEach(function (n) {
        n.style.setProperty('--x0', (4 * d0) + 'px');
        n.style.setProperty('--y0', (-30 * d0) + 'px');
        n.classList.add('lifting');
      });
      var done = false;
      var timer = null;
      var finish = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        card.removeEventListener('animationend', onEnd);
        pair.forEach(function (n) { n.classList.remove('lifting'); });
        if (endLift === finish) endLift = null;
      };
      var onEnd = function (e) {
        if (e.target === card && e.animationName === 'ficheLift') finish();
      };
      card.addEventListener('animationend', onEnd);
      timer = setTimeout(finish, LIFT_FALLBACK_MS);
      endLift = finish;
    }
    applyDepth();
    measureScroll();
    if (isPhone()) {
      var r = card.getBoundingClientRect();
      if (r.top < 0 || r.top > window.innerHeight) {
        card.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    }
  }

  // Keyboard: ←/→ (wrapping), Home/End move focus AND bring the card forward.
  function onKey(e) {
    var active = document.activeElement;
    var i = KEYS.indexOf(active && active.getAttribute('data-key'));
    if (i === -1) return;
    var n = null;
    if (e.key === 'ArrowRight') n = (i + 1) % KEYS.length;
    else if (e.key === 'ArrowLeft') n = (i + KEYS.length - 1) % KEYS.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = KEYS.length - 1;
    if (n === null) return;
    e.preventDefault();
    tabs[KEYS[n]].focus();
    select(KEYS[n], true);
  }

  /* ---------- Build ---------- */
  function build(content) {
    var a = merge(content && content.about);
    about = a;
    labelEls = {};
    textEls = {};
    hubTiles = [];
    // Folder fonts: the three about.css variables, overridden on .about-root
    // when a font is chosen in the admin.
    var fontNames = ['Special Elite', 'Caveat', 'IBM Plex Mono'];
    var root = wrap.closest('.about-root') || document.body;
    [['type', '--type'], ['body', '--mono'], ['hand', '--hand']].forEach(function (pair) {
      var n = a.fonts[pair[0]];
      if (!n) return;
      fontNames.push(n);
      root.style.setProperty(pair[1], Site.fontStack(n, content));
    });
    Site.ensureFonts(fontNames, content);
    var name = a.name || 'AUDREY-LILLIE';

    wrap.appendChild(fromHtml(DEFS));
    wrap.appendChild(make('div', 'folder-back'));
    var folder = make('div', 'folder');
    wrap.appendChild(folder);

    folder.appendChild(make('div', 'folder-side', name));
    folder.appendChild(useSvg('clip folder-clamp', 'ab-bulldog', '0 0 96 72', ' preserveAspectRatio="xMidYMid meet"'));

    var label = make('div', 'folder-label');
    label.appendChild(make('span', 'tape'));
    label.appendChild(make('p', 'label-name', name));
    if (a.title || a.title_en) label.appendChild(make('p', 'label-title', Site.tr(a, 'title')));
    folder.appendChild(label);

    /* Left column */
    var left = make('div', 'col-left');
    var frame = make('figure', 'photo-frame');
    // `photo` (the old single field) stays first, then `photos`, no duplicates.
    var photos = [];
    [a.photo].concat(a.photos).forEach(function (u) { if (u && photos.indexOf(u) === -1) photos.push(u); });
    var dots = buildPhotos(frame, photos, name);
    frame.appendChild(useSvg('clip clip-photo', 'ab-bulldog-logo', '0 0 96 72'));
    left.appendChild(frame);
    if (dots) left.appendChild(dots);
    if (a.stamp || a.stamp_en) left.appendChild(make('div', 'stamp', Site.tr(a, 'stamp')));
    if (a.note || a.note_en) left.appendChild(make('p', 'note', Site.tr(a, 'note')));
    folder.appendChild(left);

    /* Card stack + tabs (tabs AFTER the cards in the DOM) */
    var stack = make('div', 'stack');
    var tablist = make('div', 'tabs');
    tablist.setAttribute('role', 'tablist');
    // Tablist name for screen readers: data-i18n-label, the common.js
    // mechanism — Site.applyLang() re-translates the aria-label. Also set
    // directly: applyLang has already run at mount.
    tablist.setAttribute('data-i18n-label', 'about.tablist');
    tablist.setAttribute('aria-label', Site.t('about.tablist'));
    KEYS.forEach(function (key) {
      var c = a.cards[key];
      var card = make('section', 'card');
      card.setAttribute('data-key', key);
      card.setAttribute('role', 'tabpanel');
      card.id = 'about-panel-' + key;
      card.setAttribute('aria-labelledby', 'about-tab-' + key);
      card.appendChild(useSvg('clip clip-edge', 'ab-binder', '0 0 72 72'));
      if (key === 'cv') card.appendChild(useSvg('clip clip-cv', 'ab-bulldog-dots', '0 0 96 72'));
      var body = make('div', 'card-body');
      var title = make('h2', 'card-title');
      var tab = make('button', 'tab');
      tab.type = 'button';
      // Empty title: without it, the container's tooltip (the title applyLang
      // sets alongside the aria-label) would show when hovering the tabs.
      tab.title = '';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('data-key', key);
      tab.id = 'about-tab-' + key;
      tab.setAttribute('aria-controls', card.id);
      // Custom label (in the site language, French as fallback): shown as-is;
      // otherwise translated automatically.
      setLabel(title, c, key);
      setLabel(tab, c, key);
      labelEls[key] = { title: title, tab: tab };
      body.appendChild(title);
      var text = make('div', 'card-text');
      // "Content creation" card: the text (if any) then the hub; without a hub,
      // the card keeps its "nothing filed" message when empty.
      var hub = key === 'content' ? buildHub(a, content) : null;
      if (hub) body.appendChild(hub);
      textEls[key] = { box: text, body: body, hub: hub };
      setCardText(key);
      card.appendChild(body);
      stack.appendChild(card);
      tablist.appendChild(tab);
      cards[key] = card;
      tabs[key] = tab;
      bodies[key] = body;

      tab.addEventListener('click', function () { select(key, true); });
      // The visible edge of a back card acts as its tab.
      card.addEventListener('click', function () {
        if (!card.classList.contains('is-front')) select(key, true);
      });
      // Mouse hover only (on touch the class would stick): tab and card lift
      // together; the front card doesn't move while being read.
      tab.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') raise(key, true); });
      tab.addEventListener('pointerleave', function () { raise(key, false); });
      card.addEventListener('pointerenter', function (e) {
        if (e.pointerType === 'mouse' && !card.classList.contains('is-front')) raise(key, true);
      });
      card.addEventListener('pointerleave', function () { raise(key, false); });
      // The bottom fade disappears once the end of the text is reached.
      body.addEventListener('scroll', function () {
        body.classList.toggle('scrolls', overflowing(body));
      }, { passive: true });
    });
    stack.appendChild(tablist);
    tablist.addEventListener('keydown', onKey);
    folder.appendChild(stack);

    /* "How I ♥ to work" post-it: child of the folder, after the stack, so it
       comes last on phones (label, photo, note, tabs, card, post-it); on
       desktop it is absolutely positioned bottom-left. */
    var how = make('article', 'how-card');
    how.appendChild(make('span', 'tape'));
    var howTitle = make('h3', 'how-title');
    howTitle.appendChild(i18n('span', 'about.how.a'));
    howTitle.appendChild(document.createTextNode(' '));
    howTitle.appendChild(useSvg('how-heart', 'ab-heart', '0 0 64 60'));
    howTitle.appendChild(document.createTextNode(' '));
    howTitle.appendChild(i18n('span', 'about.how.b'));
    how.appendChild(howTitle);
    howText = null;
    if (a.how || a.how_en) {
      howText = make('div', 'how-text');
      renderText(Site.tr(a, 'how'), howText);
      how.appendChild(howText);
    }
    how.appendChild(useSvg('sticker sticker-heart', 'ab-heart', '0 0 64 60'));
    how.appendChild(useSvg('sticker sticker-star', 'ab-star', '0 0 64 64'));
    // The small post-it fades out its truncated text: a click (or Enter) opens
    // it large over the folder to read everything (text re-read on open, in
    // the current language).
    if (a.how || a.how_en) {
      how.setAttribute('role', 'button');
      how.setAttribute('tabindex', '0');
      how.setAttribute('aria-expanded', 'false');
      how.addEventListener('click', function () { openHow(how); });
      how.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openHow(how); }
      });
    }
    folder.appendChild(how);

    // ?tab=cv: that card in front, no animation (unknown key ignored).
    var wanted = null;
    try { wanted = new URLSearchParams(location.search).get('tab'); } catch (e) {}
    if (wanted && KEYS.indexOf(wanted) !== -1) {
      order = [wanted].concat(KEYS.filter(function (k) { return k !== wanted; }));
    }
    applyDepth();

    var placeholder = document.querySelector('.about-placeholder');
    if (placeholder) placeholder.parentNode.removeChild(placeholder);
    wrap.hidden = false;
    fitFrame();
    measureScroll();
    // Fonts arrive after the first render: text heights change.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureScroll);

    // Entrance: the folder lands, cards are dealt, the photo and post-it
    // appear. The class is removed at the end so hovers and "lift" don't fight
    // with animation-fill-mode: both.
    if (!reduceMotion) {
      wrap.classList.add('about-in');
      setTimeout(function () { wrap.classList.remove('about-in'); }, 1400);
    }
  }

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { fitFrame(); measureScroll(); }, 120);
  });

  window.addEventListener('DOMContentLoaded', function () {
    Site.mountChrome();
    // Even without content (API and seed unreachable), the folder is drawn
    // with its objects and empty cards: never a "coming soon".
    Site.loadContent().then(build, function () { build(null); });
  });
})();
