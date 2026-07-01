import type { Request, Response } from 'express';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { getSessionSecret, requireRole, SessionAuthError } from './sessionAuth.ts';

const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024;

class KnowledgeAttachmentApiError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'KnowledgeAttachmentApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function sendKnowledgeJson(
  res: Pick<Response, 'status' | 'json'>,
  statusCode: number,
  payload: Record<string, unknown>,
): void {
  res.status(statusCode).json(payload);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function parseBody(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseUploadClientPayload(value: string | null): { contentType?: string; size?: number } {
  if (!value) return {};
  const payload = asRecord(parseBody(value));
  if (!payload) return {};
  const contentType = typeof payload.contentType === 'string' && payload.contentType.trim()
    ? payload.contentType.trim()
    : undefined;
  const size = typeof payload.size === 'number' && Number.isFinite(payload.size) ? payload.size : undefined;
  return { contentType, size };
}

function validateClientUploadRequest(pathname: string, clientPayload: string | null) {
  if (!pathname.startsWith('knowledge-assets/')) {
    throw new KnowledgeAttachmentApiError(422, 'VALIDATION_ERROR', 'VALIDATION_ERROR: 附件路径不正确。');
  }
  if (pathname.includes('..') || /[\u0000-\u001F]/.test(pathname)) {
    throw new KnowledgeAttachmentApiError(422, 'VALIDATION_ERROR', 'VALIDATION_ERROR: 附件路径包含非法字符。');
  }

  const metadata = parseUploadClientPayload(clientPayload);
  if (metadata.size !== undefined && metadata.size > MAX_ATTACHMENT_BYTES) {
    throw new KnowledgeAttachmentApiError(413, 'PAYLOAD_TOO_LARGE', 'PAYLOAD_TOO_LARGE: 附件不能超过 100MB。');
  }
  return metadata;
}

export function sendKnowledgeAttachmentError(
  res: Pick<Response, 'status' | 'json'>,
  error: unknown,
): void {
  if (error instanceof KnowledgeAttachmentApiError || error instanceof SessionAuthError) {
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
    code: 'KNOWLEDGE_ATTACHMENT_API_ERROR',
    message: error instanceof Error ? error.message : String(error),
  });
}

export async function handleKnowledgeAttachmentUploadRequest(
  req: Pick<Request, 'method' | 'headers' | 'body'>,
  res: Pick<Response, 'status' | 'json'>,
): Promise<void> {
  if (req.method !== 'POST') {
    throw new KnowledgeAttachmentApiError(405, 'METHOD_NOT_ALLOWED', 'METHOD_NOT_ALLOWED: 仅支持 POST。');
  }

  const uploadResponse = await handleUpload({
    request: req as Request,
    body: parseBody(req.body) as HandleUploadBody,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      requireRole(req, getSessionSecret(), ['editor', 'admin']);
      const metadata = validateClientUploadRequest(pathname, clientPayload);
      return {
        allowedContentTypes: metadata.contentType ? [metadata.contentType] : undefined,
        maximumSizeInBytes: MAX_ATTACHMENT_BYTES,
        addRandomSuffix: true,
        tokenPayload: clientPayload,
      };
    },
    onUploadCompleted: async ({ blob }) => {
      console.info('Knowledge attachment uploaded to Vercel Blob', {
        pathname: blob.pathname,
        url: blob.url,
      });
    },
  });

  sendKnowledgeJson(res, 200, uploadResponse);
}
