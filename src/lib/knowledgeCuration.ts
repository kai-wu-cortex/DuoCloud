import type { KnowledgeAsset, KnowledgeTableType } from '../types';
import { getKnowledgeFieldSchema } from './knowledgeFieldSchemas';

const CATEGORY_LABELS: Record<KnowledgeTableType, string> = {
  product_master: '产品主数据',
  substrate_knowledge: '底材知识',
  compatibility_rule: '适配规则',
  process_knowledge: '工艺知识',
  pricing_rule: '报价规则',
  quality_issue: '质量问题',
  supply_chain_capability: '供应链能力',
  faq_pitch: 'FAQ与话术',
  tag_system: '知识标签',
  knowledge_governance: '知识治理',
};

const ACTION_HINTS: Record<KnowledgeTableType, string[]> = {
  product_master: ['确认产品型号、规格、适用底材和禁忌场景。', '报价或推荐前，优先检查库存、MOQ、交期和必须打样条件。'],
  substrate_knowledge: ['先识别底材表面处理和吸附难度，再选择推荐膜系列。', '遇到覆膜、UV、低表面能材料时，默认进入打样验证流程。'],
  compatibility_rule: ['按产品、底材、表面处理三项同时匹配，不单独按产品型号推荐。', '若规则含风险说明或必须打样，先输出风险边界再给客户承诺。'],
  process_knowledge: ['优先读取温度、压力、速度、设备和异常处理建议。', '调机时一次只改变一个关键变量，并记录对应证据卡。'],
  pricing_rule: ['报价前确认币种、数量阶梯、MOQ、交期和让步边界。', '涉及定制、加急、特殊规格时，必须人工复核。'],
  quality_issue: ['先按缺陷现象定位原因，再执行调整建议。', '重大、重复或客户现场问题必须关联实践云证据卡。'],
  supply_chain_capability: ['对外承诺前确认供应稳定性、常规交期和替代供应商。', '供应风险为中高时，避免单一供应来源承诺。'],
  faq_pitch: ['回答客户时优先使用已审核话术，避免超出禁止承诺边界。', '复杂适配、质量、交期问题应转入证据卡或人工复核。'],
  tag_system: ['用于统一检索、分类和自动匹配，不作为事实结论本身。', '同义词和互斥标签需要定期人工维护。'],
  knowledge_governance: ['先判断来源可靠度和审核状态，再决定是否用于对外答复。', '未审核或待验证内容只能作为内部参考。'],
};

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function getPlainText(value: string) {
  return decodeEntities(String(value ?? '')
    .replace(/<img\b[^>]*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (_match, first, second) => second || first)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim());
}

function getSourceContent(value: string) {
  const content = String(value ?? '');
  const originalExcerptIndex = content.indexOf('## 原文摘录');
  if (originalExcerptIndex >= 0) return content.slice(originalExcerptIndex).replace(/^## 原文摘录\s*/, '').trim();
  return content;
}

function cleanTitle(value: string, asset: KnowledgeAsset) {
  const fallback = asset.sourcePath?.split('/').pop()?.replace(/\.md$/i, '') || asset.id;
  return (value || fallback)
    .replace(/\.(md|txt|pdf|jpe?g|png|webp)$/i, '')
    .replace(/^(OCR|源文件|导入|QA)\s*[_：: -]*/i, '')
    .replace(/^\d{2,4}[_ -]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64);
}

function cleanCell(value: unknown, maxLength = 120) {
  return getPlainText(String(value ?? ''))
    .replace(/\|/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function extractImageTags(value: string) {
  const result: string[] = [];
  const seen = new Set<string>();
  const htmlImagePattern = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let htmlMatch: RegExpExecArray | null;
  while ((htmlMatch = htmlImagePattern.exec(value)) !== null) {
    if (seen.has(htmlMatch[1])) continue;
    seen.add(htmlMatch[1]);
    result.push(htmlMatch[0]);
  }

  const markdownImagePattern = /!\[[^\]]*]\(([^)]+)\)/g;
  let markdownMatch: RegExpExecArray | null;
  while ((markdownMatch = markdownImagePattern.exec(value)) !== null) {
    if (seen.has(markdownMatch[1])) continue;
    seen.add(markdownMatch[1]);
    result.push(markdownMatch[0]);
  }

  return result.slice(0, 4);
}

function pickImportantLines(text: string, title: string) {
  const ignored = /^(source_file|image_size|tile\s+\d+|ocr\s*全文|原始\s*txt|阅读\s*\d*|转载须知|关注我们|扫码|报名咨询)/i;
  const lines = text
    .split(/\n+/)
    .map(line => line.replace(/^[#>*\-\d.、\s]+/, '').trim())
    .filter(line => line.length >= 8 && !ignored.test(line))
    .filter(line => !/^[|:-]+$/.test(line))
    .filter(line => !/^\|.*\|$/.test(line));

  const scored = lines.map((line, index) => {
    let score = Math.max(0, 120 - index);
    if (/适用|推荐|风险|原因|建议|异常|参数|温度|压力|速度|底材|表面|附着|报价|交期|MOQ|质量|客户/.test(line)) score += 80;
    if (title && line.includes(title.slice(0, 6))) score += 30;
    if (line.length > 160) score -= 20;
    return { line, score };
  });

  const selected: string[] = [];
  for (const item of scored.sort((a, b) => b.score - a.score)) {
    const normalized = item.line.replace(/\s+/g, '');
    if (selected.some(line => line.replace(/\s+/g, '').includes(normalized.slice(0, 24)))) continue;
    selected.push(item.line.slice(0, 180));
    if (selected.length >= 5) break;
  }

  return selected;
}

function extractMarkdownTables(value: string) {
  const lines = String(value ?? '').replace(/\r\n?/g, '\n').split('\n');
  const tables: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const header = lines[index].trim();
    const divider = lines[index + 1]?.trim() || '';
    if (!header.includes('|') || !/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(divider)) continue;

    const rows = [header, divider];
    index += 2;
    while (index < lines.length && lines[index].trim().includes('|')) {
      rows.push(lines[index].trim());
      index += 1;
    }
    index -= 1;
    tables.push(rows.join('\n'));
    if (tables.length >= 2) break;
  }

  return tables;
}

function buildFieldRows(asset: KnowledgeAsset) {
  const schema = getKnowledgeFieldSchema(asset.category);
  return schema.fields
    .map(field => {
      const value = cleanCell((asset as unknown as Record<string, unknown>)[field.name]);
      return value ? `| ${field.label} | ${value} |` : '';
    })
    .filter(Boolean)
    .slice(0, 12);
}

function collectKeywords(asset: KnowledgeAsset, title: string, text: string) {
  const sourceParts = [asset.directoryLevel1, asset.directoryLevel2, asset.directoryLevel3].filter(Boolean) as string[];
  const tokens = `${title} ${text}`
    .match(/[A-Za-z][A-Za-z0-9-]{2,}|[\u4e00-\u9fa5]{2,8}|\d{2,4}[-~–—]?\d{0,4}℃?/g) || [];
  const businessTerms = tokens
    .map(token => token.trim())
    .filter(token => /烫金|涂布|底材|覆膜|附着|温度|压力|速度|报价|交期|质量|客户|工艺|亮金|哑金|UV|PP|PE|PET|K-\d|G-\d|S-\d/i.test(token))
    .slice(0, 10);

  return Array.from(new Set([
    ...asset.tags,
    CATEGORY_LABELS[asset.category],
    ...sourceParts,
    ...businessTerms,
    '人工可读',
  ].filter(Boolean))).slice(0, 18);
}

export function curateKnowledgeAsset(asset: KnowledgeAsset): KnowledgeAsset {
  const title = cleanTitle(asset.title, asset);
  const sourceContent = getSourceContent(asset.content);
  const text = getPlainText(sourceContent);
  const importantLines = pickImportantLines(text, title);
  const fieldRows = buildFieldRows(asset);
  const images = extractImageTags(sourceContent);
  const sourceTables = extractMarkdownTables(sourceContent);
  const source = asset.sourcePath || [asset.directoryLevel1, asset.directoryLevel2, asset.directoryLevel3].filter(Boolean).join(' / ') || '系统录入';

  const structuredFieldBlock = fieldRows.length > 0
    ? ['## 结构化字段', '| 字段 | 内容 |', '|---|---|', ...fieldRows].join('\n')
    : ['## 结构化字段', '- 暂无可用结构化字段'].join('\n');

  const sections = [
    [
      `## 核心信息`,
      `- 知识类型：${CATEGORY_LABELS[asset.category]}`,
      `- 标题：${title}`,
      `- 来源：${source}`,
      `- 审核状态：${cleanCell((asset as unknown as Record<string, unknown>).reviewStatus || (asset as unknown as Record<string, unknown>).reliability || '待人工复核')}`,
    ].join('\n'),
    [
      `## 一眼识别`,
      ...(importantLines.length > 0 ? importantLines.map(line => `- ${line}`) : [`- 该卡片来自 ${CATEGORY_LABELS[asset.category]}，请结合结构化字段和来源路径使用。`]),
    ].join('\n'),
    structuredFieldBlock,
    [
      `## 使用建议`,
      ...ACTION_HINTS[asset.category].map(line => `- ${line}`),
    ].join('\n'),
    sourceTables.length > 0 ? ['## 原文表格', ...sourceTables].join('\n\n') : '',
    images.length > 0 ? ['## 图片资料', ...images].join('\n') : '',
    text ? ['## 原文摘录', text.slice(0, 1200)].join('\n') : '',
  ].filter(Boolean);

  return {
    ...asset,
    title,
    tags: collectKeywords(asset, title, text),
    content: sections.join('\n\n'),
  } as KnowledgeAsset;
}

export function curateKnowledgeAssets(assets: KnowledgeAsset[]) {
  return assets.map(curateKnowledgeAsset);
}
