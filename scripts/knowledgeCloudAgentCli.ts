import { config } from 'dotenv';
import type { Request, Response } from 'express';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeMongoClient } from '../src/lib/mongodb';
import { convertObsidianNotesToKnowledgeAssets, type ObsidianNoteInput } from '../src/lib/obsidianKnowledgeImport';
import { curateKnowledgeAssets } from '../src/lib/knowledgeCuration';
import { handleKnowledgeAssetBulkRequest, handleKnowledgeAssetExportRequest } from '../src/server/knowledgeAssetApi';
import type { KnowledgeAsset } from '../src/types';

const DEFAULT_VAULT_PATH = '/Users/kyle/Library/Mobile Documents/iCloud~md~obsidian/Documents/HotFoil_Database';
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

config({ path: join(repoRoot, '.env.local'), quiet: true });
config({ path: join(repoRoot, '.env'), quiet: true });

type Mode = 'obsidian' | 'file' | 'export';

interface CliOptions {
  mode: Mode;
  vault: string;
  file?: string;
  endpoint?: string;
  token?: string;
  input: string;
  source: 'obsidian_import' | 'external_update_app' | 'agent_cli';
  chunkSize: number;
  dryRun: boolean;
}

interface BulkResponse {
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

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    mode: 'obsidian',
    vault: DEFAULT_VAULT_PATH,
    input: `hotfoil-agent-sync-${new Date().toISOString().slice(0, 10)}`,
    source: 'obsidian_import',
    chunkSize: 100,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === 'obsidian' || arg === 'file' || arg === 'export') {
      options.mode = arg;
      continue;
    }
    if (arg === '--vault' && next) {
      options.vault = next;
      index += 1;
      continue;
    }
    if (arg === '--file' && next) {
      options.file = next;
      options.mode = options.mode === 'obsidian' ? 'file' : options.mode;
      index += 1;
      continue;
    }
    if (arg === '--endpoint' && next) {
      options.endpoint = next.replace(/\/+$/, '');
      index += 1;
      continue;
    }
    if (arg === '--token' && next) {
      options.token = next;
      index += 1;
      continue;
    }
    if (arg === '--input' && next) {
      options.input = next;
      index += 1;
      continue;
    }
    if (arg === '--source' && next) {
      if (next === 'obsidian_import' || next === 'external_update_app' || next === 'agent_cli') {
        options.source = next;
      }
      index += 1;
      continue;
    }
    if (arg === '--chunk-size' && next) {
      options.chunkSize = Math.max(1, Number.parseInt(next, 10) || options.chunkSize);
      index += 1;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

function collectMarkdownNotes(root: string, current = root): ObsidianNoteInput[] {
  const entries = readdirSync(current, { withFileTypes: true });
  const notes: ObsidianNoteInput[] = [];

  for (const entry of entries) {
    const fullPath = join(current, entry.name);
    if (entry.isDirectory()) {
      notes.push(...collectMarkdownNotes(root, fullPath));
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    notes.push({
      relativePath: relative(root, fullPath),
      content: readFileSync(fullPath, 'utf8'),
    });
  }

  return notes;
}

function loadAssetsFromFile(filePath: string): KnowledgeAsset[] {
  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  const assets = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { assets?: unknown }).assets)
      ? (raw as { assets: unknown[] }).assets
      : null;
  if (!assets) throw new Error('--file must contain a KnowledgeAsset[] or { "assets": KnowledgeAsset[] }.');
  return curateKnowledgeAssets(assets as KnowledgeAsset[]);
}

function loadAssetsFromObsidian(vault: string): KnowledgeAsset[] {
  const publicAssetDir = join(repoRoot, 'public/obsidian-assets');
  const publicAssetByName = new Map<string, string>();
  try {
    for (const entry of readdirSync(publicAssetDir, { withFileTypes: true })) {
      if (entry.isFile()) {
        publicAssetByName.set(entry.name, `/obsidian-assets/${encodeURIComponent(entry.name)}`);
        publicAssetByName.set(entry.name.replace(/^[A-Z0-9]+-/, ''), `/obsidian-assets/${encodeURIComponent(entry.name)}`);
      }
    }
  } catch {
    // Public attachment cache is optional. Missing images remain visible as attachment text.
  }

  return curateKnowledgeAssets(convertObsidianNotesToKnowledgeAssets(collectMarkdownNotes(vault), {
    resolveAttachmentUrl: (attachmentName) => {
      const normalized = attachmentName.replace(/^\.?\//, '');
      return publicAssetByName.get(basename(normalized));
    },
  }));
}

function uniqueAssets(assets: KnowledgeAsset[]): KnowledgeAsset[] {
  return Array.from(new Map(assets.map(asset => [asset.id, asset])).values());
}

async function postBulkToEndpoint(options: CliOptions, assets: KnowledgeAsset[]): Promise<BulkResponse> {
  const token = options.token || process.env.DUOCLOUD_AGENT_API_TOKEN || process.env.KNOWLEDGE_AGENT_API_TOKEN;
  if (!options.endpoint) throw new Error('Missing --endpoint.');
  if (!token) throw new Error('Missing DUOCLOUD_AGENT_API_TOKEN, KNOWLEDGE_AGENT_API_TOKEN, or --token.');

  const response = await fetch(`${options.endpoint}/api/knowledge-assets/bulk`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      source: options.source,
      input: options.input,
      assets,
    }),
  });
  const payload = await response.json().catch(() => null) as BulkResponse | null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || `Knowledge Cloud API failed with HTTP ${response.status}`);
  }
  return payload;
}

async function runLocalBulk(options: CliOptions, assets: KnowledgeAsset[]): Promise<BulkResponse> {
  const token = options.token || process.env.DUOCLOUD_AGENT_API_TOKEN || process.env.KNOWLEDGE_AGENT_API_TOKEN;
  if (!token) throw new Error('Missing DUOCLOUD_AGENT_API_TOKEN, KNOWLEDGE_AGENT_API_TOKEN, or --token.');

  let statusCode = 200;
  let payload: BulkResponse | null = null;
  const req = {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: {
      source: options.source,
      input: options.input,
      assets,
    },
  } as Pick<Request, 'method' | 'headers' | 'body'>;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: BulkResponse) {
      payload = value;
      return this;
    },
  } as Pick<Response, 'status' | 'json'>;

  await handleKnowledgeAssetBulkRequest(req, res);
  if (!payload?.success || statusCode >= 400) {
    throw new Error(payload?.message || `Knowledge Cloud local bulk failed with HTTP ${statusCode}`);
  }
  return payload;
}

async function runLocalExport(options: CliOptions): Promise<unknown> {
  const token = options.token || process.env.DUOCLOUD_AGENT_API_TOKEN || process.env.KNOWLEDGE_AGENT_API_TOKEN;
  if (!token) throw new Error('Missing DUOCLOUD_AGENT_API_TOKEN, KNOWLEDGE_AGENT_API_TOKEN, or --token.');

  let statusCode = 200;
  let payload: unknown = null;
  const req = {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  } as Pick<Request, 'method' | 'headers'>;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: unknown) {
      payload = value;
      return this;
    },
  } as Pick<Response, 'status' | 'json'>;

  await handleKnowledgeAssetExportRequest(req, res);
  if (statusCode >= 400) throw new Error(`Knowledge Cloud local export failed with HTTP ${statusCode}`);
  return payload;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.mode === 'export') {
    if (options.endpoint) {
      const token = options.token || process.env.DUOCLOUD_AGENT_API_TOKEN || process.env.KNOWLEDGE_AGENT_API_TOKEN;
      if (!token) throw new Error('Missing DUOCLOUD_AGENT_API_TOKEN, KNOWLEDGE_AGENT_API_TOKEN, or --token.');
      const response = await fetch(`${options.endpoint}/api/knowledge-assets/export`, {
        headers: { authorization: `Bearer ${token}` },
      });
      console.log(JSON.stringify(await response.json(), null, 2));
      return;
    }
    console.log(JSON.stringify(await runLocalExport(options), null, 2));
    return;
  }

  const assets = uniqueAssets(options.file ? loadAssetsFromFile(options.file) : loadAssetsFromObsidian(options.vault));
  const categoryCounts = assets.reduce<Record<string, number>>((result, asset) => {
    result[asset.category] = (result[asset.category] || 0) + 1;
    return result;
  }, {});

  if (options.dryRun) {
    console.log(JSON.stringify({
      dryRun: true,
      mode: options.file ? 'file' : 'obsidian',
      input: options.input,
      assets: assets.length,
      categoryCounts,
    }, null, 2));
    return;
  }

  const totals = { created: 0, updated: 0, skipped: 0, failed: 0 };
  const errors: Array<{ id: string; message: string }> = [];
  for (let index = 0; index < assets.length; index += options.chunkSize) {
    const chunk = assets.slice(index, index + options.chunkSize);
    const result = options.endpoint
      ? await postBulkToEndpoint(options, chunk)
      : await runLocalBulk(options, chunk);
    const counts = result.data?.counts;
    if (!counts) throw new Error('Bulk result returned no counts.');
    totals.created += counts.created;
    totals.updated += counts.updated;
    totals.skipped += counts.skipped;
    totals.failed += counts.failed;
    errors.push(...(result.data?.errors ?? []));
    console.log(JSON.stringify({
      batch: `${Math.floor(index / options.chunkSize) + 1}/${Math.ceil(assets.length / options.chunkSize)}`,
      size: chunk.length,
      counts,
    }));
  }

  console.log(JSON.stringify({
    mode: options.file ? 'file' : 'obsidian',
    input: options.input,
    uniqueAssets: assets.length,
    categoryCounts,
    counts: totals,
    errors,
  }, null, 2));
  if (totals.failed > 0) process.exitCode = 1;
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoClient();
  });
