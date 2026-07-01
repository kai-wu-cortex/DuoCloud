import type { KnowledgeAsset, PracticeCard } from '../types';
import type { EvidenceSection } from './evidencePages';

type InspectorKind = 'page' | 'settings' | 'data' | 'media' | 'references';

interface InspectorEditors {
  title: boolean;
  content: boolean;
  listItems: boolean;
  mediaUrl: boolean;
  styles: boolean;
}

export interface InspectorDataRow {
  label: string;
  value: string;
}

export interface InspectorMetricRow {
  label: string;
  score: number;
}

export interface EvidenceInspectorModel {
  kind: InspectorKind;
  panelTitle: string;
  sectionLabel: string;
  sectionType?: EvidenceSection['type'];
  editors: InspectorEditors;
  dataRows: InspectorDataRow[];
  metrics: InspectorMetricRow[];
  references: Pick<KnowledgeAsset, 'id' | 'title' | 'category' | 'lastUpdated'>[];
}

const DISABLED_EDITORS: InspectorEditors = {
  title: false,
  content: false,
  listItems: false,
  mediaUrl: false,
  styles: false,
};

const SECTION_LABELS: Record<EvidenceSection['type'], string> = {
  header: 'HEADER BLOCK',
  text: 'TEXT BLOCK',
  process_data: 'PROCESS DATA',
  image: 'IMAGE BLOCK',
  video: 'VIDEO BLOCK',
  metrics_table: 'METRICS TABLE',
  operator_notes: 'NOTES BLOCK',
  knowledge_refs: 'REFERENCE DATA',
};

function textEditors(overrides: Partial<InspectorEditors> = {}): InspectorEditors {
  return {
    title: true,
    content: true,
    listItems: false,
    mediaUrl: false,
    styles: true,
    ...overrides,
  };
}

function processRows(card: PracticeCard): InspectorDataRow[] {
  return [
    { label: '打样目标温度', value: `${card.parameters.temp} ℃` },
    { label: '千分表额定压力', value: `${card.parameters.pressure} kg` },
    { label: '生产联动转速', value: `${card.parameters.speed} /h` },
    { label: '压印停留时间', value: `${card.parameters.dwellTime} s` },
  ];
}

function metricRows(card: PracticeCard): InspectorMetricRow[] {
  return [
    { label: '图案清晰度', score: card.results.clearness },
    { label: '胶带附着力', score: card.results.adhesion },
    { label: '金属光泽度', score: card.results.gloss },
    { label: '耐摩擦等级', score: card.results.abrasion },
  ];
}

export function getEvidenceInspectorModel(
  section: EvidenceSection | null | undefined,
  card: PracticeCard,
  referencedAssets: KnowledgeAsset[],
): EvidenceInspectorModel {
  if (!section) {
    return {
      kind: 'page',
      panelTitle: '页面默认设置',
      sectionLabel: 'PAGE',
      editors: DISABLED_EDITORS,
      dataRows: [
        { label: '报告编号', value: card.evidenceNo },
        { label: '打样 SKU', value: card.sku },
        { label: '打样日期', value: card.testDate },
        { label: '关联知识', value: `${referencedAssets.length} 条` },
      ],
      metrics: [],
      references: [],
    };
  }

  const baseModel: Omit<EvidenceInspectorModel, 'kind' | 'panelTitle' | 'editors'> = {
    sectionType: section.type,
    sectionLabel: SECTION_LABELS[section.type],
    dataRows: [],
    metrics: [],
    references: [],
  };

  switch (section.type) {
    case 'header':
      return {
        ...baseModel,
        kind: 'settings',
        panelTitle: '标题模块设置',
        editors: textEditors(),
      };
    case 'text':
      return {
        ...baseModel,
        kind: 'settings',
        panelTitle: '文本模块设置',
        editors: textEditors(),
      };
    case 'operator_notes':
      return {
        ...baseModel,
        kind: 'settings',
        panelTitle: '评语模块设置',
        editors: textEditors({ styles: false }),
      };
    case 'process_data':
      return {
        ...baseModel,
        kind: 'data',
        panelTitle: '工艺参数数据面板',
        editors: textEditors({ listItems: true }),
        dataRows: processRows(card),
      };
    case 'metrics_table':
      return {
        ...baseModel,
        kind: 'data',
        panelTitle: '物性结果数据面板',
        editors: textEditors({ content: false, styles: false }),
        metrics: metricRows(card),
      };
    case 'image':
      return {
        ...baseModel,
        kind: 'media',
        panelTitle: '图片模块设置',
        editors: textEditors({ mediaUrl: true, styles: false }),
      };
    case 'video':
      return {
        ...baseModel,
        kind: 'media',
        panelTitle: '视频模块设置',
        editors: textEditors({ mediaUrl: true, styles: false }),
        dataRows: [
          { label: '播放进度', value: `${Math.round(section.videoProgress ?? 0)}%` },
          { label: '播放状态', value: section.videoPlaying ? '播放中' : '已暂停' },
        ],
      };
    case 'knowledge_refs':
      return {
        ...baseModel,
        kind: 'references',
        panelTitle: '知识引用数据面板',
        editors: textEditors({ content: false, styles: false }),
        references: referencedAssets.map(asset => ({
          id: asset.id,
          title: asset.title,
          category: asset.category,
          lastUpdated: asset.lastUpdated,
        })),
        dataRows: [
          { label: '关联资产数量', value: `${referencedAssets.length} 条` },
        ],
      };
    default:
      return {
        ...baseModel,
        kind: 'settings',
        panelTitle: '模块设置',
        editors: textEditors(),
      };
  }
}
