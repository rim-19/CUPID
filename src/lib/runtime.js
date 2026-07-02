/* Cupid - coffee house & bookshop. Interaction layer (ported to an ES module).
   Drives theme, scroll effects, particles, IntersectionObserver reveals and
   counters, the quiz (with real recommendations), the blind-date unwrap, the
   mood matcher, a cart + wishlist drawer, a search palette, magnetic CTAs, tilt
   and the load veil. Exposed as initApp()/destroyApp(); reads #app from the DOM. */
import { store } from './store';
import { searchCatalog, genres, catalog } from './catalog';
import { recommend } from './recommend';

var Store = store;

var App = {
    props: { palette: 'Rose', ambiance: 'Drifting hearts', motion: 10 },
    root: null,
    _cleanup: [],
    _activeStep: -1,
    _raf: null,
    _motion: 1,
    _lastFocus: null,

    // mood -> 4 book covers (titles kept from the original shelf)
    _moodSets: [
      [ {title:'The Lantern Orchard',author:'M. Ashgrove',tint:'linear-gradient(160deg,#5a3a28,#2e1d13)'}, {title:'Tea for the Wandering',author:'R. Pellow',tint:'linear-gradient(160deg,#5a4a30,#2e2618)'}, {title:'A Year of Small Rains',author:'I. Voss',tint:'linear-gradient(160deg,#7a4332,#3a201a)'}, {title:'Sugar & Smoke',author:'D. Fenwick',tint:'linear-gradient(160deg,#4a3526,#251a12)'} ],
      [ {title:'The Quiet Between Stars',author:'N. Calder',tint:'linear-gradient(160deg,#5e3550,#301a2c)'}, {title:'Salt House',author:'E. Marsh',tint:'linear-gradient(160deg,#6e4348,#352025)'}, {title:'Ten Doors Down',author:'O. Hale',tint:'linear-gradient(160deg,#5a3030,#2e1a1a)'}, {title:'The Midnight Ledger',author:'P. Crowe',tint:'linear-gradient(160deg,#6a4a2e,#33241a)'} ],
      [ {title:'On Slowness',author:'T. Bergman',tint:'linear-gradient(160deg,#5a3a28,#2e1d13)'}, {title:'The Listening Field',author:'A. Brun',tint:'linear-gradient(160deg,#6a4a2e,#33241a)'}, {title:'Letters to No One',author:'S. Ode',tint:'linear-gradient(160deg,#7a4332,#3a201a)'}, {title:'A Map of Quiet',author:'H. Loom',tint:'linear-gradient(160deg,#7a3a4e,#3a1d28)'} ],
      [ {title:'The Teacup Dragon',author:'B. Pim',tint:'linear-gradient(160deg,#6a4a2e,#392818)'}, {title:'Mushroom Post',author:'C. Wren',tint:'linear-gradient(160deg,#6e4348,#352025)'}, {title:'The Button Thief',author:'L. Mott',tint:'linear-gradient(160deg,#5a3340,#33212a)'}, {title:'Hats for Hedgehogs',author:'F. Quill',tint:'linear-gradient(160deg,#6a5a30,#39301a)'} ],
      [ {title:'The Long Goodbye Garden',author:'V. Holt',tint:'linear-gradient(160deg,#5e3550,#301a2c)'}, {title:'Ash & Almond',author:'G. Sorel',tint:'linear-gradient(160deg,#4a3a3a,#2a2020)'}, {title:'November Light',author:'K. Reyes',tint:'linear-gradient(160deg,#5a3340,#33212a)'}, {title:'What the Tide Took',author:'J. Frost',tint:'linear-gradient(160deg,#7a4332,#3a201a)'} ],
      [ {title:'Seeds for Spring',author:'M. Dell',tint:'linear-gradient(160deg,#5a4030,#33241c)'}, {title:'The Mending Shop',author:'A. Pyne',tint:'linear-gradient(160deg,#6a4a2e,#33241a)'}, {title:'Small Brave Things',author:'R. Ives',tint:'linear-gradient(160deg,#6a4452,#3a2630)'}, {title:'Begin Again, Gently',author:'T. Oak',tint:'linear-gradient(160deg,#5a4a30,#332a1c)'} ]
    ],

    q: function (sel) { return this.root ? Array.prototype.slice.call(this.root.querySelectorAll(sel)) : []; },
    one: function (sel) { return this.root ? this.root.querySelector(sel) : null; },

    init: function () {
      this.root = document.getElementById('app');
      if (!this.root) return;
      this._cleanup = [];
      this._activeStep = -1;
      try { this.initA11y(); } catch (e) {}
      try { this.initTheme(); } catch (e) {}
      try { this.initReveals(); } catch (e) {}
      try { this.initScroll(); } catch (e) {}
      try { this.initInteractions(); } catch (e) {}
      try { this.initTilt(); } catch (e) {}
      try { this.initMagnetic(); } catch (e) {}
      try { this.initSpotlight(); } catch (e) {}
      try { this.buildDrawer(); } catch (e) {}
      try { this.buildSearch(); } catch (e) {}
      try { this.syncStore(); } catch (e) {}
      try { this.initVeil(); } catch (e) {}
      // Non-critical, visual-only work runs after first paint so it never
      // blocks the initial render (faster perceived load).
      var self = this;
      var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 1); };
      this._idle = idle(function () {
        try { self.applyTweaks(); } catch (e) {}
        try { self.initCounters(); } catch (e) {}
      });
    },

    /* ---------- ACCESSIBILITY ---------- */
    initA11y: function () {
      // polite live region for dynamic announcements (cart, wishlist, quiz, mood)
      var live = document.createElement('div');
      live.setAttribute('aria-live', 'polite');
      live.setAttribute('aria-atomic', 'true');
      live.className = 'sr-only';
      live.setAttribute('data-live', '');
      document.body.appendChild(live);
      this._live = live;
      this._cleanup.push(function () { if (live.parentNode) live.parentNode.removeChild(live); });
    },
    announce: function (msg) { if (this._live) this._live.textContent = msg; },
    // Focus trap for modal surfaces; returns a teardown fn and remembers focus.
    trapFocus: function (container, onEscape) {
      var self = this;
      this._lastFocus = document.activeElement;
      var sel = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
      var getF = function () { return Array.prototype.slice.call(container.querySelectorAll(sel)).filter(function (el) { return el.offsetParent !== null || el === document.activeElement; }); };
      var first = getF()[0];
      if (first) setTimeout(function () { try { first.focus(); } catch (e) {} }, 30);
      var onKey = function (e) {
        if (e.key === 'Escape') { if (onEscape) onEscape(); return; }
        if (e.key !== 'Tab') return;
        var f = getF(); if (!f.length) return;
        var a = f[0], b = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); }
        else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
      };
      document.addEventListener('keydown', onKey);
      return function () {
        document.removeEventListener('keydown', onKey);
        var lf = self._lastFocus; if (lf && lf.focus) setTimeout(function () { try { lf.focus(); } catch (e) {} }, 10);
      };
    },

    /* ---------- THEME ---------- */
    initTheme: function () {
      var saved = null;
      try { saved = localStorage.getItem('cupid-theme'); } catch (e) {}
      if (saved === 'light' || saved === 'dark') this.setTheme(saved, false);
    },
    _icoMoon: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M20.2 14.4A8.2 8.2 0 1 1 9.6 3.8a6.4 6.4 0 0 0 10.6 10.6z"/></svg>',
    _icoSun: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="display:block"><circle cx="12" cy="12" r="3.9"/><path d="M12 2.6v2.3M12 19.1v2.3M21.4 12h-2.3M5 12H2.6M18.65 5.35l-1.6 1.6M6.95 17.05l-1.6 1.6M18.65 18.65l-1.6-1.6M6.95 6.95l-1.6-1.6"/></svg>',
    setTheme: function (mode, persist) {
      if (!this.root) return;
      this.root.setAttribute('data-theme', mode);
      var btn = this.one('[data-action="theme"]');
      if (btn) btn.innerHTML = mode === 'light' ? this._icoSun : this._icoMoon;
      if (persist !== false) { try { localStorage.setItem('cupid-theme', mode); } catch (e) {} }
    },
    toggleTheme: function () {
      var self = this;
      var cur = this.root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      var swap = function () { self.setTheme(cur === 'light' ? 'dark' : 'light', true); };
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (document.startViewTransition && !reduce) document.startViewTransition(swap);
      else swap();
    },

    /* ---------- TWEAKS (ambiance / motion) ---------- */
    applyTweaks: function () {
      if (!this.root) return;
      // Accent and glow are owned by the CSS theme tokens (per light/dark),
      // so we intentionally do not override them inline here.
      this._motion = (this.props.motion == null ? 10 : this.props.motion) / 10;
      this.buildParticles();
    },

    buildParticles: function () {
      var layer = this.one('[data-particles]');
      if (!layer) return;
      // Respect Save-Data / reduced-data preferences: skip the ambient layer.
      var conn = navigator.connection;
      if (conn && conn.saveData) { layer.innerHTML = ''; return; }
      layer.innerHTML = '';
      var amb = this.props.ambiance || 'Drifting hearts';
      if (amb === 'Still' || this._motion <= 0) return;
      var base = amb === 'Gentle rain' ? 32 : 14;
      var count = Math.max(0, Math.round(base * this._motion));
      var shapes = [
        '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="var(--accent)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19.6l-1.25-1.13C6.4 14.5 3.6 12 3.6 8.95 3.6 6.5 5.55 4.6 8 4.6c1.38 0 2.7.64 3.57 1.66l.43.5.43-.5A4.7 4.7 0 0 1 16 4.6c2.45 0 4.4 1.9 4.4 4.35 0 3.05-2.8 5.55-7.15 9.52z"/></svg>',
        '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="var(--accent-2)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="12" rx="4.6" ry="7.2" transform="rotate(26 12 12)"/><path d="M9.7 6.7c2.3 1.9 1.85 7.6-1.1 10.6"/></svg>'
      ];
      for (var i = 0; i < count; i++) {
        var el = document.createElement('div');
        el.style.position = 'absolute';
        el.style.willChange = 'transform';
        var x = Math.random() * 100;
        var dur = (amb === 'Gentle rain' ? 1.1 : 9) + Math.random() * (amb === 'Gentle rain' ? 0.9 : 9);
        var delay = -Math.random() * dur;
        el.style.left = x + 'vw';
        el.style.top = '0';
        el.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
        if (amb === 'Gentle rain') {
          el.style.width = '1.5px';
          el.style.height = (12 + Math.random() * 14) + 'px';
          el.style.background = 'linear-gradient(var(--ink-mute),transparent)';
          el.style.opacity = '0.4';
          el.style.animation = 'rainFall ' + dur + 's linear ' + delay + 's infinite';
        } else if (amb === 'Floating dust') {
          var s = 2 + Math.random() * 4;
          el.style.width = s + 'px'; el.style.height = s + 'px';
          el.style.borderRadius = '50%';
          el.style.background = 'var(--accent)';
          el.style.boxShadow = '0 0 6px var(--glow)';
          el.style.opacity = (0.2 + Math.random() * 0.5).toFixed(2);
          el.style.animation = 'fall ' + (dur * 1.6) + 's linear ' + delay + 's infinite, floatY ' + (3 + Math.random() * 3) + 's ease-in-out infinite';
        } else {
          var sz = 11 + Math.random() * 13;
          el.style.width = sz + 'px'; el.style.height = sz + 'px';
          el.innerHTML = shapes[i % shapes.length];
          el.style.opacity = (0.18 + Math.random() * 0.3).toFixed(2);
          el.style.animation = 'fall ' + dur + 's linear ' + delay + 's infinite';
        }
        layer.appendChild(el);
      }
    },

    /* ---------- REVEALS (IntersectionObserver) ---------- */
    initReveals: function () {
      this.q('[data-stagger-group]').forEach(function (group) {
        Array.prototype.slice.call(group.querySelectorAll('[data-reveal]')).forEach(function (el, i) {
          el.style.transitionDelay = (i * 75) + 'ms';
        });
      });
      this.q('[data-reveal-delay]').forEach(function (el) {
        el.style.transitionDelay = (parseInt(el.getAttribute('data-reveal-delay'), 10) || 0) + 'ms';
      });
      var show = function (el) { el.style.opacity = '1'; el.style.transform = 'none'; el.style.filter = 'none'; };
      var els = this.q('[data-reveal]');
      if (!('IntersectionObserver' in window)) { els.forEach(show); return; }
      var io = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (en) { if (en.isIntersecting) { show(en.target); obs.unobserve(en.target); } });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });
      els.forEach(function (el) { io.observe(el); });
      this._cleanup.push(function () { io.disconnect(); });
    },
    processReveals: function () { /* now driven by IntersectionObserver */ },

    /* ---------- COUNTERS (IntersectionObserver) ---------- */
    initCounters: function () {
      var fmt = function (n) { return n >= 1000 ? Math.round(n).toLocaleString() : Math.round(n).toString(); };
      var run = function (el) {
        var target = parseFloat(el.getAttribute('data-counter')) || 0;
        var suffix = el.getAttribute('data-suffix') || '';
        var dur = 1600, start = performance.now();
        var tick = function (now) {
          var t = Math.min(1, (now - start) / dur);
          var eased = 1 - Math.pow(1 - t, 3);
          el.textContent = fmt(target * eased) + suffix;
          if (t < 1) requestAnimationFrame(tick); else el.textContent = fmt(target) + suffix;
        };
        requestAnimationFrame(tick);
      };
      var els = this.q('[data-counter]');
      if (!('IntersectionObserver' in window)) { els.forEach(run); return; }
      var io = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (en) { if (en.isIntersecting) { run(en.target); obs.unobserve(en.target); } });
      }, { threshold: 0.4 });
      els.forEach(function (el) { io.observe(el); });
      this._cleanup.push(function () { io.disconnect(); });
    },
    processCounters: function () { /* now driven by IntersectionObserver */ },

    /* ---------- SCROLL ---------- */
    initScroll: function () {
      var self = this;
      var nav = this.one('[data-nav]');
      var progress = this.one('[data-progress]');
      var heroHint = this.one('[data-hero-hint]');
      var stageOuter = this.one('[data-stage-outer]');
      var parallaxEls = this.q('[data-parallax]');
      var particles = this.one('[data-particles]');
      var stepCount = 5;
      var navLit = false;

      parallaxEls.forEach(function (el) {
        var s = el.getAttribute('style') || '';
        if (s.indexOf('translateX(-50%)') !== -1) el.setAttribute('data-parallax-base', 'translateX(-50%)');
      });

      // Document Y via the offset chain (ignores transforms, unlike
      // getBoundingClientRect), so reading it never fights our own parallax.
      var docTop = function (el) { var t = 0; while (el) { t += el.offsetTop; el = el.offsetParent; } return t; };

      // Geometry is cached and only recomputed on resize, so the scroll handler
      // performs ZERO synchronous layout reads per frame (no thrashing).
      var vh = window.innerHeight;
      var docH = 0;
      var pData = [];
      var stageTop = 0, stageH = 0;
      var measure = function () {
        vh = window.innerHeight;
        docH = document.documentElement.scrollHeight - vh;
        pData = parallaxEls.map(function (el) {
          return { el: el, factor: parseFloat(el.getAttribute('data-parallax')) || 0, base: el.getAttribute('data-parallax-base') || '', center: docTop(el) + el.offsetHeight / 2 };
        });
        if (stageOuter) { stageTop = docTop(stageOuter); stageH = stageOuter.offsetHeight; }
      };

      var onScroll = function () {
        self._raf = null;
        var y = window.scrollY || window.pageYOffset;
        if (progress) progress.style.width = (docH > 0 ? (y / docH) * 100 : 0) + '%';
        if (nav) {
          var lit = y > 40;
          if (lit !== navLit) {
            navLit = lit;
            if (lit) {
              nav.style.background = 'color-mix(in srgb, var(--bg) 94%, transparent)';
              nav.style.boxShadow = '0 1px 0 var(--line-soft)';
              nav.style.padding = '11px 0';
            } else {
              nav.style.background = 'transparent';
              nav.style.boxShadow = 'none';
              nav.style.padding = '18px 0';
            }
          }
        }
        if (heroHint) heroHint.style.opacity = Math.max(0, 1 - y / 320);
        var mf = self._motion == null ? 0.8 : self._motion;
        for (var i = 0; i < pData.length; i++) {
          var d = pData[i];
          var center = d.center - y - vh / 2;
          d.el.style.transform = d.base + ' translateY(' + (-center * d.factor * mf).toFixed(1) + 'px)';
        }
        if (particles) particles.style.transform = 'translateY(' + (y * 0.04 * mf).toFixed(1) + 'px)';
        if (stageOuter && window.innerWidth > 880) {
          var total = stageH - vh;
          var p = Math.min(1, Math.max(0, (y - stageTop) / (total || 1)));
          var active = Math.floor(p * stepCount);
          if (active > stepCount - 1) active = stepCount - 1;
          if (active < 0) active = 0;
          if (active !== self._activeStep) { self._activeStep = active; self.setStage(active); }
        }
      };
      var req = function () { if (self._raf == null) self._raf = requestAnimationFrame(onScroll); };
      var onResize = function () { measure(); req(); };
      measure();
      window.addEventListener('scroll', req, { passive: true });
      window.addEventListener('resize', onResize, { passive: true });
      this._cleanup.push(function () { window.removeEventListener('scroll', req); window.removeEventListener('resize', onResize); });
      onScroll();
    },

    setStage: function (active) {
      this.q('[data-step]').forEach(function (el) {
        var i = parseInt(el.getAttribute('data-step'), 10);
        var on = i === active;
        el.style.opacity = on ? '1' : '0';
        el.style.transform = on ? 'translateY(0) scale(1)' : 'translateY(24px) scale(.97)';
        el.style.pointerEvents = on ? 'auto' : 'none';
      });
      this.q('[data-copy]').forEach(function (el) {
        var i = parseInt(el.getAttribute('data-copy'), 10);
        var on = i === active;
        el.style.opacity = on ? '1' : '0';
        el.style.transform = on ? 'translateY(0)' : 'translateY(18px)';
        el.style.pointerEvents = on ? 'auto' : 'none';
      });
      this.q('[data-dot]').forEach(function (el) {
        var i = parseInt(el.getAttribute('data-dot'), 10);
        var dotEl = el.firstElementChild;
        if (dotEl) {
          dotEl.style.background = i <= active ? 'var(--accent)' : 'var(--line)';
          dotEl.style.boxShadow = i === active ? '0 0 12px var(--glow)' : 'none';
          dotEl.style.transform = i === active ? 'scale(1.25)' : 'scale(1)';
        }
      });
      // animate the Book DNA bars when their step is active
      var dna = this.one('[data-dna]');
      if (dna) {
        var bars = dna.querySelectorAll('[data-bar]');
        for (var bi = 0; bi < bars.length; bi++) {
          (function (bar, idx) {
            if (active === 3) { setTimeout(function () { bar.style.width = bar.getAttribute('data-w') || '0'; }, 140 + idx * 110); }
            else { bar.style.width = '0'; }
          })(bars[bi], bi);
        }
      }
    },

    /* ---------- INTERACTIONS ---------- */
    initInteractions: function () {
      var self = this;
      var handler = function (e) {
        var moodBtn = e.target.closest('[data-mood]');
        if (moodBtn && self.root.contains(moodBtn)) { self.selectMood(parseInt(moodBtn.getAttribute('data-mood'), 10)); return; }
        var quizOpt = e.target.closest('[data-quiz-opt]');
        if (quizOpt && self.root.contains(quizOpt)) { e.preventDefault(); self.quizAnswer(parseInt(quizOpt.getAttribute('data-q'), 10), quizOpt.getAttribute('data-val'), quizOpt.getAttribute('data-txt'), quizOpt); return; }
        var actEl = e.target.closest('[data-action]');
        if (actEl && self.root.contains(actEl)) {
          var a = actEl.getAttribute('data-action');
          if (a === 'theme') { self.toggleTheme(); return; }
          if (a === 'menu') { self.toggleMenu(); return; }
          if (a === 'quiz') { e.preventDefault(); self.openQuiz(); return; }
          if (a === 'quiz-close') { self.closeQuiz(); return; }
          if (a === 'quiz-restart') { e.preventDefault(); self.quizRestart(); return; }
          if (a === 'back-top') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
          if (a === 'cart') { e.preventDefault(); self.openDrawer('cart'); return; }
          if (a === 'wishlist') { e.preventDefault(); self.openDrawer('wish'); return; }
          if (a === 'add-cart') {
            e.preventDefault();
            var info = self.readBookInfo(actEl);
            if (info) { Store.addToCart(info.title, info.price); self.burst(e.clientX, e.clientY); self.announce(info.title + ' added to your bag'); self.openDrawer('cart'); }
            return;
          }
          if (a === 'wish') {
            e.preventDefault();
            var wt = self.readBookInfo(actEl);
            if (wt) { var added = Store.toggleWish(wt.title); actEl.setAttribute('aria-pressed', added ? 'true' : 'false'); if (added) self.burst(e.clientX, e.clientY); self.announce(added ? (wt.title + ' added to wishlist') : (wt.title + ' removed from wishlist')); }
            return;
          }
          if (a === 'rsvp') { e.preventDefault(); actEl.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M4.5 12.5l4.5 4.5L19.5 6.5"/></svg>Saved</span>'; actEl.style.background = 'var(--accent-2)'; return; }
          if (a === 'unwrap') { e.preventDefault(); self.unwrapBlindDate(actEl); return; }
          if (a === 'rewrap') { e.preventDefault(); self.rewrapBlindDate(); return; }
          if (a === 'search') { e.preventDefault(); self.openSearch(); return; }
        }
        var mlink = e.target.closest('[data-mlink]');
        if (mlink) { self.closeMenu(); }
      };
      this.root.addEventListener('click', handler);
      this._cleanup.push(function () { self.root.removeEventListener('click', handler); });

      var anchorHandler = function (e) {
        var a = e.target.closest('a[href^="#"]');
        if (!a || !self.root.contains(a)) return;
        var id = a.getAttribute('href');
        // Route hashes are owned by the React layer (Library / Admin / Sign in /
        // blog reader / event detail / story). Let the browser set the hash so
        // its hashchange listener can react; never smooth-scroll or querySelector
        // these (some carry an id segment that is not a valid selector).
        var routeExact = id === '#admin' || id === '#signin' || id === '#story';
        var routePrefix = id.indexOf('#library') === 0 || id.indexOf('#post/') === 0 || id.indexOf('#event/') === 0 || id.indexOf('#book/') === 0;
        if (routeExact || routePrefix) { self.closeMenu(); return; }
        if (id === '#' || id.length < 2) { if (id === '#') e.preventDefault(); return; }
        var target = self.root.querySelector(id);
        if (target) {
          e.preventDefault();
          var top = target.getBoundingClientRect().top + window.scrollY - 66;
          window.scrollTo({ top: top, behavior: 'smooth' });
          self.closeMenu();
        }
      };
      this.root.addEventListener('click', anchorHandler);
      this._cleanup.push(function () { self.root.removeEventListener('click', anchorHandler); });

      var form = this.one('[data-newsletter]');
      if (form) {
        var input = form.querySelector('input[type="email"]') || form.querySelector('input');
        var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        var err = null;
        var sub = function (e) {
          e.preventDefault();
          var val = input ? String(input.value || '').trim() : '';
          if (!EMAIL.test(val)) {
            if (input) { input.style.borderColor = 'var(--accent-3)'; input.setAttribute('aria-invalid', 'true'); }
            if (!err) {
              err = document.createElement('div');
              err.setAttribute('data-news-err', '');
              err.setAttribute('role', 'alert');
              err.style.cssText = 'color:var(--accent-3);font-size:13px;margin-top:10px;font-family:var(--mono)';
              form.appendChild(err);
            }
            err.textContent = 'Please enter a valid email address.';
            self.announce('Please enter a valid email address.');
            return;
          }
          if (input) { input.style.borderColor = 'var(--line)'; input.removeAttribute('aria-invalid'); }
          if (err) { err.textContent = ''; }
          var thanks = self.one('[data-news-thanks]');
          if (thanks) { thanks.style.height = '26px'; thanks.style.opacity = '1'; }
          form.style.opacity = '0.45'; form.style.pointerEvents = 'none';
          self.announce('Thanks for subscribing. Check your inbox.');
        };
        form.addEventListener('submit', sub);
        this._cleanup.push(function () { form.removeEventListener('submit', sub); });
      }

      var keyHandler = function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
          var q = self.one('[data-quiz]');
          if (q && q.getAttribute('data-open') === '1') { self.closeQuiz(); return; }
          var m = self.one('[data-mobilemenu]');
          if (m && m.getAttribute('data-open') === '1') { self.closeMenu(); }
        }
      };
      document.addEventListener('keydown', keyHandler);
      this._cleanup.push(function () { document.removeEventListener('keydown', keyHandler); });
    },

    selectMood: function (idx) {
      this.q('[data-mood]').forEach(function (b) {
        var on = parseInt(b.getAttribute('data-mood'), 10) === idx;
        b.style.background = on ? 'var(--accent)' : 'var(--panel)';
        b.style.color = on ? 'var(--accent-ink)' : 'var(--ink-soft)';
        b.style.borderColor = on ? 'var(--accent)' : 'var(--line)';
      });
      var grid = this.one('[data-mood-result]');
      if (!grid) return;
      var set = (this._moodSets && this._moodSets[idx]) || [];
      grid.style.opacity = '0';
      grid.style.transform = 'translateY(12px)';
      setTimeout(function () {
        var cards = Array.prototype.slice.call(grid.children);
        cards.forEach(function (card, i) {
          var data = set[i]; if (!data) return;
          var cover = card.querySelector('[data-mcover]');
          var title = card.querySelector('[data-mtitle]');
          var author = card.querySelector('[data-mauthor]');
          if (cover) cover.style.background = data.tint;
          if (title) title.textContent = data.title;
          if (author) author.textContent = data.author;
        });
        grid.style.opacity = '1';
        grid.style.transform = 'none';
      }, 220);
    },

    toggleMenu: function () {
      var m = this.one('[data-mobilemenu]');
      if (!m) return;
      var open = m.getAttribute('data-open') === '1';
      if (open) { this.closeMenu(); return; }
      m.setAttribute('data-open', '1');
      m.style.opacity = '1'; m.style.pointerEvents = 'auto'; m.style.transform = 'none';
      this.q('[data-action="menu"]').forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
      this._menuTrap = this.trapFocus(m, this.closeMenu.bind(this));
    },
    closeMenu: function () {
      var m = this.one('[data-mobilemenu]');
      if (!m) return;
      m.setAttribute('data-open', '0');
      m.style.opacity = '0'; m.style.pointerEvents = 'none'; m.style.transform = 'translateY(-12px)';
      this.q('[data-action="menu"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      if (this._menuTrap) { this._menuTrap(); this._menuTrap = null; }
    },

    restoreBadges: function () {
      var self = this;
      ['cart', 'wish'].forEach(function (k) {
        var v = 0; try { v = parseInt(localStorage.getItem('cupid-' + k) || '0', 10) || 0; } catch (e) {}
        if (v > 0) self.setBadge(k, v);
      });
    },
    bumpBadge: function (k) {
      var badge = this.one('[data-badge="' + k + '"]');
      var v = badge ? (parseInt(badge.textContent, 10) || 0) : 0;
      v += 1;
      this.setBadge(k, v);
      try { localStorage.setItem('cupid-' + k, String(v)); } catch (e) {}
    },
    setBadge: function (k, v) {
      var badge = this.one('[data-badge="' + k + '"]');
      if (!badge) return;
      badge.textContent = v;
      badge.style.display = v > 0 ? 'flex' : 'none';
      badge.style.animation = 'none'; void badge.offsetWidth; badge.style.animation = 'pop .4s ease';
    },
    burst: function (x, y) {
      var el = document.createElement('div');
      el.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="var(--accent)" style="display:block"><path d="M12 20.4l-1.55-1.4C6 14.95 3.2 12.4 3.2 9.2 3.2 6.65 5.2 4.7 7.7 4.7c1.5 0 2.95.7 3.9 1.8l.4.46.4-.46A5.05 5.05 0 0 1 16.3 4.7c2.5 0 4.5 1.95 4.5 4.5 0 3.2-2.8 5.75-7.25 9.82z"/></svg>';
      el.style.cssText = 'position:fixed;left:' + x + 'px;top:' + y + 'px;z-index:999;pointer-events:none;transition:transform .8s cubic-bezier(.16,1,.3,1),opacity .8s;transform:translate(-50%,-50%);filter:drop-shadow(0 4px 10px var(--glow))';
      document.body.appendChild(el);
      requestAnimationFrame(function () {
        el.style.transform = 'translate(-50%,-160%) scale(1.6)';
        el.style.opacity = '0';
      });
      setTimeout(function () { el.remove(); }, 820);
    },

    /* ---------- BOOK INFO (for cart / wishlist) ---------- */
    readBookInfo: function (el) {
      var title = el.getAttribute('data-title');
      var price = el.getAttribute('data-price');
      if (!title && el.closest) {
        var bd = el.closest('[data-blinddate]');
        if (bd) { var bt = bd.querySelector('[data-bd-title]'); if (bt) title = bt.textContent; if (!price) price = '$18'; }
      }
      if (!title && el.closest) {
        var card = el.closest('[data-book], article, li');
        if (card) { var tt = card.querySelector('[data-mtitle],[data-qtitle],h3,h4'); if (tt) title = tt.textContent; }
      }
      if (!title) return null;
      return { title: String(title).trim(), price: String(price || '$0').trim() };
    },

    _esc: function (s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
    _priceFor: function (title) {
      for (var i = 0; i < catalog.length; i++) { if (catalog[i].title === title) return catalog[i].price; }
      return '$0';
    },
    _findLine: function (title) {
      var lines = Store.cartLines();
      for (var i = 0; i < lines.length; i++) { if (lines[i].title === title) return lines[i]; }
      return null;
    },
    _emptyState: function (title, sub) {
      return '<div class="drawer-empty"><div class="drawer-empty-t">' + this._esc(title) + '</div><div class="drawer-empty-s">' + this._esc(sub) + '</div></div>';
    },

    /* ---------- STORE SYNC (badges + drawer + heart state) ---------- */
    syncStore: function () {
      var self = this;
      var update = function () {
        self.setBadge('cart', Store.cartCount());
        self.setBadge('wish', Store.wishCount());
        self.renderDrawer();
        self.q('[data-action="wish"]').forEach(function (btn) {
          var t = btn.getAttribute('data-title');
          if (t) btn.setAttribute('aria-pressed', Store.inWishlist(t) ? 'true' : 'false');
        });
      };
      update();
      this._cleanup.push(Store.subscribe(update));
    },

    /* ---------- CART + WISHLIST DRAWER ---------- */
    buildDrawer: function () {
      if (this._drawer) return;
      var self = this;
      var xIcon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      var overlay = document.createElement('div');
      overlay.className = 'drawer-overlay';
      overlay.setAttribute('data-drawer-overlay', '');
      var aside = document.createElement('aside');
      aside.className = 'drawer';
      aside.setAttribute('data-drawer', '');
      aside.setAttribute('role', 'dialog');
      aside.setAttribute('aria-modal', 'true');
      aside.setAttribute('aria-label', 'Your bag and wishlist');
      aside.innerHTML =
        '<div class="drawer-head">' +
          '<div class="drawer-tabs">' +
            '<button class="drawer-tab is-on" data-drawer-tab="cart">Bag (<span data-drawer-cartcount>0</span>)</button>' +
            '<button class="drawer-tab" data-drawer-tab="wish">Wishlist (<span data-drawer-wishcount>0</span>)</button>' +
          '</div>' +
          '<button class="drawer-x" data-drawer-close aria-label="Close">' + xIcon + '</button>' +
        '</div>' +
        '<div class="drawer-body" data-drawer-body></div>' +
        '<div class="drawer-foot" data-drawer-foot>' +
          '<div class="drawer-total"><span>Total</span><strong data-drawer-total>$0</strong></div>' +
          '<button class="drawer-checkout" data-drawer-checkout>Checkout</button>' +
        '</div>';
      overlay.appendChild(aside);
      document.body.appendChild(overlay);
      this._drawer = overlay;
      this._drawerTab = 'cart';

      var onClick = function (e) {
        var t = e.target;
        if (t === overlay || (t.closest && t.closest('[data-drawer-close]'))) { self.closeDrawer(); return; }
        var tab = t.closest && t.closest('[data-drawer-tab]');
        if (tab) { self._drawerTab = tab.getAttribute('data-drawer-tab'); self.renderDrawer(); return; }
        var inc = t.closest && t.closest('[data-qinc]');
        if (inc) { var ti = inc.getAttribute('data-qinc'); var li = self._findLine(ti); Store.setQty(ti, (li ? li.qty : 0) + 1); return; }
        var dec = t.closest && t.closest('[data-qdec]');
        if (dec) { var td = dec.getAttribute('data-qdec'); var ld = self._findLine(td); Store.setQty(td, (ld ? ld.qty : 1) - 1); return; }
        var rm = t.closest && t.closest('[data-qremove]');
        if (rm) { Store.removeFromCart(rm.getAttribute('data-qremove')); self.announce('Removed from bag'); return; }
        var w2c = t.closest && t.closest('[data-wishadd]');
        if (w2c) { var wt = w2c.getAttribute('data-wishadd'); Store.addToCart(wt, w2c.getAttribute('data-wishprice') || '$0'); Store.toggleWish(wt); self._drawerTab = 'cart'; self.renderDrawer(); self.announce(wt + ' moved to bag'); return; }
        var wrm = t.closest && t.closest('[data-wishremove]');
        if (wrm) { Store.toggleWish(wrm.getAttribute('data-wishremove')); return; }
        if (t.closest && t.closest('[data-drawer-checkout]')) { self._checkout(); return; }
      };
      overlay.addEventListener('click', onClick);
      this._cleanup.push(function () { overlay.removeEventListener('click', onClick); if (overlay.parentNode) overlay.parentNode.removeChild(overlay); self._drawer = null; });
      this.renderDrawer();
    },
    renderDrawer: function () {
      if (!this._drawer) return;
      var self = this;
      var d = this._drawer;
      var cc = d.querySelector('[data-drawer-cartcount]'); if (cc) cc.textContent = String(Store.cartCount());
      var wc = d.querySelector('[data-drawer-wishcount]'); if (wc) wc.textContent = String(Store.wishCount());
      Array.prototype.slice.call(d.querySelectorAll('[data-drawer-tab]')).forEach(function (b) {
        b.classList.toggle('is-on', b.getAttribute('data-drawer-tab') === self._drawerTab);
      });
      var body = d.querySelector('[data-drawer-body]');
      var foot = d.querySelector('[data-drawer-foot]');
      var totalEl = d.querySelector('[data-drawer-total]');
      if (totalEl) totalEl.textContent = '$' + Store.cartTotal();
      if (!body) return;
      if (this._drawerTab === 'cart') {
        if (foot) foot.style.display = Store.cartCount() > 0 ? 'flex' : 'none';
        var lines = Store.cartLines();
        if (!lines.length) { body.innerHTML = this._emptyState('Your bag is empty.', 'Add a book and it will steep here.'); return; }
        body.innerHTML = lines.map(function (c) {
          return '<div class="drawer-line">' +
            '<div class="drawer-line-main"><div class="drawer-line-title">' + self._esc(c.title) + '</div><div class="drawer-line-price">' + self._esc(c.price) + '</div></div>' +
            '<div class="drawer-qty">' +
              '<button data-qdec="' + self._esc(c.title) + '" aria-label="Decrease quantity">-</button>' +
              '<span>' + c.qty + '</span>' +
              '<button data-qinc="' + self._esc(c.title) + '" aria-label="Increase quantity">+</button>' +
            '</div>' +
            '<button class="drawer-rm" data-qremove="' + self._esc(c.title) + '" aria-label="Remove">remove</button>' +
          '</div>';
        }).join('');
      } else {
        if (foot) foot.style.display = 'none';
        var wl = Store.get().wishlist;
        if (!wl.length) { body.innerHTML = this._emptyState('No saved books yet.', 'Tap a heart to keep one for later.'); return; }
        body.innerHTML = wl.map(function (title) {
          var price = self._priceFor(title);
          return '<div class="drawer-line">' +
            '<div class="drawer-line-main"><div class="drawer-line-title">' + self._esc(title) + '</div><div class="drawer-line-price">' + self._esc(price) + '</div></div>' +
            '<button class="drawer-mini" data-wishadd="' + self._esc(title) + '" data-wishprice="' + self._esc(price) + '">Add to bag</button>' +
            '<button class="drawer-rm" data-wishremove="' + self._esc(title) + '" aria-label="Remove">remove</button>' +
          '</div>';
        }).join('');
      }
    },
    _checkout: function () {
      if (Store.cartCount() === 0) return;
      var self = this;
      Store.checkout().then(function (r) {
        if (!r) return;
        // Stripe configured: hand off to the hosted checkout page.
        if (r.url) { window.location.href = r.url; return; }
        // Instant path (no Stripe): the order is placed and the cart cleared.
        var body = self._drawer && self._drawer.querySelector('[data-drawer-body]');
        var foot = self._drawer && self._drawer.querySelector('[data-drawer-foot]');
        if (foot) foot.style.display = 'none';
        if (body) {
          body.innerHTML = (r.downloads && r.downloads.length)
            ? self._downloadsState(r.downloads)
            : self._emptyState('Order placed.', 'A confirmation is on its way. Enjoy the read (and the coffee).');
        }
        self.announce('Order placed. Thank you.');
      });
    },
    _downloadsState: function (downloads) {
      var self = this;
      var links = downloads.map(function (d) {
        return '<a class="drawer-checkout" style="display:block;text-align:center;margin:8px 0;text-decoration:none" href="'
          + self._esc(d.url) + '" target="_blank" rel="noopener">Download "' + self._esc(d.title) + '"</a>';
      }).join('');
      return '<div style="text-align:center;padding:22px 14px">'
        + '<div class="drawer-empty-t">Order placed</div>'
        + '<div class="drawer-empty-s" style="margin-bottom:14px">Your free digital copy is ready. This link works for a limited time.</div>'
        + links + '</div>';
    },
    openDrawer: function (tab) {
      this.buildDrawer();
      if (!this._drawer) return;
      this._drawerTab = tab === 'wish' ? 'wish' : 'cart';
      this.renderDrawer();
      this._drawer.classList.add('is-open');
      try { document.body.style.overflow = 'hidden'; } catch (e) {}
      this.q('[data-action="cart"],[data-action="wishlist"]').forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
      var aside = this._drawer.querySelector('[data-drawer]');
      this._drawerTrap = this.trapFocus(aside, this.closeDrawer.bind(this));
    },
    closeDrawer: function () {
      if (!this._drawer) return;
      this._drawer.classList.remove('is-open');
      try { document.body.style.overflow = ''; } catch (e) {}
      this.q('[data-action="cart"],[data-action="wishlist"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      if (this._drawerTrap) { this._drawerTrap(); this._drawerTrap = null; }
    },

    /* ---------- SEARCH PALETTE ---------- */
    buildSearch: function () {
      if (this._search) return;
      var self = this;
      var sIcon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';
      var overlay = document.createElement('div');
      overlay.className = 'search-overlay';
      overlay.setAttribute('data-search-overlay', '');
      var box = document.createElement('div');
      box.className = 'search-box';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-label', 'Search the shelves');
      box.innerHTML =
        '<div class="search-bar">' + sIcon +
          '<input type="text" data-search-input placeholder="Search books, authors, moods..." aria-label="Search books" autocomplete="off">' +
          '<button class="search-x" data-search-close aria-label="Close search">esc</button>' +
        '</div>' +
        '<div class="search-filters" data-search-filters></div>' +
        '<div class="search-results" data-search-results></div>';
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      this._search = overlay;
      this._searchGenre = '';
      var fil = box.querySelector('[data-search-filters]');
      if (fil) {
        fil.innerHTML = '<button class="chip is-on" data-genre="">All</button>' +
          genres.map(function (g) { return '<button class="chip" data-genre="' + self._esc(g) + '">' + self._esc(g) + '</button>'; }).join('');
      }
      var input = box.querySelector('[data-search-input]');
      var onInput = function () { self.renderSearch(); };
      if (input) input.addEventListener('input', onInput);
      var onClick = function (e) {
        var t = e.target;
        if (t === overlay || (t.closest && t.closest('[data-search-close]'))) { self.closeSearch(); return; }
        var chip = t.closest && t.closest('[data-genre]');
        if (chip) {
          self._searchGenre = chip.getAttribute('data-genre');
          Array.prototype.slice.call(box.querySelectorAll('[data-genre]')).forEach(function (c) { c.classList.toggle('is-on', c === chip); });
          self.renderSearch();
          return;
        }
        var add = t.closest && t.closest('[data-search-add]');
        if (add) { var rt = add.getAttribute('data-search-add'); Store.addToCart(rt, add.getAttribute('data-search-price') || '$0'); self.burst(e.clientX, e.clientY); self.announce(rt + ' added to your bag'); return; }
      };
      overlay.addEventListener('click', onClick);
      this._cleanup.push(function () { if (input) input.removeEventListener('input', onInput); overlay.removeEventListener('click', onClick); if (overlay.parentNode) overlay.parentNode.removeChild(overlay); self._search = null; });
    },
    renderSearch: function () {
      if (!this._search) return;
      var self = this;
      var input = this._search.querySelector('[data-search-input]');
      var q = input ? input.value : '';
      var results = searchCatalog({ query: q, genre: this._searchGenre || undefined });
      var box = this._search.querySelector('[data-search-results]');
      if (!box) return;
      if (!results.length) { box.innerHTML = '<div class="search-empty">No matches. Try another word.</div>'; return; }
      box.innerHTML = results.map(function (b) {
        return '<div class="search-row">' +
          '<span class="search-cover" style="background:' + b.tint + '"></span>' +
          '<span class="search-meta"><span class="search-title">' + self._esc(b.title) + '</span>' +
          '<span class="search-sub">' + self._esc(b.author) + ' &middot; ' + self._esc(b.genre || '') + ' &middot; ' + self._esc(b.roast) + ' roast</span></span>' +
          '<span class="search-price">' + self._esc(b.price) + '</span>' +
          '<button class="search-add" data-search-add="' + self._esc(b.title) + '" data-search-price="' + self._esc(b.price) + '" aria-label="Add ' + self._esc(b.title) + ' to bag">Add</button>' +
        '</div>';
      }).join('');
    },
    openSearch: function () {
      this.buildSearch();
      if (!this._search) return;
      this._search.classList.add('is-open');
      try { document.body.style.overflow = 'hidden'; } catch (e) {}
      this.q('[data-action="search"]').forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
      this.renderSearch();
      var box = this._search.querySelector('.search-box');
      this._searchTrap = this.trapFocus(box, this.closeSearch.bind(this));
    },
    closeSearch: function () {
      if (!this._search) return;
      this._search.classList.remove('is-open');
      try { document.body.style.overflow = ''; } catch (e) {}
      this.q('[data-action="search"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      if (this._searchTrap) { this._searchTrap(); this._searchTrap = null; }
    },

    /* ---------- TILT ---------- */
    initTilt: function () {
      var self = this;
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var fine = !window.matchMedia || window.matchMedia('(hover: hover)').matches;
      if (reduce || !fine) return;
      this.q('[data-tilt]').forEach(function (wrap) {
        var inner = wrap.querySelector('[style*="aspect-ratio"]') || wrap.firstElementChild;
        if (!inner) return;
        inner.style.transformStyle = 'preserve-3d';
        inner.style.transition = 'transform .2s ease';
        if (getComputedStyle(inner).position === 'static') inner.style.position = 'relative';
        var glare = document.createElement('span');
        glare.className = 'tilt-glare';
        inner.appendChild(glare);
        var rect = null, raf = null, lx = 0, ly = 0;
        var apply = function () {
          raf = null;
          var m = self._motion == null ? 0.8 : self._motion;
          inner.style.transform = 'perspective(700px) rotateY(' + (lx * 16 * m).toFixed(1) + 'deg) rotateX(' + (-ly * 16 * m).toFixed(1) + 'deg) translateY(-6px)';
          glare.style.opacity = '1';
        };
        var enter = function () { rect = wrap.getBoundingClientRect(); inner.style.willChange = 'transform'; };
        var move = function (e) {
          if (!rect) rect = wrap.getBoundingClientRect();
          lx = (e.clientX - rect.left) / rect.width - 0.5;
          ly = (e.clientY - rect.top) / rect.height - 0.5;
          if (!raf) raf = requestAnimationFrame(apply);
        };
        var leave = function () { rect = null; if (raf) { cancelAnimationFrame(raf); raf = null; } inner.style.transform = 'perspective(700px) rotateY(0) rotateX(0)'; inner.style.willChange = 'auto'; glare.style.opacity = '0'; };
        wrap.addEventListener('mouseenter', enter);
        wrap.addEventListener('mousemove', move);
        wrap.addEventListener('mouseleave', leave);
        self._cleanup.push(function () { wrap.removeEventListener('mouseenter', enter); wrap.removeEventListener('mousemove', move); wrap.removeEventListener('mouseleave', leave); if (raf) cancelAnimationFrame(raf); if (glare.parentNode) glare.parentNode.removeChild(glare); });
      });
    },

    /* ---------- HERO CURSOR SPOTLIGHT ---------- */
    initSpotlight: function () {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (window.matchMedia && !window.matchMedia('(hover: hover)').matches) return;
      var hero = this.one('#top');
      if (!hero) return;
      if (getComputedStyle(hero).position === 'static') hero.style.position = 'relative';
      var spot = document.createElement('div');
      spot.className = 'hero-spot';
      hero.appendChild(spot);
      var raf = null, tx = 0, ty = 0, rect = null;
      var move = function (e) {
        if (!rect) rect = hero.getBoundingClientRect();
        tx = e.clientX - rect.left;
        ty = e.clientY - rect.top;
        if (!raf) raf = requestAnimationFrame(function () { raf = null; spot.style.transform = 'translate(' + tx.toFixed(0) + 'px,' + ty.toFixed(0) + 'px)'; });
      };
      var enter = function () { rect = hero.getBoundingClientRect(); spot.style.opacity = '1'; };
      var leave = function () { rect = null; spot.style.opacity = '0'; };
      hero.addEventListener('mousemove', move);
      hero.addEventListener('mouseenter', enter);
      hero.addEventListener('mouseleave', leave);
      this._cleanup.push(function () {
        hero.removeEventListener('mousemove', move);
        hero.removeEventListener('mouseenter', enter);
        hero.removeEventListener('mouseleave', leave);
        if (raf) cancelAnimationFrame(raf);
        if (spot.parentNode) spot.parentNode.removeChild(spot);
      });
    },

    /* ---------- MAGNETIC CTA ---------- */
    initMagnetic: function () {
      var self = this;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (window.matchMedia && !window.matchMedia('(hover: hover)').matches) return;
      this.q('[data-magnetic]').forEach(function (el) {
        el.style.transition = 'transform .35s cubic-bezier(.16,1,.3,1),box-shadow .3s ease';
        var rect = null, raf = null, cx = 0, cy = 0;
        var apply = function () { raf = null; var m = self._motion == null ? 1 : self._motion; el.style.transform = 'translate(' + (cx * 0.22 * m).toFixed(1) + 'px,' + (cy * 0.3 * m).toFixed(1) + 'px)'; };
        var enter = function () { rect = el.getBoundingClientRect(); };
        var move = function (e) {
          if (!rect) rect = el.getBoundingClientRect();
          cx = e.clientX - (rect.left + rect.width / 2);
          cy = e.clientY - (rect.top + rect.height / 2);
          if (!raf) raf = requestAnimationFrame(apply);
        };
        var leave = function () { rect = null; if (raf) { cancelAnimationFrame(raf); raf = null; } el.style.transform = 'translate(0,0)'; };
        el.addEventListener('mouseenter', enter);
        el.addEventListener('mousemove', move);
        el.addEventListener('mouseleave', leave);
        self._cleanup.push(function () { el.removeEventListener('mouseenter', enter); el.removeEventListener('mousemove', move); el.removeEventListener('mouseleave', leave); if (raf) cancelAnimationFrame(raf); });
      });
    },

    /* ---------- BLIND DATE (unwrap interaction) ---------- */
    unwrapBlindDate: function (btn) {
      var self = this;
      var box = this.one('[data-blinddate]');
      if (!box) return;
      var sets; try { sets = JSON.parse(box.getAttribute('data-bd-sets')); } catch (e) { return; }
      var cur = parseInt(box.getAttribute('data-bd-cur') || '0', 10) || 0;
      var d = sets[cur]; if (!d) return;
      var parcel = box.querySelector('[data-bd-parcel]');
      var rev = box.querySelector('[data-bd-reveal]');
      var cover = box.querySelector('[data-bd-cover]');
      var coverTitle = box.querySelector('[data-bd-cover-title]');
      var title = box.querySelector('[data-bd-title]');
      var author = box.querySelector('[data-bd-author]');
      var meta = box.querySelector('[data-bd-meta]');
      if (cover) cover.style.background = d.tint;
      if (coverTitle) coverTitle.textContent = d.title;
      if (title) title.textContent = d.title;
      if (author) author.textContent = d.author;
      if (meta) meta.innerHTML = '<span style="color:var(--accent-2)">' + d.roast + '</span> \u00B7 ' + d.note;
      if (parcel) { parcel.style.opacity = '0'; parcel.style.transform = 'scale(.97) translateY(-6px)'; parcel.style.pointerEvents = 'none'; }
      if (rev) { rev.style.opacity = '1'; rev.style.transform = 'scale(1)'; rev.style.pointerEvents = 'auto'; }
      if (btn) {
        var r = btn.getBoundingClientRect();
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        for (var i = 0; i < 7; i++) {
          (function (k) { setTimeout(function () { self.burst(cx + (Math.random() * 130 - 65), cy + (Math.random() * 20 - 30)); }, k * 55); })(i);
        }
      }
    },
    rewrapBlindDate: function () {
      var box = this.one('[data-blinddate]');
      if (!box) return;
      var sets; try { sets = JSON.parse(box.getAttribute('data-bd-sets')); } catch (e) { return; }
      var cur = parseInt(box.getAttribute('data-bd-cur') || '0', 10) || 0;
      cur = (cur + 1) % sets.length;
      box.setAttribute('data-bd-cur', String(cur));
      var d = sets[cur];
      var clues = box.querySelector('[data-bd-clues]');
      if (clues && d) clues.innerHTML = d.clues.map(function (c) { return '<span class="bd-clue">' + c + '</span>'; }).join('');
      var parcel = box.querySelector('[data-bd-parcel]');
      var rev = box.querySelector('[data-bd-reveal]');
      if (rev) { rev.style.opacity = '0'; rev.style.transform = 'scale(.95)'; rev.style.pointerEvents = 'none'; }
      if (parcel) { parcel.style.opacity = '1'; parcel.style.transform = 'none'; parcel.style.pointerEvents = 'auto'; }
    },

    /* ---------- QUIZ (find your next read) ---------- */
    openQuiz: function () {
      var d = this.one('[data-quiz]');
      if (!d) return;
      this.resetQuizUI();
      d.setAttribute('data-open', '1');
      d.style.opacity = '1';
      d.style.pointerEvents = 'auto';
      try { document.body.style.overflow = 'hidden'; } catch (e) {}
      this.q('[data-action="quiz"]').forEach(function (b) { if (b.tagName === 'BUTTON') b.setAttribute('aria-expanded', 'true'); });
      this._quizTrap = this.trapFocus(d, this.closeQuiz.bind(this));
    },
    closeQuiz: function () {
      var d = this.one('[data-quiz]');
      if (!d) return;
      d.setAttribute('data-open', '0');
      d.style.opacity = '0';
      d.style.pointerEvents = 'none';
      try { document.body.style.overflow = ''; } catch (e) {}
      this.q('[data-action="quiz"]').forEach(function (b) { if (b.tagName === 'BUTTON') b.setAttribute('aria-expanded', 'false'); });
      if (this._quizTrap) { this._quizTrap(); this._quizTrap = null; }
    },
    resetQuizUI: function () {
      var d = this.one('[data-quiz]');
      if (!d) return;
      this._quizMood = null; this._quizPace = ''; this._quizEnd = '';
      d.setAttribute('data-q', '0');
      this.q('[data-quiz-q]').forEach(function (el) { el.style.display = parseInt(el.getAttribute('data-quiz-q'), 10) === 0 ? 'block' : 'none'; });
      this.q('.quiz-opt').forEach(function (b) { b.classList.remove('is-sel'); });
      var body = d.querySelector('[data-quiz-body]'); if (body) body.style.display = 'block';
      var res = d.querySelector('[data-quiz-result]'); if (res) res.style.display = 'none';
      this._updateQuizHeader(0);
    },
    quizAnswer: function (qi, val, txt, optEl) {
      var d = this.one('[data-quiz]');
      if (!d) return;
      var group = d.querySelector('[data-quiz-q="' + qi + '"]');
      if (group) { Array.prototype.slice.call(group.querySelectorAll('.quiz-opt')).forEach(function (b) { b.classList.remove('is-sel'); }); }
      if (optEl) optEl.classList.add('is-sel');
      if (qi === 0) { this._quizMood = parseInt(val, 10) || 0; this._quizMoodTag = (txt || '').toLowerCase(); }
      else if (qi === 1) { this._quizPace = txt || ''; this._quizPaceVal = val || ''; }
      else if (qi === 2) { this._quizEnd = txt || ''; this._quizEndVal = val || ''; }
      var self = this;
      setTimeout(function () {
        if (qi < 2) self._showQuizQuestion(qi + 1);
        else self._showQuizResult();
      }, 280);
    },
    _showQuizQuestion: function (qi) {
      var d = this.one('[data-quiz]'); if (!d) return;
      this.q('[data-quiz-q]').forEach(function (el) { el.style.display = parseInt(el.getAttribute('data-quiz-q'), 10) === qi ? 'block' : 'none'; });
      d.setAttribute('data-q', String(qi));
      this._updateQuizHeader(qi);
    },
    _updateQuizHeader: function (qi) {
      var d = this.one('[data-quiz]'); if (!d) return;
      var lbl = d.querySelector('[data-quiz-step-label]'); if (lbl) lbl.textContent = 'Question ' + (qi + 1) + ' of 3';
      var bar = d.querySelector('[data-quiz-bar]'); if (bar) bar.style.width = ((qi + 1) / 3 * 100) + '%';
    },
    _showQuizResult: function () {
      var d = this.one('[data-quiz]'); if (!d) return;
      var body = d.querySelector('[data-quiz-body]'); if (body) body.style.display = 'none';
      var res = d.querySelector('[data-quiz-result]'); if (res) res.style.display = 'block';
      var lbl = d.querySelector('[data-quiz-step-label]'); if (lbl) lbl.textContent = 'Your matches';
      var bar = d.querySelector('[data-quiz-bar]'); if (bar) bar.style.width = '100%';
      var paceMap = { slow: 'slow', mid: 'medium', fast: 'fast' };
      var answers = {
        mood: this._quizMoodTag || undefined,
        pace: paceMap[this._quizPaceVal] || undefined,
        ending: this._quizEndVal || undefined,
      };
      var covers = d.querySelectorAll('[data-qcover]');
      var recs = recommend(answers, covers.length);
      for (var i = 0; i < covers.length; i++) {
        var bk = recs[i]; if (!bk) continue;
        covers[i].style.background = bk.tint;
        var t = covers[i].querySelector('[data-qtitle]'); if (t) t.textContent = bk.title;
        var au = covers[i].querySelector('[data-qauthor]'); if (au) au.textContent = bk.author;
      }
      if (recs[0]) this.announce('Your top match is ' + recs[0].title + ' by ' + recs[0].author);
      var sub = d.querySelector('[data-quiz-result-sub]');
      if (sub) {
        var pace = (this._quizPace || 'an easy').toLowerCase();
        var end = (this._quizEnd || 'lovely').toLowerCase();
        sub.textContent = pace.charAt(0).toUpperCase() + pace.slice(1) + ', ' + end + '. Here is what we would pour for you tonight.';
      }
    },
    quizRestart: function () { this.resetQuizUI(); },


    initVeil: function () {
      var v = document.querySelector('[data-veil]');
      if (!v) return;
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this._veilTimer = setTimeout(function () { if (v && v.parentNode) v.parentNode.removeChild(v); }, reduce ? 0 : 2150);
    },

    /* ---------- TEARDOWN (React unmount) ---------- */
    destroy: function () {
      if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
      if (this._veilTimer) { clearTimeout(this._veilTimer); this._veilTimer = null; }
      if (this._idle) { (window.cancelIdleCallback || clearTimeout)(this._idle); this._idle = null; }
      (this._cleanup || []).forEach(function (fn) { try { fn(); } catch (e) {} });
      this._cleanup = [];
      try { document.body.style.overflow = ''; } catch (e) {}
      this.root = null;
      this._activeStep = -1;
    }
  };

/* Run after React has mounted #app. Safe to call once; React StrictMode in dev
   may invoke the effect twice, so initApp() resets first. */
export function initApp() {
  if (App.root) { try { App.destroy(); } catch (e) {} }
  App.init();
  return App;
}
export function destroyApp() {
  try { App.destroy(); } catch (e) {}
}
export default App;
