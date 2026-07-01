# Knowledge Cloud MongoDB Sync Design

## Goal

Upgrade DuoCloud Knowledge Cloud from browser-local persistence to an online MongoDB-backed system deployed on Vercel. Knowledge Cloud becomes the first online read/write module. Practice Cloud remains local/current-state for now and will be migrated later after its interactions are stabilized.

## Confirmed Decisions

- MongoDB is the source of truth for Knowledge Cloud.
- DuoCloud Knowledge Cloud is a read/write client, not only a viewer.
- Knowledge Cloud gets dedicated Mongo APIs instead of generic collection APIs.
- Authentication follows the BuyerManageSystem pattern: username/password login, HttpOnly session cookie, server-side session verification.
- The login screen will reuse the BuyerManageSystem login layout with DuoCloud branding and copy.
- A separate database update app will be built later; it should use the same bulk API or service-level access.
- Vercel deployment and environment setup are part of the implementation scope.

## Architecture

The app will use Vercel API routes as the backend boundary. The React frontend will call dedicated Knowledge Cloud APIs. The API layer will connect to MongoDB Atlas and enforce authentication, role permissions, schema validation, version checks, and revision logging.

Main components:

- `DuoCloudLogin`: login UI adapted from BuyerManageSystem `SystemLogin`.
- `sessionAuth`: signed session cookie helpers.
- `loginApi` / `logoutApi` / `authMeApi`: authentication endpoints.
- `mongodb`: shared MongoDB connection helper.
- `knowledgeAssetApi`: Knowledge Cloud CRUD, search, bulk import, and export endpoints.
- `knowledgeApi`: frontend client for Knowledge Cloud API calls.
- `appState`: keeps local fallback cache behavior, but MongoDB becomes primary.

## API Design

Authentication:

- `POST /api/login`
- `POST /api/logout`
- `GET /api/auth/me`

Knowledge assets:

- `GET /api/knowledge-assets`
- `POST /api/knowledge-assets`
- `GET /api/knowledge-assets/:id`
- `PUT /api/knowledge-assets/:id`
- `DELETE /api/knowledge-assets/:id`
- `POST /api/knowledge-assets/bulk`
- `GET /api/knowledge-assets/export`

The generic BuyerManageSystem `/api/data/[collection]` approach will not be copied as the primary interface because Knowledge Cloud needs domain-specific validation, revision tracking, and bulk import behavior.

## MongoDB Collections

`system_users`

- Stores login users.
- Fields follow the BuyerManageSystem pattern: `_id`, `username`, `role`, `salt`, `passwordHash`.

`knowledge_assets`

- Stores current Knowledge Cloud cards.
- `_id` and `id` should match the KnowledgeAsset id.
- Existing KnowledgeAsset fields are preserved to avoid broad UI rewrites.
- Server metadata is added for governance.

Suggested shape:

```ts
{
  _id: string;
  id: string;
  category: KnowledgeTableType;
  title: string;
  content: string;
  tags: string[];
  author: string;
  lastUpdated: string;

  // Category-specific fields remain inline.
  productName?: string;
  tempRange?: string;
  detailedContent?: string;

  status: 'active' | 'archived' | 'draft';
  source: 'duocloud' | 'obsidian_import' | 'external_update_app';
  sourcePath?: string;
  directoryLevel1?: string;
  directoryLevel2?: string;
  directoryLevel3?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: { uid: string; username: string };
  updatedBy?: { uid: string; username: string };
  deletedAt?: Date;
}
```

`knowledge_asset_revisions`

- Stores a revision entry for every create, update, delete, bulk update, or import.
- Includes asset id, previous snapshot or summary, next snapshot or summary, actor, operation, createdAt.

`knowledge_asset_import_jobs`

- Stores bulk import job metadata.
- Includes source app, input filename/source, startedAt, completedAt, counts for created/updated/skipped/failed, and errors.

## Roles And Permissions

Roles:

- `viewer`: can view, search, filter, and export.
- `editor`: can create, edit, and batch edit.
- `admin`: can import, delete, manage users later, and operate database update workflows.

Frontend behavior:

- Unauthenticated users see the DuoCloud login screen.
- `viewer` users do not see create, edit, batch edit, import, or delete controls.
- `editor` users can use normal Knowledge Cloud maintenance features.
- `admin` users can use import, delete, bulk, and later admin-only update functions.

API behavior:

- All Knowledge Cloud API routes require a valid session.
- Mutating routes require `editor` or `admin`.
- Import, delete, and administrative bulk operations require `admin`.

## Frontend Data Flow

On app startup:

1. Call `GET /api/auth/me`.
2. If unauthenticated, show the login screen.
3. If authenticated and the active module is Knowledge Cloud, call `GET /api/knowledge-assets`.
4. On success, use MongoDB data and update local fallback cache.
5. On API failure, load local cache and show an offline/cache status.

On write:

1. User creates, edits, imports, or batch edits a card.
2. Frontend calls the relevant Knowledge Cloud API.
3. API validates payload, role, and version.
4. API writes MongoDB and creates revision records.
5. Frontend updates the local list from the response or refreshes the current page.

## Conflict Handling

First version uses optimistic version control.

- Every card has a numeric `version`.
- Frontend sends the current `version` on update.
- API returns `409 CONFLICT` if MongoDB contains a newer version.
- Frontend tells the user to refresh the card and reapply changes.

No real-time collaboration or locking is included in the first implementation.

## Offline And Fallback Behavior

`localStorage` remains as a fallback cache only.

- If MongoDB loads successfully, cache is refreshed.
- If MongoDB/API is unavailable, Knowledge Cloud can show cached data in a read-only or degraded state.
- Mutating actions should be disabled while offline unless a future queued-write mode is explicitly designed.

## Independent Database Update App

The future database update app should not invent a separate schema.

Recommended integration:

- Use `POST /api/knowledge-assets/bulk` for validated imports and updates.
- Use `admin` session or a later `SERVICE_API_KEY` mechanism.
- Let the DuoCloud API own validation, upsert rules, revision logging, and import job records.

Direct MongoDB writes are possible but should be reserved for controlled maintenance scripts.

## Login UI

The login screen should reuse BuyerManageSystem's layout and interaction pattern, with DuoCloud wording:

- Brand: `Double Cloud`
- Subtitle: `INDUSTRIAL OS`
- Main copy: `知识云在线系统登入验证`
- Description: `使用系统账号密码登入，知识卡片从 MongoDB 在线知识库读取。`
- System tags: `DB: MongoDB Atlas`, `AUTH: 账号密码`

## Vercel Configuration

Required environment variables:

```env
MONGODB_URI=
MONGODB_DIRECT_URI=
SESSION_SECRET=
KNOWLEDGE_DB_NAME=duocloudDB
```

Vercel configuration should include API route bundling for server files, following the BuyerManageSystem pattern:

- Build command remains compatible with the existing Vite app.
- `api/**/*.ts` includes required `src/server/**/*.ts` and `src/lib/**/*.ts` files.
- Static frontend routes rewrite to `index.html`.

## Error Handling

- `401 UNAUTHORIZED`: session missing or expired; return to login.
- `403 FORBIDDEN`: user lacks role permission; hide controls or show permission message.
- `404 NOT_FOUND`: asset or endpoint not found.
- `409 CONFLICT`: version mismatch; prompt refresh.
- `422 VALIDATION_ERROR`: invalid KnowledgeAsset fields or table type.
- `500 MONGODB_API_ERROR`: server/database failure with safe message.

Database connection strings and secrets must never be exposed to the frontend.

## Testing Plan

Backend tests:

- Session token creation and verification.
- Login success and failure.
- Role permission checks.
- Knowledge asset CRUD.
- Version conflict returns `409`.
- Bulk import creates/updates/skips correctly.
- Revision records are written.

Frontend/unit tests:

- Authenticated startup loads Mongo assets.
- API failure falls back to local cache.
- Viewer role hides write controls.
- Editor role can submit create/update.
- Admin role can import and delete.

Integration checks:

- Local API smoke test with MongoDB env vars.
- Vercel deployment health check.
- Login, load Knowledge Cloud, edit one card, refresh, confirm persistence.

## Implementation Order

1. Add MongoDB dependency and shared Mongo connection helper.
2. Add session auth helpers and login/logout/me APIs.
3. Add DuoCloud login screen adapted from BuyerManageSystem.
4. Add Knowledge Cloud server API handlers and Vercel API route files.
5. Add frontend `knowledgeApi` client.
6. Change `App.tsx` Knowledge Cloud state to load from API with local fallback.
7. Route create/edit/batch/import/export actions through API.
8. Add revision and import job logging.
9. Add tests and local smoke checks.
10. Configure Vercel env vars and deploy.

## Out Of Scope For First Pass

- Practice Cloud MongoDB migration.
- Real-time collaboration.
- User management UI.
- Full audit dashboard.
- Service API key for the independent update app, unless needed immediately.
- Queued offline writes.
