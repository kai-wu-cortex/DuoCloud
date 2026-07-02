import type { Request, Response } from 'express';
import type { Collection, Document, Filter, OptionalId, ReplaceOptions } from 'mongodb';
import { getMongoCollection } from '../lib/mongodb.ts';
import type { KnowledgeAsset, KnowledgeTableType } from '../types.ts';
import {
  SessionAuthError,
  getSessionSecret,
  requireRole,
  requireSession,
  type SessionUser,
} from './sessionAuth.ts';

const KNOWLEDGE_COLLECTION = 'knowledge_assets';
const REVISION_COLLECTION = 'knowledge_asset_revisions';
const IMPORT_JOB_COLLECTION = 'knowledge_asset_import_jobs';

const KNOWLEDGE_CATEGORIES: readonly KnowledgeTableType[] = [
  'product_master',
  'substrate_knowledge',
  'compatibility_rule',
  'process_knowledge',
  'pricing_rule',
  'quality_issue',
  'supply_chain_capability',
  'faq_pitch',
  'tag_system',
  'knowledge_governance',
];

type KnowledgeAssetSource = 'duocloud' | 'obsidian_import' | 'external_update_app' | 'agent_cli';
type KnowledgeAssetStatus = 'active' | 'archived' | 'draft';
type KnowledgeAssetOperation = 'create' | 'update' | 'delete' | 'bulk-import' | 'agent-upsert' | 'agent-patch';

interface KnowledgeAssetActor {
  uid: string;
  username: string;
}

export interface KnowledgeAssetServerMetadata {
  serverStatus: KnowledgeAssetStatus;
  serverSource: KnowledgeAssetSource;
  serverVersion: number;
  serverCreatedAt: Date;
  serverUpdatedAt: Date;
  serverCreatedBy?: KnowledgeAssetActor;
  serverUpdatedBy?: KnowledgeAssetActor;
  serverDeletedAt?: Date;
}

export type KnowledgeAssetDocument = Document & KnowledgeAsset & KnowledgeAssetServerMetadata & {
  _id: string;
};

interface KnowledgeAssetRevisionDocument extends Document {
  assetId: string;
  operation: KnowledgeAssetOperation;
  actor: KnowledgeAssetActor;
  previous: KnowledgeAssetDocument | null;
  next: KnowledgeAssetDocument | null;
  createdAt: Date;
}

interface KnowledgeAssetImportJobDocument extends Document {
  _id?: string;
  source: KnowledgeAssetSource;
  input: string;
  status: 'running' | 'completed';
  startedAt: Date;
  completedAt?: Date;
  counts: {
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
  errors: Array<{ id: string; message: string }>;
}

type FindCursor<T> = {
  sort(sortSpec: Record<string, 1 | -1>): { toArray(): Promise<T[]> };
  toArray(): Promise<T[]>;
};

type ReplaceOneResult = {
  acknowledged: boolean;
  matchedCount: number;
  modifiedCount: number;
  upsertedCount: number;
};

type InsertOneResult = {
  acknowledged: boolean;
  insertedId: unknown;
};

type UpdateOneResult = {
  acknowledged: boolean;
  matchedCount: number;
  modifiedCount: number;
};

interface KnowledgeAssetCollectionLike<T extends Document> {
  findOne(filter: Filter<T>): Promise<T | null>;
  find(filter: Filter<T>): FindCursor<T>;
  replaceOne(filter: Filter<T>, replacement: T, options?: ReplaceOptions): Promise<ReplaceOneResult>;
  insertOne(document: OptionalId<T>): Promise<InsertOneResult>;
  updateOne(filter: Filter<T>, update: { $set: Partial<T> }): Promise<UpdateOneResult>;
}

interface KnowledgeAssetCollectionResolvers {
  knowledgeAssets?: () => Promise<KnowledgeAssetCollectionLike<KnowledgeAssetDocument>>;
  revisions?: () => Promise<KnowledgeAssetCollectionLike<KnowledgeAssetRevisionDocument>>;
  importJobs?: () => Promise<KnowledgeAssetCollectionLike<KnowledgeAssetImportJobDocument>>;
}

let collectionResolversForTests: KnowledgeAssetCollectionResolvers | null = null;

class KnowledgeAssetApiError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'KnowledgeAssetApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

interface BulkRequestBody {
  assets?: unknown;
  source?: unknown;
  input?: unknown;
}

type AgentAction = 'health' | 'upsert' | 'patch' | 'delete' | 'bulk';

export function setKnowledgeAssetApiCollectionsForTests(
  resolvers: KnowledgeAssetCollectionResolvers | null,
): void {
  collectionResolversForTests = resolvers;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseBody(body: unknown): unknown {
  if (typeof body !== 'string') return body;
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function toActor(user: SessionUser): KnowledgeAssetActor {
  return { uid: user.uid, username: user.username };
}

function getHeaderValue(
  headers: Pick<Request, 'headers'>['headers'],
  name: string,
): string | undefined {
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(direct)) return direct[0];
  return typeof direct === 'string' ? direct : undefined;
}

function getConfiguredAgentApiToken(): string | undefined {
  const token = process.env.DUOCLOUD_AGENT_API_TOKEN || process.env.KNOWLEDGE_AGENT_API_TOKEN;
  return token && token.trim() ? token.trim() : undefined;
}

function getAgentRole(): SessionUser['role'] {
  const role = process.env.DUOCLOUD_AGENT_API_ROLE || process.env.KNOWLEDGE_AGENT_API_ROLE;
  return role === 'viewer' || role === 'editor' || role === 'admin' ? role : 'admin';
}

function getAgentSessionFromRequest(req: Pick<Request, 'headers'>): SessionUser | null {
  const authorization = getHeaderValue(req.headers, 'authorization');
  if (!authorization) return null;

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new KnowledgeAssetApiError(401, 'UNAUTHORIZED', 'UNAUTHORIZED: agent authorization header is invalid.');
  }

  const configuredToken = getConfiguredAgentApiToken();
  if (!configuredToken || match[1].trim() !== configuredToken) {
    throw new KnowledgeAssetApiError(401, 'UNAUTHORIZED', 'UNAUTHORIZED: agent API token is invalid.');
  }

  return {
    uid: 'duocloud-agent-cli',
    username: 'duocloud-agent-cli',
    role: getAgentRole(),
  };
}

function roleSatisfies(role: SessionUser['role'], allowedRoles: SessionUser['role'][]): boolean {
  if (allowedRoles.includes(role)) return true;
  if (role === 'admin') return allowedRoles.some(allowed => allowed === 'editor' || allowed === 'viewer');
  if (role === 'editor') return allowedRoles.includes('viewer');
  return false;
}

function requireKnowledgeSession(req: Pick<Request, 'headers'>): SessionUser {
  const agent = getAgentSessionFromRequest(req);
  if (agent) return agent;
  return requireSession(req, getSessionSecret());
}

function requireKnowledgeRole(
  req: Pick<Request, 'headers'>,
  allowedRoles: SessionUser['role'][],
): SessionUser {
  const agent = getAgentSessionFromRequest(req);
  if (agent) {
    if (!roleSatisfies(agent.role, allowedRoles)) {
      throw new KnowledgeAssetApiError(403, 'FORBIDDEN', 'FORBIDDEN: agent role is insufficient.');
    }
    return agent;
  }
  return requireRole(req, getSessionSecret(), allowedRoles);
}

function formatDateOnly(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function isKnowledgeCategory(value: unknown): value is KnowledgeTableType {
  return typeof value === 'string' && KNOWLEDGE_CATEGORIES.includes(value as KnowledgeTableType);
}

function ensureNormalizedKnowledgeAsset(value: unknown): KnowledgeAsset {
  const validation = validateKnowledgeAssetPayload(value);
  if ('message' in validation) {
    throw new KnowledgeAssetApiError(422, 'VALIDATION_ERROR', validation.message);
  }

  const record = value as KnowledgeAsset;
  return {
    ...record,
    id: normalizeKnowledgeAssetId(record.id),
    tags: record.tags.map(tag => tag.trim()).filter(Boolean),
  };
}

function getQueryString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined;
  return undefined;
}

function getKnowledgeAssetIdFromRequest(req: Pick<Request, 'query'>): string {
  const rawId = getQueryString(req.query.id);
  const id = rawId ? normalizeKnowledgeAssetId(rawId) : '';
  if (!id) {
    throw new KnowledgeAssetApiError(404, 'NOT_FOUND', 'NOT_FOUND: 未找到知识卡片。');
  }
  return id;
}

function stripKnowledgeAssetMetadata(document: KnowledgeAssetDocument): KnowledgeAsset {
  const {
    _id: _ignoredId,
    serverStatus: _ignoredStatus,
    serverSource: _ignoredSource,
    serverVersion: _ignoredVersion,
    serverCreatedAt: _ignoredCreatedAt,
    serverUpdatedAt: _ignoredUpdatedAt,
    serverCreatedBy: _ignoredCreatedBy,
    serverUpdatedBy: _ignoredUpdatedBy,
    serverDeletedAt: _ignoredDeletedAt,
    ...asset
  } = document;

  return asset as KnowledgeAsset;
}

function stripServerManagedKnowledgeAssetFields(asset: KnowledgeAsset): Omit<KnowledgeAsset, 'lastUpdated'> {
  const { lastUpdated: _ignoredLastUpdated, ...content } = asset;
  return content;
}

function isSameKnowledgeAssetContent(
  existing: KnowledgeAssetDocument,
  incoming: KnowledgeAsset,
): boolean {
  return JSON.stringify(stripServerManagedKnowledgeAssetFields(stripKnowledgeAssetMetadata(existing)))
    === JSON.stringify(stripServerManagedKnowledgeAssetFields(incoming));
}

async function getKnowledgeAssetsCollection(): Promise<KnowledgeAssetCollectionLike<KnowledgeAssetDocument>> {
  if (collectionResolversForTests?.knowledgeAssets) {
    return collectionResolversForTests.knowledgeAssets();
  }
  return getMongoCollection<KnowledgeAssetDocument>(KNOWLEDGE_COLLECTION) as Promise<
    Collection<KnowledgeAssetDocument>
  >;
}

async function getKnowledgeAssetRevisionsCollection(): Promise<KnowledgeAssetCollectionLike<KnowledgeAssetRevisionDocument>> {
  if (collectionResolversForTests?.revisions) {
    return collectionResolversForTests.revisions();
  }
  return getMongoCollection<KnowledgeAssetRevisionDocument>(REVISION_COLLECTION) as Promise<
    Collection<KnowledgeAssetRevisionDocument>
  >;
}

async function getKnowledgeAssetImportJobsCollection(): Promise<KnowledgeAssetCollectionLike<KnowledgeAssetImportJobDocument>> {
  if (collectionResolversForTests?.importJobs) {
    return collectionResolversForTests.importJobs();
  }
  return getMongoCollection<KnowledgeAssetImportJobDocument>(IMPORT_JOB_COLLECTION) as Promise<
    Collection<KnowledgeAssetImportJobDocument>
  >;
}

async function writeRevision(
  assetId: string,
  operation: KnowledgeAssetOperation,
  actor: SessionUser,
  previous: KnowledgeAssetDocument | null,
  next: KnowledgeAssetDocument | null,
  createdAt: Date,
): Promise<void> {
  const revisions = await getKnowledgeAssetRevisionsCollection();
  await revisions.insertOne({
    assetId,
    operation,
    actor: toActor(actor),
    previous,
    next,
    createdAt,
  });
}

function buildActiveFilter(id?: string): Filter<KnowledgeAssetDocument> {
  const filter: Filter<KnowledgeAssetDocument> = {
    serverStatus: { $ne: 'archived' },
    serverDeletedAt: { $exists: false },
  };
  if (id) {
    filter._id = id;
  }
  return filter;
}

async function findActiveAssetById(id: string): Promise<KnowledgeAssetDocument | null> {
  const collection = await getKnowledgeAssetsCollection();
  return collection.findOne(buildActiveFilter(id));
}

function getRequestServerVersion(body: Record<string, unknown>): number | null {
  return typeof body.serverVersion === 'number' && Number.isFinite(body.serverVersion)
    ? body.serverVersion
    : null;
}

function getAgentAction(value: unknown): AgentAction | null {
  if (value === undefined || value === null || value === '') return 'health';
  if (
    value === 'health'
    || value === 'upsert'
    || value === 'patch'
    || value === 'delete'
    || value === 'bulk'
  ) {
    return value;
  }
  return null;
}

function getKnowledgeAssetSource(value: unknown): KnowledgeAssetSource {
  if (value === 'obsidian_import' || value === 'external_update_app' || value === 'agent_cli' || value === 'duocloud') {
    return value;
  }
  return 'duocloud';
}

function parsePatchBody(value: unknown): Record<string, unknown> {
  const body = asRecord(value);
  if (!body) {
    throw new KnowledgeAssetApiError(422, 'VALIDATION_ERROR', 'VALIDATION_ERROR: patch must be an object.');
  }
  return body;
}

function sendKnowledgeJson(
  res: Pick<Response, 'status' | 'json'>,
  statusCode: number,
  payload: Record<string, unknown>,
): void {
  res.status(statusCode).json(payload);
}

export function sendKnowledgeAssetError(
  res: Pick<Response, 'status' | 'json'>,
  error: unknown,
): void {
  if (error instanceof KnowledgeAssetApiError || error instanceof SessionAuthError) {
    sendKnowledgeJson(res, error.statusCode, {
      success: false,
      code: error.code,
      message: error.message,
    });
    return;
  }

  console.error(error);
  sendKnowledgeJson(res, 500, {
    success: false,
    code: 'KNOWLEDGE_API_ERROR',
    message: error instanceof Error ? error.message : String(error),
  });
}

export function normalizeKnowledgeAssetId(id: string): string {
  return id.trim().replace(/[^A-Za-z0-9_-]/g, '_');
}

function applyKnowledgeAccessPolicy(
  asset: KnowledgeAsset,
  options: {
    actor: SessionUser;
    source: KnowledgeAssetSource;
    existing?: KnowledgeAssetDocument | null;
  },
): KnowledgeAsset {
  if (options.existing && options.existing.serverStatus !== 'archived' && !options.existing.serverDeletedAt) {
    return {
      ...asset,
      access: options.existing.access,
      ownerUid: options.existing.ownerUid,
      ownerUsername: options.existing.ownerUsername,
    };
  }

  if (options.source === 'duocloud') {
    return {
      ...asset,
      access: 'private',
      ownerUid: options.actor.uid,
      ownerUsername: options.actor.username,
    };
  }

  return {
    ...asset,
    access: 'public',
    ownerUid: undefined,
    ownerUsername: undefined,
  };
}

export function validateKnowledgeAssetPayload(
  value: unknown,
): { valid: true } | { valid: false; message: string } {
  const record = asRecord(value);
  if (!record) {
    return { valid: false, message: 'VALIDATION_ERROR: payload must be an object.' };
  }

  if (typeof record.id !== 'string' || !normalizeKnowledgeAssetId(record.id)) {
    return { valid: false, message: 'VALIDATION_ERROR: id is required.' };
  }

  if (!isKnowledgeCategory(record.category)) {
    return { valid: false, message: 'VALIDATION_ERROR: category is invalid.' };
  }

  if (typeof record.title !== 'string' || !record.title.trim()) {
    return { valid: false, message: 'VALIDATION_ERROR: title is required.' };
  }

  if (!Array.isArray(record.tags) || record.tags.some(tag => typeof tag !== 'string')) {
    return { valid: false, message: 'VALIDATION_ERROR: tags must be a string array.' };
  }

  if (typeof record.lastUpdated !== 'string' || !record.lastUpdated.trim()) {
    return { valid: false, message: 'VALIDATION_ERROR: lastUpdated is required.' };
  }

  if (typeof record.author !== 'string' || !record.author.trim()) {
    return { valid: false, message: 'VALIDATION_ERROR: author is required.' };
  }

  if (typeof record.content !== 'string') {
    return { valid: false, message: 'VALIDATION_ERROR: content must be a string.' };
  }

  // Structured category fields are optional so historical Obsidian imports,
  // partial drafts, and human-entered cards can be saved incrementally.

  return { valid: true };
}

export function applyKnowledgeAssetUpdate(
  asset: KnowledgeAsset,
  options: {
    actor: SessionUser;
    now?: Date;
    existingVersion?: number;
    source: KnowledgeAssetSource;
    existingCreatedAt?: Date;
    existingCreatedBy?: KnowledgeAssetActor;
  },
): KnowledgeAssetDocument {
  const now = options.now ?? new Date();
  const actor = toActor(options.actor);

  return {
    ...asset,
    _id: normalizeKnowledgeAssetId(asset.id),
    id: normalizeKnowledgeAssetId(asset.id),
    tags: asset.tags.map(tag => tag.trim()).filter(Boolean),
    lastUpdated: formatDateOnly(now),
    serverStatus: 'active',
    serverSource: options.source,
    serverVersion: (options.existingVersion ?? 0) + 1,
    serverCreatedAt: options.existingCreatedAt ?? now,
    serverUpdatedAt: now,
    serverCreatedBy: options.existingCreatedBy ?? actor,
    serverUpdatedBy: actor,
  };
}

async function upsertKnowledgeAsset(
  rawAsset: unknown,
  options: {
    actor: SessionUser;
    source: KnowledgeAssetSource;
    operation: KnowledgeAssetOperation;
  },
): Promise<{
  status: 'created' | 'updated' | 'skipped';
  asset: KnowledgeAssetDocument;
}> {
  const rawNormalizedAsset = ensureNormalizedKnowledgeAsset(rawAsset);
  const collection = await getKnowledgeAssetsCollection();
  const existing = await collection.findOne({ _id: rawNormalizedAsset.id });
  const existingBySourcePath = !existing && options.source === 'obsidian_import' && rawNormalizedAsset.sourcePath
    ? await collection.findOne({
        sourcePath: rawNormalizedAsset.sourcePath,
        serverStatus: { $ne: 'archived' },
        serverDeletedAt: { $exists: false },
      } as Filter<KnowledgeAssetDocument>)
    : null;
  if (existingBySourcePath) {
    return { status: 'skipped', asset: existingBySourcePath };
  }
  const asset = applyKnowledgeAccessPolicy(rawNormalizedAsset, {
    actor: options.actor,
    source: options.source,
    existing,
  });

  if (
    existing
    && existing.serverStatus !== 'archived'
    && !existing.serverDeletedAt
    && isSameKnowledgeAssetContent(existing, asset)
  ) {
    return { status: 'skipped', asset: existing };
  }

  const now = new Date();
  const next = applyKnowledgeAssetUpdate(asset, {
    actor: options.actor,
    now,
    existingVersion: existing?.serverStatus === 'archived' ? 0 : existing?.serverVersion ?? 0,
    source: options.source,
    existingCreatedAt: existing?.serverCreatedAt,
    existingCreatedBy: existing?.serverCreatedBy,
  });

  await collection.replaceOne({ _id: next._id }, next, { upsert: true });
  await writeRevision(next._id, options.operation, options.actor, existing, next, now);

  return {
    status: existing && existing.serverStatus !== 'archived' && !existing.serverDeletedAt ? 'updated' : 'created',
    asset: next,
  };
}

export async function handleKnowledgeAssetsRequest(
  req: Pick<Request, 'method' | 'headers' | 'body' | 'query'>,
  res: Pick<Response, 'status' | 'json'>,
): Promise<void> {
  if (req.method === 'GET') {
    requireKnowledgeSession(req);
    const collection = await getKnowledgeAssetsCollection();
    const filter = buildActiveFilter();
    const category = getQueryString(req.query.category);
    const search = getQueryString(req.query.q)?.trim();

    if (category && isKnowledgeCategory(category)) {
      filter.category = category;
    }

    if (search) {
      filter.$or = [
        { _id: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    const items = await collection.find(filter).sort({ serverUpdatedAt: -1, _id: 1 }).toArray();
    sendKnowledgeJson(res, 200, { success: true, data: items });
    return;
  }

  if (req.method === 'POST') {
    const actor = requireKnowledgeRole(req, ['editor', 'admin']);
    const rawIncomingAsset = ensureNormalizedKnowledgeAsset(parseBody(req.body));
    const collection = await getKnowledgeAssetsCollection();
    const existing = await collection.findOne({ _id: rawIncomingAsset.id });
    if (existing && existing.serverStatus !== 'archived' && !existing.serverDeletedAt) {
      throw new KnowledgeAssetApiError(409, 'CONFLICT', 'CONFLICT: 知识卡片已存在。');
    }
    const incomingAsset = applyKnowledgeAccessPolicy(rawIncomingAsset, {
      actor,
      source: 'duocloud',
      existing,
    });

    const now = new Date();
    const next = applyKnowledgeAssetUpdate(incomingAsset, {
      actor,
      now,
      existingVersion: 0,
      source: 'duocloud',
      existingCreatedAt: existing?.serverCreatedAt,
      existingCreatedBy: existing?.serverCreatedBy,
    });

    await collection.replaceOne({ _id: next._id }, next, { upsert: true });
    await writeRevision(next._id, 'create', actor, existing, next, now);
    sendKnowledgeJson(res, 201, { success: true, data: next });
    return;
  }

  throw new KnowledgeAssetApiError(405, 'METHOD_NOT_ALLOWED', 'METHOD_NOT_ALLOWED: 仅支持 GET 或 POST。');
}

export async function handleKnowledgeAssetDocumentRequest(
  req: Pick<Request, 'method' | 'headers' | 'body' | 'query'>,
  res: Pick<Response, 'status' | 'json'>,
): Promise<void> {
  const id = getKnowledgeAssetIdFromRequest(req);

  if (req.method === 'GET') {
    requireKnowledgeSession(req);
    const asset = await findActiveAssetById(id);
    if (!asset) {
      throw new KnowledgeAssetApiError(404, 'NOT_FOUND', 'NOT_FOUND: 未找到知识卡片。');
    }
    sendKnowledgeJson(res, 200, { success: true, data: asset });
    return;
  }

  if (req.method === 'PUT') {
    const actor = requireKnowledgeRole(req, ['editor', 'admin']);
    const rawBody = asRecord(parseBody(req.body)) ?? {};
    const expectedServerVersion = getRequestServerVersion(rawBody);
    if (expectedServerVersion === null) {
      throw new KnowledgeAssetApiError(
        422,
        'VALIDATION_ERROR',
        'VALIDATION_ERROR: serverVersion is required.',
      );
    }

    const existing = await findActiveAssetById(id);
    if (!existing) {
      throw new KnowledgeAssetApiError(404, 'NOT_FOUND', 'NOT_FOUND: 未找到知识卡片。');
    }

    const rawIncomingAsset = ensureNormalizedKnowledgeAsset({ ...rawBody, id });
    const incomingAsset = applyKnowledgeAccessPolicy(rawIncomingAsset, {
      actor,
      source: existing.serverSource,
      existing,
    });
    const now = new Date();
    const next = applyKnowledgeAssetUpdate(incomingAsset, {
      actor,
      now,
      existingVersion: expectedServerVersion,
      source: existing.serverSource,
      existingCreatedAt: existing.serverCreatedAt,
      existingCreatedBy: existing.serverCreatedBy,
    });

    const collection = await getKnowledgeAssetsCollection();
    const replaceResult = await collection.replaceOne(
      { _id: id, serverVersion: expectedServerVersion, serverStatus: { $ne: 'archived' } },
      next,
    );

    if (replaceResult.matchedCount === 0) {
      throw new KnowledgeAssetApiError(409, 'CONFLICT', 'CONFLICT: serverVersion mismatch.');
    }

    await writeRevision(id, 'update', actor, existing, next, now);
    sendKnowledgeJson(res, 200, { success: true, data: next });
    return;
  }

  if (req.method === 'DELETE') {
    const actor = requireKnowledgeRole(req, ['admin']);
    const rawBody = asRecord(parseBody(req.body)) ?? {};
    const expectedServerVersion = getRequestServerVersion(rawBody);
    if (expectedServerVersion === null) {
      throw new KnowledgeAssetApiError(
        422,
        'VALIDATION_ERROR',
        'VALIDATION_ERROR: serverVersion is required.',
      );
    }

    const existing = await findActiveAssetById(id);
    if (!existing) {
      throw new KnowledgeAssetApiError(404, 'NOT_FOUND', 'NOT_FOUND: 未找到知识卡片。');
    }

    const now = new Date();
    const archived: KnowledgeAssetDocument = {
      ...existing,
      serverStatus: 'archived',
      serverDeletedAt: now,
      serverUpdatedAt: now,
      serverUpdatedBy: toActor(actor),
      lastUpdated: formatDateOnly(now),
      serverVersion: expectedServerVersion + 1,
    };

    const collection = await getKnowledgeAssetsCollection();
    const replaceResult = await collection.replaceOne(
      { _id: id, serverVersion: expectedServerVersion, serverStatus: { $ne: 'archived' } },
      archived,
    );
    if (replaceResult.matchedCount === 0) {
      throw new KnowledgeAssetApiError(409, 'CONFLICT', 'CONFLICT: serverVersion mismatch.');
    }

    await writeRevision(id, 'delete', actor, existing, archived, now);
    sendKnowledgeJson(res, 200, { success: true, data: archived });
    return;
  }

  throw new KnowledgeAssetApiError(405, 'METHOD_NOT_ALLOWED', 'METHOD_NOT_ALLOWED: 仅支持 GET、PUT 或 DELETE。');
}

export async function handleKnowledgeAssetBulkRequest(
  req: Pick<Request, 'method' | 'headers' | 'body'>,
  res: Pick<Response, 'status' | 'json'>,
): Promise<void> {
  if (req.method !== 'POST') {
    throw new KnowledgeAssetApiError(405, 'METHOD_NOT_ALLOWED', 'METHOD_NOT_ALLOWED: 仅支持 POST。');
  }

  const actor = requireKnowledgeRole(req, ['admin']);
  const payload = (asRecord(parseBody(req.body)) ?? {}) as BulkRequestBody & Record<string, unknown>;
  const source = getKnowledgeAssetSource(payload.source);
  const input = typeof payload.input === 'string' && payload.input.trim() ? payload.input.trim() : 'bulk-request';
  const rawAssets = Array.isArray(payload.assets) ? payload.assets : null;

  if (!rawAssets) {
    throw new KnowledgeAssetApiError(422, 'VALIDATION_ERROR', 'VALIDATION_ERROR: assets must be an array.');
  }

  const importJobs = await getKnowledgeAssetImportJobsCollection();
  const startedAt = new Date();
  const job: KnowledgeAssetImportJobDocument = {
    source,
    input,
    status: 'running',
    startedAt,
    counts: { created: 0, updated: 0, skipped: 0, failed: 0 },
    errors: [],
  };
  const insertResult = await importJobs.insertOne(job);

  for (const rawAsset of rawAssets) {
    try {
      const result = await upsertKnowledgeAsset(rawAsset, {
        actor,
        source,
        operation: 'bulk-import',
      });
      job.counts[result.status] += 1;
    } catch (error) {
      const record = asRecord(rawAsset);
      const id = typeof record?.id === 'string' ? normalizeKnowledgeAssetId(record.id) : 'unknown';
      job.counts.failed += 1;
      job.errors.push({
        id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  job.status = 'completed';
  job.completedAt = new Date();

  await importJobs.updateOne(
    { _id: insertResult.insertedId },
    { $set: { status: job.status, completedAt: job.completedAt, counts: job.counts, errors: job.errors } },
  );

  sendKnowledgeJson(res, 200, {
    success: true,
    data: {
      jobId: insertResult.insertedId,
      counts: job.counts,
      errors: job.errors,
    },
  });
}

export async function handleKnowledgeAssetAgentRequest(
  req: Pick<Request, 'method' | 'headers' | 'body' | 'query'>,
  res: Pick<Response, 'status' | 'json'>,
): Promise<void> {
  const actor = requireKnowledgeRole(req, ['admin']);

  if (req.method === 'GET') {
    const collection = await getKnowledgeAssetsCollection();
    const activeCount = (await collection.find(buildActiveFilter()).toArray()).length;
    sendKnowledgeJson(res, 200, {
      success: true,
      data: {
        ok: true,
        service: 'duocloud-knowledge-agent-api',
        actor: toActor(actor),
        role: actor.role,
        activeCount,
        categories: KNOWLEDGE_CATEGORIES,
      },
    });
    return;
  }

  if (req.method !== 'POST') {
    throw new KnowledgeAssetApiError(405, 'METHOD_NOT_ALLOWED', 'METHOD_NOT_ALLOWED: 仅支持 GET 或 POST。');
  }

  const payload = asRecord(parseBody(req.body)) ?? {};
  const action = getAgentAction(payload.action);
  if (!action) {
    throw new KnowledgeAssetApiError(422, 'VALIDATION_ERROR', 'VALIDATION_ERROR: unsupported agent action.');
  }
  const source = getKnowledgeAssetSource(payload.source ?? 'agent_cli');

  if (action === 'health') {
    sendKnowledgeJson(res, 200, {
      success: true,
      data: { ok: true, service: 'duocloud-knowledge-agent-api', actor: toActor(actor), role: actor.role },
    });
    return;
  }

  if (action === 'upsert') {
    const result = await upsertKnowledgeAsset(payload.asset, {
      actor,
      source,
      operation: 'agent-upsert',
    });
    sendKnowledgeJson(res, result.status === 'created' ? 201 : 200, {
      success: true,
      data: {
        status: result.status,
        asset: result.asset,
      },
    });
    return;
  }

  if (action === 'patch') {
    const id = typeof payload.id === 'string' ? normalizeKnowledgeAssetId(payload.id) : '';
    if (!id) {
      throw new KnowledgeAssetApiError(422, 'VALIDATION_ERROR', 'VALIDATION_ERROR: id is required.');
    }

    const existing = await findActiveAssetById(id);
    if (!existing) {
      throw new KnowledgeAssetApiError(404, 'NOT_FOUND', 'NOT_FOUND: 未找到知识卡片。');
    }

    const patch = parsePatchBody(payload.patch);
    const merged = {
      ...stripKnowledgeAssetMetadata(existing),
      ...patch,
      id,
    };
    const result = await upsertKnowledgeAsset(merged, {
      actor,
      source,
      operation: 'agent-patch',
    });
    sendKnowledgeJson(res, 200, {
      success: true,
      data: {
        status: result.status,
        asset: result.asset,
      },
    });
    return;
  }

  if (action === 'delete') {
    const id = typeof payload.id === 'string' ? normalizeKnowledgeAssetId(payload.id) : '';
    if (!id) {
      throw new KnowledgeAssetApiError(422, 'VALIDATION_ERROR', 'VALIDATION_ERROR: id is required.');
    }

    const existing = await findActiveAssetById(id);
    if (!existing) {
      throw new KnowledgeAssetApiError(404, 'NOT_FOUND', 'NOT_FOUND: 未找到知识卡片。');
    }

    const now = new Date();
    const archived: KnowledgeAssetDocument = {
      ...existing,
      serverStatus: 'archived',
      serverDeletedAt: now,
      serverUpdatedAt: now,
      serverUpdatedBy: toActor(actor),
      lastUpdated: formatDateOnly(now),
      serverVersion: existing.serverVersion + 1,
    };

    const collection = await getKnowledgeAssetsCollection();
    await collection.replaceOne({ _id: id }, archived);
    await writeRevision(id, 'delete', actor, existing, archived, now);
    sendKnowledgeJson(res, 200, { success: true, data: { status: 'deleted', asset: archived } });
    return;
  }

  if (action === 'bulk') {
    const rawAssets = Array.isArray(payload.assets) ? payload.assets : null;
    if (!rawAssets) {
      throw new KnowledgeAssetApiError(422, 'VALIDATION_ERROR', 'VALIDATION_ERROR: assets must be an array.');
    }

    const counts = { created: 0, updated: 0, skipped: 0, failed: 0 };
    const errors: Array<{ id: string; message: string }> = [];
    for (const rawAsset of rawAssets) {
      try {
        const result = await upsertKnowledgeAsset(rawAsset, {
          actor,
          source,
          operation: 'agent-upsert',
        });
        counts[result.status] += 1;
      } catch (error) {
        const record = asRecord(rawAsset);
        const id = typeof record?.id === 'string' ? normalizeKnowledgeAssetId(record.id) : 'unknown';
        counts.failed += 1;
        errors.push({ id, message: error instanceof Error ? error.message : String(error) });
      }
    }

    sendKnowledgeJson(res, 200, { success: true, data: { counts, errors } });
    return;
  }

  throw new KnowledgeAssetApiError(422, 'VALIDATION_ERROR', 'VALIDATION_ERROR: unsupported agent action.');
}

export async function handleKnowledgeAssetExportRequest(
  req: Pick<Request, 'method' | 'headers'>,
  res: Pick<Response, 'status' | 'json'>,
): Promise<void> {
  if (req.method !== 'GET') {
    throw new KnowledgeAssetApiError(405, 'METHOD_NOT_ALLOWED', 'METHOD_NOT_ALLOWED: 仅支持 GET。');
  }

  requireKnowledgeSession(req);
  const collection = await getKnowledgeAssetsCollection();
  const items = await collection.find(buildActiveFilter()).sort({ serverUpdatedAt: -1, _id: 1 }).toArray();

  sendKnowledgeJson(res, 200, {
    success: true,
    data: items,
  });
}
