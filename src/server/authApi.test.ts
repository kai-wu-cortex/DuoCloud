import test from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import loginHandler from '../../api/login';
import logoutHandler from '../../api/logout';
import authMeHandler from '../../api/auth/me';
import {
  createExpiredSessionCookie,
  createSessionToken,
  type SessionUser,
} from './sessionAuth';
import {
  hashPassword,
  normalizeUsername,
  setSystemUsersCollectionResolverForTests,
  verifyPasswordHash,
  type SystemUserDoc,
} from './loginApi';

const ORIGINAL_ENV = { ...process.env };

interface MockResponse {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
}

function createMockResponse(): {
  res: Pick<Response, 'status' | 'json' | 'setHeader'>;
  state: MockResponse;
} {
  const state: MockResponse = {
    statusCode: 200,
    body: null,
    headers: {},
  };

  const res: Pick<Response, 'status' | 'json' | 'setHeader'> = {
    status(code: number) {
      state.statusCode = code;
      return this as Response;
    },
    json(payload: unknown) {
      state.body = payload;
      return this as Response;
    },
    setHeader(name: string, value: string) {
      state.headers[name] = value;
      return this as Response;
    },
  };

  return { res, state };
}

function createRequest(overrides: Partial<Pick<Request, 'method' | 'body' | 'headers'>>): Request {
  return {
    method: 'GET',
    body: undefined,
    headers: {},
    ...overrides,
  } as Request;
}

function stubSystemUsers(user: SystemUserDoc | null): void {
  setSystemUsersCollectionResolverForTests(async () => ({
    findOne: async ({ username }: { username: string }) =>
      user && user.username === username ? user : null,
  }));
}

function getSuccessData<T>(body: unknown): T {
  assert.ok(body && typeof body === 'object');
  assert.equal((body as { success?: unknown }).success, true);
  return (body as { data: T }).data;
}

function getErrorCode(body: unknown): string {
  assert.ok(body && typeof body === 'object');
  assert.equal((body as { success?: unknown }).success, false);
  return ((body as { error?: { code?: string } }).error?.code) ?? '';
}

test.afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  setSystemUsersCollectionResolverForTests(null);
});

test('normalizeUsername trims and lowercases usernames', () => {
  assert.equal(normalizeUsername(' Admin '), 'admin');
});

test('verifyPasswordHash accepts only matching salt and password', () => {
  const salt = 'salt';
  const passwordHash = hashPassword('secret', salt);
  assert.equal(verifyPasswordHash('secret', salt, passwordHash), true);
  assert.equal(verifyPasswordHash('wrong', salt, passwordHash), false);
});

test('hashPassword is stable for setup script compatibility', () => {
  assert.equal(hashPassword('secret', 'salt'), hashPassword('secret', 'salt'));
  assert.notEqual(hashPassword('secret', 'salt'), hashPassword('secret', 'other-salt'));
});

test('POST /api/login returns session user and emits Set-Cookie', async () => {
  process.env.SESSION_SECRET = 'session-secret';
  const user: SystemUserDoc = {
    _id: 'user-1',
    username: 'admin',
    role: 'admin',
    salt: 'pepper',
    passwordHash: hashPassword('secret', 'pepper'),
  };
  stubSystemUsers(user);

  const req = createRequest({
    method: 'POST',
    body: JSON.stringify({ username: ' Admin ', password: 'secret' }),
  });
  const { res, state } = createMockResponse();

  await loginHandler(req, res as Response);

  assert.equal(state.statusCode, 200);
  assert.deepEqual(getSuccessData<SessionUser>(state.body), {
    uid: 'user-1',
    username: 'admin',
    role: 'admin',
  });
  assert.match(state.headers['Set-Cookie'] ?? '', /^duocloud_session=/);
  assert.match(state.headers['Set-Cookie'] ?? '', /HttpOnly/);
});

test('POST /api/login returns 401 for invalid credentials', async () => {
  process.env.SESSION_SECRET = 'session-secret';
  const user: SystemUserDoc = {
    _id: 'user-1',
    username: 'admin',
    role: 'admin',
    salt: 'pepper',
    passwordHash: hashPassword('secret', 'pepper'),
  };
  stubSystemUsers(user);

  const req = createRequest({
    method: 'POST',
    body: { username: 'admin', password: 'wrong' },
  });
  const { res, state } = createMockResponse();

  await loginHandler(req, res as Response);

  assert.equal(state.statusCode, 401);
  assert.equal(getErrorCode(state.body), 'UNAUTHORIZED');
  assert.equal(state.headers['Set-Cookie'], undefined);
});

test('POST /api/login returns a session auth error when SESSION_SECRET is missing', async () => {
  const user: SystemUserDoc = {
    _id: 'user-1',
    username: 'admin',
    role: 'admin',
    salt: 'pepper',
    passwordHash: hashPassword('secret', 'pepper'),
  };
  stubSystemUsers(user);

  const req = createRequest({
    method: 'POST',
    body: { username: 'admin', password: 'secret' },
  });
  const { res, state } = createMockResponse();

  await loginHandler(req, res as Response);

  assert.equal(state.statusCode, 500);
  assert.equal(getErrorCode(state.body), 'SESSION_AUTH_ERROR');
});

test('POST /api/logout clears the session cookie', async () => {
  const req = createRequest({ method: 'POST' });
  const { res, state } = createMockResponse();

  await logoutHandler(req, res as Response);

  assert.equal(state.statusCode, 200);
  assert.deepEqual(state.body, { success: true });
  assert.equal(state.headers['Set-Cookie'], createExpiredSessionCookie());
});

test('GET /api/auth/me returns the authenticated session user', async () => {
  process.env.SESSION_SECRET = 'session-secret';
  const user: SessionUser = { uid: 'editor-1', username: 'editor', role: 'editor' };
  const token = createSessionToken(user, process.env.SESSION_SECRET);
  const req = createRequest({
    method: 'GET',
    headers: { cookie: `duocloud_session=${token}` },
  });
  const { res, state } = createMockResponse();

  await authMeHandler(req, res as Response);

  assert.equal(state.statusCode, 200);
  assert.deepEqual(getSuccessData<SessionUser>(state.body), user);
});

test('GET /api/auth/me returns 401 when the session is missing', async () => {
  process.env.SESSION_SECRET = 'session-secret';
  const req = createRequest({ method: 'GET', headers: {} });
  const { res, state } = createMockResponse();

  await authMeHandler(req, res as Response);

  assert.equal(state.statusCode, 401);
  assert.equal(getErrorCode(state.body), 'UNAUTHORIZED');
});

test('API routes return 405 for unsupported methods', async () => {
  process.env.SESSION_SECRET = 'session-secret';

  const login = createMockResponse();
  await loginHandler(createRequest({ method: 'GET' }), login.res as Response);
  assert.equal(login.state.statusCode, 405);
  assert.equal(getErrorCode(login.state.body), 'METHOD_NOT_ALLOWED');

  const logout = createMockResponse();
  await logoutHandler(createRequest({ method: 'GET' }), logout.res as Response);
  assert.equal(logout.state.statusCode, 405);
  assert.equal(getErrorCode(logout.state.body), 'METHOD_NOT_ALLOWED');

  const authMe = createMockResponse();
  await authMeHandler(createRequest({ method: 'POST' }), authMe.res as Response);
  assert.equal(authMe.state.statusCode, 405);
  assert.equal(getErrorCode(authMe.state.body), 'METHOD_NOT_ALLOWED');
});
