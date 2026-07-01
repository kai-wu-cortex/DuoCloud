import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUsername, hashPassword, verifyPasswordHash } from './loginApi';

test('normalizeUsername trims and lowercases usernames', () => {
  assert.equal(normalizeUsername(' Admin '), 'admin');
});

test('verifyPasswordHash accepts only matching salt and password', () => {
  const salt = 'salt';
  const passwordHash = hashPassword('secret', salt);
  assert.equal(verifyPasswordHash('secret', salt, passwordHash), true);
  assert.equal(verifyPasswordHash('wrong', salt, passwordHash), false);
});
