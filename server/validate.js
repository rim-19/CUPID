'use strict';

/* Small, dependency-free validation helpers shared by the API and unit tests. */

const COMMON = new Set([
  'password', 'password1', '12345678', '123456789', 'qwertyui', 'qwerty123',
  '11111111', 'iloveyou', 'letmein1', 'welcome1', 'book1234', 'cupid123',
]);

/* Returns an error string if the password is unacceptable, or null if it is OK. */
export function validatePassword(pw) {
  const p = String(pw == null ? '' : pw);
  if (p.length < 8) return 'Use at least 8 characters for your password.';
  if (p.length > 200) return 'That password is too long (200 characters maximum).';
  if (/^(.)\1+$/.test(p)) return 'That password is too simple, please vary the characters.';
  if (COMMON.has(p.toLowerCase())) return 'That password is too common, please choose another.';
  return null;
}

export function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s == null ? '' : s).trim());
}
