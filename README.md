# Cupid — Coffee House &amp; Bookshop (React + Node)

The Cupid landing page, rebuilt as a **React** single-page app with a **Node**
(Express) server. Same site, same pixels, same interactions — now a real
component tree powered by Vite, with the production build served by Node.

## Quick start

```bash
npm install

# 1) Development (two terminals: API + Vite dev server)
npm run server         # Express API + database on http://localhost:3000
npm run dev            # Vite dev server on http://localhost:5173 (proxies /api to :3000)

# 2) Production (build, then serve the app AND the API from one Node process)
npm run build          # client build + SSR build + static pre-render -> dist/
npm start              # http://localhost:3000 (serves dist/ + the /api backend)
```

In development the Vite dev server proxies `/api` to the Express backend, so the
session cookie and the API are same-origin from the browser. In production a
single `npm start` serves the pre-rendered SPA and the API together. `npm run
preview` serves only the static build (no API).

```bash
# Quality gates
npm run lint           # ESLint (JS/JSX)
npm run typecheck      # tsc --noEmit over the typed modules
npm run test           # Vitest unit + component tests
npm run test:e2e       # Playwright (run `npx playwright install chromium` once)
npm run ci             # lint + typecheck + test + build
```

## Features

- **Cart + wishlist** with a slide-out drawer (quantities, totals, a mock
  checkout), persisted to `localStorage` through a small framework-agnostic
  store (`src/lib/store.ts`) with pub/sub. Badges and the drawer stay in sync
  via a subscription.
- **Search palette** (`src/lib/catalog.ts`) with live free-text search plus
  genre filtering over a tagged catalog.
- **Quiz with real recommendations** (`src/lib/recommend.ts`): all three answers
  (mood, pace, ending) feed a weighted scorer, not just mood.
- **Newsletter** with real email validation and success/error states.
- A small **mock JSON API** in `server.js` (`/api/books`, `/categories`,
  `/events`, `/posts`, `POST /newsletter`, `POST /rsvp`) as a backend scaffold.

## The Library page & admin

The "All books" / "View all books" controls (and each category card) open a
full-screen **Library** rather than just scrolling. It is a hash route owned by
React:

- `#library` - the whole shelf
- `#library/<genre>` - opened pre-filtered (category cards deep-link here)
- `#admin` - opens the Library straight onto the admin panel

The Library (`src/components/Library.jsx`) renders **genre filter chips** (All +
every genre present) and a free-text search over the shelf. It lives inside
`#app`, so its book cards carry the same `data-action="add-cart" / "wish"` hooks
and share the one cart + wishlist instance - the store is now a single exported
singleton (`src/lib/store.ts`) used by both the runtime and React, so badges and
the drawer stay in sync no matter where you add from.

**Admin add-book.** Reach it from the footer "Admin" link, the `#admin` URL, or
the Admin button in the Library header. The passphrase is **`cupid-admin`** (a
client-side demo gate defined at the top of `src/components/AdminPanel.jsx` - in
production this check would move behind a server endpoint + session). Once in,
the form captures every `Book` field - title, author, price, rating, genre
(with a datalist of known genres), roast, language tag, moods, pace, ending,
tasting notes, and a cover colour that drives a live cover preview. Submitting
adds the title to the front of the shelf; it appears in the grid instantly and
persists per-browser in `localStorage` under `cupid-library-v1`
(`src/lib/library.ts`, with a `subscribe()` so the grid re-renders on add).

## Accounts, blog, events & story

The rest of the site is wired the same way - hash routes backed by stores that
sync with the server, not dead links:

- **Sign in / accounts** (`src/lib/account.ts`, `AuthModal.jsx`, route
  `#signin`). Create an account, sign back in, and stay signed in across reloads
  via a real httpOnly session cookie. Passwords are salted and scrypt-hashed on
  the server (see the Backend section). The nav "Sign in" control switches to
  "Hi, <name>" while signed in, and the account panel shows your wishlist count
  and the events you have reserved. Wrong password and unknown email are
  rejected by the server.
- **Blog** (`src/lib/articles.js`, `ArticleReader.jsx`, route `#post/<id>`).
  Every "Read more" card opens the full article in a reader with previous / next
  navigation instead of scrolling back to the same section.
- **Events** (`src/lib/eventsData.js`, `EventModal.jsx`, route `#event/<id>`,
  `src/lib/rsvp.ts`). Each event opens a detail view with a real "Reserve a
  spot" that persists server-side; reservations show up in your account panel,
  and when you are signed in the confirmation names the email we would remind.
- **Our story** (`StoryPage.jsx`, route `#story`). The About section's "Read our
  story" opens the full history plus bios for each keeper.

All of these overlays render inside `#app`, default to closed (so the
pre-rendered shell and first client render match), and own their route via the
same `parseRoute` switch in `App.jsx` that drives the Library.

## Backend

The same Express process that serves the build is a full REST backend. It is
dependency-free beyond Express itself: sessions, password hashing, and the
database are all built on Node's `crypto` and `fs`, so there is no native module
to compile and nothing external to run.

### Commerce integrity, accounts & operations

A hardening wave layered on top of the base API. Highlights:

- **Cart price integrity.** Adding to the cart looks the title up in the
  canonical shelf and stores the server's price and the book `id`; a
  client-supplied price is ignored, an unknown title is rejected (404), and
  quantities are clamped to live stock and a per-line / per-bag cap.
- **Inventory.** Each book carries `stock`; checkout re-validates availability,
  decrements it, and returns 409 if a line outruns the shelf. Out-of-stock
  titles cannot be added.
- **Email verification & password reset.** Sign-up creates an unverified
  account and issues a verification token; `POST /api/auth/verify`,
  `/auth/resend-verification`, `/auth/forgot`, and `/auth/reset` complete the
  flows. A successful reset signs the account out everywhere.
- **Account management.** `POST /api/auth/change-password`, `/auth/change-email`
  (re-verifies), `POST /auth/logout-all`, and `DELETE /api/auth/account`
  (GDPR-style erasure: removes the user, their cart/wishlist/reservations,
  sessions, tokens, and newsletter entry, and detaches their orders).
- **Order history.** `GET /api/orders` returns the signed-in user's orders.
- **Newsletter double opt-in.** Subscribing sends a confirm link; `GET
  /api/newsletter/confirm` and `/api/newsletter/unsubscribe` (token-based)
  finish or reverse it, each with an unsubscribe link.
- **Expanded admin.** Admin sign-in is time-boxed (`CUPID_ADMIN_TTL_MS`, 2h
  default). Read endpoints: `/api/admin/orders`, `/admin/messages`,
  `/admin/subscribers`, `/admin/outbox`. Full CRUD for books (`PATCH
  /api/books/:id` edits price/stock/etc.), events, and articles.
- **Stronger passwords.** Minimum 8 characters, length-capped, with all-same and
  common-password rejection (`server/validate.js`, unit-tested).
- **Swappable mailer.** `server/mailer.js` records every message to an inspectable
  outbox by default; set `SMTP_URL` to plug in a real transport. No new
  dependency.
- **Database resilience.** A corrupt JSON file is moved aside
  (`.corrupt-<ts>`) and reseeded rather than silently overwritten; failed writes
  are logged, not swallowed; `db.maintenance()` prunes expired sessions and
  tokens on boot and hourly; `db.backup()` snapshots a `.bak` every six hours.
- **Operations.** Production HTTPS redirect (behind a proxy), a request log line
  per response, `GET /.well-known/security.txt`, a `/healthz` probe, and an
  `.env.example` for deployment (Vercel + Supabase). CI runs `npm audit`
  alongside lint, typecheck, tests, build, and Playwright.

See `.env.example` for every environment variable.



```
server/
  seed.js   the catalog, events, and articles the DB starts with
  db.js     a JSON-file database with atomic writes (temp file + rename)
  auth.js   scrypt password hashing, sessions, and the cookie middleware
  api.js    the REST router (every endpoint below)
server.js   wires it together + serves the built SPA
```

**Database.** `server/db.js` keeps the whole store in one JSON file
(`data/cupid.json`, override with `CUPID_DATA_DIR`). Reads are served from an
in-memory copy; every write is flushed to disk atomically by writing a temp file
and renaming it, so a crash mid-write cannot corrupt the data. On first run it
seeds the eight catalog books, four events, and three articles. This is a real
server-side datastore that is perfect at this scale; the data layer is small and
self-contained, so swapping in Postgres or SQLite later is a contained change.

**Auth.** Passwords are salted and hashed with scrypt and compared in constant
time (`hashPassword` / `verifyPassword`). Every visitor gets a session (an
unguessable 32-byte id) stored server-side and set as an httpOnly, SameSite=Lax
cookie, which is why you stay signed in across reloads. Signing in links your
session to your account and merges anything you did as a guest (cart, wishlist,
reservations) into it. Admin is a server-enforced flag on the session, unlocked
with a passphrase (`CUPID_ADMIN_PASS`, default `cupid-admin`); the add-book and
remove-book endpoints reject any request whose session is not admin.

**API.** Everything lives under `/api`:

| Area      | Endpoints |
| --------- | --------- |
| Auth      | `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Admin     | `GET /admin/status`, `POST /admin/login`, `POST /admin/logout` |
| Books     | `GET /books` (`?q=&genre=`), `GET /books/genres`, `POST /books` (admin), `DELETE /books/:id` (admin) |
| Cart      | `GET /cart`, `POST /cart`, `PATCH /cart`, `DELETE /cart/:title`, `POST /cart/checkout` |
| Wishlist  | `GET /wishlist`, `POST /wishlist` (toggle), `DELETE /wishlist/:title` |
| Events    | `GET /events`, `GET /events/:id`, `GET /rsvps`, `POST /rsvps` (toggle), `DELETE /rsvps/:id` |
| Articles  | `GET /articles`, `GET /articles/:id` |
| Misc      | `POST /newsletter`, `POST /contact` |

**How the front end talks to it.** `src/lib/api.js` is a tiny same-origin fetch
wrapper: the session cookie rides along automatically, and on any state-changing
request it echoes the CSRF token (read from the non-httpOnly `cupid_csrf` cookie)
back in an `X-CSRF-Token` header. Each store keeps a small in-memory cache so the
UI can read synchronously, then syncs with the server: the cart, wishlist, and
RSVP stores update optimistically and reconcile against the API response. On
boot, `App.jsx` makes a single `GET /api/bootstrap` request that returns who you
are plus your cart, wishlist, reservations, and the full shelf in one round trip
(it falls back to the per-store loaders if that endpoint is ever missing). Two
small touches keep the syncing honest: each cart/wishlist/RSVP write carries a
sequence number so a slow, out-of-order reply can never overwrite newer state,
and the quantity stepper debounces its PATCH so a burst of +/- clicks collapses
into one request while the UI updates on every click. If the API is ever
unreachable the UI still runs from its in-memory cache; it simply will not
persist. Static content (the landing catalog, event and article copy) is baked
into the pre-rendered HTML for a fast first paint, while everything stateful
(who you are, your cart and wishlist, your reservations, admin-added books)
comes from the server, so it survives reloads and is shared across devices.

**Hardening.** The credential endpoints (`/auth/signup`, `/auth/login`,
`/admin/login`) sit behind a per-IP rate limiter (`server/ratelimit.js`, a
sliding window, no dependencies) that returns `429` with a `Retry-After` header,
and the whole API sits behind a broader per-IP ceiling that runs before any
database work. State-changing requests must carry a CSRF token (a double-submit
token bound to the session, validated by `csrfProtection`); the session id and
token are rotated on sign in, sign up, and sign out to defeat session fixation
and to keep a signed-out session unlinkable to the authenticated one. The admin
passphrase is compared in constant time, and login returns one generic message
for both an unknown email and a wrong password (verifying against a dummy hash
either way) so neither the message nor the timing reveals whether an account
exists. Stored fields and the `/books` search query are length-capped, JSON
bodies are capped at 64KB, and every `/api` response is sent `Cache-Control:
no-store` so per-user data is never cached. A single JSON error handler turns
unexpected failures and the body-size rejection into a clean `{ error }` payload
rather than an HTML page with a stack trace. helmet sets a tuned CSP plus
`Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, and HSTS, and a
`Permissions-Policy` header denies powerful browser features the app never uses.
`SameSite=Lax` cookies mean a cross-site page cannot drive the mutating
endpoints with your session even before the CSRF check.

Configuration is via environment variables: `PORT` (default 3000),
`CUPID_DATA_DIR` (where the database file lives), `CUPID_ADMIN_PASS` (the admin
passphrase), `CUPID_AUTH_WINDOW_MS` / `CUPID_AUTH_MAX` (the auth rate-limit
window and cap, default 15 min / 50), `CUPID_API_MAX` (the broad per-IP API cap,
default 600 / 15 min), and `NODE_ENV=production` (marks the session cookie
`Secure` for HTTPS deploys).

## Accessibility

Skip-to-content link, a polite `aria-live` region for cart/wishlist/quiz/mood
announcements, focus trapping with focus restoration on every modal surface
(quiz, mobile menu, cart drawer, search), `aria-expanded` / `aria-haspopup` on
popup triggers, and `aria-pressed` on wishlist toggles. All icons are
`aria-hidden`; there are no `<img>` tags.

## SEO & PWA

`index.html` ships canonical, OpenGraph, and Twitter tags, light/dark
`theme-color`, a `CafeOrCoffeeShop` JSON-LD block, and a web manifest. `public/`
holds `favicon.svg`, `manifest.webmanifest`, `robots.txt`, `sitemap.xml`, and a
branded `og.svg`.

The build also **statically pre-renders** the page: `npm run build` does a
client build, an SSR build of `src/entry-server.jsx`, then `prerender.js`
renders `<App/>` to HTML and injects it into `dist/index.html`. The served page
is therefore content-complete (crawlers, link unfurlers, and no-JS all get the
real markup) and the client `hydrateRoot`s it. The dev server still ships an
empty `#root` and mounts fresh via `createRoot`. (Because the partials are
hand-authored HTML whose serialization will not byte-match the browser's parse,
the pre-render step strips the stray JSX-formatting whitespace nodes the client
build drops, so hydration is clean.)

## Testing & tooling

ESLint (flat config) + Prettier, a `tsconfig` that type-checks the typed
`.ts` modules (the existing `.jsx` stays JS), Vitest + React Testing Library for
unit/component tests, Playwright specs for the end-to-end flows, and a GitHub
Actions workflow running the whole gate.

## Not done yet

This wave hardened the **backend and operations** (commerce integrity,
inventory, accounts, email-verification/reset, order history, newsletter
double-opt-in, expanded admin, DB resilience, CI). What remains:

**Front-end UI for the new flows.** The endpoints exist and are tested, but the
account-management screen, the email-verify / password-reset pages, the
order-history view, the admin CRUD screens for events and articles, and inline
error toasts / loading states (replacing the current silent `.catch`) are the
next wave.

**Larger front-end work.** Full i18n with translated copy, `Intl` currency/date
formatting, and RTL/Arabic; code-splitting the overlays and self-hosting fonts;
a service worker for offline; Web Vitals reporting; a cookie-consent banner plus
privacy/terms pages; a deeper accessibility pass (contrast audit, skip link,
labelled auth inputs, forced-colors); per-item routes (`/events/:id`) with
per-item structured data, replacing the hash-router overlays; and a full
hooks/JSX rewrite of every partial (which would let StrictMode be re-enabled).

**Needs external infrastructure** (scaffolding and swap-points are in place, but
they cannot be provisioned in a sandbox): live Stripe payments, a real SMTP /
email provider (set `SMTP_URL`), a managed database in place of the JSON file
(the data layer is isolated for the swap), error telemetry (Sentry), and a
Redis-backed rate-limiter / session store for horizontal scaling.

CSRF protection, session rotation, rate limiting, the security headers, the
single-bootstrap load, and the optimistic-update stale-response guards are
already in place (see the Backend and Performance sections).


## How it's put together

```
index.html              Vite entry (loads Google Fonts + /src/main.jsx)
server.js               Node/Express: serves dist/ + the /api backend
vite.config.js          Vite + @vitejs/plugin-react (dev /api proxy)
server/
  seed.js               Catalog / events / articles the database seeds with
  db.js                 JSON-file database with atomic writes
  auth.js               scrypt hashing, sessions, cookie middleware
  ratelimit.js          Per-IP sliding-window rate limiter
  api.js                The REST router (auth, books, cart, wishlist, ...)
src/
  main.jsx              ReactDOM root
  App.jsx               Composes the sections inside #app; loads server state
  styles.css            The full design system (tokens, keyframes, rules)
  lib/
    runtime.js          Interaction layer (theme, scroll, particles, reveals,
                        counters, quiz, blind-date, mood matcher, magnetic,
                        tilt, load veil). Exposed as initApp()/destroyApp().
    api.js              Same-origin fetch wrapper for the backend
    account.ts          Auth store (cached user + sign up / in / out)
    store.ts            Cart + wishlist store (optimistic, server-synced)
    library.ts          Shelf store (catalog + admin books, server-synced)
    rsvp.ts             Reservation store (server-synced)
    data.js             Content for the data-driven sections
    icons.jsx           Hand-drawn line-icon set + <Svg/> renderer
    css.js              Inline-CSS-string -> React style-object helper
  components/
    Block.jsx           Renders a trusted section partial (display:contents)
    Categories.jsx      Real data-driven React component (from data.js)
    Arrivals.jsx        Real data-driven React component (from data.js)
    Library.jsx         Full-screen shelf overlay + AdminPanel
    AuthModal.jsx       Sign in / create account / account panel
    ArticleReader.jsx   Full blog article reader
    EventModal.jsx      Event detail + RSVP
    StoryPage.jsx       The full "Our story" page
  partials/             Per-section HTML for the bespoke sections
```

### The component tree

`App.jsx` renders everything inside a single `#app` root, in order: the fixed
layers (load veil, particles, film grain, scroll progress), the chrome (banner,
nav, mobile menu, quiz dialog), and then the page sections (hero, stats, feature
showcase, categories, mood matcher, blind date, new arrivals, about,
testimonials, events, blog, newsletter, footer).

### Two kinds of section

- **Data-driven components** — `Categories` and `Arrivals` are written as real
  JSX that maps over `src/lib/data.js`, using the `css()` helper to keep the
  original inline styles and `<Svg/>` for icons. This is the pattern to follow
  when converting more sections.
- **Trusted partials** — the heavily bespoke sections (hero, the sticky feature
  showcase, quiz, blind date, footer, etc.) render their proven markup through
  `<Block html={…} />`. The wrapper uses `display:contents`, so the partial's
  own root element is the effective child of `#app` and the original layout and
  CSS selectors are preserved exactly.

### The interaction layer

All behavior lives in `src/lib/runtime.js`. `App.jsx` calls `initApp()` from a
mount `useEffect` and `destroyApp()` on unmount. The runtime queries the
rendered DOM (`#app`), so it drives both the partial-rendered sections and the
data-driven components identically — theme persistence, the scroll-driven
feature showcase, the animated counters and reveals, the ambient particles, the
three-question quiz, the blind-date unwrap, the mood matcher, magnetic buttons,
card tilt, and the page-load veil.

> StrictMode is intentionally omitted in `main.jsx`: the runtime is imperative
> (scroll/observer listeners), and StrictMode's dev double-invoke would attach
> it twice. `initApp()` is idempotent regardless.

## Converting another section to pure JSX

1. Add its content to `src/lib/data.js`.
2. Write a component under `src/components/` that maps the data to JSX — reuse
   `css()` for styles and `<Svg html={icon(name, …)} />` for icons, and keep the
   original `data-*` attributes and classes so the shared CSS and the runtime
   keep working.
3. Swap the `<Block html={…} />` for your new component in `App.jsx` and remove
   the now-unused partial. `Categories.jsx` and `Arrivals.jsx` are worked
   examples.

## Performance

The app is tuned to paint fast and stay light:

- **Non-blocking fonts.** The Google Fonts stylesheet is loaded via
  `rel="preload" ... onload` (with a `<noscript>` fallback), so the first paint
  happens immediately on the system fallback stack and the web fonts swap in
  when ready (`display=swap`). Unused Fraunces italics were trimmed from the
  request.
- **Cached vendor chunk.** React/ReactDOM are split into a separate
  `react-vendor` chunk so shipping an app change doesn't bust the framework
  cache on repeat visits.
- **Deferred non-critical work.** Theme, reveals, scroll effects and the
  interactions wire up immediately; the purely decorative ambient particles and
  the stat counters are set up in `requestIdleCallback` so they never block the
  initial render.
- **Long-cache headers.** `server.js` serves hashed assets with
  `immutable, max-age=1y` and never caches the HTML shell.
- No images to download — every graphic is inline SVG or pure CSS.

### Render-time tuning (60fps)

The first pass above made the page load fast; a second pass made it *animate*
fast. Measured frame timing (idle / scroll / mouse-move) went from ~38/57/74ms
per frame with ~91% janky frames down to ~17/20/24ms, with idle a flat 0% jank.
The fixes, in rough order of impact:

- **No blend modes.** The full-screen film-grain overlay used
  `mix-blend-mode: soft-light`, which forces the browser to re-blend the entire
  viewport every frame anything moves behind it - the single biggest idle cost.
  That, plus the hero spotlight (`screen`) and card glare (`soft-light`), were
  converted to plain low-opacity overlays.
- **No `backdrop-filter`.** Every `blur()` panel (nav, badges, drawer, search)
  was swapped for an opaque/translucent background. Blur is re-rasterized
  continuously; the solid fills composite for free.
- **No layout reads on scroll.** The scroll handler used to call
  `getBoundingClientRect()` per parallax element *per frame* (layout thrashing).
  All geometry is now measured once (and on resize) via the offset chain, so the
  per-frame path only writes transforms.
- **Compositor-only effects.** The hero spotlight is a fixed-size radial moved
  with `transform: translate()` instead of repainting a gradient; particles were
  halved (24 -> 14) and each gets `will-change: transform`; the cursor tilt is
  `requestAnimationFrame`-throttled with its rect cached on enter.
- **No continuous main-thread paints.** Dropped the `filter: drop-shadow`
  keyframe on the nav heart and the `background-position` keyframe on the scroll
  progress bar; both repainted every frame for the life of the page.
- **`content-visibility`** on the far-down sections so they aren't rendered until
  near the viewport (kept off mid-page sections and the sticky showcase to avoid
  reveal-spikes / breaking `position: sticky`).

Note: the sandbox these numbers came from is software-rendered (no GPU), which
inflates the cost of composited transforms; on real hardware the mouse/scroll
paths are smoother still.

## Motion

On top of the original animation system (scroll-driven feature showcase,
reveals, counters, marquee, magnetic CTAs, the load veil) the React build adds:

- a **hero cursor spotlight** that follows the pointer,
- **3D tilt with a specular glare** that tracks the cursor on book covers,
- **sheen sweeps** across cards and a **shine** across primary buttons on hover,
- an **accent glow** on card hover and a **living gradient** on the scroll bar.

All pointer-driven effects are gated behind `hover: hover` and disabled under
`prefers-reduced-motion: reduce`.



- The only external dependency at runtime is Google Fonts (Fraunces, Hanken
  Grotesk, JetBrains Mono, Caveat), loaded in `index.html`.
- No browser storage beyond `localStorage` for the light/dark theme preference.
