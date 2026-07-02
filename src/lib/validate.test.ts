import { describe, it, expect } from 'vitest';
import { validatePassword, isEmail } from '../../server/validate.js';

describe('validatePassword', () => {
  it('accepts a reasonable password', () => {
    expect(validatePassword('coffeebooks7')).toBeNull();
  });
  it('rejects one that is too short', () => {
    expect(validatePassword('abc')).toMatch(/8 characters/);
  });
  it('rejects one that is too long', () => {
    expect(validatePassword('a'.repeat(201))).toMatch(/too long/);
  });
  it('rejects an all-identical password', () => {
    expect(validatePassword('aaaaaaaa')).toMatch(/too simple/);
  });
  it('rejects a common password', () => {
    expect(validatePassword('password')).toMatch(/too common/);
  });
});

describe('isEmail', () => {
  it('accepts a valid address', () => {
    expect(isEmail('reader@cupid.test')).toBe(true);
  });
  it('rejects malformed addresses', () => {
    expect(isEmail('nope')).toBe(false);
    expect(isEmail('a@b')).toBe(false);
    expect(isEmail('')).toBe(false);
  });
});
