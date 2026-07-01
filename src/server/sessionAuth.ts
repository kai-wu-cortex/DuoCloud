import { createHmac } from 'node:crypto';
import type { Request, Response } from 'express';

export type UserRole = 'viewer' | 'editor' | 'admin';

export interface SessionUser {
  uid: string;
  username: string;
  role: UserRole;
}

interface SessionPayload extends SessionUser {
  exp: number;
}

type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'METHOD_NOT_ALLOWED'
  | 'MONGODB_API_ERROR';

export class SessionAuthError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;

  constructor(statusCode: number, code: ErrorCode, message: string) {
    super(message);
    this.name = 'SessionAuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const SESSION_COOKIE = 'duocloud_session';
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

function base64urlEncode(data: string): string {
  return Buffer.from(data).toString('base64url');
}

function base64urlDecode(data: string): string {
  return Buffer.from(data, 'base64url').toString();
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function constantTimeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const [key, ...rest] = part.split('=');
    if (key) cookies[key.trim()] = rest.join('=').trim();
  }
  return cookies;
}

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new SessionAuthError(500, 'MONGODB_API_ERROR', 'MONGODB_API_ERROR: 服务暂时不可用。');
  }
  return secret;
}

export function createSessionToken(
  user: SessionUser,
  secret: string,
  now: Date = new Date(),
): string {
  const payload: SessionPayload = { ...user, exp: now.getTime() + SESSION_MAX_AGE_MS };
  const encoded = base64urlEncode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifySessionToken(
  token: string,
  secret: string,
  now: Date = new Date(),
): SessionUser | null {
  const dotIndex = token.lastIndexOf('.');
  if (dotIndex === -1) return null;

  const encoded = token.slice(0, dotIndex);
  const receivedSignature = token.slice(dotIndex + 1);
  const expectedSignature = sign(encoded, secret);

  if (!constantTimeEqualString(receivedSignature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(base64urlDecode(encoded)) as SessionPayload;
    if (payload.exp <= now.getTime()) return null;
    return { uid: payload.uid, username: payload.username, role: payload.role };
  } catch {
    return null;
  }
}

export function readSessionFromRequest(req: Pick<Request, 'headers'>, secret: string): SessionUser | null {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  return token ? verifySessionToken(token, secret) : null;
}

export function requireSession(req: Pick<Request, 'headers'>, secret: string): SessionUser {
  const user = readSessionFromRequest(req, secret);
  if (!user) throw new SessionAuthError(401, 'UNAUTHORIZED', 'UNAUTHORIZED: 请先登录。');
  return user;
}

export function requireRole(
  req: Pick<Request, 'headers'>,
  secret: string,
  roles: UserRole[],
): SessionUser {
  const user = requireSession(req, secret);
  if (!roles.includes(user.role)) {
    throw new SessionAuthError(403, 'FORBIDDEN', 'FORBIDDEN: 当前账号无操作权限。');
  }
  return user;
}

export function createSessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_MS / 1000}`;
}

export function createExpiredSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function setSessionCookie(res: Pick<Response, 'setHeader'>, token: string): void {
  res.setHeader('Set-Cookie', createSessionCookie(token));
}

export function clearSessionCookie(res: Pick<Response, 'setHeader'>): void {
  res.setHeader('Set-Cookie', createExpiredSessionCookie());
}

export function sendJson(
  res: Pick<Response, 'status' | 'json'>,
  statusCode: number,
  payload: Record<string, unknown>,
): void {
  res.status(statusCode).json(payload);
}

export function sendApiError(res: Pick<Response, 'status' | 'json'>, error: unknown): void {
  if (error instanceof SessionAuthError) {
    sendJson(res, error.statusCode, {
      success: false,
      error: { code: error.code },
      message: error.message,
    });
    return;
  }

  console.error(error);
  sendJson(res, 500, {
    success: false,
    error: { code: 'MONGODB_API_ERROR' },
    message: 'MONGODB_API_ERROR: 服务暂时不可用。',
  });
}
