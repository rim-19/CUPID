/* Node/Express server for Cupid - now a real backend.
   Build the front end first (`npm run build`), then `npm start`.

   Provides: gzip compression, security headers (helmet/CSP), cookie-based
   sessions, a JSON-file database, a full REST API under /api (auth, books,
   admin, cart, wishlist, events, RSVP, articles, newsletter, contact), static
   serving of the built SPA with an SSG-aware fallback, and graceful shutdown. */
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import prisma from './server/prisma.js';
import { sessionMiddleware, csrfProtection } from './server/auth.js';
import { rateLimit } from './server/ratelimit.js';
import apiRouter, { stripeWebhook } from './server/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 3000;

// Prune expired sessions / tokens and cap the outbox. Cheap; runs on boot and
// on an interval so the store does not grow without bound.
async function maintenance() {
  const now = new Date();
  await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await prisma.verificationToken.deleteMany({ where: { expiresAt: { lt: now } } });
  const excess = (await prisma.outboxEmail.count()) - 200;
  if (excess > 0) {
    const old = await prisma.outboxEmail.findMany({ orderBy: { sentAt: 'asc' }, take: excess, select: { id: true } });
    await prisma.outboxEmail.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  }
}

if (process.env.NODE_ENV !== 'test') {
  maintenance().catch((e) => console.error('[maintenance] failed:', e.message));
  setInterval(() => maintenance().catch((e) => console.error('[maintenance] failed:', e.message)), 60 * 60 * 1000).unref();
}

const app = express();
app.disable('x-powered-by');
// Number of proxy hops in front of the app (affects the client IP the rate
// limiter keys on). Match this to your deployment; default assumes one proxy.
app.set('trust proxy', Number.isFinite(Number(process.env.TRUST_PROXY)) ? Number(process.env.TRUST_PROXY) : 1);

if (process.env.NODE_ENV === 'production' && process.env.COOKIE_INSECURE === '1') {
  console.warn('[warn] COOKIE_INSECURE=1 in production: session cookies will NOT have the Secure flag.');
}

// Force HTTPS in production. The redirect target uses a configured canonical
// host when set, rather than the client-supplied Host header (open-redirect /
// Host-injection safe); it falls back to the request host otherwise.
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    const host = process.env.CANONICAL_HOST || req.headers.host;
    return res.redirect(308, 'https://' + host + req.originalUrl);
  }
  next();
});

// Lightweight request log (method, path, status, duration). Quiet in tests.
// Token query params are redacted so secrets never reach the logs.
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const url = (req.originalUrl || '').replace(/([?&]token=)[^&]+/gi, '$1[redacted]');
      console.log(`${req.method} ${url} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });
}

// Stripe webhook needs the raw, unparsed body to verify its signature, so it is
// mounted before the JSON parser and outside the /api session/CSRF chain.
app.post('/api/stripe/webhook', express.raw({ type: '*/*' }), stripeWebhook);

app.use(express.json({ limit: '64kb' }));
// The email-link newsletter pages submit a plain HTML form (urlencoded).
app.use(express.urlencoded({ extended: false, limit: '16kb' }));
app.use(compression());

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'script-src-attr': ["'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
        'base-uri': ["'self'"],
        'object-src': ["'none'"],
        'frame-ancestors': ["'self'"],
        'upgrade-insecure-requests': null,
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: false,
  })
);

/* Permissions-Policy is not set by helmet; deny powerful features we never use. */
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()');
  next();
});

/* A broad per-IP ceiling for the whole API, sitting under the much stricter
   per-endpoint auth limiter. It runs before sessions so a flood is turned away
   before any database work happens. */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.CUPID_API_MAX) || 600,
  message: 'Too many requests. Please slow down and try again shortly.',
});

/* ---------- health ---------- */
// Liveness: is the process up? (Must not depend on the DB, or a DB blip would
// cause orchestrators to needlessly restart a healthy app.)
app.get('/healthz', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
// Readiness: can we actually serve traffic? Pings the database.
app.get('/readyz', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});

/* ---------- security disclosure ---------- */
app.get('/.well-known/security.txt', (_req, res) => {
  const contact = process.env.SECURITY_CONTACT || 'mailto:security@cupid.local';
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  res
    .type('text/plain')
    .send(`Contact: ${contact}\nPreferred-Languages: en\nPolicy: /privacy\nExpires: ${expires}\n`);
});

/* ---------- REST API (rate limit -> no-store -> sessions -> CSRF -> router) ---------- */
app.use('/api', apiLimiter);
app.use('/api', (_req, res, next) => {
  // Responses carry per-user data (account, cart, wishlist); never cache them.
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use('/api', sessionMiddleware);
app.use('/api', csrfProtection);
app.use('/api', apiRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

/* ---------- static build ---------- */
app.use(
  express.static(DIST, {
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  })
);

/* ---------- SPA fallback ---------- */
app.get('*', (_req, res) => {
  const index = path.join(DIST, 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res
    .status(200)
    .type('text/plain')
    .send('Cupid API is running. Build the front end with `npm run build` to serve the app here, or use the Vite dev server (npm run dev) which proxies /api to this server.');
});

/* ---------- error handler (clean JSON, never leaks a stack) ---------- */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  // File uploads (multer): surface a clear size/upload error rather than a 500.
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'That file is too large (50 MB maximum).' });
  if (err.name === 'MulterError') return res.status(400).json({ error: 'That file could not be uploaded.' });
  const status = err.status || err.statusCode || 500;
  let message = 'Something went wrong.';
  if (status === 413) message = 'Request body is too large.';
  else if (err.type === 'entity.parse.failed') message = 'Invalid JSON body.';
  else if (status < 500) message = err.message || 'Bad request.';
  res.status(status).json({ error: message });
});

const server = app.listen(PORT, () => {
  console.log(`Cupid is pouring at http://localhost:${PORT}`);
});

/* ---------- graceful shutdown ---------- */
function shutdown(signal) {
  console.log(`\n${signal} received, closing server...`);
  server.close(async () => {
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
['SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, () => shutdown(sig)));
