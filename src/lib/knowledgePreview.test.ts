import assert from 'node:assert/strict';
import test from 'node:test';
import { getKnowledgePreviewText } from './knowledgePreview';

test('knowledge preview uses readable insight text instead of raw markdown', () => {
  const preview = getKnowledgePreviewText([
    '## 核心信息',
    '- 知识类型：知识标签',
    '',
    '## 一眼识别',
    '- 详情：https://duocloud.test/manual',
    '- 用于统一检索和分类。',
    '',
    '## 结构化字段',
    '| 字段 | 内容 |',
    '|---|---|',
    '| 标签名称 | URL标签 |',
  ].join('\n'));

  assert.equal(preview.includes('##'), false);
  assert.equal(preview.includes('| 字段 | 内容 |'), false);
  assert.equal(preview.startsWith('详情：https://duocloud.test/manual'), true);
  assert.equal(preview.includes('用于统一检索和分类。'), true);
});
