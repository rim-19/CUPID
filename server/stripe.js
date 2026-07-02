'use strict';

/* Stripe client. Checkout is hosted (redirect to Stripe), so no card data ever
   touches this server - it stays out of PCI scope. With no secret key set the
   app falls back to an instant, no-payment checkout so local/dev still works. */
import Stripe from 'stripe';

const SECRET = process.env.STRIPE_SECRET_KEY;

let client = null;

export function stripeReady() {
  return Boolean(SECRET);
}

export function getStripe() {
  if (!stripeReady()) throw new Error('Stripe is not configured.');
  if (!client) client = new Stripe(SECRET, { apiVersion: '2024-06-20' });
  return client;
}

export const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
export const PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || '';

export default { stripeReady, getStripe, WEBHOOK_SECRET, PUBLISHABLE_KEY };
