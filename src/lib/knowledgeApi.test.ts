import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KnowledgeApiError,
  listKnowledgeAssets,
  parseKnowledgeApiAssetResponse,
  parseKnowledgeApiListResponse,
} from './knowledgeApi';

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

test('listKnowledgeAssets requests same-origin cookies', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: string | URL | Request; init?: RequestInit }> = [];

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input, init });
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await listKnowledgeAssets();
    assert.deepEqual(result, []);
    assert.equal(calls[0]?.input, '/api/knowledge-assets');
    assert.equal(calls[0]?.init?.credentials, 'same-origin');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('listKnowledgeAssets maps 401 responses to UNAUTHORIZED errors', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => new Response(JSON.stringify({
    success: false,
    code: 'UNAUTHORIZED',
    message: '未登录',
  }), { status: 401 })) as typeof fetch;

  try {
    await assert.rejects(
      () => listKnowledgeAssets(),
      (error: unknown) => (
        error instanceof KnowledgeApiError
        && error.code === 'UNAUTHORIZED'
        && /未登录/.test(error.message)
      ),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
