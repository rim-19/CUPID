'use strict';

import crypto from 'node:crypto';

/* Check a password against the Have I Been Pwned "Pwned Passwords" range API
   using k-anonymity: only the first 5 characters of the SHA-1 hash are ever
   sent over the wire, so the full password (and even its full hash) never
   leaves this server. Best-effort by design - it returns false (allow) on any
   network error or timeout so that an HIBP outage can never block sign-ups.
   Disabled under NODE_ENV=test and when CUPID_PWNED_CHECK=0. */
export async function isPasswordPwned(password) {
  if (process.env.NODE_ENV === 'test' || process.env.CUPID_PWNED_CHECK === '0') return false;
  try {
    const sha1 = crypto.createHash('sha1').update(String(password)).digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    let res;
    try {
      res = await fetch('https://api.pwnedpasswords.com/range/' + prefix, {
        headers: { 'Add-Padding': 'true' },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return false;

    const body = await res.text();
    for (const line of body.split('\n')) {
      const [suf, count] = line.split(':');
      if (suf && suf.trim().toUpperCase() === suffix) {
        return Number(count) > 0; // padding rows report a count of 0
      }
    }
    return false;
  } catch {
    return false; // fail open
  }
}

export default { isPasswordPwned };
