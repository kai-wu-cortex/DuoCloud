import assert from 'node:assert/strict';
import test from 'node:test';
import { createEvidenceReportHtml, getEvidenceReportDownloadName } from './evidenceReport';
import type { EvidencePage } from './evidencePages';
import type { KnowledgeAsset, PracticeCard } from '../types';

const card: PracticeCard = {
  id: 'PC-TEST',
  evidenceNo: 'SY-2026-TEST',
  sku: 'S-550',
  series: 'S系列',
  color: '冰感亮银',
  substrate: 'PET片材',
  inkType: '无',
  processType: '轮转热转印',
  machineModel: 'QA-3000',
  parameters: { temp: 135, pressure: 65, speed: 2600, dwellTime: 0.2 },
  results: {
    clearness: 4,
    gloss: 5,
    adhesion: 5,
    abrasion: 4,
    photoUrl: '',
    defectNotes: '边缘稳定。',
  },
  recommendLevel: 'high',
  riskNotes: '确认脱模剂残留。',
  operator: 'QA工艺师',
  testDate: '2026-06-29',
};

const page: EvidencePage = {
  id: 'page-test',
  name: '客户样张 <Page>',
  visible: true,
  sections: [
    {
      id: 'sec-header',
      type: 'header',
      title: '危险标题 <script>alert(1)</script>',
      content: '内容含 <strong>HTML</strong> & 特殊字符',
    },
    {
      id: 'sec-process',
      type: 'process_data',
      title: '工艺参数',
      content: '参数说明',
      listItems: ['温度：135 ℃', 'Plain item <img src=x>'],
    },
  ],
};

const refs: KnowledgeAsset[] = [];

test('evidence report HTML uses the selected card metadata and export date', () => {
  const html = createEvidenceReportHtml({
    page,
    card,
    referencedAssets: refs,
    exportDate: '2026-06-29',
  });

  assert.match(html, /客户样张 &lt;Page&gt; - S-550 烫金打样与技术证据报告/);
  assert.match(html, /S-550 工艺证据卡离线高保真浏览器/);
  assert.match(html, /报告编号: SY-2026-TEST/);
  assert.match(html, /导出于: 2026-06-29/);
  assert.doesNotMatch(html, /K-600/);
  assert.doesNotMatch(html, /2026-06-28/);
});

test('evidence report download name uses page title and card sku', () => {
  assert.equal(
    getEvidenceReportDownloadName(page, card),
    '客户样张 _Page__打样对账画册_S-550.html',
  );
});

test('evidence report HTML escapes editable content before export', () => {
  const html = createEvidenceReportHtml({
    page,
    card,
    referencedAssets: refs,
    exportDate: '2026-06-29',
  });

  assert.match(html, /危险标题 &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /内容含 &lt;strong&gt;HTML&lt;\/strong&gt; &amp; 特殊字符/);
  assert.match(html, /Plain item &lt;img src=x&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(html, /<img src=x>/);
});
