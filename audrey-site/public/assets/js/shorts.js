/* Shorts page — video globe.
   Rectangular screens sit tangent to an invisible sphere. The globe slowly
   spins on its own; it can be grabbed with the mouse or a finger to explore
   (with inertia). Click a screen -> it "flies" to the center and plays the
   video. */
(function () {
  'use strict';

  var stage = document.getElementById('globe-stage');
  var globe = document.getElementById('globe');
  var backdrop = document.getElementById('shorts-backdrop');
  var overlay = document.getElementById('shorts-overlay');
  var overlayScreen = overlay.querySelector('.overlay-screen');
  var closeBtn = document.getElementById('shorts-close');

  var content = null;
  var items = [];          // displayable videos (at most Site.GLOBE_MAX)
  var tiles = [];          // { el, lat, lon, item, cl, sl, cp, sp }
  var ratio = 9 / 16;      // screen width / height
  var angH = 0.42;         // angular height of a screen (radians)
  var R = 300;             // globe radius in px

  var rot = { x: -14, y: 0 };   // globe orientation (degrees)
  var vel = { x: 0, y: 0 };     // inertia after release (deg/ms)
  var AUTO = 360 / 75000;       // auto-rotation: one turn in 75 s
  var TILT_MAX = 78;            // never flip the globe upside down
  var reduceMotion = false;
  try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var drag = null;         // { id, x, y, hist: [{t, rx, ry}] }
  var moved = false;       // the current gesture is a drag, not a click
  var paused = false;      // player open: the globe stops
  var lastFrame = 0;

  var sel = null;
  var closing = false;
  var srcNode = null;

  /* ---------- Distributing screens on the sphere ---------- */
  // Evenly spaced latitude rings; each ring gets as many screens as its
  // circumference allows, plus a cap at each pole when there's room left.
  // `a` is the angular height of a screen.
  function rings(a) {
    var aw = a * ratio;
    var step = a * 1.28;             // spacing between two rings
    var latMax = Math.PI / 2 - a * 0.8;
    var m = Math.floor(2 * latMax / step) + 1;
    var out = [];
    for (var k = 0; k < m; k++) {
      var lat = (k - (m - 1) / 2) * step;
      out.push({ lat: lat, n: Math.max(1, Math.floor(2 * Math.PI * Math.cos(lat) / (aw * 1.3))) });
    }
    var top = (m - 1) / 2 * step;
    if (Math.PI / 2 - top > step * 0.75) {
      out.push({ lat: Math.PI / 2, n: 1 });
      out.push({ lat: -Math.PI / 2, n: 1 });
    }
    return out;
  }
  function capacity(list) {
    var s = 0;
    for (var i = 0; i < list.length; i++) s += list[i].n;
    return s;
  }

  // Reference screen size: about fifty screens in portrait (4 rings + 2 caps,
  // 48 slots), about thirty in landscape (wider: 6 rings + 2 caps, 34 slots).
  // Few faces, so the sphere reads well and thumbnails are large. On a small
  // screen the globe is small: slightly bigger screens (× 1.1) stay readable
  // and clickable. No more than that: beyond 0.5775 rad the portrait globe
  // loses its fourth ring and reads like a barrel, and in 16:9 only about
  // twenty sparse screens would remain (40 and 30 slots at × 1.1).
  function maxAngle() {
    var a = ratio > 1 ? 0.34 : 0.52;
    return R < 220 ? a * 1.1 : a;
  }

  // Screen size: the largest (bounded) such that the globe has at least one
  // slot per video. Below that capacity, videos repeat so the globe stays
  // full; beyond it, screens shrink. A_MIN gives over 120 slots whatever the
  // format: Site.GLOBE_MAX distinct videos always fit.
  function chooseLayout(count) {
    var A_MAX = maxAngle(), A_MIN = 0.18;
    var list = null;
    for (var a = A_MAX; a >= A_MIN - 1e-9; a -= 0.005) {
      angH = a;
      list = rings(a);
      if (capacity(list) >= count) break;
    }
    return list;
  }

  // Slot order: the ring closest to the equator first (north side on ties),
  // then moving out towards the poles, each ring traversed by increasing
  // longitude from the front. The admin's first video therefore faces the
  // visitor on load.
  function slots(list) {
    var eq = list.slice().sort(function (p, q) {
      return (Math.abs(p.lat) - Math.abs(q.lat)) || (q.lat - p.lat);
    });
    var out = [];
    eq.forEach(function (ring, k) {
      var offset = (k % 2) * Math.PI / ring.n + k * 0.37;
      for (var j = 0; j < ring.n; j++) {
        var lon = offset + (j / ring.n) * 2 * Math.PI;
        out.push({
          lat: ring.lat, lon: lon,
          x: Math.cos(ring.lat) * Math.sin(lon), y: Math.sin(ring.lat), z: Math.cos(ring.lat) * Math.cos(lon),
        });
      }
    });
    return out;
  }

  // Video placed on each slot. With fewer videos than slots, each repeats:
  // slot by slot, pick the least-used video not already on a neighbouring
  // slot — so two copies of the same video never end up side by side (unless
  // there are too few videos to avoid it). Deterministic: same globe on every
  // visit.
  function assign(places, n) {
    var counts = [], i;
    for (i = 0; i < n; i++) counts.push(0);
    var out = [];
    var wideDot = Math.cos(angH * 1.55);   // wide neighbourhood: one and a half cells
    var tightDot = Math.cos(angH * 1.0);   // strict neighbourhood: the adjacent cell
    places.forEach(function (p, s) {
      var wide = {}, tight = {};
      for (var q = 0; q < s; q++) {
        var o = places[q];
        var dot = o.x * p.x + o.y * p.y + o.z * p.z;
        if (dot > wideDot) wide[out[q]] = 1;
        if (dot > tightDot) tight[out[q]] = 1;
      }
      var order = [];
      for (i = 0; i < n; i++) order.push(i);
      order.sort(function (a, b) {
        return (counts[a] - counts[b]) || (Site.seeded(s * 53 + a) - Site.seeded(s * 53 + b));
      });
      var pick = -1;
      if (s === 0) pick = 0;
      for (i = 0; i < order.length && pick < 0; i++) if (!wide[order[i]]) pick = order[i];
      for (i = 0; i < order.length && pick < 0; i++) if (!tight[order[i]]) pick = order[i];
      if (pick < 0) pick = order[0];
      counts[pick]++;
      out.push(pick);
    });
    return out;
  }

  /* ---------- Build ---------- */
  function build(json) {
    content = json;
    var shorts = json.shorts || {};
    ratio = shorts.ratio === 'landscape' ? 16 / 9 : 9 / 16;
    items = (shorts.items || []).filter(function (s) { return s.title || s.url; }).slice(0, Site.GLOBE_MAX);
    globe.innerHTML = '';
    tiles = [];
    stage.classList.toggle('empty', !items.length);

    if (!items.length) {
      var empty = document.createElement('p');
      empty.className = 'about-placeholder';
      empty.setAttribute('data-i18n', 'player.soon');
      empty.textContent = Site.t('player.soon');
      stage.appendChild(empty);
      return;
    }

    Site.ensureFonts(items.map(function (s) { return s.font; }), json);

    measure();
    var places = slots(chooseLayout(items.length));
    var picks = assign(places, items.length);
    places.forEach(function (p, s) {
      var idx = picks[s];
      var item = items[idx];
      var el = document.createElement('div');
      el.className = 'tile';
      el.setAttribute('data-item', String(idx));
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '-1');
      el.setAttribute('aria-label', Site.tr(item, 'title'));
      var inner = document.createElement('div');
      inner.className = 'tile-inner';
      var thumb = Site.thumbNode(item, json);
      // Title revealed on hover when an image covers the screen (without an
      // image the colored card already shows it large: CSS then hides the label).
      var label = document.createElement('div');
      label.className = 'tile-label';
      label.style.fontFamily = Site.fontStack(item.font, json);
      fillLabel(label, item);
      thumb.appendChild(label);
      inner.appendChild(thumb);
      el.appendChild(inner);
      el.addEventListener('click', function () { if (!moved) open(idx, el); });
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(idx, el); } });
      globe.appendChild(el);
      tiles.push({
        el: el, item: item, lat: p.lat, lon: p.lon,
        cl: Math.cos(p.lon), sl: Math.sin(p.lon), cp: Math.cos(p.lat), sp: Math.sin(p.lat),
      });
    });
    size();
  }

  // Hover label: title, then the role on its own line (in the site language).
  // Rewritten in place on language change.
  function fillLabel(label, item) {
    label.textContent = Site.tr(item, 'title');
    var role = Site.tr(item, 'role');
    if (role) {
      var roleLine = document.createElement('span');
      roleLine.className = 'tile-role';
      roleLine.textContent = role;
      label.appendChild(roleLine);
    }
  }

  // Role label straddling the bottom of the player, tilted as on the other
  // pages (random direction and position, stable per video). Removed if there
  // is no role in the site language.
  function setOverlayRole(item, i) {
    var oldRole = overlay.querySelector('.overlay-role');
    if (oldRole) oldRole.parentNode.removeChild(oldRole);
    var role = Site.tr(item, 'role');
    if (!role) return;
    var roleTag = document.createElement('p');
    roleTag.className = 'overlay-role';
    roleTag.textContent = role;
    roleTag.style.background = item.bg || '#1C2440';
    roleTag.style.color = item.text || '#fff';
    roleTag.style.fontFamily = Site.fontStack(item.font, content);
    var sens = Site.seeded(i * 53 + 11) > 0.5 ? 1 : -1;
    roleTag.style.left = (30 + Site.seeded(i * 97 + 3) * 40).toFixed(1) + '%';
    roleTag.style.transform = 'translate(-50%, 50%) rotate(' + (sens * 10) + 'deg)';
    overlay.appendChild(roleTag);
  }

  // Language change: titles (colored card, hover label, aria-label) of all
  // screens and, if the player is open, its title and role label — in place:
  // the globe keeps spinning and the video keeps playing.
  function retranslate() {
    for (var k = 0; k < tiles.length; k++) {
      var t = tiles[k];
      var title = Site.tr(t.item, 'title');
      t.el.setAttribute('aria-label', title);
      var card = t.el.querySelector('.thumb-card');
      if (card) {
        card.textContent = title;
        card.style.fontSize = Site.titleSize(title) + 'cqw';
      }
      var label = t.el.querySelector('.tile-label');
      if (label) fillLabel(label, t.item);
    }
    if (sel === null || !items[sel]) return;
    var item = items[sel];
    var big = overlayScreen.querySelector('.overlay-title');
    if (big) {
      big.textContent = Site.tr(item, 'title');
      big.style.fontSize = Site.titleSize(Site.tr(item, 'title')) + 'cqw';
    }
    setOverlayRole(item, sel);
  }
  document.addEventListener('cc:lang', retranslate);

  // Globe radius: it fills the area below the header.
  function measure() {
    var r = stage.getBoundingClientRect();
    R = Math.max(90, Math.min(r.width * 0.45, r.height * 0.43));
  }

  // Screen size and position in pixels, recomputed on every resize.
  function size() {
    measure();
    stage.style.perspective = Math.round(R * 3.4) + 'px';
    // 10% margin relative to the angular slot: otherwise two neighbouring
    // screens, planes tangent to the sphere, overlapped at the corners.
    var h = 2 * R * Math.sin(angH / 2) * 0.9;
    var w = h * ratio;
    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i];
      t.el.style.width = w.toFixed(1) + 'px';
      t.el.style.height = h.toFixed(1) + 'px';
      t.el.style.left = (-w / 2).toFixed(1) + 'px';
      t.el.style.top = (-h / 2).toFixed(1) + 'px';
      t.el.style.transform = 'rotateY(' + (t.lon * 180 / Math.PI).toFixed(2) + 'deg) rotateX(' +
        (t.lat * 180 / Math.PI).toFixed(2) + 'deg) translateZ(' + R.toFixed(1) + 'px)';
    }
  }

  /* ---------- Animation ---------- */
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // Flags screens facing the visitor: only they are clickable (the back face
  // is hidden by CSS, but not for the pointer).
  function updateFacing() {
    var rx = rot.x * Math.PI / 180, ry = rot.y * Math.PI / 180;
    var cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry);
    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i];
      // screen normal in the globe's frame, then the globe's rotation
      var nx = t.cp * t.sl, ny = -t.sp, nz = t.cp * t.cl;
      var z1 = -nx * sy + nz * cy;
      var z2 = ny * sx + z1 * cx;
      var front = z2 > 0.04;
      if (front !== t.front) {
        t.front = front;
        t.el.classList.toggle('front', front);
        t.el.setAttribute('tabindex', front ? '0' : '-1');
      }
    }
  }

  function apply() {
    rot.x = clamp(rot.x, -TILT_MAX, TILT_MAX);
    globe.style.transform = 'rotateX(' + rot.x.toFixed(3) + 'deg) rotateY(' + rot.y.toFixed(3) + 'deg)';
    updateFacing();
  }

  function frame(now) {
    var dt = lastFrame ? Math.min(now - lastFrame, 60) : 16;
    lastFrame = now;
    if (!drag && !paused) {
      var moving = false;
      if (!reduceMotion) { rot.y += AUTO * dt; moving = true; }
      if (vel.x || vel.y) {
        rot.x += vel.x * dt;
        rot.y += vel.y * dt;
        var decay = Math.exp(-dt / 320);
        vel.x *= decay;
        vel.y *= decay;
        if (Math.abs(vel.x) < 2e-4) vel.x = 0;
        if (Math.abs(vel.y) < 2e-4) vel.y = 0;
        moving = true;
      }
      if (moving) apply();
    }
    requestAnimationFrame(frame);
  }

  /* ---------- Drag to explore ---------- */
  function degPerPx() { return 80 / R; }   // dragging across the globe ≈ half a turn

  stage.addEventListener('pointerdown', function (e) {
    if (sel !== null || closing) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag = {
      id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY,
      hist: [{ t: performance.now(), rx: rot.x, ry: rot.y }],
    };
    moved = false;
    vel.x = 0;
    vel.y = 0;
    stage.classList.add('grabbing');
  });

  window.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    var k = degPerPx();
    rot.y += dx * k;
    rot.x -= dy * k;
    apply();
    if (!moved && Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) > 6) moved = true;
    var now = performance.now();
    drag.hist.push({ t: now, rx: rot.x, ry: rot.y });
    while (drag.hist.length > 2 && now - drag.hist[1].t > 90) drag.hist.shift();
    e.preventDefault();
  });

  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var now = performance.now();
    var first = drag.hist[0], last = drag.hist[drag.hist.length - 1];
    var dt = Math.max(1, last.t - first.t);
    if (moved && now - last.t < 80) {
      var MAXV = 0.9;
      vel.x = clamp((last.rx - first.rx) / dt, -MAXV, MAXV);
      vel.y = clamp((last.ry - first.ry) / dt, -MAXV, MAXV);
    }
    drag = null;
    stage.classList.remove('grabbing');
    // The click that follows a drag must not open a screen.
    if (moved) setTimeout(function () { moved = false; }, 0);
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  /* ---------- Player ---------- */
  // Reliable transition end (safety net included): helper shared with the
  // Brand page shelf.
  var afterTransition = Site.afterTransition;

  // Player dimensions: a 9:19.5 phone for portrait screens, a 16:9 rectangle
  // for landscape ones.
  function playerBox() {
    var vh = window.innerHeight, vw = window.innerWidth;
    var fw, fh;
    if (ratio > 1) {
      fw = Math.min(vw * 0.86, 1100);
      fh = fw * 9 / 16;
      if (fh > vh * 0.78) { fh = vh * 0.78; fw = fh * 16 / 9; }
    } else {
      fh = Math.min(vh * 0.84, 760);
      fw = fh * 9 / 19.5;
      if (fw > vw * 0.92) { fw = vw * 0.92; fh = fw * 19.5 / 9; }
    }
    return { w: fw, h: fh, x: (vw - fw) / 2, y: (vh - fh) / 2 };
  }

  function open(i, tileEl) {
    if (sel !== null || closing) return;
    sel = i;
    srcNode = tileEl;
    paused = true;
    vel.x = 0;
    vel.y = 0;

    var r = tileEl.getBoundingClientRect();
    var vh = window.innerHeight, vw = window.innerWidth;
    var box = playerBox();
    var k = Math.max(0.05, r.height / box.h);
    var dx = (r.left + r.width / 2) - vw / 2;
    var dy = (r.top + r.height / 2) - vh / 2;

    tileEl.style.transition = 'opacity .25s ease';
    tileEl.style.opacity = '0';
    tileEl.style.pointerEvents = 'none';

    var item = items[i];
    Site.track('short:' + (item.title || item.title_en || 'Short ' + (i + 1)));
    overlay.classList.toggle('landscape', ratio > 1);
    overlayScreen.style.background = item.url ? '#000' : (item.bg || '#1C2440');
    overlayScreen.innerHTML = ratio > 1 ? '' : '<div class="phone-notch"></div>';
    if (item.url) {
      overlayScreen.appendChild(Site.playerNode(item.url));
    } else {
      var title = document.createElement('div');
      title.className = 'overlay-title';
      title.textContent = Site.tr(item, 'title');
      title.style.color = item.text || '#fff';
      title.style.fontFamily = Site.fontStack(item.font, content);
      title.style.fontSize = Site.titleSize(Site.tr(item, 'title')) + 'cqw';
      overlayScreen.appendChild(title);
      var soon = document.createElement('div');
      soon.className = 'player-placeholder';
      soon.setAttribute('data-i18n', 'player.soon');
      soon.textContent = Site.t('player.soon');
      soon.style.color = item.text || '#fff';
      overlayScreen.appendChild(soon);
    }

    setOverlayRole(item, i);

    overlay.style.left = box.x + 'px';
    overlay.style.top = box.y + 'px';
    overlay.style.width = box.w + 'px';
    overlay.style.height = box.h + 'px';
    overlay.style.transition = 'none';
    overlay.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + k + ')';
    overlay.classList.add('open');

    void overlay.offsetWidth; // force the starting style to be computed
    overlay.style.transition = 'transform 0.62s cubic-bezier(0.22, 0.9, 0.24, 1)';
    overlay.style.transform = 'none';
    backdrop.classList.add('on');
    closeBtn.classList.add('on');
  }

  function close() {
    // Closable even during the opening animation: ignoring the click would
    // make the button feel unresponsive.
    if (sel === null || closing) return;
    closing = true;
    var tileEl = srcNode;
    var r = tileEl.getBoundingClientRect();
    var vh = window.innerHeight, vw = window.innerWidth;
    var fh = parseFloat(overlay.style.height);
    var k = Math.max(0.05, r.height / fh);
    var dx = (r.left + r.width / 2) - vw / 2;
    var dy = (r.top + r.height / 2) - vh / 2;

    overlay.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + k + ')';
    backdrop.classList.remove('on');
    closeBtn.classList.remove('on');

    afterTransition(overlay, 'transform', function () {
      overlay.classList.remove('open');
      overlayScreen.innerHTML = ''; // stops video playback
      if (tileEl) {
        tileEl.style.opacity = '';
        tileEl.style.pointerEvents = '';
      }
      sel = null;
      srcNode = null;
      closing = false;
      paused = false;
    }, 900);
  }

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (sel !== null || closing || !content) return;
      var before = maxAngle();
      measure();
      // Small <-> large screen switch: the layout changes, so rebuild.
      if (maxAngle() !== before) { build(content); apply(); } else size();
    }, 120);
  });

  backdrop.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });

  window.addEventListener('DOMContentLoaded', function () {
    Site.mountChrome('shorts');
    Site.loadContent().then(function (json) {
      build(json);
      apply();
      requestAnimationFrame(frame);
      var params = new URLSearchParams(location.search);
      if (params.has('open')) {
        var idx = parseInt(params.get('open'), 10);
        var tile = globe.querySelector('.tile[data-item="' + idx + '"]');
        if (!isNaN(idx) && tile) open(idx, tile);
      }
    });
  });
})();
