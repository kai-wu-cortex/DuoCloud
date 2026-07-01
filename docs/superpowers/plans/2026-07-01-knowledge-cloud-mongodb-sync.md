# Knowledge Cloud MongoDB Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make DuoCloud Knowledge Cloud an authenticated Vercel + MongoDB online read/write system while leaving Practice Cloud unchanged.

**Architecture:** Add BuyerManageSystem-style cookie authentication, a MongoDB connection layer, and domain-specific Knowledge Cloud API routes. The React app gates access behind the login screen, loads Knowledge Cloud from MongoDB first, writes through API endpoints, and keeps localStorage only as fallback cache.

**Tech Stack:** React 19, Vite 6, TypeScript, Vercel API routes, MongoDB Node driver, Node crypto HMAC sessions, existing KnowledgeAsset TypeScript schema.

## Global Constraints

- MongoDB is the source of truth for Knowledge Cloud.
- Practice Cloud MongoDB migration is out of scope.
- Use dedicated Knowledge Cloud APIs instead of generic `/api/data/[collection]` APIs.
- Authentication follows BuyerManageSystem: username/password login, HttpOnly session cookie, server-side session verification.
- Login UI reuses BuyerManageSystem layout with DuoCloud branding.
- Required Vercel environment variables: `MONGODB_URI`, `MONGODB_DIRECT_URI`, `SESSION_SECRET`, `KNOWLEDGE_DB_NAME=duocloudDB`.
- Roles: `viewer`, `editor`, `admin`.
- `localStorage` is fallback cache only; mutating actions are disabled while offline.
- Use TDD for each task and commit after each task.

---

## File Structure

Create:

- `src/lib/mongodb.ts`: server-only MongoDB client and collection helpers.
- `src/server/sessionAuth.ts`: signed session cookie creation, verification, role guards.
- `src/server/loginApi.ts`: login API handler using `system_users`.
- `src/server/logoutApi.ts`: logout API handler.
- `src/server/authMeApi.ts`: current session API handler.
- `src/server/knowledgeAssetApi.ts`: Knowledge Cloud list, get, create, update, delete, bulk, export handlers.
- `src/lib/knowledgeApi.ts`: browser client for Knowledge Cloud API calls.
- `src/components/DuoCloudLogin.tsx`: BuyerManageSystem-style login screen with DuoCloud copy.
- `api/login.ts`, `api/logout.ts`, `api/auth/me.ts`: Vercel auth route files.
- `api/knowledge-assets/index.ts`, `api/knowledge-assets/[id].ts`, `api/knowledge-assets/bulk.ts`, `api/knowledge-assets/export.ts`: Vercel Knowledge Cloud route files.
- `scripts/createKnowledgeUser.ts`: local/admin script to create `system_users` records.
- Tests for every new server/client module.

Modify:

- `package.json`: add `mongodb`, `@vercel/functions`, and `create:knowledge-user`.
- `vercel.json`: include API route server files and SPA rewrite.
- `.env.example`: document MongoDB/session env vars.
- `src/App.tsx`: auth gate, API-backed Knowledge Cloud state, offline fallback.
- `src/components/KnowledgeCloud.tsx`: accept user/online state, disable controls by permission/offline, route mutations through async handlers.
- `src/lib/appState.ts`: keep local cache helpers and continue using them only as fallback cache.

---

### Task 1: MongoDB Connection Layer

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/lib/mongodb.ts`
- Create: `src/lib/mongodb.test.ts`

**Interfaces:**
- Produces: `getMongoClient(): Promise<MongoClient>`
- Produces: `getMongoDb(): Promise<Db>`
- Produces: `getMongoCollection<T extends Document>(name: string): Promise<Collection<T>>`
- Consumes: `process.env.MONGODB_URI`, `process.env.MONGODB_DIRECT_URI`, `process.env.KNOWLEDGE_DB_NAME`

- [ ] **Step 1: Install dependencies**

Run:

```bash
npm install mongodb @vercel/functions
```

Expected: `package.json` includes `mongodb` and `@vercel/functions`.

- [ ] **Step 2: Write the failing test**

Create `src/lib/mongodb.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

const ORIGINAL_ENV = { ...process.env };

test.afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

test('getMongoDbName defaults to duocloudDB', async () => {
  const { getMongoDbName } = await import('./mongodb');
  delete process.env.KNOWLEDGE_DB_NAME;
  assert.equal(getMongoDbName(), 'duocloudDB');
});

test('getPrimaryMongoUri requires a configured uri', async () => {
  const { getPrimaryMongoUri } = await import('./mongodb');
  delete process.env.MONGODB_URI;
  delete process.env.MONGODB_DIRECT_URI;
  assert.throws(() => getPrimaryMongoUri(), /缺少 MONGODB_URI/);
});

test('getPrimaryMongoUri prefers MONGODB_URI over direct uri', async () => {
  const { getPrimaryMongoUri } = await import('./mongodb');
  process.env.MONGODB_URI = 'mongodb+srv://primary';
  process.env.MONGODB_DIRECT_URI = 'mongodb://direct';
  assert.equal(getPrimaryMongoUri(), 'mongodb+srv://primary');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
npm test -- src/lib/mongodb.test.ts
```

Expected: FAIL because `src/lib/mongodb.ts` does not exist or exports are missing.

- [ ] **Step 4: Implement MongoDB helper**

Create `src/lib/mongodb.ts`:

```ts
import { attachDatabasePool } from '@vercel/functions';
import { MongoClient, type Collection, type Db, type Document } from 'mongodb';

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

export function getPrimaryMongoUri(): string {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_DIRECT_URI;
  if (!uri) throw new Error('缺少 MONGODB_URI 环境变量。');
  return uri;
}

export function getMongoDbName(): string {
  return process.env.KNOWLEDGE_DB_NAME || 'duocloudDB';
}

async function tryConnect(uri: string): Promise<MongoClient> {
  const candidate = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  attachDatabasePool(candidate);
  await candidate.connect();
  return candidate;
}

export function getMongoClient(): Promise<MongoClient> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const primaryUri = getPrimaryMongoUri();
      try {
        client = await tryConnect(primaryUri);
        return client;
      } catch (error) {
        const fallbackUri = process.env.MONGODB_DIRECT_URI;
        if (!fallbackUri || fallbackUri === primaryUri) throw error;
        console.warn('MONGODB_URI 连接失败，切换到 MONGODB_DIRECT_URI 重试。', (error as Error).message);
        client = await tryConnect(fallbackUri);
        return client;
      }
    })().catch(error => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}

export async function getMongoDb(): Promise<Db> {
  const connectedClient = await getMongoClient();
  return connectedClient.db(getMongoDbName());
}

export async function getMongoCollection<T extends Document>(name: string): Promise<Collection<T>> {
  const db = await getMongoDb();
  return db.collection<T>(name);
}
```

- [ ] **Step 5: Verify tests pass**

Run:

```bash
npm test -- src/lib/mongodb.test.ts
npm run lint
```

Expected: tests pass and TypeScript reports no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/mongodb.ts src/lib/mongodb.test.ts
git commit -m "feat: add duocloud mongodb connection"
```

---

### Task 2: Session Authentication APIs

**Files:**
- Create: `src/server/sessionAuth.ts`
- Create: `src/server/sessionAuth.test.ts`
- Create: `src/server/loginApi.ts`
- Create: `src/server/logoutApi.ts`
- Create: `src/server/authMeApi.ts`
- Create: `src/server/authApi.test.ts`
- Create: `api/login.ts`
- Create: `api/logout.ts`
- Create: `api/auth/me.ts`

**Interfaces:**
- Produces: `SessionUser = { uid: string; username: string; role: 'viewer' | 'editor' | 'admin' }`
- Produces: `requireSession(req, secret): SessionUser`
- Produces: `requireRole(req, secret, roles): SessionUser`
- Consumes: `getMongoCollection<SystemUserDoc>('system_users')`

- [ ] **Step 1: Write session auth failing tests**

Create `src/server/sessionAuth.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSessionToken,
  verifySessionToken,
  createSessionCookie,
  createExpiredSessionCookie,
  requireRole,
  SessionAuthError,
} from './sessionAuth';

test('session token verifies before expiration', () => {
  const now = new Date('2026-07-01T00:00:00.000Z');
  const token = createSessionToken({ uid: 'admin', username: 'Admin', role: 'admin' }, 'secret', now);
  const user = verifySessionToken(token, 'secret', new Date('2026-07-01T01:00:00.000Z'));
  assert.deepEqual(user, { uid: 'admin', username: 'Admin', role: 'admin' });
});

test('session token rejects wrong secret and expired token', () => {
  const now = new Date('2026-07-01T00:00:00.000Z');
  const token = createSessionToken({ uid: 'editor', username: 'Editor', role: 'editor' }, 'secret', now);
  assert.equal(verifySessionToken(token, 'other-secret', now), null);
  assert.equal(verifySessionToken(token, 'secret', new Date('2026-07-02T00:00:00.000Z')), null);
});

test('session cookies use HttpOnly secure same-site attributes', () => {
  const cookie = createSessionCookie('token');
  assert.match(cookie, /duocloud_session=token/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(createExpiredSessionCookie(), /Max-Age=0/);
});

test('requireRole throws forbidden when role is insufficient', () => {
  const token = createSessionToken({ uid: 'viewer', username: 'Viewer', role: 'viewer' }, 'secret');
  const req = { headers: { cookie: `duocloud_session=${token}` } };
  assert.throws(
    () => requireRole(req, 'secret', ['editor', 'admin']),
    (error: unknown) => error instanceof SessionAuthError && error.statusCode === 403,
  );
});
```

- [ ] **Step 2: Implement session auth**

Create `src/server/sessionAuth.ts` with BuyerManageSystem-style HMAC signing, but roles changed to `viewer | editor | admin` and cookie name changed to `duocloud_session`:

```ts
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

export class SessionAuthError extends Error {
  readonly statusCode: number;
  readonly code: 'UNAUTHORIZED' | 'FORBIDDEN';

  constructor(statusCode: number, code: 'UNAUTHORIZED' | 'FORBIDDEN', message: string) {
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
  for (let index = 0; index < a.length; index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
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

export function createSessionToken(user: SessionUser, secret: string, now: Date = new Date()): string {
  const payload: SessionPayload = { ...user, exp: now.getTime() + SESSION_MAX_AGE_MS };
  const encoded = base64urlEncode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifySessionToken(token: string, secret: string, now: Date = new Date()): SessionUser | null {
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

export function requireRole(req: Pick<Request, 'headers'>, secret: string, roles: UserRole[]): SessionUser {
  const user = requireSession(req, secret);
  if (!roles.includes(user.role)) throw new SessionAuthError(403, 'FORBIDDEN', 'FORBIDDEN: 当前账号无操作权限。');
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
```

- [ ] **Step 3: Run session tests**

```bash
npm test -- src/server/sessionAuth.test.ts
```

Expected: PASS.

- [ ] **Step 4: Write API tests**

Create `src/server/authApi.test.ts`. Structure `loginApi.ts` to export `verifyPasswordHash`, `hashPassword`, and `normalizeUsername`, then test those deterministic helpers:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUsername, hashPassword, verifyPasswordHash } from './loginApi';

test('normalizeUsername trims and lowercases usernames', () => {
  assert.equal(normalizeUsername(' Admin '), 'admin');
});

test('verifyPasswordHash accepts only matching salt and password', () => {
  const salt = 'salt';
  const passwordHash = hashPassword('secret', salt);
  assert.equal(verifyPasswordHash('secret', salt, passwordHash), true);
  assert.equal(verifyPasswordHash('wrong', salt, passwordHash), false);
});
```

- [ ] **Step 5: Implement auth API handlers and route files**

Create `src/server/loginApi.ts`, `src/server/logoutApi.ts`, and `src/server/authMeApi.ts` following BuyerManageSystem, with `system_users` roles `viewer | editor | admin`. Create route files under `api/` that call each handler and catch errors with safe JSON responses.

- [ ] **Step 6: Verify**

```bash
npm test -- src/server/sessionAuth.test.ts src/server/authApi.test.ts
npm run lint
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/server/sessionAuth.ts src/server/sessionAuth.test.ts src/server/loginApi.ts src/server/logoutApi.ts src/server/authMeApi.ts src/server/authApi.test.ts api/login.ts api/logout.ts api/auth/me.ts
git commit -m "feat: add duocloud session authentication"
```

---

### Task 3: Knowledge Asset Server API

**Files:**
- Create: `src/server/knowledgeAssetApi.ts`
- Create: `src/server/knowledgeAssetApi.test.ts`
- Create: `api/knowledge-assets/index.ts`
- Create: `api/knowledge-assets/[id].ts`
- Create: `api/knowledge-assets/bulk.ts`
- Create: `api/knowledge-assets/export.ts`

**Interfaces:**
- Consumes: `requireSession`, `requireRole`, `getMongoCollection`
- Produces: `handleKnowledgeAssetsRequest(req, res)`
- Produces: `handleKnowledgeAssetDocumentRequest(req, res)`
- Produces: `handleKnowledgeAssetBulkRequest(req, res)`
- Produces: `handleKnowledgeAssetExportRequest(req, res)`

- [ ] **Step 1: Write failing API utility tests**

Create `src/server/knowledgeAssetApi.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import type { KnowledgeAsset } from '../types';
import {
  normalizeKnowledgeAssetId,
  validateKnowledgeAssetPayload,
  applyKnowledgeAssetUpdate,
} from './knowledgeAssetApi';

const baseAsset = {
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

test('normalizeKnowledgeAssetId keeps safe ids and replaces unsafe characters', () => {
  assert.equal(normalizeKnowledgeAssetId(' KA-001 '), 'KA-001');
  assert.equal(normalizeKnowledgeAssetId('OBS/中文'), 'OBS___');
});

test('validateKnowledgeAssetPayload accepts valid KnowledgeAsset-like payload', () => {
  const result = validateKnowledgeAssetPayload(baseAsset);
  assert.equal(result.valid, true);
});

test('validateKnowledgeAssetPayload rejects invalid category', () => {
  const result = validateKnowledgeAssetPayload({ ...baseAsset, category: 'bad' });
  assert.equal(result.valid, false);
  assert.match(result.message, /category/);
});

test('applyKnowledgeAssetUpdate increments version and metadata', () => {
  const updated = applyKnowledgeAssetUpdate(baseAsset, {
    actor: { uid: 'admin', username: 'Admin', role: 'admin' },
    now: new Date('2026-07-01T08:00:00.000Z'),
    existingVersion: 2,
    source: 'duocloud',
  });
  assert.equal(updated._id, 'KA-001');
  assert.equal(updated.version, 3);
  assert.equal(updated.status, 'active');
  assert.equal(updated.updatedBy.username, 'Admin');
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npm test -- src/server/knowledgeAssetApi.test.ts
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement API utilities and handlers**

In `src/server/knowledgeAssetApi.ts`, implement:

```ts
export function normalizeKnowledgeAssetId(id: string): string;
export function validateKnowledgeAssetPayload(value: unknown): { valid: true } | { valid: false; message: string };
export function applyKnowledgeAssetUpdate(asset: KnowledgeAsset, options: { actor: SessionUser; now?: Date; existingVersion?: number; source: KnowledgeAssetDocument['source'] }): KnowledgeAssetDocument;
```

Handlers must:

- Require session for all reads.
- Require `editor` or `admin` for POST/PUT.
- Require `admin` for DELETE, bulk import, and export if export should be protected by role; viewer can export per spec, so export requires any valid session.
- Use `knowledge_assets`, `knowledge_asset_revisions`, and `knowledge_asset_import_jobs`.
- Return JSON shape `{ success: true, data }` or `{ success: false, code, message }`.
- Apply soft delete by setting `deletedAt` and `status: 'archived'`.
- Check update `version`; return `409 CONFLICT` on mismatch.

- [ ] **Step 4: Add Vercel route files**

Each route imports and delegates to the matching handler. Example `api/knowledge-assets/index.ts`:

```ts
import { handleKnowledgeAssetsRequest } from '../../src/server/knowledgeAssetApi.ts';

export default async function handler(
  req: Parameters<typeof handleKnowledgeAssetsRequest>[0],
  res: Parameters<typeof handleKnowledgeAssetsRequest>[1],
) {
  try {
    return await handleKnowledgeAssetsRequest(req, res);
  } catch (error) {
    console.error('Knowledge assets API error:', error);
    return res.status(500).json({ success: false, code: 'KNOWLEDGE_API_ERROR', message: error instanceof Error ? error.message : String(error) });
  }
}
```

- [ ] **Step 5: Verify**

```bash
npm test -- src/server/knowledgeAssetApi.test.ts
npm run lint
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/server/knowledgeAssetApi.ts src/server/knowledgeAssetApi.test.ts api/knowledge-assets
git commit -m "feat: add knowledge asset mongo api"
```

---

### Task 4: Login UI And Auth Gate

**Files:**
- Create: `src/components/DuoCloudLogin.tsx`
- Create: `src/lib/authApi.ts`
- Create: `src/lib/authApi.test.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `/api/login`, `/api/logout`, `/api/auth/me`
- Produces: `AuthUser = { uid: string; username: string; role: 'viewer' | 'editor' | 'admin' }`
- Produces: `signInToDuoCloud(username, password): Promise<AuthUser>`
- Produces: `getDuoCloudSession(): Promise<AuthUser | null>`
- Produces: `signOutOfDuoCloud(): Promise<void>`

- [ ] **Step 1: Write client auth tests**

Create `src/lib/authApi.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAuthResponse } from './authApi';

test('parseAuthResponse returns auth user on success', () => {
  const user = parseAuthResponse({ success: true, data: { uid: 'admin', username: 'Admin', role: 'admin' } });
  assert.deepEqual(user, { uid: 'admin', username: 'Admin', role: 'admin' });
});

test('parseAuthResponse throws readable API message on failure', () => {
  assert.throws(
    () => parseAuthResponse({ success: false, message: '用户名或密码错误。' }),
    /用户名或密码错误/,
  );
});
```

- [ ] **Step 2: Implement `authApi.ts`**

Create `src/lib/authApi.ts`:

```ts
export type AuthRole = 'viewer' | 'editor' | 'admin';
export interface AuthUser { uid: string; username: string; role: AuthRole }

export function parseAuthResponse(payload: unknown): AuthUser {
  const value = payload as { success?: unknown; data?: Partial<AuthUser>; message?: unknown };
  if (!value.success) throw new Error(typeof value.message === 'string' ? value.message : '登录失败。');
  if (!value.data || typeof value.data.uid !== 'string' || typeof value.data.username !== 'string' || !['viewer', 'editor', 'admin'].includes(String(value.data.role))) {
    throw new Error('登录响应格式不正确。');
  }
  return value.data as AuthUser;
}

export async function signInToDuoCloud(username: string, password: string): Promise<AuthUser> {
  const response = await fetch('/api/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  return parseAuthResponse(await response.json());
}

export async function getDuoCloudSession(): Promise<AuthUser | null> {
  const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
  const payload = await response.json();
  if (!payload.success || !payload.data) return null;
  return parseAuthResponse(payload);
}

export async function signOutOfDuoCloud(): Promise<void> {
  await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
}
```

- [ ] **Step 3: Copy and adapt login UI**

Create `src/components/DuoCloudLogin.tsx` from BuyerManageSystem `SystemLogin.tsx`, changing copy to:

- `Double Cloud`
- `INDUSTRIAL OS`
- `知识云在线系统登入验证`
- `使用系统账号密码登入，知识卡片从 MongoDB 在线知识库读取。`
- `DB: MongoDB Atlas`
- `AUTH: 账号密码`

- [ ] **Step 4: Modify `App.tsx` auth gate**

Add `authStatus`, `authUser`, `authError`, `isSigningIn`. On mount, call `getDuoCloudSession`. Render:

- checking state while loading session.
- `DuoCloudLogin` when unauthenticated.
- existing app when authenticated.

Add logout button in sidebar footer with current username.

- [ ] **Step 5: Verify**

```bash
npm test -- src/lib/authApi.test.ts
npm run lint
npm run build
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/DuoCloudLogin.tsx src/lib/authApi.ts src/lib/authApi.test.ts src/App.tsx
git commit -m "feat: add duocloud login gate"
```

---

### Task 5: Frontend Knowledge API Client And Online Loading

**Files:**
- Create: `src/lib/knowledgeApi.ts`
- Create: `src/lib/knowledgeApi.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/KnowledgeCloud.tsx`

**Interfaces:**
- Consumes: Knowledge Cloud API routes from Task 3.
- Produces: `listKnowledgeAssets(): Promise<KnowledgeAsset[]>`
- Produces: `createRemoteKnowledgeAsset(asset): Promise<KnowledgeAsset>`
- Produces: `updateRemoteKnowledgeAsset(asset): Promise<KnowledgeAsset>`
- Produces: `bulkUpdateKnowledgeAssets(payload): Promise<BulkResult>`

- [ ] **Step 1: Write API client tests**

Create `src/lib/knowledgeApi.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseKnowledgeApiListResponse, parseKnowledgeApiAssetResponse } from './knowledgeApi';

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
```

- [ ] **Step 2: Implement `knowledgeApi.ts`**

Create parse helpers and fetch wrappers using `credentials: 'same-origin'`. For `401`, throw an error with code `UNAUTHORIZED` so `App.tsx` can return to login.

- [ ] **Step 3: Modify `App.tsx` loading**

Change initial knowledge state:

- Initialize from local fallback for immediate render only after authentication.
- After `authStatus === 'authenticated'`, call `listKnowledgeAssets`.
- On success, curate assets, set state, save local fallback.
- On failure, load local fallback and set `knowledgeCloudStatus` to `offline`.

- [ ] **Step 4: Pass permissions/status into `KnowledgeCloud`**

Extend props:

```ts
currentUser: AuthUser;
isOffline: boolean;
onRefreshAssets: () => Promise<void>;
```

Inside `KnowledgeCloud`, derive permissions:

```ts
const canEdit = !isOffline && (currentUser.role === 'editor' || currentUser.role === 'admin');
const canAdmin = !isOffline && currentUser.role === 'admin';
```

Hide or disable controls accordingly.

- [ ] **Step 5: Verify**

```bash
npm test -- src/lib/knowledgeApi.test.ts src/lib/appState.test.ts
npm run lint
npm run build
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/knowledgeApi.ts src/lib/knowledgeApi.test.ts src/App.tsx src/components/KnowledgeCloud.tsx
git commit -m "feat: load knowledge cloud from api"
```

---

### Task 6: Route Knowledge Mutations Through Mongo API

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/KnowledgeCloud.tsx`
- Modify: `src/lib/knowledgeApi.ts`
- Modify: `src/lib/knowledgeApi.test.ts`

**Interfaces:**
- Consumes: Task 5 API client functions.
- Produces: API-backed add, update, import, batch edit, delete, and export UI flows.

- [ ] **Step 1: Add client tests for mutation parsing**

Update `src/lib/knowledgeApi.test.ts`:

```ts
test('parseBulkResult returns bulk counts', () => {
  const { parseBulkResult } = require('./knowledgeApi');
  const result = parseBulkResult({ success: true, data: { created: 1, updated: 2, skipped: 3, failed: 0, errors: [] } });
  assert.deepEqual(result, { created: 1, updated: 2, skipped: 3, failed: 0, errors: [] });
});
```

Use ESM import syntax if the file is ESM-only.

- [ ] **Step 2: Implement mutation client functions**

Add:

```ts
export async function createRemoteKnowledgeAsset(asset: Omit<KnowledgeAsset, 'id' | 'lastUpdated'>): Promise<KnowledgeAsset>;
export async function updateRemoteKnowledgeAsset(asset: KnowledgeAsset): Promise<KnowledgeAsset>;
export async function deleteRemoteKnowledgeAsset(id: string, version: number): Promise<void>;
export async function bulkImportKnowledgeAssets(assets: Array<Omit<KnowledgeAsset, 'id' | 'lastUpdated'>>): Promise<BulkResult>;
export async function bulkPatchKnowledgeAssets(payload: BulkPatchPayload): Promise<BulkResult>;
```

- [ ] **Step 3: Modify App handlers**

Change `handleAddKnowledgeAsset`, `handleUpdateKnowledgeAsset`, and `handleImportKnowledgeAssets` to async API calls. Keep local state updates only after API success. On API failure, show a toast or app-level error.

- [ ] **Step 4: Modify KnowledgeCloud bulk edit and delete paths**

Ensure bulk edit calls `bulkPatchKnowledgeAssets`. Ensure delete action uses `deleteRemoteKnowledgeAsset` and is admin-only.

- [ ] **Step 5: Export path**

Implement `GET /api/knowledge-assets/export` to return JSON assets in the same shape as `GET /api/knowledge-assets` with `{ success: true, data: KnowledgeAsset[] }`. Reuse the existing frontend workbook builder to generate the Excel file from that API response.

- [ ] **Step 6: Verify**

```bash
npm test -- src/lib/knowledgeApi.test.ts
npm run lint
npm run build
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/components/KnowledgeCloud.tsx src/lib/knowledgeApi.ts src/lib/knowledgeApi.test.ts
git commit -m "feat: persist knowledge mutations to mongodb"
```

---

### Task 7: Seed Admin User Script And Environment Docs

**Files:**
- Create: `scripts/createKnowledgeUser.ts`
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Consumes: `MONGODB_URI`, `MONGODB_DIRECT_URI`, `KNOWLEDGE_DB_NAME`
- Produces script: `npm run create:knowledge-user -- --username admin --password ... --role admin`

- [ ] **Step 1: Write script helper tests if helpers are extracted**

Add this test to `src/server/authApi.test.ts` so the setup script and login flow keep compatible password hashing:

```ts
test('hashPassword is stable for setup script compatibility', () => {
  assert.equal(hashPassword('secret', 'salt'), hashPassword('secret', 'salt'));
  assert.notEqual(hashPassword('secret', 'salt'), hashPassword('secret', 'other-salt'));
});
```

- [ ] **Step 2: Implement script**

Create `scripts/createKnowledgeUser.ts`:

```ts
import { randomBytes, createHash } from 'node:crypto';
import { getMongoCollection } from '../src/lib/mongodb';

function getArg(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : '';
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(salt + password).digest('hex');
}

const username = getArg('username').trim().toLowerCase();
const password = getArg('password');
const role = getArg('role');
if (!['viewer', 'editor', 'admin'].includes(role)) throw new Error('role must be viewer, editor, or admin');

const salt = randomBytes(16).toString('hex');
const passwordHash = hashPassword(password, salt);
const collection = await getMongoCollection('system_users');
await collection.updateOne(
  { _id: username },
  { $set: { _id: username, username, role, salt, passwordHash, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
  { upsert: true },
);
console.log(`User ${username} saved with role ${role}`);
```

- [ ] **Step 3: Add package script**

Add:

```json
"create:knowledge-user": "tsx scripts/createKnowledgeUser.ts"
```

- [ ] **Step 4: Update `.env.example`**

Add:

```env
MONGODB_URI="mongodb+srv://..."
MONGODB_DIRECT_URI="mongodb://..."
SESSION_SECRET="replace-with-long-random-secret"
KNOWLEDGE_DB_NAME="duocloudDB"
```

- [ ] **Step 5: Update README**

Document local setup:

```bash
cp .env.example .env
npm install
npm run create:knowledge-user -- --username admin --password 'change-me' --role admin
npm run dev
```

- [ ] **Step 6: Verify**

```bash
npm run lint
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/createKnowledgeUser.ts package.json package-lock.json .env.example README.md
git commit -m "chore: add knowledge cloud admin user setup"
```

---

### Task 8: Vercel Configuration And Deployment

**Files:**
- Create or modify: `vercel.json`
- Verify: `api/**/*.ts`

**Interfaces:**
- Consumes: Vercel project connected to this repo.
- Produces: deployed app with API routes and SPA rewrite.

- [ ] **Step 1: Add Vercel config**

Create or update `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "functions": {
    "api/**/*.ts": {
      "includeFiles": "src/**/*.ts"
    }
  },
  "rewrites": [
    {
      "source": "/((?!api/.*).*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Verify build locally**

```bash
npm run build
npm run lint
```

Expected: both pass.

- [ ] **Step 3: Configure Vercel env vars**

Using Vercel CLI or dashboard, set:

```bash
vercel env add MONGODB_URI production
vercel env add MONGODB_DIRECT_URI production
vercel env add SESSION_SECRET production
vercel env add KNOWLEDGE_DB_NAME production
```

Use `duocloudDB` for `KNOWLEDGE_DB_NAME` unless the user explicitly chooses another name.

- [ ] **Step 4: Deploy**

```bash
vercel --prod
```

Expected: deployment URL is returned.

- [ ] **Step 5: Smoke test deployment**

```bash
curl -I https://<deployment-url>/
curl -I https://<deployment-url>/api/auth/me
```

Expected: root returns 200. `/api/auth/me` returns 200 JSON or 401 JSON, not a Vercel function crash.

- [ ] **Step 6: Commit**

```bash
git add vercel.json
git commit -m "chore: configure vercel deployment"
```

---

### Task 9: End-To-End Local Verification

**Files:**
- No new source files unless fixing defects found by verification.

**Interfaces:**
- Consumes all previous tasks.
- Produces verified local behavior.

- [ ] **Step 1: Start local server**

```bash
npm run dev
```

Expected: server listens on `http://localhost:3000` or next available configured port.

- [ ] **Step 2: Create admin user against local MongoDB**

```bash
npm run create:knowledge-user -- --username admin --password 'change-me-now' --role admin
```

Expected: `User admin saved with role admin`.

- [ ] **Step 3: Login flow**

Open `http://localhost:3000/?tab=knowledge`, log in as `admin`.

Expected:

- Login page uses DuoCloud copy.
- After login, Knowledge Cloud loads.
- User identity appears in sidebar or header.

- [ ] **Step 4: Knowledge CRUD flow**

Create a small `tag_system` knowledge card, refresh page, confirm it persists. Edit its title, refresh page, confirm update persists.

Expected: MongoDB-backed persistence survives browser refresh and localStorage clearing.

- [ ] **Step 5: Permission spot check**

Create a `viewer` user and log in.

Expected: create/edit/import/delete controls are hidden or disabled.

- [ ] **Step 6: Final verification commands**

```bash
npm test -- src/**/*.test.ts
npm run lint
npm run build
curl -I --max-time 5 'http://localhost:3000/?tab=knowledge'
```

Expected: tests pass, lint passes, build passes, local URL returns 200.

- [ ] **Step 7: Final commit**

If verification required source fixes, commit them:

```bash
git add <changed-files>
git commit -m "fix: stabilize knowledge cloud mongodb sync"
```
