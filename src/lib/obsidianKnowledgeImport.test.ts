import assert from 'node:assert/strict';
import test from 'node:test';
import {
  convertObsidianNoteToKnowledgeAsset,
  convertObsidianNotesToKnowledgeAssets,
  parseObsidianNote,
  shouldImportObsidianPath,
} from './obsidianKnowledgeImport';

test('parses Obsidian frontmatter arrays and body content', () => {
  const note = parseObsidianNote({
    relativePath: '03_GitMemory_工艺配方客户案例知识库/产品条目/PK.md',
    content: `---\ntitle: "PK 系列"\ntags:\n  - 产品资料\n  - PK系列\nupdated: 2026-06-18\n---\n# PK 系列\n\n正文`,
  });

  assert.equal(note.frontmatter.title, 'PK 系列');
  assert.deepEqual(note.frontmatter.tags, ['产品资料', 'PK系列']);
  assert.equal(note.body.includes('正文'), true);
});

test('maps product Obsidian notes onto product master fields', () => {
  const asset = convertObsidianNoteToKnowledgeAsset(parseObsidianNote({
    relativePath: '03_GitMemory_工艺配方客户案例知识库/产品条目/PK 咖啡底胶烫金膜系列.md',
    content: `---\ntitle: "PK 咖啡底胶烫金膜系列"\nproduct_name: "PK 咖啡底胶烫金膜系列"\nproduct_category: "热烫烫金膜"\ntarget_substrates:\n  - "粗糙纸张"\n  - "压纹皮革"\napplication_scenarios:\n  - "包装"\nupdated: "2026-06-18"\ntags:\n  - 产品资料\n---\n# 定位\n\n适合 [[压纹皮革]]。`,
  }));

  assert.equal(asset.category, 'product_master');
  assert.equal(asset.productName, 'PK 咖啡底胶烫金膜系列');
  assert.equal(asset.productCategory, '热烫烫金膜');
  assert.equal(asset.recommendedSubstrates, '粗糙纸张、压纹皮革');
  assert.equal(asset.content.includes('压纹皮革'), true);
  assert.equal(asset.sourcePath, '03_GitMemory_工艺配方客户案例知识库/产品条目/PK 咖啡底胶烫金膜系列.md');
  assert.equal(asset.directoryLevel1, '03_GitMemory_工艺配方客户案例知识库');
  assert.equal(asset.directoryLevel2, '产品条目');
});

test('converts Obsidian and Markdown image embeds to renderable image tags', () => {
  const note = parseObsidianNote({
    relativePath: '11_涂布工艺知识资产/图片知识卡/白点.md',
    content: '---\ntitle: "白点"\n---\n![[白点.JPG]]\n\n![远程图](https://duocloud.test/remote.png)',
  });

  const asset = convertObsidianNoteToKnowledgeAsset(note, {
    resolveAttachmentUrl: (attachmentName) => attachmentName === '白点.JPG' ? '/obsidian-assets/white-dot.JPG' : undefined,
  });

  assert.equal(asset.content.includes('src="/obsidian-assets/white-dot.JPG"'), true);
  assert.equal(asset.content.includes('src="https://duocloud.test/remote.png"'), true);
});

test('maps quote items onto pricing rule fields', () => {
  const asset = convertObsidianNoteToKnowledgeAsset(parseObsidianNote({
    relativePath: '10_报价数据库/报价条目/QUOTE-DEALER-006_PK咖啡底杂色.md',
    content: `---\ntitle: "QUOTE-DEALER-006_PK咖啡底杂色"\ntype: "quote_item"\nquote_id: "QUOTE-DEALER-006"\nproduct_name: "PK咖啡底杂色"\ncurrency: "RMB"\ndealer_rmb: "150"\nhuman_review_required: true\n---\n# 报价信息`,
  }));

  assert.equal(asset.category, 'pricing_rule');
  assert.equal(asset.ruleNo, 'QUOTE-DEALER-006');
  assert.equal(asset.productNo, 'PK咖啡底杂色');
  assert.equal(asset.concessionBoundary, '需人工复核');
  assert.equal(asset.pricingNotes.includes('经销价RMB：150'), true);
});

test('excludes Obsidian system and template paths from sync', () => {
  assert.equal(shouldImportObsidianPath('90_模板/TPL_产品资料条目.md'), false);
  assert.equal(shouldImportObsidianPath('.obsidian/workspace.md'), false);
  assert.equal(shouldImportObsidianPath('10_报价数据库/客户分层报价规则.md'), true);

  const assets = convertObsidianNotesToKnowledgeAssets([
    { relativePath: '90_模板/TPL.md', content: '# skip' },
    { relativePath: '10_报价数据库/客户分层报价规则.md', content: '---\ntitle: "客户分层报价规则"\n---\n正文' },
  ]);

  assert.equal(assets.length, 1);
  assert.equal(assets[0].title, '客户分层报价规则');
});
