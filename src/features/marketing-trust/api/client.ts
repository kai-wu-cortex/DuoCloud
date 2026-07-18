import type {
  MarketingEvidenceAsset,
  MarketingEvidenceAttachmentSummary,
  MarketingEvidenceContentForm,
  MarketingEvidenceDraft,
  MarketingEvidenceStatus,
} from '../domain/types';
import type { MarketingEvidencePreferences } from './preferences';

export class MarketingEvidenceApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status = 0, details?: unknown) {
    super(`${code}: ${message}`);
    this.name = 'MarketingEvidenceApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface MarketingEvidenceListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  statuses?: MarketingEvidenceStatus[];
  contentForms?: MarketingEvidenceContentForm[];
  ownerId?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  includeDeleted?: boolean;
}

export interface MarketingEvidenceListResult {
  items: MarketingEvidenceAsset[];
  meta: { total: number; page: number; pageSize: number };
}

export interface MarketingEvidenceDetail {
  evidence: MarketingEvidenceAsset;
  attachments: MarketingEvidenceAttachmentSummary[];
  latestReview: Record<string, unknown> | null;
  auditLogs: Array<Record<string, unknown>>;
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  code?: string;
  message?: string;
  details?: unknown;
}

function stableQuery(query: MarketingEvidenceListQuery): string {
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '' || value === false) continue;
    values[key] = Array.isArray(value)
      ? [...value].sort().join(',')
      : String(value);
  }
  const params = new URLSearchParams();
  for (const key of Object.keys(values).sort()) params.set(key, values[key]);
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

async function readEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new MarketingEvidenceApiError(
      'INVALID_RESPONSE',
      '服务器返回了无法识别的响应。',
      response.status,
    );
  }
  let envelope: ApiEnvelope<T>;
  try {
    envelope = await response.json() as ApiEnvelope<T>;
  } catch {
    throw new MarketingEvidenceApiError(
      'INVALID_RESPONSE',
      '服务器响应无法解析。',
      response.status,
    );
  }
  if (!envelope || typeof envelope !== 'object') {
    throw new MarketingEvidenceApiError(
      'INVALID_RESPONSE',
      '服务器响应格式无效。',
      response.status,
    );
  }
  if (!response.ok || envelope.success !== true) {
    throw new MarketingEvidenceApiError(
      envelope.code || 'REQUEST_FAILED',
      envelope.message || '营销可信请求失败。',
      response.status,
      envelope.details,
    );
  }
  return envelope;
}

async function request<T>(
  path: string,
  init: RequestInit,
  fetcher: typeof fetch,
): Promise<ApiEnvelope<T>> {
  try {
    const response = await fetcher(path, {
      ...init,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    return await readEnvelope<T>(response);
  } catch (error) {
    if (error instanceof MarketingEvidenceApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new MarketingEvidenceApiError(
      'NETWORK_ERROR',
      '无法连接营销可信服务，请检查网络后重试。',
    );
  }
}

export async function listMarketingEvidence(
  query: MarketingEvidenceListQuery = {},
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<MarketingEvidenceListResult> {
  const envelope = await request<MarketingEvidenceAsset[]>(
    `/api/marketing-evidence${stableQuery(query)}`,
    { method: 'GET', signal },
    fetcher,
  );
  return {
    items: Array.isArray(envelope.data) ? envelope.data : [],
    meta: {
      total: Number(envelope.meta?.total ?? 0),
      page: Number(envelope.meta?.page ?? query.page ?? 1),
      pageSize: Number(envelope.meta?.pageSize ?? query.pageSize ?? 20),
    },
  };
}

export async function createMarketingEvidence(
  draft: MarketingEvidenceDraft,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<MarketingEvidenceAsset> {
  return (await request<MarketingEvidenceAsset>(
    '/api/marketing-evidence',
    { method: 'POST', body: JSON.stringify(draft), signal },
    fetcher,
  )).data as MarketingEvidenceAsset;
}

export async function getMarketingEvidence(
  evidenceId: string,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<MarketingEvidenceDetail> {
  return (await request<MarketingEvidenceDetail>(
    `/api/marketing-evidence/${encodeURIComponent(evidenceId)}`,
    { method: 'GET', signal },
    fetcher,
  )).data as MarketingEvidenceDetail;
}

export async function updateMarketingEvidence(
  evidenceId: string,
  patch: MarketingEvidenceDraft,
  expectedVersion: number,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<MarketingEvidenceAsset> {
  return (await request<MarketingEvidenceAsset>(
    `/api/marketing-evidence/${encodeURIComponent(evidenceId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ expectedVersion, patch }),
      signal,
    },
    fetcher,
  )).data as MarketingEvidenceAsset;
}

export async function deleteMarketingEvidence(
  evidenceId: string,
  expectedVersion: number,
  fetcher: typeof fetch = fetch,
): Promise<MarketingEvidenceAsset> {
  return (await request<MarketingEvidenceAsset>(
    `/api/marketing-evidence/${encodeURIComponent(evidenceId)}`,
    { method: 'DELETE', body: JSON.stringify({ expectedVersion }) },
    fetcher,
  )).data as MarketingEvidenceAsset;
}

export async function submitMarketingEvidence(
  evidenceId: string,
  action: 'submit' | 'withdraw',
  expectedVersion: number,
  fetcher: typeof fetch = fetch,
): Promise<MarketingEvidenceAsset> {
  return (await request<MarketingEvidenceAsset>(
    `/api/marketing-evidence/${encodeURIComponent(evidenceId)}/submit`,
    { method: 'POST', body: JSON.stringify({ action, expectedVersion }) },
    fetcher,
  )).data as MarketingEvidenceAsset;
}

export async function reviewMarketingEvidence(
  evidenceId: string,
  decision: 'approve' | 'reject' | 'unlist' | 'reshare',
  expectedVersion: number,
  comment?: string,
  fetcher: typeof fetch = fetch,
): Promise<MarketingEvidenceAsset> {
  return (await request<MarketingEvidenceAsset>(
    `/api/marketing-evidence/${encodeURIComponent(evidenceId)}/review`,
    {
      method: 'POST',
      body: JSON.stringify({ decision, expectedVersion, ...(comment ? { comment } : {}) }),
    },
    fetcher,
  )).data as MarketingEvidenceAsset;
}

export async function restoreMarketingEvidence(
  evidenceId: string,
  expectedVersion: number,
  fetcher: typeof fetch = fetch,
): Promise<MarketingEvidenceAsset> {
  return (await request<MarketingEvidenceAsset>(
    `/api/marketing-evidence/${encodeURIComponent(evidenceId)}/restore`,
    { method: 'POST', body: JSON.stringify({ expectedVersion }) },
    fetcher,
  )).data as MarketingEvidenceAsset;
}

export async function bulkUpdateMarketingEvidence(
  evidenceIds: string[],
  patch: Record<string, unknown>,
  expectedVersions: Record<string, number> = {},
  fetcher: typeof fetch = fetch,
) {
  return (await request<{
    updated: MarketingEvidenceAsset[];
    failed: Array<{ evidenceId: string; code: string }>;
  }>(
    '/api/marketing-evidence/bulk',
    {
      method: 'POST',
      body: JSON.stringify({ evidenceIds, patch, expectedVersions }),
    },
    fetcher,
  )).data;
}

export async function loadMarketingEvidencePreferences(
  fetcher: typeof fetch = fetch,
): Promise<MarketingEvidencePreferences> {
  return (await request<MarketingEvidencePreferences>(
    '/api/marketing-evidence/preferences',
    { method: 'GET' },
    fetcher,
  )).data as MarketingEvidencePreferences;
}

export async function saveMarketingEvidencePreferences(
  preferences: MarketingEvidencePreferences,
  fetcher: typeof fetch = fetch,
): Promise<MarketingEvidencePreferences> {
  return (await request<MarketingEvidencePreferences>(
    '/api/marketing-evidence/preferences',
    { method: 'PUT', body: JSON.stringify(preferences) },
    fetcher,
  )).data as MarketingEvidencePreferences;
}
