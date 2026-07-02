'use strict';

import crypto from 'node:crypto';
import { promisify } from 'node:util';
import prisma from './prisma.js';

const scrypt = promisify(crypto.scrypt);

const COOKIE = 'cupid_sid';
const CSRF_COOKIE = 'cupid_csrf';
const SESSION_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days

/* Account lockout: after too many consecutive failures a user is frozen for a
   cool-off window. This is per-account and complements the per-IP rate limiter,
   which cannot see a slow distributed attack against one account. */
const LOCKOUT_MAX = Number(process.env.CUPID_LOCKOUT_MAX) || 8;
const LOCKOUT_MS = Number(process.env.CUPID_LOCKOUT_MS) || 15 * 60 * 1000;

/* ----- passwords (scrypt, salted, constant-time, non-blocking) ----- */
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const buf = await scrypt(String(password), salt, 64);
  return salt + ':' + buf.toString('hex');
}

async function verifyPassword(password, stored) {
  // Always run one scrypt so timing does not reveal whether the hash was valid.
  if (!stored || typeof stored !== 'string' || stored.indexOf(':') === -1) {
    await scrypt(String(password), 'invalid-salt', 64);
    return false;
  }
  const [salt, hash] = stored.split(':');
  const test = await scrypt(String(password), salt, 64);
  const a = Buffer.from(hash, 'hex');
  return a.length === test.length && crypto.timingSafeEqual(a, test);
}

function isLocked(user) {
  return Boolean(user && user.lockedUntil && user.lockedUntil > new Date());
}

async function registerFailedLogin(userId) {
  const u = await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: { increment: 1 } },
  });
  if (u.failedLoginCount >= LOCKOUT_MAX) {
    await prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: new Date(Date.now() + LOCKOUT_MS), failedLoginCount: 0 },
    });
  }
}

async function clearFailedLogins(userId) {
  await prisma.user
    .update({ where: { id: userId }, data: { failedLoginCount: 0, lockedUntil: null } })
    .catch(() => {});
}

/* ----- cookies ----- */
function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function cookieOpts(httpOnly) {
  return {
    httpOnly,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL,
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_INSECURE !== '1',
  };
}

function setSessionCookie(res, sid) {
  res.cookie(COOKIE, sid, cookieOpts(true));
}

/* Readable by JS on purpose: the front end echoes it back in an X-CSRF-Token
   header (double-submit). Same-origin policy keeps a cross-site attacker from
   reading it, and SameSite=Lax keeps it off cross-site POSTs entirely. */
function setCsrfCookie(res, token) {
  res.cookie(CSRF_COOKIE, token, cookieOpts(false));
}

/* ----- sessions ----- */
function newCsrf() {
  return crypto.randomBytes(32).toString('hex');
}

async function createSession(userId = null) {
  return prisma.session.create({
    data: { csrf: newCsrf(), userId: userId || null, expiresAt: new Date(Date.now() + SESSION_TTL) },
  });
}

/* Attaches req.session (creating an anonymous one if needed) and req.user. */
async function sessionMiddleware(req, res, next) {
  try {
    const sid = parseCookies(req)[COOKIE];
    let session = sid ? await prisma.session.findUnique({ where: { id: sid } }) : null;
    if (session && session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      session = null;
    }
    if (!session) {
      session = await createSession(null);
      setSessionCookie(res, session.id);
    }
    setCsrfCookie(res, session.csrf);
    req.session = session;
    req.user = session.userId
      ? await prisma.user.findUnique({ where: { id: session.userId } })
      : null;
    next();
  } catch (err) {
    next(err);
  }
}

/* Rotate the session on a privilege change (sign in / out / up). Creates a fresh
   row with a new id + CSRF and drops the old one, so a session id an attacker
   may have fixed beforehand cannot be reused afterwards. Guest data must be
   merged onto the user BEFORE calling this, because deleting the old session
   cascade-removes anything still tied to it. */
async function rotateSession(req, res, userId) {
  const oldId = req.session.id;
  const session = await createSession(userId ?? null);
  await prisma.session.delete({ where: { id: oldId } }).catch(() => {});
  req.session = session;
  setSessionCookie(res, session.id);
  setCsrfCookie(res, session.csrf);
  return session;
}

/* A Prisma `where` fragment selecting the current owner's rows: the user when
   signed in, otherwise the anonymous session. */
function ownerWhere(req) {
  return req.user ? { userId: req.user.id } : { sessionId: req.session.id };
}

function publicUser(u) {
  return u
    ? { id: u.id, name: u.name, email: u.email, verified: Boolean(u.emailVerified), admin: u.role === 'ADMIN' }
    : null;
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sign in required.' });
  next();
}

function requireVerified(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sign in required.' });
  if (!req.user.emailVerified) return res.status(403).json({ error: 'Please confirm your email first.' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/* These POST routes are authorized by an unguessable token in the body, not the
   ambient session cookie, so CSRF protection is redundant and would block the
   plain form POST the email-link landing page submits. */
const CSRF_EXEMPT = new Set(['/api/newsletter/confirm', '/api/newsletter/unsubscribe']);

function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (CSRF_EXEMPT.has((req.originalUrl || '').split('?')[0])) return next();
  const token = req.get ? req.get('x-csrf-token') : req.headers['x-csrf-token'];
  if (!req.session || !req.session.csrf || !token || token !== req.session.csrf) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token. Reload and try again.' });
  }
  next();
}

export {
  COOKIE,
  CSRF_COOKIE,
  SESSION_TTL,
  hashPassword,
  verifyPassword,
  isLocked,
  registerFailedLogin,
  clearFailedLogins,
  parseCookies,
  setSessionCookie,
  setCsrfCookie,
  createSession,
  sessionMiddleware,
  rotateSession,
  ownerWhere,
  publicUser,
  requireAuth,
  requireVerified,
  requireAdmin,
  csrfProtection,
};
