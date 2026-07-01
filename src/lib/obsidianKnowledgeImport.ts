import type { KnowledgeAsset, KnowledgeTableType } from '../types';
import { sanitizeKnowledgeRichText } from './knowledgeFieldSchemas';

export interface ObsidianNoteInput {
  relativePath: string;
  content: string;
}

export interface ParsedObsidianNote {
  relativePath: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

export interface ObsidianKnowledgeImportOptions {
  resolveAttachmentUrl?: (attachmentName: string, note: ParsedObsidianNote) => string | undefined;
}

const EXCLUDED_PATH_PARTS = ['.obsidian/', '.git/', '.claude/', '.claudian/', '90_模板/'];

function stringifyValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(stringifyValue).filter(Boolean).join('、');
  if (value === undefined || value === null) return '';
  return String(value).replace(/^\[\[(.*)\]\]$/, '$1').trim();
}

function asTags(value: unknown, fallback: string[] = []) {
  if (Array.isArray(value)) return value.map(stringifyValue).filter(Boolean);
  if (typeof value === 'string') return value.split(/[,，\s]+/).map(tag => tag.trim()).filter(Boolean);
  return fallback;
}

function parseScalar(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseObsidianNote(input: ObsidianNoteInput): ParsedObsidianNote {
  const frontmatter: Record<string, unknown> = {};
  let body = input.content;

  if (input.content.startsWith('---\n')) {
    const end = input.content.indexOf('\n---', 4);
    if (end > 0) {
      const rawFrontmatter = input.content.slice(4, end).split('\n');
      body = input.content.slice(end + 4).trim();

      let arrayKey: string | null = null;
      for (const line of rawFrontmatter) {
        if (!line.trim()) continue;

        const arrayItem = line.match(/^\s*-\s+(.*)$/);
        if (arrayItem && arrayKey) {
          const existing = Array.isArray(frontmatter[arrayKey]) ? frontmatter[arrayKey] as unknown[] : [];
          frontmatter[arrayKey] = [...existing, parseScalar(arrayItem[1])];
          continue;
        }

        const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
        if (!pair) continue;

        const [, key, rawValue] = pair;
        if (!rawValue.trim()) {
          frontmatter[key] = [];
          arrayKey = key;
        } else {
          frontmatter[key] = parseScalar(rawValue);
          arrayKey = null;
        }
      }
    }
  }

  return {
    relativePath: input.relativePath,
    frontmatter,
    body,
  };
}

export function shouldImportObsidianPath(relativePath: string) {
  if (!relativePath.endsWith('.md')) return false;
  return !EXCLUDED_PATH_PARTS.some(part => relativePath.includes(part));
}

export function getKnowledgeCategoryForObsidianNote(note: ParsedObsidianNote): KnowledgeTableType {
  const type = stringifyValue(note.frontmatter.type);
  const path = note.relativePath;
  const haystack = `${path} ${type} ${asTags(note.frontmatter.tags).join(' ')}`;

  if (path.includes('10_报价数据库') || type.includes('quote')) return 'pricing_rule';
  if (path.includes('03_GitMemory_工艺配方客户案例知识库/产品条目') || path.includes('01_ProductSpec') || type.includes('product')) return 'product_master';
  if (path.includes('04_L1L2L3_产品线应用工艺参数') || path.includes('11_涂布工艺知识资产') || haystack.includes('工艺')) return 'process_knowledge';
  if (/质量|故障|售后|问题|诊断/.test(haystack)) return 'quality_issue';
  if (/供应链|供应商|采购/.test(haystack)) return 'supply_chain_capability';
  if (/FAQ|话术|营销|提示词|Agent|智能体/.test(haystack)) return 'faq_pitch';
  if (/标签|tag/i.test(haystack)) return 'tag_system';
  return 'knowledge_governance';
}

function stableHash(value: string) {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

function markdownToKnowledgeHtml(markdown: string, note: ParsedObsidianNote, options: ObsidianKnowledgeImportOptions = {}) {
  return sanitizeKnowledgeRichText(
    markdown
      .replace(/!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, (_match, attachmentName) => {
        const src = options.resolveAttachmentUrl?.(attachmentName, note);
        return src ? `<img src="${src}" alt="${attachmentName}" />` : `附件：${attachmentName}`;
      })
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, src) => {
        const resolvedSrc = options.resolveAttachmentUrl?.(src, note) || src;
        return `<img src="${resolvedSrc}" alt="${alt}" />`;
      })
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .trim(),
  );
}

function buildBaseAsset(note: ParsedObsidianNote, category: KnowledgeTableType, options: ObsidianKnowledgeImportOptions = {}) {
  const title = stringifyValue(note.frontmatter.title) || note.relativePath.split('/').pop()?.replace(/\.md$/, '') || note.relativePath;
  const updated = stringifyValue(note.frontmatter.updated) || stringifyValue(note.frontmatter.date) || '2026-06-29';
  const directoryParts = note.relativePath.split('/').slice(0, -1);
  const tags = Array.from(new Set([
    ...asTags(note.frontmatter.tags, ['Obsidian']),
    'Obsidian同步',
    directoryParts[0],
  ].filter(Boolean)));

  return {
    id: `OBS-${stableHash(note.relativePath)}`,
    category,
    title,
    tags,
    lastUpdated: updated,
    author: 'Obsidian HotFoil_Database',
    content: markdownToKnowledgeHtml(note.body, note, options),
    sourcePath: note.relativePath,
    directoryLevel1: directoryParts[0] || '',
    directoryLevel2: directoryParts[1] || '',
    directoryLevel3: directoryParts[2] || '',
  };
}

export function convertObsidianNoteToKnowledgeAsset(note: ParsedObsidianNote, options: ObsidianKnowledgeImportOptions = {}): KnowledgeAsset {
  const category = getKnowledgeCategoryForObsidianNote(note);
  const base = buildBaseAsset(note, category, options);
  const fm = note.frontmatter;

  switch (category) {
    case 'product_master':
      return {
        ...base,
        category,
        productName: stringifyValue(fm.product_name) || base.title,
        productCategory: stringifyValue(fm.product_category) || stringifyValue(fm.type) || 'Obsidian产品资料',
        colorName: stringifyValue(fm.color_name),
        colorCode: stringifyValue(fm.color_code),
        specifications: stringifyValue(fm.spec),
        surfaceEffect: stringifyValue(fm.surface_effect),
        productStatus: stringifyValue(fm.status) || 'active',
        productImage: stringifyValue(fm.product_image),
        recommendedIndustries: stringifyValue(fm.application_scenarios),
        recommendedSubstrates: stringifyValue(fm.target_substrates),
        notRecommendedSubstrates: stringifyValue(fm.not_recommended_substrates),
        moq: stringifyValue(fm.moq),
        leadTime: stringifyValue(fm.lead_time),
        hasStock: stringifyValue(fm.has_stock),
        alternativeModels: stringifyValue(fm.alternative_models),
        riskLevel: stringifyValue(fm.risk_level),
        mustTestScenarios: stringifyValue(fm.must_test_scenarios),
        createdAt: base.lastUpdated,
        updatedAt: base.lastUpdated,
        reviewer: stringifyValue(fm.source_quality) || 'Obsidian同步',
      };
    case 'pricing_rule':
      return {
        ...base,
        category,
        ruleNo: stringifyValue(fm.quote_id) || base.id,
        productNo: stringifyValue(fm.product_name) || base.title,
        baseCost: stringifyValue(fm.market_rmb) || stringifyValue(fm.market_usd),
        widthImpact: stringifyValue(fm.spec),
        quantityTiers: stringifyValue(fm.customer_type),
        lossFactor: '',
        moq: stringifyValue(fm.unit),
        leadTimeRule: stringifyValue(fm.effective_date),
        expediteFee: '',
        customizationFee: stringifyValue(fm.package_info),
        priceLevel: stringifyValue(fm.currency),
        concessionBoundary: stringifyValue(fm.human_review_required) === 'true' ? '需人工复核' : '',
        alternativeSolutions: stringifyValue(fm.quote_source),
        pricingNotes: `市场价RMB：${stringifyValue(fm.market_rmb)}；市场价USD：${stringifyValue(fm.market_usd)}；经销价RMB：${stringifyValue(fm.dealer_rmb)}；经销价USD：${stringifyValue(fm.dealer_usd)}；终端价RMB：${stringifyValue(fm.terminal_rmb)}`,
      };
    case 'process_knowledge':
      return {
        ...base,
        category,
        processName: base.title,
        applicableProducts: stringifyValue(fm.product_name) || stringifyValue(fm.type),
        tempRange: stringifyValue(fm.temp_range),
        pressureRange: stringifyValue(fm.pressure_range),
        speedRange: stringifyValue(fm.speed_range),
        dwellTime: stringifyValue(fm.dwell_time),
        moldRequirements: stringifyValue(fm.mold_requirements),
        equipmentRequirements: stringifyValue(fm.equipment_requirements),
        environmentRequirements: stringifyValue(fm.environment_requirements),
        commonAnomalies: stringifyValue(fm.common_anomalies) || (base.content.includes('故障') ? '见正文故障/问题描述' : ''),
        adjustmentAdvice: stringifyValue(fm.adjustment_advice) || '见正文工艺建议',
        clientExplanation: stringifyValue(fm.client_explanation),
      };
    case 'quality_issue':
      return {
        ...base,
        category,
        issueNo: base.id,
        defectName: base.title,
        defectImage: stringifyValue(fm.defect_image),
        cause1: stringifyValue(fm.cause1),
        cause2: stringifyValue(fm.cause2),
        cause3: stringifyValue(fm.cause3),
        adjustmentAdvice: stringifyValue(fm.adjustment_advice) || '见正文诊断方案',
        alternativeProduct: stringifyValue(fm.alternative_product),
        requiresReprint: stringifyValue(fm.requires_reprint),
        clientExplanation: stringifyValue(fm.client_explanation),
        severity: stringifyValue(fm.severity),
        reviewStatus: stringifyValue(fm.status),
      };
    case 'faq_pitch':
      return {
        ...base,
        category,
        faqNo: base.id,
        clientQuestion: stringifyValue(fm.question) || base.title,
        questionCategory: stringifyValue(fm.type) || 'Obsidian话术/提示词',
        chineseAnswer: base.content,
        englishAnswer: stringifyValue(fm.english_answer),
        relatedProducts: stringifyValue(fm.related_products),
        relatedPracticeCases: stringifyValue(fm.related_cases),
        forbiddenPromises: stringifyValue(fm.forbidden_promises),
        applicableClientStage: stringifyValue(fm.client_stage),
      };
    case 'tag_system':
      return {
        ...base,
        category,
        tagNo: base.id,
        tagName: base.title,
        tagCategory: stringifyValue(fm.type) || 'Obsidian标签',
        applicationRule: base.content,
        parentTag: note.relativePath.split('/')[0],
        synonyms: stringifyValue(fm.aliases),
        conflictingTags: '',
        applicationScenarios: stringifyValue(fm.application_scenarios),
      };
    case 'supply_chain_capability':
      return {
        ...base,
        category,
        vendorCode: base.id,
        vendorName: stringifyValue(fm.vendor_name) || base.title,
        providedProducts: stringifyValue(fm.provided_products) || stringifyValue(fm.product_name),
        qualityLevel: stringifyValue(fm.quality_level) || stringifyValue(fm.source_quality),
        batchStability: stringifyValue(fm.batch_stability),
        normalLeadTime: stringifyValue(fm.lead_time),
        maxCapacityMoq: stringifyValue(fm.moq),
        supplyRisk: stringifyValue(fm.supply_risk),
        alternativeVendor: stringifyValue(fm.alternative_vendor),
        salesConstraint: stringifyValue(fm.sales_constraint),
      };
    default:
      return {
        ...base,
        category: 'knowledge_governance',
        ruleNo: base.id,
        knowledgeDomain: note.relativePath.split('/')[0],
        briefTitle: base.title,
        detailedContent: base.content,
        source: note.relativePath,
        reliability: stringifyValue(fm.source_quality) || '待验证',
        reviewer: 'Obsidian同步',
        reviewStatus: stringifyValue(fm.status) || '已同步',
        version: 'Obsidian',
        updatedAt: base.lastUpdated,
        failureCondition: '',
        usageCount: '',
        feedbackScore: '',
      };
  }
}

export function convertObsidianNotesToKnowledgeAssets(notes: ObsidianNoteInput[], options: ObsidianKnowledgeImportOptions = {}) {
  return notes
    .filter(note => shouldImportObsidianPath(note.relativePath))
    .map(parseObsidianNote)
    .map(note => convertObsidianNoteToKnowledgeAsset(note, options));
}
