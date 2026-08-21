/* ============================================================
   Canal Tours Amsterdam — cinematic 4D parallax engine
   - Loader (deterministic setTimeout, NOT gsap)
   - Locomotive Scroll (smooth + data-scroll-speed multi-layer parallax)
   - GSAP scrubbed timeline: hero crossfade + content lift
   - 4D mouse parallax (pointer + lerp) on hero layers
   - Fixed site background: slow rotation + scale on scroll
   - SplitType char-level reveals (IntersectionObserver — robust, no ScrollTrigger)
   ============================================================ */
(function () {
  'use strict';

  var docEl = document.documentElement;
  var loader = document.getElementById('loader');
  var loaderBar = document.getElementById('loaderBar');
  var nav = document.getElementById('nav');
  var burger = document.getElementById('burger');
  var menu = document.getElementById('menu');

  /* ---------- 1. LOADER ---------- */
  if (loader && loaderBar) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        loaderBar.style.width = '100%';
      });
    });
    setTimeout(function () { loader.classList.add('is-done'); }, 1250);
    setTimeout(function () { if (loader.parentNode) loader.parentNode.removeChild(loader); }, 2400);
  }

  /* ---------- 2. SPLIT-TYPE (char-level reveals) ---------- */
  var splitEls = [];
  var hasSplit = typeof SplitType !== 'undefined';
  document.querySelectorAll('[data-split]').forEach(function (el) {
    if (hasSplit) {
      var st = new SplitType(el, { types: 'chars', charClass: 'char' });
      if (st.chars) {
        st.chars.forEach(function (c, i) {
          c.style.transitionDelay = (i * 0.018) + 's';
        });
      }
    }
    splitEls.push(el);
  });

  /* ---------- 3. HERO CROSSFADE TIMELINE (scrubbed) ---------- */
  var scenes = Array.prototype.slice.call(document.querySelectorAll('.hero__scene'));
  var heroContent = document.getElementById('heroContent');
  var heroCounter = document.getElementById('heroCounter');

  var crossfade = (typeof gsap !== 'undefined' && scenes.length > 1)
    ? gsap.timeline({ paused: true })
    : null;

  var crossfadeLength = 3; // default (4 scenes -> 3 transitions)

  if (crossfade) {
    var d = 1;
    var n = scenes.length;
    crossfadeLength = n - 1;
    for (var i = 0; i < n - 1; i++) {
      crossfade
        .to(scenes[i], { opacity: 0, scale: 1.05, duration: d, ease: 'none' }, i)
        .fromTo(scenes[i + 1], { opacity: 0, scale: 1 }, { opacity: 1, scale: 1.04, duration: d, ease: 'none' }, i);
    }
    // content lifts + fades as hero scrolls away (children carry their own 4D transforms)
    crossfade.to(heroContent, {
      yPercent: -24, opacity: 0, duration: d * 1.4, ease: 'power2.in'
    }, 0.1);
  }

  function updateCrossfade(scrollY) {
    if (!crossfade) return;
    var range = Math.max(window.innerHeight * 1.35, 800);
    var p = Math.min(Math.max(scrollY / range, 0), 1);
    crossfade.progress(p);
    if (heroCounter) {
      var total = scenes.length;
      var idx = Math.min(Math.floor(p * crossfadeLength) + 1, total);
      heroCounter.innerHTML = (idx < 10 ? '0' + idx : idx) + '&nbsp;/&nbsp;' + (total < 10 ? '0' + total : total);
    }
  }

  /* ---------- 3b. SITE BACKGROUND rotation on scroll ---------- */
  var siteBg = document.querySelector('.site-bg');
  var bgTarget = 0;   // rotation target in degrees (0..3.5)
  var bgCur = 0;      // lerped

  function currentScrollY() {
    var locoY = 0;
    try {
      if (locoScroll && locoScroll.scroll && locoScroll.scroll.instance) {
        locoY = locoScroll.scroll.instance.scroll.y || 0;
      }
    } catch (e) {}
    var winY = window.scrollY || window.pageYOffset || 0;
    return Math.max(locoY, winY);
  }

  function updateSiteBg(scrollY) {
    if (!siteBg) return;
    var max = Math.max(document.body.scrollHeight - window.innerHeight, 1);
    var p = Math.min(Math.max(scrollY / max, 0), 1);
    bgTarget = p * 3.5; // rotate up to 3.5deg over full page
  }

  /* ---------- 3c. BACKGROUND CROSSFADE (fade site-bg between product photos) ---------- */
  var bgDefault = null;
  var bgProducts = [];

  function setupBgCrossfade() {
    if (!siteBg) return;
    bgDefault = siteBg.querySelector('.site-bg__layer.is-active') || siteBg.querySelector('.site-bg__layer');
    var cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
    cards.forEach(function (card) {
      var img = card.querySelector('.card__media img');
      if (!img || !img.getAttribute('src')) return;
      var layer = document.createElement('div');
      layer.className = 'site-bg__layer';
      layer.style.backgroundImage = 'url(' + img.getAttribute('src') + ')';
      siteBg.appendChild(layer);
      bgProducts.push({ card: card, layer: layer });
    });
  }

  function updateBgCrossfade() {
    if (!bgProducts.length) return;
    var vh = window.innerHeight || 1;
    var active = bgDefault;
    var best = vh * 0.45;
    bgProducts.forEach(function (entry) {
      var rect = entry.card.getBoundingClientRect();
      var cy = rect.top + rect.height / 2;
      var dist = Math.abs(cy - vh / 2);
      if (dist < best) {
        best = dist;
        active = entry.layer;
      }
    });
    var layers = [bgDefault];
    bgProducts.forEach(function (e) { layers.push(e.layer); });
    layers.forEach(function (l) {
      if (l) l.classList.toggle('is-active', l === active);
    });
  }

  /* ---------- 4. 4D MOUSE PARALLAX ---------- */
  var mx = 0, my = 0;        // target (-1..1)
  var cx = 0, cy = 0;        // current (lerped)
  var depthEls = Array.prototype.slice.call(document.querySelectorAll('[data-4d]'));
  var stage = document.getElementById('heroStage');

  if (window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', function (e) {
      mx = (e.clientX / window.innerWidth) * 2 - 1;
      my = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  function render4D() {
    cx += (mx - cx) * 0.06;
    cy += (my - cy) * 0.06;
    if (stage) {
      stage.style.transform = 'translate3d(' + (cx * -14) + 'px,' + (cy * -10) + 'px,0) scale(1.06)';
    }
    depthEls.forEach(function (el) {
      var depth = parseFloat(el.getAttribute('data-4d')) || 10;
      el.style.transform = 'translate3d(' + (cx * depth) + 'px,' + (cy * depth * 0.7) + 'px,0)';
    });
    // background rotation lerp — read live scroll each frame so it works
    // regardless of how scrolling happened (wheel, programmatic, anchor jump)
    if (siteBg) {
      updateSiteBg(currentScrollY());
      bgCur += (bgTarget - bgCur) * 0.05;
      siteBg.style.transform = 'rotate(' + bgCur.toFixed(3) + 'deg) scale(1.12)';
    }
    requestAnimationFrame(render4D);
  }
  if (depthEls.length || stage || siteBg) requestAnimationFrame(render4D);

  /* ---------- 5. LOCOMOTIVE SCROLL ---------- */
  var hasLoco = typeof LocomotiveScroll !== 'undefined';
  var locoScroll = null;

  if (hasLoco) {
    locoScroll = new LocomotiveScroll({
      el: document.querySelector('[data-scroll-container]'),
      smooth: true,
      multiplier: 0.9,
      lerp: 0.09,
      getDirection: true,
      smartphone: { smooth: true },
      tablet: { smooth: true }
    });

    locoScroll.on('scroll', function (args) {
      updateCrossfade(args.scroll.y);
      updateSiteBg(args.scroll.y);
      updateBgCrossfade();
      if (nav) nav.classList.toggle('is-solid', args.scroll.y > 40);
    });

    // anchor scrolling (same-page only)
    document.querySelectorAll('[data-scroll-to]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (!id || id.charAt(0) !== '#') return;
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        locoScroll.scrollTo(target, { offset: 0, duration: 1200 });
      });
    });
  } else {
    // graceful fallback: native scroll + manual crossfade/parallax
    window.addEventListener('scroll', function () {
      var y = window.scrollY || window.pageYOffset;
      updateCrossfade(y);
      updateSiteBg(y);
      updateBgCrossfade();
      if (nav) nav.classList.toggle('is-solid', y > 40);
    }, { passive: true });
  }

  /* ---------- 6. MOBILE MENU ---------- */
  if (burger && menu) {
    burger.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      burger.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        menu.classList.remove('open');
        burger.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  /* ---------- 7. REVEALS (IntersectionObserver — robust) ---------- */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-inview');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' }) : null;

  function observeReveals() {
    document.querySelectorAll('.reveal').forEach(function (el) {
      if (io) io.observe(el); else el.classList.add('is-inview');
    });
    document.querySelectorAll('[data-split]').forEach(function (el) {
      // hero title is timed to the loader, not the viewport
      if (el.closest('.hero__title')) return;
      if (io) io.observe(el); else el.classList.add('is-inview');
    });
  }

  /* ---------- 8. BOOT ---------- */
  function boot() {
    observeReveals();
    setupBgCrossfade();
    updateBgCrossfade();

    // hero title reveals as the loader lifts
    setTimeout(function () {
      document.querySelectorAll('.hero__title [data-split]').forEach(function (el) {
        el.classList.add('is-inview');
      });
    }, 1300);

    // prime background rotation target
    if (hasLoco) {
      setTimeout(function () { updateSiteBg(locoScroll.scroll && locoScroll.scroll.instance ? locoScroll.scroll.instance.scroll.y : 0); }, 100);
    } else {
      updateSiteBg(window.scrollY || 0);
    }

    docEl.style.removeProperty('scroll-behavior');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // refresh Locomotive after fonts/images settle (layout heights change)
  if (hasLoco) {
    window.addEventListener('load', function () { locoScroll.update(); });
  }
})();
