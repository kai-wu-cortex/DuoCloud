import { config } from 'dotenv';
import type { Request, Response } from 'express';
import { initialKnowledgeAssets } from '../src/data/mockData';
import { obsidianKnowledgeAssets } from '../src/data/obsidianKnowledgeAssets';
import { closeMongoClient } from '../src/lib/mongodb';
import { curateKnowledgeAssets } from '../src/lib/knowledgeCuration';
import { handleKnowledgeAssetBulkRequest } from '../src/server/knowledgeAssetApi';
import { createSessionToken, getSessionSecret } from '../src/server/sessionAuth';

function isBlankEnv(value: string | undefined) {
  return !value || value === '""' || value === "''";
}

function buildAtlasDirectUriFromSrv(uri: string) {
  const scheme = 'mongodb+srv://';
  if (!uri.startsWith(scheme)) return null;

  const withoutScheme = uri.slice(scheme.length);
  const atIndex = withoutScheme.lastIndexOf('@');
  if (atIndex === -1) return null;

  const credentials = withoutScheme.slice(0, atIndex);
  const slashIndex = withoutScheme.indexOf('/', atIndex + 1);
  const pathAndQuery = slashIndex === -1 ? '/' : withoutScheme.slice(slashIndex);
  const dbPath = pathAndQuery.split('?')[0] || '/';
  const hosts = [
    'ac-rgifjq0-shard-00-00.8ur0vlm.mongodb.net:27017',
    'ac-rgifjq0-shard-00-01.8ur0vlm.mongodb.net:27017',
    'ac-rgifjq0-shard-00-02.8ur0vlm.mongodb.net:27017',
  ].join(',');

  return `mongodb://${credentials}@${hosts}${dbPath}?authSource=admin&replicaSet=atlas-139myh-shard-0&ssl=true&retryWrites=true&w=majority`;
}

config({ path: '.env.local', override: true, quiet: true });

if (isBlankEnv(process.env.MONGODB_URI) && isBlankEnv(process.env.MONGODB_DIRECT_URI)) {
  config({
    path: '/Users/kyle/codex project/BuyerManageSystem/.env.production.local',
    override: true,
    quiet: true,
  });
}

if (isBlankEnv(process.env.MONGODB_DIRECT_URI) && !isBlankEnv(process.env.MONGODB_URI)) {
  const directUri = buildAtlasDirectUriFromSrv(process.env.MONGODB_URI as string);
  if (directUri) {
    process.env.MONGODB_DIRECT_URI = directUri;
    process.env.MONGODB_URI = directUri;
  }
}

process.env.KNOWLEDGE_DB_NAME = 'duocloudDB';
if (isBlankEnv(process.env.SESSION_SECRET)) {
  process.env.SESSION_SECRET = 'duocloud-local-seed-import-session-secret';
}

const CHUNK_SIZE = 100;

interface BulkPayload {
  success?: boolean;
  data?: {
    counts?: {
      created: number;
      updated: number;
      skipped: number;
      failed: number;
    };
    errors?: Array<{ id: string; message: string }>;
  };
  message?: string;
}

function createAdminCookie() {
  const token = createSessionToken(
    { uid: 'seed-import-admin', username: 'seed-import', role: 'admin' },
    getSessionSecret(),
  );
  return `duocloud_session=${token}`;
}

async function runBulkImport(body: unknown, cookie: string): Promise<BulkPayload> {
  let statusCode = 200;
  let payload: BulkPayload | null = null;

  const req = {
    method: 'POST',
    headers: { cookie },
    body,
  } as Pick<Request, 'method' | 'headers' | 'body'>;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: BulkPayload) {
      payload = value;
      return this;
    },
  } as Pick<Response, 'status' | 'json'>;

  await handleKnowledgeAssetBulkRequest(req, res);

  if (!payload || statusCode >= 400 || !payload.success) {
    throw new Error(payload?.message || `Bulk import failed with HTTP ${statusCode}`);
  }

  return payload;
}

async function main() {
  const sourceAssets = curateKnowledgeAssets([...obsidianKnowledgeAssets, ...initialKnowledgeAssets]);
  const uniqueAssets = Array.from(new Map(sourceAssets.map(asset => [asset.id, asset])).values());
  const cookie = createAdminCookie();
  const total = { created: 0, updated: 0, skipped: 0, failed: 0 };
  const errors: Array<{ id: string; message: string }> = [];

  for (let index = 0; index < uniqueAssets.length; index += CHUNK_SIZE) {
    const chunk = uniqueAssets.slice(index, index + CHUNK_SIZE);
    const result = await runBulkImport({
      source: 'obsidian_import',
      input: `seeded-knowledge-assets-${new Date().toISOString().slice(0, 10)}`,
      assets: chunk,
    }, cookie);
    const counts = result.data?.counts;
    if (!counts) throw new Error('Bulk import returned no counts.');

    total.created += counts.created;
    total.updated += counts.updated;
    total.skipped += counts.skipped;
    total.failed += counts.failed;
    errors.push(...(result.data?.errors ?? []));

    console.log(JSON.stringify({
      batch: `${Math.floor(index / CHUNK_SIZE) + 1}/${Math.ceil(uniqueAssets.length / CHUNK_SIZE)}`,
      size: chunk.length,
      counts,
    }));
  }

  console.log(JSON.stringify({
    inputAssets: sourceAssets.length,
    uniqueAssets: uniqueAssets.length,
    counts: total,
    errors,
  }, null, 2));

  if (total.failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoClient();
  });
