/* YouTube / Brand content pages — colored dividers.
   One divider = one client. Several projects per client -> selection tabs. */
(function () {
  'use strict';

  var WEIGHTS = [1.1, 1.35, 0.8, 1.2, 0.9, 1.15, 0.85];
  var TAB_LEFTS = [72, 14, 62, 8, 44, 80, 22];
  var TILTS = [0, -1.3, 1.1, 1.2, 0, -1.15, 1.0];
  var TEXTURES = ['assets/img/carton-1.jpg', 'assets/img/carton-2.jpg', 'assets/img/carton-3.jpg', 'assets/img/carton-4.jpg'];
  var TAB_SHAPES = [
    { radius: '10px 10px 0 0', w: 170, h: 46 },
    { radius: '3px 26px 0 0', w: 190, h: 50 },
    { radius: '26px 3px 0 0', w: 150, h: 42 },
    { radius: '18px 18px 0 0', w: 210, h: 54 },
  ];
  // Beyond this many clients the page grows taller instead of squeezing the
  // dividers: each extra client adds the height it would take on a page with
  // exactly ten.
  var FIT_LIMIT = 10;
  // How much the panel overlaps the tabs (must match .mini-tabs margin-bottom).
  var TABS_OVERLAP = 6;
  // Role label tilt: always the same, only the direction varies.
  var ROLE_ANGLE = 10;

  // Same breakpoint as the phone media queries in site.css and dividers-mobile.css.
  var PHONE_QUERY = '(max-width: 860px)';

  var page = document.body.getAttribute('data-divider-page') || 'youtube';
  var wrap = document.getElementById('dividers');
  var clients = [];
  var expanded = null;          // index of the open client
  var selectedProject = {};     // clientIndex -> projectIndex
  var nodes = [];
  var phoneMode = false;        // mode the open content was rendered in
  var opened = null;            // elements of the open divider (for resizing)

  // On phones the open divider's layout changes completely (scrolling area,
  // full-width player): JS needs to know which mode it's in; the
  // dividers-mobile.css stylesheet does the rest.
  function isPhone() {
    return !!(window.matchMedia && window.matchMedia(PHONE_QUERY).matches);
  }

  function texSize(texIndex) {
    return (140 + texIndex * 30) + 'px ' + (140 + texIndex * 30) + 'px';
  }

  // Darkens a color by a given ratio, keeping its hue.
  function darken(hex, ratio) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length < 6) return hex || '#999999';
    var out = '#';
    for (var i = 0; i < 3; i++) {
      var v = parseInt(h.substr(i * 2, 2), 16);
      v = Math.max(0, Math.round(v * (1 - ratio)));
      out += ('0' + v.toString(16)).slice(-2);
    }
    return out;
  }

  function applyBg(el, color, texIndex) {
    el.style.backgroundImage = 'linear-gradient(' + color + ', ' + color + '), url(' + TEXTURES[texIndex] + ')';
    el.style.backgroundSize = '100% 100%, ' + texSize(texIndex);
    el.style.backgroundRepeat = 'no-repeat, repeat';
    el.style.backgroundBlendMode = 'color, normal';
  }

  function baseHeight() {
    var chrome = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--chrome-h')) || 96;
    return Math.max(320, window.innerHeight - chrome - 64);
  }

  // Total height of the dividers area: fixed to the screen up to FIT_LIMIT
  // clients, then proportionally taller beyond that.
  function wrapHeight(n) {
    var base = baseHeight();
    // Phone with a divider open: the stack fits the window whatever the number
    // of clients, so the open divider ends at the bottom of the screen and its
    // content scrolls, not the page.
    if (expanded !== null && isPhone()) return base;
    if (n <= FIT_LIMIT) return base;
    return base + (n - FIT_LIMIT) * (base / FIT_LIMIT);
  }

  // Height the open divider will reach: flexGrow 80 vs 20 shared among the
  // others. Computed rather than measured, because opening is animated.
  function openedHeight(n) {
    var h = wrapHeight(n);
    return n > 1 ? h * 0.8 : h;
  }

  // Sizes the player in pixels so it fills the divider's height while keeping
  // its 16:9 ratio.
  function sizePlayer(content, panel, player, tabsHeight, extraHeight) {
    var cc = getComputedStyle(content);
    var pc = getComputedStyle(panel);
    // Phone: the panel takes the full width and the content scrolls, so height
    // is no longer a constraint. The player is simply as wide as the panel's
    // interior, 16:9.
    if (isPhone()) {
      var wPhone = Math.max(120, panel.clientWidth - parseFloat(pc.paddingLeft) - parseFloat(pc.paddingRight));
      player.style.width = wPhone.toFixed(1) + 'px';
      player.style.height = (wPhone * 9 / 16).toFixed(1) + 'px';
      return;
    }
    var padContent = parseFloat(cc.paddingTop) + parseFloat(cc.paddingBottom);
    var padPanel = parseFloat(pc.paddingTop) + parseFloat(pc.paddingBottom);
    var dispo = openedHeight(clients.length) - padContent - tabsHeight + TABS_OVERLAP;
    var h = Math.max(60, dispo - padPanel - extraHeight);
    var w = h * 16 / 9;
    var maxW = content.clientWidth - parseFloat(cc.paddingLeft) - parseFloat(cc.paddingRight) - padPanel;
    if (w > maxW) { w = Math.max(120, maxW); h = w * 9 / 16; }
    player.style.width = w.toFixed(1) + 'px';
    player.style.height = h.toFixed(1) + 'px';
  }

  // Actual footprint of the label once tilted.
  function roleMetrics(role) {
    var rad = ROLE_ANGLE * Math.PI / 180;
    var cos = Math.cos(rad), sin = Math.sin(rad);
    var w = role.offsetWidth, h = role.offsetHeight;
    return { demiHaut: (h * cos + w * sin) / 2, large: w * cos + h * sin };
  }

  // Height to keep free under the panel so the label's lower half, which
  // overflows the rectangle, isn't clipped.
  function roleReserve(padBas, panel, role) {
    var m = roleMetrics(role);
    var padPanel = parseFloat(getComputedStyle(panel).paddingBottom);
    return Math.max(0, m.demiHaut - padBas - padPanel + 2);
  }

  // Centers the label exactly on the player's bottom edge; only the horizontal
  // position is pulled back into the panel if the text is very long.
  function placeRole(panel, role, leftPct) {
    role.style.bottom = getComputedStyle(panel).paddingBottom;
    var large = roleMetrics(role).large;
    var panelW = panel.getBoundingClientRect().width;
    var margePct = ((large / 2 + 4) / panelW) * 100;
    var pct = margePct * 2 >= 100 ? 50 : Math.min(100 - margePct, Math.max(margePct, leftPct));
    role.style.left = pct.toFixed(1) + '%';
  }

  // Phone: the label sits under the player, in the flow, just tilted. Once
  // rotated it overflows its box top and bottom: that overflow is given as
  // margin so it covers neither the player nor the panel edge.
  function spaceRole(role) {
    var deborde = Math.max(0, roleMetrics(role).demiHaut - role.offsetHeight / 2) + 4;
    role.style.marginTop = deborde.toFixed(1) + 'px';
    role.style.marginBottom = deborde.toFixed(1) + 'px';
  }

  // Phone: the tab row scrolls horizontally; the active tab must be visible
  // (centered when the row allows).
  function revealActiveTab(tabsEl) {
    var act = tabsEl.querySelector('.mini-tab.active');
    if (!act) return;
    tabsEl.scrollLeft = Math.max(0, act.offsetLeft - (tabsEl.clientWidth - act.offsetWidth) / 2);
  }

  // Sizes the open divider's player and role label once the content is in the
  // DOM. No cumulative side effects on phones: it can be called again on every
  // resize without rebuilding the content (and so without restarting the video).
  function fitOpen() {
    if (!opened) return;
    var o = opened;
    var tabsH = o.tabs ? o.tabs.getBoundingClientRect().height : 0;
    var extraH = 0;
    if (o.title) {
      extraH = o.title.getBoundingClientRect().height + parseFloat(getComputedStyle(o.panel).rowGap || 0);
    }
    if (phoneMode) {
      sizePlayer(o.content, o.panel, o.player, tabsH, extraH);
      if (o.role) spaceRole(o.role);
      if (o.tabs) {
        // An overflowing row fades at both ends (dividers-mobile.css). Always
        // measured without the class, whose reduced padding changes the
        // scrollable width: otherwise the state could flip between calls.
        o.tabs.classList.remove('scrolls');
        if (o.tabs.scrollWidth > o.tabs.clientWidth + 1) o.tabs.classList.add('scrolls');
        revealActiveTab(o.tabs);
      }
      return;
    }
    // The strip reserved for the label is removed from the usable area via
    // padding, so vertical centering doesn't overlap it.
    if (o.role) {
      var padBas = parseFloat(getComputedStyle(o.content).paddingBottom);
      var reserve = roleReserve(padBas, o.panel, o.role);
      if (reserve) o.content.style.paddingBottom = (padBas + reserve).toFixed(1) + 'px';
    }
    sizePlayer(o.content, o.panel, o.player, tabsH, extraH);
    if (o.role) placeRole(o.panel, o.role, o.roleGauche);
  }

  function build(content) {
    clients = ((content[page] || {}).clients || []).filter(function (c) { return c.name; });
    wrap.innerHTML = '';
    nodes = [];

    if (!clients.length) {
      var empty = document.createElement('p');
      empty.className = 'about-placeholder';
      empty.setAttribute('data-i18n', 'player.soon');
      empty.textContent = Site.t('player.soon');
      empty.style.cssText = 'position:absolute;top:40%;left:50%;transform:translate(-50%,-50%);';
      wrap.appendChild(empty);
      return;
    }

    var fontNames = [];
    clients.forEach(function (c) {
      fontNames.push(c.font);
      (c.projects || []).forEach(function (p) { if (p.font) fontNames.push(p.font); });
    });
    Site.ensureFonts(fontNames, content);

    clients.forEach(function (client, i) {
      var shape = TAB_SHAPES[i % TAB_SHAPES.length];
      var tex = i % TEXTURES.length;
      var tabLeft = TAB_LEFTS[i % TAB_LEFTS.length];

      var slot = document.createElement('div');
      slot.className = 'divider-slot';

      var sheet = document.createElement('div');
      sheet.className = 'divider-sheet';
      applyBg(sheet, client.bg || '#B4BCAC', tex);

      var tab = document.createElement('div');
      tab.className = 'divider-tab';
      tab.textContent = client.name;
      tab.style.height = shape.h + 'px';
      tab.style.top = -shape.h + 'px';
      tab.style.borderRadius = shape.radius;
      tab.style.color = client.text || '#111';
      tab.style.fontFamily = Site.fontStack(client.font);
      applyBg(tab, client.bg || '#B4BCAC', tex);

      var topTitle = document.createElement('div');
      topTitle.className = 'divider-toptitle';
      topTitle.textContent = client.name;
      topTitle.style.color = client.text || '#111';
      topTitle.style.fontFamily = Site.fontStack(client.font);
      topTitle.style.textAlign = tabLeft < 50 ? 'left' : 'right';
      topTitle.style.padding = tabLeft < 50 ? '2px 14px 0 24px' : '2px 24px 0 14px';

      var clip = document.createElement('div');
      clip.className = 'divider-clip';

      sheet.appendChild(tab);
      sheet.appendChild(topTitle);
      slot.appendChild(sheet);
      slot.appendChild(clip);
      wrap.appendChild(slot);

      sheet.addEventListener('click', function () { toggle(i); });
      sheet.addEventListener('mouseenter', function () { hover(i, true); });
      sheet.addEventListener('mouseleave', function () { hover(i, false); });

      nodes.push({
        slot: slot, sheet: sheet, tab: tab, topTitle: topTitle, clip: clip,
        tex: tex, shape: shape, client: client, hovering: false,
      });
    });

    layout();
  }

  function toggle(i) {
    expanded = expanded === i ? null : i;
    if (expanded !== null && clients[i]) Site.track('yt:' + clients[i].name);
    layout();
    renderContents();
  }

  function hover(i, on) {
    nodes[i].hovering = on;
    if (expanded === null) positionSheet(i);
  }

  // Tabs are spread over the actually available width rather than a fixed
  // percentage: with a pixel width, those on the right went off-screen on
  // phones.
  function positionTab(node, i) {
    var sheetW = node.sheet.getBoundingClientRect().width || window.innerWidth;
    var tabW = Math.min(node.shape.w, Math.max(104, sheetW * 0.44));
    var course = Math.max(0, sheetW - tabW - 24);
    var x = 12 + (TAB_LEFTS[i % TAB_LEFTS.length] / 100) * course;
    node.tab.style.width = tabW + 'px';
    node.tab.style.left = x.toFixed(1) + 'px';
  }

  function positionSheet(i) {
    var node = nodes[i];
    var tilt = TILTS[i % TILTS.length];
    var tilted = tilt !== 0;
    var halfWidth = Math.max(window.innerWidth, 320) / 2;
    var angle = tilted ? Math.atan((16 * tilt) / halfWidth) * (180 / Math.PI) : 0;
    var overshoot = 6 + (tilted ? 26 : 0);
    var bump = (expanded === null && node.hovering) ? 18 : 0;
    node.sheet.style.top = -(overshoot + bump) + 'px';
    node.sheet.style.bottom = -overshoot + 'px';
    node.sheet.style.transform = tilted ? 'rotate(' + angle + 'deg)' : 'none';
  }

  function layout() {
    var n = clients.length;
    var total = wrapHeight(n);
    wrap.style.height = total + 'px';
    // Phone, divider open: the closed ones all move above (order) in a tight
    // stack; the open one takes the rest and ends at the bottom of the window.
    // The closed stack shares at most 12% of the height (22 px per divider max,
    // 8 min — their tabs, taller than the strip, stay visible in a cascade):
    // the open one starts around the top third of the screen and fills the
    // rest. flex-basis 0: pixel flex-grow values are distributed exactly.
    var phone = expanded !== null && isPhone();
    var closedPx = 0;
    if (phone && n > 1) closedPx = Math.max(8, Math.min(22, total * 0.12 / (n - 1)));
    nodes.forEach(function (node, i) {
      var isOpen = expanded === i;
      var grow;
      if (expanded === null) grow = WEIGHTS[i % WEIGHTS.length];
      else if (isOpen) grow = phone ? total - (n - 1) * closedPx : 80;
      else grow = phone ? closedPx : (n > 1 ? 20 / (n - 1) : 1);
      node.slot.style.flexGrow = grow;
      node.slot.style.order = phone ? (isOpen ? 1 : 0) : '';
      node.slot.style.zIndex = isOpen ? n + 10 : i + 1;
      node.sheet.style.boxShadow = isOpen
        ? '0 24px 48px rgba(0,0,0,0.28), inset 0 -6px 0 #ffffff'
        : '0 6px 12px rgba(0,0,0,0.16), inset 0 -5px 0 #ffffff';
      node.topTitle.style.display = expanded !== null && !isOpen ? 'none' : 'block';
      positionTab(node, i);
      positionSheet(i);
    });
  }

  function renderContents() {
    phoneMode = isPhone();
    opened = null;
    nodes.forEach(function (node, i) {
      node.clip.innerHTML = '';
      if (expanded !== i) return;

      var client = node.client;
      var projects = (client.projects || []).filter(function (p) { return p.title || p.url || p.role; });
      if (!projects.length) projects = [{ title: '', url: '', role: '' }];
      if (selectedProject[i] == null || selectedProject[i] >= projects.length) selectedProject[i] = 0;
      var sel = selectedProject[i];
      var proj = projects[sel];

      var clientBg = client.bg || '#B4BCAC';
      var clientText = client.text || '#111';
      // The panel reuses the divider's material, 10% darker.
      var panelBg = darken(proj.bg || clientBg, 0.1);
      var panelText = proj.text || clientText;

      var content = document.createElement('div');
      content.className = 'divider-content';
      // Clicking the open divider's background closes it, like a click on its
      // tab. The panel and tabs swallow their own clicks.
      content.addEventListener('click', function (e) {
        if (e.target === content) toggle(i);
      });

      // Close cross, top-right of the open divider: clicking the background or
      // the tab already closes it, but nothing signalled that. Same material
      // as the panel (client color 10% darker, texture): it stands out from
      // the divider background, where the white edge and shadow alone weren't
      // enough, while staying in the client's palette. The cross itself uses
      // the text color, like the tabs. Client colors, not project colors: it
      // closes the whole divider.
      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'divider-close';
      closeBtn.textContent = '✕';
      closeBtn.setAttribute('data-i18n-label', 'divider.close');
      closeBtn.title = Site.t('divider.close');
      closeBtn.setAttribute('aria-label', Site.t('divider.close'));
      applyBg(closeBtn, darken(clientBg, 0.1), node.tex);
      closeBtn.style.color = clientText;
      closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggle(i);
      });
      content.appendChild(closeBtn);

      // Project tabs: same shape as the parent divider's tab, fused to the
      // panel and therefore the same color.
      if (projects.length > 1) {
        var tabsRow = document.createElement('div');
        tabsRow.className = 'mini-tabs';
        projects.forEach(function (p, j) {
          var mt = document.createElement('button');
          mt.type = 'button';
          mt.className = 'mini-tab' + (j === sel ? ' active' : '');
          mt.textContent = Site.tr(p, 'title') || 'Project ' + (j + 1);
          // Same shade as the panel: the tabs are visually part of it. Relief,
          // not color, marks the active tab.
          var mtBg = darken(p.bg || clientBg, 0.1);
          applyBg(mt, mtBg, node.tex);
          mt.style.color = p.text || clientText;
          mt.style.fontFamily = Site.fontStack(p.font || client.font);
          mt.style.borderRadius = node.shape.radius;
          mt.addEventListener('click', function (e) {
            e.stopPropagation();
            selectedProject[i] = j;
            renderContents();
          });
          tabsRow.appendChild(mt);
        });
        content.appendChild(tabsRow);
      }

      var panel = document.createElement('div');
      panel.className = 'player-panel';
      applyBg(panel, panelBg, node.tex);
      panel.addEventListener('click', function (e) { e.stopPropagation(); });

      if (projects.length === 1 && (proj.title || proj.title_en)) {
        var single = document.createElement('p');
        single.className = 'mini-title';
        single.textContent = Site.tr(proj, 'title');
        single.style.color = panelText;
        single.style.fontFamily = Site.fontStack(proj.font || client.font);
        panel.appendChild(single);
      }

      var player = document.createElement('div');
      player.className = 'divider-player';
      player.appendChild(Site.playerNode(proj.url));
      panel.appendChild(player);

      var roleEl = null;
      var roleGauche = 50;
      if (proj.role || proj.role_en) {
        roleEl = document.createElement('p');
        roleEl.className = 'player-role';
        roleEl.textContent = Site.tr(proj, 'role');
        // Hidden when the translated role is empty.
        roleEl.style.display = Site.tr(proj, 'role') ? '' : 'none';
        // Divider colors (not the panel's darkened ones).
        applyBg(roleEl, proj.bg || clientBg, node.tex);
        roleEl.style.color = proj.text || clientText;
        roleEl.style.fontFamily = Site.fontStack(proj.font || client.font);
        // Constant tilt; only direction and horizontal position vary, random
        // but stable for a given project.
        var sens = Site.seeded(i * 53 + sel * 29 + 11) > 0.5 ? 1 : -1;
        roleGauche = 26 + Site.seeded(i * 97 + sel * 17 + 3) * 48; // 26 % .. 74 %
        // On phones it's in the flow, under the player: no offset.
        roleEl.style.transform = (phoneMode ? '' : 'translate(-50%, 50%) ') + 'rotate(' + (sens * ROLE_ANGLE) + 'deg)';
        panel.appendChild(roleEl);
      }

      content.appendChild(panel);

      var desc = null;
      if (client.desc || client.desc_en) {
        desc = document.createElement('p');
        desc.className = 'divider-desc';
        desc.textContent = Site.tr(client, 'desc');
        desc.style.display = Site.tr(client, 'desc') ? '' : 'none';
        desc.style.color = clientText;
        desc.style.marginTop = '12px';
        content.appendChild(desc);
      }

      node.clip.appendChild(content);

      // Once in the DOM, measure what precedes the player to give it all the
      // remaining height (desktop) or the full width (phone).
      opened = {
        content: content, panel: panel, player: player, role: roleEl, roleGauche: roleGauche,
        tabs: content.querySelector('.mini-tabs'), title: panel.querySelector('.mini-title'),
        desc: desc, client: client, projects: projects, proj: proj,
      };
      fitOpen();
    });
  }

  // Language change: the open divider's texts (tabs, title, role label,
  // description) are replaced in place without rebuilding the content — the
  // video keeps playing. The label's reserved padding is reset before
  // re-measuring (fitOpen adds it back).
  function retranslate() {
    if (!opened) return;
    var o = opened;
    if (o.tabs) {
      for (var k = 0; k < o.tabs.children.length && k < o.projects.length; k++) {
        o.tabs.children[k].textContent = Site.tr(o.projects[k], 'title') || 'Project ' + (k + 1);
      }
    }
    if (o.title) o.title.textContent = Site.tr(o.proj, 'title');
    if (o.role) {
      var role = Site.tr(o.proj, 'role');
      o.role.textContent = role;
      o.role.style.display = role ? '' : 'none';
    }
    if (o.desc) {
      var d = Site.tr(o.client, 'desc');
      o.desc.textContent = d;
      o.desc.style.display = d ? '' : 'none';
    }
    o.content.style.paddingBottom = '';
    fitOpen();
  }
  document.addEventListener('cc:lang', retranslate);

  window.addEventListener('resize', function () {
    if (!nodes.length) return;
    layout();
    if (expanded === null) return;
    // The player is sized in pixels, so it must be recomputed. On phones just
    // re-measure it (the address bar showing/hiding resizes the window:
    // rebuilding would restart the video); rebuild only when the mode changes.
    if (phoneMode && isPhone()) fitOpen();
    else renderContents();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && expanded !== null) toggle(expanded);
  });

  window.addEventListener('DOMContentLoaded', function () {
    Site.mountChrome();
    Site.loadContent().then(function (content) {
      build(content);
      var params = new URLSearchParams(location.search);
      if (params.has('open')) {
        var idx = parseInt(params.get('open'), 10);
        if (!isNaN(idx) && idx >= 0 && idx < clients.length) toggle(idx);
      }
    });
  });
})();
