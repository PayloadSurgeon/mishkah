/* Mishkah — theme guide. No dependencies, no tracking, no cookies.
   Each feature is isolated so one failure never stops the others. */
(function () {
  'use strict';

  var root = document.documentElement;
  var isArabic = (root.getAttribute('lang') || '').toLowerCase().indexOf('ar') === 0;
  var STORE_KEY = 'mishkah-guide-theme';
  var DESKTOP = window.matchMedia ? window.matchMedia('(min-width: 1100px)') : null;

  function toArabicDigits(value) {
    return String(value).replace(/[0-9]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.charAt(+d); });
  }
  function num(value) { return isArabic ? toArabicDigits(value) : String(value); }

  function safe(fn) {
    try { fn(); } catch (err) { if (window.console && console.warn) { console.warn('[guide]', err); } }
  }

  /* ---- Theme toggle -------------------------------------------------- */
  safe(function () {
    var btn = document.querySelector('.theme-toggle');
    if (!btn) { return; }
    var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    function current() {
      var set = root.getAttribute('data-theme');
      if (set === 'dark' || set === 'light') { return set; }
      return media && media.matches ? 'dark' : 'light';
    }
    function sync() { btn.setAttribute('aria-pressed', current() === 'dark' ? 'true' : 'false'); }

    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { window.localStorage.setItem(STORE_KEY, next); } catch (e) { /* storage unavailable: keep for this visit */ }
      sync();
    });
    if (media) {
      var onChange = function () { sync(); };
      if (media.addEventListener) { media.addEventListener('change', onChange); }
      else if (media.addListener) { media.addListener(onChange); }
    }
    sync();
  });

  /* ---- Contents panel on small screens ------------------------------- */
  safe(function () {
    var toggle = document.querySelector('.toc-toggle');
    var toc = document.getElementById('toc');
    if (!toggle || !toc) { return; }
    var closeBtn = toc.querySelector('.toc__close');

    function isOpen() { return toc.classList.contains('is-open'); }
    function setOpen(open, returnFocus) {
      toc.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        var first = toc.querySelector('a[aria-current="true"]') || toc.querySelector('a');
        if (first) { first.focus({ preventScroll: true }); }
      } else if (returnFocus) {
        toggle.focus({ preventScroll: true });
      }
    }

    toggle.addEventListener('click', function () { setOpen(!isOpen(), false); });
    if (closeBtn) { closeBtn.addEventListener('click', function () { setOpen(false, true); }); }

    toc.addEventListener('click', function (event) {
      var link = event.target.closest ? event.target.closest('a[href^="#"]') : null;
      if (link && isOpen()) { setOpen(false, false); }
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen()) { setOpen(false, true); }
    });
    document.addEventListener('click', function (event) {
      if (!isOpen()) { return; }
      if (toc.contains(event.target) || toggle.contains(event.target)) { return; }
      setOpen(false, false);
    });
    if (DESKTOP) {
      var onWide = function () { if (DESKTOP.matches && isOpen()) { setOpen(false, false); } };
      if (DESKTOP.addEventListener) { DESKTOP.addEventListener('change', onWide); }
      else if (DESKTOP.addListener) { DESKTOP.addListener(onWide); }
    }
  });

  /* ---- Scroll-spy: mark the chapter or group being read ---------------- */
  safe(function () {
    var toc = document.getElementById('toc');
    if (!toc) { return; }
    var links = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
    var targets = [];
    links.forEach(function (link) {
      var id = decodeURIComponent(link.getAttribute('href').slice(1));
      var el = document.getElementById(id);
      if (el) { targets.push({ el: el, link: link }); }
    });
    if (!targets.length) { return; }
    var active = null;
    var ticking = false;

    function update() {
      ticking = false;
      var line = window.innerHeight * 0.28;
      var current = null;
      for (var i = 0; i < targets.length; i++) {
        var rect = targets[i].el.getBoundingClientRect();
        if (rect.height === 0 && rect.width === 0) { continue; }
        if (rect.top <= line) { current = targets[i]; }
      }
      /* A group link also lights its chapter. */
      if (current === active) { return; }
      links.forEach(function (l) { l.removeAttribute('aria-current'); });
      if (current) {
        current.link.setAttribute('aria-current', 'true');
        var parentItem = current.link.parentElement && current.link.parentElement.parentElement;
        if (parentItem && parentItem.classList.contains('toc__sub')) {
          var chapterLink = parentItem.parentElement.querySelector(':scope > a');
          if (chapterLink) { chapterLink.setAttribute('aria-current', 'true'); }
        }
      }
      active = current;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', function () { active = null; update(); });
    update();
  });

  /* ---- Filter the homepage sections by name ----------------------------- */
  safe(function () {
    var input = document.getElementById('sec-filter');
    var onlyDefaults = document.getElementById('sec-defaults');
    var status = document.getElementById('sec-status');
    var empty = document.getElementById('sec-empty');
    var container = document.getElementById('sections');
    if (!input || !status || !container) { return; }

    function normalise(text) {
      return String(text || '')
        .toLowerCase()
        .replace(/[ً-ٰٟـ]/g, '')   /* harakat, dagger alif, tatweel */
        .replace(/[آأإٱ]/g, 'ا') /* alif forms */
        .replace(/ى/g, 'ي')                    /* alif maqsura -> ya */
        .replace(/ة/g, 'ه')                    /* ta marbuta -> ha */
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
        .replace(/[&\/\\\-_.,،«»"'()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    var cards = Array.prototype.slice.call(container.querySelectorAll('.sec'));
    var groups = Array.prototype.slice.call(container.querySelectorAll('.group'));
    var total = cards.length;
    var template = status.getAttribute('data-template') || '{n} / {t}';
    cards.forEach(function (card) {
      var names = (card.getAttribute('data-names') || '').split('|');
      card._names = names.map(normalise);
      /* Also match an Arabic name without its definite article. */
      card._names = card._names.concat(card._names.map(function (n) { return n.replace(/(^| )ال/g, '$1'); }));
    });

    function apply() {
      var query = normalise(input.value);
      var bare = query.replace(/(^| )ال/g, '$1');
      var defaultsOnly = onlyDefaults && onlyDefaults.checked;
      var shown = 0;
      cards.forEach(function (card) {
        var matches = !query || card._names.some(function (n) {
          return n.indexOf(query) !== -1 || (bare && n.indexOf(bare) !== -1);
        });
        if (defaultsOnly && card.getAttribute('data-default') !== '1') { matches = false; }
        card.hidden = !matches;
        if (matches) { shown++; }
      });
      groups.forEach(function (group) {
        group.hidden = !group.querySelector('.sec:not([hidden])');
      });
      container.classList.toggle('is-filtering', Boolean(query) || Boolean(defaultsOnly));
      status.textContent = template.replace('{n}', num(shown)).replace('{t}', num(total));
      if (empty) { empty.hidden = shown !== 0; }
    }

    input.addEventListener('input', apply);
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && input.value) { input.value = ''; apply(); }
    });
    if (onlyDefaults) { onlyDefaults.addEventListener('change', apply); }
    apply();
  });
})();
