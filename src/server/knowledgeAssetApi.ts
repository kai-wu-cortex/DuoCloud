import type { Request, Response } from 'express';
import type { Collection, Document, Filter, OptionalId, ReplaceOptions } from 'mongodb';
import { KNOWLEDGE_FIELD_SCHEMAS } from '../lib/knowledgeFieldSchemas';
import { getMongoCollection } from '../lib/mongodb';
import type { KnowledgeAsset, KnowledgeTableType } from '../types';
import {
  SessionAuthError,
  getSessionSecret,
  requireRole,
  requireSession,
  type SessionUser,
} from './sessionAuth';

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

type KnowledgeAssetSource = 'duocloud' | 'obsidian_import' | 'external_update_app';
type KnowledgeAssetStatus = 'active' | 'archived' | 'draft';
type KnowledgeAssetOperation = 'create' | 'update' | 'delete' | 'bulk-import';

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

function formatDateOnly(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function isKnowledgeCategory(value: unknown): value is KnowledgeTableType {
  return typeof value === 'string' && KNOWLEDGE_CATEGORIES.includes(value as KnowledgeTableType);
}

function getRequiredCategoryFields(category: KnowledgeTableType) {
  return KNOWLEDGE_FIELD_SCHEMAS[category].fields.filter(field => field.required);
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

function isSameKnowledgeAssetContent(
  existing: KnowledgeAssetDocument,
  incoming: KnowledgeAsset,
): boolean {
  return JSON.stringify(stripKnowledgeAssetMetadata(existing)) === JSON.stringify(incoming);
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

  for (const field of getRequiredCategoryFields(record.category)) {
    if (typeof record[field.name] !== 'string' || !(record[field.name] as string).trim()) {
      return {
        valid: false,
        message: `VALIDATION_ERROR: ${field.name} (${field.label}) is required.`,
      };
    }
  }

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

export async function handleKnowledgeAssetsRequest(
  req: Pick<Request, 'method' | 'headers' | 'body' | 'query'>,
  res: Pick<Response, 'status' | 'json'>,
): Promise<void> {
  const secret = getSessionSecret();

  if (req.method === 'GET') {
    requireSession(req, secret);
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
    const actor = requireRole(req, secret, ['editor', 'admin']);
    const incomingAsset = ensureNormalizedKnowledgeAsset(parseBody(req.body));
    const collection = await getKnowledgeAssetsCollection();
    const existing = await collection.findOne({ _id: incomingAsset.id });
    if (existing && existing.serverStatus !== 'archived' && !existing.serverDeletedAt) {
      throw new KnowledgeAssetApiError(409, 'CONFLICT', 'CONFLICT: 知识卡片已存在。');
    }

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
  const secret = getSessionSecret();
  const id = getKnowledgeAssetIdFromRequest(req);

  if (req.method === 'GET') {
    requireSession(req, secret);
    const asset = await findActiveAssetById(id);
    if (!asset) {
      throw new KnowledgeAssetApiError(404, 'NOT_FOUND', 'NOT_FOUND: 未找到知识卡片。');
    }
    sendKnowledgeJson(res, 200, { success: true, data: asset });
    return;
  }

  if (req.method === 'PUT') {
    const actor = requireRole(req, secret, ['editor', 'admin']);
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

    const incomingAsset = ensureNormalizedKnowledgeAsset({ ...rawBody, id });
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
    const actor = requireRole(req, secret, ['admin']);
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

  const actor = requireRole(req, getSessionSecret(), ['admin']);
  const payload = (asRecord(parseBody(req.body)) ?? {}) as BulkRequestBody & Record<string, unknown>;
  const source: KnowledgeAssetSource =
    payload.source === 'obsidian_import' || payload.source === 'external_update_app'
      ? payload.source
      : 'duocloud';
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

  const collection = await getKnowledgeAssetsCollection();

  for (const rawAsset of rawAssets) {
    try {
      const asset = ensureNormalizedKnowledgeAsset(rawAsset);
      const existing = await collection.findOne({ _id: asset.id });

      if (existing && existing.serverStatus !== 'archived' && !existing.serverDeletedAt && isSameKnowledgeAssetContent(existing, asset)) {
        job.counts.skipped += 1;
        continue;
      }

      const now = new Date();
      const next = applyKnowledgeAssetUpdate(asset, {
        actor,
        now,
        existingVersion: existing?.serverStatus === 'archived' ? 0 : existing?.serverVersion ?? 0,
        source,
        existingCreatedAt: existing?.serverCreatedAt,
        existingCreatedBy: existing?.serverCreatedBy,
      });

      await collection.replaceOne({ _id: next._id }, next, { upsert: true });
      await writeRevision(next._id, 'bulk-import', actor, existing, next, now);

      if (existing && existing.serverStatus !== 'archived' && !existing.serverDeletedAt) {
        job.counts.updated += 1;
      } else {
        job.counts.created += 1;
      }
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

export async function handleKnowledgeAssetExportRequest(
  req: Pick<Request, 'method' | 'headers'>,
  res: Pick<Response, 'status' | 'json'>,
): Promise<void> {
  if (req.method !== 'GET') {
    throw new KnowledgeAssetApiError(405, 'METHOD_NOT_ALLOWED', 'METHOD_NOT_ALLOWED: 仅支持 GET。');
  }

  requireSession(req, getSessionSecret());
  const collection = await getKnowledgeAssetsCollection();
  const items = await collection.find(buildActiveFilter()).sort({ serverUpdatedAt: -1, _id: 1 }).toArray();

  sendKnowledgeJson(res, 200, {
    success: true,
    data: items,
  });
}
