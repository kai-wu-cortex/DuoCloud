import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KnowledgeApiError,
  bulkImportKnowledgeAssets,
  deleteRemoteKnowledgeAsset,
  exportRemoteKnowledgeAssets,
  listKnowledgeAssets,
  parseBulkResult,
  parseKnowledgeApiAssetResponse,
  parseKnowledgeApiListResponse,
  updateRemoteKnowledgeAsset,
} from './knowledgeApi';
import type { KnowledgeAsset } from '../types';

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

test('parseBulkResult returns bulk counts', () => {
  const result = parseBulkResult({
    success: true,
    data: { created: 1, updated: 2, skipped: 3, failed: 0, errors: [] },
  });
  assert.deepEqual(result, { created: 1, updated: 2, skipped: 3, failed: 0, errors: [] });
});

test('parseBulkResult normalizes server counts wrapper', () => {
  const result = parseBulkResult({
    success: true,
    data: { counts: { created: 1, updated: 2, skipped: 3, failed: 0 }, errors: [] },
  });
  assert.deepEqual(result, { created: 1, updated: 2, skipped: 3, failed: 0, errors: [] });
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

const sampleAsset: KnowledgeAsset = {
  id: 'KA-1',
  category: 'tag_system',
  title: '标签',
  tags: ['tag'],
  lastUpdated: '2026-07-01',
  author: 'QA',
  content: 'content',
  tagNo: 'TAG-1',
  tagName: '标签',
  tagCategory: '系统',
  applicationRule: '规则',
  parentTag: '',
  synonyms: '',
  conflictingTags: '',
  applicationScenarios: '',
};

test('updateRemoteKnowledgeAsset sends the asset to the id route', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: string | URL | Request; init?: RequestInit }> = [];

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input, init });
    return new Response(JSON.stringify({ success: true, data: sampleAsset }), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await updateRemoteKnowledgeAsset(sampleAsset);
    assert.equal(result.id, sampleAsset.id);
    assert.equal(calls[0]?.input, '/api/knowledge-assets/KA-1');
    assert.equal(calls[0]?.init?.method, 'PUT');
    assert.equal(calls[0]?.init?.credentials, 'same-origin');
    assert.equal(JSON.parse(String(calls[0]?.init?.body)).id, sampleAsset.id);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('deleteRemoteKnowledgeAsset uses DELETE with the supplied version', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: string | URL | Request; init?: RequestInit }> = [];

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input, init });
    return new Response(JSON.stringify({ success: true, data: sampleAsset }), { status: 200 });
  }) as typeof fetch;

  try {
    await deleteRemoteKnowledgeAsset('KA-1', 7);
    assert.equal(calls[0]?.input, '/api/knowledge-assets/KA-1');
    assert.equal(calls[0]?.init?.method, 'DELETE');
    assert.equal(JSON.parse(String(calls[0]?.init?.body)).serverVersion, 7);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('bulkImportKnowledgeAssets posts normalized full assets', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: string | URL | Request; init?: RequestInit }> = [];

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input, init });
    return new Response(JSON.stringify({
      success: true,
      data: { counts: { created: 1, updated: 0, skipped: 0, failed: 0 }, errors: [] },
    }), { status: 200 });
  }) as typeof fetch;

  try {
    const { id: _id, lastUpdated: _lastUpdated, ...draft } = sampleAsset;
    const result = await bulkImportKnowledgeAssets([draft]);
    const body = JSON.parse(String(calls[0]?.init?.body));
    assert.equal(calls[0]?.input, '/api/knowledge-assets/bulk');
    assert.equal(body.assets[0].id.startsWith('KA-USER-'), true);
    assert.equal(typeof body.assets[0].lastUpdated, 'string');
    assert.deepEqual(result, { created: 1, updated: 0, skipped: 0, failed: 0, errors: [] });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('exportRemoteKnowledgeAssets parses the export list shape', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => new Response(JSON.stringify({
    success: true,
    data: [sampleAsset],
  }), { status: 200 })) as typeof fetch;

  try {
    const result = await exportRemoteKnowledgeAssets();
    assert.equal(result[0]?.id, sampleAsset.id);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
