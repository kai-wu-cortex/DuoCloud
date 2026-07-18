import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MarketingEvidenceApiError,
  bulkUpdateMarketingEvidence,
  createMarketingEvidence,
  deleteMarketingEvidence,
  getMarketingEvidence,
  listMarketingEvidence,
  restoreMarketingEvidence,
  reviewMarketingEvidence,
  submitMarketingEvidence,
  updateMarketingEvidence,
} from './client';

function jsonResponse(
  payload: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('list serializes query parameters stably and uses same-origin credentials', async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ input: String(input), init });
    return jsonResponse({
      success: true,
      data: [],
      meta: { total: 0, page: 2, pageSize: 20 },
    });
  };
  const result = await listMarketingEvidence({
    page: 2,
    pageSize: 20,
    search: 'PET 测试',
    statuses: ['shared', 'private_draft'],
    contentForms: ['video', 'image'],
    sortField: 'updatedAt',
    sortDirection: 'desc',
  }, fetcher);

  assert.equal(
    calls[0]?.input,
    '/api/marketing-evidence?contentForms=image%2Cvideo&page=2&pageSize=20&search=PET+%E6%B5%8B%E8%AF%95&sortDirection=desc&sortField=updatedAt&statuses=private_draft%2Cshared',
  );
  assert.equal(calls[0]?.init?.credentials, 'same-origin');
  assert.deepEqual(result.meta, { total: 0, page: 2, pageSize: 20 });
  assert.ok(!calls[0]?.input.includes('knowledge-assets'));
});

test('CRUD, workflow and bulk methods use the marketing evidence routes', async () => {
  const calls: Array<{ path: string; method: string; body?: string }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({
      path: String(input),
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? init.body : undefined,
    });
    return jsonResponse({ success: true, data: { evidenceId: 'MKT-1', version: 2 } });
  };

  await createMarketingEvidence({ title: '证据', contentForms: ['image'] }, fetcher);
  await getMarketingEvidence('MKT-1', fetcher);
  await updateMarketingEvidence('MKT-1', { title: '更新' }, 1, fetcher);
  await deleteMarketingEvidence('MKT-1', 2, fetcher);
  await submitMarketingEvidence('MKT-1', 'submit', 2, fetcher);
  await reviewMarketingEvidence('MKT-1', 'approve', 3, '通过', fetcher);
  await restoreMarketingEvidence('MKT-1', 4, fetcher);
  await bulkUpdateMarketingEvidence(['MKT-1'], { tags: ['实拍'] }, {}, fetcher);

  assert.deepEqual(calls.map(call => [call.method, call.path]), [
    ['POST', '/api/marketing-evidence'],
    ['GET', '/api/marketing-evidence/MKT-1'],
    ['PATCH', '/api/marketing-evidence/MKT-1'],
    ['DELETE', '/api/marketing-evidence/MKT-1'],
    ['POST', '/api/marketing-evidence/MKT-1/submit'],
    ['POST', '/api/marketing-evidence/MKT-1/review'],
    ['POST', '/api/marketing-evidence/MKT-1/restore'],
    ['POST', '/api/marketing-evidence/bulk'],
  ]);
});

test('maps server errors with status code and details', async () => {
  const fetcher: typeof fetch = async () => jsonResponse({
    success: false,
    code: 'VERSION_CONFLICT',
    message: '证据已更新。',
    details: { expectedVersion: 3 },
  }, 409);

  await assert.rejects(
    () => updateMarketingEvidence('MKT-1', { title: '冲突' }, 2, fetcher),
    (error: unknown) => error instanceof MarketingEvidenceApiError
      && error.code === 'VERSION_CONFLICT'
      && error.status === 409
      && (error.details as { expectedVersion: number }).expectedVersion === 3,
  );
});

test('maps non-JSON and network failures to readable stable errors', async () => {
  await assert.rejects(
    () => getMarketingEvidence(
      'MKT-1',
      async () => new Response('<html>down</html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }),
    ),
    (error: unknown) => error instanceof MarketingEvidenceApiError
      && error.code === 'INVALID_RESPONSE',
  );
  await assert.rejects(
    () => getMarketingEvidence('MKT-1', async () => {
      throw new TypeError('offline');
    }),
    (error: unknown) => error instanceof MarketingEvidenceApiError
      && error.code === 'NETWORK_ERROR',
  );
});
