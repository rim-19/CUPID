import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, csrfProtection } from '../../server/auth.js';

function mockRes() {
  return {
    statusCode: 0,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

function run(method: string, headerToken: string | undefined, sessionCsrf: string | undefined) {
  const req = {
    method,
    get: (h: string) => (h.toLowerCase() === 'x-csrf-token' ? headerToken : undefined),
    session: sessionCsrf === undefined ? null : { csrf: sessionCsrf },
  };
  const res = mockRes();
  let nexted = false;
  csrfProtection(req, res, () => {
    nexted = true;
  });
  return { res, nexted };
}

/* The account store is now a thin client over the auth API, so the meaningful
   unit to test here is the server's password hashing: salted scrypt with a
   constant-time compare. The full sign up / in / out flow is covered by the
   backend integration checks and the end-to-end tests. */
describe('server password hashing', () => {
  it('produces a salted hash that is not the plaintext', async () => {
    const stored = await hashPassword('books123');
    expect(stored).toContain(':');
    expect(stored).not.toContain('books123');
  });

  it('uses a fresh salt each time (same password, different hash)', async () => {
    expect(await hashPassword('books123')).not.toBe(await hashPassword('books123'));
  });

  it('verifies the correct password and rejects a wrong one', async () => {
    const stored = await hashPassword('compiler');
    expect(await verifyPassword('compiler', stored)).toBe(true);
    expect(await verifyPassword('Compiler', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('rejects malformed stored values without throwing', async () => {
    expect(await verifyPassword('x', 'not-a-valid-hash')).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
  });
});

describe('CSRF protection', () => {
  it('lets read-only methods through without a token', () => {
    expect(run('GET', undefined, 'abc').nexted).toBe(true);
    expect(run('HEAD', undefined, 'abc').nexted).toBe(true);
  });

  it('allows a mutating request whose header matches the session token', () => {
    const { nexted, res } = run('POST', 'tok123', 'tok123');
    expect(nexted).toBe(true);
    expect(res.statusCode).toBe(0);
  });

  it('blocks a mutating request with a missing or wrong token', () => {
    const missing = run('POST', undefined, 'tok123');
    expect(missing.nexted).toBe(false);
    expect(missing.res.statusCode).toBe(403);

    const wrong = run('DELETE', 'nope', 'tok123');
    expect(wrong.nexted).toBe(false);
    expect(wrong.res.statusCode).toBe(403);
  });
});
