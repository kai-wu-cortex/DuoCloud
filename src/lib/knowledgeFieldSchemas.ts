import type { KnowledgeAsset, KnowledgeTableType } from '../types.ts';
import { formatLocalDate } from './appState.ts';

export type KnowledgeFieldType = 'text' | 'textarea' | 'select';

export interface KnowledgeFieldDefinition {
  name: string;
  label: string;
  required?: boolean;
  type?: KnowledgeFieldType;
  placeholder?: string;
  options?: string[];
}

export interface KnowledgeFieldSchema {
  category: KnowledgeTableType;
  fields: KnowledgeFieldDefinition[];
}

interface BuildDraftInput {
  category: KnowledgeTableType;
  title: string;
  author: string;
  content?: string;
  tags: string[];
  fields: Record<string, string>;
  today?: string;
}

interface ValidateDraftInput {
  category: KnowledgeTableType;
  title: string;
  author: string;
  fields: Record<string, string>;
}

export const KNOWLEDGE_FIELD_SCHEMAS: Record<KnowledgeTableType, KnowledgeFieldSchema> = {
  product_master: {
    category: 'product_master',
    fields: [
      { name: 'productName', label: '产品名称', required: true, placeholder: '例如：G-1201 亮金膜' },
      { name: 'productCategory', label: '产品大类', required: true, placeholder: '例如：普通金 / 镭射膜' },
      { name: 'colorName', label: '颜色名称', required: true, placeholder: '例如：亮金' },
      { name: 'colorCode', label: '色号 / 内部代号', placeholder: '例如：Gold-101' },
      { name: 'specifications', label: '规格', required: true, placeholder: '例如：640mm x 120m' },
      { name: 'surfaceEffect', label: '表面效果', type: 'select', options: ['高亮', '哑面', '镭射', '珠光', '纹理'] },
      { name: 'productStatus', label: '产品状态', type: 'select', options: ['主推', '常规', '试销', '停用'] },
      { name: 'recommendedIndustries', label: '推荐应用行业', type: 'textarea', placeholder: '例如：化妆品盒、酒盒、礼盒' },
      { name: 'recommendedSubstrates', label: '推荐底材', required: true, type: 'textarea', placeholder: '例如：白卡纸、铜版纸' },
      { name: 'notRecommendedSubstrates', label: '不推荐底材', type: 'textarea', placeholder: '例如：未处理PP、低表面能PE' },
      { name: 'moq', label: 'MOQ', required: true, placeholder: '例如：10卷' },
      { name: 'leadTime', label: '常规交期', required: true, placeholder: '例如：3-7天' },
      { name: 'hasStock', label: '是否有库存', type: 'select', options: ['有', '无', '需确认'] },
      { name: 'alternativeModels', label: '替代型号', placeholder: '例如：G-1203' },
      { name: 'riskLevel', label: '使用风险等级', type: 'select', options: ['低', '中', '高'] },
      { name: 'mustTestScenarios', label: '必须打样场景', type: 'textarea', placeholder: '例如：覆膜纸、UV油墨、触感膜' },
      { name: 'reviewer', label: '审核人', placeholder: '例如：工艺主管' },
    ],
  },
  substrate_knowledge: {
    category: 'substrate_knowledge',
    fields: [
      { name: 'substrateName', label: '底材名称', required: true, placeholder: '例如：哑膜覆膜白卡纸' },
      { name: 'substrateCategory', label: '底材分类', required: true, type: 'select', options: ['纸张', '塑料', '皮革', '织物', '玻璃/金属', '复合材料'] },
      { name: 'surfaceRoughness', label: '表面粗糙度', placeholder: '例如：平滑 / 轻微橘皮' },
      { name: 'surfaceTreatment', label: '表面处理', required: true, placeholder: '例如：覆哑膜 / 电晕处理' },
      { name: 'adhesionDifficulty', label: '吸附难易度', required: true, type: 'select', options: ['低', '中', '高'] },
      { name: 'temperatureResistance', label: '耐温情况', placeholder: '例如：110-130℃' },
      { name: 'recommendedSeries', label: '推荐膜系列', placeholder: '例如：G系列、专用塑料箔' },
      { name: 'highRiskSeries', label: '高风险膜系列', placeholder: '例如：普通纸张箔' },
      { name: 'commonApplications', label: '常见应用', type: 'textarea' },
      { name: 'commonIssues', label: '常见问题', required: true, type: 'textarea' },
      { name: 'treatmentAdvice', label: '处理建议', required: true, type: 'textarea' },
      { name: 'reviewStatus', label: '审核状态', type: 'select', options: ['草稿', '待审核', '已审核', '需复核'] },
    ],
  },
  compatibility_rule: {
    category: 'compatibility_rule',
    fields: [
      { name: 'ruleNo', label: '规则编号', required: true, placeholder: '例如：R-001' },
      { name: 'productNo', label: '产品型号', required: true, placeholder: '例如：G-1201' },
      { name: 'substrateName', label: '底材名称', required: true, placeholder: '例如：哑膜覆膜白卡纸' },
      { name: 'surfaceTreatment', label: '表面处理', required: true },
      { name: 'compatibilityLevel', label: '适配等级', required: true, type: 'select', options: ['推荐', '可用', '谨慎', '不推荐'] },
      { name: 'recommendReason', label: '推荐理由', required: true, type: 'textarea' },
      { name: 'riskNotes', label: '风险说明', type: 'textarea' },
      { name: 'tempRange', label: '温度范围', required: true, placeholder: '例如：105-115℃' },
      { name: 'pressureRange', label: '压力范围', placeholder: '例如：中压 / 45-55kg' },
      { name: 'speedRange', label: '速度范围', placeholder: '例如：3500-4000印/小时' },
      { name: 'requiresTesting', label: '是否必须打样', type: 'select', options: ['是', '否', '视项目而定'] },
      { name: 'relatedPracticeCases', label: '关联实践云案例', placeholder: '例如：SY-2026-0042' },
      { name: 'salesPitch', label: '销售推荐话术', type: 'textarea' },
      { name: 'reviewer', label: '审核人' },
    ],
  },
  process_knowledge: {
    category: 'process_knowledge',
    fields: [
      { name: 'processName', label: '工艺名称', required: true, placeholder: '例如：平压平自动烫金' },
      { name: 'applicableProducts', label: '适用产品', required: true, placeholder: '例如：普通金系列' },
      { name: 'tempRange', label: '温度范围', required: true, placeholder: '例如：110-125℃' },
      { name: 'pressureRange', label: '压力范围', required: true, placeholder: '例如：45-55kg' },
      { name: 'speedRange', label: '速度范围', required: true, placeholder: '例如：3500-4000印/小时' },
      { name: 'dwellTime', label: '停留时间', placeholder: '例如：0.5s' },
      { name: 'moldRequirements', label: '模具要求', type: 'textarea' },
      { name: 'equipmentRequirements', label: '设备要求', type: 'textarea' },
      { name: 'environmentRequirements', label: '环境要求', type: 'textarea' },
      { name: 'commonAnomalies', label: '常见异常', required: true, type: 'textarea' },
      { name: 'adjustmentAdvice', label: '调机建议', required: true, type: 'textarea' },
      { name: 'clientExplanation', label: '客户解释口径', type: 'textarea' },
    ],
  },
  pricing_rule: {
    category: 'pricing_rule',
    fields: [
      { name: 'ruleNo', label: '报价规则编号', required: true, placeholder: '例如：Q-001' },
      { name: 'productNo', label: '产品型号 / 系列', required: true, placeholder: '例如：G系列' },
      { name: 'baseCost', label: '基础成本', required: true },
      { name: 'widthImpact', label: '宽幅影响' },
      { name: 'quantityTiers', label: '数量阶梯', required: true, type: 'textarea' },
      { name: 'lossFactor', label: '损耗系数', placeholder: '例如：5%' },
      { name: 'moq', label: 'MOQ', required: true },
      { name: 'leadTimeRule', label: '交期规则', required: true, type: 'textarea' },
      { name: 'expediteFee', label: '加急费用' },
      { name: 'customizationFee', label: '定制费用' },
      { name: 'priceLevel', label: '价格等级', type: 'select', options: ['A', 'B', 'C', '项目价'] },
      { name: 'concessionBoundary', label: '让步边界', required: true, type: 'textarea' },
      { name: 'alternativeSolutions', label: '替代方案', type: 'textarea' },
      { name: 'pricingNotes', label: '报价备注', type: 'textarea' },
    ],
  },
  quality_issue: {
    category: 'quality_issue',
    fields: [
      { name: 'issueNo', label: '问题编号', required: true, placeholder: '例如：D-001' },
      { name: 'defectName', label: '缺陷名称', required: true, placeholder: '例如：百格掉粉' },
      { name: 'defectImage', label: '缺陷图片链接' },
      { name: 'cause1', label: '可能原因 1', required: true, type: 'textarea' },
      { name: 'cause2', label: '可能原因 2', type: 'textarea' },
      { name: 'cause3', label: '可能原因 3', type: 'textarea' },
      { name: 'adjustmentAdvice', label: '调整建议', required: true, type: 'textarea' },
      { name: 'alternativeProduct', label: '替代产品' },
      { name: 'requiresReprint', label: '是否需要重打', type: 'select', options: ['是', '否', '视影响范围而定'] },
      { name: 'clientExplanation', label: '客户解释口径', required: true, type: 'textarea' },
      { name: 'severity', label: '严重程度', required: true, type: 'select', options: ['低', '中', '高', '重大'] },
      { name: 'reviewStatus', label: '审核状态', type: 'select', options: ['草稿', '待审核', '已确认'] },
    ],
  },
  supply_chain_capability: {
    category: 'supply_chain_capability',
    fields: [
      { name: 'vendorCode', label: '供应商编号', required: true, placeholder: '例如：V-001' },
      { name: 'vendorName', label: '供应商名称', required: true },
      { name: 'providedProducts', label: '提供产品', required: true, type: 'textarea' },
      { name: 'qualityLevel', label: '质量稳定性等级', required: true, type: 'select', options: ['高', '中', '低', '观察中'] },
      { name: 'batchStability', label: '批次稳定性', type: 'textarea' },
      { name: 'normalLeadTime', label: '常规供货周期', required: true },
      { name: 'maxCapacityMoq', label: '最大供货量 / MOQ' },
      { name: 'supplyRisk', label: '供应风险', required: true, type: 'select', options: ['低', '中', '高'] },
      { name: 'alternativeVendor', label: '替代供应商' },
      { name: 'salesConstraint', label: '对外承诺限制', required: true, type: 'textarea' },
    ],
  },
  faq_pitch: {
    category: 'faq_pitch',
    fields: [
      { name: 'faqNo', label: '问题编号', required: true, placeholder: '例如：F-001' },
      { name: 'clientQuestion', label: '客户常问问题', required: true, type: 'textarea' },
      { name: 'questionCategory', label: '问题分类', required: true, type: 'select', options: ['质量疑问', '交期疑问', '价格疑问', '适配疑问', '售后处理'] },
      { name: 'chineseAnswer', label: '中文回答', required: true, type: 'textarea' },
      { name: 'englishAnswer', label: '英文回答', type: 'textarea' },
      { name: 'relatedProducts', label: '关联产品' },
      { name: 'relatedPracticeCases', label: '关联实践案例' },
      { name: 'forbiddenPromises', label: '禁止承诺内容', required: true, type: 'textarea' },
      { name: 'applicableClientStage', label: '适用客户阶段', type: 'select', options: ['售前', '打样', '量产', '售后', '全流程'] },
    ],
  },
  tag_system: {
    category: 'tag_system',
    fields: [
      { name: 'tagNo', label: '标签编号', required: true, placeholder: '例如：TAG-001' },
      { name: 'tagName', label: '标签名称', required: true, placeholder: '例如：化妆品盒' },
      { name: 'tagCategory', label: '标签分类', required: true, type: 'select', options: ['行业应用', '产品系列', '底材', '风险', '工艺', '客户阶段'] },
      { name: 'applicationRule', label: '使用规则', required: true, type: 'textarea' },
      { name: 'parentTag', label: '上级标签' },
      { name: 'synonyms', label: '同义词' },
      { name: 'conflictingTags', label: '互斥标签' },
      { name: 'applicationScenarios', label: '应用场景 / 推荐 / 案例匹配', type: 'textarea' },
    ],
  },
  knowledge_governance: {
    category: 'knowledge_governance',
    fields: [
      { name: 'ruleNo', label: '知识编号', required: true, placeholder: '例如：GOV-001' },
      { name: 'knowledgeDomain', label: '知识领域', required: true, type: 'select', options: ['产品管理', '工艺管理', '价格管理', '质量管理', '供应链', '销售话术'] },
      { name: 'briefTitle', label: '简短标题', required: true },
      { name: 'detailedContent', label: '完整说明', required: true, type: 'textarea' },
      { name: 'source', label: '来源信息', required: true, type: 'textarea' },
      { name: 'reliability', label: '来源可靠度', type: 'select', options: ['极高', '高', '中', '待验证'] },
      { name: 'reviewer', label: '审核信息', required: true },
      { name: 'reviewStatus', label: '审核状态', type: 'select', options: ['草稿', '待审核', '已发布', '已失效'] },
      { name: 'version', label: '版本信息', required: true, placeholder: '例如：V1.0' },
      { name: 'failureCondition', label: '失效条件', type: 'textarea' },
      { name: 'usageCount', label: '使用频次' },
      { name: 'feedbackScore', label: '反馈评分' },
    ],
  },
};

export function getKnowledgeFieldSchema(category: KnowledgeTableType) {
  const schema = KNOWLEDGE_FIELD_SCHEMAS[category];
  return {
    ...schema,
    fields: schema.fields.map(field => ({ ...field, required: false })),
  };
}

export function createInitialKnowledgeFields(category: KnowledgeTableType) {
  const fields: Record<string, string> = {};
  for (const field of getKnowledgeFieldSchema(category).fields) {
    fields[field.name] = field.options?.[0] ?? '';
  }
  return fields;
}

export function validateKnowledgeAssetDraft(input: ValidateDraftInput) {
  const missingFieldLabels: string[] = [];

  return {
    valid: missingFieldLabels.length === 0,
    missingFieldLabels,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  return '';
}

function isImageUrl(value: string) {
  return /\.(png|jpe?g|gif|webp|svg)(?:[?#].*)?$/i.test(value.trim());
}

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function looksLikeMarkdown(value: string) {
  return /(^|\n)\s{0,3}(#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s+|```|\|.+\|)|!\[[^\]]*]\([^)]+\)|\[[^\]]+]\([^)]+\)|\*\*[^*]+\*\*|__[^_]+__|`[^`]+`/.test(value);
}

function parseInlineMarkdown(value: string) {
  let next = escapeHtml(value);

  next = next.replace(/!\[([^\]]*)]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_match, alt, src) => {
    const safeSrc = normalizeUrl(src);
    return safeSrc ? `<img src="${escapeHtml(safeSrc)}" alt="${escapeHtml(alt)}" />` : '';
  });

  next = next.replace(/\[([^\]]+)]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_match, label, href) => {
    const safeHref = normalizeUrl(href);
    return safeHref ? `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noreferrer">${label}</a>` : label;
  });

  next = next
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[\s>])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[\s>])_([^_\n]+)_/g, '$1<em>$2</em>');

  return next;
}

function isMarkdownTableDivider(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitMarkdownTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.trim());
}

export function markdownToKnowledgeHtml(markdown: string) {
  const lines = String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      blocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    if (trimmed.includes('|') && index + 1 < lines.length && isMarkdownTableDivider(lines[index + 1])) {
      const headers = splitMarkdownTableRow(trimmed);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].trim().includes('|')) {
        rows.push(splitMarkdownTableRow(lines[index]));
        index += 1;
      }
      index -= 1;
      blocks.push(
        `<table><thead><tr>${headers.map(header => `<th>${parseInlineMarkdown(header)}</th>`).join('')}</tr></thead><tbody>${rows
          .map(row => `<tr>${row.map(cell => `<td>${parseInlineMarkdown(cell)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`,
      );
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = Math.min(6, heading[1].length);
      blocks.push(`<h${level}>${parseInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*+]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*+]\s+/, ''));
        index += 1;
      }
      index -= 1;
      blocks.push(`<ul>${items.map(item => `<li>${parseInlineMarkdown(item)}</li>`).join('')}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ''));
        index += 1;
      }
      index -= 1;
      blocks.push(`<ol>${items.map(item => `<li>${parseInlineMarkdown(item)}</li>`).join('')}</ol>`);
      continue;
    }

    if (/^>\s+/.test(trimmed)) {
      blocks.push(`<blockquote>${parseInlineMarkdown(trimmed.replace(/^>\s+/, ''))}</blockquote>`);
      continue;
    }

    const paragraphLines = [trimmed];
    while (
      index + 1 < lines.length
      && lines[index + 1].trim()
      && !/^(#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s+|```)/.test(lines[index + 1].trim())
      && !(lines[index + 1].trim().includes('|') && index + 2 < lines.length && isMarkdownTableDivider(lines[index + 2]))
    ) {
      index += 1;
      paragraphLines.push(lines[index].trim());
    }
    blocks.push(`<p>${paragraphLines.map(parseInlineMarkdown).join('<br>')}</p>`);
  }

  return sanitizeKnowledgeRichText(blocks.join(''));
}

export function sanitizeKnowledgeRichText(value: string) {
  return String(value ?? '')
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '')
    .replace(/\s+(style|class)\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '')
    .replace(/<(\/?)(b|strong|i|em|u|p|br|div|span|ul|ol|li|blockquote|pre|code|table|thead|tbody|tr|th|td|h[1-6])\b[^>]*>/gi, '<$1$2>')
    .replace(/<a\b[^>]*href\s*=\s*(['"])(.*?)\1[^>]*>/gi, (_match, _quote, href) => {
      const safeHref = normalizeUrl(href);
      return safeHref ? `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noreferrer">` : '<span>';
    })
    .replace(/<img\b[^>]*src\s*=\s*(['"])(.*?)\1[^>]*>/gi, (_match, _quote, src) => {
      const safeSrc = normalizeUrl(src);
      return safeSrc ? `<img src="${escapeHtml(safeSrc)}" alt="" />` : '';
    })
    .replace(/<(?!\/?(?:b|strong|i|em|u|p|br|div|span|ul|ol|li|blockquote|pre|code|table|thead|tbody|tr|th|td|h[1-6]|a|img)\b)[^>]*>/gi, '');
}

function linkifyPlainText(value: string) {
  return escapeHtml(value)
    .replace(/\n/g, '<br>')
    .replace(
      /((?:https?:\/\/)[^\s<]+)/g,
      url => {
        const safeUrl = escapeHtml(url);
        return isImageUrl(url)
          ? `<img src="${safeUrl}" alt="" />`
          : `<a href="${safeUrl}" target="_blank" rel="noreferrer">${safeUrl}</a>`;
      },
    );
}

export function renderKnowledgeRichText(value: string) {
  if (!looksLikeHtml(value) && looksLikeMarkdown(value)) return markdownToKnowledgeHtml(value);

  const sanitized = sanitizeKnowledgeRichText(value);
  if (looksLikeHtml(sanitized) && looksLikeMarkdown(sanitized.replace(/<[^>]+>/g, ' '))) {
    const protectedHtml: string[] = [];
    const protectedMarkdown = sanitized.replace(/<(?:img)\b[^>]*>|<a\b[^>]*>[\s\S]*?<\/a>/gi, (match) => {
      const token = `@@DUOCLOUD_HTML_${protectedHtml.length}@@`;
      protectedHtml.push(match);
      return token;
    });
    const rendered = markdownToKnowledgeHtml(protectedMarkdown);
    return protectedHtml.reduce(
      (next, html, index) => next.replaceAll(`@@DUOCLOUD_HTML_${index}@@`, html),
      rendered,
    );
  }

  if (!sanitized.includes('<')) return linkifyPlainText(sanitized);

  return sanitized
    .split(/(<[^>]+>)/g)
    .map(part => part.startsWith('<') ? part : linkifyPlainText(part))
    .join('');
}

function buildStructuredContent(category: KnowledgeTableType, fields: Record<string, string>) {
  const lines = getKnowledgeFieldSchema(category).fields
    .map(field => {
      const value = sanitizeKnowledgeRichText(String(fields[field.name] ?? '').trim());
      return value ? `${field.label}：${value}` : '';
    })
    .filter(Boolean);

  return lines.join('\n');
}

export function buildKnowledgeAssetDraft(input: BuildDraftInput): Omit<KnowledgeAsset, 'id' | 'lastUpdated'> {
  const today = input.today ?? formatLocalDate();
  const schema = getKnowledgeFieldSchema(input.category);
  const structuredFields = schema.fields.reduce<Record<string, string>>((result, field) => {
    result[field.name] = sanitizeKnowledgeRichText(String(input.fields[field.name] ?? '').trim());
    return result;
  }, {});

  const content = sanitizeKnowledgeRichText(input.content?.trim() || buildStructuredContent(input.category, structuredFields));

  return {
    title: input.title.trim() || `${input.category} ${today}`,
    category: input.category,
    content,
    author: input.author.trim() || '未指定',
    tags: input.tags.length > 0 ? input.tags : [schema.category],
    ...structuredFields,
    ...(input.category === 'product_master' ? {
      productImage: '',
      createdAt: today,
      updatedAt: today,
    } : {}),
    ...(input.category === 'knowledge_governance' ? {
      updatedAt: today,
    } : {}),
  } as Omit<KnowledgeAsset, 'id' | 'lastUpdated'>;
}
