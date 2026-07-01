import test from 'node:test';
import assert from 'node:assert/strict';
import type { KnowledgeAsset } from '../types';
import {
  normalizeKnowledgeAssetId,
  validateKnowledgeAssetPayload,
  applyKnowledgeAssetUpdate,
} from './knowledgeAssetApi';

const baseAsset = {
  id: 'KA-001',
  category: 'tag_system',
  title: '标签',
  tags: ['标签'],
  lastUpdated: '2026-07-01',
  author: 'Admin',
  content: '正文',
  tagNo: 'T-001',
  tagName: '标签',
  tagCategory: '分类',
  applicationRule: '规则',
  parentTag: '',
  synonyms: '',
  conflictingTags: '',
  applicationScenarios: '',
} satisfies KnowledgeAsset;

test('normalizeKnowledgeAssetId keeps safe ids and replaces unsafe characters', () => {
  assert.equal(normalizeKnowledgeAssetId(' KA-001 '), 'KA-001');
  assert.equal(normalizeKnowledgeAssetId('OBS/中文'), 'OBS___');
});

test('validateKnowledgeAssetPayload accepts valid KnowledgeAsset-like payload', () => {
  const result = validateKnowledgeAssetPayload(baseAsset);
  assert.equal(result.valid, true);
});

test('validateKnowledgeAssetPayload rejects invalid category', () => {
  const result = validateKnowledgeAssetPayload({ ...baseAsset, category: 'bad' });
  assert.equal(result.valid, false);
  assert.match(result.message, /category/);
});

test('applyKnowledgeAssetUpdate increments version and metadata', () => {
  const updated = applyKnowledgeAssetUpdate(baseAsset, {
    actor: { uid: 'admin', username: 'Admin', role: 'admin' },
    now: new Date('2026-07-01T08:00:00.000Z'),
    existingVersion: 2,
    source: 'duocloud',
  });
  assert.equal(updated._id, 'KA-001');
  assert.equal(updated.version, 3);
  assert.equal(updated.status, 'active');
  assert.equal(updated.updatedBy.username, 'Admin');
});
