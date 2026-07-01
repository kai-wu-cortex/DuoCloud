import assert from 'node:assert/strict';
import test from 'node:test';
import { curateKnowledgeAsset } from './knowledgeCuration';
import { renderKnowledgeRichText } from './knowledgeFieldSchemas';
import type { KnowledgeAsset } from '../types';

const baseAsset: KnowledgeAsset = {
  id: 'OBS-TEST',
  category: 'process_knowledge',
  title: 'OCR_056_涂层附着力的影响因素.md',
  tags: ['Obsidian同步'],
  lastUpdated: '2026-06-30',
  author: 'Obsidian HotFoil_Database',
  content: [
    '涂层附着力的影响因素',
    '',
    '<img src="/obsidian-assets/adhesion.jpg" alt="" />',
    '',
    '分类',
    '',
    '| 字段 | 内容 |',
    '|---|---|',
    '| 工艺类别 | 表面处理与附着力 |',
    '',
    '涂层附着力会受底材表面能、干燥曲线、涂层厚度和环境湿度影响。',
    '建议先确认底材处理状态，再调整温度、压力和速度参数。',
  ].join('\n'),
  sourcePath: '11_涂布工艺知识资产/图片分片知识卡/056_涂层附着力的影响因素.md',
  directoryLevel1: '11_涂布工艺知识资产',
  directoryLevel2: '图片分片知识卡',
  directoryLevel3: '',
  processName: '涂层附着力的影响因素',
  applicableProducts: '烫金膜',
  tempRange: '',
  pressureRange: '',
  speedRange: '',
  dwellTime: '',
  moldRequirements: '',
  equipmentRequirements: '',
  environmentRequirements: '',
  commonAnomalies: '附着不良、边缘毛刺',
  adjustmentAdvice: '先确认底材处理状态，再调整温度、压力和速度参数。',
  clientExplanation: '',
};

test('curates knowledge content into a readable industrial card', () => {
  const curated = curateKnowledgeAsset(baseAsset);

  assert.equal(curated.title, '涂层附着力的影响因素');
  assert.equal(curated.content.includes('## 核心信息'), true);
  assert.equal(curated.content.includes('## 一眼识别'), true);
  assert.equal(curated.content.includes('| 字段 | 内容 |'), true);
  assert.equal(curated.content.includes('| 字段 | 内容 |\n|---|---|'), true);
  assert.equal(curated.content.includes('## 核心信息\n- 知识类型'), true);
  assert.equal(curated.content.includes('待人工复核\n\n## 一眼识别'), true);
  assert.equal(curated.content.includes('| 工艺名称 | 涂层附着力的影响因素 |'), true);
  assert.equal(curated.content.includes('<img src="/obsidian-assets/adhesion.jpg"'), true);
  assert.equal(curated.tags.includes('工艺知识'), true);
  assert.equal(curated.tags.includes('人工可读'), true);
});

test('curation is stable when applied more than once', () => {
  const once = curateKnowledgeAsset(baseAsset);
  const twice = curateKnowledgeAsset(once);

  assert.equal((twice.content.match(/## 核心信息/g) || []).length, 1);
  assert.equal((twice.content.match(/## 结构化字段/g) || []).length, 1);
  assert.equal(twice.content.includes('## 原文摘录'), true);
});

test('curated structured fields render as a markdown table', () => {
  const faqAsset = {
    ...baseAsset,
    category: 'faq_pitch',
    title: '展会可引用话术',
    faqNo: 'OBS-1EVF04L',
    clientQuestion: '展会可引用话术',
    questionCategory: 'messaging',
    chineseAnswer: '展会可引用话术 公司介绍短版 东莞市佰仕特工艺制品有限公司起步于 1998 年，是一家集研发、设计、生产、销售为一体的装饰材料制造企业。',
    englishAnswer: '',
    relatedProducts: '',
    relatedPracticeCases: '',
    forbiddenPromises: '',
    applicableClientStage: '',
  } as KnowledgeAsset;

  const curated = curateKnowledgeAsset(faqAsset);
  const rendered = renderKnowledgeRichText(curated.content);

  assert.equal(rendered.includes('<h2>结构化字段</h2>'), true);
  assert.equal(rendered.includes('<table>'), true);
  assert.equal(rendered.includes('<td>客户常问问题</td>'), true);
  assert.equal(rendered.includes('<td>展会可引用话术</td>'), true);
});

test('curation keeps markdown table rows out of insight bullets and preserves source tables', () => {
  const indexAsset = {
    ...baseAsset,
    category: 'knowledge_governance',
    title: '烫金膜详情页素材总索引',
    content: [
      '烫金膜详情页素材总索引',
      '',
      '统计',
      '',
      '| 维度 | 数量 |',
      '|---|---:|',
      '| 图片 | 22 |',
      '| PDF | 4 |',
      '',
      '文件清单',
      '',
      '| 文件 | 类型 | 分类 | 产品线 |',
      '|---|---|---|---|',
      '| 源文件 - 咨询获取报价 | 图片 | 咨询转化素材 | 烫金膜详情页 |',
      '',
      '详情页模块识别',
      '',
      '- PC 版本详情页：围绕数码 UV 光油丝印冷烫专用烫金膜。',
    ].join('\n'),
    ruleNo: 'OBS-WLB9A1',
    knowledgeDomain: '07_Confluence_对外画册官网宣传物料',
    briefTitle: '烫金膜详情页素材总索引',
    detailedContent: '烫金膜详情页素材总索引',
    source: '07_Confluence_对外画册官网宣传物料/素材来源/烫金膜详情页/烫金膜详情页素材总索引.md',
    reliability: '待验证',
    reviewer: 'Obsidian同步',
    reviewStatus: '已同步',
    version: 'Obsidian',
    updatedAt: '2026-06-30',
    failureCondition: '',
    usageCount: '',
    feedbackScore: '',
  } as KnowledgeAsset;

  const curated = curateKnowledgeAsset(indexAsset);
  const insightBlock = curated.content.slice(curated.content.indexOf('## 一眼识别'), curated.content.indexOf('## 结构化字段'));
  const rendered = renderKnowledgeRichText(curated.content);

  assert.equal(insightBlock.includes('| 源文件'), false);
  assert.equal(curated.content.includes('## 原文表格'), true);
  assert.equal(rendered.includes('<h2>原文表格</h2>'), true);
  assert.equal(rendered.includes('<td>咨询转化素材</td>'), true);
});
