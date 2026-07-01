import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Document } from 'mongodb';
import { getMongoCollection } from '../lib/mongodb';
import {
  SessionAuthError,
  createSessionToken,
  getSessionSecret,
  sendJson,
  setSessionCookie,
  type SessionUser,
  type UserRole,
} from './sessionAuth';

export interface SystemUserDoc extends Document {
  _id: string;
  username: string;
  role: UserRole;
  salt: string;
  passwordHash: string;
}

interface LoginRequestBody {
  username?: unknown;
  password?: unknown;
}

function parseBody(body: unknown): LoginRequestBody {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as LoginRequestBody;
    } catch {
      return {};
    }
  }
  if (body && typeof body === 'object') return body as LoginRequestBody;
  return {};
}

function toSessionUser(user: Pick<SystemUserDoc, '_id' | 'username' | 'role'>): SessionUser {
  return {
    uid: user._id,
    username: user.username,
    role: user.role,
  };
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(salt + password).digest('hex');
}

export function verifyPasswordHash(password: string, salt: string, passwordHash: string): boolean {
  return hashPassword(password, salt) === passwordHash;
}

export async function loginApiHandler(
  req: Pick<Request, 'method' | 'body'>,
  res: Pick<Response, 'status' | 'json' | 'setHeader'>,
): Promise<void> {
  if (req.method !== 'POST') {
    throw new SessionAuthError(405, 'METHOD_NOT_ALLOWED', 'METHOD_NOT_ALLOWED: 仅支持 POST。');
  }

  const body = parseBody(req.body);
  const username = typeof body.username === 'string' ? normalizeUsername(body.username) : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!username || !password) {
    throw new SessionAuthError(401, 'UNAUTHORIZED', 'UNAUTHORIZED: 用户名或密码错误。');
  }

  const collection = await getMongoCollection<SystemUserDoc>('system_users');
  const user = await collection.findOne({ username });
  if (!user || !verifyPasswordHash(password, user.salt, user.passwordHash)) {
    throw new SessionAuthError(401, 'UNAUTHORIZED', 'UNAUTHORIZED: 用户名或密码错误。');
  }

  const token = createSessionToken(toSessionUser(user), getSessionSecret());
  setSessionCookie(res, token);
  sendJson(res, 200, { success: true, data: toSessionUser(user) });
}
