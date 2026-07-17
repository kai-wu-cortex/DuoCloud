# 营销可信模块完整重写 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将可信云下的营销可信模块重写为以 MongoDB 证据主表为唯一事实来源、支持私有草稿、审核共享、版本审计和私有附件的企业证据工作台。

**Architecture:** 新版代码集中在 `src/features/marketing-trust/**`、`src/server/marketingEvidence/**` 和 `api/marketing-evidence/**`。前端通过统一字段 registry 驱动主表、创建、详情、单条编辑、批量编辑和字段偏好；服务端通过独立数据库及 collections、显式权限策略和乐观锁处理业务；附件写入独立私有 Vercel Blob Store，并通过受鉴权的内容代理提供预览。`src/App.tsx` 只负责营销可信入口懒加载和按需加载知识云，旧版在本地验收前保留为回退。

**Tech Stack:** React 19、TypeScript 5.8、Vite 6、Tailwind CSS 4、Motion、Express/Vercel Functions、MongoDB 7、Vercel Blob 2、Sharp、Node test runner、Playwright 浏览器验收。

## Global Constraints

- 仅重写可信云下的营销可信模块；交付可信不在本计划内。
- 严禁修改知识云组件、知识云 API、知识云 MongoDB collections、知识云 Blob 配置、Obsidian/飞书 ingestion 和知识云同步脚本。
- 禁止修改：
  - `api/knowledge-assets/**`
  - `src/server/knowledgeAssetApi.ts`
  - `src/server/knowledgeAttachmentApi.ts`
  - `src/data/obsidianKnowledgeAssets.ts`
  - `src/components/KnowledgeCloud.tsx`
- `src/App.tsx` 只允许修改营销可信入口、营销可信导航及知识云按需加载边界；进入知识云后的现有行为必须保持一致。
- 不迁移浏览器 `localStorage` 中旧营销可信数据，不迁移前端常量演示数据，不读取任何知识云 collection 或知识云附件。
- 当前工作树已有与本任务无关的 `package.json`、`src/server/sessionAuth.ts`、`src/server/sessionAuth.test.ts`、`scripts/localDevServer.ts` 修改。执行时必须逐文件保留这些修改，不得覆盖或回退；每次提交只暂存本任务文件或本任务 hunk。
- 营销可信业务角色由现有 session 映射：
  - `admin` -> `admin`
  - `viewer | editor` -> `member`
- 所有写请求必须校验服务器会话、workspace、owner/role 和 `expectedVersion`；客户端传入的 owner、workspace 和审核人不得作为可信身份来源。
- 营销可信数据库使用 `MARKETING_EVIDENCE_DB_NAME`，默认 `duocloudMarketingTrustDB`；不得调用以 `KNOWLEDGE_DB_NAME` 为默认值的 `getMongoCollection()`。
- 营销可信附件使用 `MARKETING_EVIDENCE_BLOB_READ_WRITE_TOKEN`；不得读取 `BLOB_READ_WRITE_TOKEN` 或知识云 Blob Token。
- 附件默认 `private`，原图、预览、缩略图和视频封面均只能通过受鉴权的内容路由读取。
- 每个任务先写失败测试，再写最小实现，再运行针对性测试和完整门槛。
- 本地验收通过前不部署、不推送、不删除旧 `MarketingTrustWorkspace.tsx`。
- Vercel CLI 当前版本若低于最新稳定版，执行 Vercel 环境配置前先运行 `npm install --global vercel@latest`，再用 `vercel --version` 确认升级。

---

## Task 1: 建立营销可信领域模型和统一字段 Registry

**Files:**
- Create: `src/features/marketing-trust/domain/types.ts`
- Create: `src/features/marketing-trust/domain/fieldRegistry.ts`
- Create: `src/features/marketing-trust/domain/fieldRegistry.test.ts`
- Create: `src/features/marketing-trust/domain/completion.ts`
- Create: `src/features/marketing-trust/domain/completion.test.ts`
- Create: `src/features/marketing-trust/domain/index.ts`

- [ ] **Step 1: 为稳定状态、内容形态和证据文档写失败测试**

在 `fieldRegistry.test.ts` 验证：

```ts
test('registry contains one unique definition for every editable field', () => {
  const ids = MARKETING_EVIDENCE_FIELDS.map(field => field.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(
    MARKETING_EVIDENCE_FIELD_GROUPS.map(group => group.id),
    ['basic', 'material_process', 'result_risk', 'media_attachments'],
  );
});

test('create, detail, single edit, bulk edit and column settings read the same registry', () => {
  assert.equal(getCreateFields(), MARKETING_EVIDENCE_FIELDS);
  assert.equal(getDetailFields(), MARKETING_EVIDENCE_FIELDS);
  assert.ok(getBulkEditableFields().every(field => field.bulkEditable));
  assert.ok(getColumnFields().every(field => field.table));
});

test('content form fields remain typed groups on one evidence document', () => {
  assert.deepEqual(CONTENT_FORM_IDS, [
    'case',
    'comparison',
    'image',
    'video',
    'report',
    'question',
  ]);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
npx tsx --test src/features/marketing-trust/domain/fieldRegistry.test.ts
```

Expected: FAIL，提示 registry、类型或导出尚不存在。

- [ ] **Step 3: 定义稳定领域类型**

`types.ts` 至少导出：

```ts
export type MarketingEvidenceStatus =
  | 'private_draft'
  | 'pending_review'
  | 'rejected'
  | 'shared'
  | 'unlisted'
  | 'deleted';

export type MarketingEvidenceContentForm =
  | 'case'
  | 'comparison'
  | 'image'
  | 'video'
  | 'report'
  | 'question';

export type MarketingBusinessRole = 'member' | 'admin';
export type MarketingTrustLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
export type MarketingEvidenceVisibility =
  | 'public'
  | 'redacted_public'
  | 'internal'
  | 'specified_customers';
```

`MarketingEvidenceAsset` 使用设计规格中的统一结构，并补齐：

- `caseContent`
- `comparisonContent`
- `imageContent`
- `videoContent`
- `reportContent`
- `questionContent`
- `previousStatus?: Exclude<MarketingEvidenceStatus, 'deleted'>`
- `rejectionReason?: string`
- `attachments: MarketingEvidenceAttachmentSummary[]` 仅用于 API 读模型

附件字段只能保存 `attachmentIds`，不得保存本地文件名、Object URL 或知识云附件 ID。

- [ ] **Step 4: 实现字段 Registry**

`MarketingEvidenceFieldDefinition` 至少包含：

```ts
export interface MarketingEvidenceFieldDefinition {
  id: MarketingEvidenceFieldId;
  label: string;
  group: 'basic' | 'material_process' | 'result_risk' | 'media_attachments';
  kind: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'tags' | 'attachment';
  path: string;
  table: boolean;
  defaultVisible: boolean;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  bulkEditable: boolean;
  requiredFor?: MarketingEvidenceContentForm[];
  attachmentRole?: 'hero_image' | 'detail_images' | 'test_images' | 'original_video'
    | 'edited_video' | 'video_cover' | 'report_file' | 'supporting_files';
  options?: ReadonlyArray<{ value: string; label: string }>;
}
```

同一 registry 驱动：

- 创建表单；
- 详情视图；
- 单条编辑；
- 批量编辑；
- 主表字段显示与顺序；
- 完整度计算；
- 待补齐字段。

`path` 使用显式白名单读取/写入工具，禁止通过任意客户端 path 修改 `_id`、owner、workspace、version、status、审计字段。

- [ ] **Step 5: 写完整度失败测试**

`completion.test.ts` 覆盖：

- 普通证据基础字段；
- 含视频证据必须有原始/剪辑视频或至少一个可播放视频；
- 对比证据必须有对象 A、对象 B、共同条件、变量和结论；
- 报告必须有关联证据和风险边界；
- 返回百分比、缺失字段 ID 和分组统计；
- 不识别的 content form 不得静默通过。

- [ ] **Step 6: 实现并验证完整度计算**

Run:

```bash
npx tsx --test \
  src/features/marketing-trust/domain/fieldRegistry.test.ts \
  src/features/marketing-trust/domain/completion.test.ts
```

Expected: PASS。

- [ ] **Step 7: 提交领域模型**

```bash
git add \
  src/features/marketing-trust/domain/types.ts \
  src/features/marketing-trust/domain/fieldRegistry.ts \
  src/features/marketing-trust/domain/fieldRegistry.test.ts \
  src/features/marketing-trust/domain/completion.ts \
  src/features/marketing-trust/domain/completion.test.ts \
  src/features/marketing-trust/domain/index.ts
git commit -m "feat(marketing-trust): define evidence schema registry"
```

## Task 2: 实现状态流转、权限和版本策略

**Files:**
- Create: `src/features/marketing-trust/domain/workflow.ts`
- Create: `src/features/marketing-trust/domain/workflow.test.ts`
- Create: `src/features/marketing-trust/domain/permissions.ts`
- Create: `src/features/marketing-trust/domain/permissions.test.ts`
- Modify: `src/features/marketing-trust/domain/index.ts`

- [ ] **Step 1: 写状态流转失败测试**

覆盖：

- `private_draft | rejected -> pending_review`
- `pending_review -> private_draft` 表示撤回，并记录 `withdrawn` audit action
- 管理员 `pending_review -> shared | rejected`
- 管理员 `shared -> unlisted -> shared`
- 软删除保存 `previousStatus`
- 恢复回 `previousStatus`
- 创建者编辑自己的 shared 证据保持 shared
- 非法状态流转抛出稳定 `INVALID_TRANSITION`

- [ ] **Step 2: 写权限失败测试**

覆盖：

- 成员可读企业 shared；
- 成员可读写自己的 private/rejected/pending；
- 成员不可读他人 private/rejected/pending；
- 成员可直接编辑自己创建的 shared；
- 成员不可编辑他人 shared；
- admin 可读写 workspace 内全部记录；
- `viewer` 和 `editor` 都映射为 member；
- 跨 workspace 永远拒绝；
- `deleted` 默认不出现在普通查询中。

- [ ] **Step 3: 运行测试确认失败**

```bash
npx tsx --test \
  src/features/marketing-trust/domain/workflow.test.ts \
  src/features/marketing-trust/domain/permissions.test.ts
```

Expected: FAIL。

- [ ] **Step 4: 实现纯函数策略**

必须导出：

```ts
mapSessionRoleToMarketingRole(role: UserRole): MarketingBusinessRole
assertCanReadEvidence(context, evidence): void
assertCanEditEvidence(context, evidence): void
assertCanDeleteEvidence(context, evidence): void
assertCanReviewEvidence(context, evidence): void
transitionEvidence(input): WorkflowTransitionResult
```

权限错误必须包含稳定 code：`FORBIDDEN`、`NOT_FOUND`、`INVALID_TRANSITION`。

- [ ] **Step 5: 验证并提交**

```bash
npx tsx --test \
  src/features/marketing-trust/domain/workflow.test.ts \
  src/features/marketing-trust/domain/permissions.test.ts
git add src/features/marketing-trust/domain
git commit -m "feat(marketing-trust): add workflow and permission policies"
```

## Task 3: 建立独立 MongoDB 数据边界和索引

**Files:**
- Create: `src/server/marketingEvidence/database.ts`
- Create: `src/server/marketingEvidence/collections.ts`
- Create: `src/server/marketingEvidence/collections.test.ts`
- Create: `src/server/marketingEvidence/documents.ts`
- Create: `src/server/marketingEvidence/errors.ts`
- Create: `src/server/marketingEvidence/testSupport.ts`

- [ ] **Step 1: 写数据库隔离失败测试**

验证：

```ts
test('uses explicit marketing database name and collection allowlist', async () => {
  process.env.MARKETING_EVIDENCE_DB_NAME = 'marketing-test';
  assert.equal(getMarketingEvidenceDbName(), 'marketing-test');
  assert.deepEqual(MARKETING_COLLECTION_NAMES, {
    assets: 'marketing_evidence_assets',
    attachments: 'marketing_evidence_attachments',
    versions: 'marketing_evidence_versions',
    reviews: 'marketing_evidence_reviews',
    auditLogs: 'marketing_evidence_audit_logs',
    preferences: 'marketing_evidence_preferences',
  });
});

test('never resolves a knowledge database name', () => {
  process.env.KNOWLEDGE_DB_NAME = 'must-not-be-used';
  delete process.env.MARKETING_EVIDENCE_DB_NAME;
  assert.equal(getMarketingEvidenceDbName(), 'duocloudMarketingTrustDB');
});
```

- [ ] **Step 2: 实现数据库与 collection resolvers**

`database.ts` 只能复用 `getMongoClient()` 连接池：

```ts
export async function getMarketingEvidenceDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(getMarketingEvidenceDbName());
}
```

不得调用 `getMongoDb()` 或 `getMongoCollection()`，因为它们受 `KNOWLEDGE_DB_NAME` 控制。

`collections.ts` 提供：

- 生产 collection resolver；
- 测试注入 `setMarketingEvidenceCollectionsForTests()`；
- `ensureMarketingEvidenceIndexes()`；
- `resetMarketingEvidenceCollectionsForTests()`。

- [ ] **Step 3: 定义索引**

至少创建：

```ts
assets: [
  { key: { workspaceId: 1, evidenceId: 1 }, unique: true },
  { key: { workspaceId: 1, status: 1, updatedAt: -1 } },
  { key: { workspaceId: 1, ownerId: 1, status: 1, updatedAt: -1 } },
  { key: { workspaceId: 1, tags: 1 } },
  { key: { workspaceId: 1, title: 'text', tags: 'text' } },
]
versions: [{ key: { workspaceId: 1, evidenceId: 1, version: 1 }, unique: true }]
reviews: [{ key: { workspaceId: 1, evidenceId: 1, submittedVersion: 1 } }]
auditLogs: [{ key: { workspaceId: 1, evidenceId: 1, createdAt: -1 } }]
preferences: [{ key: { workspaceId: 1, userId: 1 }, unique: true }]
attachments: [
  { key: { workspaceId: 1, attachmentId: 1 }, unique: true },
  { key: { workspaceId: 1, evidenceId: 1, deletedAt: 1 } },
  { key: { pathname: 1 }, unique: true },
]
```

- [ ] **Step 4: 实现测试用 Fake collections**

`testSupport.ts` 支持 `findOne`、`find().sort().skip().limit().toArray()`、`insertOne`、`insertMany`、`updateOne`、`findOneAndUpdate`、`deleteOne` 和索引记录，供后续 API 集成测试复用。

- [ ] **Step 5: 运行并提交**

```bash
npx tsx --test src/server/marketingEvidence/collections.test.ts
git add src/server/marketingEvidence
git commit -m "feat(marketing-trust): isolate marketing evidence storage"
```

## Task 4: 实现证据 Repository、查询和乐观锁

**Files:**
- Create: `src/server/marketingEvidence/repository.ts`
- Create: `src/server/marketingEvidence/repository.test.ts`
- Create: `src/server/marketingEvidence/serialization.ts`
- Create: `src/server/marketingEvidence/validation.ts`
- Create: `src/server/marketingEvidence/validation.test.ts`

- [ ] **Step 1: 写输入验证失败测试**

覆盖：

- title 和 contentForms 正常化；
- tags 去空、去重并限制长度；
- 数字评分范围；
- attachmentIds 只接受合法业务 ID；
- 客户端不能写 ownerId、workspaceId、version、status、createdBy、updatedBy；
- bulk patch 只接受 registry 中 `bulkEditable` 字段；
- 未知字段返回 `VALIDATION_ERROR`，不得静默丢弃；
- query 的 page、pageSize、sort、filters 有上限和白名单。

- [ ] **Step 2: 写 Repository 失败测试**

覆盖：

- 创建生成 `MKT-<date>-<sequence/random>` 业务 ID 和 version 1；
- member 查询只返回 shared 和自己的记录；
- admin 查询 workspace 内全部非 deleted；
- `expectedVersion` 正确时更新并 version +1；
- `expectedVersion` 错误时抛 `VERSION_CONFLICT`，HTTP 层映射 409；
- 每次成功写入同步新增版本快照与 audit log；
- 软删除和恢复；
- 搜索、筛选、排序和分页返回 total；
- 读取详情附带授权后的附件摘要、最新 review 和最近 audit。

- [ ] **Step 3: 实现验证、序列化和 Repository**

Repository 方法：

```ts
listEvidence(context, query): Promise<PaginatedEvidence>
createEvidence(context, input): Promise<MarketingEvidenceAsset>
getEvidence(context, evidenceId): Promise<MarketingEvidenceAssetDetail>
updateEvidence(context, evidenceId, input, expectedVersion): Promise<MarketingEvidenceAsset>
softDeleteEvidence(context, evidenceId, expectedVersion): Promise<void>
restoreEvidence(context, evidenceId, expectedVersion): Promise<MarketingEvidenceAsset>
bulkUpdateEvidence(context, input): Promise<BulkUpdateResult>
```

MongoDB 多 collection 写入优先使用 transaction；测试环境若无 session，则通过注入 transaction runner。任何主文档写入成功但版本/audit 写入失败都必须回滚或返回一致性错误，不允许无审计成功。

- [ ] **Step 4: 运行并提交**

```bash
npx tsx --test \
  src/server/marketingEvidence/validation.test.ts \
  src/server/marketingEvidence/repository.test.ts
git add src/server/marketingEvidence
git commit -m "feat(marketing-trust): implement evidence repository"
```

## Task 5: 实现专用 HTTP API 和审核工作流

**Files:**
- Create: `src/server/marketingEvidence/http.ts`
- Create: `src/server/marketingEvidence/handlers.ts`
- Create: `src/server/marketingEvidence/handlers.test.ts`
- Create: `api/marketing-evidence/index.ts`
- Create: `api/marketing-evidence/[id].ts`
- Create: `api/marketing-evidence/[id]/submit.ts`
- Create: `api/marketing-evidence/[id]/review.ts`
- Create: `api/marketing-evidence/[id]/restore.ts`
- Create: `api/marketing-evidence/bulk.ts`

- [ ] **Step 1: 写 API 集成失败测试**

用现有 `createSessionToken()` 创建 admin/member cookie，覆盖：

- 未登录全部返回 401；
- member POST 创建 private draft，owner 取 session uid；
- member GET 看不到他人 private；
- member PATCH 自己记录成功；
- member PATCH 他人 shared 返回 403；
- owner PATCH 自己 shared 后仍 shared，生成版本；
- submit、withdraw、review approve/reject；
- 非 admin review 返回 403；
- PATCH/DELETE/restore 的版本冲突返回 409；
- 软删除默认列表不可见；
- admin `includeDeleted=1` 可见并恢复；
- 成功结构统一为 `{ success: true, data, meta? }`；
- 错误结构统一为 `{ success: false, code, message, details? }`。

- [ ] **Step 2: 实现请求上下文**

从服务器会话构造：

```ts
interface MarketingRequestContext {
  workspaceId: string; // process.env.MARKETING_WORKSPACE_ID || 'pinte'
  userId: string;
  username: string;
  role: 'member' | 'admin';
}
```

禁止从 query/body 接受 workspaceId 或 role。

- [ ] **Step 3: 实现 handlers 和薄 Vercel wrappers**

`handlers.ts` 提供：

```ts
handleMarketingEvidenceCollectionRequest
handleMarketingEvidenceDocumentRequest
handleMarketingEvidenceSubmitRequest
handleMarketingEvidenceReviewRequest
handleMarketingEvidenceRestoreRequest
handleMarketingEvidenceBulkRequest
sendMarketingEvidenceError
```

`POST /:id/submit` body:

```ts
{ action: 'submit' | 'withdraw', expectedVersion: number }
```

`POST /:id/review` body:

```ts
{
  decision: 'approve' | 'reject' | 'unlist' | 'reshare';
  comment?: string;
  expectedVersion: number;
}
```

- [ ] **Step 4: 验证 API 测试**

```bash
npx tsx --test src/server/marketingEvidence/handlers.test.ts
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/server/marketingEvidence api/marketing-evidence
git commit -m "feat(marketing-trust): add evidence workflow API"
```

## Task 6: 实现字段偏好持久化

**Files:**
- Create: `src/server/marketingEvidence/preferences.ts`
- Create: `src/server/marketingEvidence/preferences.test.ts`
- Create: `api/marketing-evidence/preferences.ts`
- Create: `src/features/marketing-trust/api/preferences.ts`
- Create: `src/features/marketing-trust/api/preferences.test.ts`

- [ ] **Step 1: 写失败测试**

覆盖：

- 每个 workspace/user 只有一条偏好；
- 默认偏好来自 registry；
- hidden、order、widths、sort、savedFilters 均做字段白名单验证；
- width clamp 到 registry min/max；
- 未知字段 ID 被拒绝；
- member 只能读写自己的偏好；
- API JSON 解析失败给出稳定错误，不出现 `Unexpected token` 原始异常。

- [ ] **Step 2: 实现 server 和 client**

偏好结构：

```ts
interface MarketingEvidencePreferences {
  userId: string;
  workspaceId: string;
  visibleFieldIds: MarketingEvidenceFieldId[];
  fieldOrder: MarketingEvidenceFieldId[];
  columnWidths: Partial<Record<MarketingEvidenceFieldId, number>>;
  defaultSort: { fieldId: MarketingEvidenceFieldId; direction: 'asc' | 'desc' };
  savedFilters: SavedEvidenceFilter[];
  updatedAt: string;
}
```

客户端请求必须先检查 `Content-Type`，非 JSON 响应转为 `MarketingEvidenceApiError('INVALID_RESPONSE')`。

- [ ] **Step 3: 运行并提交**

```bash
npx tsx --test \
  src/server/marketingEvidence/preferences.test.ts \
  src/features/marketing-trust/api/preferences.test.ts
git add \
  src/server/marketingEvidence/preferences.ts \
  src/server/marketingEvidence/preferences.test.ts \
  api/marketing-evidence/preferences.ts \
  src/features/marketing-trust/api
git commit -m "feat(marketing-trust): persist evidence field preferences"
```

## Task 7: 实现独立私有附件 API、预览处理和安全读取

**Files:**
- Create: `src/server/marketingEvidence/attachments.ts`
- Create: `src/server/marketingEvidence/attachments.test.ts`
- Create: `src/server/marketingEvidence/mediaProcessing.ts`
- Create: `src/server/marketingEvidence/mediaProcessing.test.ts`
- Create: `api/marketing-evidence/attachments.ts`
- Create: `api/marketing-evidence/attachments/[id].ts`
- Create: `api/marketing-evidence/attachments/[id]/content.ts`
- Create: `src/features/marketing-trust/api/attachments.ts`
- Create: `src/features/marketing-trust/api/attachments.test.ts`

- [ ] **Step 1: 写 Token 与路径隔离失败测试**

验证：

- 缺少 `MARKETING_EVIDENCE_BLOB_READ_WRITE_TOKEN` 返回配置错误；
- 不读取 `BLOB_READ_WRITE_TOKEN`；
- pathname 必须为 `marketing-evidence/<workspace>/<evidenceId>/...`；
- 路径越权、`..`、控制字符和跨 evidenceId 被拒绝；
- token 由 `handleUpload({ token: process.env.MARKETING_EVIDENCE_BLOB_READ_WRITE_TOKEN })` 生成；
- client payload 包含 evidenceId、role、kind、contentType、size、checksum；
- 上传前校验证据写权限；
- attachment 元数据只写入 `marketing_evidence_attachments`。

- [ ] **Step 2: 写附件权限和生命周期失败测试**

覆盖：

- 私有草稿附件只有 owner/admin 可读；
- shared 附件 workspace 成员可读；
- content proxy 支持 `GET`、`HEAD`、`Range`、ETag 和正确 Content-Type；
- 删除附件时软删除 metadata，并从证据 attachmentIds 移除；
- Blob 已上传但 metadata 失败时调用补偿 `del()`；
- metadata 成功前客户端状态为 processing；
- 重试不会产生重复 attachmentId；
- 删除普通记录不立即物理删除 Blob。

- [ ] **Step 3: 实现私有附件上传**

客户端：

```ts
upload(pathname, file, {
  access: 'private',
  handleUploadUrl: '/api/marketing-evidence/attachments',
  clientPayload: JSON.stringify(metadata),
  multipart: file.size >= 10 * 1024 * 1024,
  onUploadProgress,
});
```

服务器：

```ts
handleUpload({
  token: getMarketingBlobToken(),
  request: req,
  body,
  onBeforeGenerateToken,
  onUploadCompleted,
});
```

`onUploadCompleted` 使用签名后的 `tokenPayload` 创建 metadata，不能信任回调外的客户端字段。

- [ ] **Step 4: 实现图片和视频预览**

图片：

- 原文件保留；
- `Sharp` 自动旋转；
- 预览：最大 1600px、WebP quality 78；
- 缩略图：最大 480px、WebP quality 72；
- metadata 保存 width/height、previewPathname、thumbnailPathname；
- 处理失败不删除原件，状态为 `preview_failed` 并允许重试。

视频：

- 原文件保留；
- 浏览器在选择文件后用 `<video>` + `<canvas>` 抽取首个可用帧，生成 WebP cover 后作为关联 attachment 上传；
- metadata 保存 duration、coverAttachmentId、processingStatus；
- 详情中通过受鉴权 content proxy 使用 `<video controls>` 播放。

- [ ] **Step 5: 实现受鉴权内容代理**

`GET /api/marketing-evidence/attachments/:id/content?variant=original|preview|thumbnail|cover`：

1. 读取 session；
2. 读取 attachment 和所属 evidence；
3. 执行 `assertCanReadEvidence`；
4. 使用 `get(pathname, { access: 'private', token })`；
5. 流式转发内容、Range、ETag 和缓存头；
6. private draft 使用 `Cache-Control: private, no-store`，shared 使用短期 private cache。

- [ ] **Step 6: 运行并提交**

```bash
npx tsx --test \
  src/server/marketingEvidence/attachments.test.ts \
  src/server/marketingEvidence/mediaProcessing.test.ts \
  src/features/marketing-trust/api/attachments.test.ts
git add \
  src/server/marketingEvidence \
  api/marketing-evidence/attachments.ts \
  api/marketing-evidence/attachments \
  src/features/marketing-trust/api
git commit -m "feat(marketing-trust): add isolated private attachment pipeline"
```

## Task 8: 实现营销可信客户端 API 和状态 Store

**Files:**
- Create: `src/features/marketing-trust/api/client.ts`
- Create: `src/features/marketing-trust/api/client.test.ts`
- Create: `src/features/marketing-trust/state/queryState.ts`
- Create: `src/features/marketing-trust/state/queryState.test.ts`
- Create: `src/features/marketing-trust/state/editorState.ts`
- Create: `src/features/marketing-trust/state/editorState.test.ts`
- Create: `src/features/marketing-trust/hooks/useEvidenceQuery.ts`
- Create: `src/features/marketing-trust/hooks/useEvidenceEditor.ts`

- [ ] **Step 1: 写 API client 失败测试**

覆盖：

- list/create/detail/update/delete/submit/review/restore/bulk/preferences；
- query 参数稳定序列化；
- 401、403、409 和验证错误映射为带 code/status/details 的 error；
- 非 JSON 响应和断网错误给出可读提示；
- 请求携带 `credentials: 'same-origin'`；
- 不调用任何 `/api/knowledge-assets`。

- [ ] **Step 2: 写 query/editor reducer 失败测试**

覆盖：

- 搜索、筛选、排序、分页；
- 快捷筛选；
- 选择当前页、取消全选、跨页选择清理；
- 只有 selection 非空时显示批量工具；
- 打开/关闭 drawer 保留主表滚动位置；
- 自动保存 dirty/saving/synced/unsynced/conflict；
- 409 后保留本地草稿；
- “重新加载”与“另存为新草稿”分支；
- 切换证据主表/我的草稿/审核队列时清理不适用的 selection 和动作。

- [ ] **Step 3: 实现 client、reducers 和 hooks**

`useEvidenceEditor`：

- 800ms trailing debounce 自动保存；
- 显式保存立即 flush；
- AbortController 取消过期请求；
- component unmount 时保留内存草稿，禁止丢弃未同步内容；
- conflict 时停止自动覆盖。

- [ ] **Step 4: 运行并提交**

```bash
npx tsx --test \
  src/features/marketing-trust/api/client.test.ts \
  src/features/marketing-trust/state/queryState.test.ts \
  src/features/marketing-trust/state/editorState.test.ts
git add src/features/marketing-trust
git commit -m "feat(marketing-trust): add evidence client state"
```

## Task 9: 构建新版营销可信壳层和三入口导航

**Files:**
- Create: `src/features/marketing-trust/MarketingTrustV2.tsx`
- Create: `src/features/marketing-trust/components/MarketingTrustHeader.tsx`
- Create: `src/features/marketing-trust/components/MarketingTrustNavigation.tsx`
- Create: `src/features/marketing-trust/components/MarketingTrustLoading.tsx`
- Create: `src/features/marketing-trust/components/MarketingTrustErrorState.tsx`
- Create: `src/features/marketing-trust/marketingTrustV2.test.ts`

- [ ] **Step 1: 写导航和隔离失败测试**

使用纯 view-model 测试或最小 React 渲染测试，验证：

- 导航仅包含 `证据主表`、`我的草稿`、`审核队列`；
- member 不显示审核队列；
- 默认页为证据主表；
- URL view 只接受 `primary | drafts | review`；
- 不出现数据总览、场景证据卡、对比证据图、过程短视频、可信报告、运营治理、发布中心；
- feature 模块 source 不 import KnowledgeCloud、knowledgeApi、knowledge types 或 PracticeCard。

- [ ] **Step 2: 实现安静、密集的工作台壳层**

要求：

- 无营销落地页 hero；
- 桌面以工具栏 + 表格为第一屏；
- 移动端工具栏允许换行，搜索不消失；
- 统一 8px 以下圆角；
- 使用 lucide icons；
- loading 使用灰色结构骨架和横向 shimmer，不显示伪造记录；
- error state 提供重试，不回退到旧本地演示数据。

- [ ] **Step 3: 运行并提交**

```bash
npx tsx --test src/features/marketing-trust/marketingTrustV2.test.ts
git add src/features/marketing-trust
git commit -m "feat(marketing-trust): build v2 workspace shell"
```

## Task 10: 构建证据主表、表头拖拽和字段视图

**Files:**
- Create: `src/features/marketing-trust/components/EvidenceToolbar.tsx`
- Create: `src/features/marketing-trust/components/EvidenceTable.tsx`
- Create: `src/features/marketing-trust/components/EvidenceTableHeader.tsx`
- Create: `src/features/marketing-trust/components/EvidenceTableCell.tsx`
- Create: `src/features/marketing-trust/components/FieldSettingsDrawer.tsx`
- Create: `src/features/marketing-trust/components/BulkActionBar.tsx`
- Create: `src/features/marketing-trust/state/tablePreferences.ts`
- Create: `src/features/marketing-trust/state/tablePreferences.test.ts`

- [ ] **Step 1: 写表格偏好失败测试**

覆盖：

- 默认列来自 registry；
- 表头分隔线拖动调整宽度；
- 宽度 min/max clamp；
- reorder 后固定选择列仍在最左；
- 隐藏字段后至少保留 title；
- reset 恢复 registry 默认；
- 保存后重新加载可恢复 widths/order/visibility；
- 字段设置抽屉不提供重复的宽度 slider；
- 只有选中行后显示全选当前、取消全选、已选数量和批量编辑。

- [ ] **Step 2: 实现主表交互**

要求：

- CSS grid/table 使用固定 column model，避免内容改变列宽；
- header resize handle 宽 8px、可键盘调整、`cursor: col-resize`；
- pointer move 使用 `requestAnimationFrame` 节流；
- 拖动结束才 PATCH preferences；
- 行点击打开详情；checkbox click 不触发行详情；
- 附件列显示缩略图或播放/文件图标，不只显示文件名；
- 横向滚动保留表头；
- 行不剪切重要状态，长文本使用可访问 tooltip。

- [ ] **Step 3: 实现字段设置抽屉**

提供：

- 搜索字段；
- 全选/取消全选；
- drag sort；
- 显示/隐藏；
- reset；
- 完成并持久化。

字段清单严格读取统一 registry。

- [ ] **Step 4: 运行并提交**

```bash
npx tsx --test src/features/marketing-trust/state/tablePreferences.test.ts
git add src/features/marketing-trust
git commit -m "feat(marketing-trust): add configurable evidence ledger"
```

## Task 11: 构建统一右侧证据工作面板

**Files:**
- Create: `src/features/marketing-trust/components/EvidenceWorkspaceDrawer.tsx`
- Create: `src/features/marketing-trust/components/EvidenceSpine.tsx`
- Create: `src/features/marketing-trust/components/EvidenceFieldRenderer.tsx`
- Create: `src/features/marketing-trust/components/EvidenceFieldGroup.tsx`
- Create: `src/features/marketing-trust/components/EvidenceConflictPanel.tsx`
- Create: `src/features/marketing-trust/components/EvidenceHistory.tsx`
- Create: `src/features/marketing-trust/components/ReviewActions.tsx`
- Create: `src/features/marketing-trust/components/BatchEditDrawer.tsx`
- Create: `src/features/marketing-trust/domain/formModel.ts`
- Create: `src/features/marketing-trust/domain/formModel.test.ts`

- [ ] **Step 1: 写统一表单模型失败测试**

验证：

- create/detail/edit/bulk 均由 registry 生成；
- create 默认 private draft；
- 系统字段只读；
- bulk 只出现 bulkEditable；
- contentForms 控制类型化字段组显示，但不创建独立业务记录；
- attachment 字段只写 attachmentIds；
- schema 更新后五个入口字段同步变化。

- [ ] **Step 2: 实现右侧抽屉动画**

使用 Motion：

```ts
initial={{ x: '100%', opacity: 0.98 }}
animate={{ x: 0, opacity: 1 }}
exit={{ x: '100%', opacity: 0.98 }}
transition={{ type: 'spring', stiffness: 360, damping: 38 }}
```

要求：

- backdrop 淡入；
- Escape 关闭前检查 unsynced；
- focus trap；
- 关闭恢复原行焦点和滚动位置；
- mobile 变为全屏 drawer；
- 不嵌套装饰性卡片。

- [ ] **Step 3: 实现证据脊柱和字段分组**

证据脊柱持续显示：

- 完整度；
- 可信等级；
- 状态；
- 创建者/负责人；
- version；
- 保存状态；
- 缺失字段。

字段分组：

- 基础信息；
- 材料与工艺；
- 结果与风险；
- 图片、视频与附件。

- [ ] **Step 4: 实现审核、冲突和历史**

- member：保存、提交、撤回；
- admin：通过、驳回、下架、重新共享、恢复；
- owner 编辑 shared：立即保存并写新版本；
- conflict：重新加载、另存为草稿；
- history：版本、审核和 audit 时间线。

- [ ] **Step 5: 实现批量编辑**

- 读取相同 registry；
- 明确显示修改范围；
- 空字段表示不修改，不表示清空；
- 清空必须使用单独“清空该字段”开关；
- 提交前显示选中数量；
- 逐项返回成功/冲突/失败。

- [ ] **Step 6: 运行并提交**

```bash
npx tsx --test src/features/marketing-trust/domain/formModel.test.ts
git add src/features/marketing-trust
git commit -m "feat(marketing-trust): add unified evidence workspace drawer"
```

## Task 12: 构建批量附件上传与即时预览

**Files:**
- Create: `src/features/marketing-trust/components/AttachmentDropzone.tsx`
- Create: `src/features/marketing-trust/components/AttachmentPreviewGrid.tsx`
- Create: `src/features/marketing-trust/components/AttachmentPreviewModal.tsx`
- Create: `src/features/marketing-trust/components/AttachmentUploadItem.tsx`
- Create: `src/features/marketing-trust/state/attachmentQueue.ts`
- Create: `src/features/marketing-trust/state/attachmentQueue.test.ts`

- [ ] **Step 1: 写上传队列失败测试**

覆盖：

- 拖拽和 file picker 批量添加；
- MIME 与字段 role 校验；
- 重复文件 checksum 去重；
- queued/uploading/processing/saved/failed/cancelled；
- 每文件进度、取消、重试、删除；
- Object URL 在移除/unmount 后 revoke；
- 图片、视频、PDF 和普通附件分别生成正确预览模型；
- metadata 保存前不能显示为 saved。

- [ ] **Step 2: 实现上传与预览**

要求：

- 图片显示真实缩略图，点击打开预览 modal；
- modal 支持滚轮缩放、拖动、双击适配，不限制缩放倍数但限制非法 0/NaN；
- 视频显示 cover 和时长，点击内嵌播放；
- PDF 显示可打开预览；
- 其他附件显示文件类型、大小和安全下载；
- 主图、细节图、测试图、视频、报告和 supporting files 使用同一组件配置不同 `attachmentRole`；
- 上传前本地 Object URL 即时预览，保存后切换到受鉴权 content URL。

- [ ] **Step 3: 运行并提交**

```bash
npx tsx --test src/features/marketing-trust/state/attachmentQueue.test.ts
git add src/features/marketing-trust
git commit -m "feat(marketing-trust): add evidence attachment previews"
```

## Task 13: 接入证据主表、我的草稿和审核队列

**Files:**
- Create: `src/features/marketing-trust/views/EvidenceLedgerView.tsx`
- Create: `src/features/marketing-trust/views/MyDraftsView.tsx`
- Create: `src/features/marketing-trust/views/ReviewQueueView.tsx`
- Create: `src/features/marketing-trust/views/viewQueries.ts`
- Create: `src/features/marketing-trust/views/viewQueries.test.ts`
- Modify: `src/features/marketing-trust/MarketingTrustV2.tsx`

- [ ] **Step 1: 写 view query 失败测试**

验证：

- 主表：shared + 当前用户可访问记录；
- 我的草稿：owner 为当前用户且 status 为 private_draft/rejected；
- 撤回后的 pending 变回 private_draft 并出现在我的草稿；
- 审核队列：admin + pending_review；
- member 请求 review view 返回受控无权限状态；
- 切换 view 清空 selection、关闭不适用动作、保留各 view 自己的 query state；
- 主表快捷筛选均只是 contentForms/字段 filter，不请求独立数据源。

- [ ] **Step 2: 实现三个工作入口**

三者复用同一 `EvidenceTable`、toolbar 和 drawer，只通过 query、可用动作和空状态文案区分。

- [ ] **Step 3: 运行并提交**

```bash
npx tsx --test src/features/marketing-trust/views/viewQueries.test.ts
git add src/features/marketing-trust
git commit -m "feat(marketing-trust): connect ledger drafts and review queue"
```

## Task 14: 实现服务器真实数据迁移与 dry-run

**Files:**
- Create: `scripts/migrateMarketingEvidence.ts`
- Create: `src/server/marketingEvidence/migration.ts`
- Create: `src/server/marketingEvidence/migration.test.ts`
- Create: `docs/marketing-trust-migration.md`
- Modify: `package.json`（只添加脚本；保留现有未提交修改）

- [ ] **Step 1: 写迁移失败测试**

覆盖：

- 只读取命令行显式 `--source` 的服务器导出 JSON/CSV；
- 必须有稳定 source key 和 traceable source；
- 排除 `demo`、`mock`、`sample`、前端常量来源；
- 不读取 localStorage；
- 不读取 knowledge collection/knowledge attachment；
- 相同稳定业务键幂等；
- dry-run 不写库；
- 报告 source/valid/duplicate/skipped/failed 及原因；
- 无真实记录时输出空库结果而非演示数据。

- [ ] **Step 2: 实现 CLI**

命令：

```bash
npm run migrate:marketing-evidence -- \
  --dry-run \
  --report outputs/marketing-evidence-migration/dry-run.json
```

如果部署环境明确配置了真实服务器导出路径，再运行：

```bash
npm run migrate:marketing-evidence -- \
  --source "$MARKETING_EVIDENCE_MIGRATION_SOURCE" \
  --dry-run \
  --report outputs/marketing-evidence-migration/dry-run.json
```

正式写入必须额外要求：

```bash
--apply --confirm-workspace pinte
```

没有 `--apply` 时永远不写数据库。

- [ ] **Step 3: 添加 package script**

```json
"migrate:marketing-evidence": "tsx scripts/migrateMarketingEvidence.ts"
```

只修改这一行对应 hunk，不覆盖用户现有 `package.json` 变更。

- [ ] **Step 4: 运行 dry-run 和测试**

```bash
npx tsx --test src/server/marketingEvidence/migration.test.ts
npm run migrate:marketing-evidence -- --dry-run --report outputs/marketing-evidence-migration/dry-run.json
```

Expected:

- 测试 PASS；
- dry-run 报告可读；
- MongoDB 写入数为 0；
- 若没有真实服务器导出，则记录“无可迁移服务器真实数据”，新库保持空。

- [ ] **Step 5: 提交**

```bash
git add \
  scripts/migrateMarketingEvidence.ts \
  src/server/marketingEvidence/migration.ts \
  src/server/marketingEvidence/migration.test.ts \
  docs/marketing-trust-migration.md
git add -p package.json
git commit -m "feat(marketing-trust): add traceable evidence migration"
```

## Task 15: 接入本地开发服务器和环境配置

**Files:**
- Modify: `scripts/localDevServer.ts`（保留当前用户本地登录改动，只追加营销可信路由）
- Create: `.env.marketing-evidence.example`
- Create: `docs/marketing-trust-local-development.md`
- Create: `src/server/marketingEvidence/localRoutes.test.ts`

- [ ] **Step 1: 写本地路由映射失败测试**

验证本地 server 路由清单包含：

- `/api/marketing-evidence`
- `/api/marketing-evidence/bulk`
- `/api/marketing-evidence/preferences`
- `/api/marketing-evidence/attachments`
- `/api/marketing-evidence/attachments/:id`
- `/api/marketing-evidence/attachments/:id/content`
- `/api/marketing-evidence/:id`
- `/api/marketing-evidence/:id/submit`
- `/api/marketing-evidence/:id/review`
- `/api/marketing-evidence/:id/restore`

并确保具体路由在 `/:id` 前注册。

- [ ] **Step 2: 提取并挂载路由**

为避免测试直接启动 server，将路由注册提取到：

```ts
export function registerMarketingEvidenceLocalRoutes(app: Express): void
```

`scripts/localDevServer.ts` 只调用该函数。必须保留现有 local/local 或本地认证逻辑，不覆盖文件。

- [ ] **Step 3: 写环境模板**

`.env.marketing-evidence.example`：

```dotenv
MARKETING_EVIDENCE_DB_NAME=duocloudMarketingTrustDB
MARKETING_WORKSPACE_ID=pinte
MARKETING_EVIDENCE_BLOB_READ_WRITE_TOKEN=
VITE_MARKETING_TRUST_V2=true
```

禁止出现知识云 Blob token 值。

- [ ] **Step 4: 验证并提交**

```bash
npx tsx --test src/server/marketingEvidence/localRoutes.test.ts
git add \
  .env.marketing-evidence.example \
  docs/marketing-trust-local-development.md \
  src/server/marketingEvidence/localRoutes.test.ts
git add -p scripts/localDevServer.ts
git commit -m "chore(marketing-trust): mount local evidence APIs"
```

## Task 16: 在 App 入口懒加载 V2，并按需加载知识云

**Files:**
- Modify: `src/App.tsx`（只改营销可信入口、导航和知识云按需加载 effect）
- Create: `src/features/marketing-trust/appIntegration.ts`
- Create: `src/features/marketing-trust/appIntegration.test.ts`

- [ ] **Step 1: 写入口状态失败测试**

验证：

- `?tab=practice&module=marketing` 默认 `view=primary`；
- 仅接受 `primary | drafts | review`；
- marketing V2 懒加载；
- delivery 仍渲染原 `PracticeCloud`；
- knowledge 仍渲染原 `KnowledgeCloud`；
- authenticated 但 activeTab 不是 knowledge 时不触发 knowledge refresh；
- 切换到 knowledge 时只触发一次 refresh；
- 营销可信不接收 `knowledgeAssets` 或 `practiceCards` props。

- [ ] **Step 2: 修改 App 入口**

添加：

```ts
const MarketingTrustV2 = lazy(() =>
  import('./features/marketing-trust/MarketingTrustV2')
);
```

渲染边界：

```tsx
{activeTab === 'practice' && trustedCloudModule === 'marketing' && (
  <MarketingTrustV2
    view={marketingTrustView}
    currentUser={authUser}
    onViewChange={handleMarketingTrustViewChange}
  />
)}
{activeTab === 'practice' && trustedCloudModule === 'delivery' && (
  <PracticeCloud module="delivery" ... />
)}
```

营销可信导航只保留三项；admin 才显示审核队列。

知识云刷新 effect 改为：

```ts
useEffect(() => {
  if (authStatus !== 'authenticated' || activeTab !== 'knowledge') return;
  void refreshKnowledgeAssets();
}, [activeTab, authStatus, refreshKnowledgeAssets]);
```

进入知识云后的 API、组件 props、fallback 和 CRUD 行为不变。

- [ ] **Step 3: 功能开关和回退**

本地验收期：

- `VITE_MARKETING_TRUST_V2=true` 使用 V2；
- 未开启时保持旧营销可信路径；
- 生产默认仍保持当前入口，直到 Task 19 的本地验收完成。

- [ ] **Step 4: 运行并提交**

```bash
npx tsx --test src/features/marketing-trust/appIntegration.test.ts
npm run lint
git add src/App.tsx src/features/marketing-trust/appIntegration.ts src/features/marketing-trust/appIntegration.test.ts
git commit -m "feat(marketing-trust): integrate isolated v2 workspace"
```

## Task 17: 增加知识云零改动与 API 隔离回归

**Files:**
- Create: `src/features/marketing-trust/knowledgeIsolation.test.ts`
- Create: `scripts/checkMarketingTrustIsolation.ts`
- Create: `docs/marketing-trust-isolation-checklist.md`
- Modify: `package.json`（仅新增检查脚本，保留当前修改）

- [ ] **Step 1: 写 source isolation 测试**

扫描：

- `src/features/marketing-trust/**`
- `src/server/marketingEvidence/**`
- `api/marketing-evidence/**`

拒绝 import 或字符串引用：

- `/api/knowledge-assets`
- `knowledgeAssetApi`
- `knowledgeAttachmentApi`
- `KnowledgeCloud`
- `obsidianKnowledgeAssets`
- 知识云 Blob token 名；
- `pinte-marketing-trust-local-evidence`
- `pinte-marketing-trust-evidence-overrides`

- [ ] **Step 2: 实现 Git diff boundary 检查**

`checkMarketingTrustIsolation.ts` 接受 `--base <commit>`，检查禁止文件不在 diff 中。默认 base 为开始实施前提交 `e22d9f6` 或执行分支的实际 fork base。

`package.json` 添加：

```json
"check:marketing-isolation": "tsx scripts/checkMarketingTrustIsolation.ts"
```

- [ ] **Step 3: 添加运行时请求隔离测试**

浏览器测试中拦截所有请求：

- 打开 marketing，完成 list/create/edit/attachment 流程；
- 断言没有请求 `/api/knowledge-assets`；
- 再切换 knowledge；
- 断言 knowledge 请求正常触发，页面数量和附件显示与基线一致。

- [ ] **Step 4: 运行并提交**

```bash
npx tsx --test src/features/marketing-trust/knowledgeIsolation.test.ts
npm run check:marketing-isolation -- --base e22d9f6
git add \
  src/features/marketing-trust/knowledgeIsolation.test.ts \
  scripts/checkMarketingTrustIsolation.ts \
  docs/marketing-trust-isolation-checklist.md
git add -p package.json
git commit -m "test(marketing-trust): enforce knowledge cloud isolation"
```

## Task 18: 完成 API、权限和媒体端到端测试

**Files:**
- Create: `tests/marketing-trust/marketingEvidence.spec.ts`
- Create: `tests/marketing-trust/marketingEvidence.mobile.spec.ts`
- Create: `tests/marketing-trust/fixtures.ts`
- Create: `playwright.config.ts`（若仓库尚无）
- Modify: `package.json`（添加 Playwright dev dependency/scripts 时保留当前修改）

- [ ] **Step 1: 添加最小浏览器测试依赖**

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

`package.json` scripts：

```json
"test:e2e:marketing": "playwright test tests/marketing-trust"
```

- [ ] **Step 2: 写桌面核心流程**

覆盖：

1. member 登录；
2. 主表搜索、筛选、排序、分页；
3. 表头拖动列宽并刷新恢复；
4. 字段显示、隐藏、顺序并刷新恢复；
5. 新建 private draft；
6. 自动保存；
7. 图片/视频/PDF 批量拖放和真实预览；
8. 提交审核；
9. admin 审核通过；
10. member 看到 shared；
11. owner 修改 shared 后 version 增加；
12. 两个页面并发修改产生 409；
13. 批量编辑；
14. 软删除与恢复；
15. marketing 流程全程无 knowledge API 请求。

- [ ] **Step 3: 写移动端核心流程**

视口至少：

- 390x844；
- 768x1024；
- 1440x900。

验证：

- 搜索可见；
- 工具按钮文字不溢出；
- 主表横向滚动；
- drawer 全屏；
- 上传预览不重叠；
- 无横向页面级溢出。

- [ ] **Step 4: 运行并提交**

```bash
npm run dev:local
# 在另一终端
npm run test:e2e:marketing
git add package-lock.json playwright.config.ts tests/marketing-trust
git add -p package.json
git commit -m "test(marketing-trust): cover end to end workflows"
```

## Task 19: 本地验收、性能门槛和 V2 切换

**Files:**
- Modify: `vite.config.ts`（仅在分析证明需要时增加 manualChunks；不得盲目拆包）
- Modify: `src/App.tsx`（本地验收通过后使营销可信默认进入 V2）
- Create: `docs/marketing-trust-acceptance-report.md`

- [ ] **Step 1: 运行全套门槛**

```bash
npm test
npm run lint
npm run build
npm run check:marketing-isolation -- --base e22d9f6
npm run test:e2e:marketing
```

Expected:

- 所有测试 PASS；
- TypeScript 0 errors；
- production build 成功；
- marketing isolation 0 violations；
- 浏览器流程 PASS。

- [ ] **Step 2: 检查构建产物**

```bash
find dist/assets -type f -maxdepth 1 -print0 | xargs -0 ls -lhS | head -20
```

要求：

- 营销可信 V2 为独立 lazy chunk；
- marketing route 不预载知识云大 chunk；
- 首屏无新增超大同步 chunk；
- 若单个 V2 chunk 仍超过 500KB gzip 前，优先按 drawer/media/admin view 使用 `React.lazy` 拆分；只有 vendor 共享库再使用 `manualChunks`。

- [ ] **Step 3: 本地真实环境验收**

```bash
VITE_MARKETING_TRUST_V2=true npm run dev:local
```

本地检查：

- member/admin 权限；
- 空库、正常数据、错误、断网；
- 独立 MongoDB 的 collection 数量；
- 独立 Blob Store 上传及 private content proxy；
- knowledge 进入前无 knowledge 请求；
- knowledge 进入后原数据与附件数量不变。

将命令、时间、测试账号角色、MongoDB 计数、Blob 计数和截图路径写入 `docs/marketing-trust-acceptance-report.md`；不得写入密码或 token。

- [ ] **Step 4: 获得用户本地验收**

向用户提供本地 URL 和验收清单。用户明确确认后：

- `src/App.tsx` 默认营销可信入口切换到 V2；
- 保留 feature flag 可快速回退；
- 暂不删除旧 `MarketingTrustWorkspace.tsx`，直到生产观察期结束。

- [ ] **Step 5: 提交本地切换**

```bash
git add src/App.tsx vite.config.ts docs/marketing-trust-acceptance-report.md
git commit -m "feat(marketing-trust): cut over to evidence workspace v2"
```

若 `vite.config.ts` 无需修改，不要暂存或制造格式 churn。

## Task 20: 配置 Vercel 独立环境并完成最终验证

**Files:**
- Modify: `docs/marketing-trust-local-development.md`
- Create: `docs/marketing-trust-vercel-runbook.md`

- [ ] **Step 1: 升级并验证 Vercel CLI**

```bash
npm install --global vercel@latest
vercel --version
```

Expected: 当前最新稳定版；若全局安装受限，使用 `npx vercel@latest --version` 和后续命令。

- [ ] **Step 2: 配置独立环境变量**

在 Preview 和 Production 配置：

- `MARKETING_EVIDENCE_DB_NAME`
- `MARKETING_WORKSPACE_ID`
- `MARKETING_EVIDENCE_BLOB_READ_WRITE_TOKEN`

不得覆盖：

- `KNOWLEDGE_DB_NAME`
- 知识云 Blob token；
- 知识云 ingestion token。

使用 Vercel UI/CLI 读取变量名验证，不输出变量值到日志。

- [ ] **Step 3: 检查独立 Blob Store**

确认 `duocloud-marketing-evidence`：

- 绑定到当前项目；
- token 只映射到 `MARKETING_EVIDENCE_BLOB_READ_WRITE_TOKEN`；
- 上传 pathname 只含 `marketing-evidence/`；
- 没有 `knowledge-assets/`；
- 知识云 store 数量与对象不变。

- [ ] **Step 4: Preview 部署和 smoke test**

```bash
vercel
```

在 Preview：

- 登录；
- 创建 private draft；
- 上传图片、视频和 PDF；
- 预览、提交、审核；
- 检查版本与 audit；
- 验证 private attachment 未授权返回 401/403；
- 验证 marketing 页面不请求 knowledge API；
- 切换 knowledge 确认原功能和附件正常。

- [ ] **Step 5: 最终测试与文档**

```bash
npm test
npm run lint
npm run build
npm run check:marketing-isolation -- --base e22d9f6
```

把环境变量名、Blob Store 名、回退开关、索引初始化和故障恢复写入 `docs/marketing-trust-vercel-runbook.md`，不记录任何 secret。

- [ ] **Step 6: 最终提交**

```bash
git add docs/marketing-trust-local-development.md docs/marketing-trust-vercel-runbook.md
git commit -m "docs(marketing-trust): add deployment and rollback runbook"
```

## Final Verification Checklist

- [ ] 营销可信只显示证据主表、我的草稿、审核队列。
- [ ] 所有内容形态属于同一 `marketing_evidence_assets` 文档。
- [ ] 主表、创建、详情、单条编辑、批量编辑和字段视图共用同一 registry。
- [ ] member/admin 权限、私有草稿、审核和共享流转通过 API 集成测试。
- [ ] owner 修改 shared 立即生效并生成 version/audit。
- [ ] version 冲突返回 409，客户端不静默覆盖。
- [ ] 字段显示、顺序、宽度、排序和筛选按用户持久化。
- [ ] 列宽只能在表头分隔线拖动，不在字段抽屉提供重复控件。
- [ ] 附件写入 `duocloud-marketing-evidence`，使用独立 token 和 private access。
- [ ] 图片、视频、PDF 和普通附件都可真实预览或安全打开。
- [ ] 迁移只处理服务器可追溯真实数据，dry-run 可核对并可重复执行。
- [ ] 营销可信加载和操作期间没有 `/api/knowledge-assets` 请求。
- [ ] 禁止修改的知识云文件不在 Git diff 中。
- [ ] 知识云数据数量和附件数量与实施前基线一致。
- [ ] `npm test`、`npm run lint`、`npm run build`、营销可信 E2E 全部通过。
- [ ] 本地验收完成后才默认切换 V2；部署和 push 需用户单独确认。
