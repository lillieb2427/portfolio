/* audrey-lillie portfolio — shared base: i18n, theme, header, content, fonts, videos */
window.Site = (function () {
  'use strict';

  /* ---------- Palettes ---------- */
  var PALETTE_MAIN = ['#B4BCAC', '#E9F072', '#EC7448', '#1C2440', '#F3D163', '#7C8CD9', '#DFEFFB', '#520D28', '#D63F64', '#3D7565'];
  var PALETTE_CORPO = ['#DFEFFB', '#B4BCAC', '#D8D4C6', '#A8B5C9', '#1C2440', '#3D7565', '#8B93A7', '#E8E2D5', '#64748B', '#94A3B8'];

  /* ---------- Fonts ---------- */
  var GOOGLE_FONTS = ['Anton', 'Archivo', 'Bebas Neue', 'DM Serif Display', 'IBM Plex Mono', 'Space Grotesk', 'Syne', 'Oswald', 'Playfair Display', 'Barlow Condensed', 'Unbounded', 'Caveat', 'Pacifico', 'Bricolage Grotesque', 'Libre Caslon Text', 'Special Elite'];
  var SYSTEM_FONTS = {
    'Helvetica': "'Helvetica Neue', Helvetica, Arial, sans-serif",
    'Georgia': "Georgia, 'Times New Roman', serif",
    'Courier New': "'Courier New', Courier, monospace",
    'Times New Roman': "'Times New Roman', Times, serif",
    'Verdana': 'Verdana, Geneva, sans-serif',
    'Trebuchet MS': "'Trebuchet MS', sans-serif",
    'Impact': 'Impact, Charcoal, sans-serif',
  };
  var SERIF_GF = { 'DM Serif Display': 1, 'Playfair Display': 1, 'Libre Caslon Text': 1 };
  var MONO_GF = { 'IBM Plex Mono': 1 };

  /* ---------- i18n ---------- */
  var I18N = {
    en: {
      'nav.home': 'Home',
      'nav.about': 'About me',
      'nav.youtube': 'Design',
      'nav.shorts': 'Gallery',
      'nav.brand': 'Collabs',
      'shorts.hint': 'DRAG TO EXPLORE · CLICK A SCREEN TO PLAY',
      'shorts.close': 'CLOSE ✕',
      'divider.close': 'Close',
      'shelf.hint': 'CLICK A SPINE TO OPEN THE BOOK · ESC TO CLOSE',
      'about.tab.desc': 'About me',
      'about.tab.cv': 'Experience',
      'about.tab.edu': 'Education',
      'about.tab.hobbies': 'Hobbies',
      'about.tab.content': 'Content creation',
      'about.how.a': 'How I',
      'about.how.b': 'to work',
      'about.followers': 'followers',
      'about.collab': 'Collab',
      'about.videos': 'Videos',
      'about.photos': 'Photos',
      'nav.contact': 'Contact me',
      'about.nophoto': 'NO PHOTO ON FILE',
      'about.empty': 'Nothing filed here yet…',
      'about.tablist': 'About me file',
      'player.soon': 'VIDEO COMING SOON',
      'lang.en': 'English',
      'lang.fr': 'French',
      'theme.toggle': 'Dark / light mode',
    },
  };

  // The site is English-only.
  var lang = 'en';

  function t(key) {
    return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
  }

  function applyLang() {
    document.documentElement.lang = lang;
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    // Text-less buttons (home logo, close cross): the tooltip and the
    // screen-reader name follow the language, like the labels.
    var labels = document.querySelectorAll('[data-i18n-label]');
    for (var k = 0; k < labels.length; k++) {
      var label = t(labels[k].getAttribute('data-i18n-label'));
      labels[k].title = label;
      labels[k].setAttribute('aria-label', label);
    }
    var flags = document.querySelectorAll('.flag-btn');
    for (var j = 0; j < flags.length; j++) flags[j].classList.toggle('active', flags[j].getAttribute('data-lang') === lang);
  }

  function setLang(l) {
    lang = 'en';
    applyLang();
    document.dispatchEvent(new CustomEvent('cc:lang', { detail: { lang: lang } }));
  }

  // Bilingual content field: each text entered in the admin has an optional
  // English twin, same key + "_en". In English the "_en" version is shown if
  // filled in; otherwise the base (French) text is used. Pages re-read their
  // fields through this function on every cc:lang and update text in place.
  function tr(obj, key) {
    if (!obj) return '';
    var en = obj[key + '_en'];
    if (lang === 'en' && typeof en === 'string' && en.trim()) return en;
    return obj[key] || '';
  }

  /* ---------- Theme ---------- */
  function theme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }
  function setTheme(mode) {
    if (mode === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('cc_theme', mode); } catch (e) {}
    document.dispatchEvent(new CustomEvent('cc:theme', { detail: { theme: mode } }));
  }

  /* ---------- Shared header ---------- */
  var NAV_ITEMS = [
    { key: 'nav.about', href: 'about', vb: '0 0 213.38 93.44', sw: 10, d: 'M183.13,11.74C134.71-3.89,81.19-3.2,33.2,13.67c-8.99,3.16-18.05,7.04-24.66,13.91S-1.69,44.94,1.93,53.76c3.93,9.58,14.62,14.23,24.42,17.56,43.2,14.69,88.88,22.03,134.51,21.61,13.58-.13,28.09-1.26,38.83-9.57,8.48-6.56,13.54-17.33,13.18-28.05-.36-10.72-6.14-21.12-15.05-27.09' },
    { key: 'nav.youtube', href: 'youtube', vb: '0 0 169.38 70.6', sw: 7.5, d: 'M25.01,47.31c35.51,12.13,73.93,15.65,111.05,10.15,7.48-1.11,15.1-2.65,21.52-6.65s11.48-10.95,11.29-18.51c-.17-6.62-4.31-12.66-9.65-16.58s-11.76-6.04-18.15-7.78C101.82-2.82,59.44-1.88,20.7,10.6,12.25,13.32,2.84,17.82.86,26.47c-1.57,6.86,2.28,13.78,6.79,19.17,11.44,13.67,28.34,22.64,46.07,24.46' },
    { key: 'nav.shorts', href: 'shorts', vb: '0 0 138.36 60.64', sw: 7.5, d: 'M99.55,4.18C75.02-1.92,48.64-.4,24.96,8.49c-7.15,2.68-14.28,6.19-19.18,12.05s-7.07,14.54-3.53,21.31c3.48,6.65,11.2,9.74,18.42,11.78,26.99,7.63,55.68,8,83.44,3.99,7.13-1.03,14.36-2.39,20.68-5.84,6.32-3.45,11.69-9.32,12.87-16.43s-2.85-15.19-9.78-17.14' },
    { key: 'nav.brand', href: 'brand', vb: '0 0 97.16 70.7', sw: 5, d: 'M71.22,19.24c-13.49-5.96-28.93-7.43-43.3-4.12C15.64,17.95,2.96,25.83.8,38.24c-2.07,11.92,6.84,23.68,17.97,28.44s23.82,3.94,35.75,1.94c9.46-1.58,19.02-3.95,27.07-9.17s14.45-13.75,15.02-23.32c.62-10.36-5.72-20.26-14.27-26.14C73.79,4.1,63.33,1.67,53.01.5' },
  ];

  // "Contact me" is not a page: a button, right of Brand content, that lays the
  // badge over the current page. Same red outline as "About me" (both labels
  // have the same length).
  var NAV_CONTACT = { key: 'nav.contact', vb: NAV_ITEMS[0].vb, sw: NAV_ITEMS[0].sw, d: NAV_ITEMS[0].d };

  function navUnderline() { return ''; }

  function mountChrome() {
    var header = document.createElement('header');
    header.className = 'site-header';
    var html = '<nav class="site-nav">';
    for (var i = 0; i < NAV_ITEMS.length; i++) {
      var it = NAV_ITEMS[i];
      html += '<a href="' + it.href + '" class="nav-item">' +
        '<span data-i18n="' + it.key + '"></span>' + navUnderline(it) + '</a>';
    }
    html += '<button type="button" class="nav-item nav-contact" aria-haspopup="dialog" aria-expanded="false">' +
      '<span data-i18n="' + NAV_CONTACT.key + '"></span>' + navUnderline(NAV_CONTACT) + '</button>';
    html += '</nav>';
    header.innerHTML = html;
    document.body.prepend(header);
    header.querySelector('.nav-contact').addEventListener('click', openContact);
    // Escape closes the badge; other pages also listen for Escape for their
    // own player, with no effect when it is closed.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeContact();
    });

    var controls = document.createElement('div');
    controls.className = 'site-controls';
    controls.innerHTML =
      '<div class="ctrl-group">' +
      '<button class="theme-btn" type="button">' +
      '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.4"/><path d="M12 2v2.6M12 19.4V22M2 12h2.6M19.4 12H22M4.9 4.9l1.9 1.9M17.2 17.2l1.9 1.9M4.9 19.1l1.9-1.9M17.2 6.8l1.9-1.9"/></svg>' +
      '<svg class="icon-moon" viewBox="0 0 24 24" fill="currentColor"><path d="M20.6 14.6A8.6 8.6 0 0 1 9.4 3.4a8.6 8.6 0 1 0 11.2 11.2z"/></svg>' +
      '</button></div>';
    document.body.appendChild(controls);

    var flagBtns = controls.querySelectorAll('.flag-btn');
    for (var f = 0; f < flagBtns.length; f++) {
      flagBtns[f].addEventListener('click', function () { setLang(this.getAttribute('data-lang')); });
      flagBtns[f].title = t('lang.' + flagBtns[f].getAttribute('data-lang'));
    }
    var themeBtn = controls.querySelector('.theme-btn');
    themeBtn.title = t('theme.toggle');
    themeBtn.addEventListener('click', function () { setTheme(theme() === 'dark' ? 'light' : 'dark'); });

    // Back to the landing page: the logo, fixed top-left, mirroring the
    // controls on the right. Absent from the landing itself, detected by its
    // markup rather than its URL: that is "/" or "/index.html" depending on the
    // server (cleanUrls on Vercel, dev-server locally) and would change again
    // if the site were served under a sub-path.
    if (!document.querySelector('body > main.home-root')) {
      var home = document.createElement('a');
      home.className = 'home-btn';
      home.href = './';
      home.setAttribute('data-i18n-label', 'nav.home');
      home.innerHTML = '<img src="assets/img/logo-black.png" alt="">';
      document.body.appendChild(home);
    }

    applyLang();
    sendView();
  }

  /* ---------- Content ---------- */
  var contentCache = null;
  var contentPending = null;
  function loadContent() {
    if (contentCache) return Promise.resolve(contentCache);
    if (contentPending) return contentPending;
    // Admin logged in in this tab (or opened from the admin): the password is
    // sent with the read, so the site is visible despite maintenance.
    var headers = {};
    try { var apw = sessionStorage.getItem('cc_admin_pw'); if (apw) headers['x-admin-password'] = apw; } catch (e) {}
    contentPending = fetch('api/content', { cache: 'no-store', headers: headers })
      .then(function (r) { if (!r.ok) throw new Error('api'); return r.json(); })
      .catch(function () {
        return fetch('data/content.json', { cache: 'no-store' }).then(function (r) { return r.json(); });
      })
      .then(function (json) {
        var on = json && json.maintenance === true;
        try { if (on) localStorage.setItem('cc_maint', '1'); else localStorage.removeItem('cc_maint'); } catch (e) {}
        // Visitor during maintenance: the API returned only the flag. The
        // maintenance screen covers everything and the page is never built.
        if (on && !json.youtube) { showMaintenance(); return new Promise(function () {}); }
        hideMaintenance();
        if (on) showMaintenanceBadge();
        contentCache = json;
        return json;
      });
    return contentPending;
  }

  /* ---------- Maintenance ---------- */
  // Full-screen overlay over any site page (never the admin): a "site under
  // maintenance" bubble. Shown immediately if the last visit saw it
  // (localStorage), then confirmed or lifted once content is read.
  var MAINT = {
    en: { title: 'Site under maintenance', text: 'A few things are being polished. Back very soon ✦', badge: 'Maintenance is ON — visitors see the maintenance screen (admin preview)' }
  };
  var maintEl = null;
  function isAdminPage() { return /\/admin(\.html)?\/?$/.test(location.pathname); }
  function fillMaintenance() {
    if (!maintEl) return;
    var m = MAINT[lang] || MAINT.en;
    maintEl.querySelector('.maint-title').textContent = m.title;
    maintEl.querySelector('.maint-text').textContent = m.text;
  }
  function showMaintenance() {
    if (isAdminPage() || !document.body) return;
    if (!maintEl) {
      maintEl = document.createElement('div');
      maintEl.className = 'maint-screen';
      maintEl.setAttribute('role', 'alertdialog');
      maintEl.setAttribute('aria-modal', 'true');
      maintEl.innerHTML = '<div class="maint-bubble"><span class="maint-dot" aria-hidden="true"></span><p class="maint-title"></p><p class="maint-text"></p></div>';
      document.body.appendChild(maintEl);
    }
    fillMaintenance();
    document.documentElement.classList.add('is-maintenance');
  }
  function hideMaintenance() {
    if (maintEl && maintEl.parentNode) maintEl.parentNode.removeChild(maintEl);
    maintEl = null;
    document.documentElement.classList.remove('is-maintenance');
  }
  function showMaintenanceBadge() {
    if (isAdminPage() || document.querySelector('.maint-badge')) return;
    var b = document.createElement('div');
    b.className = 'maint-badge';
    b.textContent = (MAINT[lang] || MAINT.en).badge;
    document.body.appendChild(b);
  }
  document.addEventListener('cc:lang', fillMaintenance);
  // Every site page (landing included) checks for maintenance.
  document.addEventListener('DOMContentLoaded', function () {
    if (isAdminPage()) return;
    var seen = false;
    try { seen = localStorage.getItem('cc_maint') === '1'; } catch (e) {}
    var admin = false;
    try { admin = !!sessionStorage.getItem('cc_admin_pw'); } catch (e) {}
    if (seen && !admin) showMaintenance();
    loadContent().catch(function () {});
  });

  /* ---------- Font resolution & loading ---------- */
  function customFonts(content) {
    return (content && content.fonts && content.fonts.custom) || [];
  }
  function findCustom(content, name) {
    var list = customFonts(content);
    for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i];
    return null;
  }
  function fontStack(name, content) {
    if (!name) return SYSTEM_FONTS['Helvetica'];
    if (SYSTEM_FONTS[name]) return SYSTEM_FONTS[name];
    var generic = SERIF_GF[name] ? 'serif' : MONO_GF[name] ? 'monospace' : 'sans-serif';
    return "'" + name.replace(/'/g, '') + "', " + generic;
  }
  var loadedGoogle = {};
  var loadedFace = {};
  function ensureFonts(names, content) {
    var google = [];
    var faces = [];
    for (var i = 0; i < names.length; i++) {
      var n = names[i];
      if (!n || SYSTEM_FONTS[n]) continue;
      var custom = findCustom(content, n);
      if (custom && custom.kind === 'file' && custom.url) {
        if (!loadedFace[n]) { loadedFace[n] = 1; faces.push(custom); }
      } else if (custom && custom.kind === 'google') {
        if (!loadedGoogle[n]) { loadedGoogle[n] = 1; google.push(n); }
      } else if (GOOGLE_FONTS.indexOf(n) !== -1) {
        if (!loadedGoogle[n]) { loadedGoogle[n] = 1; google.push(n); }
      } else if (!loadedGoogle[n]) {
        // unknown name: try Google Fonts
        loadedGoogle[n] = 1;
        google.push(n);
      }
    }
    if (google.length) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?' +
        google.map(function (g) { return 'family=' + encodeURIComponent(g).replace(/%20/g, '+'); }).join('&') +
        '&display=swap';
      document.head.appendChild(link);
    }
    if (faces.length) {
      var css = '';
      for (var j = 0; j < faces.length; j++) {
        css += "@font-face{font-family:'" + faces[j].name.replace(/'/g, '') + "';src:url('" +
          faces[j].url.replace(/'/g, '') + "');font-display:swap;}";
      }
      var st = document.createElement('style');
      st.textContent = css;
      document.head.appendChild(st);
    }
  }

  /* ---------- Videos ---------- */
  function parseVideo(url) {
    url = (url || '').trim();
    if (!url) return null;
    var m = url.match(/(?:youtube\.com\/(?:watch\?[^#]*v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{5,20})/);
    if (m) return { type: 'youtube', id: m[1], embed: 'https://www.youtube-nocookie.com/embed/' + m[1] + '?autoplay=1&rel=0&playsinline=1' };
    m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (m) return { type: 'vimeo', id: m[1], embed: 'https://player.vimeo.com/video/' + m[1] + '?autoplay=1' };
    m = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
    if (m) return { type: 'drive', id: m[1], embed: 'https://drive.google.com/file/d/' + m[1] + '/preview' };
    // Instagram and TikTok forbid their normal pages in an iframe
    // (X-Frame-Options) but publish a dedicated embed endpoint.
    m = url.match(/instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(reels?|p|tv)\/([A-Za-z0-9_-]{5,20})/);
    if (m) {
      var kind = m[1] === 'reels' ? 'reel' : m[1];
      return { type: 'instagram', id: m[2], embed: 'https://www.instagram.com/' + kind + '/' + m[2] + '/embed/' };
    }
    m = url.match(/tiktok\.com\/(@[A-Za-z0-9_.-]+)\/video\/(\d+)/);
    if (m) return { type: 'tiktok', id: m[2], user: m[1], embed: 'https://www.tiktok.com/player/v1/' + m[2] + '?autoplay=1' };
    if (/\.(mp4|webm|mov|m4v)([?#]|$)/i.test(url)) return { type: 'file', src: url };
    return { type: 'iframe', embed: url };
  }

  // Types whose URL points to a known video page (not an image file).
  var VIDEO_PAGE_TYPES = { youtube: 1, vimeo: 1, drive: 1, instagram: 1, tiktok: 1 };

  /* ---------- Thumbnails (Shorts globe + admin preview) ---------- */
  // Maximum number of videos shown on the Shorts page globe. The admin uses
  // it to flag videos that won't appear. The globe fits about fifty
  // normal-size screens; beyond that they shrink to make room, up to this limit.
  var GLOBE_MAX = 60;

  // Candidate images for a video, no API key needed: YouTube exposes its
  // thumbnails publicly (oardefault = original format, vertical for a Short;
  // hqdefault = 4:3 fallback), Drive via its "thumbnail" endpoint.
  function thumbCandidates(url) {
    var info = parseVideo(url);
    if (!info || !info.id) return [];
    if (info.type === 'youtube') {
      return ['https://i.ytimg.com/vi/' + info.id + '/oardefault.jpg',
        'https://i.ytimg.com/vi/' + info.id + '/hqdefault.jpg'];
    }
    if (info.type === 'drive') return ['https://drive.google.com/thumbnail?id=' + info.id + '&sz=w640'];
    // Instagram doesn't publish its thumbnails: our api/thumb function tries to
    // fetch it server-side (on failure, the colored card stays).
    if (info.type === 'instagram') return ['api/thumb?url=' + encodeURIComponent(url)];
    return [];
  }

  // TikTok exposes its thumbnail (portrait, signed, valid for a few days) via
  // public keyless oEmbed with open CORS: we fetch it from the page.
  var tiktokCache = {};
  function tiktokThumb(user, id) {
    if (!tiktokCache[id]) {
      tiktokCache[id] = fetch('https://www.tiktok.com/oembed?url=' + encodeURIComponent('https://www.tiktok.com/' + user + '/video/' + id))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { return j && j.thumbnail_url ? [j.thumbnail_url] : []; })
        .catch(function () { return []; });
    }
    return tiktokCache[id];
  }

  // Vimeo has no predictable thumbnail URL: go through oEmbed.
  var vimeoCache = {};
  function vimeoThumb(id) {
    if (!vimeoCache[id]) {
      vimeoCache[id] = fetch('https://vimeo.com/api/oembed.json?url=' + encodeURIComponent('https://vimeo.com/' + id))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          var u = j && j.thumbnail_url;
          return u ? [u.replace(/_\d+x\d+(\.\w+)?$/, '_640$1'), u] : [];
        })
        .catch(function () { return []; });
    }
    return vimeoCache[id];
  }

  // Title size of a colored card: proportional to the card width (cqw units),
  // clamped so the longest word fits on one line.
  function titleSize(title) {
    var longest = 4;
    String(title || '').split(/\s+/).forEach(function (w) { longest = Math.max(longest, w.length); });
    return Math.min(22, Math.max(9, Math.round(120 / longest)));
  }

  // Short thumbnail: colored card (title, colors, font chosen in the admin)
  // covered, once loaded, by the cover image — the one uploaded in the admin,
  // else the platform's automatic thumbnail, else the video file's first
  // frame. Without an image, the card stays visible.
  function thumbNode(item, content) {
    var wrap = document.createElement('div');
    wrap.className = 'thumb';
    var bg = item.bg || '#1C2440';
    var tx = item.text || '#ffffff';
    wrap.style.background = bg;
    var card = document.createElement('div');
    card.className = 'thumb-card';
    card.style.color = tx;
    card.style.fontFamily = fontStack(item.font, content);
    // Title in the site language (title_en if filled in); pages update it in
    // place on language change.
    card.style.fontSize = titleSize(tr(item, 'title')) + 'cqw';
    card.textContent = tr(item, 'title');
    wrap.appendChild(card);

    function attachImg(list) {
      if (!list.length) return;
      var i = 0;
      var img = document.createElement('img');
      img.alt = '';
      img.draggable = false;
      img.decoding = 'async';
      img.onload = function () {
        // YouTube returns a grey 120×90 image (not an error) for a missing
        // thumbnail: treat it as a failure.
        if (img.naturalWidth > 130) wrap.classList.add('has-media');
        else next();
      };
      img.onerror = next;
      function next() {
        i++;
        if (i < list.length) img.src = list[i];
        else img.remove();
      }
      img.src = list[0];
      wrap.appendChild(img);
    }

    // The "Thumbnail" field expects an image; if the video link is pasted
    // there (Instagram, TikTok…), ignore it and fall back to the automatic
    // thumbnail rather than showing a broken image.
    var coverInfo = item.cover ? parseVideo(item.cover) : null;
    var cover = coverInfo && VIDEO_PAGE_TYPES[coverInfo.type] ? '' : (item.cover || '');
    var info = parseVideo(item.url);
    if (cover) {
      attachImg([cover]);
    } else if (info && info.type === 'file') {
      var v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.preload = 'metadata';
      v.setAttribute('muted', '');
      v.addEventListener('loadedmetadata', function () { try { v.currentTime = 0.1; } catch (e) {} });
      v.addEventListener('loadeddata', function () { wrap.classList.add('has-media'); });
      v.src = info.src;
      wrap.appendChild(v);
    } else if (info && info.type === 'vimeo') {
      vimeoThumb(info.id).then(attachImg);
    } else if (info && info.type === 'tiktok') {
      tiktokThumb(info.user, info.id).then(attachImg);
    } else {
      attachImg(thumbCandidates(item.url));
    }
    return wrap;
  }

  function playerNode(url) {
    var info = parseVideo(url);
    if (!info) {
      var ph = document.createElement('div');
      ph.className = 'player-placeholder';
      ph.setAttribute('data-i18n', 'player.soon');
      ph.textContent = t('player.soon');
      return ph;
    }
    if (info.type === 'file') {
      var v = document.createElement('video');
      v.src = info.src;
      v.controls = true;
      v.autoplay = true;
      v.playsInline = true;
      return v;
    }
    var f = document.createElement('iframe');
    f.src = info.embed;
    f.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
    f.allowFullscreen = true;
    f.title = 'video player';
    return f;
  }

  /* ---------- Contact: overlay badge holder ---------- */
  // The badge is laid over whatever page is current: built on first click
  // (content is loaded by then), then reused — a single instance in the
  // document, never duplicated.
  var contact = null;        // { backdrop, overlay, dialog, close } once built
  var contactOpen = false;
  var contactBusy = false;   // loading in progress: a second click opens nothing
  var contactOrigin = null;  // button to return focus to on close
  // Same filter as the server (api/content.js): the static fallback JSON
  // hasn't gone through sanitize.
  var PHOTO_URL = /^(https?:\/\/|\/?api\/cover\?|assets\/)/i;

  // Chrome metal: a gradient with contrasting highlights is enough to read as
  // "chrome". Gradients are declared once, in the first SVG, and referenced
  // by id from the chain (url(#…) references apply document-wide).
  var CHROME_STOPS = '<stop offset="0" stop-color="#8d9199"/><stop offset=".15" stop-color="#f7f8fa"/>' +
    '<stop offset=".35" stop-color="#b3b8c0"/><stop offset=".5" stop-color="#ffffff"/>' +
    '<stop offset=".68" stop-color="#8f949c"/><stop offset=".85" stop-color="#e3e5e9"/><stop offset="1" stop-color="#6c7078"/>';
  var HOOK_D = 'M80 90 L59 118 Q56 123 61 125 L99 125 Q104 123 101 118 Z';
  // Clip: flat tab, split ring, swivel, triangular snap hook whose bottom bar
  // passes through the holder's slot (drawn underneath).
  var CLIP_SVG = '<svg class="contact-clip" viewBox="0 0 160 134" width="160" height="134" aria-hidden="true">' +
    '<defs><linearGradient id="cc-chrome-h" x1="0" y1="0" x2="1" y2="0">' + CHROME_STOPS + '</linearGradient>' +
    '<linearGradient id="cc-chrome-v" x1="0" y1="0" x2="0" y2="1">' + CHROME_STOPS + '</linearGradient></defs>' +
    '<rect x="66" y="0" width="28" height="60" rx="7" fill="url(#cc-chrome-h)" stroke="#5d6169" stroke-width="1"/>' +
    '<rect x="71" y="5" width="3" height="50" rx="1.5" fill="#fff" opacity=".7"/>' +
    '<ellipse cx="80" cy="48" rx="6" ry="6.5" fill="#33363c"/>' +
    '<circle cx="80" cy="66" r="13" fill="none" stroke="#4e525a" stroke-width="6.5"/>' +
    '<circle cx="80" cy="66" r="13" fill="none" stroke="url(#cc-chrome-v)" stroke-width="4.5"/>' +
    '<rect x="74.5" y="78" width="11" height="13" rx="3.5" fill="url(#cc-chrome-h)" stroke="#4e525a" stroke-width="1"/>' +
    '<circle cx="80" cy="79" r="2.4" fill="#4e525a"/>' +
    '<path d="' + HOOK_D + '" fill="none" stroke="#4e525a" stroke-width="7.5" stroke-linejoin="round"/>' +
    '<path d="' + HOOK_D + '" fill="none" stroke="url(#cc-chrome-h)" stroke-width="5" stroke-linejoin="round"/>' +
    '<path d="M87 100 L97 113" stroke="#fff" stroke-width="1.2" opacity=".6"/>' +
    '<circle cx="86.5" cy="99" r="2" fill="#4e525a"/>' +
    '</svg>';
  // Ball chain (dotted stroke with round caps) hung from the ring, with a
  // heart then a star as charms.
  var CHAIN_1 = 'M41 9 C43 30 34 40 32 58';
  var CHAIN_2 = 'M32 88 C32 93 36 95 37 100';
  var HEART_D = 'M0 -3 C0 -9 -9 -9 -9 -2 C-9 4 0 9 0 12 C0 9 9 4 9 -2 C9 -9 0 -9 0 -3 Z';
  var STAR_D = 'M0 -11 L2.7 -3.7 L10.5 -3.4 L4.4 1.4 L6.5 8.9 L0 4.6 L-6.5 8.9 L-4.4 1.4 L-10.5 -3.4 L-2.7 -3.7 Z';
  function beads(d) {
    return '<path d="' + d + '" fill="none" stroke="#4e525a" stroke-width="5.4" stroke-linecap="round" stroke-dasharray="0.01 5.4"/>' +
      '<path d="' + d + '" fill="none" stroke="url(#cc-chrome-v)" stroke-width="4" stroke-linecap="round" stroke-dasharray="0.01 5.4"/>';
  }
  function charm(d, x, y, rot, k) {
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ') scale(' + k + ')">' +
      '<path d="' + d + '" fill="url(#cc-chrome-v)" stroke="#4e525a" stroke-width="1.2" stroke-linejoin="round"/>' +
      '<path d="' + d + '" fill="none" stroke="#fff" stroke-width="1" opacity=".55" transform="scale(.62)"/>' +
      '</g>';
  }
  var CHAIN_SVG = '<svg class="contact-chain" viewBox="0 0 100 150" width="100" height="150" aria-hidden="true">' +
    beads(CHAIN_1) +
    '<circle cx="32" cy="62" r="3" fill="none" stroke="#4e525a" stroke-width="2.2"/>' +
    '<circle cx="32" cy="62" r="3" fill="none" stroke="url(#cc-chrome-h)" stroke-width="1.4"/>' +
    charm(HEART_D, 32, 73, -8, 1.3) +
    beads(CHAIN_2) +
    '<circle cx="37.5" cy="102" r="3" fill="none" stroke="#4e525a" stroke-width="2.2"/>' +
    '<circle cx="37.5" cy="102" r="3" fill="none" stroke="url(#cc-chrome-h)" stroke-width="1.4"/>' +
    charm(STAR_D, 38, 116, 12, 1.15) +
    '</svg>';
  var SILHOUETTE_SVG = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="22" r="12"/>' +
    '<path d="M8 62c2-16 12-24 24-24s22 8 24 24z"/></svg>';

  function buildContact() {
    var backdrop = document.createElement('div');
    backdrop.className = 'contact-backdrop';
    var overlay = document.createElement('div');
    overlay.className = 'contact-overlay';
    overlay.innerHTML =
      '<div class="contact-swing" role="dialog" aria-modal="true" aria-labelledby="contact-name" tabindex="-1">' +
      CLIP_SVG + CHAIN_SVG +
      '<div class="contact-holder">' +
      '<div class="contact-slot"></div>' +
      '<div class="contact-card">' +
      '<div class="contact-head"><span class="contact-brand">AUDREY-LILLIE</span><span class="contact-id">ID N° 001</span></div>' +
      '<div class="contact-body">' +
      '<div class="contact-photo"></div>' +
      '<div class="contact-info">' +
      '<p class="contact-name" id="contact-name"><span class="contact-first"></span> <span class="contact-last"></span></p>' +
      '<p class="contact-title"></p>' +
      '<a class="contact-email"></a>' +
      '<a class="contact-phone"></a>' +
      '<p class="contact-note"></p>' +
      '</div></div></div>' +
      '<div class="contact-gloss"></div>' +
      '</div></div>';
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'shorts-close contact-close';
    close.setAttribute('data-i18n', 'shorts.close');
    close.textContent = t('shorts.close');
    document.body.appendChild(backdrop);
    document.body.appendChild(overlay);
    document.body.appendChild(close);
    backdrop.addEventListener('click', closeContact);
    close.addEventListener('click', closeContact);
    contact = { backdrop: backdrop, overlay: overlay, dialog: overlay.firstChild, close: close };
  }

  // Fills the card with content (textContent everywhere: nothing is
  // interpreted). An empty field is hidden rather than leaving a gap.
  function fillContact(json) {
    var c = (json && json.contact) || {};
    var q = function (sel) { return contact.dialog.querySelector(sel); };
    var photo = q('.contact-photo');
    photo.innerHTML = '';
    if (c.photo && PHOTO_URL.test(c.photo)) {
      var img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.src = c.photo;
      photo.appendChild(img);
    } else {
      photo.innerHTML = SILHOUETTE_SVG;
    }
    q('.contact-first').textContent = c.first || '';
    q('.contact-last').textContent = c.last || '';
    var title = q('.contact-title');
    title.textContent = tr(c, 'title');
    title.hidden = !tr(c, 'title');
    var email = q('.contact-email');
    email.textContent = c.email || '';
    email.href = 'mailto:' + (c.email || '');
    email.hidden = !c.email;
    var phone = q('.contact-phone');
    phone.textContent = c.phone || '';
    // The link keeps only digits and "+": spaces and dots are for the eye.
    phone.href = 'tel:' + String(c.phone || '').replace(/[^\d+]/g, '');
    phone.hidden = !c.phone;
    var note = q('.contact-note');
    note.textContent = tr(c, 'note');
    note.hidden = !tr(c, 'note');
  }
  // Language change: the badge's title and note follow (once built, the badge
  // stays in the document even when closed).
  document.addEventListener('cc:lang', function () {
    if (contact && contentCache) fillContact(contentCache);
  });

  // Shrinks the e-mail until it fits its line (long addresses would otherwise
  // be cut). Needs the badge laid out, so it runs once the overlay is open.
  var EMAIL_MIN_PX = 11;
  function fitContactEmail() {
    if (!contact) return;
    var email = contact.overlay.querySelector('.contact-email');
    if (!email || email.hidden) return;
    email.style.fontSize = '';
    var size = parseFloat(getComputedStyle(email).fontSize) || 17;
    while (email.scrollWidth > email.clientWidth + 1 && size > EMAIL_MIN_PX) {
      size -= 0.5;
      email.style.fontSize = size + 'px';
    }
  }
  window.addEventListener('resize', function () { if (contactOpen) fitContactEmail(); });

  function setContactExpanded(on) {
    var btns = document.querySelectorAll('.nav-contact');
    for (var i = 0; i < btns.length; i++) btns[i].setAttribute('aria-expanded', on ? 'true' : 'false');
  }

  function openContact(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (contactOpen || contactBusy) return;
    contactBusy = true;
    contactOrigin = document.querySelector('.nav-contact');
    loadContent().catch(function () { return {}; }).then(function (json) {
      contactBusy = false;
      if (contactOpen) return;
      if (!contact) buildContact();
      ensureFonts(['Special Elite', 'IBM Plex Mono'], json);
      fillContact(json);
      contactOpen = true;
      track('contact');
      var o = contact.overlay;
      o.classList.add('open');
      void o.offsetWidth; // apply the starting style before the transition
      fitContactEmail();
      o.classList.add('in');
      contact.backdrop.classList.add('on');
      contact.close.classList.add('on');
      setContactExpanded(true);
      try { contact.dialog.focus({ preventScroll: true }); } catch (err) {}
    });
  }

  function closeContact() {
    if (!contactOpen) return;
    contactOpen = false;
    var o = contact.overlay;
    o.classList.remove('in');
    contact.backdrop.classList.remove('on');
    contact.close.classList.remove('on');
    setContactExpanded(false);
    // Removed from the flow only once the fade ends; if the badge was reopened
    // in the meantime, leave it in place.
    afterTransition(o, 'opacity', function () {
      if (!contactOpen) o.classList.remove('open');
    }, 500);
    if (contactOrigin && contactOrigin.focus) {
      try { contactOrigin.focus({ preventScroll: true }); } catch (err) {}
    }
  }

  /* ---------- Analytics (anonymous, cookie-free) ---------- */
  // One page view per load plus a few events (book, divider, short, Contact
  // badge), sent to api/hit as a beacon: nothing waits for the response,
  // nothing is stored in the browser. Never on the admin, never if the
  // visitor has asked for "Do Not Track".
  var STATS_PAGES = { '': '/', index: '/', about: '/about', youtube: '/youtube', shorts: '/shorts', brand: '/brand' };
  var viewSent = false;
  function trackPath() {
    var seg = location.pathname.split('/').pop().replace(/\.html$/, '').toLowerCase();
    if (seg === 'admin') return null;
    return STATS_PAGES.hasOwnProperty(seg) ? STATS_PAGES[seg] : '/' + seg;
  }
  function trackAllowed() {
    try { if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return false; } catch (e) {}
    return trackPath() !== null;
  }
  function sendHit(payload) {
    if (!trackAllowed()) return;
    var body = JSON.stringify(payload);
    try {
      // text/plain: no preflight, body read as-is by the API.
      if (navigator.sendBeacon && navigator.sendBeacon('api/hit', new Blob([body], { type: 'text/plain;charset=UTF-8' }))) return;
    } catch (e) {}
    try {
      fetch('api/hit', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: body })
        .catch(function () {});
    } catch (e) {}
  }
  function sendView() {
    if (viewSent) return;
    viewSent = true;
    var phone = false;
    try { phone = window.matchMedia('(max-width: 768px)').matches; } catch (e) {}
    sendHit({ p: trackPath(), r: document.referrer || '', l: lang, d: phone ? 'phone' : 'desktop', u: location.href });
  }
  function track(name) {
    name = String(name || '').slice(0, 80);
    if (name) sendHit({ e: name });
  }

  /* ---------- Utilities ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function uid(prefix) {
    return (prefix || 'id') + '-' + Math.random().toString(36).slice(2, 10);
  }
  function contrast(hex) {
    var h = (hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length < 6) return '#111111';
    var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 145 ? '#111111' : '#ffffff';
  }
  // Waits for the real end of a CSS transition, with a safety net: in the
  // background the browser throttles timers and a fixed delay would fire too
  // early. Shared by the Shorts globe and the Brand shelf.
  function afterTransition(el, prop, cb, fallbackMs) {
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      el.removeEventListener('transitionend', onEnd);
      clearTimeout(timer);
      cb();
    }
    function onEnd(e) {
      if (e.target === el && e.propertyName === prop) finish();
    }
    el.addEventListener('transitionend', onEnd);
    var timer = setTimeout(finish, fallbackMs);
    return finish;
  }

  // Small deterministic pseudo-random generator (stable phone layout)
  function seeded(i) {
    var x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  return {
    PALETTE_MAIN: PALETTE_MAIN,
    PALETTE_CORPO: PALETTE_CORPO,
    GOOGLE_FONTS: GOOGLE_FONTS,
    SYSTEM_FONTS: SYSTEM_FONTS,
    t: t,
    tr: tr,
    lang: function () { return lang; },
    setLang: setLang,
    theme: theme,
    setTheme: setTheme,
    mountChrome: mountChrome,
    openContact: openContact,
    closeContact: closeContact,
    track: track,
    applyLang: applyLang,
    loadContent: loadContent,
    fontStack: fontStack,
    ensureFonts: ensureFonts,
    customFonts: customFonts,
    parseVideo: parseVideo,
    playerNode: playerNode,
    GLOBE_MAX: GLOBE_MAX,
    afterTransition: afterTransition,
    thumbCandidates: thumbCandidates,
    thumbNode: thumbNode,
    titleSize: titleSize,
    esc: esc,
    uid: uid,
    contrast: contrast,
    seeded: seeded,
  };
})();
