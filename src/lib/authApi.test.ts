import test from 'node:test';
import assert from 'node:assert/strict';

import { getDuoCloudSession, parseAuthResponse, signInToDuoCloud, signOutOfDuoCloud } from './authApi';

test.afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

const ORIGINAL_FETCH = globalThis.fetch;

test('parseAuthResponse returns auth user on success', () => {
  const user = parseAuthResponse({
    success: true,
    data: { uid: 'admin', username: 'Admin', role: 'admin' },
  });

  assert.deepEqual(user, { uid: 'admin', username: 'Admin', role: 'admin' });
});

test('parseAuthResponse throws readable API message on failure', () => {
  assert.throws(
    () => parseAuthResponse({ success: false, message: '用户名或密码错误。' }),
    /用户名或密码错误/,
  );
});

test('signInToDuoCloud posts credentials to the login API with same-origin cookies', async () => {
  let request: { input: unknown; init?: RequestInit } | null = null;
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    request = { input, init };
    return {
      json: async () => ({
        success: true,
        data: { uid: 'admin', username: 'Admin', role: 'admin' },
      }),
    } as Response;
  }) as typeof fetch;

  const user = await signInToDuoCloud('Admin', 'secret');

  assert.deepEqual(user, { uid: 'admin', username: 'Admin', role: 'admin' });
  assert.deepEqual(request, {
    input: '/api/login',
    init: {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Admin', password: 'secret' }),
    },
  });
});

test('getDuoCloudSession requests the session with same-origin cookies', async () => {
  let request: { input: unknown; init?: RequestInit } | null = null;
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    request = { input, init };
    return {
      json: async () => ({
        success: true,
        data: { uid: 'editor-1', username: 'editor', role: 'editor' },
      }),
    } as Response;
  }) as typeof fetch;

  const user = await getDuoCloudSession();

  assert.deepEqual(user, { uid: 'editor-1', username: 'editor', role: 'editor' });
  assert.deepEqual(request, {
    input: '/api/auth/me',
    init: { credentials: 'same-origin' },
  });
});

test('signOutOfDuoCloud posts with same-origin cookies', async () => {
  let request: { input: unknown; init?: RequestInit } | null = null;
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    request = { input, init };
    return {
      json: async () => ({ success: true }),
    } as Response;
  }) as typeof fetch;

  await signOutOfDuoCloud();

  assert.deepEqual(request, {
    input: '/api/logout',
    init: {
      method: 'POST',
      credentials: 'same-origin',
    },
  });
});

test('signOutOfDuoCloud throws a readable error when logout fails', async () => {
  globalThis.fetch = (async () => ({
    json: async () => ({ success: false, message: '退出失败，请稍后重试。' }),
  }) as Response) as typeof fetch;

  await assert.rejects(
    () => signOutOfDuoCloud(),
    /退出失败，请稍后重试/,
  );
});
