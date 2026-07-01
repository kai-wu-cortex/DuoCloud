import assert from 'node:assert/strict';
import test from 'node:test';
import { getKnowledgeCardClickState } from './knowledgeSelection';
import type { KnowledgeAsset } from '../types';

const asset = {
  id: 'KA-001',
  category: 'product_master',
  title: 'K-600 产品主数据',
  tags: ['K-600'],
  lastUpdated: '2026-06-29',
  author: '产品部',
  content: '产品基础字段。',
} as KnowledgeAsset;

test('clicking a knowledge grid card selects it and opens detail immediately', () => {
  const state = getKnowledgeCardClickState(asset);

  assert.equal(state.activeCardId, 'KA-001');
  assert.equal(state.selectedAsset, asset);
});
