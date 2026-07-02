'use strict';

/* Idempotent database seed. Loads the bundled catalog (books, events, articles)
   into Postgres via Prisma and ensures an admin account exists. Safe to run
   repeatedly: every row is upserted by a stable id, so re-running updates in
   place rather than duplicating. Run with `npm run db:seed`.

   Notable transforms from the legacy JSON seed:
     - prices "$24"  -> priceCents 2400 (+ currency)
     - roast/pace/ending strings -> Prisma enums
     - a URL-safe slug is derived from each title (falls back to the id) */
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import seed from '../server/seed.js';

const prisma = new PrismaClient();

/* ----- helpers ----- */
function slugify(input, fallback) {
  const s = String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || fallback;
}

function toCents(price) {
  const n = Number(String(price == null ? '' : price).replace(/[^0-9.]/g, '')) || 0;
  return Math.round(n * 100);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return salt + ':' + hash;
}

const ROAST = { Light: 'LIGHT', Med: 'MED', Dark: 'DARK' };
const PACE = { slow: 'SLOW', medium: 'MEDIUM', fast: 'FAST' };
const ENDING = { hopeful: 'HOPEFUL', bittersweet: 'BITTERSWEET', open: 'OPEN' };

/* ----- seeders ----- */
async function seedBooks() {
  for (const b of seed.books) {
    const data = {
      slug: slugify(b.title, b.id),
      title: b.title,
      author: b.author,
      summary: b.summary || '',
      notes: b.notes || '',
      genre: b.genre || 'Fiction',
      language: b.lang || '',
      priceCents: toCents(b.price),
      currency: 'usd',
      coverTint: b.tint || '',
      roast: ROAST[b.roast] || 'MED',
      pace: PACE[b.pace] || 'MEDIUM',
      ending: ENDING[b.ending] || 'OPEN',
      mood: Array.isArray(b.mood) ? b.mood : [],
      pages: Number(b.pages) || 0,
      year: Number(b.year) || 0,
      ratingAvg: b.rating != null ? String(b.rating) : '0',
      reviewCount: Number(b.reviews) || 0,
      stock: Number.isFinite(b.stock) ? b.stock : 40,
      active: true,
      custom: false,
      digitalGift: false, // flip to true (and attach a BookAsset) to gift a copy
    };
    await prisma.book.upsert({ where: { id: b.id }, update: data, create: { id: b.id, ...data } });
  }
  return seed.books.length;
}

async function seedEvents() {
  for (const e of seed.events) {
    const data = {
      month: e.month || '',
      day: e.day || '',
      icon: e.icon || 'cup',
      type: e.type || '',
      title: e.title,
      time: e.time || '',
      place: e.place || '',
      spots: e.spots || '',
      desc: Array.isArray(e.desc) ? e.desc : [],
    };
    await prisma.event.upsert({ where: { id: e.id }, update: data, create: { id: e.id, ...data } });
  }
  return seed.events.length;
}

async function seedArticles() {
  for (const a of seed.articles) {
    const data = {
      slug: slugify(a.title, a.id),
      cat: a.cat || 'Staff picks',
      date: a.date || '',
      readTime: a.read || '3 min read',
      icon: a.icon || 'cup',
      tint: a.tint || '',
      title: a.title,
      excerpt: a.excerpt || '',
      body: Array.isArray(a.body) ? a.body : [],
      published: true,
    };
    await prisma.article.upsert({ where: { id: a.id }, update: data, create: { id: a.id, ...data } });
  }
  return seed.articles.length;
}

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@cupid.local').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || 'change-me-please';
  const existing = await prisma.user.findUnique({ where: { email } });
  await prisma.user.upsert({
    where: { email },
    update: { role: 'ADMIN' },
    create: {
      email,
      name: 'Cupid Admin',
      passwordHash: hashPassword(password),
      emailVerified: true,
      role: 'ADMIN',
    },
  });
  return { email, created: !existing, usingDefault: !process.env.SEED_ADMIN_PASSWORD };
}

async function main() {
  const books = await seedBooks();
  const events = await seedEvents();
  const articles = await seedArticles();
  const admin = await seedAdmin();

  console.log(`[seed] books: ${books}, events: ${events}, articles: ${articles}`);
  console.log(`[seed] admin: ${admin.email} (${admin.created ? 'created' : 'already existed'})`);
  if (admin.usingDefault) {
    console.warn('[seed] WARNING: admin password is the default. Set SEED_ADMIN_PASSWORD and re-run before deploying.');
  }
}

main()
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
