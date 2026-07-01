import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, relative } from 'node:path';
import { config } from 'dotenv';
import type { Request, Response } from 'express';
import { put } from '@vercel/blob';
import sharp from 'sharp';
import { closeMongoClient, getMongoCollection } from '../src/lib/mongodb';
import type { KnowledgeAsset } from '../src/types';
import { handleKnowledgeAssetBulkRequest } from '../src/server/knowledgeAssetApi';
import { createSessionToken, getSessionSecret } from '../src/server/sessionAuth';

const DEFAULT_VAULT_PATH = '/Users/kyle/Library/Mobile Documents/iCloud~md~obsidian/Documents/HotFoil_Database';
const KNOWLEDGE_COLLECTION = 'knowledge_assets';
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.tif', '.tiff', '.gif', '.svg']);
const RASTER_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.tif', '.tiff']);
const MAX_WIDTH = 1600;
const MAX_HEIGHT = 1600;
const WEBP_QUALITY = 72;
const CHUNK_SIZE = 50;
const UPLOAD_TIMEOUT_MS = 90_000;

type KnowledgeAssetDocument = KnowledgeAsset & {
  _id: string;
  serverStatus?: string;
  serverDeletedAt?: Date;
};

interface ImageAsset {
  fullPath: string;
  relativePath: string;
  publicUrl: string;
  outputName: string;
}

interface AttachmentReference {
  original: string;
  fullPath: string;
  relativePath: string;
}

interface PreparedUpload {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  originalBytes: number;
  uploadedBytes: number;
  compressed: boolean;
}

function isBlankEnv(value: string | undefined) {
  return !value || value === '""' || value === "''";
}

function loadEnvFiles() {
  config({ path: '.env.local', override: true, quiet: true });
  config({ path: '.env.vercel.local', override: true, quiet: true });
  config({ path: '.env.vercel.production.local', override: true, quiet: true });
  for (const key of ['MONGODB_URI', 'MONGODB_DIRECT_URI', 'SESSION_SECRET', 'BLOB_READ_WRITE_TOKEN']) {
    if (isBlankEnv(process.env[key])) delete process.env[key];
  }
  if (isBlankEnv(process.env.MONGODB_URI) && !isBlankEnv(process.env.BUYER_MONGO_MONGODB_URI)) {
    process.env.MONGODB_URI = process.env.BUYER_MONGO_MONGODB_URI;
  }
  if (isBlankEnv(process.env.MONGODB_DIRECT_URI) && !isBlankEnv(process.env.MONGODB_URI)) {
    const directUri = buildAtlasDirectUriFromSrv(process.env.MONGODB_URI as string);
    if (directUri) {
      process.env.MONGODB_DIRECT_URI = directUri;
      process.env.MONGODB_URI = directUri;
    }
  }
  process.env.KNOWLEDGE_DB_NAME = 'duocloudDB';
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

function stableHash(value: string) {
  return createHash('sha1').update(value).digest('hex').slice(0, 12);
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim() || 'attachment';
}

function sanitizePathSegment(value: string) {
  return sanitizeFileName(value)
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'asset';
}

function getContentType(filePath: string) {
  switch (extname(filePath).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.avif':
      return 'image/avif';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    case '.tif':
    case '.tiff':
      return 'image/tiff';
    default:
      return 'application/octet-stream';
  }
}

function collectImageAssets(root: string, current = root): ImageAsset[] {
  const entries = readdirSync(current, { withFileTypes: true });
  const assets: ImageAsset[] = [];

  for (const entry of entries) {
    const fullPath = join(current, entry.name);
    if (entry.isDirectory()) {
      assets.push(...collectImageAssets(root, fullPath));
      continue;
    }
    if (!entry.isFile() || !IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;

    const relativePath = relative(root, fullPath);
    const outputName = `${legacyDjb2Hash(relativePath)}-${basename(entry.name)}`;
    assets.push({
      fullPath,
      relativePath,
      outputName,
      publicUrl: `/obsidian-assets/${encodeURIComponent(outputName)}`,
    });
  }

  return assets;
}

function legacyDjb2Hash(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

function decodeReference(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeReference(value: string) {
  return decodeReference(value)
    .replace(/^file:\/\//i, '')
    .replace(/^\.\//, '')
    .trim();
}

function buildImageLookup(vaultPath: string) {
  const images = collectImageAssets(vaultPath);
  const byPublicUrl = new Map<string, ImageAsset>();
  const byOutputName = new Map<string, ImageAsset>();
  const byRelativePath = new Map<string, ImageAsset>();
  const byBaseName = new Map<string, ImageAsset[]>();

  for (const image of images) {
    byPublicUrl.set(image.publicUrl, image);
    byPublicUrl.set(decodeReference(image.publicUrl), image);
    byOutputName.set(image.outputName, image);
    byOutputName.set(decodeReference(image.outputName), image);
    byRelativePath.set(image.relativePath, image);
    byRelativePath.set(normalizeReference(image.relativePath), image);
    const name = basename(image.relativePath);
    byBaseName.set(name, [...(byBaseName.get(name) ?? []), image]);
  }

  return { images, byPublicUrl, byOutputName, byRelativePath, byBaseName };
}

function isBlobUrl(value: string) {
  return /vercel-storage\.com/i.test(value) || /^https:\/\/[^/\s]+\/knowledge-assets\//i.test(value);
}

function extractImageReferences(value: string) {
  const references = new Set<string>();
  const patterns = [
    /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi,
    /!\[[^\]]*]\(([^)]+)\)/g,
    /!\[\[([^\]]+\.(?:png|jpe?g|webp|avif|gif|svg|tiff?))(?:\|[^\]]*)?]]/gi,
    /(\/obsidian-assets\/[^\s<>"')]+)/gi,
    /((?:[A-Za-z]:)?\/[^\n<>"'|]+\.(?:png|jpe?g|webp|avif|gif|svg|tiff?))/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(value)) !== null) {
      const candidate = (match[1] || '').trim();
      if (candidate && !isBlobUrl(candidate)) references.add(candidate);
    }
  }
  return Array.from(references);
}

function resolveReference(
  reference: string,
  asset: KnowledgeAssetDocument,
  lookup: ReturnType<typeof buildImageLookup>,
  vaultPath: string,
): AttachmentReference | null {
  const normalized = normalizeReference(reference);
  if (!normalized || /^https?:\/\//i.test(normalized) || normalized.startsWith('data:')) return null;

  if (normalized.startsWith('/obsidian-assets/') || normalized.startsWith('obsidian-assets/')) {
    const outputName = basename(normalized);
    const image = lookup.byPublicUrl.get(reference) || lookup.byPublicUrl.get(normalized) || lookup.byOutputName.get(outputName);
    return image ? { original: reference, fullPath: image.fullPath, relativePath: image.relativePath } : null;
  }

  if (existsSync(normalized)) {
    return { original: reference, fullPath: normalized, relativePath: relative(vaultPath, normalized) };
  }

  const fromVault = join(vaultPath, normalized);
  if (existsSync(fromVault)) {
    return { original: reference, fullPath: fromVault, relativePath: relative(vaultPath, fromVault) };
  }

  const byRelative = lookup.byRelativePath.get(normalized);
  if (byRelative) {
    return { original: reference, fullPath: byRelative.fullPath, relativePath: byRelative.relativePath };
  }

  const sourceDir = asset.sourcePath ? dirname(asset.sourcePath) : '';
  if (sourceDir) {
    const fromSourceDir = join(vaultPath, sourceDir, normalized);
    if (existsSync(fromSourceDir)) {
      return { original: reference, fullPath: fromSourceDir, relativePath: relative(vaultPath, fromSourceDir) };
    }
  }

  const basenameMatches = lookup.byBaseName.get(basename(normalized)) ?? [];
  if (basenameMatches.length === 1) {
    const image = basenameMatches[0];
    return { original: reference, fullPath: image.fullPath, relativePath: image.relativePath };
  }

  return null;
}

function getStringFieldEntries(asset: KnowledgeAssetDocument) {
  return Object.entries(asset)
    .filter(([key, value]) => !key.startsWith('server') && key !== '_id' && typeof value === 'string')
    .map(([key, value]) => [key, value as string] as const);
}

async function prepareImageUpload(fullPath: string): Promise<PreparedUpload> {
  const extension = extname(fullPath).toLowerCase();
  const original = readFileSync(fullPath);
  const originalBytes = original.byteLength;

  if (RASTER_EXTENSIONS.has(extension)) {
    const webp = await sharp(original, { animated: false, failOn: 'none' })
      .rotate()
      .resize({
        width: MAX_WIDTH,
        height: MAX_HEIGHT,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY, effort: 5 })
      .toBuffer();

    if (webp.byteLength < original.byteLength) {
      return {
        buffer: webp,
        fileName: `${sanitizeFileName(basename(fullPath, extension))}.webp`,
        contentType: 'image/webp',
        originalBytes,
        uploadedBytes: webp.byteLength,
        compressed: true,
      };
    }
  }

  return {
    buffer: original,
    fileName: sanitizeFileName(basename(fullPath)),
    contentType: getContentType(fullPath),
    originalBytes,
    uploadedBytes: originalBytes,
    compressed: false,
  };
}

async function uploadImage(reference: AttachmentReference, cache: Map<string, Promise<PreparedUpload & { url: string; pathname: string }>>) {
  const stat = statSync(reference.fullPath);
  const cacheKey = `${reference.fullPath}:${stat.size}:${stat.mtimeMs}`;
  let uploadPromise = cache.get(cacheKey);
  if (!uploadPromise) {
    uploadPromise = (async () => {
      const prepared = await prepareImageUpload(reference.fullPath);
      const sourceHash = stableHash(reference.relativePath);
      const pathname = [
        'knowledge-assets',
        'obsidian-migrated',
        sourceHash,
        prepared.fileName,
      ].join('/');
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), UPLOAD_TIMEOUT_MS);
      const blob = await put(pathname, prepared.buffer, {
        access: 'public',
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: prepared.contentType,
        abortSignal: abortController.signal,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      }).finally(() => clearTimeout(timeout));
      return { ...prepared, url: blob.url, pathname: blob.pathname };
    })();
    cache.set(cacheKey, uploadPromise);
  }
  return uploadPromise;
}

function replaceAllReferences(value: string, replacements: Map<string, string>) {
  let nextValue = value;
  for (const [from, to] of replacements) {
    nextValue = nextValue.split(from).join(to);
    const decoded = decodeReference(from);
    if (decoded !== from) nextValue = nextValue.split(decoded).join(to);
  }
  return nextValue;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripMissingReferences(value: string, references: string[]) {
  let nextValue = value;

  for (const reference of references) {
    const variants = Array.from(new Set([reference, decodeReference(reference)]));
    for (const variant of variants) {
      if (!variant) continue;
      const escaped = escapeRegExp(variant);
      nextValue = nextValue
        .replace(new RegExp(`<img\\b[^>]*\\bsrc=["']${escaped}["'][^>]*>`, 'gi'), '')
        .replace(new RegExp(`!\\[[^\\]]*]\\(${escaped}\\)`, 'g'), '')
        .replace(new RegExp(`!\\[\\[${escaped}(?:\\|[^\\]]*)?]]`, 'gi'), '')
        .split(variant)
        .join('');
    }
  }

  return nextValue
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function createAdminCookie() {
  const token = createSessionToken(
    { uid: 'attachment-migration-admin', username: 'attachment-migration', role: 'admin' },
    getSessionSecret(),
  );
  return `duocloud_session=${token}`;
}

async function runBulkUpdate(assets: KnowledgeAsset[], cookie: string) {
  let statusCode = 200;
  let payload: { success?: boolean; message?: string } | null = null;
  const req = {
    method: 'POST',
    headers: { cookie },
    body: {
      source: 'external_update_app',
      input: `obsidian-image-blob-migration-${new Date().toISOString().slice(0, 10)}`,
      assets,
    },
  } as Pick<Request, 'method' | 'headers' | 'body'>;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: { success?: boolean; message?: string }) {
      payload = value;
      return this;
    },
  } as Pick<Response, 'status' | 'json'>;

  await handleKnowledgeAssetBulkRequest(req, res);
  if (!payload?.success || statusCode >= 400) {
    throw new Error(payload?.message || `Bulk update failed with HTTP ${statusCode}`);
  }
}

function printUsage() {
  console.log([
    'Usage: npm run migrate:obsidian-images -- [--apply] [--cleanup-missing] [--vault /path/to/HotFoil_Database]',
    '',
    'Default mode is dry-run: scans MongoDB and local Obsidian images without uploading or writing.',
    'Use --apply to compress images, upload to Vercel Blob, and update MongoDB knowledge cards.',
    'Use --cleanup-missing to remove unresolved historical image references from knowledge cards.',
  ].join('\n'));
}

async function main() {
  loadEnvFiles();
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    printUsage();
    return;
  }

  const apply = args.includes('--apply');
  const cleanupMissing = args.includes('--cleanup-missing');
  const vaultArgIndex = args.indexOf('--vault');
  const vaultPath = vaultArgIndex >= 0 ? args[vaultArgIndex + 1] : DEFAULT_VAULT_PATH;
  if (!vaultPath || !existsSync(vaultPath)) throw new Error(`Obsidian vault 不存在：${vaultPath}`);
  if (isBlankEnv(process.env.SESSION_SECRET)) {
    process.env.SESSION_SECRET = 'duocloud-local-attachment-migration-session-secret';
  }
  if (apply && isBlankEnv(process.env.BLOB_READ_WRITE_TOKEN)) {
    throw new Error('缺少 BLOB_READ_WRITE_TOKEN。请先运行：npx vercel env pull .env.vercel.local');
  }

  const lookup = buildImageLookup(vaultPath);
  const collection = await getMongoCollection<KnowledgeAssetDocument>(KNOWLEDGE_COLLECTION);
  const assets = await collection.find({
    serverStatus: { $ne: 'archived' },
    serverDeletedAt: { $exists: false },
  }).sort({ serverUpdatedAt: -1, _id: 1 }).toArray();

  const uploadCache = new Map<string, Promise<PreparedUpload & { url: string; pathname: string }>>();
  const updatedAssets: KnowledgeAsset[] = [];
  const missing: Array<{ assetId: string; title: string; reference: string }> = [];
  const matchedReferences: AttachmentReference[] = [];
  let totalOriginalBytes = 0;
  let totalUploadedBytes = 0;
  let compressedCount = 0;
  let uploadAttempt = 0;
  const uploadFailures: Array<{ assetId: string; title: string; reference: string; message: string }> = [];
  let cleanedMissingReferenceCount = 0;

  for (const asset of assets) {
    const replacements = new Map<string, string>();
    const missingByField = new Map<string, string[]>();
    const stringEntries = getStringFieldEntries(asset);

    for (const [key, value] of stringEntries) {
      for (const rawReference of extractImageReferences(value)) {
        if (replacements.has(rawReference)) continue;
        const resolved = resolveReference(rawReference, asset, lookup, vaultPath);
        if (!resolved) {
          missing.push({ assetId: asset.id, title: asset.title, reference: rawReference });
          if (cleanupMissing) {
            missingByField.set(key, [...(missingByField.get(key) ?? []), rawReference]);
          }
          continue;
        }
        matchedReferences.push(resolved);

        if (apply) {
          uploadAttempt += 1;
          console.log(JSON.stringify({
            uploading: uploadAttempt,
            assetId: asset.id,
            file: resolved.relativePath,
          }));
          try {
            const upload = await uploadImage(resolved, uploadCache);
            replacements.set(rawReference, upload.url);
            totalOriginalBytes += upload.originalBytes;
            totalUploadedBytes += upload.uploadedBytes;
            if (upload.compressed) compressedCount += 1;
            console.log(JSON.stringify({
              uploaded: uploadAttempt,
              file: resolved.relativePath,
              originalKB: Math.round(upload.originalBytes / 1024),
              uploadedKB: Math.round(upload.uploadedBytes / 1024),
              compressed: upload.compressed,
            }));
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            uploadFailures.push({ assetId: asset.id, title: asset.title, reference: rawReference, message });
            console.warn(JSON.stringify({
              uploadFailed: uploadAttempt,
              assetId: asset.id,
              file: resolved.relativePath,
              message,
            }));
          }
        } else {
          replacements.set(rawReference, rawReference);
        }
      }
    }

    if (replacements.size > 0) {
      const nextAsset: KnowledgeAsset = { ...asset };
      for (const [key, value] of stringEntries) {
        (nextAsset as unknown as Record<string, unknown>)[key] = replaceAllReferences(value, replacements);
      }
      updatedAssets.push(nextAsset);
    } else if (cleanupMissing && missingByField.size > 0) {
      const nextAsset: KnowledgeAsset = { ...asset };
      let changed = false;
      for (const [key, value] of stringEntries) {
        const fieldMissing = missingByField.get(key);
        if (!fieldMissing?.length) continue;
        const cleaned = stripMissingReferences(value, fieldMissing);
        if (cleaned !== value) {
          (nextAsset as unknown as Record<string, unknown>)[key] = cleaned;
          cleanedMissingReferenceCount += fieldMissing.length;
          changed = true;
        }
      }
      if (changed) updatedAssets.push(nextAsset);
    }
  }

  if (apply && updatedAssets.length > 0) {
    const cookie = createAdminCookie();
    for (let index = 0; index < updatedAssets.length; index += CHUNK_SIZE) {
      await runBulkUpdate(updatedAssets.slice(index, index + CHUNK_SIZE), cookie);
      console.log(JSON.stringify({
        updatedBatch: `${Math.floor(index / CHUNK_SIZE) + 1}/${Math.ceil(updatedAssets.length / CHUNK_SIZE)}`,
        size: Math.min(CHUNK_SIZE, updatedAssets.length - index),
      }));
    }
  }

  const uniqueMatchedFiles = new Set(matchedReferences.map(reference => reference.fullPath));
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    cleanupMissing,
    vaultPath,
    scannedAssets: assets.length,
    localImagesIndexed: lookup.images.length,
    matchedReferences: matchedReferences.length,
    uniqueMatchedFiles: uniqueMatchedFiles.size,
    updatedAssets: updatedAssets.length,
    uploadedFiles: apply ? uploadCache.size : 0,
    compressedFiles: apply ? compressedCount : 0,
    uploadFailureCount: uploadFailures.length,
    uploadFailures: uploadFailures.slice(0, 30),
    cleanedMissingReferences: cleanupMissing ? cleanedMissingReferenceCount : 0,
    originalMB: apply ? Number((totalOriginalBytes / 1024 / 1024).toFixed(2)) : 0,
    uploadedMB: apply ? Number((totalUploadedBytes / 1024 / 1024).toFixed(2)) : 0,
    estimatedMissingReferences: missing.slice(0, 30),
    missingReferenceCount: missing.length,
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoClient();
  });
