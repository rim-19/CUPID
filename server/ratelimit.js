'use strict';

/* A tiny in-memory rate limiter, no dependencies. It tracks recent request
   timestamps per key (IP) in a sliding window and rejects with 429 once the cap
   is reached, setting Retry-After. This is right for the single-process app
   here; behind multiple processes this state would move to a shared store like
   Redis. It is layered on top of scrypt's own cost, so credential stuffing is
   throttled twice over. */

export function rateLimit({ windowMs, max, message } = {}) {
  const win = windowMs || 15 * 60 * 1000;
  const cap = max || 50;
  const hits = new Map(); // key -> number[] of timestamps within the window
  let lastSweep = Date.now();

  function sweep(now) {
    for (const [k, arr] of hits) {
      const kept = arr.filter((t) => now - t < win);
      if (kept.length) hits.set(k, kept);
      else hits.delete(k);
    }
    lastSweep = now;
  }

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    if (now - lastSweep > win) sweep(now);

    const key = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
    const recent = (hits.get(key) || []).filter((t) => now - t < win);

    if (recent.length >= cap) {
      const retry = Math.max(1, Math.ceil((win - (now - recent[0])) / 1000));
      res.setHeader('Retry-After', String(retry));
      return res.status(429).json({ error: message || 'Too many requests. Please wait a moment and try again.' });
    }

    recent.push(now);
    hits.set(key, recent);
    next();
  };
}
