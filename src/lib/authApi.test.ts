import test from 'node:test';
import assert from 'node:assert/strict';

import { parseAuthResponse } from './authApi';

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
