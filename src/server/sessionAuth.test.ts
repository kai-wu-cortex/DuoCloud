import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSessionToken,
  verifySessionToken,
  createSessionCookie,
  createExpiredSessionCookie,
  requireRole,
  SessionAuthError,
} from './sessionAuth';

test('session token verifies before expiration', () => {
  const now = new Date('2026-07-01T00:00:00.000Z');
  const token = createSessionToken(
    { uid: 'admin', username: 'Admin', role: 'admin' },
    'secret',
    now,
  );
  const user = verifySessionToken(token, 'secret', new Date('2026-07-01T01:00:00.000Z'));
  assert.deepEqual(user, { uid: 'admin', username: 'Admin', role: 'admin' });
});

test('session token rejects wrong secret and expired token', () => {
  const now = new Date('2026-07-01T00:00:00.000Z');
  const token = createSessionToken(
    { uid: 'editor', username: 'Editor', role: 'editor' },
    'secret',
    now,
  );
  assert.equal(verifySessionToken(token, 'other-secret', now), null);
  assert.equal(verifySessionToken(token, 'secret', new Date('2026-07-02T00:00:00.000Z')), null);
});

test('session cookies use HttpOnly secure same-site attributes', () => {
  const cookie = createSessionCookie('token');
  assert.match(cookie, /duocloud_session=token/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(createExpiredSessionCookie(), /Max-Age=0/);
});

test('requireRole throws forbidden when role is insufficient', () => {
  const token = createSessionToken({ uid: 'viewer', username: 'Viewer', role: 'viewer' }, 'secret');
  const req = { headers: { cookie: `duocloud_session=${token}` } };
  assert.throws(
    () => requireRole(req, 'secret', ['editor', 'admin']),
    (error: unknown) => error instanceof SessionAuthError && error.statusCode === 403,
  );
});
