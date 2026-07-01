import test from 'node:test';
import assert from 'node:assert/strict';
import { parseKnowledgeApiAssetResponse, parseKnowledgeApiListResponse } from './knowledgeApi';

test('parseKnowledgeApiListResponse returns data array', () => {
  const result = parseKnowledgeApiListResponse({ success: true, data: [] });
  assert.deepEqual(result, []);
});

test('parseKnowledgeApiListResponse throws API message', () => {
  assert.throws(() => parseKnowledgeApiListResponse({ success: false, message: '未登录' }), /未登录/);
});

test('parseKnowledgeApiAssetResponse requires object data', () => {
  assert.throws(() => parseKnowledgeApiAssetResponse({ success: true, data: null }), /知识卡响应格式/);
});
