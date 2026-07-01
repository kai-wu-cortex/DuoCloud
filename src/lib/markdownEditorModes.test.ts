import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_MARKDOWN_EDITOR_MODE, getMarkdownEditorModeValue } from './markdownEditorModes';

test('markdown editor defaults to code mode', () => {
  assert.equal(DEFAULT_MARKDOWN_EDITOR_MODE, 'code');
});

test('markdown code mode keeps raw markdown source', () => {
  const markdown = '## 标题\n\n| 字段 | 内容 |\n|---|---|\n| 温度 | 120℃ |';

  assert.equal(getMarkdownEditorModeValue(markdown, 'code'), markdown);
});

test('markdown preview mode renders markdown as html', () => {
  const markdown = '## 标题\n\n| 字段 | 内容 |\n|---|---|\n| 温度 | 120℃ |';
  const preview = getMarkdownEditorModeValue(markdown, 'preview');

  assert.equal(preview.includes('<h2>标题</h2>'), true);
  assert.equal(preview.includes('<table>'), true);
  assert.equal(preview.includes('<td>120℃</td>'), true);
});
