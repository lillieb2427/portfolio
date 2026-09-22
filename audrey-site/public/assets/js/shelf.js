/* Brand content page — bookshelf.
   One client = one book standing on a board: its name is set vertically on
   the spine (client font, colors and finish). On click, the book leaves the
   shelf, turns a quarter turn around its edge and lands, cover facing the
   visitor, in the middle of the same board; the cover carries the project
   media: a 16:9 video, a vertical 9:16 video in a phone frame, or a photo
   gallery. Its neighbours move aside; its slot stays visible as a ghost.
   Same flight mechanics as the Shorts page globe: FLIP in a fixed layer,
   reliable transition end via Site.afterTransition.
   On a portrait phone, books are spread over several stacked shelves
   ("tiers" mode); elsewhere a single row that scrolls horizontally when it
   overflows. */
(function () {
  'use strict';

  var ROLE_ANGLE = 10;     // role label tilt (as in dividers.js)
  var GAP = 4;             // space between two books (flex gap)
  var PERSPECTIVE = 1600;  // 3D flight depth (px)
  var FADE_MEDIA = 120;    // closing: media fades out before the cover turns (ms)
  var EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
  var FINISHES = ['cuir', 'vernis', 'mat'];
  var MAX_PHOTOS = 30;
  // Tiers (portrait phone), same values as shelf.css: row side margin, space
  // above (hover lift) and below (shadows) the books, board thickness, footer
  // (last board → bottom of screen, hint included).
  var TIER_PAD_X = 16, TIER_PAD_TOP = 16, TIER_PAD_BOTTOM = 22, BOARD_H = 8, TIER_FOOT = 64;
  // Tiers: exactly PER_TIER books per tier (the last may have fewer),
  // thicknesses scaled to fill the width, clamped.
  var PER_TIER = 5, TIER_W_MIN = 40, TIER_W_MAX = 62;
  // Side-by-side phones: minimum phone width (below it the row scrolls) and
  // caption height (16 px + 6 px gap, see shelf.css).
  var PHONE_MIN = 180, PHONE_CAP = 22;   // never thicker than on desktop
  // Book size ← name length: ≤ LEN_SHORT chars → short and thick, ≥ LEN_LONG
  // → tall and thin, linear in between. JITTER: share of the scale (±3%) left
  // to seeded noise to avoid perfect twins; adjacent lengths stay 0.94/14 >
  // 2 × 0.03 apart, so the order (longer → taller and thinner) never flips.
  var LEN_SHORT = 6, LEN_LONG = 20, JITTER = 0.03;
  // Smooth text scrolling: how long the target position stays authoritative.
  var TEXT_SETTLE = 500;
  // Same filter as the server-side safeUrl: a hand-edited content.json can't
  // load just anything into an <img> tag.
  var PHOTO_URL = /^(https?:\/\/|\/?api\/cover\?|assets\/)/i;
  // Footer hint while a gallery is shown: the arrows change photo (and scroll
  // the text), not book (common.js lacks this key: the text lives here and
  // follows the language via cc:lang).
  var HINT_GALLERY = {
    en: '← → PHOTOS & TEXT · CLICK THE PHOTO FOR THE NEXT · ESC TO CLOSE',
  };

  var page = document.body.getAttribute('data-shelf-page') || 'brand';
  var stage = document.getElementById('shelf-stage');
  var scroll = document.getElementById('shelf-scroll');
  var row = document.getElementById('shelf-row');
  var stageBoard = stage.querySelector('.shelf-board');   // single board in row mode
  var layer = document.getElementById('shelf-open');
  var closeBtn = document.getElementById('shelf-close');
  var hint = document.querySelector('.shorts-hint[data-i18n="shelf.hint"]');
  var main = stage.parentNode;   // <main class="shelf-page">: carries .landscape and .tiers

  var content = null;
  var clients = [];
  var nodes = [];            // { el, body, title, client, t (scale 0 short → 1 long), ideal, w, h, fs, lean (0 | 1 right | -1 left), deg, tier }
  var tiers = [];            // tiers: { el (null in row mode), row, board }
  var opened = null;         // index of the open book
  var selectedProject = {};  // client index -> project index
  var flying = false;        // opening or closing flight in progress
  var closing = false;
  var overflow = false;      // row overflows: horizontal scrolling
  var cur = null;            // open book: { i, client, projects, el, cover, player, wrap, tabs, text, desc, textNav, textUp, textDown, textAt, box, mode, gallery }
  var geo = null;            // stage geometry (measure())
  var gen = 0;               // flight counter: a stale flight end is ignored
  var openedAt = 0;          // time of the last open(): double-click guard
  var lockedScroll = null;   // row scrollLeft, frozen while a book is open
  var reduceMotion = false;
  try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var mq = null;
  try { mq = window.matchMedia('(max-width: 860px)'); } catch (e) {}

  function isMobile() { return !!(mq && mq.matches); }
  function ms(d) { return (reduceMotion ? 1 : d) + 'ms'; }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function projectsOf(client) {
    var list = (client.projects || []).filter(function (p) { return p.title || p.url || p.role || photosOf(p).length; });
    return list.length ? list : [{ title: '', url: '', role: '' }];
  }
  // Book finish: the admin's choice, else a stable random pick (same client,
  // same finish on every visit) for variety on the shelf.
  function finishOf(client, i) {
    if (FINISHES.indexOf(client.finish) !== -1) return client.finish;
    return FINISHES[Math.floor(Site.seeded(i * 19 + 7) * 3) % 3];
  }

  /* ---------- Project media ---------- */
  function photosOf(p) {
    return ((p && p.photos) || []).filter(function (u) { return typeof u === 'string' && PHOTO_URL.test(u.trim()); })
      .map(function (u) { return u.trim(); }).slice(0, MAX_PHOTOS);
  }
  // Inherently vertical video: TikTok, Instagram, YouTube Shorts.
  function isPortraitUrl(url) {
    var info = Site.parseVideo(url);
    if (!info) return false;
    if (info.type === 'tiktok' || info.type === 'instagram') return true;
    return info.type === 'youtube' && /youtube\.com\/shorts\//i.test(url);
  }
  // Photos → gallery; otherwise the video, 9:16 if forced or detected, else 16:9.
  function mediaMode(p) {
    if (photosOf(p).length) return 'gallery';
    if (p.format === 'portrait' || p.format === 'landscape') return p.format;
    return isPortraitUrl(p.url) ? 'portrait' : 'landscape';
  }
  // Cover items: one tab per project, except a client's 9:16 videos (two or
  // more), which are merged into a single "phones" item — side-by-side
  // phones, in place of the first one.
  // { p } for a single project, { phones: [p, …] } for the group.
  function groupProjects(list) {
    var items = [], group = null;
    list.forEach(function (p) {
      if (mediaMode(p) !== 'portrait') { items.push({ p: p }); return; }
      if (!group) { group = { phones: [p] }; items.push(group); } else group.phones.push(p);
    });
    if (group && group.phones.length === 1) items[items.indexOf(group)] = { p: group.phones[0] };
    return items;
  }
  function itemList(item) { return item.phones || [item.p || {}]; }
  function itemMode(item) { return item.phones ? 'phones' : mediaMode(item.p || {}); }
  // First project in the group that has the field (in the site language), else null.
  function itemWith(item, key) {
    var list = itemList(item);
    for (var k = 0; k < list.length; k++) if (Site.tr(list[k], key)) return list[k];
    return null;
  }
  function itemText(item, key) { var p = itemWith(item, key); return p ? Site.tr(p, key) : ''; }
  function itemFirst(item) { return itemList(item)[0]; }
  // Tab title: the project's; for a group, the common prefix of the titles
  // ("BEFORE THE FIGHT/1", "…/2" → "BEFORE THE FIGHT"), else the first title.
  // '' when there is no title.
  function commonPrefix(titles) {
    var pre = titles[0] || '';
    for (var k = 1; k < titles.length && pre; k++) {
      var t = titles[k] || '', n = 0;
      while (n < pre.length && n < t.length && pre.charAt(n) === t.charAt(n)) n++;
      pre = pre.slice(0, n);
    }
    return pre;
  }
  var SEP_END = /[\s\/\-–—:·#.,|]+$/, SEP_START = /^[\s\/\-–—:·#.,|]+/;
  function itemTitle(item) {
    if (!item.phones) return Site.tr(item.p || {}, 'title');
    var titles = item.phones.map(function (p) { return Site.tr(p, 'title'); });
    var pre = commonPrefix(titles).replace(SEP_END, '');
    return pre.length >= 3 ? pre : (titles[0] || '');
  }
  // Caption above each phone: what remains of the title once the common
  // prefix is removed ("1", "2", "3"), the whole title if nothing remains; no
  // caption when all titles are identical.
  function phoneCaptions(item) {
    var titles = item.phones.map(function (p) { return Site.tr(p, 'title'); });
    var same = titles.every(function (t) { return t === titles[0]; });
    if (same) return titles.map(function () { return ''; });
    var pre = commonPrefix(titles).replace(SEP_END, '');
    return titles.map(function (t) { return t.slice(pre.length).replace(SEP_START, '') || t; });
  }

  /* ---------- Geometry ---------- */
  // Everything depends on the window and Site.seeded: no text measurement
  // goes into the geometry, so a font swap causes no jump.
  function measure() {
    var mobile = isMobile();
    var chrome = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--chrome-h')) || 96;
    var stageH = Math.max(120, window.innerHeight - chrome);
    var floorH = mobile ? 64 : 78;
    var landscape = mobile && stageH < 300;   // landscape phone
    // Landscape: 0.40 × 258 px would leave only 103 px for spines (names cut
    // to one letter); use all the free height above the board.
    // Desktop: the tallest book takes 82% of the stage (659 px at 1440×900);
    // phone: 50% (375 px max) — tall slender books rather than thick compact
    // ones.
    var hmax = landscape ? stageH - floorH - 12
      : mobile ? Math.min(375, Math.round(0.50 * stageH)) : Math.min(700, Math.round(0.82 * stageH));
    hmax = Math.max(60, hmax);
    return {
      mobile: mobile, chrome: chrome, stageH: stageH, stageW: window.innerWidth, floorH: floorH,
      shelfY: chrome + stageH - floorH,        // shelf line (bottom edge of the books)
      hmax: hmax, hmin: Math.round(0.66 * hmax),
      landscape: landscape,
      tiered: mobile && !landscape,            // portrait phone: stacked tiers
    };
  }

  // Cover box. Desktop: sitting on the board, 28 px below the header, a bit
  // wider than tall (ratio 1.12) so the media uses the height, with at least
  // ~3 spines visible on each side. Phone: full width minus 12 px, height
  // measured from the content (sizeCover) and capped; in tiers mode, centered
  // in the visible window below the header (the book can come from any tier,
  // and the page may have scrolled).
  function coverBox(g) {
    if (g.mobile) {
      var cap = g.tiered || g.landscape ? g.stageH : g.shelfY - g.chrome;
      return { Wc: g.stageW - 24, left: 12, Hc: 0, top: 0, cap: cap - 16 };
    }
    var Hc = g.shelfY - g.chrome - 28;
    var Wc = Math.max(Math.round(1.12 * Hc), Math.min(600, Math.round(0.46 * g.stageW)));
    Wc = Math.max(280, Math.min(Wc, g.stageW - 240, Math.round(0.6 * g.stageW)));
    return { Wc: Wc, Hc: Hc, left: Math.round((g.stageW - Wc) / 2), top: g.shelfY - Hc, cap: Hc };
  }

  // Current horizontal translation of an element (computed matrix).
  function txOf(el) {
    var t = getComputedStyle(el).transform;
    var m = t && t !== 'none' ? t.match(/matrix(3d)?\(([^)]+)\)/) : null;
    if (!m) return 0;
    var v = m[2].split(',');
    return parseFloat(m[1] ? v[12] : v[4]) || 0;
  }
  // Left edge of a slot at rest, without its row's recentering or spreading:
  // valid even mid-transition.
  function restLeft(node) {
    return node.el.getBoundingClientRect().left - txOf(tiers[node.tier].row) - txOf(node.el);
  }

  // Transform of the book in flight. The perspective is in the function list,
  // not on the layer: its vanishing point is then the transform origin, i.e.
  // the book's (bottom-left) edge. Nothing rotating around that edge can
  // project to its left — the spine face, pointing at the visitor, no longer
  // "sticks out" left of the cover — and the cover's bottom stays on the board.
  function bookTransform(dx, dy, k, deg) {
    return 'translate(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px) scale(' + k.toFixed(5) + ') perspective(' + PERSPECTIVE + 'px) rotateY(' + deg + 'deg)';
  }

  /* ---------- Build ---------- */
  function build(json) {
    content = json;
    clients = ((json[page] || {}).clients || []).filter(function (c) { return c.name; });
    row.innerHTML = '';
    nodes = [];
    opened = null;
    var old = stage.querySelector('.about-placeholder');
    if (old) old.parentNode.removeChild(old);
    stage.classList.toggle('empty', !clients.length);

    if (!clients.length) {
      mountTiers(0);
      var empty = document.createElement('p');
      empty.className = 'about-placeholder';
      empty.setAttribute('data-i18n', 'player.soon');
      empty.textContent = Site.t('player.soon');
      stage.appendChild(empty);
      return;
    }

    var fonts = ['IBM Plex Mono'];
    clients.forEach(function (c) {
      fonts.push(c.font);
      (c.projects || []).forEach(function (p) { if (p.font) fonts.push(p.font); });
    });
    Site.ensureFonts(fonts, json);

    clients.forEach(function (client, i) {
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'book';
      el.setAttribute('data-index', String(i));
      el.setAttribute('aria-expanded', 'false');
      el.title = client.name;

      var body = document.createElement('span');
      body.className = 'spine-body fin-' + finishOf(client, i);
      var bg = client.bg || '#B4BCAC';
      body.style.setProperty('--book-bg', bg);
      body.style.setProperty('--book-text', client.text || Site.contrast(bg));
      body.style.fontFamily = Site.fontStack(client.font, json);

      var title = document.createElement('span');
      title.className = 'spine-title';
      title.textContent = client.name;

      // Order number (the admin's), followed by the project count if there are several.
      var foot = document.createElement('span');
      foot.className = 'spine-foot';
      var np = projectsOf(client).length;
      foot.textContent = pad2(i + 1) + (np > 1 ? '·' + np : '');

      body.appendChild(title);
      body.appendChild(foot);
      el.appendChild(body);
      el.addEventListener('click', function () {
        if (opened === null) open(i);
        // A quick double-click would open then close the book: the second
        // click, on the ghost, is ignored within 350 ms of opening (Escape and
        // the cross stay immediate).
        else if (opened === i) { if (!(flying && !closing && Date.now() - openedAt < 350)) close(); }
        else switchTo(i);
      });
      nodes.push({ el: el, body: body, title: title, client: client, t: 0, ideal: 0, w: 0, h: 0, fs: 13, lean: 0, deg: 0, tier: 0 });
    });
    layout();
  }

  // DOM structure per mode. Single row (desktop, landscape phone, empty
  // shelf): #shelf-row alone in #shelf-scroll, with the stage board. Tiers
  // (portrait phone): T .shelf-tier blocks in #shelf-scroll, each with its
  // row (#shelf-row for the first) and board; the stage board is hidden by
  // shelf.css. Books are then placed into the rows by layout().
  function mountTiers(T) {
    while (scroll.firstChild) scroll.removeChild(scroll.firstChild);
    tiers = [];
    if (T < 1) {
      scroll.appendChild(row);
      tiers.push({ el: null, row: row, board: stageBoard });
    }
    for (var t = 0; t < T; t++) {
      var tier = document.createElement('div');
      tier.className = 'shelf-tier';
      var r = t ? document.createElement('div') : row;
      r.className = 'shelf-row';
      var board = document.createElement('div');
      board.className = 'shelf-board';
      board.setAttribute('aria-hidden', 'true');
      tier.appendChild(r);
      tier.appendChild(board);
      scroll.appendChild(tier);
      tiers.push({ el: tier, row: r, board: board });
    }
    main.classList.toggle('tiers', T >= 1);
    // shelf.css pins the header (on an opaque background) when the page
    // scrolls: the header isn't inside <main>, so the class goes on <body>.
    document.body.classList.toggle('shelf-tiers', T >= 1);
  }

  // Leaning books: about one in four (at least one from three books), never
  // two neighbours, alternating right / left. A leaning book rests on its
  // neighbour on the lean side: never the first leaning left or the last
  // leaning right. Two books: the first rests on the second. Site.seeded
  // draws: same shelf on every visit. Called per tier: a leaning book always
  // rests on a neighbour in the same tier, never alone.
  function pickLeans(n) {
    var out = {};
    if (n < 2) return out;
    if (n === 2) { out[0] = 1; return out; }
    var want = Math.max(1, Math.round(n / 4));
    var dir = Site.seeded(n * 7 + 1) > 0.5 ? 1 : -1;
    var i = 1 + Math.floor(Site.seeded(n * 13 + 5) * Math.min(3, n - 2));
    var count = 0;
    while (i <= n - 2 && count < want) {
      out[i] = dir;
      dir = -dir;
      count++;
      i += 3 + Math.floor(Site.seeded(i * 5 + n) * 3);   // step of 3 to 5: never adjacent
    }
    return out;
  }

  // Split into tiers (portrait phone): index lists, PER_TIER books per tier
  // in admin order, the remainder on the last (6 → 5 + 1, 10 → 5 + 5,
  // 12 → 5 + 5 + 2). No more 3 + 3 balancing: the client wants
  // "10 projects → 2 tiers" of 5.
  function packTiers() {
    var groups = [];
    for (var i = 0; i < nodes.length; i += PER_TIER) {
      var list = [];
      for (var j = i; j < Math.min(nodes.length, i + PER_TIER); j++) list.push(j);
      groups.push(list);
    }
    return groups;
  }

  // A book's position on the "short name → long name" scale: 0 for
  // ≤ LEN_SHORT chars (spaces included), 1 for ≥ LEN_LONG, linear in between,
  // plus seeded noise — two names of the same length give the same book
  // within ±3%, never perfect twins.
  function sizeRatio(node, i) {
    var len = String(node.client.name || '').length;
    var t = Math.max(0, Math.min(1, (len - LEN_SHORT) / (LEN_LONG - LEN_SHORT)));
    return JITTER + (1 - 2 * JITTER) * t + JITTER * (2 * Site.seeded(i * 7 + 2) - 1);
  }

  // Heights, thicknesses, leans and title sizes: a function of name length
  // (long name → tall thin book, short name → short thick book), same shelf on
  // every visit, same order as the admin, independent of colors and fonts.
  function layout() {
    geo = measure();
    var g = geo, n = nodes.length;
    main.classList.toggle('landscape', g.landscape);
    // Each book's scale (it now only drives height: name length makes the
    // book taller) and "ideal" thickness: the same for all, 62 px on desktop,
    // 56 px on landscape phone. In tiers the ideal is only a weight: actual
    // thicknesses are derived from the screen width below, once leans are known.
    nodes.forEach(function (node, i) {
      node.t = sizeRatio(node, i);
      node.ideal = g.mobile && !g.tiered ? 56 : 62;
      node.w = node.ideal;
      node.tier = 0;
    });
    var groups = g.tiered && n ? packTiers() : [nodes.map(function (_, i) { return i; })];
    var T = groups.length;
    mountTiers(g.tiered && n ? T : 0);
    // Several tiers: the max height is trimmed (by 10% at most) when that is
    // enough to fit all tiers on screen — a page scrolling by a few pixels
    // would be worse. Beyond that, the page scrolls.
    if (g.tiered && T >= 2) {
      var fit = Math.floor((g.stageH - TIER_FOOT - T * (TIER_PAD_TOP + BOARD_H + TIER_PAD_BOTTOM)) / T);
      if (fit < g.hmax && fit >= Math.round(0.9 * g.hmax)) { g.hmax = fit; g.hmin = Math.round(0.66 * fit); }
    }
    stage.style.setProperty('--hmax', g.hmax + 'px');
    stage.style.setProperty('--floor-h', g.floorH + 'px');
    groups.forEach(function (list, t) {
      var leans = pickLeans(list.length);
      list.forEach(function (i, j) {
        nodes[i].tier = t;
        nodes[i].lean = leans[j] || 0;
        tiers[t].row.appendChild(nodes[i].el);
      });
    });
    // Height ← name length: hmin for a short name, hmax for a long one.
    // Leaning: 6 to 10°, it keeps its height; its supporting neighbour (same
    // tier, guaranteed by pickLeans) must rise at least 24 px above the
    // contact point (the leaning book's top, at h·cos θ), otherwise the top
    // would rest on nothing. In order: the leaning book rests on the other
    // neighbour instead if it's taller (the drawn direction is kept when it
    // works), else the neighbour is raised (up to hmax), else — the leaning
    // book itself being at hmax — it is shortened by a few pixels. Everything
    // stays within hmin / hmax.
    function heights() {
      nodes.forEach(function (node) {
        node.h = Math.round(g.hmin + (g.hmax - g.hmin) * node.t);
        node.deg = 0;
      });
      nodes.forEach(function (node, i) {
        if (!node.lean) return;
        node.deg = 6 + Math.round(4 * Site.seeded(i * 17 + 3));
        var cos = Math.cos(node.deg * Math.PI / 180);
        var need = Math.round(node.h * cos) + 24;
        var support = nodes[i + node.lean], other = nodes[i - node.lean];
        if (support && support.h < need && other && other.tier === node.tier && other.h > support.h) {
          node.lean = -node.lean;
          support = other;
        }
        if (!support) return;
        if (support.h < need) support.h = Math.min(g.hmax, need);
        if (support.h < need) node.h = Math.floor((support.h - 24) / cos);
      });
    }
    // Horizontal projection of a leaning book's top; its margin is --lean
    // minus the flex gap (the top touches the neighbour without overlapping).
    function leanOf(node) { return node.lean ? Math.round(node.h * Math.sin(node.deg * Math.PI / 180)) : 0; }
    function widthOf(list) {
      var s = 0;
      list.forEach(function (i, j) { s += nodes[i].w + (j ? GAP : 0) + (nodes[i].lean ? leanOf(nodes[i]) - GAP : 0); });
      return s;
    }
    heights();
    // Tiers: the PER_TIER books of a full tier fill the width (margins, gaps
    // and lean margin deducted) in proportion to their ideal thicknesses,
    // clamped to 40–90 px. An incomplete tier reuses the scale of the full
    // tier before it (no giant books) and shelf.css centers it; if it's alone
    // (fewer than 5 books), the scale is what 5 books of that average weight
    // would get. Never horizontal scrolling: if clamping made the tier
    // overflow, the thickest are trimmed, then if needed the leaning book
    // straightens up.
    if (g.tiered) {
      var inner = g.stageW - 2 * TIER_PAD_X, k = 0;
      groups.forEach(function (list) {
        var sum = 0, lean = 0;
        list.forEach(function (i) { sum += nodes[i].ideal; if (nodes[i].lean) lean += leanOf(nodes[i]) - GAP; });
        if (list.length === PER_TIER) k = (inner - GAP * (PER_TIER - 1) - lean) / sum;
        else if (!k) k = (inner - GAP * (PER_TIER - 1)) * list.length / (PER_TIER * sum);
        list.forEach(function (i) { nodes[i].w = Math.max(TIER_W_MIN, Math.min(TIER_W_MAX, Math.round(nodes[i].ideal * k))); });
        while (widthOf(list) > inner) {
          var widest = -1, last = -1;
          list.forEach(function (i) {
            if (nodes[i].w > TIER_W_MIN && (widest < 0 || nodes[i].w > nodes[widest].w)) widest = i;
            if (nodes[i].lean) last = i;
          });
          if (widest >= 0) { nodes[widest].w--; continue; }
          if (last < 0) break;
          nodes[last].lean = 0;
          heights();
        }
      });
    }
    var natural = 0;
    nodes.forEach(function (node, i) {
      var w = node.w, h = node.h;
      node.el.style.setProperty('--w', w + 'px');
      node.el.style.setProperty('--h', h + 'px');
      node.el.classList.toggle('lean', !!node.lean);
      node.el.classList.toggle('lean-r', node.lean === 1);
      node.el.classList.toggle('lean-l', node.lean === -1);
      node.el.classList.toggle('thin', w < 44);
      natural += w + (i ? GAP : 0);
      if (node.lean) {
        var lean = leanOf(node);
        node.el.style.setProperty('--lean', lean + 'px');
        node.el.style.setProperty('--deg', node.deg + 'deg');
        natural += lean - GAP;
      } else {
        node.el.style.removeProperty('--lean');
        node.el.style.removeProperty('--deg');
      }
      // The title size fills the spine, estimated at 0.62 em per letter
      // (18 px top, 48 px bottom; 12 + 12 in landscape, no foot or rules): a
      // 3-letter name on a short thick book goes up to 30 px, a 30-char name on
      // a tall thin spine goes down to 11 px on phones. Then fine-tuned by
      // fitTitles.
      var len = Math.max(1, node.client.name.length);
      var fs = Math.min(0.42 * w, (h - (g.landscape ? 24 : 66)) / (0.62 * len));
      node.fs = Math.max(g.mobile ? 11 : 13, Math.min(g.mobile ? 20 : 30, fs));
    });
    fitTitles();
    // Overflow computed rather than measured: an open book's transforms would
    // skew scrollWidth. Never in tiers mode.
    overflow = !g.tiered && natural + (g.mobile ? 32 : 96) > scroll.clientWidth + 1;
    scroll.classList.toggle('is-overflow', overflow);
  }

  // Title sizes: the estimate is applied, then each name is measured in its
  // spine (scrollHeight in vertical writing); if it overflows — long name in
  // wide capitals, fancy font — it is shrunk accordingly (10 px min) to stay
  // whole, never truncated. Re-run when a font arrives (document.fonts): only
  // the text size changes; book geometry (w, h, tiers) doesn't depend on it,
  // so nothing jumps.
  function fitTitles() {
    nodes.forEach(function (node) {
      var el = node.title;
      el.style.fontSize = node.fs.toFixed(1) + 'px';
      var over = el.scrollHeight - el.clientHeight;
      if (over > 0 && el.clientHeight > 0) {
        el.style.fontSize = Math.max(10, Math.floor(node.fs * el.clientHeight / el.scrollHeight * 10) / 10) + 'px';
      }
    });
  }
  if (document.fonts && document.fonts.addEventListener) {
    document.fonts.addEventListener('loadingdone', function () { if (nodes.length) fitTitles(); });
  }

  /* ---------- Cover ---------- */
  function buildBook3d(i) {
    var node = nodes[i], client = node.client, g = geo;
    var fin = 'fin-' + finishOf(client, i);
    var el = document.createElement('div');
    el.className = 'book3d';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', client.name);
    el.tabIndex = -1;
    el.style.setProperty('--book-bg', node.body.style.getPropertyValue('--book-bg'));
    el.style.setProperty('--book-text', node.body.style.getPropertyValue('--book-text'));

    // Spine face: copy of the spine (the name was set there via textContent).
    var spine = document.createElement('div');
    spine.className = 'book3d-spine ' + fin;
    spine.setAttribute('aria-hidden', 'true');
    spine.innerHTML = node.body.innerHTML;
    spine.style.cssText = node.body.style.cssText;
    spine.classList.toggle('thin', node.w < 44);   // same hidden foot as on the shelf
    el.appendChild(spine);

    // Same finish on the cover as on the spine.
    var cover = document.createElement('div');
    cover.className = 'book3d-cover ' + fin;

    var head = document.createElement('div');
    head.className = 'cover-head';
    var h2 = document.createElement('h2');
    h2.className = 'cover-title';
    h2.textContent = client.name;
    h2.title = client.name;
    h2.style.fontFamily = Site.fontStack(client.font, content);
    var len = client.name.length;
    h2.style.fontSize = (g.mobile ? (len <= 14 ? 24 : len <= 22 ? 20 : 17) : (len <= 14 ? 34 : len <= 22 ? 28 : 22)) + 'px';
    var num = document.createElement('span');
    num.className = 'cover-num';
    num.textContent = pad2(i + 1);
    head.appendChild(h2);
    head.appendChild(num);
    cover.appendChild(head);

    var projects = projectsOf(client);
    var items = groupProjects(projects);
    if (selectedProject[i] == null || selectedProject[i] >= items.length) selectedProject[i] = 0;
    var tabs = null;
    if (items.length > 1) {
      tabs = document.createElement('div');
      tabs.className = 'cover-tabs';
      tabs.setAttribute('role', 'tablist');
      // A single scrolling row: the vertical wheel slides it.
      tabs.addEventListener('wheel', function (e) {
        if (tabs.scrollWidth <= tabs.clientWidth + 1) return;
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { tabs.scrollLeft += e.deltaY; e.preventDefault(); }
      }, { passive: false });
      items.forEach(function (item, j) {
        var p = itemFirst(item);
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'cover-tab';
        b.setAttribute('role', 'tab');
        b.textContent = itemTitle(item) || 'Project ' + (j + 1);
        b.style.fontFamily = Site.fontStack(p.font || client.font, content);
        if (p.bg) b.style.setProperty('--book-bg', p.bg);
        if (p.text) b.style.setProperty('--book-text', p.text);
        // Not during flight: sizeCover measures the cover in screen pixels,
        // wrong while it is in 3D.
        b.addEventListener('click', function () { if (!flying) renderProject(i, j, false); });
        tabs.appendChild(b);
      });
      cover.appendChild(tabs);
    }

    var wrap = document.createElement('div');
    wrap.className = 'cover-player-wrap';
    var player = document.createElement('div');
    player.className = 'cover-player divider-player';
    wrap.appendChild(player);
    cover.appendChild(wrap);

    // Text under the media (filled by renderProject: project text, else client
    // description; hidden when there's nothing to say): the whole text is in
    // the DOM, in a height-capped area (3 lines on desktop, 4 on phones) that
    // scrolls — wheel, finger, arrows. On its right, two small ▲ ▼ arrows for
    // projects without a gallery when it overflows (with a gallery, the photo
    // arrows scroll it).
    var text = document.createElement('div');
    text.className = 'cover-text';
    text.hidden = true;
    var desc = document.createElement('p');
    desc.className = 'cover-desc';
    desc.addEventListener('scroll', updateNav);
    var textNav = document.createElement('div');
    textNav.className = 'desc-nav';
    textNav.hidden = true;
    var textUp = descArrow('desc-up', '▲', -1), textDown = descArrow('desc-down', '▼', 1);
    textNav.appendChild(textUp);
    textNav.appendChild(textDown);
    text.appendChild(desc);
    text.appendChild(textNav);
    cover.appendChild(text);
    var foot = null;
    if (items.length === 1 && itemTitle(items[0])) {
      foot = document.createElement('p');
      foot.className = 'cover-foot';
      foot.textContent = itemTitle(items[0]);
      cover.appendChild(foot);
    }
    el.appendChild(cover);
    return { i: i, client: client, projects: projects, items: items, el: el, cover: cover, player: player, wrap: wrap, tabs: tabs, foot: foot,
      text: text, desc: desc, textNav: textNav, textUp: textUp, textDown: textDown, textAt: null, textTimer: null,
      box: null, mode: 'landscape', gallery: null };
  }

  // Text under the media: the project's, else the client description, in the
  // site language. Scrolled back to the top: it's a different text.
  function renderText(item) {
    var text = itemText(item, 'desc') || Site.tr(cur.client, 'desc') || '';
    cur.desc.textContent = text;
    cur.desc.scrollTop = 0;
    cur.textAt = null;
    cur.text.hidden = !text;
  }

  // Role label of project j (removed if it has none in this language).
  function renderRole(item, i, j) {
    var old = cur.wrap.querySelector('.player-role');
    if (old) old.parentNode.removeChild(old);
    var text = itemText(item, 'role');
    cur.wrap.classList.toggle('has-role', !!text);
    if (!text) return;
    var p = itemWith(item, 'role') || itemFirst(item);
    var role = document.createElement('p');
    role.className = 'player-role';
    role.textContent = text;
    role.style.fontFamily = Site.fontStack(p.font || cur.client.font, content);
    if (p.bg) role.style.setProperty('--book-bg', p.bg);
    if (p.text) role.style.setProperty('--book-text', p.text);
    // Constant tilt; direction and position random but stable for a given
    // project (same draws as dividers.js).
    var sens = Site.seeded(i * 53 + j * 29 + 11) > 0.5 ? 1 : -1;
    var left = 26 + Site.seeded(i * 97 + j * 17 + 3) * 48;
    cur.roleLeft = Math.min(78, Math.max(22, left));
    role.style.transform = 'translate(-50%, 50%) rotate(' + (sens * ROLE_ANGLE) + 'deg)';
    cur.wrap.appendChild(role);
    placeRole();
  }

  // Language change with a book open: tabs, footer title, text and role label
  // are replaced in place — the media (video, gallery) stays. The cover is
  // re-measured if the text block appears or disappears (never in flight:
  // sizeCover measures in screen pixels).
  function retranslate() {
    if (!cur) return;
    var j = selectedProject[cur.i] || 0;
    var item = cur.items[j] || { p: {} };
    if (cur.tabs) {
      for (var k = 0; k < cur.tabs.children.length && k < cur.items.length; k++) {
        cur.tabs.children[k].textContent = itemTitle(cur.items[k]) || 'Project ' + (k + 1);
      }
    }
    if (cur.foot) cur.foot.textContent = itemTitle(cur.items[0]);
    if (cur.mode === 'phones') {
      var caps = phoneCaptions(item), capEls = cur.player.querySelectorAll('.phone-cap');
      for (var m = 0; m < capEls.length && m < caps.length; m++) capEls[m].textContent = caps[m];
    }
    var wasHidden = cur.text.hidden;
    renderText(item);
    renderRole(item, cur.i, j);
    if (!flying && wasHidden !== cur.text.hidden) sizeCover();
    updateNav();
  }
  document.addEventListener('cc:lang', retranslate);

  function descArrow(cls, glyph, d) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'desc-arrow ' + cls;
    b.textContent = glyph;
    b.setAttribute('aria-label', d > 0 ? 'Text down' : 'Text up');
    b.addEventListener('click', function () { if (!flying && pageText(d)) updateNav(); });
    return b;
  }

  // Active tab, role label, frame shape and media of project j. During
  // flight the frame stays black and empty (noPlayer), already in the media's
  // shape (16:9, 9:16 phone or gallery): content only arrives once landed.
  function renderProject(i, j, noPlayer) {
    if (!cur || cur.i !== i) return;
    selectedProject[i] = j;
    var item = cur.items[j] || { p: {} };
    renderText(item);
    if (cur.tabs) {
      for (var k = 0; k < cur.tabs.children.length; k++) {
        cur.tabs.children[k].classList.toggle('active', k === j);
        cur.tabs.children[k].setAttribute('aria-selected', k === j ? 'true' : 'false');
      }
    }
    renderRole(item, i, j);
    if (cur.tabs) centerTab(j);
    cur.mode = itemMode(item);
    cur.gallery = null;
    cur.player.className = 'cover-player divider-player' + (cur.mode === 'portrait' ? ' portrait' : cur.mode === 'gallery' ? ' gallery' : cur.mode === 'phones' ? ' phones' : '');
    cur.player.innerHTML = '';
    if (!noPlayer) {
      lightPlayer(item);
      sizeCover();
    }
    updateNav();
    setHint();
  }

  // "Screen turns on": the media fades into the black frame.
  function lightPlayer(item) {
    item = item || { p: {} };
    cur.player.innerHTML = '';
    cur.player.classList.remove('lit');
    cur.gallery = null;
    if (cur.mode === 'gallery') cur.player.appendChild(buildGallery(photosOf(item.p)));
    else if (cur.mode === 'phones') buildPhones(item).forEach(function (ph) { cur.player.appendChild(ph); });
    else cur.player.appendChild(Site.playerNode((item.p || {}).url));
    void cur.player.offsetWidth;
    cur.player.classList.add('lit');
    updateNav();
    setHint();
  }

  // Side-by-side phones: one block per 9:16 video in the group, short caption
  // above (the distinctive part of the title), phone frame below.
  function buildPhones(item) {
    var caps = phoneCaptions(item);
    return item.phones.map(function (p, k) {
      var ph = document.createElement('div');
      ph.className = 'phone';
      var cap = document.createElement('p');
      cap.className = 'phone-cap';
      cap.textContent = caps[k];
      cap.title = Site.tr(p, 'title');
      cap.style.fontFamily = Site.fontStack(p.font || cur.client.font, content);
      ph.appendChild(cap);
      var frame = document.createElement('div');
      frame.className = 'phone-frame';
      frame.appendChild(Site.playerNode(p.url));
      ph.appendChild(frame);
      return ph;
    });
  }

  // Gallery: one photo at a time, arrows on top, dots and counter at the top
  // (the bottom is reserved for the role label), click on the photo = next,
  // finger swipe, next photo preloaded, short fade. Arrows, click and swipe go
  // through navigate(): photos and text together.
  function buildGallery(list) {
    var box = document.createElement('div');
    box.className = 'cover-gallery';
    var img = document.createElement('img');
    img.className = 'gal-img';
    img.alt = '';
    img.draggable = false;
    img.decoding = 'async';
    box.appendChild(img);
    var gal = { list: list, at: 0, img: img, timer: null, dots: [], prev: null, next: null };

    function arrow(cls, glyph, d) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'gal-arrow ' + cls;
      b.textContent = glyph;
      b.setAttribute('aria-label', d > 0 ? 'Next' : 'Previous');
      b.addEventListener('click', function (e) { e.stopPropagation(); navigate(d); });
      return b;
    }
    var foot = document.createElement('div');
    foot.className = 'gal-foot';
    var dots = document.createElement('span');
    dots.className = 'gal-dots';
    list.forEach(function () {
      var d = document.createElement('span');
      d.className = 'gal-dot';
      dots.appendChild(d);
      gal.dots.push(d);
    });
    var count = document.createElement('span');
    count.className = 'gal-count';
    foot.appendChild(dots);
    foot.appendChild(count);
    // Always built (they also drive the text); updateNav hides them when
    // neither photos nor text can move.
    gal.prev = arrow('gal-prev', '‹', -1);
    gal.next = arrow('gal-next', '›', 1);
    box.appendChild(gal.prev);
    box.appendChild(gal.next);
    box.appendChild(foot);

    gal.show = function (k, fade) {
      if (gal.timer) clearTimeout(gal.timer);
      gal.at = k;
      gal.dots.forEach(function (d, m) { d.classList.toggle('active', m === k); });
      count.textContent = (k + 1) + ' / ' + list.length;
      if (k + 1 < list.length) { var pre = new Image(); pre.src = list[k + 1]; }
      if (!fade) { img.src = list[k]; return; }
      img.classList.add('fading');
      gal.timer = setTimeout(function () {
        img.src = list[k];
        img.classList.remove('fading');
        gal.timer = null;
      }, 150);
    };
    gal.show(0, false);
    img.addEventListener('click', function () { navigate(1); });
    // Finger swipe: 40 px is enough; vertical gestures (scrolling) are ignored.
    var x0 = null, y0 = 0;
    box.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) navigate(dx < 0 ? 1 : -1);
    });
    cur.gallery = gal;
    return box;
  }

  /* ---------- Scrolling text and unified navigation ---------- */
  // Logical text position: the target of the last programmatic scroll while
  // smooth scrolling runs, else the actual position (two quick presses don't
  // restart from an intermediate position).
  function textPos() { return cur.textAt != null ? cur.textAt : cur.desc.scrollTop; }
  // What the text can still do: does it overflow, is there text left above
  // (up) or below (down) the logical position.
  function textState() {
    if (!cur || cur.text.hidden) return { over: false, up: false, down: false };
    var el = cur.desc, max = el.scrollHeight - el.clientHeight, pos = textPos();
    return { over: max > 1, up: pos > 1, down: pos < max - 1 };
  }
  // Scrolls the text by one page (its visible height) down (d > 0) or up;
  // returns true if it moved.
  function pageText(d) {
    var st = textState();
    if (d > 0 ? !st.down : !st.up) return false;
    var el = cur.desc, max = el.scrollHeight - el.clientHeight;
    var target = Math.max(0, Math.min(max, textPos() + d * el.clientHeight));
    cur.textAt = target;
    if (el.scrollTo) el.scrollTo({ top: target, behavior: reduceMotion ? 'auto' : 'smooth' });
    else el.scrollTop = target;
    clearTimeout(cur.textTimer);
    cur.textTimer = setTimeout(function () { if (cur) { cur.textAt = null; updateNav(); } }, TEXT_SETTLE);
    return true;
  }
  // Unified navigation (‹ › arrows, click on the photo, ← →, swipe): "next"
  // goes to the next photo if any AND scrolls the text by a page if some is
  // left; on the last photo only the text still scrolls; "previous" mirrors
  // it. No wrapping.
  function navigate(d) {
    if (!cur || flying) return;
    var gal = cur.gallery;
    if (gal) {
      var k = gal.at + d;
      if (k >= 0 && k < gal.list.length) gal.show(k, true);
    }
    pageText(d);
    updateNav();
  }
  // Text fades and arrow state based on what can still move: an arrow that
  // neither photos nor text can follow is greyed out (aria-disabled). ▲ ▼:
  // projects without a gallery, overflowing text only.
  function updateNav() {
    if (!cur) return;
    var st = textState();
    cur.desc.classList.toggle('fade-t', st.up);
    cur.desc.classList.toggle('fade-b', st.down);
    var gal = cur.gallery;
    cur.textNav.hidden = !!gal || !st.over;
    setArrow(cur.textUp, st.up);
    setArrow(cur.textDown, st.down);
    if (gal) {
      var last = gal.list.length - 1;
      setArrow(gal.prev, gal.at > 0 || st.up);
      setArrow(gal.next, gal.at < last || st.down);
      gal.prev.hidden = gal.next.hidden = !(last > 0 || st.over);
    }
  }
  function setArrow(b, on) {
    b.classList.toggle('off', !on);
    b.setAttribute('aria-disabled', on ? 'false' : 'true');
  }

  function setHint() {
    if (!hint) return;
    var gal = !!(cur && cur.gallery && !closing);
    hint.textContent = gal ? (HINT_GALLERY[Site.lang()] || HINT_GALLERY.en) : Site.t('shelf.hint');
  }
  document.addEventListener('cc:lang', setHint);

  // Role label: the random horizontal position is pulled back into the media
  // area based on the label's actual width projected at 10° (same logic as
  // placeRole in dividers.js) — otherwise a long role leaves the cover.
  // offsetWidth is a layout measure: correct even during flight.
  function placeRole() {
    var role = cur && cur.wrap.querySelector('.player-role');
    var pw = cur && cur.wrap.offsetWidth;
    if (!role || !pw) return;
    var rad = ROLE_ANGLE * Math.PI / 180;
    var large = role.offsetWidth * Math.cos(rad) + role.offsetHeight * Math.sin(rad);
    var margePct = ((large / 2 + 4) / pw) * 100;
    var pct = margePct * 2 >= 100 ? 50 : Math.min(100 - margePct, Math.max(margePct, cur.roleLeft));
    role.style.left = pct.toFixed(1) + '%';
  }

  // Scrolling tab row: the active tab is brought to the center.
  function centerTab(j) {
    var tab = cur.tabs.children[j];
    if (!tab) return;
    cur.tabs.scrollLeft = tab.offsetLeft + tab.offsetWidth / 2 - cur.tabs.clientWidth / 2;
  }

  // Height taken by everything except the media (measured: the title has its
  // font, the text block its capped height), bottom margins and gaps included.
  // Top margins are ignored: the text block's is "auto" (it absorbs free
  // space) and getComputedStyle would return the used value, i.e. all the
  // cover's free space.
  function fixedHeight() {
    var cs = getComputedStyle(cur.cover);
    var gap = parseFloat(cs.rowGap) || 12;
    var sum = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    var kids = cur.cover.children, count = 0;
    for (var k = 0; k < kids.length; k++) {
      var s = getComputedStyle(kids[k]);
      if (s.display === 'none') continue;
      count++;
      sum += parseFloat(s.marginBottom) || 0;
      if (kids[k] !== cur.wrap) sum += kids[k].getBoundingClientRect().height;
    }
    return sum + gap * Math.max(0, count - 1);
  }

  // Media area in pixels, by mode:
  //  - 16:9: full inner width while the height allows, else the frame
  //    shrinks (the text keeps its space);
  //  - 9:16: all available height, width derived, frame centered;
  //  - gallery: all the space (desktop) or at most 1.25 × the width (phone).
  // On phones the cover takes the height of its content.
  // Call when .book3d has no transform (measurements are in screen px).
  function sizeCover() {
    var box = cur.box, g = geo, cover = cur.cover, mode = cur.mode || 'landscape';
    var cs = getComputedStyle(cover);
    var innerW = box.Wc - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
    var pw = Math.round(innerW), ph;
    var limit = box.cap;
    if (g.landscape) cover.classList.add('tight');
    // The text under the media always keeps its space (capped at 3-4 lines,
    // scrolling absorbs the rest): when height runs short, the media shrinks
    // (down to minH), the text is never dropped — except on landscape phones
    // (.tight), where there's no room for anything.
    var fixed = fixedHeight();
    var avail = Math.floor(limit - fixed);
    var minH = g.landscape ? 120 : 160;
    if (mode === 'landscape') {
      ph = Math.round(pw * 9 / 16);
      if (ph > avail) {
        ph = Math.max(minH, avail);
        pw = Math.round(ph * 16 / 9);
      }
    } else if (mode === 'portrait') {
      ph = Math.max(minH, avail);
      pw = Math.round(ph * 9 / 16);
      if (pw > innerW) { pw = Math.round(innerW); ph = Math.round(pw * 16 / 9); }
    } else if (mode === 'phones') {
      // n phones side by side across the width, never taller than the space;
      // never narrower than PHONE_MIN: if needed the row scrolls.
      var grp = cur.items[selectedProject[cur.i]] || { phones: [] };
      var n = grp.phones.length || 1;
      var capH = grp.phones.length && phoneCaptions(grp).some(function (c) { return !!c; }) ? PHONE_CAP : 0;
      var gapP = g.mobile ? 8 : 12;
      var w = Math.min(Math.floor((innerW - gapP * (n - 1)) / n), Math.floor(Math.max(minH, avail - capH) * 9 / 16));
      w = Math.max(Math.min(PHONE_MIN, Math.floor(Math.max(minH, avail - capH) * 9 / 16)), w);
      ph = Math.round(w * 16 / 9) + capH;
      pw = Math.round(innerW);
      cur.player.style.setProperty('--phone-w', w + 'px');
      cur.player.style.setProperty('--phone-gap', gapP + 'px');
    } else {
      ph = Math.max(minH, g.mobile ? Math.min(avail, Math.round(pw * 1.25)) : avail);
    }
    cur.player.style.width = pw + 'px';
    cur.player.style.height = ph + 'px';
    // The 9:16 frame is centered in a full-width area: the role label can thus
    // use the whole cover, not just the phone.
    cur.wrap.style.width = (mode === 'portrait' ? Math.round(innerW) : pw) + 'px';
    if (cur.tabs) {
      // Tabs span the whole media area (not just the 9:16 phone).
      cur.tabs.style.width = cur.wrap.style.width;
      cur.tabs.classList.toggle('scrolls', cur.tabs.scrollWidth > cur.tabs.clientWidth + 1);
      centerTab(selectedProject[cur.i]);
    }
    if (g.mobile) {
      // Single row: a cover is never shorter than its spine, otherwise the
      // ghost's top would stick out above the open book (up to 26 px measured).
      // In tiers the cover is centered on screen and the ghost stays visible in
      // place, whatever its tier.
      var minHc = g.landscape || g.tiered ? 0 : Math.min(limit, nodes[cur.i].h + 8);
      box.Hc = Math.max(Math.round(fixed + ph), minHc);
      if (g.landscape) {
        // Landscape: the jacket tightens around the media (otherwise 820 px
        // wide for a 300 px player) and centers on the stage.
        var needW = Math.round(pw + box.Wc - innerW);
        if (needW < box.Wc) {
          box.Wc = needW;
          box.left = Math.round((g.stageW - box.Wc) / 2);
          cur.el.style.left = box.left + 'px';
          cur.el.style.width = box.Wc + 'px';
        }
        box.top = Math.round(g.chrome + (g.stageH - box.Hc) / 2);
      } else if (g.tiered) {
        box.top = Math.round(g.chrome + (g.stageH - box.Hc) / 2);
      } else {
        box.top = g.shelfY - box.Hc;
      }
      cur.el.style.top = box.top + 'px';
      cur.el.style.height = box.Hc + 'px';
    }
    placeRole();
  }

  function placeCover(box) {
    cur.box = box;
    cur.el.style.left = box.left + 'px';
    cur.el.style.top = box.top + 'px';
    cur.el.style.width = box.Wc + 'px';
    cur.el.style.height = box.Hc + 'px';
    sizeCover();
  }

  // Spine face of the 3D object: the spine at its real size, enlarged by 1/k
  // to fill Hc — so at scale(k) it measures exactly w × h. The
  // translate3d(-1px, 0, 1px) lifts the spine face off the cover plane (the
  // two planes no longer touch at the edge): without it, Chrome's depth
  // sorting painted the cover over the spine during flight (the player's
  // black frame covered the name).
  function setSpine3d(node, k) {
    var sp = cur.el.querySelector('.book3d-spine');
    sp.style.width = node.w + 'px';
    sp.style.height = node.h + 'px';
    sp.style.transform = 'translate3d(-1px, 0, 1px) rotateY(-90deg) scale(' + (1 / k).toFixed(5) + ')';
    cur.el.style.setProperty('--w', node.w + 'px');
    cur.el.style.setProperty('--t', (node.w / k).toFixed(2) + 'px');
    return sp;
  }

  // Recenters book i's row on it and spreads its neighbours (those in its
  // tier; other tiers don't move).
  function spread(i, box) {
    var node = nodes[i];
    var delta = geo.stageW / 2 - (restLeft(node) + node.w / 2);
    tiers.forEach(function (t, k) { t.row.style.setProperty('--delta', k === node.tier ? delta.toFixed(2) + 'px' : '0px'); });
    stage.style.setProperty('--split', ((box.Wc + 64 - node.w) / 2).toFixed(2) + 'px');
    nodes.forEach(function (n, j) {
      if (n.tier !== node.tier || j === i) n.el.removeAttribute('data-side');
      else n.el.setAttribute('data-side', j < i ? 'l' : 'r');
    });
    stage.classList.add('is-open');
  }
  function resetRows() {
    tiers.forEach(function (t) { t.row.style.setProperty('--delta', '0px'); });
  }

  /* ---------- Open / close ---------- */
  function open(i) {
    if (flying || opened !== null || !nodes[i]) return;
    var node = nodes[i];
    opened = i;
    flying = true;
    openedAt = Date.now();
    Site.track('book:' + node.client.name);
    var myGen = ++gen;
    geo = measure();
    // Row frozen and spines removed from the tab order: a Tab to an
    // off-screen spine would scroll .shelf-scroll (overflow hidden is still
    // scrollable by focus) under the cover.
    lockedScroll = scroll.scrollLeft;
    nodes.forEach(function (n) { n.el.tabIndex = -1; });
    var g = geo, box = coverBox(g);

    // 1. The 3D object at its final place, empty black frame (media waits for the flight to end).
    cur = buildBook3d(i);
    layer.appendChild(cur.el);
    renderProject(i, selectedProject[i], true);
    placeCover(box);

    // 2. Start: the slot's untilted rect (even for a leaning book), where it
    // actually is on screen (the page may have scrolled).
    var r = node.el.getBoundingClientRect();
    var k = Math.max(0.05, r.height / box.Hc);
    var dx = r.left - box.left, dy = r.bottom - (box.top + box.Hc);
    var sp = setSpine3d(node, k);
    var el = cur.el;
    el.style.transition = 'none';
    el.style.transform = bookTransform(dx, dy, k, 90);
    sp.style.transition = 'none';
    sp.style.opacity = '1';
    void el.offsetWidth; // force the starting style to be computed (FLIP)
    // S-curve: with the spec's (.22,.9,.24,1), 89% of the quarter turn was done
    // in 220 ms and the volume wasn't visible.
    el.style.transition = 'transform ' + ms(700) + ' ' + EASE;
    el.style.transform = bookTransform(0, 0, 1, 0);
    // The spine face fades out near the end (from ~30° to ~12°): almost edge-on,
    // it would be just a thread that, pointing at the visitor, would project
    // above the cover.
    sp.style.transition = 'opacity ' + ms(120) + ' linear ' + ms(380);
    sp.style.opacity = '0';

    // 3. At the same moment: ghost, spreading, cross.
    node.el.classList.add('ghost');
    node.el.setAttribute('aria-expanded', 'true');
    spread(i, box);
    closeBtn.classList.add('on');

    Site.afterTransition(el, 'transform', function () {
      if (myGen !== gen || opened !== i || !cur) return;
      // Landed: no more matrix (crisp 2D text), nothing composited in 3D, the
      // screen turns on.
      cur.el.style.transition = 'none';
      cur.el.style.transform = 'none';
      cur.el.classList.add('settled');
      lightPlayer(cur.items[selectedProject[i]] || { p: {} });
      flying = false;
      try { cur.el.focus({ preventScroll: true }); } catch (e) { cur.el.focus(); }
    }, 900);
  }

  // Accepted even while opening. First step: stop the video; second: fade out
  // the media area (120 ms fade, cover still); only then does the cover turn
  // and the book return to its place.
  function close() {
    if (opened === null || !cur || closing) return;
    cur.player.innerHTML = '';
    cur.gallery = null;
    var i = opened, node = nodes[i], el = cur.el, box = cur.box;
    var myGen = ++gen;
    flying = true;
    closing = true;
    el.classList.remove('settled');
    el.classList.add('closing');
    setHint();

    // Target: the ghost's closed position (the row returns to --delta 0),
    // measured now: the page may have scrolled since opening.
    var r = node.el.getBoundingClientRect();
    var k = Math.max(0.05, r.height / box.Hc);
    var dx = restLeft(node) - box.left, dy = r.bottom - (box.top + box.Hc);
    var sp = setSpine3d(node, k);
    // Explicit start (not "none"): both ends of the transition have the same
    // function list, so the perspective is constant in flight.
    el.style.transition = 'none';
    el.style.transform = bookTransform(0, 0, 1, 0);
    sp.style.transition = 'none';
    sp.style.opacity = '0';
    void el.offsetWidth;
    el.style.transition = 'transform ' + ms(600) + ' ' + EASE + ' ' + ms(FADE_MEDIA);
    el.style.transform = bookTransform(dx, dy, k, 90);
    // Mirror of opening: the spine face only appears once the book has turned
    // about twenty degrees (never a thread above the book).
    sp.style.transition = 'opacity ' + ms(120) + ' linear ' + ms(FADE_MEDIA + 140);
    sp.style.opacity = '1';
    resetRows();
    stage.classList.remove('is-open');
    closeBtn.classList.remove('on');

    Site.afterTransition(el, 'transform', function () {
      if (myGen !== gen) return;
      finishClose(i, true);
    }, 1100);
  }

  function finishClose(i, refocus) {
    if (cur) clearTimeout(cur.textTimer);
    layer.innerHTML = '';
    cur = null;
    var node = nodes[i];
    if (node) {
      node.el.classList.remove('ghost');
      node.el.setAttribute('aria-expanded', 'false');
    }
    nodes.forEach(function (n) { n.el.removeAttribute('data-side'); n.el.removeAttribute('tabindex'); });
    lockedScroll = null;
    stage.classList.remove('is-open');
    resetRows();
    closeBtn.classList.remove('on');
    opened = null;
    flying = false;
    closing = false;
    setHint();
    if (node && refocus) { try { node.el.focus({ preventScroll: true }); } catch (e) {} }
  }

  // Another spine clicked while a book is open: the cover fades without a
  // return flight, the next one leaves from its slot; spreading continues from
  // the current state (a single row movement).
  function switchTo(j) {
    if (flying || opened === null || !cur || !nodes[j] || j === opened) return;
    var i = opened, old = cur.el;
    cur.player.innerHTML = '';
    cur.gallery = null;
    clearTimeout(cur.textTimer);
    ++gen;
    old.style.transition = 'opacity ' + ms(200) + ' ease';
    old.style.opacity = '0';
    old.style.pointerEvents = 'none';
    Site.afterTransition(old, 'opacity', function () {
      if (old.parentNode) old.parentNode.removeChild(old);
    }, 400);
    nodes[i].el.classList.remove('ghost');
    nodes[i].el.setAttribute('aria-expanded', 'false');
    opened = null;
    cur = null;
    open(j);
  }

  /* ---------- Resize ---------- */
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(onResize, 120);
  });
  function onResize() {
    if (!content || !nodes.length) return;
    if (flying) { resizeTimer = setTimeout(onResize, 300); return; }
    var now = measure();
    // Crossing the breakpoint, a mode change (row ↔ tiers) or a width change
    // in tiers (the book split would change): instant close, then rebuild. A
    // height-only change (phone address bar) closes nothing: everything is
    // repositioned.
    if (opened !== null && (geo.mobile !== now.mobile || geo.tiered !== now.tiered || (now.tiered && geo.stageW !== now.stageW))) {
      ++gen;
      finishClose(opened, false);
      build(content);
      return;
    }
    if (opened === null) { layout(); return; }
    // Book open: everything repositions without animation, the media is kept.
    stage.classList.add('no-anim');
    cur.el.classList.add('no-anim');
    lockedScroll = null;
    layout();
    lockedScroll = scroll.scrollLeft;
    placeCover(coverBox(geo));
    spread(opened, cur.box);
    updateNav();
    void stage.offsetWidth;
    requestAnimationFrame(function () {
      stage.classList.remove('no-anim');
      if (cur) cur.el.classList.remove('no-anim');
    });
  }

  /* ---------- Interactions ---------- */
  // Click on the stage background, a board or between books of a tier:
  // closes. A click on the cover doesn't close (a video or photos are being
  // viewed there).
  stage.addEventListener('click', function (e) {
    var t = e.target, c = t.classList;
    if (t === stage || t === scroll || (c && (c.contains('shelf-row') || c.contains('shelf-tier') || c.contains('shelf-board')))) close();
  });
  closeBtn.addEventListener('click', close);

  // Overflowing row: the vertical wheel scrolls horizontally.
  scroll.addEventListener('wheel', function (e) {
    if (!overflow || opened !== null) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      scroll.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });

  // Book open: the row stays put (focus, find-in-page…).
  scroll.addEventListener('scroll', function () {
    if (lockedScroll !== null && scroll.scrollLeft !== lockedScroll) scroll.scrollLeft = lockedScroll;
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { close(); return; }
    // Book open: ↑ ↓ scroll the text by a page when some is left.
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (cur && !flying && pageText(e.key === 'ArrowDown' ? 1 : -1)) { e.preventDefault(); updateNav(); }
      return;
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    var dir = e.key === 'ArrowRight' ? 1 : -1;
    // Gallery shown: arrows page through photos and text, not books.
    if (cur && cur.gallery && !flying) { e.preventDefault(); navigate(dir); return; }
    if (opened !== null) {
      var j = opened + dir;
      if (nodes[j]) { e.preventDefault(); switchTo(j); }
      return;
    }
    var a = document.activeElement;
    if (a && a.classList && a.classList.contains('book')) {
      var k = parseInt(a.getAttribute('data-index'), 10) + dir;
      if (nodes[k]) { e.preventDefault(); nodes[k].el.focus(); }
    }
  });

  window.addEventListener('DOMContentLoaded', function () {
    Site.mountChrome();
    Site.loadContent().then(function (json) {
      build(json);
      var params = new URLSearchParams(location.search);
      if (params.has('open')) {
        var idx = parseInt(params.get('open'), 10);
        if (!isNaN(idx) && idx >= 0 && idx < clients.length) open(idx);
      }
    });
  });
})();
