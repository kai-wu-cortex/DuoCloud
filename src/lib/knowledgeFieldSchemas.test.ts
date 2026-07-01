import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildKnowledgeAssetDraft,
  getKnowledgeFieldSchema,
  markdownToKnowledgeHtml,
  renderKnowledgeRichText,
  sanitizeKnowledgeRichText,
  validateKnowledgeAssetDraft,
} from './knowledgeFieldSchemas';
import type { KnowledgeAsset, KnowledgeTableType } from '../types';

const categories: KnowledgeTableType[] = [
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
];

test('each knowledge table type exposes real structured field definitions', () => {
  for (const category of categories) {
    const schema = getKnowledgeFieldSchema(category);
    assert.equal(schema.category, category);
    assert.ok(schema.fields.length >= 5, `${category} should have business fields`);
    assert.equal(schema.fields.some(field => field.required), false, `${category} should not force required fields`);
    assert.equal(new Set(schema.fields.map(field => field.name)).size, schema.fields.length);
  }
});

test('builds a complete typed asset draft from structured fields', () => {
  const draft = buildKnowledgeAssetDraft({
    category: 'product_master',
    title: 'G-1308 哑银膜产品主数据',
    author: '产品部陈工',
    content: '',
    tags: ['哑银', '主数据'],
    fields: {
      productName: 'G-1308 哑银膜',
      productCategory: '普通银',
      colorName: '哑银',
      colorCode: 'Silver-308',
      specifications: '640mm x 120m',
      surfaceEffect: '哑面',
      productStatus: '主推',
      recommendedIndustries: '酒盒、礼盒',
      recommendedSubstrates: '白卡纸、铜版纸',
      notRecommendedSubstrates: '未处理PP',
      moq: '10卷',
      leadTime: '7天',
      hasStock: '有',
      alternativeModels: 'G-1306',
      riskLevel: '低',
      mustTestScenarios: '覆膜纸',
      reviewer: '工艺主管',
    },
  });

  const productDraft = draft as Omit<Extract<KnowledgeAsset, { category: 'product_master' }>, 'id' | 'lastUpdated'>;
  assert.equal(productDraft.category, 'product_master');
  assert.equal(productDraft.productName, 'G-1308 哑银膜');
  assert.equal(productDraft.content.includes('产品名称：G-1308 哑银膜'), true);
  assert.equal(productDraft.createdAt, productDraft.updatedAt);
});

test('publishing does not block empty structured fields', () => {
  const result = validateKnowledgeAssetDraft({
    category: 'process_knowledge',
    title: '',
    author: '',
    fields: {},
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.missingFieldLabels, []);
});

test('sanitizes and renders rich text links and images for knowledge fields', () => {
  const sanitized = sanitizeKnowledgeRichText(
    '<b>重点</b><script>alert(1)</script><a href="https://duocloud.test/spec">规格</a><img src="https://duocloud.test/a.png" onerror="bad()">',
  );

  assert.equal(sanitized.includes('<script>'), false);
  assert.equal(sanitized.includes('onerror'), false);
  assert.equal(sanitized.includes('<b>重点</b>'), true);
  assert.equal(sanitized.includes('href="https://duocloud.test/spec"'), true);
  assert.equal(sanitized.includes('src="https://duocloud.test/a.png"'), true);
  assert.equal(sanitizeKnowledgeRichText('<img src="/obsidian-assets/a.png">').includes('src="/obsidian-assets/a.png"'), true);

  const rendered = renderKnowledgeRichText('查看 https://duocloud.test/spec');
  assert.equal(rendered.includes('<a href="https://duocloud.test/spec"'), true);

  const renderedAfterChinesePunctuation = renderKnowledgeRichText('详情：https://duocloud.test/manual');
  assert.equal(renderedAfterChinesePunctuation.includes('<a href="https://duocloud.test/manual"'), true);

  const renderedImageUrl = renderKnowledgeRichText('图片：https://duocloud.test/manual.jpg');
  assert.equal(renderedImageUrl.includes('<img src="https://duocloud.test/manual.jpg"'), true);
});

test('renders markdown syntax for knowledge rich text fields', () => {
  const rendered = markdownToKnowledgeHtml([
    '### 产品说明',
    '',
    '- **亮金**适合[详情页](https://duocloud.test/spec)',
    '- 图片：![样品](https://duocloud.test/a.png)',
    '',
    '| 字段 | 内容 |',
    '|---|---|',
    '| 规格 | `640mm x 120m` |',
  ].join('\n'));

  assert.equal(rendered.includes('<h3>产品说明</h3>'), true);
  assert.equal(rendered.includes('<strong>亮金</strong>'), true);
  assert.equal(rendered.includes('href="https://duocloud.test/spec"'), true);
  assert.equal(rendered.includes('src="https://duocloud.test/a.png"'), true);
  assert.equal(rendered.includes('<table>'), true);
  assert.equal(rendered.includes('<code>640mm x 120m</code>'), true);

  const autoRendered = renderKnowledgeRichText('**重点**\n\n1. 支持 Markdown');
  assert.equal(autoRendered.includes('<strong>重点</strong>'), true);
  assert.equal(autoRendered.includes('<ol>'), true);
});

test('renders markdown tables when rich content also contains images', () => {
  const rendered = renderKnowledgeRichText([
    '## 图片分片',
    '',
    '<img src="/obsidian-assets/slice.jpg" alt="" />',
    '',
    '## 分类',
    '',
    '| 字段 | 内容 |',
    '|---|---|',
    '| 工艺类别 | 表面处理与附着力 |',
  ].join('\n'));

  assert.equal(rendered.includes('<img src="/obsidian-assets/slice.jpg"'), true);
  assert.equal(rendered.includes('<h2>分类</h2>'), true);
  assert.equal(rendered.includes('<table>'), true);
  assert.equal(rendered.includes('<td>表面处理与附着力</td>'), true);
});
