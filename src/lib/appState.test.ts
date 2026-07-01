import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createKnowledgeAsset,
  createPracticeCard,
  findPracticeCard,
  addDaysToDateString,
  formatLocalDate,
  loadKnowledgeAssets,
  loadPracticeCards,
  saveKnowledgeAssets,
  savePracticeCards,
} from './appState';
import { initialKnowledgeAssets, initialPracticeCards } from '../data/mockData';
import type { KnowledgeAsset, PracticeCard } from '../types';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

test('created practice cards are persisted and resolvable by evidence route id', () => {
  const storage = createStorage();
  const card = createPracticeCard(
    {
      sku: 'K-600',
      series: 'K系列',
      color: '经典亮金',
      substrate: '自动化测试PP瓶身',
      inkType: '无',
      processType: '平压平自动烫',
      machineModel: 'QA-1050',
      parameters: { temp: 120, pressure: 50, speed: 3000, dwellTime: 0.15 },
      results: {
        clearness: 5,
        gloss: 5,
        adhesion: 5,
        abrasion: 5,
        photoUrl: 'bg-gradient-to-tr from-amber-200 to-yellow-100',
        defectNotes: '百格测试通过。',
      },
      recommendLevel: 'high',
      riskNotes: '测试通过，可推广使用',
      operator: 'QA工艺师',
    },
    {
      idSeed: '8792',
      today: '2026-06-29',
    },
  );

  assert.equal(card.id, 'PC-USER-8792');
  assert.equal(card.evidenceNo, 'SY-2026-8792');
  assert.equal(card.testDate, '2026-06-29');

  savePracticeCards([card, ...initialPracticeCards], storage);

  const loaded = loadPracticeCards(initialPracticeCards, storage);
  assert.equal(loaded[0].evidenceNo, 'SY-2026-8792');
  assert.equal(findPracticeCard('SY-2026-8792', loaded)?.substrate, '自动化测试PP瓶身');
  assert.equal(findPracticeCard('PC-USER-8792', loaded)?.operator, 'QA工艺师');
});

test('local date formatting uses the user timezone instead of UTC', () => {
  const utcEvening = new Date('2026-06-28T16:30:00.000Z');

  assert.equal(formatLocalDate(utcEvening, 'UTC'), '2026-06-28');
  assert.equal(formatLocalDate(utcEvening, 'Asia/Shanghai'), '2026-06-29');
});

test('date string addition rolls over month and year boundaries', () => {
  assert.equal(addDaysToDateString('2026-06-29', 3), '2026-07-02');
  assert.equal(addDaysToDateString('2026-12-30', 3), '2027-01-02');
});

test('invalid practice storage falls back to seeded mock cards', () => {
  const storage = createStorage();
  storage.setItem('duocloud.practiceCards.v1', '{broken json');

  const loaded = loadPracticeCards(initialPracticeCards, storage);

  assert.deepEqual(loaded, initialPracticeCards);
});

test('created knowledge assets are persisted with generated ids and dates', () => {
  const storage = createStorage();
  const seed = initialKnowledgeAssets[0];
  const asset = createKnowledgeAsset(
    {
      ...(seed as KnowledgeAsset),
      id: undefined,
      lastUpdated: undefined,
      title: '新增知识资产',
    } as unknown as Omit<KnowledgeAsset, 'id' | 'lastUpdated'>,
    {
      idSeed: '1234',
      today: '2026-06-29',
    },
  );

  assert.equal(asset.id, 'KA-USER-1234');
  assert.equal(asset.lastUpdated, '2026-06-29');

  saveKnowledgeAssets([asset, ...initialKnowledgeAssets], storage);

  const loaded = loadKnowledgeAssets(initialKnowledgeAssets, storage);
  assert.equal(loaded[0].title, '新增知识资产');
});

test('persisted knowledge assets are merged with newly seeded knowledge assets', () => {
  const storage = createStorage();
  const stored = {
    ...initialKnowledgeAssets[0],
    id: 'KA-LOCAL-ONLY',
    title: '本地已有知识',
  } as KnowledgeAsset;
  const seeded = {
    ...initialKnowledgeAssets[1],
    id: 'OBS-SEEDED',
    title: 'Obsidian同步知识',
  } as KnowledgeAsset;

  saveKnowledgeAssets([stored], storage);

  const loaded = loadKnowledgeAssets([seeded], storage);

  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].id, 'KA-LOCAL-ONLY');
  assert.equal(loaded[1].id, 'OBS-SEEDED');
});

test('unmodified Obsidian cache is refreshed from the latest seeded sync', () => {
  const storage = createStorage();
  const staleObsidianAsset = {
    ...initialKnowledgeAssets[0],
    id: 'OBS-SAME',
    title: '旧同步标题',
    content: '旧正文',
  } as KnowledgeAsset;
  const refreshedObsidianAsset = {
    ...initialKnowledgeAssets[0],
    id: 'OBS-SAME',
    title: '新同步标题',
    content: '<img src="/obsidian-assets/a.jpg" alt="" />',
  } as KnowledgeAsset;

  saveKnowledgeAssets([staleObsidianAsset], storage);

  const loaded = loadKnowledgeAssets([refreshedObsidianAsset], storage);

  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].title, '新同步标题');
  assert.equal(loaded[0].content.includes('/obsidian-assets/a.jpg'), true);
});

test('locally edited Obsidian assets are preserved during seeded sync merge', () => {
  const storage = createStorage();
  const editedObsidianAsset = {
    ...initialKnowledgeAssets[0],
    id: 'OBS-SAME',
    title: '本地编辑标题',
    localEditedAt: '2026-06-29',
  } as KnowledgeAsset;
  const refreshedObsidianAsset = {
    ...initialKnowledgeAssets[0],
    id: 'OBS-SAME',
    title: '新同步标题',
  } as KnowledgeAsset;

  saveKnowledgeAssets([editedObsidianAsset], storage);

  const loaded = loadKnowledgeAssets([refreshedObsidianAsset], storage);

  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].title, '本地编辑标题');
});

test('invalid knowledge storage falls back to seeded mock assets', () => {
  const storage = createStorage();
  storage.setItem('duocloud.knowledgeAssets.v1', 'null');

  const loaded = loadKnowledgeAssets(initialKnowledgeAssets, storage);

  assert.deepEqual(loaded, initialKnowledgeAssets);
});

test('malformed persisted knowledge assets are filtered before rendering', () => {
  const storage = createStorage();
  storage.setItem('duocloud.knowledgeAssets.v1', JSON.stringify([
    {
      id: 'BROKEN-001',
      category: 'unknown_category',
      title: '坏数据',
      content: '旧缓存里可能残留的异常记录',
      tags: 'not-an-array',
      lastUpdated: '2026-06-29',
      author: '旧缓存',
    },
    initialKnowledgeAssets[0],
  ]));

  const loaded = loadKnowledgeAssets(initialKnowledgeAssets, storage);

  assert.equal(loaded.some(asset => asset.id === 'BROKEN-001'), false);
  assert.equal(loaded.some(asset => asset.id === initialKnowledgeAssets[0].id), true);
});
