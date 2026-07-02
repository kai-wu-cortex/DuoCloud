<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/bc2822f2-bcb2-4f71-91d3-96e82e17e277

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy the environment template and set MongoDB/session values:
   `cp .env.example .env`
3. Create the first Knowledge Cloud user:
   `npm run create:knowledge-user -- --username admin --password 'change-me' --role admin`
4. Run the app:
   `npm run dev`

Knowledge Cloud uses `MONGODB_URI`, optional `MONGODB_DIRECT_URI`, `KNOWLEDGE_DB_NAME`, and `SESSION_SECRET` from the environment. The login database collection is `system_users`.

## Knowledge Cloud Agent API

The Knowledge Cloud API supports both browser session auth and agent/CLI bearer-token auth. This lets the local `hotfoil-knowledge-ingestion` skill update the website knowledge cards after it updates Obsidian, MCP indexes, Cloudflare KV, and Feishu.

Set these environment variables in local/Vercel environments:

```bash
DUOCLOUD_AGENT_API_TOKEN="long-random-token"
DUOCLOUD_AGENT_API_ROLE="admin"
```

Agent requests use:

```http
Authorization: Bearer $DUOCLOUD_AGENT_API_TOKEN
```

Supported Knowledge Cloud endpoints:

- `GET /api/knowledge-assets` - list active knowledge cards.
- `GET /api/knowledge-assets/export` - export active knowledge cards.
- `POST /api/knowledge-assets/bulk` - bulk upsert knowledge cards from Obsidian, an external update app, or an agent CLI.
- `GET /api/knowledge-assets/agent` - verify bearer-token agent access and return API health metadata.
- `POST /api/knowledge-assets/agent` - agent-friendly card operations that do not require a browser session.
- `POST /api/knowledge-assets` - create one card.
- `PUT /api/knowledge-assets/:id` - update one card with `serverVersion`.
- `DELETE /api/knowledge-assets/:id` - archive one card with `serverVersion`.

Bulk upsert payload:

```json
{
  "source": "obsidian_import",
  "input": "hotfoil-skill-sync-2026-07-02",
  "assets": []
}
```

`source` can be `obsidian_import`, `external_update_app`, `agent_cli`, or `duocloud`.

Agent operation payloads:

```json
{ "action": "health" }
```

```json
{
  "action": "upsert",
  "source": "agent_cli",
  "input": "manual-agent-update-2026-07-02",
  "asset": {
    "id": "OBS-EXAMPLE",
    "category": "knowledge_governance",
    "title": "示例知识卡",
    "tags": ["Obsidian同步"],
    "lastUpdated": "2026-07-02",
    "author": "HotFoil Agent",
    "content": "支持 Markdown/HTML 富文本内容。"
  }
}
```

```json
{
  "action": "patch",
  "id": "OBS-EXAMPLE",
  "patch": {
    "title": "更新后的标题",
    "tags": ["人工可读", "Obsidian同步"]
  }
}
```

```json
{ "action": "delete", "id": "OBS-EXAMPLE" }
```

The agent endpoint is intended for the local `hotfoil-knowledge-ingestion` skill, automation agents, and a separate database update app. It uses revision logging and server-managed versions internally, so callers do not need to fetch and submit `serverVersion` for patch/delete operations.

## HotFoil Skill Website Sync

After the `hotfoil-knowledge-ingestion` skill updates the Obsidian vault, run one of these commands to sync the website cards.

Local Mongo-backed sync from the fixed HotFoil Obsidian vault:

```bash
npm run knowledge:agent -- obsidian \
  --input "hotfoil-skill-sync-$(date +%F)"
```

Remote/Vercel HTTP sync:

```bash
npm run knowledge:agent -- obsidian \
  --endpoint "https://your-duocloud-domain.vercel.app" \
  --token "$DUOCLOUD_AGENT_API_TOKEN" \
  --input "hotfoil-skill-sync-$(date +%F)"
```

Sync a prepared JSON file containing `KnowledgeAsset[]` or `{ "assets": [...] }`:

```bash
npm run knowledge:agent -- file \
  --file ./outputs/knowledge_cloud_import_20260630/knowledge_cloud_import_data.json \
  --source external_update_app \
  --input "field-template-import"
```

Preview without writing:

```bash
npm run knowledge:agent -- obsidian --dry-run
```

Export for audit:

```bash
npm run knowledge:agent -- export
```

Agent/CLI card operations:

```bash
npm run knowledge:agent -- health

npm run knowledge:agent -- upsert \
  --file ./one-knowledge-asset.json \
  --source agent_cli \
  --input "agent-single-card"

npm run knowledge:agent -- patch \
  --id OBS-EXAMPLE \
  --set title="更新后的标题" \
  --set author="HotFoil Agent"

npm run knowledge:agent -- delete --id OBS-EXAMPLE
```

For a deployed Vercel site, add `--endpoint "https://your-duocloud-domain.vercel.app"` and either set `DUOCLOUD_AGENT_API_TOKEN` locally or pass `--token "$DUOCLOUD_AGENT_API_TOKEN"`.
