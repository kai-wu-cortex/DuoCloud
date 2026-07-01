import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertObsidianNotesToKnowledgeAssets, type ObsidianNoteInput } from '../src/lib/obsidianKnowledgeImport';

const DEFAULT_VAULT_PATH = '/Users/kyle/Library/Mobile Documents/iCloud~md~obsidian/Documents/HotFoil_Database';
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const outputPath = join(repoRoot, 'src/data/obsidianKnowledgeAssets.ts');
const publicAssetDir = join(repoRoot, 'public/obsidian-assets');
const vaultPath = process.argv[2] || DEFAULT_VAULT_PATH;
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

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

function stableHash(value: string) {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

function collectImageAssets(root: string, current = root) {
  const entries = readdirSync(current, { withFileTypes: true });
  const assets: Array<{ fullPath: string; relativePath: string; publicUrl: string }> = [];

  for (const entry of entries) {
    const fullPath = join(current, entry.name);
    if (entry.isDirectory()) {
      assets.push(...collectImageAssets(root, fullPath));
      continue;
    }

    if (!entry.isFile() || !IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;
    const relativePath = relative(root, fullPath);
    const outputName = `${stableHash(relativePath)}-${basename(entry.name)}`;
    assets.push({
      fullPath,
      relativePath,
      publicUrl: `/obsidian-assets/${encodeURIComponent(outputName)}`,
    });
  }

  return assets;
}

const imageAssets = collectImageAssets(vaultPath);
rmSync(publicAssetDir, { recursive: true, force: true });
mkdirSync(publicAssetDir, { recursive: true });

const attachmentUrlByName = new Map<string, string>();
const attachmentUrlByPath = new Map<string, string>();
for (const imageAsset of imageAssets) {
  const outputName = decodeURIComponent(imageAsset.publicUrl.replace('/obsidian-assets/', ''));
  copyFileSync(imageAsset.fullPath, join(publicAssetDir, outputName));
  attachmentUrlByPath.set(imageAsset.relativePath, imageAsset.publicUrl);
  attachmentUrlByName.set(basename(imageAsset.relativePath), imageAsset.publicUrl);
}

const assets = convertObsidianNotesToKnowledgeAssets(collectMarkdownNotes(vaultPath), {
  resolveAttachmentUrl: (attachmentName) => {
    const normalized = attachmentName.replace(/^\.?\//, '');
    return attachmentUrlByPath.get(normalized) || attachmentUrlByName.get(basename(normalized));
  },
});
const categoryCounts = assets.reduce<Record<string, number>>((result, asset) => {
  result[asset.category] = (result[asset.category] || 0) + 1;
  return result;
}, {});

const source = `import type { KnowledgeAsset } from '../types';

// Auto-generated from Obsidian vault:
// ${vaultPath}
// Run: npm run sync:obsidian-knowledge
export const obsidianKnowledgeAssets = ${JSON.stringify(assets, null, 2)} satisfies KnowledgeAsset[];
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, source);

console.log(JSON.stringify({
  vaultPath,
  outputPath,
  publicAssetDir,
  imported: assets.length,
  copiedImages: imageAssets.length,
  categoryCounts,
}, null, 2));
