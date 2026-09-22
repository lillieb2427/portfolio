/* audrey-lillie admin panel */
(function () {
  'use strict';

  var C = null;               // full content (edited state)
  var pw = '';
  try { pw = sessionStorage.getItem('cc_admin_pw') || ''; } catch (e) {}
  var tab = 'youtube';
  var dirty = false;
  var base = '';                // updatedAt of the loaded content (overwrite check)

  var $login = document.getElementById('login');
  var $loginForm = document.getElementById('login-form');
  var $loginPw = document.getElementById('login-pw');
  var $loginError = document.getElementById('login-error');
  var $app = document.getElementById('app');
  var $panel = document.getElementById('panel');
  var $tabs = document.getElementById('tabs');
  var $status = document.getElementById('save-status');

  var esc = Site.esc;

  /* ---------- English fields (disabled) ---------- */
  // The site is English-only: the old "English fields" toggle is gone and
  // showEn is forced off, so the `_en` twin inputs below are never rendered
  // and the admin only edits the base fields. (The saved 'cc-admin-en'
  // preference is ignored.)
  var showEn = false;
  var $en = document.getElementById('btn-en');
  if ($en) $en.remove();

  // English twin of field `src` (input or textarea), bound to obj[key + '_en'].
  // Always null now that showEn is forced off.
  function enField(obj, key, src, onInput) {
    if (!showEn) return null;
    var wrap = el('<div class="en-field"><span class="en-badge" title="English version (optional)">EN</span></div>');
    var area = src.tagName === 'TEXTAREA';
    var inp = document.createElement(area ? 'textarea' : 'input');
    if (area) inp.rows = src.rows;
    if (src.getAttribute('maxlength')) inp.setAttribute('maxlength', src.getAttribute('maxlength'));
    inp.className = 'en-input';
    inp.setAttribute('data-en', key);
    inp.placeholder = 'English version (optional)';
    inp.value = obj[key + '_en'] || '';
    inp.addEventListener('input', function () {
      obj[key + '_en'] = inp.value;
      markDirty();
      if (onInput) onInput();
    });
    wrap.appendChild(inp);
    return wrap;
  }
  // Inserts the twin right below the base field.
  function enAfter(src, obj, key, onInput) {
    var f = enField(obj, key, src, onInput);
    if (f) src.parentNode.insertBefore(f, src.nextSibling);
    return f;
  }

  /* Default color pairs (background, text) */
  var PAIRS_MAIN = [
    ['#1C2440', '#F3D163'], ['#EC7448', '#1C2440'], ['#3D7565', '#DFEFFB'], ['#D63F64', '#F3D163'],
    ['#F3D163', '#1C2440'], ['#7C8CD9', '#1C2440'], ['#B4BCAC', '#520D28'], ['#520D28', '#DFEFFB'],
    ['#E9F072', '#1C2440'], ['#DFEFFB', '#D63F64'],
  ];
  var PAIRS_CORPO = [
    ['#1C2440', '#DFEFFB'], ['#D8D4C6', '#1C2440'], ['#A8B5C9', '#1C2440'], ['#3D7565', '#E8E2D5'],
    ['#DFEFFB', '#1C2440'], ['#8B93A7', '#1C2440'], ['#64748B', '#E8E2D5'], ['#E8E2D5', '#3D7565'],
    ['#94A3B8', '#1C2440'], ['#B4BCAC', '#1C2440'],
  ];

  function pageP(page) { return page === 'brand' ? Site.PALETTE_CORPO : Site.PALETTE_MAIN; }
  function pagePairs(page) { return page === 'brand' ? PAIRS_CORPO : PAIRS_MAIN; }

  function setStatus(msg, cls) {
    $status.textContent = msg || '';
    $status.className = 'save-status' + (cls ? ' ' + cls : '');
  }
  function markDirty() {
    dirty = true;
    setStatus('Unsaved changes');
  }

  /* ---------- Authentication ---------- */
  function tryAuth(password) {
    return fetch('api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password }),
    }).then(function (r) { return r.ok; }).catch(function () { return false; });
  }

  $loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var val = $loginPw.value;
    $loginError.textContent = '';
    tryAuth(val).then(function (ok) {
      if (ok) {
        pw = val;
        try { sessionStorage.setItem('cc_admin_pw', pw); } catch (er) {}
        boot();
      } else {
        $loginError.textContent = 'Incorrect password';
      }
    });
  });

  if (pw) {
    tryAuth(pw).then(function (ok) {
      if (ok) boot();
      else { try { sessionStorage.removeItem('cc_admin_pw'); } catch (e) {} }
    });
  }

  function checkStorage() {
    fetch('api/status', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (s) {
        var old = document.getElementById('storage-warning');
        if (old) old.remove();
        if (s.canSave) return;
        var bar = document.createElement('div');
        bar.id = 'storage-warning';
        bar.className = 'storage-warning';
        bar.innerHTML = '<b>Saving is unavailable:</b> ' + esc(s.detail || '') +
          ' <a href="https://vercel.com/dashboard/stores" target="_blank" rel="noopener">Open Vercel Storage ↗</a>';
        $app.insertBefore(bar, $panel);
      })
      .catch(function () { /* endpoint missing on an older deployment */ });
  }

  function boot() {
    $login.hidden = true;
    $app.hidden = false;
    checkStorage();
    fetch('api/content', { cache: 'no-store', headers: { 'x-admin-password': pw } })
      .then(function (r) {
        return r.json().then(function (j) {
          // Stored content unreadable: load nothing (especially not the demo
          // content, which a Save would then write over it).
          if (!r.ok) { var err = new Error(j.error || 'Error'); err.shown = true; throw err; }
          return j;
        });
      })
      .then(function (json) {
        C = json;
        base = typeof C.updatedAt === 'string' ? C.updatedAt : '';
        delete C.updatedAt;
        setMaint(C.maintenance === true);
        delete C.maintenance;
        C.youtube = C.youtube || { clients: [] };
        C.brand = C.brand || { clients: [] };
        C.shorts = C.shorts || { items: [] };
        C.fonts = C.fonts || { custom: [] };
        C.about = mergeAbout(C.about);
        C.contact = mergeContact(C.contact);
        render();
      })
      .catch(function (e) {
        C = null;
        setStatus(e && e.shown ? e.message : 'Could not load the content', 'err');
        $panel.innerHTML = '<div class="card"><div class="card-body"><p><strong>The saved content can\'t be read right now.</strong></p><p>' + esc((e && e.message) || '') + '</p><p>Nothing is lost: your texts and images are still in storage. Saving stays disabled until the content can be read again, so nothing gets overwritten.</p></div></div>';
      });
  }

  /* ---------- Save / export ---------- */
  // Save: the admin sends the date of the content it loaded; if the live
  // content has changed since (another tab or device), the API answers 409
  // and we ask for confirmation before overwriting.
  function save(force) {
    if (!C) return;
    setStatus('Saving…');
    fetch('api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
      body: JSON.stringify({ content: C, base: base, force: !!force }),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
      .then(function (res) {
        if (res.ok) {
          dirty = false;
          if (typeof res.j.updatedAt === 'string') base = res.j.updatedAt;
          setStatus('Saved ✓', 'ok');
        } else if (res.status === 409 && res.j.stale) {
          if (window.confirm(res.j.error + '\n\nOK: overwrite it with this version anyway.\nCancel: save nothing (reload the page to start from the live version).')) save(true);
          else setStatus('Not saved: the live content is newer, reload the page', 'err');
        } else setStatus(res.j.error || 'Error', 'err');
      })
      .catch(function () { setStatus('Network error', 'err'); });
  }
  document.getElementById('btn-save').addEventListener('click', function () { save(false); });

  /* ---------- Maintenance ---------- */
  // Top-bar switch: takes effect immediately (api/maintenance), independent
  // of Save. Green = site live, red = maintenance.
  var $maint = document.getElementById('btn-maint');
  function setMaint(on) {
    $maint.setAttribute('aria-checked', on ? 'true' : 'false');
    $maint.querySelector('.maint-label').textContent = on ? 'Maintenance' : 'Site live';
  }
  $maint.addEventListener('click', function () {
    var on = $maint.getAttribute('aria-checked') !== 'true';
    if (on && !window.confirm('Put the site in maintenance mode?\n\nVisitors will only see a "Site under maintenance" screen on every page. The admin stays available, and "View site" still shows you the real site.')) return;
    $maint.disabled = true;
    fetch('api/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
      body: JSON.stringify({ on: on }),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        $maint.disabled = false;
        if (res.ok) { setMaint(res.j.on === true); setStatus(res.j.on ? 'Site in maintenance mode' : 'Site back online ✓', res.j.on ? 'err' : 'ok'); }
        else setStatus(res.j.error || 'Error', 'err');
      })
      .catch(function () { $maint.disabled = false; setStatus('Network error', 'err'); });
  });

  /* ---------- Import JSON ---------- */
  // Loads a file produced by "Export JSON": its content replaces the page's;
  // nothing goes live before Save (the API sanitizes and caps everything then).
  var $importFile = document.getElementById('import-file');
  document.getElementById('btn-import').addEventListener('click', function () {
    if (!C) { setStatus('Content not loaded: cannot import', 'err'); return; }
    $importFile.value = '';
    $importFile.click();
  });
  $importFile.addEventListener('change', function () {
    var file = $importFile.files && $importFile.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onerror = function () { setStatus('Unreadable file', 'err'); };
    reader.onload = function () {
      var json;
      try { json = JSON.parse(String(reader.result)); } catch (e) { json = null; }
      if (json && json.content && typeof json.content === 'object') json = json.content;
      var ok = json && typeof json === 'object' && json.youtube && Array.isArray(json.youtube.clients)
        && json.brand && Array.isArray(json.brand.clients) && json.shorts && Array.isArray(json.shorts.items);
      if (!ok) { setStatus('This file is not a site export (invalid or incomplete JSON)', 'err'); return; }
      var resume = 'Design: ' + json.youtube.clients.length + ' entries, Collabs: ' + json.brand.clients.length + ' entries, Gallery: ' + json.shorts.items.length + ' videos';
      if (!window.confirm('Import "' + file.name + '"?\n\n' + resume + '.\n\nThe content shown in the admin will be replaced. Nothing changes on the site until you click Save.')) return;
      delete json.updatedAt;
      delete json.maintenance;
      C = json;
      C.fonts = C.fonts && Array.isArray(C.fonts.custom) ? C.fonts : { custom: [] };
      C.about = mergeAbout(C.about);
      C.contact = mergeContact(C.contact);
      render();
      markDirty();
      setStatus('Import loaded (' + resume + ') — click Save to publish it');
    };
    reader.readAsText(file);
  });

  document.getElementById('btn-export').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(C, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'audrey-site-content.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  window.addEventListener('beforeunload', function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ---------- Tabs ---------- */
  $tabs.addEventListener('click', function (e) {
    var btn = e.target.closest('.admin-tab');
    if (!btn) return;
    tab = btn.getAttribute('data-tab');
    var all = $tabs.querySelectorAll('.admin-tab');
    for (var i = 0; i < all.length; i++) all[i].classList.toggle('active', all[i] === btn);
    render();
  });

  /* ---------- UI helpers ---------- */
  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstChild;
  }

  function allFontNames() {
    var names = Object.keys(Site.SYSTEM_FONTS);
    names = names.concat(Site.GOOGLE_FONTS);
    (C.fonts.custom || []).forEach(function (f) {
      if (names.indexOf(f.name) === -1) names.push(f.name);
    });
    return names;
  }

  function fontSelect(value, allowInherit, onChange) {
    var wrap = el('<span style="display:inline-flex;align-items:center;gap:8px"></span>');
    var sel = document.createElement('select');
    var html = '';
    if (allowInherit) html += '<option value="">Inherit from client</option>';
    var sys = Object.keys(Site.SYSTEM_FONTS);
    html += '<optgroup label="System">' + sys.map(function (n) {
      return '<option value="' + esc(n) + '"' + (value === n ? ' selected' : '') + '>' + esc(n) + '</option>';
    }).join('') + '</optgroup>';
    html += '<optgroup label="Google Fonts">' + Site.GOOGLE_FONTS.map(function (n) {
      return '<option value="' + esc(n) + '"' + (value === n ? ' selected' : '') + '>' + esc(n) + '</option>';
    }).join('') + '</optgroup>';
    var customs = C.fonts.custom || [];
    if (customs.length) {
      html += '<optgroup label="Custom">' + customs.map(function (f) {
        return '<option value="' + esc(f.name) + '"' + (value === f.name ? ' selected' : '') + '>' + esc(f.name) + '</option>';
      }).join('') + '</optgroup>';
    }
    sel.innerHTML = html;
    var sample = el('<span style="font-size:17px;white-space:nowrap">Aa Bb</span>');
    function refreshSample() {
      var v = sel.value;
      if (v) {
        Site.ensureFonts([v], C);
        sample.style.fontFamily = Site.fontStack(v, C);
        sample.style.visibility = 'visible';
      } else {
        sample.style.visibility = 'hidden';
      }
    }
    refreshSample();
    sel.addEventListener('change', function () {
      refreshSample();
      onChange(sel.value);
    });
    wrap.appendChild(sel);
    wrap.appendChild(sample);
    return wrap;
  }

  function colorField(value, page, clearable, onChange) {
    var wrap = el('<span class="color-field"></span>');
    var picker = el('<input type="color" title="Pick a color">');
    var hex = el('<input type="text" placeholder="' + (clearable ? 'inherit' : '#000000') + '" maxlength="9">');
    picker.value = /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#cccccc';
    hex.value = value || '';
    function commit(v) {
      v = v.trim();
      if (v && !/^#/.test(v)) v = '#' + v;
      if (v && !/^#[0-9a-fA-F]{3,8}$/.test(v)) return;
      hex.value = v;
      if (/^#[0-9a-fA-F]{6}$/.test(v)) picker.value = v;
      onChange(v);
    }
    picker.addEventListener('input', function () { commit(picker.value); });
    hex.addEventListener('change', function () { commit(hex.value); });
    wrap.appendChild(picker);
    wrap.appendChild(hex);
    if (clearable) {
      var clear = el('<button class="btn small" type="button" title="Inherit from client">×</button>');
      clear.addEventListener('click', function () { hex.value = ''; onChange(''); });
      wrap.appendChild(clear);
    }
    var sw = el('<span class="swatches"></span>');
    pageP(page).forEach(function (c) {
      var b = el('<button class="swatch" type="button" style="background:' + c + '" title="' + c + '"></button>');
      b.addEventListener('click', function () { commit(c); });
      sw.appendChild(b);
    });
    wrap.appendChild(sw);
    return wrap;
  }

  /* ---------- Drag & drop ---------- */
  function makeSortable(container, itemSel, onReorder) {
    var dragged = null;
    container.addEventListener('dragstart', function (e) {
      var item = e.target.closest(itemSel);
      if (!item || item.parentElement !== container) return;
      e.stopPropagation();
      dragged = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', ''); } catch (er) {}
    });
    container.addEventListener('dragover', function (e) {
      if (!dragged) return;
      e.preventDefault();
      e.stopPropagation();
      var siblings = Array.prototype.slice.call(container.querySelectorAll(itemSel + ':not(.dragging)'))
        .filter(function (n) { return n.parentElement === container; });
      var after = null;
      for (var i = 0; i < siblings.length; i++) {
        var box = siblings[i].getBoundingClientRect();
        if (e.clientY < box.top + box.height / 2) { after = siblings[i]; break; }
      }
      if (after) container.insertBefore(dragged, after);
      else container.appendChild(dragged);
    });
    container.addEventListener('drop', function (e) { if (dragged) { e.preventDefault(); e.stopPropagation(); } });
    container.addEventListener('dragend', function (e) {
      if (!dragged) return;
      e.stopPropagation();
      dragged.classList.remove('dragging');
      dragged = null;
      var order = Array.prototype.slice.call(container.querySelectorAll(itemSel))
        .filter(function (n) { return n.parentElement === container; })
        .map(function (n) { return parseInt(n.getAttribute('data-idx'), 10); });
      onReorder(order);
    });
  }

  function reorder(arr, order) {
    var copy = order.map(function (i) { return arr[i]; });
    arr.length = 0;
    order.forEach(function (_, k) { arr.push(copy[k]); });
  }

  /* ---------- Rendering ---------- */
  function render() {
    if (!C) return;
    $panel.innerHTML = '';
    if (tab === 'youtube' || tab === 'brand') renderClients(tab);
    else if (tab === 'shorts') renderShorts();
    else if (tab === 'about') renderAbout();
    else if (tab === 'contact') renderContact();
    else if (tab === 'data') renderData();
    else renderFonts();
  }

  // Uploads an image to api/cover (gallery thumbnail, About photo, etc.):
  // same flow, same storage. `done(url)` receives the public URL.
  // Every image goes through shrinkImage first (browser-side downsizing).
  function uploadCover(file, name, msgEl, done) {
    msgEl.textContent = 'Uploading…';
    shrinkImage(file, function (b64, ext) {
      fetch('api/cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
        body: JSON.stringify({ name: name, ext: ext, data: b64 }),
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) { msgEl.textContent = res.j.error || 'Error'; return; }
          msgEl.textContent = 'Image uploaded ✓ — remember to Save';
          markDirty();
          done(res.j.url);
        })
        .catch(function () { msgEl.textContent = 'Network error'; });
    });
  }

  // Downsizes an image before upload: camera photos (several MB) were eating
  // the Blob Store transfer quota. JPEG / PNG / WebP: longest side capped at
  // 1600 px (never upscaled), exported as WebP 0.82 — JPEG 0.85 if the browser
  // can't encode WebP. Result larger than the original, unreadable image,
  // GIF (animation), SVG, AVIF: file sent unchanged.
  // `done(base64, ext)` receives the data and the extension to send.
  var IMG_MAX_SIDE = 1600;
  function shrinkImage(file, done) {
    var ext = file.name.split('.').pop().toLowerCase();
    var reader = new FileReader();
    reader.onerror = function () { done('', ext); };
    reader.onload = function () {
      var original = String(reader.result);
      var keep = function () { done(original.split(',')[1] || '', ext); };
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) && !/^(jpe?g|png|webp)$/.test(ext)) { keep(); return; }
      var img = new Image();
      img.onerror = keep;
      img.onload = function () {
        try {
          var w = img.naturalWidth, h = img.naturalHeight;
          if (!w || !h) { keep(); return; }
          var k = Math.min(1, IMG_MAX_SIDE / Math.max(w, h));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(w * k));
          canvas.height = Math.max(1, Math.round(h * k));
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          var out = canvas.toDataURL('image/webp', 0.82), outExt = 'webp';
          if (out.indexOf('data:image/webp') !== 0) {
            // No WebP encoder (Safari): JPEG on a white background (no transparency).
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            out = canvas.toDataURL('image/jpeg', 0.85);
            outExt = 'jpg';
            if (out.indexOf('data:image/jpeg') !== 0) { keep(); return; }
          }
          if (out.length >= original.length) { keep(); return; }
          done(out.split(',')[1] || '', outExt);
        } catch (e) { keep(); }
      };
      img.src = original;
    };
    reader.readAsDataURL(file);
  }

  /* ===== Clients (Design / Collabs sections) ===== */
  function renderClients(page) {
    var note = page === 'brand'
      ? el('<p class="panel-note">On the Collabs page, <b>one client = one book</b> on the shelf: its name runs vertically down the spine (in the client\'s font and colors), and the cover opens on click to show the video. Several projects = tabs on the cover. Drag the ⠿ cards to change the order on the shelf.</p>')
      : el('<p class="panel-note">On the Design page, <b>one client = one divider</b>. Drag the cards by the ⠿ handle to change the display order. Add several projects to a client to show small selector tabs inside the open divider.</p>');
    $panel.appendChild(note);

    var list = document.createElement('div');
    list.id = 'client-list';
    C[page].clients.forEach(function (client, idx) {
      list.appendChild(clientCard(page, client, idx));
    });
    $panel.appendChild(list);

    var add = el('<div class="add-row"><button class="btn" type="button">+ Add a client</button></div>');
    add.querySelector('button').addEventListener('click', function () {
      var pair = pagePairs(page)[C[page].clients.length % 10];
      C[page].clients.push({
        id: Site.uid(page), name: 'NEW CLIENT', bg: pair[0], text: pair[1],
        font: 'Anton', desc: '', projects: [{ id: Site.uid('p'), title: '', url: '', bg: '', text: '', font: '' }],
      });
      markDirty();
      render();
      var cards = document.querySelectorAll('#client-list .card');
      if (cards.length) cards[cards.length - 1].classList.add('openned');
    });
    $panel.appendChild(add);

    makeSortable(list, '.card', function (order) {
      reorder(C[page].clients, order);
      markDirty();
      render();
    });
  }

  function clientCard(page, client, idx) {
    var card = el('<div class="card" data-idx="' + idx + '"></div>');

    var head = el('<div class="card-head">' +
      '<span class="drag-handle" draggable="true" title="Drag to reorder">⠿</span>' +
      '<span class="color-dot" style="background:' + esc(client.bg) + ';color:' + esc(client.text) + '">A</span>' +
      '</div>');
    var nameInput = el('<input class="head-name" value="' + esc(client.name) + '" placeholder="Client name">');
    nameInput.addEventListener('input', function () { client.name = nameInput.value; markDirty(); });
    head.appendChild(nameInput);

    var toggleBtn = el('<button class="btn small" type="button">Open</button>');
    toggleBtn.addEventListener('click', function () {
      card.classList.toggle('openned');
      toggleBtn.textContent = card.classList.contains('openned') ? 'Close' : 'Open';
    });
    head.appendChild(toggleBtn);

    var delBtn = el('<button class="btn small danger" type="button">Delete</button>');
    delBtn.addEventListener('click', function () {
      if (!confirm('Delete the client "' + client.name + '" and all of its projects?')) return;
      C[page].clients.splice(idx, 1);
      markDirty();
      render();
    });
    head.appendChild(delBtn);
    card.appendChild(head);

    var body = el('<div class="card-body"></div>');
    var fields = el('<div class="fields"></div>');

    var fBg = el('<div class="field"><label>Background color</label></div>');
    fBg.appendChild(colorField(client.bg, page, false, function (v) {
      client.bg = v;
      head.querySelector('.color-dot').style.background = v;
      markDirty();
    }));
    fields.appendChild(fBg);

    var fTx = el('<div class="field"><label>Text color</label></div>');
    fTx.appendChild(colorField(client.text, page, false, function (v) {
      client.text = v;
      head.querySelector('.color-dot').style.color = v;
      markDirty();
    }));
    fields.appendChild(fTx);

    var fFont = el('<div class="field"><label>Font</label></div>');
    fFont.appendChild(fontSelect(client.font, false, function (v) { client.font = v; markDirty(); }));
    fields.appendChild(fFont);

    // Collabs shelf only: book finish (spine and cover).
    if (page === 'brand') {
      var fFin = el('<div class="field"><label>Book finish</label></div>');
      var finSel = el('<select class="c-finish">' +
        '<option value="">Auto (varies along the shelf)</option>' +
        '<option value="cuir">Leather</option>' +
        '<option value="vernis">Gloss</option>' +
        '<option value="mat">Matte</option></select>');
      finSel.value = FINISHES.indexOf(client.finish) !== -1 ? client.finish : '';
      finSel.addEventListener('change', function () { client.finish = finSel.value; markDirty(); });
      fFin.appendChild(finSel);
      fields.appendChild(fFin);
    }

    var fDesc = el('<div class="field grow"><label>Description (optional)</label></div>');
    var desc = el('<textarea rows="2" placeholder="Text shown below the video"></textarea>');
    desc.value = client.desc || '';
    desc.addEventListener('input', function () { client.desc = desc.value; markDirty(); });
    fDesc.appendChild(desc);
    enAfter(desc, client, 'desc');
    fields.appendChild(fDesc);

    body.appendChild(fields);

    /* Projects */
    var zone = el('<div class="proj-zone"><h4>Projects (videos) — drag ⠿ to reorder</h4></div>');
    var plist = document.createElement('div');
    (client.projects = client.projects || []).forEach(function (proj, j) {
      plist.appendChild(projRow(page, client, proj, j));
    });
    zone.appendChild(plist);

    var addP = el('<button class="btn small" type="button">+ Add a project</button>');
    addP.addEventListener('click', function () {
      client.projects.push({ id: Site.uid('p'), title: '', url: '', bg: '', text: '', font: '' });
      markDirty();
      render();
      openCardByIdx(idx);
    });
    zone.appendChild(addP);
    body.appendChild(zone);
    card.appendChild(body);

    makeSortable(plist, '.proj-row', function (order) {
      reorder(client.projects, order);
      markDirty();
      render();
      openCardByIdx(idx);
    });

    return card;
  }

  function openCardByIdx(idx) {
    var cards = document.querySelectorAll('#client-list .card');
    if (cards[idx]) {
      cards[idx].classList.add('openned');
      var b = cards[idx].querySelector('.card-head .btn');
      if (b) b.textContent = 'Close';
    }
  }

  function projRow(page, client, proj, j) {
    var row = el('<div class="proj-row" data-idx="' + j + '"></div>');
    var main = el('<div class="proj-main">' +
      '<span class="drag-handle" draggable="true" title="Drag to reorder">⠿</span>' +
      '</div>');
    var title = el('<input class="p-title" value="' + esc(proj.title) + '" placeholder="Project title">');
    title.addEventListener('input', function () { proj.title = title.value; markDirty(); });
    var role = el('<input class="p-role" list="role-suggestions" value="' + esc(proj.role) + '" placeholder="Role (e.g. AD)">');
    role.addEventListener('input', function () { proj.role = role.value; markDirty(); });
    var url = el('<input class="p-url" value="' + esc(proj.url) + '" placeholder="Video link (YouTube, Vimeo, Drive, .mp4…)">');
    url.addEventListener('input', function () { proj.url = url.value; markDirty(); });
    var del = el('<button class="btn small danger" type="button">✕</button>');
    del.addEventListener('click', function () {
      var k = client.projects.indexOf(proj);
      if (k !== -1) client.projects.splice(k, 1);
      markDirty();
      render();
    });
    main.appendChild(title);
    main.appendChild(role);
    main.appendChild(url);
    main.appendChild(del);
    row.appendChild(main);
    // English twins of title and role, aligned under their fields.
    if (showEn) {
      var enRow = el('<div class="proj-main proj-en"></div>');
      var enTitle = enField(proj, 'title', title);
      enTitle.classList.add('w-title');
      var enRole = enField(proj, 'role', role);
      enRole.classList.add('w-role');
      enRow.appendChild(enTitle);
      enRow.appendChild(enRole);
      row.appendChild(enRow);
    }

    var opts = el('<div class="proj-opts"><span class="hint">Options (otherwise inherited from the client):</span></div>');
    opts.appendChild(colorField(proj.bg, page, true, function (v) { proj.bg = v; markDirty(); }));
    opts.appendChild(colorField(proj.text, page, true, function (v) { proj.text = v; markDirty(); }));
    opts.appendChild(fontSelect(proj.font, true, function (v) { proj.font = v; markDirty(); }));
    row.appendChild(opts);
    // Collabs shelf only: text under the media, video format and photo
    // gallery (the Design page doesn't show them, but the data is kept).
    if (page === 'brand') {
      var fPd = el('<div class="proj-desc" style="margin-top:8px"><span class="hint">Text shown below the video / photos (optional — defaults to the client description)</span></div>');
      var pd = el('<textarea rows="2" maxlength="600" style="width:100%;margin-top:4px" placeholder="What we did on this project…"></textarea>');
      pd.value = proj.desc || '';
      pd.addEventListener('input', function () { proj.desc = pd.value; markDirty(); });
      fPd.appendChild(pd);
      enAfter(pd, proj, 'desc');
      row.appendChild(fPd);
      row.appendChild(mediaZone(proj));
    }
    return row;
  }

  /* ===== Collabs section: project media (video format, photo gallery) ===== */
  var FINISHES = ['cuir', 'vernis', 'mat'];
  var MAX_PHOTOS = 30;

  function mediaZone(proj) {
    var zone = el('<div class="proj-opts proj-media" style="align-items:flex-start"></div>');

    var fFmt = el('<div class="field"><label>Video format</label></div>');
    var fmt = el('<select class="p-format">' +
      '<option value="">Auto (9:16 for TikTok, Instagram and Shorts, otherwise 16:9)</option>' +
      '<option value="landscape">16:9 landscape (YouTube, Vimeo…)</option>' +
      '<option value="portrait">9:16 portrait (TikTok, Reels, Shorts)</option></select>');
    fmt.value = proj.format === 'landscape' || proj.format === 'portrait' ? proj.format : '';
    fmt.addEventListener('change', function () { proj.format = fmt.value; markDirty(); });
    fFmt.appendChild(fmt);
    zone.appendChild(fFmt);

    var fPh = el('<div class="field grow"><label>Photos (gallery instead of the video)</label></div>');
    proj.photos = Array.isArray(proj.photos) ? proj.photos : [];
    var list = el('<div class="photo-list" style="display:flex;flex-wrap:wrap;gap:6px;min-height:8px"></div>');
    var msg = el('<span class="font-kind"></span>');

    // 48 px thumbnails: × to remove, ‹ › to reorder.
    function refresh() {
      list.innerHTML = '';
      proj.photos.forEach(function (u, k) {
        var item = el('<span class="photo-item" style="display:inline-flex;align-items:center;gap:2px;border:1px solid var(--a-border,#ddd);border-radius:4px;padding:2px"></span>');
        var img = document.createElement('img');
        img.alt = '';
        img.src = u;
        img.title = u;
        img.style.cssText = 'width:48px;height:48px;object-fit:cover;border-radius:3px;display:block;background:#222';
        item.appendChild(img);
        var left = el('<button class="btn small" type="button" title="Move earlier">‹</button>');
        left.disabled = k === 0;
        left.addEventListener('click', function () {
          proj.photos.splice(k - 1, 0, proj.photos.splice(k, 1)[0]);
          markDirty();
          refresh();
        });
        var right = el('<button class="btn small" type="button" title="Move later">›</button>');
        right.disabled = k === proj.photos.length - 1;
        right.addEventListener('click', function () {
          proj.photos.splice(k + 1, 0, proj.photos.splice(k, 1)[0]);
          markDirty();
          refresh();
        });
        var del = el('<button class="btn small danger" type="button" title="Remove">×</button>');
        del.addEventListener('click', function () {
          proj.photos.splice(k, 1);
          markDirty();
          refresh();
        });
        item.appendChild(left);
        item.appendChild(right);
        item.appendChild(del);
        list.appendChild(item);
      });
    }
    refresh();
    fPh.appendChild(list);

    var line = el('<div class="inline-form"></div>');
    // Upload: each file goes to api/cover (same flow as thumbnails), one after
    // the other to keep the chosen order; name = project id + index.
    var files = el('<input type="file" multiple accept="image/*" style="max-width:220px">');
    files.addEventListener('change', function () {
      var chosen = Array.prototype.slice.call(files.files || []);
      var room = MAX_PHOTOS - proj.photos.length;
      if (chosen.length > room) { msg.textContent = 'Up to ' + MAX_PHOTOS + ' photos per project'; chosen = chosen.slice(0, Math.max(0, room)); }
      var base = proj.photos.length;
      (function next(k) {
        if (k >= chosen.length) { files.value = ''; return; }
        uploadCover(chosen[k], proj.id + '-' + (base + k), msg, function (u) {
          proj.photos.push(u);
          refresh();
          next(k + 1);
        });
      })(0);
    });
    var url = el('<input placeholder="or an image URL" style="flex:1;min-width:160px">');
    var addUrl = el('<button class="btn small" type="button">Add</button>');
    function commitUrl() {
      var v = url.value.trim();
      if (!v) return;
      if (!ABOUT_PHOTO_URL.test(v)) { msg.textContent = 'Unrecognized URL: use http(s)://… or an uploaded image'; return; }
      if (proj.photos.length >= MAX_PHOTOS) { msg.textContent = 'Up to ' + MAX_PHOTOS + ' photos per project'; return; }
      proj.photos.push(v);
      url.value = '';
      msg.textContent = '';
      markDirty();
      refresh();
    }
    addUrl.addEventListener('click', commitUrl);
    url.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); commitUrl(); } });
    line.appendChild(files);
    line.appendChild(url);
    line.appendChild(addUrl);
    line.appendChild(msg);
    fPh.appendChild(line);
    fPh.appendChild(el('<span class="hint">With photos, the video link is not used: the cover shows a gallery (arrows, click = next). Up to ' + MAX_PHOTOS + ' photos; each image is downsized on upload (1600 px max, WebP).</span>'));
    zone.appendChild(fPh);
    return zone;
  }

  /* ===== Gallery (shorts) ===== */
  function renderShorts() {
    var max = Site.GLOBE_MAX;
    var note = el('<p class="panel-note">Each row = <b>one screen on the globe</b> on the Gallery page (the first video faces the visitor when the page opens). ' +
      'The globe holds about fifty portrait screens (about thirty in 16:9): with fewer videos, they are <b>repeated</b> to fill it; ' +
      'with more, the screens shrink, up to <b>' + max + ' videos maximum</b> — any beyond that are not shown. Drag ⠿ to change the order.</p>');
    $panel.appendChild(note);

    // Globe settings
    var settings = el('<div class="card settings-card"></div>');
    var fRatio = el('<div class="field"><label>Screen format</label></div>');
    var ratioSel = el('<select id="shorts-ratio">' +
      '<option value="portrait">Portrait 9:16 (Shorts, Reels, TikTok)</option>' +
      '<option value="landscape">Landscape 16:9</option></select>');
    ratioSel.value = C.shorts.ratio === 'landscape' ? 'landscape' : 'portrait';
    ratioSel.addEventListener('change', function () {
      C.shorts.ratio = ratioSel.value;
      markDirty();
      render();
    });
    fRatio.appendChild(ratioSel);
    settings.appendChild(fRatio);
    var shown = Math.min(C.shorts.items.length, max);
    var count = el('<div class="field"><label>On the globe</label><div class="settings-count" id="shorts-count">' +
      shown + ' video' + (shown !== 1 ? 's' : '') +
      (C.shorts.items.length > max ? ' <span class="badge-out">+ ' + (C.shorts.items.length - max) + ' hidden</span>' : '') +
      '</div></div>');
    settings.appendChild(count);
    $panel.appendChild(settings);

    var list = document.createElement('div');
    list.id = 'shorts-list';
    C.shorts.items.forEach(function (item, idx) {
      list.appendChild(shortCard(item, idx));
    });
    $panel.appendChild(list);

    var add = el('<div class="add-row"><button class="btn" type="button">+ Add a video</button></div>');
    add.querySelector('button').addEventListener('click', function () {
      var pair = PAIRS_MAIN[C.shorts.items.length % 10];
      C.shorts.items.push({ id: Site.uid('s'), title: 'New video', url: '', cover: '', bg: pair[0], text: pair[1], font: 'Anton' });
      markDirty();
      render();
    });
    $panel.appendChild(add);

    makeSortable(list, '.card', function (order) {
      reorder(C.shorts.items, order);
      markDirty();
      render();
    });
  }

  function shortCard(item, idx) {
    var landscape = C.shorts.ratio === 'landscape';
    var out = idx >= Site.GLOBE_MAX;
    var card = el('<div class="card openned' + (out ? ' out-of-globe' : '') + '" data-idx="' + idx + '"></div>');
    var head = el('<div class="card-head">' +
      '<span class="drag-handle" draggable="true" title="Drag to reorder">⠿</span>' +
      '<span class="color-dot" style="background:' + esc(item.bg) + ';color:' + esc(item.text) + '">A</span>' +
      '</div>');
    var title = el('<input class="head-name" value="' + esc(item.title) + '" placeholder="Title shown on the screen">');
    title.addEventListener('input', function () { item.title = title.value; markDirty(); refreshPreview(); });
    head.appendChild(title);
    if (out) head.appendChild(el('<span class="badge-out" title="The globe shows at most ' + Site.GLOBE_MAX + ' videos">Not on globe</span>'));
    var del = el('<button class="btn small danger" type="button">Delete</button>');
    del.addEventListener('click', function () {
      if (!confirm('Delete "' + item.title + '"?')) return;
      C.shorts.items.splice(idx, 1);
      markDirty();
      render();
    });
    head.appendChild(del);
    card.appendChild(head);

    var body = el('<div class="card-body short-body" style="display:block"></div>');

    // Preview: exactly what the globe will show (same thumbnail engine)
    var preview = el('<div class="short-preview' + (landscape ? ' landscape' : '') + '" title="Preview of the screen on the globe"></div>');
    function refreshPreview() {
      preview.innerHTML = '';
      Site.ensureFonts([item.font], C);
      preview.appendChild(Site.thumbNode(item, C));
    }
    refreshPreview();
    body.appendChild(preview);

    var fields = el('<div class="fields"></div>');

    // English twin of the title (typed in the card header), first in the
    // fields; the preview follows the admin browser's language.
    if (showEn) {
      var fTitleEn = el('<div class="field grow"><label>Title (English)</label></div>');
      fTitleEn.appendChild(enField(item, 'title', title, refreshPreview));
      fields.appendChild(fTitleEn);
    }

    var fUrl = el('<div class="field grow"><label>Video link (' + (landscape ? 'landscape 16:9' : 'portrait 9:16') + ' format)</label></div>');
    var url = el('<input value="' + esc(item.url) + '" placeholder="YouTube Shorts, Instagram, TikTok, Vimeo, Google Drive, .mp4…" style="width:100%">');
    var urlTimer = null;
    url.addEventListener('input', function () {
      item.url = url.value;
      markDirty();
      clearTimeout(urlTimer);
      urlTimer = setTimeout(refreshPreview, 500);
    });
    fUrl.appendChild(url);
    fields.appendChild(fUrl);

    // Role on the project (AD, project lead…): under the title when hovering
    // the screen, and as a tilted label on the player.
    var fRole = el('<div class="field"><label>Role</label></div>');
    var roleIn = el('<input class="s-role" list="role-suggestions" value="' + esc(item.role || '') + '" placeholder="AD, project lead…">');
    roleIn.addEventListener('input', function () { item.role = roleIn.value; markDirty(); });
    fRole.appendChild(roleIn);
    enAfter(roleIn, item, 'role');
    fields.appendChild(fRole);

    var fCover = el('<div class="field grow"><label>Thumbnail (image shown on the globe)</label></div>');
    var coverRow = el('<div class="inline-form"></div>');
    var cover = el('<input value="' + esc(item.cover || '') + '" placeholder="Image URL — or upload a file →" style="flex:1;min-width:180px">');
    cover.addEventListener('input', function () {
      item.cover = cover.value.trim();
      markDirty();
      clearTimeout(urlTimer);
      urlTimer = setTimeout(refreshPreview, 500);
    });
    var cFile = el('<input type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.avif" style="max-width:200px">');
    var cMsg = el('<span class="font-kind"></span>');
    cFile.addEventListener('change', function () {
      var file = cFile.files && cFile.files[0];
      if (!file) return;
      uploadCover(file, item.id, cMsg, function (url) {
        item.cover = url;
        cover.value = url;
        refreshPreview();
      });
    });
    coverRow.appendChild(cover);
    coverRow.appendChild(cFile);
    coverRow.appendChild(cMsg);
    fCover.appendChild(coverRow);
    fCover.appendChild(el('<span class="hint">Paste an <b>image</b> here (not the video link — it would be ignored). Without a thumbnail: automatic image from YouTube / TikTok / Vimeo / Google Drive (or the first frame of an .mp4 file); for <b>Instagram</b>, automatic fetching isn\'t guaranteed — upload a screenshot of the reel if needed. Otherwise: a colored card with the title.</span>'));
    fields.appendChild(fCover);

    var fBg = el('<div class="field"><label>Background color</label></div>');
    fBg.appendChild(colorField(item.bg, 'shorts', false, function (v) {
      item.bg = v;
      head.querySelector('.color-dot').style.background = v;
      markDirty();
      refreshPreview();
    }));
    fields.appendChild(fBg);

    var fTx = el('<div class="field"><label>Text color</label></div>');
    fTx.appendChild(colorField(item.text, 'shorts', false, function (v) {
      item.text = v;
      head.querySelector('.color-dot').style.color = v;
      markDirty();
      refreshPreview();
    }));
    fields.appendChild(fTx);

    var fFont = el('<div class="field"><label>Font</label></div>');
    fFont.appendChild(fontSelect(item.font, false, function (v) { item.font = v; markDirty(); refreshPreview(); }));
    fields.appendChild(fFont);

    body.appendChild(fields);
    card.appendChild(body);
    return card;
  }

  /* ===== About (kraft folder) ===== */
  var ABOUT_KEYS = ['desc', 'cv', 'edu', 'hobbies', 'content'];
  // Same filter as the server-side safeUrl (api/content.js): a rejected URL is
  // flagged while typing instead of being silently dropped on save.
  var ABOUT_PHOTO_URL = /^(https?:\/\/|\/?api\/cover\?|assets\/)/i;
  var ABOUT_TITLES = {
    desc: 'Card — About me',
    cv: 'Card — Experience',
    edu: 'Card — Education',
    hobbies: 'Card — Hobbies',
    content: 'Card — Content creation (hub: handle, platforms, videos, photos, collabs)',
  };
  // Hub of the "content creation" card: four fixed platforms, in the
  // sketch's order; at most 40 tiles per list (same as the API).
  var ABOUT_PLATFORMS = [['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['twitch', 'Twitch'], ['youtube', 'YouTube']];
  var ABOUT_MAX_TILES = 40;
  var ABOUT_FONTS = [
    ['type', 'Headings / labels font (typewriter)'],
    ['body', 'Body text font'],
    ['hand', 'Handwriting font'],
  ];
  // Link opened in a new tab: http(s) only (same filter as the API).
  var ABOUT_LINK = /^https?:\/\//i;
  function aStr(v) { return typeof v === 'string' ? v : ''; }
  function aList(v) { return Array.isArray(v) ? v : []; }
  function aObj(v) { return v && typeof v === 'object' ? v : {}; }
  function aTile(t) { t = aObj(t); return { url: aStr(t.url), cover: aStr(t.cover), title: aStr(t.title), title_en: aStr(t.title_en) }; }

  // Complete `about` object (empty strings by default, four cards, photo
  // stack, fonts, hub, English twins): the admin and the page share this
  // merge so a missing key is never read.
  function mergeAbout(a) {
    a = aObj(a);
    var out = { cards: {} };
    ['photo', 'name', 'title', 'stamp', 'note', 'how'].forEach(function (k) { out[k] = aStr(a[k]); });
    ['title', 'stamp', 'note', 'how'].forEach(function (k) { out[k + '_en'] = aStr(a[k + '_en']); });
    ABOUT_KEYS.forEach(function (k) {
      var c = aObj(a.cards && a.cards[k]);
      out.cards[k] = { label: aStr(c.label), text: aStr(c.text), label_en: aStr(c.label_en), text_en: aStr(c.text_en) };
    });
    out.photos = aList(a.photos).filter(function (u) { return typeof u === 'string' && u; }).slice(0, MAX_PHOTOS);
    var f = aObj(a.fonts);
    out.fonts = { type: aStr(f.type), body: aStr(f.body), hand: aStr(f.hand) };
    var s = aObj(a.social);
    var given = aList(s.platforms).map(aObj);
    out.social = {
      handle: aStr(s.handle),
      platforms: ABOUT_PLATFORMS.map(function (pl) {
        var p = {};
        for (var i = 0; i < given.length; i++) if (given[i].kind === pl[0]) { p = given[i]; break; }
        return { kind: pl[0], url: aStr(p.url), followers: aStr(p.followers) };
      }),
      videos: aList(s.videos).slice(0, ABOUT_MAX_TILES).map(aTile),
      collabs: aList(s.collabs).slice(0, ABOUT_MAX_TILES).map(aTile),
      photos: aList(s.photos).slice(0, ABOUT_MAX_TILES).map(function (p) { p = aObj(p); return { img: aStr(p.img), link: aStr(p.link) }; }),
    };
    return out;
  }

  // Image list (multi-upload, ‹ › × thumbnails, URL): the folder's photo
  // stack — same model as the photo area of the Collabs page.
  // `arr` is modified in place; `name` prefixes uploaded files.
  function aboutPhotoZone(arr, name, max) {
    var zone = el('<div class="about-photo-row" style="display:block"></div>');
    var list = el('<div class="photo-list" style="display:flex;flex-wrap:wrap;gap:6px;min-height:8px;margin-bottom:8px"></div>');
    var msg = el('<span class="font-kind"></span>');
    function refresh() {
      list.innerHTML = '';
      arr.forEach(function (u, k) {
        var item = el('<span class="photo-item" style="display:inline-flex;align-items:center;gap:2px;border:1px solid var(--a-border,#ddd);border-radius:4px;padding:2px"></span>');
        var img = document.createElement('img');
        img.alt = '';
        img.src = u;
        img.title = u;
        img.style.cssText = 'width:64px;height:64px;object-fit:cover;object-position:50% 30%;border-radius:3px;display:block;background:#222';
        item.appendChild(img);
        var left = el('<button class="btn small" type="button" title="Move earlier">‹</button>');
        left.disabled = k === 0;
        left.addEventListener('click', function () { arr.splice(k - 1, 0, arr.splice(k, 1)[0]); markDirty(); refresh(); });
        var right = el('<button class="btn small" type="button" title="Move later">›</button>');
        right.disabled = k === arr.length - 1;
        right.addEventListener('click', function () { arr.splice(k + 1, 0, arr.splice(k, 1)[0]); markDirty(); refresh(); });
        var del = el('<button class="btn small danger" type="button" title="Remove">×</button>');
        del.addEventListener('click', function () { arr.splice(k, 1); markDirty(); refresh(); });
        item.appendChild(left);
        item.appendChild(right);
        item.appendChild(del);
        list.appendChild(item);
      });
    }
    refresh();
    zone.appendChild(list);
    var line = el('<div class="inline-form"></div>');
    var files = el('<input type="file" multiple accept="image/*" style="max-width:220px">');
    files.addEventListener('change', function () {
      var chosen = Array.prototype.slice.call(files.files || []);
      var room = max - arr.length;
      if (chosen.length > room) { msg.textContent = 'Up to ' + max + ' photos'; chosen = chosen.slice(0, Math.max(0, room)); }
      (function next(k) {
        if (k >= chosen.length) { files.value = ''; return; }
        uploadCover(chosen[k], name + '-' + Date.now().toString(36) + k, msg, function (u) { arr.push(u); refresh(); next(k + 1); });
      })(0);
    });
    var url = el('<input placeholder="or an image URL, then Add" style="flex:1;min-width:180px">');
    var addUrl = el('<button class="btn small" type="button">Add</button>');
    // URL the server would reject (javascript:, data:…): flagged while typing.
    url.addEventListener('input', function () {
      var v = url.value.trim();
      msg.textContent = !v || ABOUT_PHOTO_URL.test(v) ? '' : 'Unrecognized URL: use http(s)://… or an uploaded image';
    });
    function commitUrl() {
      var v = url.value.trim();
      if (!v || !ABOUT_PHOTO_URL.test(v)) return;
      if (arr.length >= max) { msg.textContent = 'Up to ' + max + ' photos'; return; }
      arr.push(v);
      url.value = '';
      msg.textContent = '';
      markDirty();
      refresh();
    }
    addUrl.addEventListener('click', commitUrl);
    url.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); commitUrl(); } });
    line.appendChild(files);
    line.appendChild(url);
    line.appendChild(addUrl);
    line.appendChild(msg);
    zone.appendChild(line);
    return zone;
  }

  // Hub tile list: videos and collabs (link, cover image URL or upload,
  // title) or photos (image URL or upload, link). ‹ › × and Add.
  function aboutTileList(arr, kind, max) {
    var photo = kind === 'photos';
    var zone = el('<div class="about-tiles"></div>');
    var rows = el('<div style="display:flex;flex-direction:column;gap:8px"></div>');
    var msg = el('<span class="font-kind"></span>');
    var imgKey = photo ? 'img' : 'cover';
    function refresh() {
      rows.innerHTML = '';
      arr.forEach(function (t, k) {
        var row = el('<div class="inline-form about-tile-row"></div>');
        var pv = document.createElement('img');
        pv.alt = '';
        pv.style.cssText = 'width:40px;height:40px;object-fit:cover;border-radius:3px;background:#222;flex:none';
        pv.style.visibility = t[imgKey] ? 'visible' : 'hidden';
        if (t[imgKey]) pv.src = t[imgKey];
        row.appendChild(pv);
        function field(key, ph, min) {
          var i = el('<input style="flex:1;min-width:' + min + 'px">');
          i.placeholder = ph;
          i.className = 'about-tile-' + key;
          i.value = t[key] || '';
          i.addEventListener('input', function () {
            var v = i.value.trim();
            t[key] = v;
            if (key === imgKey) { pv.style.visibility = v ? 'visible' : 'hidden'; if (v) pv.src = v; }
            if ((key === 'url' || key === 'link') && v && !ABOUT_LINK.test(v)) msg.textContent = 'Unrecognized link: it must start with http(s)://';
            else if (key === imgKey && v && !ABOUT_PHOTO_URL.test(v)) msg.textContent = 'Unrecognized image: use http(s)://… or an uploaded image';
            else msg.textContent = '';
            markDirty();
          });
          row.appendChild(i);
        }
        if (photo) {
          field('img', 'Image URL', 170);
          field('link', 'Post link (optional)', 150);
        } else {
          field('url', 'Video link (YouTube, TikTok, Instagram, Twitch…)', 200);
          field('cover', 'Cover image (URL, optional)', 150);
          field('title', 'Title', 100);
          enAfter(row.lastChild, t, 'title');
        }
        var file = el('<input type="file" accept="image/*" style="max-width:150px" title="Upload an image">');
        file.addEventListener('change', function () {
          var f = file.files && file.files[0];
          if (!f) return;
          uploadCover(f, 'about-' + kind + '-' + Date.now().toString(36), msg, function (u) { t[imgKey] = u; refresh(); });
        });
        row.appendChild(file);
        var left = el('<button class="btn small" type="button" title="Move earlier">‹</button>');
        left.disabled = k === 0;
        left.addEventListener('click', function () { arr.splice(k - 1, 0, arr.splice(k, 1)[0]); markDirty(); refresh(); });
        var right = el('<button class="btn small" type="button" title="Move later">›</button>');
        right.disabled = k === arr.length - 1;
        right.addEventListener('click', function () { arr.splice(k + 1, 0, arr.splice(k, 1)[0]); markDirty(); refresh(); });
        var del = el('<button class="btn small danger" type="button" title="Remove">×</button>');
        del.addEventListener('click', function () { arr.splice(k, 1); markDirty(); refresh(); });
        row.appendChild(left);
        row.appendChild(right);
        row.appendChild(del);
        rows.appendChild(row);
      });
    }
    refresh();
    zone.appendChild(rows);
    var foot = el('<div class="inline-form" style="margin-top:6px"></div>');
    var add = el('<button class="btn small" type="button">+ Add</button>');
    add.addEventListener('click', function () {
      if (arr.length >= max) { msg.textContent = 'Up to ' + max; return; }
      arr.push(photo ? { img: '', link: '' } : { url: '', cover: '', title: '' });
      markDirty();
      refresh();
    });
    foot.appendChild(add);
    foot.appendChild(msg);
    zone.appendChild(foot);
    return zone;
  }

  function renderAbout() {
    var A = C.about;
    $panel.appendChild(el('<p class="panel-note">The About page is a <b>cardboard folder</b>: a stack of photos, a label, four tabbed cards and a sticky note. ' +
      'The "Content creation" card also carries the hub: handle, platforms and followers, videos, photos, collabs. ' +
      'Tab titles fall back to default labels when left empty; texts appear exactly as entered. ' +
      'A blank line separates two paragraphs · <code>- </code> at the start of a line makes a bullet · <code>2024 — 2026 — Position · Client</code> makes a dated line. ' +
      '<a href="about" target="_blank" rel="noopener">View page ↗</a></p>'));

    // Open card with a title; returns its body.
    function section(title) {
      var card = el('<div class="card openned about-card"><div class="card-head"><h3></h3></div><div class="card-body"></div></div>');
      card.querySelector('h3').textContent = title;
      $panel.appendChild(card);
      return card.querySelector('.card-body');
    }
    function hint(text) {
      var h = el('<span class="hint"></span>');
      h.textContent = text;
      return h;
    }
    // Text field bound to A[key] (+ English twin, unless `noEn`: the folder name).
    function textField(parent, label, key, max, placeholder, help, noEn) {
      var f = el('<div class="field grow"><label></label></div>');
      f.querySelector('label').textContent = label;
      var inp = el('<input maxlength="' + max + '">');
      inp.placeholder = placeholder || '';
      inp.value = A[key] || '';
      inp.addEventListener('input', function () { A[key] = inp.value; markDirty(); });
      f.appendChild(inp);
      if (!noEn) enAfter(inp, A, key);
      if (help) f.appendChild(hint(help));
      parent.appendChild(f);
    }
    // Textarea with an "n / max" counter, bound to obj[key] (+ English twin).
    function textArea(parent, label, obj, key, rows, max) {
      var f = el('<div class="field grow about-text"><label></label></div>');
      f.querySelector('label').textContent = label;
      var ta = el('<textarea rows="' + rows + '" maxlength="' + max + '"></textarea>');
      ta.value = obj[key] || '';
      var count = el('<span class="hint about-count"></span>');
      function update() { count.textContent = ta.value.length + ' / ' + max; }
      update();
      ta.addEventListener('input', function () { obj[key] = ta.value; update(); markDirty(); });
      f.appendChild(ta);
      f.appendChild(count);
      var twin = enField(obj, key, ta);
      if (twin) f.appendChild(twin);
      parent.appendChild(f);
    }

    /* Folder */
    var dossier = section('Folder');
    var fields = el('<div class="fields"></div>');
    textField(fields, 'Folder name', 'name', 60, 'AUDREY-LILLIE', '', true);
    textField(fields, 'Heading', 'title', 120, 'FILE NO. 001 · GRAPHIC DESIGN & ART DIRECTION');
    textField(fields, 'Round sticker', 'stamp', 24, 'CONFIDENTIAL', 'empty: no sticker · 1 or 2 short words (past 12 letters, a word wraps onto two lines)');
    textField(fields, 'Handwritten note', 'note', 80, 'opened 09/12 at 2:32 am — do not file', 'empty: no note · 3 lines max on the page');
    dossier.appendChild(fields);
    // Folder fonts: "Default" = the page's own (Special Elite, IBM Plex Mono,
    // Caveat); the others come from the Fonts tab.
    var fontFields = el('<div class="fields"></div>');
    ABOUT_FONTS.forEach(function (pair) {
      var f = el('<div class="field"><label></label></div>');
      f.querySelector('label').textContent = pair[1];
      var sel = fontSelect(A.fonts[pair[0]], true, function (v) { A.fonts[pair[0]] = v; markDirty(); });
      sel.querySelector('option[value=""]').textContent = 'Default';
      f.appendChild(sel);
      fontFields.appendChild(f);
    });
    dossier.appendChild(fontFields);
    dossier.appendChild(hint('Fonts: "Default" keeps the folder\'s own (typewriter, mono, handwriting). Fonts added in the Fonts tab are offered here.'));

    /* Photos: stack of prints. The old single photo becomes the first one. */
    if (A.photo) {
      if (A.photos.indexOf(A.photo) === -1) A.photos.unshift(A.photo);
      A.photo = '';
    }
    var photo = section('Photos');
    photo.appendChild(aboutPhotoZone(A.photos, 'about-photo', MAX_PHOTOS));
    photo.appendChild(hint('The first one is on top; the others form a stack you flip through with a click. Square or portrait photos, face in the upper third; up to ' + MAX_PHOTOS + '; each image is downsized on upload (1600 px max, WebP).'));

    /* Four cards */
    ABOUT_KEYS.forEach(function (k) {
      var c = A.cards[k];
      var body = section(ABOUT_TITLES[k]);
      var fs = el('<div class="fields"></div>');
      var fl = el('<div class="field grow"><label>Displayed title (optional — otherwise the default label)</label></div>');
      var lab = el('<input maxlength="40">');
      lab.value = c.label || '';
      lab.addEventListener('input', function () { c.label = lab.value; markDirty(); });
      fl.appendChild(lab);
      enAfter(lab, c, 'label');
      fs.appendChild(fl);
      body.appendChild(fs);
      textArea(body, 'Text', c, 'text', 8, 4000);
      if (k === 'content') aboutHub(body);
    });

    /* Sticky note */
    var how = section('Sticky note "How I ♥ to work"');
    textArea(how, 'Sticky note text', A, 'how', 3, 500);

    // Hub of the "content creation" card, under its text: handle, four
    // platforms (link + followers), video / collab / photo lists.
    function aboutHub(body) {
      var S = A.social;
      function sub(title, help) {
        var h = el('<h4 class="about-sub" style="margin:18px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.05em"></h4>');
        h.textContent = title;
        body.appendChild(h);
        if (help) body.appendChild(hint(help));
      }
      sub('"Content creation" hub', 'Under the card text: the handle as a heading, the platform logos with follower counts (clickable), then videos, photos and the Collab row. Anything empty is hidden.');
      var hf = el('<div class="fields"></div>');
      var fh = el('<div class="field"><label>Handle</label></div>');
      var handle = el('<input maxlength="60" placeholder="@audreylilliee">');
      handle.className = 'about-handle';
      handle.value = S.handle || '';
      handle.addEventListener('input', function () { S.handle = handle.value; markDirty(); });
      fh.appendChild(handle);
      hf.appendChild(fh);
      body.appendChild(hf);
      var pf = el('<div class="fields"></div>');
      S.platforms.forEach(function (p, i) {
        var f = el('<div class="field grow about-platform"></div>');
        f.setAttribute('data-kind', p.kind);
        var lab = el('<label></label>');
        lab.textContent = ABOUT_PLATFORMS[i][1];
        f.appendChild(lab);
        var line = el('<div class="inline-form"></div>');
        var url = el('<input placeholder="Channel link (https://…)" style="flex:1;min-width:170px">');
        url.className = 'about-platform-url';
        url.value = p.url || '';
        url.addEventListener('input', function () { p.url = url.value.trim(); markDirty(); });
        var fol = el('<input maxlength="20" placeholder="12k" style="width:80px">');
        fol.className = 'about-platform-followers';
        fol.value = p.followers || '';
        fol.addEventListener('input', function () { p.followers = fol.value.trim(); markDirty(); });
        line.appendChild(url);
        line.appendChild(fol);
        f.appendChild(line);
        pf.appendChild(f);
      });
      body.appendChild(pf);
      body.appendChild(hint('Followers: shown as typed ("12k", "1.2M"). A platform with no link and no followers is hidden.'));
      sub('Videos (portrait 9:16 tiles)', 'Reels, TikTok, Shorts: a click opens the link. Automatic thumbnail (YouTube, TikTok, Instagram, Vimeo, Drive) or an uploaded cover image; without an image, a colored card with the title.');
      body.appendChild(aboutTileList(S.videos, 'videos', ABOUT_MAX_TILES));
      sub('Photos (squares)', 'Instagram photos: image + post link (optional).');
      body.appendChild(aboutTileList(S.photos, 'photos', ABOUT_MAX_TILES));
      sub('Collab (landscape 16:9 tiles)', 'Same rules as the videos, in a larger format.');
      body.appendChild(aboutTileList(S.collabs, 'collabs', ABOUT_MAX_TILES));
    }
  }

  /* ===== Contact (overlay badge) ===== */
  var CONTACT_KEYS = ['photo', 'first', 'last', 'title', 'title_en', 'email', 'phone', 'note', 'note_en'];

  // Complete `contact` object (empty strings by default): older content
  // without this key is edited like the rest, without reading a missing property.
  function mergeContact(c) {
    c = c && typeof c === 'object' ? c : {};
    var out = {};
    CONTACT_KEYS.forEach(function (k) { out[k] = typeof c[k] === 'string' ? c[k] : ''; });
    return out;
  }

  function renderContact() {
    var K = C.contact;
    $panel.appendChild(el('<p class="panel-note">"Contact me" opens a <b>badge holder</b> over the current page (the page stays visible behind it): ' +
      'photo, first and last name, job title, clickable email and phone, and an optional note. ' +
      'Empty fields are not shown. The badge is in the menu on every page, including the home page.</p>'));

    function section(title) {
      var card = el('<div class="card openned about-card"><div class="card-head"><h3></h3></div><div class="card-body"></div></div>');
      card.querySelector('h3').textContent = title;
      $panel.appendChild(card);
      return card.querySelector('.card-body');
    }
    function hint(text) {
      var h = el('<span class="hint"></span>');
      h.textContent = text;
      return h;
    }
    // Text field bound to K[key]; `type` picks the right keyboard (email, tel);
    // `en`: English twin (job title and note only).
    function textField(parent, label, key, max, placeholder, help, type, en) {
      var f = el('<div class="field grow"><label></label></div>');
      f.querySelector('label').textContent = label;
      var inp = el('<input maxlength="' + max + '" type="' + (type || 'text') + '">');
      inp.placeholder = placeholder || '';
      inp.value = K[key] || '';
      inp.addEventListener('input', function () { K[key] = inp.value; markDirty(); });
      f.appendChild(inp);
      if (en) enAfter(inp, K, key);
      if (help) f.appendChild(hint(help));
      parent.appendChild(f);
    }

    /* Photo: same preview as the About folder, same upload (api/cover) */
    var photo = section('Photo');
    var row = el('<div class="about-photo-row"></div>');
    var preview = el('<div class="about-photo-preview"></div>');
    function refreshPreview() {
      preview.innerHTML = '';
      if (K.photo) {
        var img = document.createElement('img');
        img.alt = '';
        img.src = K.photo;
        preview.appendChild(img);
      } else {
        preview.appendChild(el('<span class="about-photo-none"><svg viewBox="0 0 64 64" aria-hidden="true">' +
          '<circle cx="32" cy="22" r="12"/><path d="M8 62c2-16 12-24 24-24s22 8 24 24z"/></svg>no photo</span>'));
      }
    }
    refreshPreview();
    row.appendChild(preview);
    var pFields = el('<div class="fields"></div>');
    var fUrl = el('<div class="field grow"><label>Image</label></div>');
    var line = el('<div class="inline-form"></div>');
    var url = el('<input placeholder="Image URL — or upload a file →" style="flex:1;min-width:180px">');
    url.value = K.photo || '';
    var msg = el('<span class="font-kind"></span>');
    var urlTimer = null;
    url.addEventListener('input', function () {
      var v = url.value.trim();
      var ok = !v || ABOUT_PHOTO_URL.test(v);
      // URL the server would reject: flagged here instead of silently lost.
      K.photo = ok ? v : '';
      msg.textContent = ok ? '' : 'Unrecognized URL: use http(s)://… or an uploaded image';
      markDirty();
      clearTimeout(urlTimer);
      urlTimer = setTimeout(refreshPreview, 500);
    });
    var file = el('<input type="file" accept=".jpg,.jpeg,.png,.webp,.avif" style="max-width:200px">');
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      uploadCover(f, 'contact-photo', msg, function (u) {
        K.photo = u;
        url.value = u;
        refreshPreview();
      });
    });
    line.appendChild(url);
    line.appendChild(file);
    line.appendChild(msg);
    fUrl.appendChild(line);
    fUrl.appendChild(hint('Small square photo on the badge (≈ 96 px); empty: gray silhouette. Image downsized on upload.'));
    pFields.appendChild(fUrl);
    row.appendChild(pFields);
    photo.appendChild(row);

    /* Identity */
    var who = section('Identity');
    var f1 = el('<div class="fields"></div>');
    textField(f1, 'First name', 'first', 60, 'Audrey-Lillie');
    textField(f1, 'Last name', 'last', 60, 'Bing');
    who.appendChild(f1);
    var f2 = el('<div class="fields"></div>');
    textField(f2, 'Job title', 'title', 120, 'Graphic designer', 'one line under the name', 'text', true);
    who.appendChild(f2);

    /* Contact details */
    var how = section('Contact details');
    var f3 = el('<div class="fields"></div>');
    textField(f3, 'Email', 'email', 120, 'hello@example.com', '"mailto:" link on the badge', 'email');
    textField(f3, 'Phone', 'phone', 40, '+1 555 000 0000', '"tel:" link (shown as typed)', 'tel');
    how.appendChild(f3);
    var f4 = el('<div class="fields"></div>');
    textField(f4, 'Note', 'note', 160, 'Available for new projects', 'optional: a short line at the bottom of the badge', 'text', true);
    how.appendChild(f4);
  }

  /* ===== Data (audience stats) ===== */
  // Read-only: this tab never touches C, dirty or the Save button. Report
  // loaded from api/stats (password), reloaded on each period change; SVG
  // charts drawn right here. Colors: two site-palette hues checked side by
  // side (visits = periwinkle, visitors = raspberry), text always in ink.
  var DATA_RANGES = [[7, '7 days'], [30, '30 days'], [90, '90 days'], [365, '12 months']];
  var DATA_C1 = Site.PALETTE_MAIN[5];   // #7C8CD9 — visits, list bars
  var DATA_C2 = Site.PALETTE_MAIN[8];   // #D63F64 — visitors
  var dataDays = 7;
  try { dataDays = parseInt(localStorage.getItem('cc-admin-days'), 10) || 7; } catch (e) {}
  if (!DATA_RANGES.some(function (r) { return r[0] === dataDays; })) dataDays = 7;
  var dataReq = 0;
  var SOURCE_LABELS = { instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn', google: 'Google', youtube: 'YouTube',
    facebook: 'Facebook', x: 'X', snapchat: 'Snapchat', pinterest: 'Pinterest', direct: 'Direct' };
  var PAGE_LABELS = { '/': 'Home', '/about': 'About', '/youtube': 'Design', '/shorts': 'Gallery', '/brand': 'Collabs', other: 'Other' };
  var DEV_LABELS = { phone: 'Phone', desktop: 'Desktop' };
  var LANG_LABELS = { en: 'English', fr: 'French' };
  var EVENT_KINDS = { book: 'Collabs', yt: 'Design', short: 'Gallery' };
  var regionNames = null;
  try { regionNames = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) {}

  function fmtN(n) { return Number(n || 0).toLocaleString('en-US'); }
  function countryLabel(code) {
    if (!/^[A-Z]{2}$/.test(code)) return 'Unknown';
    var name = code;
    try { name = regionNames ? regionNames.of(code) : code; } catch (e) {}
    var flag = String.fromCodePoint(0x1F1E6 + code.charCodeAt(0) - 65, 0x1F1E6 + code.charCodeAt(1) - 65);
    return flag + ' ' + name;
  }
  function sourceLabel(k) { return SOURCE_LABELS[k] || (k.indexOf('other:') === 0 ? k.slice(6) : k); }
  function eventLabel(k) {
    var m = k.match(/^(book|yt|short):(.*)$/);
    return m ? EVENT_KINDS[m[1]] + ' · ' + m[2] : k;
  }

  // Horizontal bar list: top 10, share as a percentage of the total, bar
  // proportional to the first row, as a wash behind the label (single
  // series: one hue, text stays in ink).
  function dataList(title, obj, labelOf) {
    var keys = Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; });
    var total = keys.reduce(function (s, k) { return s + obj[k]; }, 0);
    var card = el('<div class="card data-card"><h3></h3></div>');
    card.querySelector('h3').textContent = title;
    if (!keys.length) {
      card.appendChild(el('<p class="data-none">Nothing yet</p>'));
      return card;
    }
    var max = obj[keys[0]];
    var ul = el('<ul class="data-list"></ul>');
    keys.slice(0, 10).forEach(function (k) {
      var li = el('<li><span class="lbl"><i></i><span class="t"></span></span><span class="n"></span><span class="pct"></span></li>');
      li.querySelector('.t').textContent = labelOf(k);
      li.querySelector('.lbl').title = labelOf(k);
      // The bar is a wash behind the label: it gets the full width.
      li.querySelector('.lbl i').style.width = (max ? Math.max(1.5, obj[k] / max * 100) : 0) + '%';
      li.querySelector('.n').textContent = fmtN(obj[k]);
      li.querySelector('.pct').textContent = (total ? Math.round(obj[k] / total * 100) : 0) + '%';
      ul.appendChild(li);
    });
    card.appendChild(ul);
    return card;
  }

  // Days → chart points: daily up to 30 days, weekly (Monday) beyond.
  // A week's visitors are the sum of daily visitors (the same visitor
  // returning on two days counts twice).
  function dataBuckets(days, weekly) {
    if (!weekly) {
      return days.map(function (d) { return { from: d.day, to: d.day, views: d.views, uniques: d.uniques }; });
    }
    var out = [], cur = null;
    days.forEach(function (d) {
      var dt = new Date(d.day + 'T00:00:00Z');
      var monday = new Date(dt.getTime() - ((dt.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10);
      if (!cur || cur.week !== monday) { cur = { week: monday, from: d.day, to: d.day, views: 0, uniques: 0 }; out.push(cur); }
      cur.to = d.day;
      cur.views += d.views;
      cur.uniques += d.uniques;
    });
    return out;
  }
  function fmtDay(iso, opts) {
    var d = new Date(iso + 'T12:00:00Z');
    try { return d.toLocaleDateString('en-US', opts || { day: 'numeric', month: 'short' }); } catch (e) { return iso; }
  }
  function niceStep(max) {
    if (max <= 0) return 1;
    var raw = max / 4, p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }
  function svgAttr(v) { return esc(String(v)); }

  // Columns (visits) + dotted line (visitors), single axis, hairline grid,
  // values on hover (<title>); all text in the panel's ink.
  function dataChart(buckets, weekly) {
    var W = 900, H = 260, L = 44, R = 14, T = 14, B = 30;
    var pw = W - L - R, ph = H - T - B;
    var n = buckets.length;
    var max = 0;
    buckets.forEach(function (b) { max = Math.max(max, b.views, b.uniques); });
    var step = niceStep(max);
    var top = Math.max(step, Math.ceil(max / step) * step);
    var slot = pw / n;
    var bw = Math.min(24, Math.max(2, slot - 2));
    var y = function (v) { return T + ph - v / top * ph; };
    var xc = function (i) { return L + slot * i + slot / 2; };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Visits and visitors per ' + (weekly ? 'week' : 'day') + '">';
    // Grid and value axis
    for (var v = 0; v <= top; v += step) {
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" class="grid"/>';
      s += '<text x="' + (L - 8) + '" y="' + (y(v) + 3.5).toFixed(1) + '" class="tick" text-anchor="end">' + fmtN(v) + '</text>';
    }
    // Date axis: one label every k columns, never crowded.
    var every = Math.max(1, Math.ceil(n / (weekly ? 13 : 10)));
    for (var i = 0; i < n; i++) {
      if (i % every === 0 || i === n - 1 && n - 1 - Math.floor((n - 1) / every) * every > every / 2) {
        s += '<text x="' + xc(i).toFixed(1) + '" y="' + (H - 10) + '" class="tick" text-anchor="middle">' + esc(fmtDay(buckets[i].from)) + '</text>';
      }
    }
    // Visit columns, each with a full-height hover area.
    var pts = [];
    buckets.forEach(function (b, k) {
      var x0 = xc(k) - bw / 2, yv = y(b.views), h = T + ph - yv;
      var label = (weekly ? fmtDay(b.from) + ' → ' + fmtDay(b.to) : fmtDay(b.from, { weekday: 'short', day: 'numeric', month: 'short' })) +
        ' — ' + fmtN(b.views) + ' visit' + (b.views !== 1 ? 's' : '') + ' · ' + fmtN(b.uniques) + ' visitor' + (b.uniques !== 1 ? 's' : '');
      s += '<g class="col"><title>' + esc(label) + '</title>';
      s += '<rect class="hit" x="' + (L + slot * k).toFixed(1) + '" y="' + T + '" width="' + slot.toFixed(1) + '" height="' + ph + '"/>';
      if (b.views > 0) {
        var r = Math.min(4, h / 2, bw / 2);
        s += '<path class="bar" d="M' + x0.toFixed(1) + ' ' + (T + ph) + 'V' + (yv + r).toFixed(1) + 'q0 -' + r + ' ' + r + ' -' + r + 'h' + (bw - 2 * r).toFixed(1) +
          'q' + r + ' 0 ' + r + ' ' + r + 'V' + (T + ph) + 'Z"/>';
      }
      s += '</g>';
      pts.push([xc(k), y(b.uniques)]);
    });
    // Visitor line: 2 px stroke, white-ringed dots.
    if (n > 1) {
      s += '<polyline class="line" points="' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>';
    }
    if (n <= 60) {
      pts.forEach(function (p, k) {
        s += '<circle class="dot" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4"><title>' + esc(fmtN(buckets[k].uniques) + ' visitor' + (buckets[k].uniques !== 1 ? 's' : '')) + '</title></circle>';
      });
    }
    s += '</svg>';
    return s;
  }

  function renderData() {
    var root = el('<div class="data-root"></div>');
    var head = el('<div class="data-head"><p class="panel-note"><b>Anonymous, cookie-free</b> audience measurement: one view per page load, one visitor = a non-reversible daily hash. Bots are ignored.</p>' +
      '<div class="data-range" role="group" aria-label="Period"></div></div>');
    var range = head.querySelector('.data-range');
    DATA_RANGES.forEach(function (r) {
      var b = el('<button type="button"></button>');
      b.textContent = r[1];
      b.setAttribute('data-days', r[0]);
      b.setAttribute('aria-pressed', r[0] === dataDays ? 'true' : 'false');
      b.addEventListener('click', function () {
        if (dataDays === r[0]) return;
        dataDays = r[0];
        try { localStorage.setItem('cc-admin-days', String(dataDays)); } catch (e) {}
        var all = range.querySelectorAll('button');
        for (var i = 0; i < all.length; i++) all[i].setAttribute('aria-pressed', all[i] === b ? 'true' : 'false');
        loadData(root);
      });
      range.appendChild(b);
    });
    root.appendChild(head);
    root.appendChild(el('<div class="data-body"><p class="data-loading">Loading…</p></div>'));
    $panel.appendChild(root);
    loadData(root);
  }

  function loadData(root) {
    var body = root.querySelector('.data-body');
    var id = ++dataReq;
    body.classList.add('loading');
    fetch('api/stats?days=' + dataDays, { cache: 'no-store', headers: { 'x-admin-password': pw } })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (id !== dataReq || !body.isConnected) return;
        body.classList.remove('loading');
        body.innerHTML = '';
        if (!res.ok) { body.appendChild(el('<div class="data-hint"></div>')).textContent = res.j.error || 'Error'; return; }
        if (res.j.configured === false) {
          var hint = el('<div class="data-hint"><b>Stats not configured.</b> <span></span> ' +
            '<a href="https://vercel.com/dashboard/stores" target="_blank" rel="noopener">Open Vercel Storage ↗</a></div>');
          hint.querySelector('span').textContent = res.j.hint || '';
          body.appendChild(hint);
          return;
        }
        drawData(body, res.j);
      })
      .catch(function (e) {
        if (id !== dataReq) return;
        body.classList.remove('loading');
        body.innerHTML = '<div class="data-hint">Stats unavailable: <span></span></div>';
        body.querySelector('span').textContent = (e && e.message) || 'network error';
      });
  }

  function drawData(body, rep) {
    var t = rep.totals || { views: 0, uniques: 0, events: 0 };
    var contacts = (rep.ev && rep.ev.contact) || 0;
    var perVisitor = t.uniques ? (t.views / t.uniques).toFixed(1) : '—';
    var tiles = el('<div class="data-tiles"></div>');
    [['Visits', fmtN(t.views), 'page views'], ['Visitors', fmtN(t.uniques), 'unique (estimate)'],
      ['Contact', fmtN(contacts), 'badge opens'], ['Views / visitor', perVisitor, 'over the period']].forEach(function (k) {
      var tile = el('<div class="stat-tile"><div class="label"></div><div class="value"></div><div class="sub"></div></div>');
      tile.querySelector('.label').textContent = k[0];
      tile.querySelector('.value').textContent = k[1];
      tile.querySelector('.sub').textContent = k[2];
      tiles.appendChild(tile);
    });
    body.appendChild(tiles);

    if (!t.views && !t.events) {
      body.appendChild(el('<div class="card data-card data-empty">No visits in this period</div>'));
      return;
    }

    var weekly = dataDays > 30;
    var buckets = dataBuckets(rep.days || [], weekly);
    var chart = el('<div class="card data-card data-chart"><h3></h3><div class="data-legend">' +
      '<span style="--k:' + DATA_C1 + '">Visits</span><span style="--k:' + DATA_C2 + '">Visitors' + (weekly ? ' (sum of days)' : '') + '</span></div>' +
      '<div class="svg-wrap"></div></div>');
    chart.querySelector('h3').textContent = weekly ? 'Per week' : 'Per day';
    chart.querySelector('.svg-wrap').innerHTML = dataChart(buckets, weekly);
    // Table twin: the same values, readable without the chart.
    var det = el('<details class="data-table"><summary>Show values</summary><table><thead><tr><th>' + (weekly ? 'Week of' : 'Day') + '</th><th>Visits</th><th>Visitors</th></tr></thead><tbody></tbody></table></details>');
    var tb = det.querySelector('tbody');
    buckets.forEach(function (b) {
      // (a <tr> doesn't survive innerHTML inside a <div>: built by hand)
      var tr = tb.insertRow();
      tr.insertCell().textContent = fmtDay(b.from, { day: 'numeric', month: 'short', year: 'numeric' });
      tr.insertCell().textContent = fmtN(b.views);
      tr.insertCell().textContent = fmtN(b.uniques);
    });
    chart.appendChild(det);
    body.appendChild(chart);

    var opened = {};
    Object.keys(rep.ev || {}).forEach(function (k) { if (/^(book|yt|short):/.test(k)) opened[k] = rep.ev[k]; });
    var grid = el('<div class="data-grid"></div>');
    grid.appendChild(dataList('Sources', rep.refs || {}, sourceLabel));
    grid.appendChild(dataList('Countries', rep.geo || {}, countryLabel));
    grid.appendChild(dataList('Pages', rep.pages || {}, function (k) { return PAGE_LABELS[k] || k; }));
    grid.appendChild(dataList('Content opened', opened, eventLabel));
    grid.appendChild(dataList('Devices', rep.dev || {}, function (k) { return DEV_LABELS[k] || k; }));
    grid.appendChild(dataList('Languages', rep.lang || {}, function (k) { return LANG_LABELS[k] || k; }));
    body.appendChild(grid);
  }

  /* ===== Fonts ===== */
  function renderFonts() {
    var note = el('<p class="panel-note">The fonts listed here are available in the projects\' "Font" menus. Add any <a href="https://fonts.google.com" target="_blank">Google Fonts</a> font by name, or upload your own font file.</p>');
    $panel.appendChild(note);

    var addZone = el('<div class="fonts-add"></div>');

    var gCard = el('<div class="card"><h3>Add a Google Font</h3>' +
      '<p>Type the exact name as it appears on fonts.google.com (e.g. "Rubik Mono One").</p></div>');
    var gForm = el('<div class="inline-form"></div>');
    var gName = el('<input placeholder="Font name" style="flex:1;min-width:160px">');
    var gBtn = el('<button class="btn primary" type="button">Add</button>');
    gBtn.addEventListener('click', function () {
      var n = gName.value.trim();
      if (!n) return;
      var exists = C.fonts.custom.some(function (f) { return f.name === n; }) || Site.GOOGLE_FONTS.indexOf(n) !== -1;
      if (!exists) {
        C.fonts.custom.push({ name: n, url: '', kind: 'google' });
        markDirty();
      }
      render();
    });
    gForm.appendChild(gName);
    gForm.appendChild(gBtn);
    gCard.appendChild(gForm);
    addZone.appendChild(gCard);

    var uCard = el('<div class="card"><h3>Upload a font file</h3>' +
      '<p>Accepted formats: .woff2, .woff, .ttf, .otf (4 MB max). The font is stored online and loaded automatically on the site.</p></div>');
    var uForm = el('<div class="inline-form"></div>');
    var uName = el('<input placeholder="Font name" style="flex:1;min-width:140px">');
    var uFile = el('<input type="file" accept=".woff2,.woff,.ttf,.otf" style="max-width:210px">');
    var uBtn = el('<button class="btn primary" type="button">Upload</button>');
    var uMsg = el('<span class="font-kind"></span>');
    uBtn.addEventListener('click', function () {
      var file = uFile.files && uFile.files[0];
      var name = uName.value.trim() || (file ? file.name.replace(/\.[^.]+$/, '') : '');
      if (!file) { uMsg.textContent = 'Choose a file'; return; }
      var ext = file.name.split('.').pop().toLowerCase();
      uMsg.textContent = 'Uploading…';
      var reader = new FileReader();
      reader.onload = function () {
        var b64 = String(reader.result).split(',')[1] || '';
        fetch('api/font', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
          body: JSON.stringify({ name: name, ext: ext, data: b64 }),
        })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (res) {
            if (!res.ok) { uMsg.textContent = res.j.error || 'Error'; return; }
            var existing = C.fonts.custom.filter(function (f) { return f.name === name; })[0];
            if (existing) { existing.url = res.j.url; existing.kind = 'file'; }
            else C.fonts.custom.push({ name: name, url: res.j.url, kind: 'file' });
            markDirty();
            render();
          })
          .catch(function () { uMsg.textContent = 'Network error'; });
      };
      reader.readAsDataURL(file);
    });
    uForm.appendChild(uName);
    uForm.appendChild(uFile);
    uForm.appendChild(uBtn);
    uForm.appendChild(uMsg);
    uCard.appendChild(uForm);
    addZone.appendChild(uCard);

    $panel.appendChild(addZone);

    var names = [];
    (C.fonts.custom || []).forEach(function (f) { names.push(f.name); });
    Site.ensureFonts(names.concat(Site.GOOGLE_FONTS), C);

    (C.fonts.custom || []).forEach(function (f, i) {
      var row = el('<div class="card font-card"></div>');
      row.appendChild(el('<div class="font-sample" style="font-family:' + esc(Site.fontStack(f.name, C)) + '">' + esc(f.name) + ' — audrey-lillie 2026</div>'));
      row.appendChild(el('<span class="font-kind">' + (f.kind === 'google' ? 'Google Font' : 'Uploaded file') + '</span>'));
      var del = el('<button class="btn small danger" type="button">Delete</button>');
      del.addEventListener('click', function () {
        C.fonts.custom.splice(i, 1);
        markDirty();
        render();
      });
      row.appendChild(del);
      $panel.appendChild(row);
    });

    Site.GOOGLE_FONTS.forEach(function (n) {
      var row = el('<div class="card font-card"></div>');
      row.appendChild(el('<div class="font-sample" style="font-family:' + esc(Site.fontStack(n, C)) + '">' + esc(n) + ' — audrey-lillie 2026</div>'));
      row.appendChild(el('<span class="font-kind">Built-in Google Font</span>'));
      $panel.appendChild(row);
    });

    Object.keys(Site.SYSTEM_FONTS).forEach(function (n) {
      var row = el('<div class="card font-card"></div>');
      row.appendChild(el('<div class="font-sample" style="font-family:' + esc(Site.SYSTEM_FONTS[n]) + '">' + esc(n) + ' — audrey-lillie 2026</div>'));
      row.appendChild(el('<span class="font-kind">System</span>'));
      $panel.appendChild(row);
    });
  }
})();
