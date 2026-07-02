import React, { useEffect, useRef, useState } from 'react';
import './styles.css';

import { initApp, destroyApp } from './lib/runtime.js';
import { api } from './lib/api.js';
import { account } from './lib/account';
import { store } from './lib/store';
import { library } from './lib/library';
import { rsvp } from './lib/rsvp';
import Block from './components/Block.jsx';
import Categories from './components/Categories.jsx';
import Arrivals from './components/Arrivals.jsx';
import Library from './components/Library.jsx';
import AuthModal from './components/AuthModal.jsx';
import AccountModal from './components/AccountModal.jsx';
import BookModal from './components/BookModal.jsx';
import ContactModal from './components/ContactModal.jsx';
import VerifyResetView from './components/VerifyResetView.jsx';
import Toaster from './components/Toaster.jsx';
import ArticleReader from './components/ArticleReader.jsx';
import EventModal from './components/EventModal.jsx';
import StoryPage from './components/StoryPage.jsx';

/* Bespoke sections render their proven markup as trusted partials; the two
   data-driven grids (Categories, Arrivals) are real React components fed from
   data.js. All of it lives inside #app, where the runtime wires interactivity. */
import veil from './partials/00-page-load-overture.html?raw';
import particles from './partials/01-ambient-particle-layer-filled-by-js.html?raw';
import grain from './partials/02-film-grain.html?raw';
import progress from './partials/03-scroll-progress.html?raw';
import banner from './partials/04-seasonal-banner.html?raw';
import nav from './partials/05-nav.html?raw';
import mobileMenu from './partials/06-mobile-menu.html?raw';
import quiz from './partials/07-quiz-dialog-find-your-next-read.html?raw';
import hero from './partials/08-hero.html?raw';
import stats from './partials/09-stats.html?raw';
import showcase from './partials/10-sticky-feature-showcase.html?raw';
import moods from './partials/12-moods-interactive.html?raw';
import blindDate from './partials/13-blind-date-interactive-unwrap.html?raw';
import about from './partials/15-about-staff.html?raw';
import testimonials from './partials/16-testimonials-marquee.html?raw';
import events from './partials/17-events.html?raw';
import blog from './partials/18-blog.html?raw';
import newsletter from './partials/19-newsletter.html?raw';
import footer from './partials/20-footer.html?raw';

const APP_STYLE = {
  position: 'relative',
  minHeight: '100vh',
  background: 'var(--bg)',
  color: 'var(--ink)',
  overflowX: 'clip',
};

const CLOSED = { view: null, genre: 'All', admin: false, id: '' };

function parseRoute() {
  const h = (typeof window !== 'undefined' && window.location.hash) || '';
  if (h === '#admin') return { view: 'library', genre: 'All', admin: true, id: '' };
  if (h === '#library') return { view: 'library', genre: 'All', admin: false, id: '' };
  if (h.indexOf('#library/') === 0) return { view: 'library', genre: decodeURIComponent(h.slice(9)), admin: false, id: '' };
  if (h === '#signin') return { view: 'signin', genre: 'All', admin: false, id: '' };
  if (h === '#account') return { view: 'account', genre: 'All', admin: false, id: '' };
  if (h === '#message') return { view: 'message', genre: 'All', admin: false, id: '' };
  if (h === '#story') return { view: 'story', genre: 'All', admin: false, id: '' };
  if (h.indexOf('#post/') === 0) return { view: 'post', genre: 'All', admin: false, id: h.slice(6) };
  if (h.indexOf('#event/') === 0) return { view: 'event', genre: 'All', admin: false, id: h.slice(7) };
  if (h.indexOf('#book/') === 0) return { view: 'book', genre: 'All', admin: false, id: decodeURIComponent(h.slice(6)) };
  return CLOSED;
}

export default function App() {
  const rootRef = useRef(null);
  const [route, setRoute] = useState(CLOSED);
  const [emailLink, setEmailLink] = useState(null); // {mode:'verify'|'reset', token} from an email link

  // Email links land on real paths (/verify, /reset). Detect once after mount.
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/verify' || path === '/reset') {
      const params = new URLSearchParams(window.location.search);
      setEmailLink({ mode: path === '/verify' ? 'verify' : 'reset', token: params.get('token') || '' });
    }
  }, []);

  const closeEmailLink = () => {
    setEmailLink(null);
    const path = window.location.pathname;
    if (path === '/verify' || path === '/reset') history.replaceState(null, '', '/');
  };

  useEffect(() => {
    // Wire up theme, scroll effects, particles, reveals, counters, the quiz,
    // blind-date, mood matcher, magnetic CTAs, tilt and the load veil.
    initApp();
    return () => destroyApp();
  }, []);

  // Load server-backed state on boot in a single request (user, cart, wishlist,
  // reservations, books). Falls back to the per-store loaders if /bootstrap is
  // unavailable; if the API is unreachable the UI runs from its in-memory seed.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api.get('/bootstrap');
        if (!alive) return;
        account.hydrate(data.user || null);
        store.hydrate(data.cart || [], data.wishlist || []);
        if (Array.isArray(data.books)) library.hydrate(data.books);
        rsvp.hydrate(data.rsvps || []);
      } catch {
        if (!alive) return;
        try { await account.init(); } catch { /* offline: stays signed out */ }
        if (!alive) return;
        await Promise.all([store.init(), library.init(), rsvp.init()].map((p) => p.catch(() => {})));
      }
    })();
    return () => { alive = false; };
  }, []);

  // Overlays (Library, Admin, Sign in, blog reader, event detail, story) are
  // hash routes. Read after mount so first render matches the SSR shell.
  useEffect(() => {
    const apply = () => setRoute(parseRoute());
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  // Reflect auth state in the nav / mobile "Sign in" control.
  useEffect(() => {
    const apply = () => {
      const u = account.current();
      document.querySelectorAll('[data-signin]').forEach((el) => {
        el.textContent = u ? 'Hi, ' + (u.name.split(' ')[0] || 'there') : 'Sign in';
      });
    };
    apply();
    return account.subscribe(apply);
  }, []);

  const closeOverlay = () => {
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    setRoute(CLOSED);
  };

  return (
    <div id="app" data-theme="dark" ref={rootRef} style={APP_STYLE}>
      <Block html={veil} />
      <Block html={particles} />
      <Block html={grain} />
      <Block html={progress} />
      <Block html={banner} />
      <Block html={nav} />
      <Block html={mobileMenu} />
      <Block html={quiz} />

      <Block html={hero} />
      <Block html={stats} />
      <Block html={showcase} />
      <Categories />
      <Block html={moods} />
      <Block html={blindDate} />
      <Arrivals />
      <Block html={about} />
      <Block html={testimonials} />
      <Block html={events} />
      <Block html={blog} />
      <Block html={newsletter} />
      <Block html={footer} />

      <Library open={route.view === 'library'} genre={route.genre} adminOpen={route.admin} onClose={closeOverlay} />
      <AuthModal open={route.view === 'signin'} onClose={closeOverlay} />
      <AccountModal open={route.view === 'account'} onClose={closeOverlay} />
      <BookModal open={route.view === 'book'} id={route.id} onClose={closeOverlay} />
      <ContactModal open={route.view === 'message'} onClose={closeOverlay} />
      <ArticleReader open={route.view === 'post'} id={route.id} onClose={closeOverlay} />
      <EventModal open={route.view === 'event'} id={route.id} onClose={closeOverlay} />
      <StoryPage open={route.view === 'story'} onClose={closeOverlay} />
      {emailLink ? <VerifyResetView mode={emailLink.mode} token={emailLink.token} onClose={closeEmailLink} /> : null}
      <Toaster />
    </div>
  );
}
