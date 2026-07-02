'use strict';

import crypto from 'node:crypto';
import prisma from './prisma.js';

/* A swappable mailer. With no provider configured it records each message to
   the database "outbox" and logs a line, which makes the email verification,
   password reset, and newsletter double-opt-in flows fully exercisable in
   development and tests. To go live, set SMTP_URL (or wire SES / Postmark /
   Resend) and implement the transport inside deliver(); nothing else changes. */

const FROM = process.env.MAIL_FROM || 'Cupid <hello@cupid.local>';
const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

export function link(p) {
  return APP_URL + p;
}

async function deliver(msg) {
  if (process.env.SMTP_URL) {
    // Production seam: plug a real transport in here (nodemailer/SES/etc.).
    // Left unbundled so the app keeps zero runtime dependencies by default.
    console.log(`[mail] SMTP configured but no transport bundled; logged -> ${msg.to} :: ${msg.subject}`);
  } else if (process.env.NODE_ENV !== 'test') {
    console.log(`[mail] to=${msg.to} subject="${msg.subject}"`);
  }
}

export async function send({ to, subject, text, html }) {
  const msg = { to, from: FROM, subject, text: text || '', html: html || '' };
  const saved = await prisma.outboxEmail.create({ data: { ...msg, status: 'logged' } });
  await deliver(msg);
  return saved;
}

export function verificationEmail(to, token) {
  const url = link('/verify?token=' + token);
  return send({
    to,
    subject: 'Confirm your Cupid account',
    text: `Welcome to Cupid. Confirm your email address: ${url}`,
    html: `<p>Welcome to Cupid.</p><p><a href="${url}">Confirm your email address</a></p>`,
  });
}

export function resetEmail(to, token) {
  const url = link('/reset?token=' + token);
  return send({
    to,
    subject: 'Reset your Cupid password',
    text: `Reset your password: ${url} (ignore this email if you did not ask).`,
    html: `<p><a href="${url}">Reset your password</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
}

export function newsletterConfirmEmail(to, token) {
  const confirm = link('/api/newsletter/confirm?token=' + token);
  const unsub = link('/api/newsletter/unsubscribe?token=' + token);
  return send({
    to,
    subject: 'Confirm your Cupid newsletter subscription',
    text: `Confirm: ${confirm}\nUnsubscribe: ${unsub}`,
    html: `<p><a href="${confirm}">Confirm your subscription</a></p><p><a href="${unsub}">Unsubscribe</a></p>`,
  });
}
