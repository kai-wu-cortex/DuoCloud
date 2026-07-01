import type { KnowledgeAsset, KnowledgeTableType } from '../types';
import {
  buildKnowledgeAssetDraft,
  getKnowledgeFieldSchema,
  renderKnowledgeRichText,
} from './knowledgeFieldSchemas';

type KnowledgeDraft = Omit<KnowledgeAsset, 'id' | 'lastUpdated'>;
type WorksheetRow = Record<string, unknown>;

interface TableTemplateConfig {
  category: KnowledgeTableType;
  code: string;
  sheetName: string;
  businessName: string;
  aliases: Record<string, string[]>;
}

const COMMON_COLUMNS = [
  '知识条目标题',
  '负责人',
  '知识标签',
  '详细描述与指导',
  '来源Obsidian路径',
  '一级目录',
  '二级目录',
  '三级目录',
  '入库备注',
];

export const KNOWLEDGE_IMPORT_TEMPLATES: TableTemplateConfig[] = [
  {
    category: 'product_master',
    code: 'T01_PRODUCT',
    sheetName: 'T01_产品主数据',
    businessName: '产品主数据表',
    aliases: {
      productName: ['产品名称', '产品编号', 'SKU', '型号'],
      productCategory: ['产品大类', '产品系列'],
      colorCode: ['色号 / 内部代号', '色号 / 内部代码', '色号', '内部代号'],
    },
  },
  {
    category: 'substrate_knowledge',
    code: 'T02_SUBSTRATE',
    sheetName: 'T02_底材知识',
    businessName: '底材知识表',
    aliases: {
      surfaceRoughness: ['表面粗糙度', '表面状态'],
      adhesionDifficulty: ['吸附难易度', '吸附难度'],
    },
  },
  {
    category: 'compatibility_rule',
    code: 'T03_COMPATIBILITY',
    sheetName: 'T03_适配规则',
    businessName: '产品 × 底材适配规则表',
    aliases: {
      productNo: ['产品型号', '产品型号 / 系列', '产品型号/系列'],
      relatedPracticeCases: ['关联实践云案例', '关联实践案例'],
    },
  },
  {
    category: 'process_knowledge',
    code: 'T04_PROCESS',
    sheetName: 'T04_工艺知识',
    businessName: '工艺知识表',
    aliases: {
      dwellTime: ['停留时间', '时间/停留时'],
    },
  },
  {
    category: 'pricing_rule',
    code: 'T05_PRICING',
    sheetName: 'T05_报价规则',
    businessName: '报价规则表',
    aliases: {
      productNo: ['产品型号 / 系列', '产品型号/系列', '产品型号'],
    },
  },
  {
    category: 'quality_issue',
    code: 'T06_QUALITY',
    sheetName: 'T06_质量问题',
    businessName: '质量问题表',
    aliases: {
      issueNo: ['问题编号', '缺陷编号'],
      defectImage: ['缺陷图片', '缺陷图片链接'],
      clientExplanation: ['对客户解释', '客户解释口径'],
    },
  },
  {
    category: 'supply_chain_capability',
    code: 'T07_SUPPLY',
    sheetName: 'T07_供应链能力',
    businessName: '供应链能力表',
    aliases: {
      maxCapacityMoq: ['最大供货量 / MOQ', '最大供货量/MOQ'],
      normalLeadTime: ['常规供货周期', '常规交期'],
    },
  },
  {
    category: 'faq_pitch',
    code: 'T08_FAQ',
    sheetName: 'T08_FAQ话术',
    businessName: '销售话术与 FAQ 表',
    aliases: {
      faqNo: ['问题编号', 'FAQ编号'],
      questionCategory: ['问题分类', '问题类型'],
      relatedPracticeCases: ['关联实践云案例', '关联实践案例'],
    },
  },
  {
    category: 'tag_system',
    code: 'T09_TAG',
    sheetName: 'T09_标签体系',
    businessName: '知识标签体系表',
    aliases: {
      tagCategory: ['标签分类', '标签类型'],
      conflictingTags: ['互斥标签', '禁用词'],
      applicationScenarios: ['应用场景 / 推荐 / 案例匹配', '用于哪些应用'],
    },
  },
  {
    category: 'knowledge_governance',
    code: 'T10_GOVERNANCE',
    sheetName: 'T10_知识治理',
    businessName: '知识治理表',
    aliases: {
      knowledgeDomain: ['知识领域', '知识类型'],
      briefTitle: ['简短标题', '知识标题'],
      detailedContent: ['完整说明', '知识正文'],
      source: ['来源信息', '知识来源'],
      reliability: ['来源可靠度', '来源可信度'],
      version: ['版本信息', '版本号'],
      usageCount: ['使用频次', '使用次数'],
    },
  },
];

function stripHtml(value: string) {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function normalizeHeader(value: string) {
  return String(value ?? '').replace(/\s+/g, '').replace(/[：:]/g, '').trim().toLowerCase();
}

function readCell(row: Record<string, unknown>, candidates: string[]) {
  const normalizedCandidates = candidates.map(normalizeHeader);
  for (const [key, value] of Object.entries(row)) {
    if (!normalizedCandidates.includes(normalizeHeader(key))) continue;
    return String(value ?? '').trim();
  }
  return '';
}

function splitTags(value: string) {
  return value
    .split(/[、,，;；]/)
    .map(tag => tag.trim())
    .filter(Boolean);
}

function getTitleFromFields(category: KnowledgeTableType, fields: Record<string, string>, fallback: string) {
  const priorityByCategory: Partial<Record<KnowledgeTableType, string[]>> = {
    product_master: ['productName', 'colorName', 'productCategory'],
    substrate_knowledge: ['substrateName', 'substrateCategory'],
    compatibility_rule: ['ruleNo', 'productNo', 'substrateName'],
    process_knowledge: ['processName', 'applicableProducts'],
    pricing_rule: ['ruleNo', 'productNo'],
    quality_issue: ['issueNo', 'defectName'],
    supply_chain_capability: ['vendorName', 'vendorCode'],
    faq_pitch: ['clientQuestion', 'faqNo'],
    tag_system: ['tagName', 'tagNo'],
    knowledge_governance: ['briefTitle', 'ruleNo', 'knowledgeDomain'],
  };

  return (priorityByCategory[category] || [])
    .map(fieldName => fields[fieldName])
    .find(Boolean) || fallback;
}

function getColumnAliases(config: TableTemplateConfig, fieldName: string, label: string) {
  return Array.from(new Set([label, fieldName, ...(config.aliases[fieldName] || [])]));
}

function rowHasValue(row: Record<string, unknown>) {
  return Object.values(row).some(value => String(value ?? '').trim());
}

async function loadZipTools() {
  return await import('@zip.js/zip.js');
}

function parseXml(xml: string) {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

function escapeXml(value: string) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function collectTextContent(element: Element | null) {
  if (!element) return '';
  return Array.from(element.getElementsByTagName('t'))
    .map(node => node.textContent || '')
    .join('');
}

function columnNameToIndex(name: string) {
  return name
    .toUpperCase()
    .split('')
    .reduce((result, char) => result * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function columnIndexToName(index: number) {
  let column = '';
  let next = index + 1;
  while (next > 0) {
    const remainder = (next - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    next = Math.floor((next - 1) / 26);
  }
  return column;
}

function cellRef(columnIndex: number, rowIndex: number) {
  return `${columnIndexToName(columnIndex)}${rowIndex + 1}`;
}

function decodeCellValue(cell: Element, sharedStrings: string[]) {
  const type = cell.getAttribute('t');
  if (type === 'inlineStr') return collectTextContent(cell.querySelector('is'));
  const value = cell.querySelector('v')?.textContent || '';
  if (type === 's') return sharedStrings[Number(value)] || '';
  if (type === 'b') return value === '1' ? 'TRUE' : 'FALSE';
  return value;
}

function rowsFromWorksheetXml(xml: string, sharedStrings: string[]) {
  const doc = parseXml(xml);
  const rowElements = Array.from(doc.getElementsByTagName('row'));
  const matrix = rowElements.map(rowElement => {
    const row: string[] = [];
    Array.from(rowElement.getElementsByTagName('c')).forEach(cell => {
      const ref = cell.getAttribute('r') || '';
      const columnMatch = ref.match(/[A-Z]+/i);
      const columnIndex = columnMatch ? columnNameToIndex(columnMatch[0]) : row.length;
      row[columnIndex] = decodeCellValue(cell, sharedStrings);
    });
    return row.map(value => value || '');
  });
  const headers = (matrix[0] || []).map(value => String(value || '').trim());
  if (headers.length === 0) return [];

  return matrix.slice(1).map(row => {
    const record: WorksheetRow = {};
    headers.forEach((header, index) => {
      if (header) record[header] = row[index] || '';
    });
    return record;
  }).filter(rowHasValue);
}

function parseCsvText(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }

  row.push(cell);
  rows.push(row);
  const headers = (rows[0] || []).map(value => value.trim());
  return rows.slice(1).map(values => {
    const record: WorksheetRow = {};
    headers.forEach((header, index) => {
      if (header) record[header] = values[index] || '';
    });
    return record;
  }).filter(rowHasValue);
}

function buildWorksheetXml(rows: Record<string, string>[], headers: string[]) {
  const allRows = [headers, ...rows.map(row => headers.map(header => row[header] || ''))];
  const xmlRows = allRows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => (
      `<c r="${cellRef(columnIndex, rowIndex)}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
    )).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');

  const lastRef = cellRef(Math.max(headers.length - 1, 0), Math.max(allRows.length - 1, 0));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastRef}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <sheetData>${xmlRows}</sheetData>
</worksheet>`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function convertRowToDraft(row: Record<string, unknown>, config: TableTemplateConfig): KnowledgeDraft | null {
  if (!rowHasValue(row)) return null;

  const schema = getKnowledgeFieldSchema(config.category);
  const fields = schema.fields.reduce<Record<string, string>>((result, field) => {
    result[field.name] = readCell(row, getColumnAliases(config, field.name, field.label));
    return result;
  }, {});

  const title = readCell(row, ['知识条目标题', '标题', '原始标题', '标准标题'])
    || getTitleFromFields(config.category, fields, `${config.businessName} ${Date.now()}`);
  const author = readCell(row, ['负责人', '主责', '审核人', '作者']) || '数据导入';
  const content = readCell(row, ['详细描述与指导', '详细描述', '详情', '知识正文', '完整说明', '入库备注']);
  const tags = splitTags(readCell(row, ['知识标签', '标签', 'tags']));
  const draft = buildKnowledgeAssetDraft({
    category: config.category,
    title,
    author,
    content,
    tags: tags.length > 0 ? tags : [config.businessName],
    fields,
  }) as KnowledgeDraft & Record<string, string>;

  const sourcePath = readCell(row, ['来源Obsidian路径', '来源路径', 'sourcePath']);
  if (sourcePath) draft.sourcePath = sourcePath;

  const directoryLevel1 = readCell(row, ['一级目录', '目录一级', 'directoryLevel1']);
  const directoryLevel2 = readCell(row, ['二级目录', '目录二级', 'directoryLevel2']);
  const directoryLevel3 = readCell(row, ['三级目录', '目录三级', 'directoryLevel3']);
  if (directoryLevel1) draft.directoryLevel1 = directoryLevel1;
  if (directoryLevel2) draft.directoryLevel2 = directoryLevel2;
  if (directoryLevel3) draft.directoryLevel3 = directoryLevel3;

  return draft;
}

export async function parseKnowledgeImportWorkbook(file: File) {
  if (file.name.toLowerCase().endsWith('.csv')) {
    const rows = parseCsvText(await file.text());
    const importedAssets = rows.flatMap(row => {
      const categoryValue = readCell(row, ['数据表类型', '业务表', 'category']);
      const config = KNOWLEDGE_IMPORT_TEMPLATES.find(item => (
        categoryValue === item.category
        || categoryValue === item.businessName
        || categoryValue.includes(item.businessName.replace(/表$/, ''))
      )) || KNOWLEDGE_IMPORT_TEMPLATES[0];
      const draft = convertRowToDraft(row, config);
      return draft ? [draft] : [];
    });
    return { importedAssets, rowsBySheet: { CSV: rows.length } };
  }

  const { BlobReader, TextWriter, ZipReader } = await loadZipTools();
  const reader = new ZipReader(new BlobReader(file));
  const entries = await reader.getEntries();
  const entryByName = new Map(entries.map(entry => [entry.filename, entry]));
  const readEntry = async (path: string) => {
    const entry = entryByName.get(path);
    const readableEntry = entry as { getData?: (writer: InstanceType<typeof TextWriter>) => Promise<string> } | undefined;
    if (!readableEntry?.getData) return '';
    return await readableEntry.getData(new TextWriter());
  };

  const importedAssets: KnowledgeDraft[] = [];
  const rowsBySheet: Record<string, number> = {};
  const workbookXml = await readEntry('xl/workbook.xml');
  const workbookRelsXml = await readEntry('xl/_rels/workbook.xml.rels');
  const sharedStringsXml = await readEntry('xl/sharedStrings.xml');

  const sharedStrings = sharedStringsXml
    ? Array.from(parseXml(sharedStringsXml).getElementsByTagName('si')).map(collectTextContent)
    : [];
  const relTargets = new Map(
    Array.from(parseXml(workbookRelsXml).getElementsByTagName('Relationship')).map(rel => [
      rel.getAttribute('Id') || '',
      rel.getAttribute('Target') || '',
    ]),
  );
  const sheets = Array.from(parseXml(workbookXml).getElementsByTagName('sheet')).map(sheet => {
    const relId = sheet.getAttribute('r:id') || sheet.getAttribute('id') || '';
    const target = relTargets.get(relId) || '';
    return {
      name: sheet.getAttribute('name') || '',
      path: target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^xl\//, '')}`,
    };
  });

  for (const config of KNOWLEDGE_IMPORT_TEMPLATES) {
    const sheet = sheets.find(item => (
      item.name === config.sheetName
      || item.name.includes(config.sheetName)
      || item.name.includes(config.businessName.replace(/表$/, ''))
    ));
    const rows = sheet ? rowsFromWorksheetXml(await readEntry(sheet.path), sharedStrings) : [];
    rowsBySheet[config.sheetName] = rows.length;
    for (const row of rows) {
      const draft = convertRowToDraft(row, config);
      if (draft) importedAssets.push(draft);
    }
  }

  if (importedAssets.length === 0) {
    const firstSheet = sheets[0];
    const rows = firstSheet ? rowsFromWorksheetXml(await readEntry(firstSheet.path), sharedStrings) : [];
    for (const row of rows) {
      const categoryValue = readCell(row, ['数据表类型', '业务表', 'category']);
      const config = KNOWLEDGE_IMPORT_TEMPLATES.find(item => (
        categoryValue === item.category
        || categoryValue === item.businessName
        || categoryValue.includes(item.businessName.replace(/表$/, ''))
      ));
      if (!config) continue;
      const draft = convertRowToDraft(row, config);
      if (draft) importedAssets.push(draft);
    }
    rowsBySheet[firstSheet?.name || '未识别工作表'] = rows.length;
  }

  await reader.close();
  return { importedAssets, rowsBySheet };
}

function assetToRow(asset: KnowledgeAsset, config: TableTemplateConfig) {
  const schema = getKnowledgeFieldSchema(config.category);
  const row: Record<string, string> = {
    数据表类型: config.businessName,
    知识条目标题: asset.title,
    负责人: asset.author,
    知识标签: (asset.tags || []).join('、'),
    详细描述与指导: stripHtml(renderKnowledgeRichText(asset.content)),
    来源Obsidian路径: asset.sourcePath || '',
    一级目录: asset.directoryLevel1 || '',
    二级目录: asset.directoryLevel2 || '',
    三级目录: asset.directoryLevel3 || '',
    入库备注: asset.localEditedAt ? `本地编辑：${asset.localEditedAt}` : '',
  };

  for (const field of schema.fields) {
    row[field.label] = stripHtml(String((asset as any)[field.name] ?? ''));
  }

  return row;
}

export async function exportKnowledgeAssetsWorkbook(assets: KnowledgeAsset[], fileName?: string) {
  const { BlobWriter, TextReader, ZipWriter } = await loadZipTools();
  const writer = new ZipWriter(new BlobWriter('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
  const sheets: Array<{ name: string; rows: Record<string, string>[]; headers: string[] }> = [];

  const overviewRows = KNOWLEDGE_IMPORT_TEMPLATES.map(config => ({
    表编号: config.code,
    业务表: config.businessName,
    工作表: config.sheetName,
    当前数量: String(assets.filter(asset => asset.category === config.category).length),
  }));
  sheets.push({
    name: '导入总览',
    rows: overviewRows,
    headers: ['表编号', '业务表', '工作表', '当前数量'],
  });

  for (const config of KNOWLEDGE_IMPORT_TEMPLATES) {
    const schema = getKnowledgeFieldSchema(config.category);
    const rows = assets
      .filter(asset => asset.category === config.category)
      .map(asset => assetToRow(asset, config));
    const headers = ['数据表类型', ...COMMON_COLUMNS, ...schema.fields.map(field => field.label)];
    sheets.push({
      name: config.sheetName,
      rows: rows.length > 0 ? rows : [Object.fromEntries(headers.map(header => [header, '']))],
      headers,
    });
  }

  const dictionaryRows = KNOWLEDGE_IMPORT_TEMPLATES.flatMap(config => (
    getKnowledgeFieldSchema(config.category).fields.map(field => ({
      表编号: config.code,
      业务表: config.businessName,
      字段名称: field.label,
      内部字段: field.name,
      字段类型: field.type || 'text',
      示例: field.placeholder || field.options?.join(' / ') || '',
    }))
  ));
  sheets.push({
    name: '字段字典_原规范',
    rows: dictionaryRows,
    headers: ['表编号', '业务表', '字段名称', '内部字段', '字段类型', '示例'],
  });

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
</Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets>
</workbook>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}
</Relationships>`;

  await writer.add('[Content_Types].xml', new TextReader(contentTypes));
  await writer.add('_rels/.rels', new TextReader(rootRels));
  await writer.add('xl/workbook.xml', new TextReader(workbookXml));
  await writer.add('xl/_rels/workbook.xml.rels', new TextReader(workbookRels));
  for (const [index, sheet] of sheets.entries()) {
    await writer.add(`xl/worksheets/sheet${index + 1}.xml`, new TextReader(buildWorksheetXml(sheet.rows, sheet.headers)));
  }

  const blob = await writer.close();
  downloadBlob(blob, fileName || `knowledge_cloud_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
