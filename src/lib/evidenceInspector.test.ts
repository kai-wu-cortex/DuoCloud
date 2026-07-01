import assert from 'node:assert/strict';
import test from 'node:test';
import { getEvidenceInspectorModel } from './evidenceInspector';
import type { EvidenceSection } from './evidencePages';
import type { KnowledgeAsset, PracticeCard } from '../types';

const card: PracticeCard = {
  id: 'PC-TEST',
  evidenceNo: 'SY-2026-0012',
  sku: 'K-600',
  series: 'K系列',
  color: '冷烫银',
  substrate: '250g白卡纸 + 哑膜',
  inkType: 'UV油墨',
  processType: '平压平自动烫',
  machineModel: 'Bobst 106-ER',
  parameters: { temp: 118, pressure: 50, speed: 3800, dwellTime: 0.15 },
  results: {
    clearness: 5,
    gloss: 4,
    adhesion: 5,
    abrasion: 4,
    photoUrl: '',
    defectNotes: '边缘稳定。',
  },
  recommendLevel: 'high',
  riskNotes: '量产前复核油墨干燥窗口。',
  operator: '张工艺',
  testDate: '2026-05-12',
};

const refs = [
  {
    id: 'KN-001',
    category: 'process_knowledge',
    title: 'K系列转印工艺窗口',
    tags: ['K系列'],
    lastUpdated: '2026-06-01',
    author: '知识云',
    content: '温度、压力、速度窗口。',
  },
] as KnowledgeAsset[];

test('header sections use the title settings panel', () => {
  const section: EvidenceSection = {
    id: 'sec-header',
    type: 'header',
    title: 'K-600 打样数据及技术证据报告',
    content: '报告摘要',
  };

  const model = getEvidenceInspectorModel(section, card, refs);

  assert.equal(model.kind, 'settings');
  assert.equal(model.panelTitle, '标题模块设置');
  assert.equal(model.sectionLabel, 'HEADER BLOCK');
  assert.equal(model.editors.title, true);
  assert.equal(model.editors.content, true);
  assert.equal(model.editors.listItems, false);
});

test('process data sections expose card process parameters in the data panel', () => {
  const section: EvidenceSection = {
    id: 'sec-process-data',
    type: 'process_data',
    title: '1. 工艺核心参数 (Process Parameters)',
    content: '已锁定黄金释放临界点。',
    listItems: ['打样目标温度：118 ℃', '千分表额定压力：50 kg'],
  };

  const model = getEvidenceInspectorModel(section, card, refs);

  assert.equal(model.kind, 'data');
  assert.equal(model.panelTitle, '工艺参数数据面板');
  assert.deepEqual(
    model.dataRows.map(row => [row.label, row.value]),
    [
      ['打样目标温度', '118 ℃'],
      ['千分表额定压力', '50 kg'],
      ['生产联动转速', '3800 /h'],
      ['压印停留时间', '0.15 s'],
    ],
  );
  assert.equal(model.editors.listItems, true);
});

test('metrics table sections expose physical result rows', () => {
  const section: EvidenceSection = {
    id: 'sec-metrics-table',
    type: 'metrics_table',
    title: '3. 物性拉拔与剥离测试 (Physical Metrics)',
  };

  const model = getEvidenceInspectorModel(section, card, refs);

  assert.equal(model.kind, 'data');
  assert.equal(model.panelTitle, '物性结果数据面板');
  assert.deepEqual(
    model.metrics.map(metric => [metric.label, metric.score]),
    [
      ['图案清晰度', 5],
      ['胶带附着力', 5],
      ['金属光泽度', 4],
      ['耐摩擦等级', 4],
    ],
  );
});

test('no selected section falls back to the page settings panel', () => {
  const model = getEvidenceInspectorModel(null, card, refs);

  assert.equal(model.kind, 'page');
  assert.equal(model.panelTitle, '页面默认设置');
  assert.equal(model.sectionLabel, 'PAGE');
});
