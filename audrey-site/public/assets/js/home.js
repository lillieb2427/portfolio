/* Home: orchestrated entrance, then a synchronized loop
   title letters -> exclamation mark -> stars -> pause -> repeat. */
(function () {
  'use strict';

  // Entrance (must match the durations declared in site.css)
  var IN = {
    letterStep: 0.045, letterDur: 0.65,
    exclaAt: 1.15, exclaDur: 0.6,
    scriptAt: 1.6, scriptDur: 0.8,
    starsAt: 2.3, starStep: 0.09, starDur: 0.55,
    chromeAt: 2.95, chromeDur: 0.7,
  };
  // Loop: offsets within one cycle (--loop = 3.6s)
  var LOOP = { letterStep: 0.05, exclaGap: 0.16, starsAt: 1.35, starStep: 0.13 };

  // Letters are grouped by word: on phones each word wraps to its own line,
  // and the exclamation mark stays attached to the last word (the R of "FOR").
  function splitLetters() {
    var lines = document.querySelectorAll('.home-title .line');
    var letters = [];
    var dernierMot = null;
    for (var i = 0; i < lines.length; i++) {
      var mots = (lines[i].getAttribute('data-text') || '').split(' ');
      var frag = document.createDocumentFragment();
      for (var m = 0; m < mots.length; m++) {
        if (m > 0) {
          var espace = document.createElement('span');
          espace.className = 'letter space';
          // Non-breaking space: an inline-block span doesn't keep a plain space.
          espace.textContent = '\u00a0';
          frag.appendChild(espace);
          letters.push(espace);
        }
        var mot = document.createElement('span');
        mot.className = 'word';
        for (var c = 0; c < mots[m].length; c++) {
          var span = document.createElement('span');
          span.className = 'letter';
          span.textContent = mots[m][c];
          mot.appendChild(span);
          letters.push(span);
        }
        frag.appendChild(mot);
        dernierMot = mot;
      }
      lines[i].appendChild(frag);
    }
    // The exclamation mark follows the last word to stay aligned with the bottom of the R.
    var excla = document.querySelector('.home-title .excla');
    if (excla && dernierMot) dernierMot.appendChild(excla);
    return letters;
  }

  function setDelays(letters, stars, phase) {
    var i;
    if (phase === 'in') {
      for (i = 0; i < letters.length; i++) {
        letters[i].style.animationDelay = (i * IN.letterStep).toFixed(3) + 's';
      }
      var excla = document.querySelector('.home-title .excla');
      if (excla) excla.style.animationDelay = IN.exclaAt + 's';
      var script = document.querySelector('.home-script');
      if (script) script.style.animationDelay = IN.scriptAt + 's';
      for (i = 0; i < stars.length; i++) {
        stars[i].style.animationDelay = (IN.starsAt + i * IN.starStep).toFixed(3) + 's';
      }
      var header = document.querySelector('.site-header');
      var controls = document.querySelector('.site-controls');
      if (header) header.style.animationDelay = IN.chromeAt + 's';
      if (controls) controls.style.animationDelay = (IN.chromeAt + 0.08) + 's';
      return IN.chromeAt + IN.chromeDur + 0.1;
    }
    // phase === 'loop'
    for (i = 0; i < letters.length; i++) {
      letters[i].style.animationDelay = (i * LOOP.letterStep).toFixed(3) + 's';
    }
    var e = document.querySelector('.home-title .excla');
    if (e) e.style.animationDelay = (letters.length * LOOP.letterStep + LOOP.exclaGap).toFixed(3) + 's';
    for (i = 0; i < stars.length; i++) {
      stars[i].style.animationDelay = (LOOP.starsAt + i * LOOP.starStep).toFixed(3) + 's';
    }
    // Neither the header nor the script logo takes part in the loop.
    ['.site-header', '.site-controls', '.home-script'].forEach(function (sel) {
      var n = document.querySelector(sel);
      if (n) n.style.animationDelay = '';
    });
    return 0;
  }

  window.addEventListener('DOMContentLoaded', function () {
    Site.mountChrome();

    var root = document.documentElement;
    var letters = splitLetters();
    var stars = document.querySelectorAll('.home-star');

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      root.classList.remove('intro');
      return;
    }

    var total = setDelays(letters, stars, 'in');
    // Wait one frame so the initial styles are applied.
    requestAnimationFrame(function () {
      root.classList.add('playing');
      setTimeout(function () {
        setDelays(letters, stars, 'loop');
        root.classList.remove('intro');
        root.classList.remove('playing');
        root.classList.add('loaded');
      }, total * 1000);
    });
  });
})();
