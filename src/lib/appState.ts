import type { KnowledgeAsset, KnowledgeTableType, PracticeCard } from '../types';

export const PRACTICE_CARDS_STORAGE_KEY = 'duocloud.practiceCards.v1';
export const KNOWLEDGE_ASSETS_STORAGE_KEY = 'duocloud.knowledgeAssets.v1';

const VALID_KNOWLEDGE_CATEGORIES = new Set<KnowledgeTableType>([
  'product_master',
  'substrate_knowledge',
  'compatibility_rule',
  'process_knowledge',
  'pricing_rule',
  'quality_issue',
  'supply_chain_capability',
  'faq_pitch',
  'tag_system',
  'knowledge_governance',
]);

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

interface CreateOptions {
  idSeed?: string;
  now?: Date;
  today?: string;
  timeZone?: string;
}

export function formatLocalDate(date: Date = new Date(), timeZone?: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

export function addDaysToDateString(dateString: string, days: number) {
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return dateString;

  const date = new Date(Date.UTC(year, month - 1, day + days));
  return formatLocalDate(date, 'UTC');
}

function getToday(options: CreateOptions = {}) {
  return options.today ?? formatLocalDate(options.now, options.timeZone);
}

function createIdSeed() {
  const timePart = Date.now().toString().slice(-6);
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${timePart}-${randomPart}`;
}

function getBrowserStorage(): StorageLike | undefined {
  if (typeof window === 'undefined') return undefined;

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function parseStoredArray<T>(key: string, fallback: T[], storage?: StorageLike): T[] {
  if (!storage) return fallback;

  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    return fallback;
  }
}

function saveArray<T>(key: string, value: T[], storage?: StorageLike) {
  if (!storage) return;

  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage can be disabled or quota-limited. Keep in-memory state usable.
  }
}

function isValidKnowledgeAsset(value: unknown): value is KnowledgeAsset {
  if (!value || typeof value !== 'object') return false;

  const asset = value as Partial<KnowledgeAsset>;
  return (
    typeof asset.id === 'string' &&
    typeof asset.title === 'string' &&
    typeof asset.content === 'string' &&
    typeof asset.author === 'string' &&
    typeof asset.lastUpdated === 'string' &&
    Array.isArray(asset.tags) &&
    typeof asset.category === 'string' &&
    VALID_KNOWLEDGE_CATEGORIES.has(asset.category as KnowledgeTableType)
  );
}

export function createPracticeCard(
  newCard: Omit<PracticeCard, 'id' | 'evidenceNo' | 'testDate'>,
  options: CreateOptions = {},
): PracticeCard {
  const idSeed = options.idSeed ?? createIdSeed();

  return {
    ...newCard,
    id: `PC-USER-${idSeed}`,
    evidenceNo: `SY-2026-${idSeed}`,
    testDate: getToday(options),
  };
}

export function createKnowledgeAsset(
  newAsset: Omit<KnowledgeAsset, 'id' | 'lastUpdated'>,
  options: CreateOptions = {},
): KnowledgeAsset {
  const idSeed = options.idSeed ?? createIdSeed();

  return {
    ...newAsset,
    id: `KA-USER-${idSeed}`,
    lastUpdated: getToday(options),
  } as KnowledgeAsset;
}

export function loadPracticeCards(
  fallback: PracticeCard[],
  storage: StorageLike | undefined = getBrowserStorage(),
): PracticeCard[] {
  return parseStoredArray(PRACTICE_CARDS_STORAGE_KEY, fallback, storage);
}

export function savePracticeCards(
  cards: PracticeCard[],
  storage: StorageLike | undefined = getBrowserStorage(),
) {
  saveArray(PRACTICE_CARDS_STORAGE_KEY, cards, storage);
}

export function loadKnowledgeAssets(
  fallback: KnowledgeAsset[],
  storage: StorageLike | undefined = getBrowserStorage(),
): KnowledgeAsset[] {
  const storedAssets = parseStoredArray<unknown>(KNOWLEDGE_ASSETS_STORAGE_KEY, fallback, storage);
  const validAssets = storedAssets.filter(isValidKnowledgeAsset);
  if (validAssets.length === 0) return fallback;

  const fallbackById = new Map(fallback.map(asset => [asset.id, asset]));
  const mergedAssets = validAssets.map(asset => {
    const seededAsset = fallbackById.get(asset.id);
    if (!seededAsset) return asset;
    if (asset.id.startsWith('OBS-') && !asset.localEditedAt) return seededAsset;
    return asset;
  });

  const existingIds = new Set(mergedAssets.map(asset => asset.id));
  const missingFallbackAssets = fallback.filter(asset => !existingIds.has(asset.id));
  return [...mergedAssets, ...missingFallbackAssets];
}

export function saveKnowledgeAssets(
  assets: KnowledgeAsset[],
  storage: StorageLike | undefined = getBrowserStorage(),
) {
  saveArray(KNOWLEDGE_ASSETS_STORAGE_KEY, assets, storage);
}

export function findPracticeCard(id: string | undefined, cards: PracticeCard[]) {
  if (!id) return undefined;
  return cards.find(card => card.evidenceNo === id || card.id === id);
}
