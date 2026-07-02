'use strict';

import express from 'express';
import crypto from 'node:crypto';
import multer from 'multer';
import prisma from './prisma.js';
import * as auth from './auth.js';
import * as mailer from './mailer.js';
import * as storage from './storage.js';
import { rateLimit } from './ratelimit.js';
import { validatePassword, isEmail } from './validate.js';
import { isPasswordPwned } from './pwned.js';

const router = express.Router();

/* True for a Prisma unique-constraint violation - used to make read-then-write
   toggles idempotent under a rare double-submit race. */
const isDup = (e) => e && e.code === 'P2002';

/* Ebook uploads: held in memory, capped, then streamed to object storage. */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const FORMAT_BY_EXT = { pdf: 'PDF', epub: 'EPUB', mobi: 'MOBI' };
const CONTENT_TYPE = { PDF: 'application/pdf', EPUB: 'application/epub+zip', MOBI: 'application/x-mobipocket-ebook' };
const DOWNLOAD_MAX = Number(process.env.CUPID_DOWNLOAD_MAX) || 5;
const DOWNLOAD_TTL_MS = Number(process.env.CUPID_DOWNLOAD_TTL_MS) || 30 * 24 * 60 * 60 * 1000; // 30 days

/* Wrap async handlers so a rejected promise reaches Express' error handler
   instead of hanging the request. */
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* Throttle credential endpoints per IP to blunt brute-force / stuffing. */
const authLimiter = rateLimit({
  windowMs: Number(process.env.CUPID_AUTH_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.CUPID_AUTH_MAX) || 50,
  message: 'Too many attempts. Please wait a few minutes and try again.',
});

const TOKEN_TTL = { VERIFY: 24 * 60 * 60 * 1000, RESET: 60 * 60 * 1000 };
const CART_LINE_CAP = 50;
const QTY_CAP = 99;

const genToken = () => crypto.randomBytes(24).toString('hex');
const clamp = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const esc = (s) =>
  String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Record a privileged action. Never allowed to throw: auditing must not break
   the operation it is describing. */
async function audit(req, action, target, detail) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req.user ? req.user.id : null,
        actorEmail: req.user ? req.user.email : 'unknown',
        action,
        target: target || null,
        detail: detail ? String(detail).slice(0, 200) : null,
      },
    });
  } catch {
    /* swallow */
  }
}

/* Verify against this constant hash when an email is unknown so login timing
   does not reveal whether the account exists. */
const DUMMY_HASH = (() => {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(crypto.randomBytes(16).toString('hex'), salt, 64).toString('hex');
})();

/* ----- money ----- */
const PRICE_RE = /^\$?\d{1,6}(\.\d{1,2})?$/;
function priceToCents(input, fallbackCents = 0) {
  const v = String(input == null ? '' : input).trim();
  if (!PRICE_RE.test(v)) return fallbackCents;
  return Math.round((Number(v.replace(/[^0-9.]/g, '')) || 0) * 100);
}
function centsToPrice(cents) {
  const n = (Number(cents) || 0) / 100;
  return '$' + (Number.isInteger(n) ? String(n) : n.toFixed(2));
}

/* ----- enum <-> display mappings (keep the public API shape stable) ----- */
const ROAST_IN = { Light: 'LIGHT', Med: 'MED', Dark: 'DARK' };
const ROAST_OUT = { LIGHT: 'Light', MED: 'Med', DARK: 'Dark' };
const PACE_OUT = { SLOW: 'slow', MEDIUM: 'medium', FAST: 'fast' };
const ENDING_OUT = { HOPEFUL: 'hopeful', BITTERSWEET: 'bittersweet', OPEN: 'open' };

function slugify(input, fallback) {
  const s = String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || fallback;
}

/* ----- serializers (Prisma row -> the shape the front end expects) ----- */
function publicBook(b) {
  if (!b) return null;
  return {
    id: b.id,
    title: b.title,
    author: b.author,
    rating: String(b.ratingAvg),
    price: centsToPrice(b.priceCents),
    priceCents: b.priceCents,
    tint: b.coverTint,
    lang: b.language,
    roast: ROAST_OUT[b.roast] || 'Med',
    notes: b.notes,
    genre: b.genre,
    mood: b.mood,
    pace: PACE_OUT[b.pace] || 'medium',
    ending: ENDING_OUT[b.ending] || 'open',
    summary: b.summary,
    pages: b.pages,
    year: b.year,
    reviews: b.reviewCount,
    stock: b.stock,
    custom: b.custom,
    digitalGift: b.digitalGift,
  };
}

function publicEvent(e) {
  if (!e) return null;
  return {
    id: e.id,
    month: e.month,
    day: e.day,
    icon: e.icon,
    type: e.type,
    title: e.title,
    time: e.time,
    place: e.place,
    spots: e.spots,
    desc: e.desc,
  };
}

function publicArticle(a) {
  if (!a) return null;
  return {
    id: a.id,
    cat: a.cat,
    date: a.date,
    read: a.readTime,
    icon: a.icon,
    tint: a.tint,
    title: a.title,
    excerpt: a.excerpt,
    body: a.body,
  };
}

function cartLines(cart) {
  return (cart.items || []).map((it) => ({
    title: it.book.title,
    price: centsToPrice(it.book.priceCents),
    bookId: it.bookId,
    qty: it.qty,
  }));
}

function publicOrder(o) {
  return {
    id: o.id,
    items: (o.items || []).map((i) => ({ title: i.titleSnapshot, price: centsToPrice(i.unitPriceCents), qty: i.qty })),
    total: (o.totalCents || 0) / 100,
    status: o.status,
    createdAt: o.createdAt.getTime(),
  };
}

/* ----- tokens (email verification, password reset) ----- */
async function issueToken(type, user) {
  const raw = genToken();
  await prisma.verificationToken.deleteMany({ where: { userId: user.id, type } });
  await prisma.verificationToken.create({
    data: { tokenHash: hashToken(raw), type, userId: user.id, email: user.email, expiresAt: new Date(Date.now() + TOKEN_TTL[type]) },
  });
  return raw;
}
async function takeToken(rawToken, type) {
  const t = await prisma.verificationToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!t || t.type !== type || t.expiresAt < new Date()) return null;
  await prisma.verificationToken.delete({ where: { id: t.id } }).catch(() => {});
  return t;
}

/* ----- carts ----- */
async function getCart(req) {
  const where = auth.ownerWhere(req);
  const include = { items: { include: { book: true } } };
  const cart = await prisma.cart.findFirst({ where, include });
  if (cart) return cart;
  try {
    return await prisma.cart.create({ data: where, include });
  } catch (e) {
    // A concurrent first request may have created it; fetch that one.
    if (!isDup(e)) throw e;
    return prisma.cart.findFirst({ where, include });
  }
}

/* Merge an anonymous session's cart / wishlist / rsvps into a user on sign-in. */
async function mergeGuestInto(sessionId, userId) {
  const guestCart = await prisma.cart.findUnique({ where: { sessionId }, include: { items: true } });
  if (guestCart && guestCart.items.length) {
    const userCart = await prisma.cart.upsert({ where: { userId }, create: { userId }, update: {} });
    for (const gi of guestCart.items) {
      const existing = await prisma.cartItem.findUnique({ where: { cartId_bookId: { cartId: userCart.id, bookId: gi.bookId } } });
      if (existing) {
        await prisma.cartItem.update({ where: { id: existing.id }, data: { qty: Math.min(QTY_CAP, existing.qty + gi.qty) } });
      } else {
        const count = await prisma.cartItem.count({ where: { cartId: userCart.id } });
        if (count < CART_LINE_CAP) {
          await prisma.cartItem.create({ data: { cartId: userCart.id, bookId: gi.bookId, qty: Math.min(QTY_CAP, gi.qty) } });
        }
      }
    }
  }
  if (guestCart) await prisma.cart.delete({ where: { id: guestCart.id } }).catch(() => {});

  const gWish = await prisma.wishlistItem.findMany({ where: { sessionId } });
  for (const w of gWish) {
    const has = await prisma.wishlistItem.findFirst({ where: { userId, bookId: w.bookId } });
    if (!has) await prisma.wishlistItem.create({ data: { userId, bookId: w.bookId } });
  }
  await prisma.wishlistItem.deleteMany({ where: { sessionId } });

  const gR = await prisma.rsvp.findMany({ where: { sessionId } });
  for (const r of gR) {
    const has = await prisma.rsvp.findFirst({ where: { userId, eventId: r.eventId } });
    if (!has) await prisma.rsvp.create({ data: { userId, eventId: r.eventId } });
  }
  await prisma.rsvp.deleteMany({ where: { sessionId } });
}

function htmlPage(title, body) {
  const t = esc(title);
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t}</title>
<body style="margin:0;font-family:system-ui,sans-serif;background:#1a120b;color:#f5ede1;display:grid;place-items:center;min-height:100vh">
<main style="text-align:center;padding:2rem;max-width:34rem">
<h1 style="font-weight:600;color:#e8859a">${t}</h1><p style="opacity:.8;line-height:1.6">${body}</p>
<p><a href="/" style="color:#e8859a">Back to Cupid</a></p></main></body>`;
}

/* ============================== AUTH ============================== */
router.post('/auth/signup', authLimiter, ah(async (req, res) => {
  const name = clamp(req.body.name, 80);
  const email = clamp(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || '');
  if (!name) return res.status(400).json({ error: 'Please tell us your name.' });
  if (!isEmail(email)) return res.status(400).json({ error: 'That email does not look right.' });
  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });
  if (await isPasswordPwned(password)) return res.status(400).json({ error: 'That password has appeared in a known data breach. Please choose another.' });

  if (await prisma.user.findUnique({ where: { email } })) {
    return res.status(409).json({ error: 'An account already exists for that email.' });
  }
  const user = await prisma.user.create({
    data: { name, email, passwordHash: await auth.hashPassword(password), emailVerified: false },
  });
  await mergeGuestInto(req.session.id, user.id);
  const token = await issueToken('VERIFY', user);
  await mailer.verificationEmail(email, token);
  await auth.rotateSession(req, res, user.id);
  req.user = user;
  res.json({ user: auth.publicUser(user) });
}));

router.post('/auth/login', authLimiter, ah(async (req, res) => {
  const email = clamp(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || '');
  const user = await prisma.user.findUnique({ where: { email } });
  // If locked, still do the scrypt work (steady timing) and return the SAME
  // generic error as a wrong password, so the lock state can't be used to probe
  // which emails have accounts. The per-IP limiter is what stops the flood.
  if (auth.isLocked(user)) {
    await auth.verifyPassword(password, DUMMY_HASH);
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  const ok = await auth.verifyPassword(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) {
    if (user) await auth.registerFailedLogin(user.id);
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  await auth.clearFailedLogins(user.id);
  await mergeGuestInto(req.session.id, user.id);
  await auth.rotateSession(req, res, user.id);
  req.user = user;
  res.json({ user: auth.publicUser(user) });
}));

router.post('/auth/logout', ah(async (req, res) => {
  await auth.rotateSession(req, res, null);
  req.user = null;
  res.json({ ok: true });
}));

router.get('/auth/me', (req, res) => {
  res.json({ user: auth.publicUser(req.user) });
});

router.post('/auth/verify', ah(async (req, res) => {
  const t = await takeToken(String(req.body.token || ''), 'VERIFY');
  if (!t) return res.status(400).json({ error: 'That confirmation link is invalid or has expired.' });
  await prisma.user.update({ where: { id: t.userId }, data: { emailVerified: true } }).catch(() => {});
  if (req.user && req.user.id === t.userId) req.user.emailVerified = true;
  res.json({ ok: true, user: auth.publicUser(req.user) });
}));

router.post('/auth/resend-verification', authLimiter, auth.requireAuth, ah(async (req, res) => {
  if (!req.user.emailVerified) {
    const token = await issueToken('VERIFY', req.user);
    await mailer.verificationEmail(req.user.email, token);
  }
  res.json({ ok: true });
}));

router.post('/auth/forgot', authLimiter, ah(async (req, res) => {
  const email = clamp(req.body.email, 160).toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = await issueToken('RESET', user);
    await mailer.resetEmail(email, token);
  }
  // Always generic so the endpoint cannot be used to probe for accounts.
  res.json({ ok: true });
}));

router.post('/auth/reset', authLimiter, ah(async (req, res) => {
  const token = String(req.body.token || '');
  const password = String(req.body.password || '');
  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });
  if (await isPasswordPwned(password)) return res.status(400).json({ error: 'That password has appeared in a known data breach. Please choose another.' });
  const t = await takeToken(token, 'RESET');
  if (!t) return res.status(400).json({ error: 'That reset link is invalid or has expired.' });
  await prisma.user.update({
    where: { id: t.userId },
    data: { passwordHash: await auth.hashPassword(password), emailVerified: true, failedLoginCount: 0, lockedUntil: null },
  });
  await prisma.session.deleteMany({ where: { userId: t.userId } }); // sign out everywhere
  res.json({ ok: true });
}));

router.post('/auth/change-password', authLimiter, auth.requireAuth, ah(async (req, res) => {
  const current = String(req.body.currentPassword || '');
  const next = String(req.body.newPassword || '');
  if (!(await auth.verifyPassword(current, req.user.passwordHash))) {
    return res.status(401).json({ error: 'Your current password is incorrect.' });
  }
  const pwErr = validatePassword(next);
  if (pwErr) return res.status(400).json({ error: pwErr });
  if (await isPasswordPwned(next)) return res.status(400).json({ error: 'That password has appeared in a known data breach. Please choose another.' });
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: await auth.hashPassword(next) } });
  await auth.rotateSession(req, res, req.user.id);
  res.json({ ok: true });
}));

router.post('/auth/change-email', authLimiter, auth.requireAuth, ah(async (req, res) => {
  const password = String(req.body.password || '');
  const email = clamp(req.body.email, 160).toLowerCase();
  if (!(await auth.verifyPassword(password, req.user.passwordHash))) {
    return res.status(401).json({ error: 'Your password is incorrect.' });
  }
  if (!isEmail(email)) return res.status(400).json({ error: 'That email does not look right.' });
  const clash = await prisma.user.findUnique({ where: { email } });
  if (clash && clash.id !== req.user.id) return res.status(409).json({ error: 'That email is already in use.' });
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { email, emailVerified: false } });
  const token = await issueToken('VERIFY', user);
  await mailer.verificationEmail(email, token);
  req.user = user;
  res.json({ user: auth.publicUser(user) });
}));

router.delete('/auth/account', authLimiter, auth.requireAuth, ah(async (req, res) => {
  const password = String(req.body.password || '');
  if (!(await auth.verifyPassword(password, req.user.passwordHash))) {
    return res.status(401).json({ error: 'Your password is incorrect.' });
  }
  const email = req.user.email;
  // Order.userId / DownloadGrant.userId are SetNull; everything else cascades.
  await prisma.user.delete({ where: { id: req.user.id } });
  await prisma.newsletterSubscriber.deleteMany({ where: { email } });
  await auth.rotateSession(req, res, null);
  req.user = null;
  res.json({ ok: true });
}));

router.post('/auth/logout-all', auth.requireAuth, ah(async (req, res) => {
  await prisma.session.deleteMany({ where: { userId: req.user.id, id: { not: req.session.id } } });
  res.json({ ok: true });
}));

/* One round trip on page load. */
router.get('/bootstrap', ah(async (req, res) => {
  const [books, cart, wishItems, rsvpRows] = await Promise.all([
    prisma.book.findMany({ where: { active: true }, orderBy: { createdAt: 'asc' } }),
    getCart(req),
    prisma.wishlistItem.findMany({ where: auth.ownerWhere(req), include: { book: true } }),
    prisma.rsvp.findMany({ where: auth.ownerWhere(req) }),
  ]);
  res.json({
    user: auth.publicUser(req.user),
    admin: Boolean(req.user && req.user.role === 'ADMIN'),
    csrf: req.session.csrf,
    books: books.map(publicBook),
    cart: cartLines(cart),
    wishlist: wishItems.map((w) => w.book.title),
    rsvps: rsvpRows.map((r) => r.eventId),
  });
}));

/* ============================== ADMIN ============================== */
/* Admin is now a role on the signed-in user; there is no shared passphrase. */
router.get('/admin/status', (req, res) => {
  res.json({ admin: Boolean(req.user && req.user.role === 'ADMIN') });
});
router.get('/admin/orders', auth.requireAdmin, ah(async (_req, res) => {
  const orders = await prisma.order.findMany({ include: { items: true }, orderBy: { createdAt: 'desc' } });
  res.json({ orders: orders.map(publicOrder) });
}));

const ORDER_STATUSES = new Set(['PENDING', 'PAID', 'FULFILLED', 'SHIPPED', 'CANCELLED', 'REFUNDED']);
router.patch('/admin/orders/:id', auth.requireAdmin, ah(async (req, res) => {
  const status = String(req.body.status || '').toUpperCase();
  if (!ORDER_STATUSES.has(status)) return res.status(400).json({ error: 'Unknown order status.' });
  const exists = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: 'Order not found.' });
  const order = await prisma.order.update({ where: { id: req.params.id }, data: { status }, include: { items: true } });
  await audit(req, 'order.status', order.id, status);
  res.json({ order: publicOrder(order) });
}));
router.get('/admin/messages', auth.requireAdmin, ah(async (_req, res) => {
  res.json({ messages: await prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' } }) });
}));
router.get('/admin/subscribers', auth.requireAdmin, ah(async (_req, res) => {
  res.json({ subscribers: await prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: 'asc' } }) });
}));
router.get('/admin/outbox', auth.requireAdmin, ah(async (_req, res) => {
  res.json({ outbox: await prisma.outboxEmail.findMany({ orderBy: { sentAt: 'desc' } }) });
}));
router.get('/admin/audit', auth.requireAdmin, ah(async (_req, res) => {
  res.json({ audit: await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }) });
}));

/* ============================== BOOKS ============================== */
router.get('/books', ah(async (req, res) => {
  const q = clamp(req.query.q, 100);
  const genre = clamp(req.query.genre, 40);
  const where = { active: true };
  if (genre && genre !== 'All') where.genre = genre;
  if (q) {
    where.OR = ['title', 'author', 'notes', 'genre'].map((f) => ({ [f]: { contains: q, mode: 'insensitive' } }));
  }
  const books = await prisma.book.findMany({ where, orderBy: { createdAt: 'asc' } });
  res.json({ books: books.map(publicBook) });
}));

router.get('/books/genres', ah(async (_req, res) => {
  const rows = await prisma.book.findMany({ where: { active: true }, select: { genre: true }, distinct: ['genre'] });
  res.json({ genres: rows.map((r) => r.genre).filter(Boolean) });
}));

router.get('/books/:id', ah(async (req, res) => {
  const book = await prisma.book.findUnique({ where: { id: req.params.id } });
  if (!book) return res.status(404).json({ error: 'Book not found.' });
  res.json({ book: publicBook(book) });
}));

/* Reviews (a real feature now). */
router.get('/books/:id/reviews', ah(async (req, res) => {
  const reviews = await prisma.review.findMany({
    where: { bookId: req.params.id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      body: r.body,
      author: r.user ? r.user.name : 'A reader',
      verifiedPurchase: r.verifiedPurchase,
      createdAt: r.createdAt.getTime(),
    })),
  });
}));

async function recomputeBookRating(bookId) {
  const agg = await prisma.review.aggregate({ where: { bookId }, _avg: { rating: true }, _count: true });
  await prisma.book.update({
    where: { id: bookId },
    data: { ratingAvg: (agg._avg.rating || 0).toFixed(1), reviewCount: agg._count },
  });
}

router.post('/books/:id/reviews', auth.requireVerified, ah(async (req, res) => {
  const bookId = req.params.id;
  const rating = Math.max(1, Math.min(5, parseInt(req.body.rating, 10) || 0));
  const body = clamp(req.body.body, 2000);
  if (!rating) return res.status(400).json({ error: 'Please choose a rating from 1 to 5.' });
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) return res.status(404).json({ error: 'Book not found.' });
  // "Verified purchase" if the user has a paid order containing this book.
  const purchased = await prisma.orderItem.findFirst({
    where: { bookId, order: { userId: req.user.id, status: { in: ['PAID', 'FULFILLED', 'SHIPPED'] } } },
  });
  await prisma.review.upsert({
    where: { bookId_userId: { bookId, userId: req.user.id } },
    create: { bookId, userId: req.user.id, rating, body, verifiedPurchase: Boolean(purchased) },
    update: { rating, body, verifiedPurchase: Boolean(purchased) },
  });
  await recomputeBookRating(bookId);
  res.json({ ok: true });
}));

/* Build a Prisma data object from admin-supplied book fields. */
function bookData(b, isCreate) {
  const out = {};
  if (b.title !== undefined) out.title = clamp(b.title, 120);
  if (b.author !== undefined) out.author = clamp(b.author, 80);
  if (b.price !== undefined) out.priceCents = priceToCents(b.price, 0);
  if (b.rating !== undefined) {
    const r = Number(b.rating);
    if (Number.isFinite(r) && r >= 0 && r <= 5) out.ratingAvg = r.toFixed(1);
  }
  if (b.tint !== undefined) out.coverTint = clamp(b.tint, 120);
  if (b.lang !== undefined) out.language = clamp(b.lang, 40);
  if (b.notes !== undefined) out.notes = clamp(b.notes, 280) || 'a fresh pour';
  if (b.genre !== undefined) out.genre = clamp(b.genre, 40) || 'Fiction';
  if (Array.isArray(b.mood)) out.mood = b.mood.slice(0, 6).map((m) => clamp(m, 24)).filter(Boolean);
  if (ROAST_IN[b.roast]) out.roast = ROAST_IN[b.roast];
  if (['slow', 'medium', 'fast'].includes(b.pace)) out.pace = b.pace.toUpperCase();
  if (['hopeful', 'bittersweet', 'open'].includes(b.ending)) out.ending = b.ending.toUpperCase();
  if (b.summary !== undefined) out.summary = clamp(b.summary, 2000);
  if (b.pages !== undefined) { const n = parseInt(b.pages, 10); if (Number.isFinite(n) && n > 0) out.pages = Math.min(100000, n); }
  if (b.year !== undefined) { const n = parseInt(b.year, 10); if (Number.isFinite(n) && n > 0) out.year = n; }
  if (b.reviews !== undefined) { const n = parseInt(b.reviews, 10); if (Number.isFinite(n) && n >= 0) out.reviewCount = n; }
  if (b.stock !== undefined) out.stock = Math.max(0, Math.min(99999, parseInt(b.stock, 10) || 0));
  if (typeof b.digitalGift === 'boolean') out.digitalGift = b.digitalGift;
  if (isCreate) out.custom = true;
  return out;
}

router.post('/books', auth.requireAdmin, ah(async (req, res) => {
  const b = req.body || {};
  const title = clamp(b.title, 120);
  const author = clamp(b.author, 80);
  if (!title) return res.status(400).json({ error: 'A title is required.' });
  if (!author) return res.status(400).json({ error: 'An author is required.' });
  const data = bookData(b, true);
  // Ensure a unique slug.
  let slug = slugify(title, crypto.randomBytes(4).toString('hex'));
  if (await prisma.book.findUnique({ where: { slug } })) slug += '-' + crypto.randomBytes(2).toString('hex');
  const book = await prisma.book.create({ data: { ...data, title, author, slug } });
  await audit(req, 'book.create', book.id, book.title);
  res.json({ book: publicBook(book) });
}));

router.patch('/books/:id', auth.requireAdmin, ah(async (req, res) => {
  const exists = await prisma.book.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: 'Book not found.' });
  const book = await prisma.book.update({ where: { id: req.params.id }, data: bookData(req.body || {}, false) });
  await audit(req, 'book.update', book.id, book.title);
  res.json({ book: publicBook(book) });
}));

router.delete('/books/:id', auth.requireAdmin, ah(async (req, res) => {
  const book = await prisma.book.findUnique({ where: { id: req.params.id } });
  if (!book || !book.custom) return res.json({ removed: false });
  await prisma.book.delete({ where: { id: req.params.id } });
  await audit(req, 'book.delete', book.id, book.title);
  res.json({ removed: true });
}));

/* ---- digital assets (the giftable ebook files) ---- */
function assetView(a) {
  return { id: a.id, format: a.format, fileName: a.fileName, fileSizeBytes: a.fileSizeBytes, active: a.active };
}

router.get('/books/:id/assets', auth.requireAdmin, ah(async (req, res) => {
  const assets = await prisma.bookAsset.findMany({ where: { bookId: req.params.id }, orderBy: { createdAt: 'asc' } });
  res.json({ assets: assets.map(assetView) });
}));

router.post('/books/:id/asset', auth.requireAdmin, upload.single('file'), ah(async (req, res) => {
  if (!storage.storageReady()) return res.status(503).json({ error: 'File storage is not configured.' });
  const book = await prisma.book.findUnique({ where: { id: req.params.id } });
  if (!book) return res.status(404).json({ error: 'Book not found.' });
  if (!req.file) return res.status(400).json({ error: 'No file was uploaded.' });
  const ext = (req.file.originalname.split('.').pop() || '').toLowerCase();
  const format = FORMAT_BY_EXT[ext];
  if (!format) return res.status(400).json({ error: 'Unsupported file type. Use PDF, EPUB, or MOBI.' });

  const key = `${book.id}/${format.toLowerCase()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  const checksum = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  await storage.uploadEbook(key, req.file.buffer, CONTENT_TYPE[format]);

  const prev = await prisma.bookAsset.findUnique({ where: { bookId_format: { bookId: book.id, format } } });
  if (prev && prev.storageKey !== key) await storage.removeEbook(prev.storageKey).catch(() => {});
  const asset = await prisma.bookAsset.upsert({
    where: { bookId_format: { bookId: book.id, format } },
    create: { bookId: book.id, format, storageKey: key, fileName: req.file.originalname, contentType: CONTENT_TYPE[format], fileSizeBytes: req.file.size, checksum },
    update: { storageKey: key, fileName: req.file.originalname, contentType: CONTENT_TYPE[format], fileSizeBytes: req.file.size, checksum, active: true },
  });
  await prisma.book.update({ where: { id: book.id }, data: { digitalGift: true } });
  await audit(req, 'asset.upload', book.id, `${format} ${req.file.originalname}`);
  res.json({ asset: assetView(asset) });
}));

router.delete('/books/:id/asset/:format', auth.requireAdmin, ah(async (req, res) => {
  const format = String(req.params.format || '').toUpperCase();
  const asset = await prisma.bookAsset.findUnique({ where: { bookId_format: { bookId: req.params.id, format } } }).catch(() => null);
  if (asset) {
    await storage.removeEbook(asset.storageKey).catch(() => {});
    await prisma.bookAsset.delete({ where: { id: asset.id } });
  }
  const remaining = await prisma.bookAsset.count({ where: { bookId: req.params.id, active: true } });
  if (remaining === 0) await prisma.book.update({ where: { id: req.params.id }, data: { digitalGift: false } }).catch(() => {});
  if (asset) await audit(req, 'asset.delete', req.params.id, format);
  res.json({ removed: Boolean(asset) });
}));

/* ============================== CART ============================== */
router.get('/cart', ah(async (req, res) => {
  res.json({ cart: cartLines(await getCart(req)) });
}));

router.post('/cart', ah(async (req, res) => {
  const title = clamp(req.body.title, 120);
  if (!title) return res.status(400).json({ error: 'A title is required.' });
  const requested = Math.max(1, Math.min(QTY_CAP, parseInt(req.body.qty, 10) || 1));
  const book = await prisma.book.findFirst({ where: { title } });
  if (!book) return res.status(404).json({ error: 'We could not find that book.' });
  if (book.stock <= 0) return res.status(409).json({ error: 'That title is out of stock.' });
  const cart = await getCart(req);
  const line = cart.items.find((it) => it.bookId === book.id);
  if (!line && cart.items.length >= CART_LINE_CAP) return res.status(400).json({ error: 'Your bag is full.' });
  const target = Math.min((line ? line.qty : 0) + requested, QTY_CAP, book.stock);
  await prisma.cartItem.upsert({
    where: { cartId_bookId: { cartId: cart.id, bookId: book.id } },
    create: { cartId: cart.id, bookId: book.id, qty: target },
    update: { qty: target },
  });
  res.json({ cart: cartLines(await getCart(req)) });
}));

router.patch('/cart', ah(async (req, res) => {
  const title = clamp(req.body.title, 120);
  const book = await prisma.book.findFirst({ where: { title } });
  const cart = await getCart(req);
  if (book) {
    const max = book.stock;
    const qty = Math.max(0, Math.min(parseInt(req.body.qty, 10) || 0, QTY_CAP, max));
    if (qty <= 0) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id, bookId: book.id } });
    } else {
      await prisma.cartItem.upsert({
        where: { cartId_bookId: { cartId: cart.id, bookId: book.id } },
        create: { cartId: cart.id, bookId: book.id, qty },
        update: { qty },
      });
    }
  }
  res.json({ cart: cartLines(await getCart(req)) });
}));

router.delete('/cart/:title', ah(async (req, res) => {
  const cart = await getCart(req);
  const book = await prisma.book.findFirst({ where: { title: req.params.title } });
  if (book) await prisma.cartItem.deleteMany({ where: { cartId: cart.id, bookId: book.id } });
  res.json({ cart: cartLines(await getCart(req)) });
}));

router.post('/cart/checkout', ah(async (req, res) => {
  const cart = await getCart(req);
  if (!cart.items.length) return res.status(400).json({ error: 'Your bag is empty.' });
  const subtotalCents = cart.items.reduce((n, it) => n + it.book.priceCents * it.qty, 0);
  const email = req.user ? req.user.email : 'guest@cupid.local';

  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      // Atomically decrement stock. The conditional update only succeeds while
      // enough stock remains, so concurrent checkouts of the last copy cannot
      // oversell: the loser's updateMany matches 0 rows and we abort.
      for (const it of cart.items) {
        const r = await tx.book.updateMany({
          where: { id: it.bookId, stock: { gte: it.qty } },
          data: { stock: { decrement: it.qty } },
        });
        if (r.count !== 1) throw Object.assign(new Error('out of stock'), { code: 'OUT_OF_STOCK', title: it.book.title });
      }
      const created = await tx.order.create({
        data: {
          userId: req.user ? req.user.id : null,
          email,
          status: 'PAID', // TODO: becomes PENDING until the Stripe webhook confirms payment
          subtotalCents,
          totalCents: subtotalCents,
          items: {
            create: cart.items.map((it) => ({
              bookId: it.bookId,
              titleSnapshot: it.book.title,
              unitPriceCents: it.book.priceCents,
              qty: it.qty,
            })),
          },
        },
        include: { items: true },
      });
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return created;
    });
  } catch (e) {
    if (e && e.code === 'OUT_OF_STOCK') return res.status(409).json({ error: `Sorry, "${e.title}" just sold out.` });
    throw e;
  }

  // Gift a downloadable copy for each purchased book that has one. The raw token
  // is returned once (in the link) and only its hash is stored.
  // NOTE: once Stripe is wired, move this to the payment-confirmed webhook so a
  // digital good is never released before the charge clears.
  const downloads = [];
  for (const it of cart.items) {
    if (!it.book.digitalGift) continue;
    const asset = await prisma.bookAsset.findFirst({ where: { bookId: it.bookId, active: true } });
    if (!asset) continue;
    const raw = genToken();
    await prisma.downloadGrant.create({
      data: {
        orderId: order.id,
        userId: req.user ? req.user.id : null,
        bookId: it.bookId,
        tokenHash: hashToken(raw),
        maxDownloads: DOWNLOAD_MAX,
        expiresAt: new Date(Date.now() + DOWNLOAD_TTL_MS),
      },
    });
    downloads.push({ title: it.book.title, url: '/api/downloads/' + raw });
  }

  res.json({ order: publicOrder(order), downloads });
}));

router.get('/orders', auth.requireAuth, ah(async (req, res) => {
  const orders = await prisma.order.findMany({ where: { userId: req.user.id }, include: { items: true }, orderBy: { createdAt: 'desc' } });
  res.json({ orders: orders.map(publicOrder) });
}));

/* ============================== DOWNLOADS (ebook gift) ============================== */
/* Validate a grant, then 302 to a short-lived signed URL. `enforceCap` limits
   the capability-link path; the authenticated owner is trusted (expiry only). */
async function streamGrant(req, res, grant, { enforceCap }) {
  const fail = (status, title, msg) => res.status(status).type('html').send(htmlPage(title, msg));
  if (grant.expiresAt && grant.expiresAt < new Date()) return fail(410, 'Link expired', 'This download link has expired.');
  if (enforceCap && grant.maxDownloads && grant.downloadCount >= grant.maxDownloads) {
    return fail(429, 'Limit reached', 'This download link has reached its download limit.');
  }
  if (!storage.storageReady()) return fail(503, 'Unavailable', 'Downloads are temporarily unavailable.');
  const want = String(req.query.format || '').toUpperCase();
  const where = { bookId: grant.bookId, active: true, ...(want ? { format: want } : {}) };
  const asset = await prisma.bookAsset.findFirst({ where, orderBy: { createdAt: 'asc' } });
  if (!asset) return fail(404, 'Not available', 'The file for this book is not available.');
  // Mint the URL first: if storage fails we do not want to burn a download.
  const url = await storage.signedUrl(asset.storageKey, 60);
  await prisma.downloadGrant.update({ where: { id: grant.id }, data: { downloadCount: { increment: 1 }, lastDownloadedAt: new Date() } });
  res.redirect(302, url);
}

/* A signed-in buyer's downloads, authorized by session ownership (no token). */
router.get('/downloads', auth.requireAuth, ah(async (req, res) => {
  const grants = await prisma.downloadGrant.findMany({
    where: { userId: req.user.id },
    include: { book: { include: { assets: { where: { active: true }, select: { format: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({
    downloads: grants.map((g) => ({
      id: g.id,
      title: g.book.title,
      formats: g.book.assets.map((a) => a.format),
      expiresAt: g.expiresAt ? g.expiresAt.getTime() : null,
      url: '/api/downloads/by-grant/' + g.id,
    })),
  });
}));

router.get('/downloads/by-grant/:id', auth.requireAuth, ah(async (req, res) => {
  const grant = await prisma.downloadGrant.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: { book: true } });
  if (!grant) return res.status(404).type('html').send(htmlPage('Not found', 'That download could not be found.'));
  return streamGrant(req, res, grant, { enforceCap: false });
}));

router.get('/downloads/:token', ah(async (req, res) => {
  const grant = await prisma.downloadGrant.findUnique({ where: { tokenHash: hashToken(req.params.token) }, include: { book: true } });
  if (!grant) return res.status(404).type('html').send(htmlPage('Link not found', 'That download link is invalid or has already been used up.'));
  return streamGrant(req, res, grant, { enforceCap: true });
}));

/* ============================== WISHLIST ============================== */
router.get('/wishlist', ah(async (req, res) => {
  const items = await prisma.wishlistItem.findMany({ where: auth.ownerWhere(req), include: { book: true } });
  res.json({ wishlist: items.map((w) => w.book.title) });
}));

router.post('/wishlist', ah(async (req, res) => {
  const title = clamp(req.body.title, 120);
  if (!title) return res.status(400).json({ error: 'A title is required.' });
  const book = await prisma.book.findFirst({ where: { title } });
  if (!book) return res.status(404).json({ error: 'We could not find that book.' });
  const owner = auth.ownerWhere(req);
  const existing = await prisma.wishlistItem.findFirst({ where: { ...owner, bookId: book.id } });
  let added;
  if (existing) { await prisma.wishlistItem.delete({ where: { id: existing.id } }); added = false; }
  else { try { await prisma.wishlistItem.create({ data: { ...owner, bookId: book.id } }); } catch (e) { if (!isDup(e)) throw e; } added = true; }
  const items = await prisma.wishlistItem.findMany({ where: owner, include: { book: true } });
  res.json({ wishlist: items.map((w) => w.book.title), added });
}));

router.delete('/wishlist/:title', ah(async (req, res) => {
  const owner = auth.ownerWhere(req);
  const book = await prisma.book.findFirst({ where: { title: req.params.title } });
  if (book) await prisma.wishlistItem.deleteMany({ where: { ...owner, bookId: book.id } });
  const items = await prisma.wishlistItem.findMany({ where: owner, include: { book: true } });
  res.json({ wishlist: items.map((w) => w.book.title) });
}));

/* ============================== EVENTS / RSVP ============================== */
router.get('/events', ah(async (_req, res) => {
  const events = await prisma.event.findMany({ orderBy: { createdAt: 'asc' } });
  res.json({ events: events.map(publicEvent) });
}));

router.get('/events/:id', ah(async (req, res) => {
  const ev = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!ev) return res.status(404).json({ error: 'Event not found.' });
  res.json({ event: publicEvent(ev) });
}));

function eventData(b) {
  const out = {};
  ['month', 'day', 'icon', 'type', 'title', 'time', 'place', 'spots'].forEach((k) => {
    if (b[k] !== undefined) out[k] = clamp(b[k], 80);
  });
  if (Array.isArray(b.desc)) out.desc = b.desc.slice(0, 8).map((p) => clamp(p, 600));
  return out;
}

router.post('/events', auth.requireAdmin, ah(async (req, res) => {
  const b = req.body || {};
  if (!clamp(b.title, 80)) return res.status(400).json({ error: 'A title is required.' });
  const event = await prisma.event.create({ data: eventData(b) });
  await audit(req, 'event.create', event.id, event.title);
  res.json({ event: publicEvent(event) });
}));

router.patch('/events/:id', auth.requireAdmin, ah(async (req, res) => {
  const exists = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: 'Event not found.' });
  const event = await prisma.event.update({ where: { id: req.params.id }, data: eventData(req.body || {}) });
  await audit(req, 'event.update', event.id, event.title);
  res.json({ event: publicEvent(event) });
}));

router.delete('/events/:id', auth.requireAdmin, ah(async (req, res) => {
  const exists = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.json({ removed: false });
  await prisma.event.delete({ where: { id: req.params.id } }); // rsvps cascade
  await audit(req, 'event.delete', req.params.id, exists.title);
  res.json({ removed: true });
}));

router.get('/rsvps', ah(async (req, res) => {
  const rows = await prisma.rsvp.findMany({ where: auth.ownerWhere(req) });
  res.json({ rsvps: rows.map((r) => r.eventId) });
}));

router.post('/rsvps', ah(async (req, res) => {
  const eventId = String(req.body.eventId || '');
  const ev = await prisma.event.findUnique({ where: { id: eventId } });
  if (!ev) return res.status(404).json({ error: 'Event not found.' });
  const owner = auth.ownerWhere(req);
  const existing = await prisma.rsvp.findFirst({ where: { ...owner, eventId } });
  let going;
  if (existing) { await prisma.rsvp.delete({ where: { id: existing.id } }); going = false; }
  else { try { await prisma.rsvp.create({ data: { ...owner, eventId } }); } catch (e) { if (!isDup(e)) throw e; } going = true; }
  const rows = await prisma.rsvp.findMany({ where: owner });
  res.json({ rsvps: rows.map((r) => r.eventId), going });
}));

router.delete('/rsvps/:id', ah(async (req, res) => {
  const owner = auth.ownerWhere(req);
  await prisma.rsvp.deleteMany({ where: { ...owner, eventId: req.params.id } });
  const rows = await prisma.rsvp.findMany({ where: owner });
  res.json({ rsvps: rows.map((r) => r.eventId) });
}));

/* ============================== ARTICLES ============================== */
router.get('/articles', ah(async (_req, res) => {
  const articles = await prisma.article.findMany({ where: { published: true }, orderBy: { createdAt: 'asc' } });
  res.json({ articles: articles.map(publicArticle) });
}));

router.get('/articles/:id', ah(async (req, res) => {
  const a = await prisma.article.findUnique({ where: { id: req.params.id } });
  if (!a) return res.status(404).json({ error: 'Article not found.' });
  res.json({ article: publicArticle(a) });
}));

function articleData(b, isCreate) {
  const out = {};
  if (b.cat !== undefined) out.cat = clamp(b.cat, 120);
  if (b.date !== undefined) out.date = clamp(b.date, 120);
  if (b.read !== undefined) out.readTime = clamp(b.read, 120);
  if (b.icon !== undefined) out.icon = clamp(b.icon, 120);
  if (b.tint !== undefined) out.tint = clamp(b.tint, 120);
  if (b.title !== undefined) out.title = clamp(b.title, 120);
  if (b.excerpt !== undefined) out.excerpt = clamp(b.excerpt, 400);
  if (Array.isArray(b.body)) out.body = b.body.slice(0, 40).map((p) => clamp(p, 6000));
  else if (b.body !== undefined) out.body = [clamp(b.body, 6000)];
  return out;
}

router.post('/articles', auth.requireAdmin, ah(async (req, res) => {
  const b = req.body || {};
  const title = clamp(b.title, 120);
  if (!title) return res.status(400).json({ error: 'A title is required.' });
  let slug = slugify(title, crypto.randomBytes(4).toString('hex'));
  if (await prisma.article.findUnique({ where: { slug } })) slug += '-' + crypto.randomBytes(2).toString('hex');
  const article = await prisma.article.create({ data: { ...articleData(b, true), title, slug } });
  await audit(req, 'article.create', article.id, article.title);
  res.json({ article: publicArticle(article) });
}));

router.patch('/articles/:id', auth.requireAdmin, ah(async (req, res) => {
  const exists = await prisma.article.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: 'Article not found.' });
  const article = await prisma.article.update({ where: { id: req.params.id }, data: articleData(req.body || {}, false) });
  await audit(req, 'article.update', article.id, article.title);
  res.json({ article: publicArticle(article) });
}));

router.delete('/articles/:id', auth.requireAdmin, ah(async (req, res) => {
  const exists = await prisma.article.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.json({ removed: false });
  await prisma.article.delete({ where: { id: req.params.id } });
  await audit(req, 'article.delete', req.params.id, exists.title);
  res.json({ removed: true });
}));

/* ============================== NEWSLETTER / CONTACT ============================== */
router.post('/newsletter', ah(async (req, res) => {
  const email = clamp(req.body.email, 160).toLowerCase();
  if (!isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  const raw = genToken();
  await prisma.newsletterSubscriber.upsert({
    where: { email },
    create: { email, confirmed: false, tokenHash: hashToken(raw) },
    update: { tokenHash: hashToken(raw) },
  });
  await mailer.newsletterConfirmEmail(email, raw);
  res.json({ ok: true });
}));

/* Email links are GET and land on a page with a button that POSTs, so scanners
   and prefetchers (which fetch but never POST) cannot silently confirm someone. */
function newsletterPage(action, token, label, intro) {
  const safe = esc(token);
  return htmlPage(
    label,
    `${intro}<form method="POST" action="/api/newsletter/${action}" style="margin-top:18px">` +
      `<input type="hidden" name="token" value="${safe}">` +
      `<button type="submit" style="border:none;border-radius:99px;padding:12px 24px;font:700 14px sans-serif;cursor:pointer;background:#e8859a;color:#1a120b">${esc(label)}</button>` +
      `</form>`
  );
}

router.get('/newsletter/confirm', (req, res) => {
  res.type('html').send(newsletterPage('confirm', String(req.query.token || ''), 'Confirm subscription', '<p>Tap below to confirm your Cupid newsletter subscription.</p>'));
});
router.post('/newsletter/confirm', ah(async (req, res) => {
  const h = hashToken(String(req.body.token || ''));
  const n = await prisma.newsletterSubscriber.findFirst({ where: { tokenHash: h } });
  if (n) await prisma.newsletterSubscriber.update({ where: { id: n.id }, data: { confirmed: true, confirmedAt: new Date() } });
  res.type('html').send(n
    ? htmlPage('Subscription confirmed', 'Thank you. You are on the list for events, new arrivals, and the occasional cocoa recipe.')
    : htmlPage('Link not found', 'That confirmation link is invalid or has already been used.'));
}));

router.get('/newsletter/unsubscribe', (req, res) => {
  res.type('html').send(newsletterPage('unsubscribe', String(req.query.token || ''), 'Unsubscribe', '<p>Tap below to unsubscribe from the Cupid newsletter.</p>'));
});
router.post('/newsletter/unsubscribe', ah(async (req, res) => {
  const h = hashToken(String(req.body.token || ''));
  const { count } = await prisma.newsletterSubscriber.deleteMany({ where: { tokenHash: h } });
  res.type('html').send(count > 0
    ? htmlPage('You are unsubscribed', 'You will no longer receive the Cupid newsletter. You can resubscribe any time.')
    : htmlPage('Link not found', 'That unsubscribe link is invalid or has already been used.'));
}));

router.post('/contact', ah(async (req, res) => {
  const name = clamp(req.body.name, 80);
  const email = clamp(req.body.email, 160).toLowerCase();
  const message = clamp(req.body.message, 2000);
  if (!name || !isEmail(email) || !message) return res.status(400).json({ error: 'Please fill in every field with a valid email.' });
  await prisma.contactMessage.create({ data: { name, email, message } });
  await mailer.send({ to: process.env.CONTACT_TO || 'team@cupid.local', subject: 'New contact message', text: `${name} <${email}>: ${message}` });
  res.json({ ok: true });
}));

export default router;
