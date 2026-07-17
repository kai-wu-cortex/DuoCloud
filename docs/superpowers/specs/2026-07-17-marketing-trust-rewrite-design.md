# 营销可信模块完整重写设计

日期：2026-07-17

状态：已获用户确认，可进入实施计划与执行阶段

范围：仅可信云下的营销可信模块

## 1. 目标

将现有营销可信模块完整重写为一个以“证据资产主表”为唯一事实来源的企业证据工作台。

新版必须：

- 使用营销可信专用 MongoDB collections 和独立 Vercel Blob Store。
- 支持成员私有草稿、管理员审核和企业共享。
- 将图片、视频、报告、对比等视为证据记录的内容形态，不建立重复业务表。
- 统一新建、详情、编辑、批量编辑和字段视图所使用的字段定义。
- 提供真实的数据持久化、附件上传、预览、版本历史和操作日志。
- 只迁移服务器可追溯的营销可信真实数据。
- 保证知识云代码、数据、API、同步和附件零变化。

## 2. 明确不在范围内

本次重写严禁修改或迁移：

- 知识云页面、组件、路由和交互。
- `/api/knowledge-assets/**`。
- 知识云 MongoDB collections。
- 知识云 Vercel Blob Store、Token 和附件引用。
- Obsidian、飞书和知识云 ingestion 工作流。
- `src/data/obsidianKnowledgeAssets.ts`。
- 浏览器中的旧营销可信 `localStorage` 数据。
- 旧版内置演示记录。

交付可信模块也不在本次范围内。

## 3. 已确认的产品原则

### 3.1 唯一事实来源

`marketing_evidence_assets` 是营销可信的唯一业务主表。图片案例、对比素材、过程视频、报告和客户问题均以主表记录及其内容字段、附件或关系表达。

### 3.2 简化导航

营销可信只保留三个工作入口：

1. 证据主表
2. 我的草稿
3. 审核队列

以下旧入口删除：

- 数据总览
- 客户表达
- 场景证据卡
- 对比证据图
- 过程短视频
- 可信报告
- 运营治理
- 发布中心

标签、客户问题和操作历史不占用一级导航。标签作为主表筛选和字段使用，客户问题作为证据内容或关联字段使用，操作历史在证据详情和管理员工具中查看。

### 3.3 两角色权限

系统使用现有登录会话，但营销可信仅区分两个业务角色：

- 成员
- 管理员

成员可以：

- 创建、编辑和删除自己的私有草稿。
- 提交自己的草稿审核。
- 查看企业共享证据。
- 直接修改自己创建的共享证据。

管理员可以：

- 查看所有私有草稿和共享证据。
- 审核、驳回、共享、下架、软删除和恢复记录。
- 查看版本历史和操作日志。
- 管理全部营销可信记录。

共享记录的创建者可以直接修改，修改立即生效，同时生成新版本和操作日志，不重新进入审核。

## 4. 信息架构与页面

### 4.1 证据主表

营销可信默认进入证据主表，不再默认进入总览。

主表提供：

- 全局搜索。
- 类型、状态、可信等级、来源、负责人等筛选。
- 排序、分页和批量选择。
- 表头直接拖动调整列宽。
- 字段显示、隐藏和顺序配置。
- 每用户字段偏好持久化。
- 快捷筛选：全部证据、场景案例、对比素材、含视频、高可信等级。
- 新建证据。
- 点击记录打开右侧证据工作面板。

内容形态只影响筛选和字段展示，不改变数据归属。

### 4.2 我的草稿

只展示当前成员拥有的 `private_draft`、`rejected` 和主动撤回记录。

成员可以：

- 继续编辑。
- 删除或恢复草稿。
- 补齐附件。
- 提交审核。

### 4.3 审核队列

管理员查看 `pending_review` 记录，并执行：

- 查看完整证据。
- 检查附件、来源、参数和风险边界。
- 通过并进入企业共享。
- 填写原因后驳回。

普通成员不显示管理员审核操作。

## 5. 证据工作面板

新建、详情和编辑共用同一个从右侧滑入的工作面板。打开面板时主表保留在背景中，关闭后恢复原搜索、筛选、排序、分页和滚动位置。

工作面板由两部分构成：

### 5.1 证据脊柱

始终显示：

- 字段完整度。
- 可信等级。
- 当前状态。
- 创建者和负责人。
- 最新版本与修改时间。
- 待补齐字段。

### 5.2 字段分区

字段分为：

1. 基础信息
2. 材料与工艺
3. 结果与风险
4. 图片、视频与附件

新建、单条编辑、批量编辑和字段视图必须引用同一份字段 schema，禁止各自维护字段清单。

## 6. 状态流转

状态采用以下稳定值：

- `private_draft`
- `pending_review`
- `rejected`
- `shared`
- `unlisted`
- `deleted`

流转规则：

1. 成员新建记录后为 `private_draft`。
2. 成员提交后变为 `pending_review`。
3. 管理员通过后变为 `shared`。
4. 管理员驳回后变为 `rejected`，回到创建者工作区。
5. 共享记录可以被管理员下架为 `unlisted`。
6. 删除采用 `deleted` 软删除，不立即物理删除。
7. 创建者修改自己的共享记录时保持 `shared`，立即生成版本记录。

## 7. MongoDB 数据架构

营销可信使用独立 collections：

### 7.1 `marketing_evidence_assets`

保存当前证据状态。

建议结构：

```ts
interface MarketingEvidenceAsset {
  _id: ObjectId;
  evidenceId: string;
  workspaceId: string;
  ownerId: string;
  createdBy: string;
  updatedBy: string;
  version: number;
  status:
    | 'private_draft'
    | 'pending_review'
    | 'rejected'
    | 'shared'
    | 'unlisted'
    | 'deleted';
  title: string;
  contentForms: Array<'case' | 'comparison' | 'image' | 'video' | 'report' | 'question'>;
  source: {
    type: string;
    reference?: string;
    traceable: boolean;
  };
  scene: {
    customerScene?: string;
    industry?: string[];
    targetCustomerTypes?: string[];
  };
  material: {
    substrateName?: string;
    surfaceTreatments?: string[];
    substrateSource?: string;
    foilSeries?: string;
    foilModel?: string;
    foilColor?: string;
  };
  process: {
    processType?: string;
    temperature?: string;
    pressure?: string;
    speed?: string;
    equipment?: string;
    moldType?: string;
  };
  result: {
    visualResult?: string;
    testResultSummary?: string;
    defects?: string[];
  };
  trust: {
    level?: 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
    authenticityScore?: number;
    visibility?: 'public' | 'redacted_public' | 'internal' | 'specified_customers';
    evidenceStrength?: 'weak' | 'medium' | 'strong';
  };
  risk: {
    boundary?: string;
    forbiddenClaims?: string;
  };
  communication: {
    customerScriptCn?: string;
    customerScriptEn?: string;
    recommendedUse?: string[];
  };
  tags: string[];
  attachmentIds: ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  submittedAt?: Date;
  sharedAt?: Date;
  deletedAt?: Date;
}
```

#### 7.1.1 内容形态字段

删除独立导航页面不代表删除其业务字段。所有内容形态字段仍属于同一条 `marketing_evidence_assets` 文档，并由统一 schema registry 定义为可组合的类型化字段组：

- `caseContent`：客户痛点、客户阶段、推荐膜、替代膜、参数摘要、结果摘要、通过结论、重测条件、销售沟通要点和客户下一步。
- `comparisonContent`：对比类型、对象 A/B、各自条件与结果、共同参数、变量、对比结论、推荐条件和风险解释。
- `videoContent`：视频类型、原始视频、剪辑视频、封面、时长、可见内容项、拍摄地点与日期、操作人员展示方式和隐私审核。
- `reportContent`：客户需求、推荐方案、关联证据、关键参数、测试结论、风险边界、下一步和报告输出元数据。
- `questionContent`：客户原话、问题类型、标准回答、禁止回答和关联证据。

一条证据可以同时启用多个内容形态。例如，同一条客户封样证据可以同时包含实拍图片、过程视频和客户问答，但仍只有一个 `evidenceId`、一套材料工艺参数、一组风险边界和一个共享状态。

内容形态字段中的文件值只能保存 `attachmentIds`，不得保存临时本地文件名或知识云附件引用。

### 7.2 `marketing_evidence_attachments`

保存独立 Blob Store 中附件的元数据：

- 所属证据。
- Blob URL 和 pathname。
- 原文件名、MIME、大小和校验值。
- 图片宽高、缩略图和预览 URL。
- 视频时长、封面和转码状态。
- 上传者、上传时间和删除状态。

### 7.3 `marketing_evidence_versions`

每次成功修改后保存：

- 证据 ID。
- 版本号。
- 完整业务快照。
- 修改者。
- 修改原因。
- 创建时间。

版本记录与主文档分开，避免主文档无限增长。

### 7.4 `marketing_evidence_reviews`

保存提交与审核信息：

- 提交版本。
- 提交人和时间。
- 审核人和时间。
- 通过或驳回。
- 审核意见。

### 7.5 `marketing_evidence_audit_logs`

保存创建、编辑、批量修改、审核、下架、删除、恢复和附件操作。

### 7.6 `marketing_evidence_preferences`

按用户保存：

- 字段显示和隐藏。
- 字段顺序。
- 列宽。
- 默认排序。
- 已保存筛选视图。

## 8. 附件隔离

营销可信使用独立 Vercel Blob Store：

`duocloud-marketing-evidence`

要求：

- 使用独立环境变量和 Token。
- Blob pathname 统一使用 `marketing-evidence/<workspace>/<evidenceId>/...`。
- 不复用知识云 Blob Token。
- 不扫描或迁移知识云附件。
- 图片上传后生成 WebP 预览和缩略图。
- 视频上传后生成封面并支持内嵌播放。
- 原始文件保留。
- 上传过程逐文件显示进度、失败原因和重试。

## 9. API 设计

营销可信使用专用 API namespace：

- `GET /api/marketing-evidence`
- `POST /api/marketing-evidence`
- `GET /api/marketing-evidence/:id`
- `PATCH /api/marketing-evidence/:id`
- `DELETE /api/marketing-evidence/:id`
- `POST /api/marketing-evidence/:id/submit`
- `POST /api/marketing-evidence/:id/review`
- `POST /api/marketing-evidence/:id/restore`
- `POST /api/marketing-evidence/bulk`
- `POST /api/marketing-evidence/attachments`
- `DELETE /api/marketing-evidence/attachments/:id`
- `GET /api/marketing-evidence/preferences`
- `PATCH /api/marketing-evidence/preferences`

所有路由必须：

- 使用现有 session 认证。
- 在服务器端执行角色与 owner 权限判断。
- 仅访问 `marketing_evidence_*` collections。
- 使用统一成功和错误响应结构。
- 对修改请求执行版本检查。

## 10. 并发、错误与恢复

### 10.1 并发编辑

客户端修改时提交当前版本号。版本不一致返回 `409 Conflict`，界面提供：

- 重新加载最新版本。
- 将当前修改另存为新草稿。

系统不得静默覆盖其他用户修改。

### 10.2 自动保存

- 草稿编辑采用节流自动保存。
- 自动保存失败时保留当前表单状态。
- 界面显示“尚未同步”和重试。
- 用户显式保存时提供明确成功或失败反馈。

### 10.3 附件失败

- 每个文件独立上传和重试。
- Blob 上传成功但 MongoDB 写入失败时执行补偿删除或记录待清理任务。
- MongoDB 写入成功前不将附件显示为已保存。

### 10.4 删除与恢复

- 默认软删除。
- 管理员可以恢复。
- Blob 原文件不会因普通软删除立即移除。
- 永久清理必须是单独的管理员维护操作。

## 11. 迁移方案

只迁移服务器可追溯的营销可信真实数据。

迁移脚本必须：

- 只读取明确指定的营销可信服务器数据源。
- 排除内置演示数据和前端常量。
- 不读取浏览器 `localStorage`。
- 不读取知识云 collections 或附件。
- 先生成 dry-run 报告。
- 报告源记录数、有效记录数、重复记录数、跳过记录数和失败原因。
- 使用稳定业务键保证重复运行幂等。
- 导入后执行数量、字段完整度和附件引用核对。

如果没有服务器可追溯的真实营销可信数据，新数据库从空库开始。

## 12. 本地替换策略

1. 新版以独立 `MarketingTrustV2` 实现。
2. 旧版继续保留，并由本地功能开关控制。
3. 先完成 MongoDB API、权限、附件和迁移验证。
4. 本地验收通过后才将营销可信入口指向 V2。
5. 验收前不部署、不推送、不删除旧版。
6. 最终移除旧版前再次核对数据和回退路径。

## 13. 允许和禁止修改的代码范围

允许新增或修改：

- `src/features/marketing-trust/**`
- `src/server/marketingEvidence/**`
- `api/marketing-evidence/**`
- `scripts/migrateMarketingEvidence.ts`
- 营销可信专用类型、测试和配置
- `src/App.tsx` 中营销可信入口和懒加载边界

禁止修改：

- 知识云组件和页面
- `api/knowledge-assets/**`
- `src/server/knowledgeAssets.ts`
- `src/data/obsidianKnowledgeAssets.ts`
- 知识云同步脚本
- 知识云 MongoDB 和 Blob 配置
- Obsidian 与飞书 ingestion 逻辑

## 14. 测试与验收

### 14.1 单元测试

- 字段 schema、默认值和校验规则。
- 状态流转。
- 角色和 owner 权限。
- 完整度计算。
- 版本冲突。
- 迁移转换与演示数据排除。

### 14.2 API 集成测试

- 创建、读取、修改、提交、审核、恢复和软删除。
- 成员不能访问他人私有草稿。
- 管理员可以处理全部记录。
- 共享证据对企业成员可见。
- 批量编辑只修改允许字段。
- 附件元数据与证据引用保持一致。

### 14.3 浏览器测试

- 桌面和移动端登录。
- 主表搜索、筛选、排序和分页。
- 表头拖动列宽。
- 字段显示、隐藏、顺序和偏好恢复。
- 新建、自动保存、提交、审核和共享。
- 图片和视频批量拖拽、预览、删除和重试。
- 右侧工作面板动画、关闭和返回原位置。

### 14.4 知识云隔离回归

- 营销可信测试期间不得请求 `/api/knowledge-assets`。
- 知识云主要页面功能保持可用。
- 知识云数据数量和附件数量不变。
- Git 差异中不允许出现知识云禁止修改文件。

### 14.5 构建门槛

- TypeScript 检查通过。
- 单元测试通过。
- API 集成测试通过。
- 生产构建通过。
- 浏览器核心流程通过。

## 15. 完成定义

只有同时满足以下条件才算重写完成：

- 营销可信导航只保留证据主表、我的草稿和审核队列。
- 主表是唯一事实来源。
- MongoDB collections 与知识云隔离。
- 使用独立营销可信 Blob Store。
- 两角色权限和私有转共享工作流真实可用。
- 新建、详情、编辑、批量编辑和字段视图共用字段 schema。
- 附件可以批量上传、预览、播放、重试、删除和恢复。
- 版本历史、操作日志和并发冲突处理可用。
- 服务器迁移报告可核对。
- 本地浏览器验收通过。
- 知识云代码、数据、API、同步和附件保持零变化。
