import test from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import type { Filter } from 'mongodb';
import type { KnowledgeAsset } from '../types';
import {
  applyKnowledgeAssetUpdate,
  handleKnowledgeAssetAgentRequest,
  handleKnowledgeAssetBulkRequest,
  handleKnowledgeAssetDocumentRequest,
  handleKnowledgeAssetExportRequest,
  handleKnowledgeAssetsRequest,
  normalizeKnowledgeAssetId,
  sendKnowledgeAssetError,
  setKnowledgeAssetApiCollectionsForTests,
  validateKnowledgeAssetPayload,
  type KnowledgeAssetDocument,
} from './knowledgeAssetApi';
import { createSessionToken, type SessionUser } from './sessionAuth';

const ORIGINAL_ENV = { ...process.env };

const adminUser: SessionUser = { uid: 'admin-1', username: 'admin', role: 'admin' };
const editorUser: SessionUser = { uid: 'editor-1', username: 'editor', role: 'editor' };
const viewerUser: SessionUser = { uid: 'viewer-1', username: 'viewer', role: 'viewer' };

const baseTagAsset = {
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

const productMasterAsset = {
  id: 'PM-001',
  category: 'product_master',
  title: 'G-1201 亮金膜',
  tags: ['产品', '亮金'],
  lastUpdated: '2026-07-01',
  author: 'Editor',
  content: '产品资料',
  productName: 'G-1201 亮金膜',
  productCategory: '普通金',
  colorName: '亮金',
  colorCode: 'Gold-101',
  specifications: '640mm x 120m',
  surfaceEffect: '高亮',
  productStatus: '主推',
  productImage: '',
  recommendedIndustries: '化妆品盒',
  recommendedSubstrates: '白卡纸',
  notRecommendedSubstrates: '未处理PP',
  moq: '10卷',
  leadTime: '3-7天',
  hasStock: '有',
  alternativeModels: 'G-1203',
  riskLevel: '低',
  mustTestScenarios: 'UV油墨',
  createdAt: '2026-06-01',
  updatedAt: '2026-07-01',
  reviewer: '工艺主管',
} satisfies KnowledgeAsset;

const governanceAsset = {
  id: 'GOV-001',
  category: 'knowledge_governance',
  title: '治理规则',
  tags: ['治理'],
  lastUpdated: '2026-07-01',
  author: 'Admin',
  content: '治理内容',
  ruleNo: 'RULE-1',
  knowledgeDomain: '产品管理',
  briefTitle: '治理规则',
  detailedContent: '治理说明',
  source: 'ERP同步',
  reliability: '高',
  reviewer: '审核员',
  reviewStatus: '已发布',
  version: 'V1.0',
  updatedAt: '2026-07-01',
  failureCondition: '',
  usageCount: '5',
  feedbackScore: '98',
} satisfies KnowledgeAsset;

interface MockResponseState {
  statusCode: number;
  body: unknown;
}

function createMockResponse(): {
  res: Pick<Response, 'status' | 'json'>;
  state: MockResponseState;
} {
  const state: MockResponseState = { statusCode: 200, body: null };
  const res: Pick<Response, 'status' | 'json'> = {
    status(code: number) {
      state.statusCode = code;
      return this as Response;
    },
    json(payload: unknown) {
      state.body = payload;
      return this as Response;
    },
  };
  return { res, state };
}

function createRequest(
  overrides: Partial<Pick<Request, 'method' | 'body' | 'headers' | 'query'>>,
): Request {
  return {
    method: 'GET',
    body: undefined,
    headers: {},
    query: {},
    ...overrides,
  } as Request;
}

function createAuthHeaders(user: SessionUser): Record<string, string> {
  const secret = process.env.SESSION_SECRET ?? 'session-secret';
  const token = createSessionToken(user, secret, new Date('2099-01-01T00:00:00.000Z'));
  return { cookie: `duocloud_session=${token}` };
}

function createAgentHeaders(token = 'agent-secret'): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

function getSuccessData<T>(body: unknown): T {
  assert.ok(body && typeof body === 'object');
  assert.equal((body as { success?: unknown }).success, true);
  return (body as { data: T }).data;
}

function getErrorCode(body: unknown): string {
  assert.ok(body && typeof body === 'object');
  assert.equal((body as { success?: unknown }).success, false);
  return (body as { code?: string }).code ?? '';
}

async function invokeHandler(
  handler: (req: Request, res: Pick<Response, 'status' | 'json'>) => Promise<void>,
  req: Request,
  res: Pick<Response, 'status' | 'json'>,
) {
  try {
    await handler(req, res);
  } catch (error) {
    sendKnowledgeAssetError(res, error);
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function matchesFilter(document: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  for (const [key, expected] of Object.entries(filter)) {
    if (key === '$or') {
      const conditions = expected as Array<Record<string, unknown>>;
      if (!conditions.some(condition => matchesFilter(document, condition))) {
        return false;
      }
      continue;
    }

    const actual = document[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      const operator = expected as Record<string, unknown>;
      if ('$ne' in operator && actual === operator.$ne) return false;
      if ('$exists' in operator) {
        const exists = actual !== undefined;
        if (exists !== operator.$exists) return false;
      }
      if ('$regex' in operator) {
        const regex = new RegExp(String(operator.$regex), String(operator.$options ?? ''));
        if (Array.isArray(actual)) {
          if (!actual.some(item => regex.test(String(item)))) return false;
        } else if (!regex.test(String(actual ?? ''))) {
          return false;
        }
      }
      continue;
    }

    if (actual !== expected) return false;
  }
  return true;
}

class FakeCollection<T extends { _id?: unknown }> {
  readonly documents: T[];
  readonly replaceFilters: Array<Record<string, unknown>> = [];
  private idCounter = 0;

  constructor(seed: T[] = []) {
    this.documents = seed.map(item => clone(item));
  }

  async findOne(filter: Filter<T>): Promise<T | null> {
    const match = this.documents.find(document => matchesFilter(document as Record<string, unknown>, filter as Record<string, unknown>));
    return match ? clone(match) : null;
  }

  find(filter: Filter<T>) {
    const items = this.documents
      .filter(document => matchesFilter(document as Record<string, unknown>, filter as Record<string, unknown>))
      .map(document => clone(document));

    return {
      sort: (sortSpec: Record<string, 1 | -1>) => {
        const entries = Object.entries(sortSpec);
        items.sort((left, right) => {
          for (const [field, direction] of entries) {
            const a = left[field as keyof T];
            const b = right[field as keyof T];
            if (a === b) continue;
            if (a === undefined) return 1;
            if (b === undefined) return -1;
            if (a instanceof Date && b instanceof Date) {
              return direction === 1 ? a.getTime() - b.getTime() : b.getTime() - a.getTime();
            }
            if (String(a) < String(b)) return direction === 1 ? -1 : 1;
            if (String(a) > String(b)) return direction === 1 ? 1 : -1;
          }
          return 0;
        });
        return {
          toArray: async () => items.map(item => clone(item)),
        };
      },
      toArray: async () => items.map(item => clone(item)),
    };
  }

  async replaceOne(filter: Filter<T>, replacement: T, options?: { upsert?: boolean }) {
    this.replaceFilters.push(clone(filter as Record<string, unknown>));
    const index = this.documents.findIndex(document => matchesFilter(document as Record<string, unknown>, filter as Record<string, unknown>));
    if (index >= 0) {
      this.documents[index] = clone(replacement);
      return { acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
    }

    if (options?.upsert) {
      this.documents.push(clone(replacement));
      return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
    }

    return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
  }

  async insertOne(document: T) {
    const next = clone(document);
    if (!next._id) {
      this.idCounter += 1;
      next._id = `generated-${this.idCounter}`;
    }
    this.documents.push(next);
    return { acknowledged: true, insertedId: next._id };
  }

  async updateOne(filter: Filter<T>, update: { $set: Partial<T> }) {
    const index = this.documents.findIndex(document => matchesFilter(document as Record<string, unknown>, filter as Record<string, unknown>));
    if (index === -1) {
      return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    }
    this.documents[index] = {
      ...this.documents[index],
      ...clone(update.$set),
    };
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  }
}

function setupCollections(seed?: {
  assets?: KnowledgeAssetDocument[];
  revisions?: Array<Record<string, unknown>>;
  importJobs?: Array<Record<string, unknown>>;
}) {
  const assets = new FakeCollection<KnowledgeAssetDocument>(seed?.assets ?? []);
  const revisions = new FakeCollection<Record<string, unknown> & { _id?: string }>(
    seed?.revisions ?? [],
  );
  const importJobs = new FakeCollection<Record<string, unknown> & { _id?: string }>(
    seed?.importJobs ?? [],
  );

  setKnowledgeAssetApiCollectionsForTests({
    knowledgeAssets: async () => assets as never,
    revisions: async () => revisions as never,
    importJobs: async () => importJobs as never,
  });

  return { assets, revisions, importJobs };
}

test.beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, SESSION_SECRET: 'session-secret' };
});

test.afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  setKnowledgeAssetApiCollectionsForTests(null);
});

test('normalizeKnowledgeAssetId keeps safe ids and replaces unsafe characters', () => {
  assert.equal(normalizeKnowledgeAssetId(' KA-001 '), 'KA-001');
  assert.equal(normalizeKnowledgeAssetId('OBS/中文'), 'OBS___');
});

test('validateKnowledgeAssetPayload accepts valid KnowledgeAsset-like payload', () => {
  const result = validateKnowledgeAssetPayload(baseTagAsset);
  assert.equal(result.valid, true);
});

test('validateKnowledgeAssetPayload rejects invalid category', () => {
  const result = validateKnowledgeAssetPayload({ ...baseTagAsset, category: 'bad' });
  assert.equal(result.valid, false);
  assert.match(result.message, /category/);
});

test('validateKnowledgeAssetPayload allows empty structured category fields', () => {
  const valid = { ...productMasterAsset, productName: '' };
  const result = validateKnowledgeAssetPayload(valid);
  assert.equal(result.valid, true);
});

test('applyKnowledgeAssetUpdate preserves domain fields and writes server metadata', () => {
  const updated = applyKnowledgeAssetUpdate(governanceAsset, {
    actor: adminUser,
    now: new Date('2026-07-01T08:00:00.000Z'),
    existingVersion: 2,
    source: 'duocloud',
  });

  assert.equal(updated._id, 'GOV-001');
  assert.equal(updated.version, 'V1.0');
  assert.equal(updated.source, 'ERP同步');
  assert.equal(updated.serverVersion, 3);
  assert.equal(updated.serverSource, 'duocloud');
  assert.equal(updated.serverStatus, 'active');
});

test('GET list requires an authenticated session', async () => {
  setupCollections();
  const req = createRequest({ method: 'GET' });
  const { res, state } = createMockResponse();

  await invokeHandler(handleKnowledgeAssetsRequest, req, res);

  assert.equal(state.statusCode, 401);
  assert.equal(getErrorCode(state.body), 'UNAUTHORIZED');
});

test('POST create requires editor or admin role', async () => {
  setupCollections();
  const req = createRequest({
    method: 'POST',
    headers: createAuthHeaders(viewerUser),
    body: governanceAsset,
  });
  const { res, state } = createMockResponse();

  await invokeHandler(handleKnowledgeAssetsRequest, req, res);

  assert.equal(state.statusCode, 403);
  assert.equal(getErrorCode(state.body), 'FORBIDDEN');
});

test('CRUD handlers preserve domain fields, enforce serverVersion, and write revisions', async () => {
  const { assets, revisions } = setupCollections();

  const createReq = createRequest({
    method: 'POST',
    headers: createAuthHeaders(editorUser),
    body: governanceAsset,
  });
  const createRes = createMockResponse();
  await handleKnowledgeAssetsRequest(createReq, createRes.res);

  assert.equal(createRes.state.statusCode, 201);
  const created = getSuccessData<KnowledgeAssetDocument>(createRes.state.body);
  assert.equal(created.source, 'ERP同步');
  assert.equal(created.version, 'V1.0');
  assert.equal(created.access, 'private');
  assert.equal(created.ownerUid, editorUser.uid);
  assert.equal(created.ownerUsername, editorUser.username);
  assert.equal(created.serverSource, 'duocloud');
  assert.equal(created.serverVersion, 1);

  const getReq = createRequest({
    method: 'GET',
    headers: createAuthHeaders(viewerUser),
    query: { id: governanceAsset.id },
  });
  const getRes = createMockResponse();
  await handleKnowledgeAssetDocumentRequest(getReq, getRes.res);
  assert.equal(getRes.state.statusCode, 200);

  const updateReq = createRequest({
    method: 'PUT',
    headers: createAuthHeaders(editorUser),
    query: { id: governanceAsset.id },
    body: {
      ...governanceAsset,
      title: '治理规则 V2',
      version: 'V1.1',
      source: 'MES同步',
      serverVersion: created.serverVersion,
    },
  });
  const updateRes = createMockResponse();
  await handleKnowledgeAssetDocumentRequest(updateReq, updateRes.res);
  assert.equal(updateRes.state.statusCode, 200);
  const updated = getSuccessData<KnowledgeAssetDocument>(updateRes.state.body);
  assert.equal(updated.title, '治理规则 V2');
  assert.equal(updated.version, 'V1.1');
  assert.equal(updated.source, 'MES同步');
  assert.equal(updated.serverVersion, 2);
  assert.deepEqual(assets.replaceFilters.at(-1), {
    _id: 'GOV-001',
    serverVersion: 1,
    serverStatus: { $ne: 'archived' },
  });

  const staleReq = createRequest({
    method: 'PUT',
    headers: createAuthHeaders(editorUser),
    query: { id: governanceAsset.id },
    body: {
      ...governanceAsset,
      title: 'stale update',
      serverVersion: 1,
    },
  });
  const staleRes = createMockResponse();
  await invokeHandler(handleKnowledgeAssetDocumentRequest, staleReq, staleRes.res);
  assert.equal(staleRes.state.statusCode, 409);
  assert.equal(getErrorCode(staleRes.state.body), 'CONFLICT');

  const deleteReq = createRequest({
    method: 'DELETE',
    headers: createAuthHeaders(adminUser),
    query: { id: governanceAsset.id },
    body: {
      serverVersion: updated.serverVersion,
    },
  });
  const deleteRes = createMockResponse();
  await handleKnowledgeAssetDocumentRequest(deleteReq, deleteRes.res);
  assert.equal(deleteRes.state.statusCode, 200);
  const deleted = getSuccessData<KnowledgeAssetDocument>(deleteRes.state.body);
  assert.equal(deleted.serverStatus, 'archived');
  assert.ok(deleted.serverDeletedAt instanceof Date);
  assert.deepEqual(assets.replaceFilters.at(-1), {
    _id: 'GOV-001',
    serverVersion: 2,
    serverStatus: { $ne: 'archived' },
  });

  assert.equal(revisions.documents.length, 3);
  assert.deepEqual(revisions.documents.map(entry => entry.operation), ['create', 'update', 'delete']);
});

test('soft-deleted assets are filtered from list and export responses', async () => {
  const active = applyKnowledgeAssetUpdate(governanceAsset, {
    actor: adminUser,
    now: new Date('2026-07-01T01:00:00.000Z'),
    source: 'duocloud',
  });
  const archived = {
    ...applyKnowledgeAssetUpdate(baseTagAsset, {
      actor: adminUser,
      now: new Date('2026-07-01T02:00:00.000Z'),
      source: 'duocloud',
    }),
    serverStatus: 'archived' as const,
    serverDeletedAt: new Date('2026-07-01T03:00:00.000Z'),
  };
  setupCollections({ assets: [active, archived] });

  const listReq = createRequest({
    method: 'GET',
    headers: createAuthHeaders(viewerUser),
  });
  const listRes = createMockResponse();
  await handleKnowledgeAssetsRequest(listReq, listRes.res);
  const listItems = getSuccessData<KnowledgeAssetDocument[]>(listRes.state.body);
  assert.deepEqual(listItems.map(item => item._id), ['GOV-001']);

  const exportReq = createRequest({
    method: 'GET',
    headers: createAuthHeaders(viewerUser),
  });
  const exportRes = createMockResponse();
  await handleKnowledgeAssetExportRequest(exportReq, exportRes.res);
  const exportItems = getSuccessData<KnowledgeAssetDocument[]>(exportRes.state.body);
  assert.equal(exportItems.length, 1);
  assert.equal(exportItems[0]._id, 'GOV-001');
});

test('bulk import logs import jobs, skips unchanged assets, and writes revisions', async () => {
  const existing = applyKnowledgeAssetUpdate(governanceAsset, {
    actor: adminUser,
    now: new Date('2026-07-01T01:00:00.000Z'),
    source: 'duocloud',
  });
  const changedGovernance = {
    ...governanceAsset,
    title: '治理规则-更新',
    version: 'V2.0',
  };
  const { assets, revisions, importJobs } = setupCollections({ assets: [existing] });

  const req = createRequest({
    method: 'POST',
    headers: createAuthHeaders(adminUser),
    body: {
      source: 'obsidian_import',
      input: 'obsidian-sync-2026-07-01',
      assets: [changedGovernance, baseTagAsset, baseTagAsset, { ...productMasterAsset, productName: '' }],
    },
  });
  const { res, state } = createMockResponse();
  await handleKnowledgeAssetBulkRequest(req, res);

  assert.equal(state.statusCode, 200);
  const data = getSuccessData<{
    jobId: string;
    counts: { created: number; updated: number; skipped: number; failed: number };
    errors: Array<{ id: string; message: string }>;
  }>(state.body);
  assert.deepEqual(data.counts, { created: 2, updated: 0, skipped: 2, failed: 0 });
  assert.equal(data.errors.length, 0);
  assert.equal(revisions.documents.length, 2);
  assert.deepEqual(revisions.documents.map(entry => entry.operation), ['bulk-import', 'bulk-import']);
  assert.equal(assets.documents.find(asset => asset._id === 'KA-001')?.title, baseTagAsset.title);
  assert.equal(assets.documents.find(asset => asset._id === 'KA-001')?.access, 'public');
  assert.equal(assets.documents.find(asset => asset._id === 'PM-001')?.access, 'public');
  assert.equal(importJobs.documents.length, 1);
  assert.equal(importJobs.documents[0].status, 'completed');
  assert.deepEqual(importJobs.documents[0].counts, data.counts);
});

test('agent bearer token can bulk upsert and export knowledge assets', async () => {
  process.env.DUOCLOUD_AGENT_API_TOKEN = 'agent-secret';
  const { revisions } = setupCollections();

  const bulkReq = createRequest({
    method: 'POST',
    headers: createAgentHeaders(),
    body: {
      source: 'agent_cli',
      input: 'hotfoil-skill-sync',
      assets: [governanceAsset],
    },
  });
  const bulkRes = createMockResponse();
  await handleKnowledgeAssetBulkRequest(bulkReq, bulkRes.res);

  assert.equal(bulkRes.state.statusCode, 200);
  const bulkData = getSuccessData<{
    counts: { created: number; updated: number; skipped: number; failed: number };
  }>(bulkRes.state.body);
  assert.deepEqual(bulkData.counts, { created: 1, updated: 0, skipped: 0, failed: 0 });
  assert.equal((revisions.documents[0].actor as { username: string }).username, 'duocloud-agent-cli');
  const revisionNext = revisions.documents[0].next as KnowledgeAssetDocument | null;
  assert.equal(revisionNext?.access, 'public');
  assert.equal(revisionNext?.ownerUid, undefined);

  const exportReq = createRequest({
    method: 'GET',
    headers: createAgentHeaders(),
  });
  const exportRes = createMockResponse();
  await handleKnowledgeAssetExportRequest(exportReq, exportRes.res);

  assert.equal(exportRes.state.statusCode, 200);
  const exported = getSuccessData<KnowledgeAssetDocument[]>(exportRes.state.body);
  assert.equal(exported.length, 1);
  assert.equal(exported[0].serverSource, 'agent_cli');
});

test('agent bearer token rejects invalid credentials', async () => {
  process.env.DUOCLOUD_AGENT_API_TOKEN = 'agent-secret';
  setupCollections();

  const req = createRequest({
    method: 'POST',
    headers: createAgentHeaders('wrong-secret'),
    body: {
      source: 'agent_cli',
      input: 'hotfoil-skill-sync',
      assets: [governanceAsset],
    },
  });
  const { res, state } = createMockResponse();
  await invokeHandler(handleKnowledgeAssetBulkRequest, req, res);

  assert.equal(state.statusCode, 401);
  assert.equal(getErrorCode(state.body), 'UNAUTHORIZED');
});

test('agent endpoint supports health, upsert, patch, and delete without browser session', async () => {
  process.env.DUOCLOUD_AGENT_API_TOKEN = 'agent-secret';
  const { assets, revisions } = setupCollections();

  const healthReq = createRequest({
    method: 'GET',
    headers: createAgentHeaders(),
  });
  const healthRes = createMockResponse();
  await handleKnowledgeAssetAgentRequest(healthReq, healthRes.res);
  assert.equal(healthRes.state.statusCode, 200);
  assert.equal((getSuccessData<{ ok: boolean }>(healthRes.state.body)).ok, true);

  const upsertReq = createRequest({
    method: 'POST',
    headers: createAgentHeaders(),
    body: {
      action: 'upsert',
      source: 'agent_cli',
      asset: governanceAsset,
    },
  });
  const upsertRes = createMockResponse();
  await handleKnowledgeAssetAgentRequest(upsertReq, upsertRes.res);
  assert.equal(upsertRes.state.statusCode, 201);
  const upserted = getSuccessData<{ status: string; asset: KnowledgeAssetDocument }>(upsertRes.state.body);
  assert.equal(upserted.status, 'created');
  assert.equal(upserted.asset.serverSource, 'agent_cli');
  assert.equal(upserted.asset.access, 'public');
  assert.equal(upserted.asset.ownerUid, undefined);

  const patchReq = createRequest({
    method: 'POST',
    headers: createAgentHeaders(),
    body: {
      action: 'patch',
      source: 'external_update_app',
      id: governanceAsset.id,
      patch: {
        title: '治理规则 Agent Patch',
        tags: ['治理', 'Agent更新'],
      },
    },
  });
  const patchRes = createMockResponse();
  await handleKnowledgeAssetAgentRequest(patchReq, patchRes.res);
  assert.equal(patchRes.state.statusCode, 200);
  const patched = getSuccessData<{ status: string; asset: KnowledgeAssetDocument }>(patchRes.state.body);
  assert.equal(patched.status, 'updated');
  assert.equal(patched.asset.title, '治理规则 Agent Patch');
  assert.deepEqual(patched.asset.tags, ['治理', 'Agent更新']);
  assert.equal(patched.asset.serverVersion, 2);

  const deleteReq = createRequest({
    method: 'POST',
    headers: createAgentHeaders(),
    body: {
      action: 'delete',
      id: governanceAsset.id,
    },
  });
  const deleteRes = createMockResponse();
  await handleKnowledgeAssetAgentRequest(deleteReq, deleteRes.res);
  assert.equal(deleteRes.state.statusCode, 200);
  const deleted = getSuccessData<{ status: string; asset: KnowledgeAssetDocument }>(deleteRes.state.body);
  assert.equal(deleted.status, 'deleted');
  assert.equal(deleted.asset.serverStatus, 'archived');
  assert.equal(assets.documents[0].serverStatus, 'archived');
  assert.deepEqual(revisions.documents.map(entry => entry.operation), ['agent-upsert', 'agent-patch', 'delete']);
});
