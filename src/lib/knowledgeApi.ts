import type { KnowledgeAsset } from '../types';
import { createKnowledgeAsset } from './appState';

export interface KnowledgeApiBulkResult {
  jobId?: unknown;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ id: string; message: string }>;
}

export interface KnowledgeBulkPatchPayload {
  assets: KnowledgeAsset[];
}

interface KnowledgeApiResponse<T> {
  success?: unknown;
  data?: T;
  message?: unknown;
  code?: unknown;
}

export class KnowledgeApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, options: { code?: string; status?: number } = {}) {
    super(message);
    this.name = 'KnowledgeApiError';
    this.code = options.code ?? 'KNOWLEDGE_API_ERROR';
    this.status = options.status ?? 0;
  }
}

function getApiMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && typeof (payload as { message?: unknown }).message === 'string') {
    return (payload as { message: string }).message;
  }
  return fallback;
}

function getApiCode(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && typeof (payload as { code?: unknown }).code === 'string') {
    return (payload as { code: string }).code;
  }
  return fallback;
}

async function readKnowledgeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function assertResponseOk(response: Response, payload: unknown): void {
  if (response.status === 401) {
    throw new KnowledgeApiError(getApiMessage(payload, '登录已过期，请重新登录。'), {
      code: 'UNAUTHORIZED',
      status: response.status,
    });
  }

  if (!response.ok) {
    throw new KnowledgeApiError(getApiMessage(payload, '知识云请求失败。'), {
      code: getApiCode(payload, 'KNOWLEDGE_API_ERROR'),
      status: response.status,
    });
  }
}

async function requestKnowledgeApi<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new KnowledgeApiError('无法连接知识云服务，请检查网络或稍后重试。', {
      code: 'NETWORK_ERROR',
    });
  }

  const payload = await readKnowledgeJson(response);
  assertResponseOk(response, payload);
  return payload as T;
}

function isKnowledgeAssetLike(value: unknown): value is KnowledgeAsset {
  if (!value || typeof value !== 'object') return false;
  const asset = value as Partial<KnowledgeAsset>;
  return (
    typeof asset.id === 'string'
    && typeof asset.title === 'string'
    && typeof asset.category === 'string'
    && typeof asset.content === 'string'
    && typeof asset.author === 'string'
    && typeof asset.lastUpdated === 'string'
    && Array.isArray(asset.tags)
  );
}

export function parseKnowledgeApiListResponse(payload: unknown): KnowledgeAsset[] {
  const response = payload as KnowledgeApiResponse<unknown>;
  if (!response?.success) {
    throw new KnowledgeApiError(getApiMessage(payload, '知识云列表读取失败。'), {
      code: getApiCode(payload, 'KNOWLEDGE_API_ERROR'),
    });
  }

  if (!Array.isArray(response.data) || response.data.some(item => !isKnowledgeAssetLike(item))) {
    throw new KnowledgeApiError('知识卡列表响应格式不正确。', {
      code: 'INVALID_RESPONSE',
    });
  }

  return response.data as KnowledgeAsset[];
}

export function parseKnowledgeApiAssetResponse(payload: unknown): KnowledgeAsset {
  const response = payload as KnowledgeApiResponse<unknown>;
  if (!response?.success) {
    throw new KnowledgeApiError(getApiMessage(payload, '知识卡请求失败。'), {
      code: getApiCode(payload, 'KNOWLEDGE_API_ERROR'),
    });
  }

  if (!isKnowledgeAssetLike(response.data)) {
    throw new KnowledgeApiError('知识卡响应格式不正确。', {
      code: 'INVALID_RESPONSE',
    });
  }

  return response.data;
}

export function parseBulkResult(payload: unknown): KnowledgeApiBulkResult {
  const response = payload as KnowledgeApiResponse<unknown>;
  const data = response?.data as Partial<KnowledgeApiBulkResult> & {
    counts?: Partial<Pick<KnowledgeApiBulkResult, 'created' | 'updated' | 'skipped' | 'failed'>>;
  } | undefined;
  if (!response?.success) {
    throw new KnowledgeApiError(getApiMessage(payload, '知识云批量请求失败。'), {
      code: getApiCode(payload, 'KNOWLEDGE_API_ERROR'),
    });
  }

  if (
    data
    && typeof data.created === 'number'
    && typeof data.updated === 'number'
    && typeof data.skipped === 'number'
    && typeof data.failed === 'number'
    && Array.isArray(data.errors)
  ) {
    return { created: data.created, updated: data.updated, skipped: data.skipped, failed: data.failed, errors: data.errors };
  }

  if (
    !data
    || typeof data !== 'object'
    || !data.counts
    || typeof data.counts.created !== 'number'
    || typeof data.counts.updated !== 'number'
    || typeof data.counts.skipped !== 'number'
    || typeof data.counts.failed !== 'number'
    || !Array.isArray(data.errors)
  ) {
    throw new KnowledgeApiError('知识云批量响应格式不正确。', {
      code: 'INVALID_RESPONSE',
    });
  }

  return {
    ...(data.jobId === undefined ? {} : { jobId: data.jobId }),
    created: data.counts.created,
    updated: data.counts.updated,
    skipped: data.counts.skipped,
    failed: data.counts.failed,
    errors: data.errors,
  };
}

export const parseKnowledgeApiBulkResponse = parseBulkResult;

export async function listKnowledgeAssets(): Promise<KnowledgeAsset[]> {
  const payload = await requestKnowledgeApi<unknown>('/api/knowledge-assets');
  return parseKnowledgeApiListResponse(payload);
}

export async function createRemoteKnowledgeAsset(asset: Omit<KnowledgeAsset, 'id' | 'lastUpdated'>): Promise<KnowledgeAsset> {
  const fullAsset = createKnowledgeAsset(asset);
  const payload = await requestKnowledgeApi<unknown>('/api/knowledge-assets', {
    method: 'POST',
    body: JSON.stringify(fullAsset),
  });
  return parseKnowledgeApiAssetResponse(payload);
}

export async function updateRemoteKnowledgeAsset(asset: KnowledgeAsset): Promise<KnowledgeAsset> {
  const payload = await requestKnowledgeApi<unknown>(`/api/knowledge-assets/${encodeURIComponent(asset.id)}`, {
    method: 'PUT',
    body: JSON.stringify(asset),
  });
  return parseKnowledgeApiAssetResponse(payload);
}

export async function deleteRemoteKnowledgeAsset(id: string, version: number): Promise<void> {
  await requestKnowledgeApi<unknown>(`/api/knowledge-assets/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: JSON.stringify({ serverVersion: version }),
  });
}

async function postKnowledgeBulk(payload: {
  assets: KnowledgeAsset[];
  source?: 'duocloud' | 'obsidian_import' | 'external_update_app';
  input?: string;
}): Promise<KnowledgeApiBulkResult> {
  const response = await requestKnowledgeApi<unknown>('/api/knowledge-assets/bulk', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return parseBulkResult(response);
}

export async function bulkUpdateKnowledgeAssets(payload: {
  assets: KnowledgeAsset[];
  source?: 'duocloud' | 'obsidian_import' | 'external_update_app';
  input?: string;
}): Promise<KnowledgeApiBulkResult> {
  return postKnowledgeBulk(payload);
}

export async function bulkImportKnowledgeAssets(
  assets: Array<Omit<KnowledgeAsset, 'id' | 'lastUpdated'>>,
): Promise<KnowledgeApiBulkResult> {
  return postKnowledgeBulk({
    assets: assets.map(asset => createKnowledgeAsset(asset)),
    source: 'duocloud',
    input: 'duocloud-import',
  });
}

export async function bulkPatchKnowledgeAssets(payload: KnowledgeBulkPatchPayload): Promise<KnowledgeApiBulkResult> {
  return postKnowledgeBulk({
    assets: payload.assets,
    source: 'duocloud',
    input: 'duocloud-bulk-patch',
  });
}

export async function exportRemoteKnowledgeAssets(): Promise<KnowledgeAsset[]> {
  const payload = await requestKnowledgeApi<unknown>('/api/knowledge-assets/export');
  return parseKnowledgeApiListResponse(payload);
}
