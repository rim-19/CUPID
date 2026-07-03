'use strict';

import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
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

let transport = null;
function getTransport() {
  if (transport !== null) return transport;
  transport = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : false;
  return transport;
}

async function deliver(msg) {
  const t = getTransport();
  if (t) {
    try {
      await t.sendMail({ from: FROM, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
    } catch (err) {
      // The message is already recorded in the outbox; log the delivery failure.
      console.error(`[mail] delivery to ${msg.to} failed: ${err.message}`);
    }
  } else if (process.env.NODE_ENV !== 'test') {
    console.log(`[mail] (recorded to outbox; set SMTP_URL to send) to=${msg.to} subject="${msg.subject}"`);
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

/* Order receipt. For guests this is their only record of the purchase, so it
   carries the (token) download links to any gifted ebooks. */
export function orderReceiptEmail(to, order, downloads = []) {
  const money = (cents) => '$' + ((Number(cents) || 0) / 100).toFixed(2);
  const items = (order.items || []).map((i) => `  ${i.titleSnapshot} x${i.qty} - ${money(i.unitPriceCents * i.qty)}`).join('\n');
  const itemsHtml = (order.items || []).map((i) => `<li>${i.titleSnapshot} &times;${i.qty} — ${money(i.unitPriceCents * i.qty)}</li>`).join('');
  const dl = downloads.length
    ? '\n\nYour digital copies (links expire):\n' + downloads.map((d) => `  ${d.title}: ${link(d.url)}`).join('\n')
    : '';
  const dlHtml = downloads.length
    ? `<p><strong>Your digital copies</strong> (links expire):</p><ul>${downloads.map((d) => `<li><a href="${link(d.url)}">${d.title}</a></li>`).join('')}</ul>`
    : '';
  return send({
    to,
    subject: 'Your Cupid order is confirmed',
    text: `Thank you for your order.\n\n${items}\n\nTotal: ${money(order.totalCents)}${dl}\n\nWith warmth, Cupid.`,
    html: `<h2>Thank you for your order</h2><ul>${itemsHtml}</ul><p><strong>Total: ${money(order.totalCents)}</strong></p>${dlHtml}<p>With warmth, Cupid.</p>`,
  });
}
