import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  BarChart3,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Cloud,
  Copy,
  Database,
  Download,
  Eye,
  FileText,
  Filter,
  FolderCheck,
  Image as ImageIcon,
  ListChecks,
  MessageSquareText,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tags,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { PracticeCard } from '../types';

export type MarketingView =
  | 'overview'
  | 'primary'
  | 'scene'
  | 'compare'
  | 'video'
  | 'report'
  | 'review'
  | 'tags'
  | 'publish'
  | 'questions';

type EvidenceType = '场景证据卡' | '对比图' | '视频' | '报告' | '素材审核' | '发布记录' | '客户问题';
type EvidenceStatus = '草稿' | '待审核' | '已发布' | '已下架';
type Visibility = '可公开' | '脱敏公开' | '仅内部' | '指定客户';
type TrustLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

interface MarketingTrustWorkspaceProps {
  cards: PracticeCard[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  activeView: MarketingView;
  onActiveViewChange: (view: MarketingView) => void;
}

interface EvidenceAsset {
  id: string;
  title: string;
  type: EvidenceType;
  status: EvidenceStatus;
  sourceType: string;
  scene: string;
  industry: string;
  substrate: string;
  surfaceTreatment: string;
  foilModel: string;
  foilColor: string;
  processType: string;
  keyParameters: string;
  equipment: string;
  visualResult: string;
  testResult: string;
  defectResult: string;
  trustLevel: TrustLevel;
  visibility: Visibility;
  realShotFlag: boolean;
  riskBoundary: string;
  forbiddenClaims: string;
  salesScript: string;
  owner: string;
  updatedAt: string;
  tags: string[];
  linkedKnowledgeId?: string;
  extendedFields?: Record<string, string>;
}

interface FieldSpec {
  label: string;
  value: (asset: EvidenceAsset) => string | number | boolean;
  priority?: 'P0' | 'P1';
}

type EvidenceDraftForm = Omit<EvidenceAsset, 'id' | 'updatedAt' | 'tags' | 'linkedKnowledgeId'> & {
  tags: string;
  extendedFields: Record<string, string>;
};

type EvidenceEditForm = Omit<EvidenceDraftForm, 'type' | 'status' | 'trustLevel' | 'visibility' | 'realShotFlag'> & {
  type: '' | EvidenceType;
  status: '' | EvidenceStatus;
  trustLevel: '' | TrustLevel;
  visibility: '' | Visibility;
  realShotFlag: '' | 'true' | 'false';
};

const LOCAL_EVIDENCE_STORAGE_KEY = 'pinte-marketing-trust-local-evidence';
const LOCAL_EVIDENCE_OVERRIDES_STORAGE_KEY = 'pinte-marketing-trust-evidence-overrides';
const LOCAL_PRIMARY_COLUMN_SETTINGS_KEY = 'pinte-marketing-trust-primary-column-settings';

export const MARKETING_TRUST_NAV_ITEMS: Array<{ id: MarketingView; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: '总览', icon: Cloud },
  { id: 'primary', label: '证据主表', icon: Database },
  { id: 'scene', label: '场景证据卡', icon: ClipboardCheck },
  { id: 'compare', label: '对比证据图', icon: ImageIcon },
  { id: 'video', label: '过程短视频', icon: Video },
  { id: 'report', label: '可信报告', icon: FileText },
  { id: 'review', label: '素材审核', icon: ListChecks },
  { id: 'tags', label: '标签体系', icon: Tags },
  { id: 'publish', label: '发布中心', icon: Send },
  { id: 'questions', label: '客户问题库', icon: MessageSquareText },
];

const EVIDENCE_TYPE_OPTIONS: Array<'全部类型' | EvidenceType> = ['全部类型', '场景证据卡', '对比图', '视频', '报告', '素材审核', '发布记录', '客户问题'];
const STATUS_OPTIONS: Array<'全部状态' | EvidenceStatus> = ['全部状态', '草稿', '待审核', '已发布', '已下架'];
const TRUST_OPTIONS: Array<'全部等级' | TrustLevel> = ['全部等级', 'L1', 'L2', 'L3', 'L4', 'L5'];
const VIEW_TYPE_FILTER: Partial<Record<MarketingView, EvidenceType>> = {
  scene: '场景证据卡',
  compare: '对比图',
  video: '视频',
  report: '报告',
  review: '素材审核',
  publish: '发布记录',
  questions: '客户问题',
};
const VIEW_BY_EVIDENCE_TYPE: Record<EvidenceType, MarketingView> = {
  场景证据卡: 'scene',
  对比图: 'compare',
  视频: 'video',
  报告: 'report',
  素材审核: 'review',
  发布记录: 'publish',
  客户问题: 'questions',
};
const PRIMARY_DATA_VIEW_TYPES: Partial<Record<MarketingView, EvidenceType>> = {
  scene: '场景证据卡',
  compare: '对比图',
  video: '视频',
  report: '报告',
};
const ID_PREFIX_BY_EVIDENCE_TYPE: Record<EvidenceType, string> = {
  场景证据卡: 'EV',
  对比图: 'CMP',
  视频: 'VID',
  报告: 'RPT',
  素材审核: 'REV',
  发布记录: 'PUB',
  客户问题: 'FAQ',
};
const REQUIRED_DRAFT_FIELDS: Array<[keyof EvidenceDraftForm, string]> = [
  ['title', '证据标题'],
  ['scene', '客户场景'],
  ['substrate', '使用底材'],
  ['foilModel', '膜型号'],
  ['keyParameters', '关键参数'],
  ['testResult', '测试结果'],
  ['riskBoundary', '风险边界'],
  ['owner', '负责人'],
];

const DEFAULT_DRAFT_FORM: EvidenceDraftForm = {
  title: '',
  type: '场景证据卡',
  status: '草稿',
  sourceType: '内部测试',
  scene: '',
  industry: '',
  substrate: '',
  surfaceTreatment: '',
  foilModel: '',
  foilColor: '',
  processType: '热烫',
  keyParameters: '',
  equipment: '',
  visualResult: '',
  testResult: '',
  defectResult: '待观察',
  trustLevel: 'L2',
  visibility: '仅内部',
  realShotFlag: false,
  riskBoundary: '',
  forbiddenClaims: '不得承诺所有底材 100% 稳定，未测试条件必须先打样。',
  salesScript: '',
  owner: '',
  tags: '',
  extendedFields: {},
};

const EMPTY_EVIDENCE_EDIT_FORM: EvidenceEditForm = {
  title: '',
  type: '',
  status: '',
  sourceType: '',
  scene: '',
  industry: '',
  substrate: '',
  surfaceTreatment: '',
  foilModel: '',
  foilColor: '',
  processType: '',
  keyParameters: '',
  equipment: '',
  visualResult: '',
  testResult: '',
  defectResult: '',
  trustLevel: '',
  visibility: '',
  realShotFlag: '',
  riskBoundary: '',
  forbiddenClaims: '',
  salesScript: '',
  owner: '',
  tags: '',
  extendedFields: {},
};

type DraftFieldKind = 'text' | 'textarea' | 'select' | 'boolean';

interface DraftFieldSpec {
  key: string;
  label: string;
  description: string;
  placeholder?: string;
  kind?: DraftFieldKind;
  options?: string[];
  required?: boolean;
}

interface DraftFieldSection {
  title: string;
  subtitle: string;
  fields: DraftFieldSpec[];
}

const MAIN_TABLE_EXTENSION_SECTIONS: DraftFieldSection[] = [
  {
    title: '证据主表扩展字段',
    subtitle: '覆盖营销可信证据主表中除基础表格字段外的字段。',
    fields: [
      { key: 'linked_knowledge_id', label: '关联知识云规则', description: 'linked_knowledge_id', placeholder: 'K-FOIL-001' },
      { key: 'linked_delivery_chain_id', label: '关联交付可信链', description: 'linked_delivery_chain_id', placeholder: 'DTC-2026-008' },
      { key: 'target_customer_type', label: '适合客户类型', description: 'target_customer_type', placeholder: '包装厂 / 印刷厂 / 礼盒厂 / 标签厂' },
      { key: 'substrate_source', label: '底材来源', description: 'substrate_source', kind: 'select', options: ['客户提供', '工厂采购', '标准测试材料', '未知'] },
      { key: 'foil_series', label: '膜系列', description: 'foil_series', placeholder: 'PN系列 / G系列 / S系列' },
      { key: 'temperature', label: '温度', description: 'temperature', placeholder: '120℃' },
      { key: 'pressure', label: '压力', description: 'pressure', placeholder: '中压 / 3 bar / 50kg' },
      { key: 'speed', label: '速度', description: 'speed', placeholder: '25m/min / 3800印/小时' },
      { key: 'mold_type', label: '模具', description: 'mold_type', placeholder: '铜版 / 锌版 / 硅胶版' },
      { key: 'authenticity_score', label: '真实性感知评分', description: 'authenticity_score', placeholder: '85/100' },
      { key: 'evidence_strength', label: '证据强度', description: 'evidence_strength', kind: 'select', options: ['弱', '中', '强'] },
      { key: 'customer_script_en', label: '英文客户话术', description: 'customer_script_en', kind: 'textarea', placeholder: 'This foil has been tested on similar packaging...' },
      { key: 'recommended_use', label: '推荐使用场景', description: 'recommended_use', placeholder: '询盘回复 / 报价附件 / 详情页 / 展会资料' },
      { key: 'reviewer', label: '审核人', description: 'reviewer', placeholder: '工艺主管 / 销售主管' },
    ],
  },
  {
    title: '场景证据卡字段',
    subtitle: '用于回答客户“有没有做过类似的”。',
    fields: [
      { key: 'card_id', label: '证据卡编号', description: 'card_id', placeholder: 'CARD-2026-001' },
      { key: 'card_title', label: '客户可见标题', description: 'card_title', placeholder: '化妆品盒亮金烫印测试案例' },
      { key: 'card_version', label: '版本', description: 'card_version', placeholder: 'V1.0' },
      { key: 'customer_problem', label: '客户痛点', description: 'customer_problem', kind: 'textarea', placeholder: '要亮金、不掉粉、适合覆膜纸' },
      { key: 'recommended_customer_stage', label: '适用客户阶段', description: 'recommended_customer_stage', placeholder: '询盘 / 打样 / 报价 / 复购' },
      { key: 'recommended_foil', label: '推荐膜', description: 'recommended_foil', placeholder: 'PN-Gold-01' },
      { key: 'alternative_foil', label: '替代膜', description: 'alternative_foil', placeholder: 'PN-Gold-02' },
      { key: 'parameter_summary', label: '参数摘要', description: 'parameter_summary', placeholder: '120℃ / 中压 / 25m/min' },
      { key: 'equipment_summary', label: '设备摘要', description: 'equipment_summary', placeholder: '平压烫金机' },
      { key: 'hero_image', label: '主图', description: 'hero_image', placeholder: '正面效果图 URL / 文件名' },
      { key: 'detail_images', label: '细节图', description: 'detail_images', placeholder: '局部特写、斜角反光图' },
      { key: 'test_images', label: '测试图', description: 'test_images', placeholder: '耐磨前后、胶带测试图' },
      { key: 'result_summary', label: '结论摘要', description: 'result_summary', kind: 'textarea', placeholder: '图案清晰，亮度高，耐磨测试通过' },
      { key: 'key_test_results', label: '关键测试结果', description: 'key_test_results', placeholder: '耐磨200次、附着力5B' },
      { key: 'pass_or_fail', label: '是否通过', description: 'pass_or_fail', kind: 'select', options: ['通过', '条件通过', '不通过'] },
      { key: 'condition_limits', label: '条件限制', description: 'condition_limits', kind: 'textarea', placeholder: '更换覆膜供应商需重新测试' },
      { key: 'must_retest_condition', label: '需要重测条件', description: 'must_retest_condition', placeholder: '换底材 / 换油墨 / 换设备 / 换参数' },
      { key: 'evidence_source', label: '证据来源', description: 'evidence_source', placeholder: '客户打样记录 / 内部测试' },
      { key: 'sales_talking_points', label: '销售沟通要点', description: 'sales_talking_points', kind: 'textarea', placeholder: '可用于类似白卡纸化妆品盒项目' },
      { key: 'customer_next_step', label: '建议客户下一步', description: 'customer_next_step', placeholder: '建议寄实际底材打样确认' },
      { key: 'public_title', label: '对外标题', description: 'public_title', placeholder: 'High Gloss Gold Foil Test on White Cardboard' },
      { key: 'language_version', label: '语言版本', description: 'language_version', kind: 'select', options: ['中文', '英文', '中英双语'] },
      { key: 'export_template', label: '输出模板', description: 'export_template', kind: 'select', options: ['一页卡', 'WhatsApp卡片', 'PDF'] },
    ],
  },
  {
    title: '对比证据图字段',
    subtitle: '用于证明差异，而不是只讲卖点。',
    fields: [
      { key: 'comparison_id', label: '对比图编号', description: 'comparison_id', placeholder: 'CMP-2026-001' },
      { key: 'comparison_title', label: '对比标题', description: 'comparison_title', placeholder: '同一膜在不同底材上的效果差异' },
      { key: 'comparison_type', label: '对比类型', description: 'comparison_type', kind: 'select', options: ['同膜不同底材', '同底材不同膜', '成功失败', '测试前后'] },
      { key: 'object_a_name', label: '对比对象 A', description: 'object_a_name', placeholder: '白卡纸' },
      { key: 'object_a_condition', label: 'A 条件', description: 'object_a_condition', kind: 'textarea', placeholder: 'PN亮金膜，120℃，中压' },
      { key: 'object_a_image', label: 'A 图片', description: 'object_a_image', placeholder: '图片 URL / 文件名' },
      { key: 'object_a_result', label: 'A 结果', description: 'object_a_result', placeholder: '附着稳定，亮度高' },
      { key: 'object_b_name', label: '对比对象 B', description: 'object_b_name', placeholder: 'PP材料' },
      { key: 'object_b_condition', label: 'B 条件', description: 'object_b_condition', kind: 'textarea', placeholder: 'PN亮金膜，120℃，中压' },
      { key: 'object_b_image', label: 'B 图片', description: 'object_b_image', placeholder: '图片 URL / 文件名' },
      { key: 'object_b_result', label: 'B 结果', description: 'object_b_result', placeholder: '附着风险较高，需要专用膜' },
      { key: 'comparison_conclusion', label: '对比结论', description: 'comparison_conclusion', kind: 'textarea', placeholder: '同一膜在不同底材上表现差异明显' },
      { key: 'winning_condition', label: '推荐条件', description: 'winning_condition', placeholder: '白卡纸场景优先推荐 PN系列' },
      { key: 'risk_explanation', label: '风险解释', description: 'risk_explanation', kind: 'textarea', placeholder: 'PP需确认表面能，建议打样' },
      { key: 'shared_parameters', label: '共同参数', description: 'shared_parameters', placeholder: '120℃ / 中压 / 25m/min' },
      { key: 'variable_parameter', label: '变量', description: 'variable_parameter', placeholder: '底材不同' },
      { key: 'linked_evidence_ids', label: '关联证据卡', description: 'linked_evidence_ids', placeholder: 'EV-001, EV-002' },
      { key: 'customer_visible_caption', label: '客户可见说明', description: 'customer_visible_caption', kind: 'textarea', placeholder: '不同底材效果差异明显，建议用实际材料测试' },
      { key: 'technical_review_status', label: '技术审核', description: 'technical_review_status', kind: 'select', options: ['待审', '通过', '驳回'] },
      { key: 'marketing_review_status', label: '营销审核', description: 'marketing_review_status', kind: 'select', options: ['待审', '通过', '驳回'] },
    ],
  },
  {
    title: '过程短视频字段',
    subtitle: '用于证明现场真实过程和可见参数。',
    fields: [
      { key: 'video_id', label: '视频编号', description: 'video_id', placeholder: 'VID-2026-001' },
      { key: 'video_title', label: '视频标题', description: 'video_title', placeholder: 'PN亮金膜白卡纸烫印测试过程' },
      { key: 'video_type', label: '视频类型', description: 'video_type', kind: 'select', options: ['打样过程', '测试过程', '量产过程', '缺陷复盘'] },
      { key: 'video_duration', label: '视频时长', description: 'video_duration', placeholder: '23秒' },
      { key: 'video_status', label: '视频状态', description: 'video_status', kind: 'select', options: ['待剪辑', '待审核', '已发布', '已下架'] },
      { key: 'raw_video_file', label: '原始视频', description: 'raw_video_file', placeholder: '上传文件 URL / 文件名' },
      { key: 'edited_video_file', label: '剪辑后视频', description: 'edited_video_file', placeholder: '上传文件 URL / 文件名' },
      { key: 'thumbnail', label: '封面图', description: 'thumbnail', placeholder: '封面图 URL / 文件名' },
      { key: 'show_substrate', label: '是否展示底材', description: 'show_substrate', kind: 'boolean' },
      { key: 'show_foil', label: '是否展示膜材', description: 'show_foil', kind: 'boolean' },
      { key: 'show_machine', label: '是否展示设备', description: 'show_machine', kind: 'boolean' },
      { key: 'show_process', label: '是否展示烫印过程', description: 'show_process', kind: 'boolean' },
      { key: 'show_detail_result', label: '是否展示局部效果', description: 'show_detail_result', kind: 'boolean' },
      { key: 'show_test_action', label: '是否展示测试动作', description: 'show_test_action', kind: 'boolean' },
      { key: 'show_conclusion_subtitle', label: '是否展示结论字幕', description: 'show_conclusion_subtitle', kind: 'boolean' },
      { key: 'visible_parameters', label: '视频中展示参数', description: 'visible_parameters', placeholder: '120℃ / 中压 / 25m/min' },
      { key: 'shooting_location', label: '拍摄地点', description: 'shooting_location', kind: 'select', options: ['打样室', '生产车间', '质检台', '客户现场'] },
      { key: 'shooting_date', label: '拍摄时间', description: 'shooting_date', placeholder: '2026-07-06' },
      { key: 'operator_visible', label: '是否展示操作人员', description: 'operator_visible', kind: 'select', options: ['是', '否', '打码'] },
      { key: 'recommended_channel', label: '推荐发布渠道', description: 'recommended_channel', placeholder: 'WhatsApp / 国际站 / 官网 / 邮件' },
      { key: 'customer_script', label: '搭配客户话术', description: 'customer_script', kind: 'textarea', placeholder: '这是我们用类似底材做的实际测试过程' },
      { key: 'privacy_review', label: '隐私审核', description: 'privacy_review', kind: 'select', options: ['通过', '需打码'] },
      { key: 'technical_review', label: '技术审核', description: 'technical_review', kind: 'select', options: ['通过', '驳回', '待审'] },
    ],
  },
];

const TABLE_BLUEPRINTS = [
  ['营销可信证据主表', '所有图片、视频、报告先挂到证据资产主表', 'evidence_id / evidence_type / trust_level / risk_boundary'],
  ['场景证据卡表', '回答客户“有没有做过类似的”', '场景 / 底材 / 膜型号 / 参数 / 实拍图 / 测试结果'],
  ['对比证据图表', '让客户自己看差异', '对象A/B / 变量 / 共同参数 / 对比结论 / 风险解释'],
  ['过程短视频表', '证明这是不是现场真实做出来的', '原始视频 / 过程结构 / 可见参数 / 结论字幕'],
  ['可信报告表', '把证据资产组合成客户看得懂的材料', '客户需求 / 推荐方案 / 证据卡 / 风险边界'],
  ['营销素材审核表', '防止图片好看但不真实、话术漂亮但过度承诺', '实拍审核 / 技术审核 / 风险边界 / 禁止承诺'],
  ['营销可信标签表', '决定销售能不能快速找到正确证据', '行业 / 底材 / 效果 / 工艺 / 风险 / 客户阶段'],
  ['发布记录表', '沉淀国际站、官网、邮件、WhatsApp 调用闭环', '渠道 / 格式 / 语言 / 链接 / 浏览询盘'],
  ['客户问题库表', '根据客户真实问题推荐证据和话术', '原话 / 问题类型 / 标准回答 / 推荐证据'],
  ['营销可信指标表', '总览页的指标口径', '完整度 / 实拍占比 / 调用次数 / 转化率'],
] as const;

const PRIMARY_FIELDS: FieldSpec[] = [
  { label: '证据编号', value: asset => asset.id, priority: 'P0' },
  { label: '证据标题', value: asset => asset.title, priority: 'P0' },
  { label: '证据类型', value: asset => asset.type, priority: 'P0' },
  { label: '状态', value: asset => asset.status, priority: 'P0' },
  { label: '来源', value: asset => asset.sourceType, priority: 'P0' },
  { label: '客户场景', value: asset => asset.scene, priority: 'P0' },
  { label: '底材', value: asset => asset.substrate, priority: 'P0' },
  { label: '膜型号', value: asset => asset.foilModel, priority: 'P0' },
  { label: '关键参数', value: asset => asset.keyParameters, priority: 'P0' },
  { label: '测试结果', value: asset => asset.testResult, priority: 'P0' },
  { label: '风险边界', value: asset => asset.riskBoundary, priority: 'P0' },
  { label: '可信等级', value: asset => asset.trustLevel, priority: 'P0' },
  { label: '可见范围', value: asset => asset.visibility, priority: 'P0' },
  { label: '是否实拍', value: asset => asset.realShotFlag ? '是' : '待补', priority: 'P0' },
  { label: '销售话术', value: asset => asset.salesScript, priority: 'P1' },
];

const CORE_FIELDS = ['是否实拍', '使用底材', '关键参数', '风险边界', '可信等级'] as const;

type PrimaryColumnKey = string;

interface PrimaryColumnDef {
  key: PrimaryColumnKey;
  label: string;
  group: string;
  defaultWidth: number;
  render: (record: EvidenceAsset, compact: boolean) => React.ReactNode;
}

interface PrimaryColumnSetting {
  key: PrimaryColumnKey;
  visible: boolean;
  width: number;
}

const CORE_PRIMARY_TABLE_COLUMNS: PrimaryColumnDef[] = [
  {
    key: 'evidence',
    label: '证据',
    group: '证据主表核心字段',
    defaultWidth: 290,
    render: record => (
      <div>
        <p className="font-black text-[#071a41]">{record.title}</p>
        <p className="mt-0.5 font-bold text-slate-400">{record.id} · {record.sourceType}</p>
      </div>
    ),
  },
  {
    key: 'type',
    label: '类型',
    group: '证据主表核心字段',
    defaultWidth: 96,
    render: record => <span className="rounded-full bg-slate-100 px-2 py-1 font-black text-slate-600">{record.type}</span>,
  },
  {
    key: 'substrate',
    label: '底材/膜',
    group: '证据主表核心字段',
    defaultWidth: 190,
    render: record => <>{record.substrate}<br /><span className="text-slate-400">{record.foilModel}</span></>,
  },
  {
    key: 'params',
    label: '参数',
    group: '证据主表核心字段',
    defaultWidth: 210,
    render: record => record.keyParameters,
  },
  {
    key: 'real',
    label: '真实',
    group: '证据主表核心字段',
    defaultWidth: 70,
    render: record => record.realShotFlag ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />,
  },
  {
    key: 'risk',
    label: '风险',
    group: '证据主表核心字段',
    defaultWidth: 310,
    render: (record, compact) => compact ? `${completeness(record)}%` : record.riskBoundary,
  },
  {
    key: 'level',
    label: '等级',
    group: '证据主表核心字段',
    defaultWidth: 90,
    render: record => <span className={`rounded-full border px-2 py-1 font-black ${toneForTrust(record.trustLevel)}`}>{record.trustLevel}</span>,
  },
  {
    key: 'status',
    label: '状态',
    group: '证据主表核心字段',
    defaultWidth: 100,
    render: record => <span className={`rounded-full px-2 py-1 font-black ${statusTone(record.status)}`}>{record.status}</span>,
  },
];

const buildExtendedPrimaryTableColumns = (previewRegistry: Record<string, AttachmentPreview> = {}): PrimaryColumnDef[] => MAIN_TABLE_EXTENSION_SECTIONS.flatMap(section =>
  section.fields.map(field => ({
    key: `extended:${field.key}`,
    label: field.label,
    group: section.title,
    defaultWidth: isAttachmentField(field) ? 220 : field.kind === 'textarea' ? 260 : field.kind === 'boolean' ? 120 : 180,
    render: record => {
      const value = record.extendedFields?.[field.key] || '';
      if (!value) return '—';
      if (isAttachmentField(field)) {
        return <AttachmentPreviewStrip value={value} previewRegistry={previewRegistry} compact />;
      }
      return value;
    },
  }))
);

const buildPrimaryTableColumns = (previewRegistry: Record<string, AttachmentPreview> = {}): PrimaryColumnDef[] => [
  ...CORE_PRIMARY_TABLE_COLUMNS,
  ...buildExtendedPrimaryTableColumns(previewRegistry),
];

const PRIMARY_TABLE_COLUMNS: PrimaryColumnDef[] = buildPrimaryTableColumns();

const DEFAULT_PRIMARY_COLUMN_SETTINGS: PrimaryColumnSetting[] = PRIMARY_TABLE_COLUMNS.map(column => ({
  key: column.key,
  visible: CORE_PRIMARY_TABLE_COLUMNS.some(coreColumn => coreColumn.key === column.key),
  width: column.defaultWidth,
}));

function normalizePrimaryColumnSettings(value: unknown): PrimaryColumnSetting[] {
  const saved = Array.isArray(value) ? value : [];
  const defaultsByKey = new Map(DEFAULT_PRIMARY_COLUMN_SETTINGS.map(setting => [setting.key, setting]));
  const usedKeys = new Set<PrimaryColumnKey>();
  const normalized: PrimaryColumnSetting[] = [];

  saved.forEach(item => {
    if (!item || typeof item !== 'object') return;
    const candidate = item as Partial<PrimaryColumnSetting>;
    if (typeof candidate.key !== 'string' || usedKeys.has(candidate.key)) return;
    const defaultSetting = defaultsByKey.get(candidate.key);
    if (!defaultSetting) return;
    usedKeys.add(candidate.key);
    normalized.push({
      key: candidate.key,
      visible: typeof candidate.visible === 'boolean' ? candidate.visible : defaultSetting.visible,
      width: clampColumnWidth(candidate.key, typeof candidate.width === 'number' ? candidate.width : defaultSetting.width),
    });
  });

  DEFAULT_PRIMARY_COLUMN_SETTINGS.forEach(defaultSetting => {
    if (!usedKeys.has(defaultSetting.key)) normalized.push(defaultSetting);
  });

  return normalized;
}

function readPrimaryColumnSettings(): PrimaryColumnSetting[] {
  if (typeof window === 'undefined') return DEFAULT_PRIMARY_COLUMN_SETTINGS;
  try {
    if (!('localStorage' in window) || !window.localStorage) return DEFAULT_PRIMARY_COLUMN_SETTINGS;
    return normalizePrimaryColumnSettings(JSON.parse(window.localStorage.getItem(LOCAL_PRIMARY_COLUMN_SETTINGS_KEY) || '[]'));
  } catch {
    return DEFAULT_PRIMARY_COLUMN_SETTINGS;
  }
}

function primaryColumnWidthBounds(key: PrimaryColumnKey) {
  if (key.startsWith('extended:')) return { min: 120, max: 420 };
  if (key === 'real') return { min: 60, max: 120 };
  if (key === 'risk') return { min: 160, max: 460 };
  if (key === 'evidence') return { min: 180, max: 520 };
  return { min: 80, max: 360 };
}

function clampColumnWidth(key: PrimaryColumnKey, width: number) {
  const { min, max } = primaryColumnWidthBounds(key);
  return Math.max(min, Math.min(max, width));
}

function isAttachmentField(field: DraftFieldSpec) {
  return /(image|images|video_file|raw_video|edited_video|thumbnail|file|attachment|photo)/i.test(field.key);
}

function splitAttachmentValue(value: string) {
  return value
    .split(/\n|,|，|;/)
    .map(item => item.trim())
    .filter(Boolean);
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

type AttachmentPreviewKind = 'image' | 'video' | 'pdf' | 'file';

interface AttachmentPreview {
  src?: string;
  kind: AttachmentPreviewKind;
  label: string;
  meta?: string;
  objectUrl?: boolean;
}

interface AttachmentPreviewRegistration {
  items: string[];
  previews: Record<string, AttachmentPreview>;
}

function stripAttachmentMeta(value: string) {
  return value.trim().replace(/\s+\([^)]*\)\s*$/, '');
}

function getAttachmentKind(value: string, mimeType = ''): AttachmentPreviewKind {
  const lowerValue = stripAttachmentMeta(value).toLowerCase();
  const lowerMime = mimeType.toLowerCase();
  if (lowerMime.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|avif|bmp)(\?.*)?$/i.test(lowerValue)) return 'image';
  if (lowerMime.startsWith('video/') || /\.(mp4|webm|mov|m4v|avi|mkv)(\?.*)?$/i.test(lowerValue)) return 'video';
  if (lowerMime === 'application/pdf' || /\.pdf(\?.*)?$/i.test(lowerValue)) return 'pdf';
  return 'file';
}

function getAttachmentLabel(value: string) {
  const cleanValue = stripAttachmentMeta(value).split(/[?#]/)[0].trim();
  try {
    const url = new URL(cleanValue);
    return decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) || url.hostname);
  } catch {
    return cleanValue.split(/[\\/]/).filter(Boolean).at(-1) || cleanValue;
  }
}

function isOpenableAttachment(value: string) {
  return /^(https?:\/\/|blob:|data:|\/)/i.test(stripAttachmentMeta(value));
}

function buildExternalAttachmentPreview(item: string): AttachmentPreview {
  const src = stripAttachmentMeta(item);
  const openable = isOpenableAttachment(src);
  return {
    src: openable ? src : undefined,
    kind: getAttachmentKind(src),
    label: getAttachmentLabel(src),
    meta: openable ? '外部链接' : '本地文件名',
  };
}

function buildFilePreviewRegistration(files: File[], trackObjectUrl?: (url: string) => void): AttachmentPreviewRegistration {
  const previews: Record<string, AttachmentPreview> = {};
  const items = files.map(file => {
    const token = `${file.name} (${formatFileSize(file.size)})`;
    const url = URL.createObjectURL(file);
    trackObjectUrl?.(url);
    previews[token] = {
      src: url,
      kind: getAttachmentKind(file.name, file.type),
      label: file.name,
      meta: `${file.type || '附件'} · ${formatFileSize(file.size)}`,
      objectUrl: true,
    };
    return token;
  });
  return { items, previews };
}

function resolveAttachmentPreview(item: string, previewRegistry: Record<string, AttachmentPreview> = {}) {
  return previewRegistry[item] || previewRegistry[stripAttachmentMeta(item)] || buildExternalAttachmentPreview(item);
}

function firstExtendedFieldValue(record: EvidenceAsset, keys: string[]) {
  for (const key of keys) {
    const value = record.extendedFields?.[key];
    if (value && String(value).trim()) return value;
  }
  return '';
}

function AttachmentPreviewStrip({
  value,
  previewRegistry = {},
  compact = false,
}: {
  value: string;
  previewRegistry?: Record<string, AttachmentPreview>;
  compact?: boolean;
}) {
  const items = splitAttachmentValue(value);
  if (!items.length) return <span>—</span>;
  const previews = items.map(item => resolveAttachmentPreview(item, previewRegistry));
  const first = previews[0];
  const media = (
    <div className={`${compact ? 'h-14 w-20' : 'h-24 w-36'} overflow-hidden rounded-lg border border-slate-200 bg-slate-100`}>
      {first.kind === 'image' && first.src ? (
        <img src={first.src} alt={first.label} className="h-full w-full object-cover" />
      ) : first.kind === 'video' && first.src ? (
        <video src={first.src} className="h-full w-full bg-black object-cover" muted playsInline />
      ) : first.kind === 'pdf' && first.src ? (
        <iframe src={first.src} title={first.label} className="h-full w-full bg-white" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-blue-600">
          {first.kind === 'video' ? <Video className="h-5 w-5" /> : first.kind === 'image' ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
        </div>
      )}
    </div>
  );

  return (
    <div className={`flex min-w-0 items-center ${compact ? 'gap-2' : 'gap-3'}`}>
      {media}
      <div className="min-w-0">
        <p className="truncate font-black text-[#071a41]">{first.label}</p>
        <p className="truncate text-[11px] font-bold text-slate-400">
          {first.kind === 'image' ? '图片预览' : first.kind === 'video' ? '视频预览' : first.kind === 'pdf' ? 'PDF 预览' : '附件预览'}
          {items.length > 1 ? ` · +${items.length - 1}` : ''}
        </p>
      </div>
    </div>
  );
}

const SALES_INTENT_KEYWORDS = [
  '化妆品盒',
  '酒盒',
  '礼盒',
  '标签',
  '皮革',
  '织物',
  '白卡纸',
  '黑卡纸',
  '特种纸',
  'PP',
  'PVC',
  'PET',
  '亮金',
  '哑金',
  '镭射',
  '附着',
  '掉粉',
  '掉色',
  '耐磨',
  '实拍',
  '参数',
  '风险',
  '报价',
  '客户可发',
  '公开',
];

function toTrustLevel(level: PracticeCard['recommendLevel']): TrustLevel {
  if (level === 'high') return 'L4';
  if (level === 'medium') return 'L3';
  return 'L2';
}

function buildEvidenceFromCard(card: PracticeCard): EvidenceAsset {
  const status: EvidenceStatus = card.recommendLevel === 'high' ? '已发布' : card.recommendLevel === 'medium' ? '待审核' : '草稿';
  const visibility: Visibility = card.recommendLevel === 'high' ? '脱敏公开' : '仅内部';
  return {
    id: card.evidenceNo,
    title: `${card.sku} ${card.substrate} 测试证据`,
    type: '场景证据卡',
    status,
    sourceType: '内部测试',
    scene: /盒|卡纸|纸/.test(card.substrate) ? '包装盒 / 纸张' : /皮革|织物|帆布/.test(card.substrate) ? '皮革织物' : '材料打样',
    industry: /化妆|盒/.test(card.substrate) ? '化妆品包装' : '包装印刷',
    substrate: card.substrate,
    surfaceTreatment: card.inkType || '待补充',
    foilModel: card.sku,
    foilColor: card.color,
    processType: card.processType,
    keyParameters: `${card.parameters.temp}℃ / ${card.parameters.pressure}kg / ${card.parameters.speed}印/小时`,
    equipment: card.machineModel,
    visualResult: card.results.defectNotes || '视觉效果待补充',
    testResult: `清晰度${card.results.clearness}★，亮度${card.results.gloss}★，附着${card.results.adhesion}★，耐磨${card.results.abrasion}★`,
    defectResult: card.results.defectNotes || '无明显缺陷',
    trustLevel: toTrustLevel(card.recommendLevel),
    visibility,
    realShotFlag: Boolean(card.results.photoUrl),
    riskBoundary: card.riskNotes || '换底材、换覆膜、换油墨、换设备需重新测试',
    forbiddenClaims: '不得承诺所有底材 100% 不掉色，未测试材料必须先打样。',
    salesScript: `这款膜已有 ${card.substrate} 的测试记录，参数为 ${card.parameters.temp}℃ / ${card.parameters.pressure}kg，建议客户寄实际底材复核。`,
    owner: card.operator,
    updatedAt: card.testDate,
    tags: [card.sku, card.series, card.color, card.processType, card.recommendLevel === 'high' ? '客户可发' : '内部复核'],
    linkedKnowledgeId: card.relatedKnowledgeAssetIds?.[0],
  };
}

const MARKETING_TRUST_EVIDENCE_ASSETS: EvidenceAsset[] = [
  {
    id: 'EV-MKT-2026-001',
    title: '化妆品盒亮金烫印实拍证据卡',
    type: '场景证据卡',
    status: '已发布',
    sourceType: '营销可信证据库',
    scene: '化妆品盒',
    industry: '化妆品包装',
    substrate: '250g 白卡纸 + 哑膜',
    surfaceTreatment: '哑膜覆膜',
    foilModel: 'KJ-302G',
    foilColor: '亮金',
    processType: '平压平热烫',
    keyParameters: '120℃ / 2.0 bar / 25m/min',
    equipment: '平压平烫金机',
    visualResult: '金属亮度高，边缘清晰，盒面大面积区域无明显飞金。',
    testResult: '胶带附着测试通过，耐磨 200 次无明显掉色。',
    defectResult: '无明显缺陷',
    trustLevel: 'L3',
    visibility: '脱敏公开',
    realShotFlag: true,
    riskBoundary: '客户更换覆膜、UV 底油或大面积满版图案时需重新打样确认。',
    forbiddenClaims: '不得承诺所有白卡纸和所有覆膜供应商均可直接量产。',
    salesScript: '这是同类化妆品白卡盒上的实拍测试证据，可用于说明亮金效果、附着力和参数窗口。',
    owner: '营销可信运营',
    updatedAt: '2026-07-06',
    tags: ['化妆品盒', '白卡纸', '亮金', '实拍优先', '客户可发', '附着力'],
    linkedKnowledgeId: 'K-FOIL-PAPER-001',
  },
  {
    id: 'CMP-MKT-2026-001',
    title: '白卡纸 / PP / PVC 烫印效果对比证据图',
    type: '对比图',
    status: '待审核',
    sourceType: '打样室证据归档',
    scene: '同膜不同底材',
    industry: '包装印刷',
    substrate: '白卡纸 / PP / PVC',
    surfaceTreatment: '覆膜 / 电晕 / 透明片',
    foilModel: 'PN-Gold-01',
    foilColor: '亮金',
    processType: '热烫',
    keyParameters: '120℃ / 中压 / 25m/min',
    equipment: '标准打样机',
    visualResult: '白卡纸亮度和附着稳定，PP/PVC 对表面处理敏感。',
    testResult: '同一膜在不同底材上的附着和边缘清晰度差异明显。',
    defectResult: 'PP 未处理区域边缘翘起',
    trustLevel: 'L3',
    visibility: '脱敏公开',
    realShotFlag: true,
    riskBoundary: '塑料底材必须确认表面能和处理方式，不能直接沿用纸张参数。',
    forbiddenClaims: '不得对未处理 PP/PVC 承诺稳定附着。',
    salesScript: '不同底材效果差异明显，建议使用客户实际材料做确认测试。',
    owner: '工艺审核',
    updatedAt: '2026-07-06',
    tags: ['对比图', '同膜不同底材', '白卡纸', 'PP', 'PVC', '风险边界'],
    linkedKnowledgeId: 'K-COMPAT-PP-001',
  },
  {
    id: 'VID-MKT-2026-001',
    title: '化妆品盒亮金烫印过程短视频',
    type: '视频',
    status: '已发布',
    sourceType: '现场实拍视频',
    scene: '化妆品盒',
    industry: '化妆品包装',
    substrate: '白卡纸盒面',
    surfaceTreatment: '覆哑膜',
    foilModel: 'KJ-302G',
    foilColor: '亮金',
    processType: '平压平热烫',
    keyParameters: '120℃ / 2.0 bar / 25m/min',
    equipment: '打样机',
    visualResult: '视频展示底材、膜材、设备动作和局部反光效果。',
    testResult: '过程真实可复核，结论字幕标注耐磨和附着结果。',
    defectResult: '未见明显飞金',
    trustLevel: 'L3',
    visibility: '可公开',
    realShotFlag: true,
    riskBoundary: '公开视频只适用于同类纸盒场景，不代表全部底材通用。',
    forbiddenClaims: '视频不得剪掉失败片段后宣称零风险。',
    salesScript: '客户如质疑是否实拍，可发送该过程短视频说明真实测试过程。',
    owner: '市场部视频',
    updatedAt: '2026-07-06',
    tags: ['过程短视频', '实拍', '化妆品盒', '参数可见', '客户可发'],
    linkedKnowledgeId: 'K-PROCESS-FOIL-001',
  },
  {
    id: 'RPT-MKT-2026-001',
    title: '高性能耐磨涂层客户版可信报告',
    type: '报告',
    status: '已发布',
    sourceType: '报告生成中心',
    scene: '高耐磨包装',
    industry: '礼盒包装',
    substrate: '特种纸 + 哑膜',
    surfaceTreatment: '哑膜覆膜',
    foilModel: 'TC-9800',
    foilColor: '哑银',
    processType: '热烫',
    keyParameters: '118℃ / 中压 / 22m/min',
    equipment: '量产线标准机',
    visualResult: '报告包含客户需求、推荐方案、实拍图、关键参数和风险提示。',
    testResult: '耐磨、附着和耐化学测试通过，适合作为客户推进材料。',
    defectResult: '未见明显掉色',
    trustLevel: 'L4',
    visibility: '指定客户',
    realShotFlag: true,
    riskBoundary: '客户实际底材批次、油墨和覆膜不同，需要以打样结果为最终依据。',
    forbiddenClaims: '不得将报告结论外推到未验证客户材料。',
    salesScript: '这份报告可用于重点客户沟通，重点强调测试条件、实拍结果和下一步寄样确认。',
    owner: '营销可信运营',
    updatedAt: '2026-07-06',
    tags: ['可信报告', '客户版', '耐磨', '重点客户', '可追溯'],
    linkedKnowledgeId: 'K-REPORT-TEMPLATE-001',
  },
  {
    id: 'REV-MKT-2026-001',
    title: '客户案例图文发布前真实性审核',
    type: '素材审核',
    status: '待审核',
    sourceType: '发布前审核',
    scene: '官网详情页',
    industry: '包装印刷',
    substrate: '客户脱敏样张',
    surfaceTreatment: '覆膜',
    foilModel: 'K 系列',
    foilColor: '金色',
    processType: '热烫',
    keyParameters: '参数需补充到图片说明',
    equipment: '待补设备',
    visualResult: '图片清晰，但参数、底材来源和客户脱敏信息需要复核。',
    testResult: '待补测试结果',
    defectResult: '未标注缺陷',
    trustLevel: 'L2',
    visibility: '仅内部',
    realShotFlag: true,
    riskBoundary: '未补齐参数前不得对外发布。',
    forbiddenClaims: '不得使用“永久不掉色”“所有底材通用”等绝对表述。',
    salesScript: '审核通过后可转为官网或国际站素材。',
    owner: '素材审核',
    updatedAt: '2026-07-06',
    tags: ['素材审核', '脱敏', '参数缺失', '发布前'],
  },
  {
    id: 'PUB-MKT-2026-001',
    title: '国际站详情页可信证据发布记录',
    type: '发布记录',
    status: '已发布',
    sourceType: '发布中心',
    scene: '阿里巴巴国际站',
    industry: '外贸获客',
    substrate: '白卡纸 / 特种纸',
    surfaceTreatment: '覆膜 / UV',
    foilModel: 'K 系列 / TC 系列',
    foilColor: '金色 / 银色',
    processType: '热烫',
    keyParameters: '120℃ / 中压 / 25m/min',
    equipment: '标准热烫设备',
    visualResult: '已发布证据卡、对比图和短视频，用于详情页增强可信度。',
    testResult: '发布后询盘引用率提升，客户更关注实拍和参数。',
    defectResult: '无',
    trustLevel: 'L3',
    visibility: '可公开',
    realShotFlag: true,
    riskBoundary: '详情页引用必须保留风险边界和推荐打样说明。',
    forbiddenClaims: '不得删去“以实际打样为准”的限制说明。',
    salesScript: '详情页已可引用该组证据，销售回复时可直接发送公开链接。',
    owner: '外贸运营',
    updatedAt: '2026-07-06',
    tags: ['发布中心', '国际站', '详情页', '公开', '销售调用'],
  },
  {
    id: 'FAQ-MKT-2026-001',
    title: '客户问：这个是不是实拍？',
    type: '客户问题',
    status: '已发布',
    sourceType: '客户问题库',
    scene: '询盘回复',
    industry: '外贸销售',
    substrate: '客户待确认底材',
    surfaceTreatment: '待客户确认',
    foilModel: '待匹配产品',
    foilColor: '按客户效果匹配',
    processType: '待匹配工艺',
    keyParameters: '根据证据卡引用真实参数',
    equipment: '按证据卡记录',
    visualResult: '标准回答要求先确认实拍来源，再补充参数和风险边界。',
    testResult: '必须引用已审核证据，不得用知识库话术代替证据。',
    defectResult: '无',
    trustLevel: 'L3',
    visibility: '脱敏公开',
    realShotFlag: false,
    riskBoundary: '只有关联到实拍证据、参数、底材和测试结果后才能对外承诺。',
    forbiddenClaims: '不得仅凭产品知识回答“已实拍验证”。',
    salesScript: '是实拍测试素材。我们可以同步提供测试底材、膜型号、关键参数和风险边界，最终仍建议用你的实际底材确认。',
    owner: '销售运营',
    updatedAt: '2026-07-06',
    tags: ['客户问题', '实拍', '标准回答', '销售话术'],
  },
];

function readLocalEvidenceAssets(): EvidenceAsset[] {
  if (typeof window === 'undefined') return [];
  try {
    if (!('localStorage' in window) || !window.localStorage) return [];
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_EVIDENCE_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is EvidenceAsset => {
      if (!item || typeof item !== 'object') return false;
      const candidate = item as Partial<EvidenceAsset>;
      return typeof candidate.id === 'string'
        && typeof candidate.title === 'string'
        && typeof candidate.type === 'string'
        && typeof candidate.riskBoundary === 'string';
    });
  } catch {
    return [];
  }
}

function readEvidenceOverrides(): Record<string, Partial<EvidenceAsset>> {
  if (typeof window === 'undefined') return {};
  try {
    if (!('localStorage' in window) || !window.localStorage) return {};
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_EVIDENCE_OVERRIDES_STORAGE_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, Partial<EvidenceAsset>>;
  } catch {
    return {};
  }
}

function formatDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function draftTagsToArray(tags: string) {
  return tags
    .split(/[,\s，、]+/)
    .map(tag => tag.trim())
    .filter(Boolean)
    .slice(0, 16);
}

function trustScore(level: TrustLevel) {
  return Number(level.replace('L', '')) || 1;
}

function visibilityScore(visibility: Visibility) {
  if (visibility === '可公开') return 10;
  if (visibility === '脱敏公开') return 8;
  if (visibility === '指定客户') return 5;
  return 1;
}

function searchableText(asset: EvidenceAsset) {
  return [
    asset.id,
    asset.title,
    asset.type,
    asset.sourceType,
    asset.scene,
    asset.industry,
    asset.substrate,
    asset.surfaceTreatment,
    asset.foilModel,
    asset.foilColor,
    asset.processType,
    asset.keyParameters,
    asset.visualResult,
    asset.testResult,
    asset.defectResult,
    asset.riskBoundary,
    asset.salesScript,
    asset.tags.join(' '),
    ...Object.values(asset.extendedFields || {}),
  ].join(' ').toLowerCase();
}

function extractSalesKeywords(input: string, records: EvidenceAsset[]) {
  const text = input.toLowerCase();
  const recordKeywords = records.flatMap(record => [
    record.scene,
    record.industry,
    record.substrate,
    record.foilModel,
    record.foilColor,
    record.processType,
    ...record.tags,
  ]);
  return Array.from(new Set([...SALES_INTENT_KEYWORDS, ...recordKeywords]
    .map(keyword => keyword.trim())
    .filter(keyword => keyword.length >= 2)
    .filter(keyword => text.includes(keyword.toLowerCase()))))
    .slice(0, 14);
}

function scoreEvidenceForNeed(asset: EvidenceAsset, input: string, keywords: string[]) {
  const text = input.toLowerCase();
  const haystack = searchableText(asset);
  const typeWeight = asset.type === '场景证据卡'
    ? 12
    : asset.type === '对比图' || asset.type === '视频' || asset.type === '报告'
      ? 8
      : 3;
  const keywordScore = keywords.reduce((score, keyword) => {
    const token = keyword.toLowerCase();
    if (!token) return score;
    let next = score;
    if (asset.scene.toLowerCase().includes(token)) next += 12;
    if (asset.substrate.toLowerCase().includes(token)) next += 11;
    if (asset.foilModel.toLowerCase().includes(token) || asset.foilColor.toLowerCase().includes(token)) next += 9;
    if (asset.tags.some(tag => tag.toLowerCase().includes(token))) next += 7;
    if (haystack.includes(token)) next += 4;
    return next;
  }, 0);
  const textScore = text
    ? [
      asset.scene,
      asset.substrate,
      asset.foilModel,
      asset.foilColor,
      asset.processType,
    ].reduce((score, field) => score + (field && text.includes(field.toLowerCase()) ? 6 : 0), 0)
    : 0;
  return keywordScore
    + textScore
    + typeWeight
    + trustScore(asset.trustLevel) * 4
    + visibilityScore(asset.visibility)
    + (asset.realShotFlag ? 8 : 0)
    + (asset.status === '已发布' ? 6 : asset.status === '待审核' ? 1 : 0);
}

function rankEvidenceForNeed(input: string, records: EvidenceAsset[]) {
  const keywords = extractSalesKeywords(input, records);
  return records
    .map(record => ({ record, score: scoreEvidenceForNeed(record, input, keywords) }))
    .sort((a, b) => b.score - a.score || trustScore(b.record.trustLevel) - trustScore(a.record.trustLevel));
}

function buildCustomerReply(input: string, recommendations: Array<{ record: EvidenceAsset; score: number }>) {
  const primary = recommendations[0]?.record;
  const support = recommendations.slice(1, 4).map(item => item.record);
  if (!primary) {
    return '暂未匹配到可用证据。请先补充客户场景、底材、膜型号、关键参数和风险边界后再回复客户。';
  }
  const supportLine = support.length
    ? `可同步补充 ${support.map(item => item.type).join('、')} 作为辅助材料。`
    : '当前建议先使用这一条证据，不额外扩展未审核材料。';
  return [
    `根据你提供的需求「${input.trim() || '客户待确认场景'}」，我们已有一条相近的可信证据：${primary.title}。`,
    `这条证据基于 ${primary.substrate}，使用 ${primary.foilModel}，关键参数为 ${primary.keyParameters}，测试结论是：${primary.testResult}`,
    `可对客户说明：${primary.salesScript}`,
    `风险边界需要同步说明：${primary.riskBoundary}`,
    supportLine,
    '最终仍建议客户寄实际底材打样确认，避免把现有证据外推到未验证材料或未验证参数。',
  ].join('\n');
}

function uniqueValues(values: string[], limit = 4) {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean))).slice(0, limit);
}

function strongestTrustLevel(records: EvidenceAsset[]): TrustLevel {
  return records.reduce<TrustLevel>((strongest, record) => (
    trustScore(record.trustLevel) > trustScore(strongest) ? record.trustLevel : strongest
  ), 'L1');
}

function summarizeRecommendedSolution(records: EvidenceAsset[]) {
  const primary = records[0];
  if (!primary) return '请先选择证据资产，系统会基于底材、膜型号、参数和风险边界生成推荐方案。';
  const foils = uniqueValues(records.map(record => record.foilModel), 3).join(' / ');
  const processTypes = uniqueValues(records.map(record => record.processType), 2).join(' / ');
  const substrates = uniqueValues(records.map(record => record.substrate), 2).join('、');
  return `${foils || primary.foilModel} + ${processTypes || primary.processType}；适用底材：${substrates || primary.substrate}。先用已验证参数沟通，再以客户实际底材打样确认。`;
}

function completeness(asset: EvidenceAsset) {
  const checks = [
    asset.realShotFlag,
    asset.substrate !== '待识别底材',
    !asset.keyParameters.startsWith('待补'),
    !asset.riskBoundary.startsWith('待补'),
    Boolean(asset.trustLevel),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function toneForTrust(level: TrustLevel) {
  if (level === 'L5' || level === 'L4') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (level === 'L3') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (level === 'L2') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

function statusTone(status: EvidenceStatus) {
  if (status === '已发布') return 'bg-emerald-50 text-emerald-700';
  if (status === '待审核') return 'bg-amber-50 text-amber-700';
  if (status === '已下架') return 'bg-slate-100 text-slate-500';
  return 'bg-blue-50 text-blue-700';
}

function ShellHeader({
  title,
  subtitle,
  searchQuery,
  setSearchQuery,
  action,
  noticeAction,
}: {
  title: string;
  subtitle: string;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  action?: React.ReactNode;
  noticeAction?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-2 min-[1800px]:gap-3">
        <div className="min-w-0 shrink-0">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="min-w-0 text-2xl font-black tracking-tight text-[#071a41]">{title}</h1>
            {noticeAction}
          </div>
          <p className="mt-0.5 text-xs font-bold text-slate-500">{subtitle}</p>
        </div>
        <div className="flex w-full min-w-0 items-center justify-end gap-1.5 sm:gap-2 min-[1800px]:ml-auto min-[1800px]:w-auto min-[1800px]:shrink-0">
          <div className="relative min-w-0 flex-1 min-[1800px]:w-[min(34vw,430px)] min-[1800px]:min-w-[260px] min-[1800px]:flex-none">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索证据、底材、参数、风险..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          {action}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, note, icon: Icon, tone }: { label: string; value: string | number; note: string; icon: React.ComponentType<{ className?: string }>; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-black text-slate-500">{label}</p>
          <p className="text-xl font-black leading-tight text-[#071a41]">{value}</p>
          <p className="truncate text-[11px] font-bold text-slate-400">{note}</p>
        </div>
      </div>
    </div>
  );
}

function FieldGrid({ asset, fields = PRIMARY_FIELDS }: { asset: EvidenceAsset; fields?: FieldSpec[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
      {fields.map(field => {
        const value = field.value(asset);
        const empty = String(value).startsWith('待补') || String(value).startsWith('待识别');
        return (
          <div key={field.label} className={`rounded-lg border px-3 py-2 ${empty ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black text-slate-500">{field.label}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${field.priority === 'P0' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{field.priority || 'P1'}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm font-black leading-snug text-[#071a41]">{String(value)}</p>
          </div>
        );
      })}
    </div>
  );
}

function AttachmentUploadField({
  field,
  value,
  onChange,
  previewRegistry = {},
  onRegisterFiles,
  batchMode = false,
}: {
  field: DraftFieldSpec;
  value: string;
  onChange: (value: string) => void;
  previewRegistry?: Record<string, AttachmentPreview>;
  onRegisterFiles?: (files: File[]) => AttachmentPreviewRegistration;
  batchMode?: boolean;
}) {
  const inputId = `upload-${field.key}`;
  const items = splitAttachmentValue(value);
  const objectUrlsRef = useRef<string[]>([]);
  const [uploadedPreviews, setUploadedPreviews] = useState<Record<string, AttachmentPreview>>({});

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    };
  }, []);

  const appendFiles = (files: FileList | File[]) => {
    const fileList = Array.from(files);
    const registration = onRegisterFiles
      ? onRegisterFiles(fileList)
      : buildFilePreviewRegistration(fileList, url => objectUrlsRef.current.push(url));
    const nextItems = registration.items;
    const nextPreviews = registration.previews;
    if (!nextItems.length) return;
    setUploadedPreviews(prev => ({ ...prev, ...nextPreviews }));
    onChange(Array.from(new Set([...items, ...nextItems])).join('\n'));
  };
  const removeItem = (item: string) => {
    const preview = uploadedPreviews[item] || previewRegistry[item];
    if (preview?.objectUrl && preview.src) {
      URL.revokeObjectURL(preview.src);
      objectUrlsRef.current = objectUrlsRef.current.filter(url => url !== preview.src);
      setUploadedPreviews(prev => {
        const next = { ...prev };
        delete next[item];
        return next;
      });
    }
    onChange(items.filter(current => current !== item).join('\n'));
  };

  return (
    <div className="space-y-1 md:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-black text-slate-500">{field.label}</span>
        <span className="text-[11px] font-bold text-slate-400">{field.description}</span>
      </div>
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={(event) => {
          event.preventDefault();
          appendFiles(event.dataTransfer.files);
        }}
        className="group flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 px-4 py-5 text-center transition hover:border-blue-400 hover:bg-blue-50"
      >
        <input
          id={inputId}
          type="file"
          multiple
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) appendFiles(event.target.files);
            event.currentTarget.value = '';
          }}
        />
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm ring-1 ring-blue-100">
          <Upload className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-black text-[#071a41]">拖拽文件到这里，或点击批量上传</p>
        <p className="mt-1 text-xs font-bold text-slate-500">
          {batchMode ? `留空不修改${field.label}` : field.placeholder || '支持图片、视频、PDF、附件文件'}
        </p>
      </label>
      {items.length > 0 && (
        <div className="grid gap-3 rounded-xl border border-slate-100 bg-white p-3 sm:grid-cols-2">
          {items.map(item => {
            const preview = uploadedPreviews[item] || resolveAttachmentPreview(item, previewRegistry);
            return (
              <div key={item} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
                <div className="relative aspect-video bg-slate-100">
                  {preview.kind === 'image' && preview.src ? (
                    <img src={preview.src} alt={preview.label} className="h-full w-full object-cover" />
                  ) : preview.kind === 'video' && preview.src ? (
                    <video src={preview.src} controls className="h-full w-full bg-black object-contain" />
                  ) : preview.kind === 'pdf' && preview.src ? (
                    <iframe src={preview.src} title={preview.label} className="h-full w-full bg-white" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm ring-1 ring-blue-100">
                        {preview.kind === 'video' ? <Video className="h-6 w-6" /> : preview.kind === 'image' ? <ImageIcon className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeItem(item)}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-sm backdrop-blur hover:text-rose-500"
                    aria-label={`移除${preview.label}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-[#071a41]">{preview.label}</p>
                    <p className="truncate text-[11px] font-bold text-slate-400">{preview.meta || item}</p>
                  </div>
                  {preview.src && (
                    <a
                      href={preview.src}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-blue-600 hover:border-blue-300 hover:bg-blue-50"
                      title="打开预览"
                    >
                      <Eye className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-20 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold leading-relaxed text-[#071a41] shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        placeholder={batchMode ? `也可以粘贴 URL / 文件名；留空不修改${field.label}` : '也可以粘贴 URL、文件名或外部附件地址，每行一个'}
      />
    </div>
  );
}

function EvidenceTable({
  records,
  selectedId,
  onSelect,
  compact = false,
  expanded = false,
  columns,
  onColumnWidthChange,
  selectable = false,
  selectedIds = [],
  onToggleSelect,
  onEdit,
}: {
  records: EvidenceAsset[];
  selectedId: string;
  onSelect: (id: string) => void;
  compact?: boolean;
  expanded?: boolean;
  columns?: Array<PrimaryColumnDef & { width: number }>;
  onColumnWidthChange?: (key: PrimaryColumnKey, width: number) => void;
  selectable?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onEdit?: (id: string) => void;
}) {
  const activeColumns = columns || PRIMARY_TABLE_COLUMNS.map(column => ({ ...column, width: column.defaultWidth }));
  const selectedSet = new Set(selectedIds);
  const selectionWidth = selectable ? 48 : 0;
  const actionWidth = onEdit ? 88 : 0;
  const tableMinWidth = expanded
    ? activeColumns.reduce((sum, column) => sum + column.width, selectionWidth + actionWidth)
    : 920;

  const beginColumnResize = (event: React.PointerEvent<HTMLButtonElement>, column: PrimaryColumnDef & { width: number }) => {
    if (!onColumnWidthChange) return;
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = column.width;
    const move = (moveEvent: PointerEvent) => {
      onColumnWidthChange(column.key, clampColumnWidth(column.key, startWidth + moveEvent.clientX - startX));
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-black text-[#071a41]">
          <Database className="h-4 w-4 text-blue-600" />
          证据资产主表
        </div>
        <span className="text-xs font-bold text-slate-400">{records.length} 条</span>
      </div>
      <div className={expanded ? 'overflow-x-auto' : 'max-h-[430px] overflow-auto'}>
        <table className="w-full text-left text-xs" style={{ minWidth: expanded ? `${Math.max(tableMinWidth, 920)}px` : '920px' }}>
          <colgroup>
            {selectable && <col style={{ width: `${selectionWidth}px` }} />}
            {activeColumns.map(column => (
              <col key={column.key} style={{ width: `${column.width}px` }} />
            ))}
            {onEdit && <col style={{ width: `${actionWidth}px` }} />}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500">
            <tr>
              {selectable && <th className="px-3 py-2">选择</th>}
              {activeColumns.map(column => (
                <th key={column.key} className="relative px-3 py-2">
                  <span>{column.label}</span>
                  {onColumnWidthChange && (
                    <button
                      type="button"
                      aria-label={`调整${column.label}列宽`}
                      title="拖动调整列宽"
                      onPointerDown={(event) => beginColumnResize(event, column)}
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none border-r border-transparent transition hover:border-blue-400 hover:bg-blue-500/10"
                    />
                  )}
                </th>
              ))}
              {onEdit && <th className="px-3 py-2 text-right">操作</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.map(record => {
              const active = record.id === selectedId;
              return (
                <tr
                  key={record.id}
                  onClick={() => onSelect(record.id)}
                  className={`cursor-pointer align-top transition hover:bg-blue-50/50 ${active ? 'bg-blue-50/70' : 'bg-white'}`}
                >
                  {selectable && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(record.id)}
                        onChange={(event) => {
                          event.stopPropagation();
                          onToggleSelect?.(record.id);
                        }}
                        onClick={(event) => event.stopPropagation()}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        aria-label={`选择${record.title}`}
                      />
                    </td>
                  )}
                  {activeColumns.map(column => (
                    <td key={column.key} className="px-3 py-2 font-bold text-slate-600">
                      {column.render(record, compact)}
                    </td>
                  ))}
                  {onEdit && (
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEdit(record.id);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-blue-100 bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700 transition hover:border-blue-200 hover:bg-blue-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        编辑
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VisualTile({ label, tone = 'gold' }: { label: string; tone?: 'gold' | 'blue' | 'dark' | 'paper' }) {
  const palette = {
    gold: 'from-amber-200 via-yellow-50 to-stone-300',
    blue: 'from-blue-600 via-sky-300 to-white',
    dark: 'from-slate-900 via-slate-600 to-slate-200',
    paper: 'from-blue-50 via-white to-stone-200',
  }[tone];
  return (
    <div className={`relative h-full min-h-24 overflow-hidden rounded-lg bg-gradient-to-br ${palette} shadow-inner`}>
      <div className="absolute inset-x-3 top-1/2 h-px bg-white/70" />
      <div className="absolute left-4 top-4 text-xs font-black tracking-wider text-slate-700/50">PINTE FOIL</div>
      <div className="absolute bottom-3 right-3 rounded-full bg-white/60 px-2 py-1 text-[11px] font-black text-[#071a41]">{label}</div>
    </div>
  );
}

export default function MarketingTrustWorkspace({
  cards,
  searchQuery,
  setSearchQuery,
  activeView,
  onActiveViewChange,
}: MarketingTrustWorkspaceProps) {
  const [localEvidenceAssets, setLocalEvidenceAssets] = useState<EvidenceAsset[]>(readLocalEvidenceAssets);
  const [evidenceOverrides, setEvidenceOverrides] = useState<Record<string, Partial<EvidenceAsset>>>(readEvidenceOverrides);
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);
  const [isEvidenceDetailOpen, setIsEvidenceDetailOpen] = useState(false);
  const [isEvidenceEditOpen, setIsEvidenceEditOpen] = useState(false);
  const [isPrimaryInspectorOpen, setIsPrimaryInspectorOpen] = useState(false);
  const [isColumnConfigOpen, setIsColumnConfigOpen] = useState(false);
  const [draggedColumnKey, setDraggedColumnKey] = useState<PrimaryColumnKey | null>(null);
  const [primaryColumnSettings, setPrimaryColumnSettings] = useState<PrimaryColumnSetting[]>(readPrimaryColumnSettings);
  const [fieldViewQuery, setFieldViewQuery] = useState('');
  const [draftForm, setDraftForm] = useState<EvidenceDraftForm>(DEFAULT_DRAFT_FORM);
  const [createOriginView, setCreateOriginView] = useState<MarketingView>('primary');
  const [draftError, setDraftError] = useState('');
  const [typeFilter, setTypeFilter] = useState<'全部类型' | EvidenceType>('全部类型');
  const [statusFilter, setStatusFilter] = useState<'全部状态' | EvidenceStatus>('全部状态');
  const [trustFilter, setTrustFilter] = useState<'全部等级' | TrustLevel>('全部等级');
  const [actionNotice, setActionNotice] = useState('');
  const [compareFilter, setCompareFilter] = useState('同一膜，不同底材');
  const [reportTemplate, setReportTemplate] = useState('一页式可信报告');
  const [customerNeed, setCustomerNeed] = useState('客户想做化妆品盒亮金效果，底材是白卡纸覆哑膜，担心掉粉和耐磨，想看实拍参数。');
  const [copiedReply, setCopiedReply] = useState(false);
  const [reportCustomerName, setReportCustomerName] = useState('客户待确认');
  const [reportCustomerStage, setReportCustomerStage] = useState('询盘');
  const [selectedReportEvidenceIds, setSelectedReportEvidenceIds] = useState<string[]>([]);
  const [detailRecordId, setDetailRecordId] = useState('');
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [editingEvidenceIds, setEditingEvidenceIds] = useState<string[]>([]);
  const [editForm, setEditForm] = useState<EvidenceEditForm>(EMPTY_EVIDENCE_EDIT_FORM);
  const attachmentObjectUrlsRef = useRef<string[]>([]);
  const [attachmentPreviewRegistry, setAttachmentPreviewRegistry] = useState<Record<string, AttachmentPreview>>({});
  const evidenceRecords = useMemo(() => {
    const cardRecords = cards.map(buildEvidenceFromCard);
    return [...localEvidenceAssets, ...MARKETING_TRUST_EVIDENCE_ASSETS, ...cardRecords].map(record => ({
      ...record,
      ...(evidenceOverrides[record.id] || {}),
    }));
  }, [cards, evidenceOverrides, localEvidenceAssets]);
  const localEvidenceIds = useMemo(() => new Set(localEvidenceAssets.map(record => record.id)), [localEvidenceAssets]);
  const primaryColumns = useMemo(() => {
    const allColumns = buildPrimaryTableColumns(attachmentPreviewRegistry);
    const definitions = new Map(allColumns.map(column => [column.key, column]));
    return primaryColumnSettings
      .filter(setting => setting.visible)
      .map(setting => {
        const definition = definitions.get(setting.key) || allColumns[0];
        return { ...definition, width: setting.width };
      });
  }, [attachmentPreviewRegistry, primaryColumnSettings]);
  const salesKeywords = useMemo(() => extractSalesKeywords(customerNeed, evidenceRecords), [customerNeed, evidenceRecords]);
  const salesRecommendations = useMemo(() => rankEvidenceForNeed(customerNeed, evidenceRecords).slice(0, 6), [customerNeed, evidenceRecords]);
  const customerReply = useMemo(() => buildCustomerReply(customerNeed, salesRecommendations), [customerNeed, salesRecommendations]);
  const reportEvidenceRecords = useMemo(() => {
    const byId = new Map(evidenceRecords.map(record => [record.id, record]));
    const selected = selectedReportEvidenceIds.map(id => byId.get(id)).filter((record): record is EvidenceAsset => Boolean(record));
    const recommended = salesRecommendations.map(item => item.record);
    return (selected.length ? selected : recommended).slice(0, 5);
  }, [evidenceRecords, salesRecommendations, selectedReportEvidenceIds]);
  const baseFilteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return evidenceRecords.filter(record => {
      const matchesSearch = !q || [
        record.id,
        record.title,
        record.type,
        record.substrate,
        record.foilModel,
        record.keyParameters,
        record.riskBoundary,
        record.tags.join(' '),
      ].join(' ').toLowerCase().includes(q);
      const matchesStatus = statusFilter === '全部状态' || record.status === statusFilter;
      const matchesTrust = trustFilter === '全部等级' || record.trustLevel === trustFilter;
      return matchesSearch && matchesStatus && matchesTrust;
    });
  }, [evidenceRecords, searchQuery, statusFilter, trustFilter]);
  const filteredRecords = useMemo(() => {
    return baseFilteredRecords.filter(record => typeFilter === '全部类型' || record.type === typeFilter);
  }, [baseFilteredRecords, typeFilter]);
  const [selectedId, setSelectedId] = useState<string>('');
  const visibleSelectedEvidenceIds = useMemo(() => {
    const visibleIds = new Set(filteredRecords.map(record => record.id));
    return selectedEvidenceIds.filter(id => visibleIds.has(id));
  }, [filteredRecords, selectedEvidenceIds]);

  useEffect(() => {
    if (!actionNotice) return undefined;
    const timer = window.setTimeout(() => setActionNotice(''), 2600);
    return () => window.clearTimeout(timer);
  }, [actionNotice]);

  useEffect(() => {
    return () => {
      attachmentObjectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      attachmentObjectUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('localStorage' in window) || !window.localStorage) return;
    try {
      window.localStorage.setItem(LOCAL_EVIDENCE_STORAGE_KEY, JSON.stringify(localEvidenceAssets));
    } catch {
      // Current-session edits still work when localStorage is unavailable.
    }
  }, [localEvidenceAssets]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('localStorage' in window) || !window.localStorage) return;
    try {
      window.localStorage.setItem(LOCAL_EVIDENCE_OVERRIDES_STORAGE_KEY, JSON.stringify(evidenceOverrides));
    } catch {
      // Current-session edits still work when localStorage is unavailable.
    }
  }, [evidenceOverrides]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('localStorage' in window) || !window.localStorage) return;
    try {
      window.localStorage.setItem(LOCAL_PRIMARY_COLUMN_SETTINGS_KEY, JSON.stringify(primaryColumnSettings));
    } catch {
      // Current-session field view changes still work when localStorage is unavailable.
    }
  }, [primaryColumnSettings]);

  useEffect(() => {
    setTypeFilter(VIEW_TYPE_FILTER[activeView] || '全部类型');
    if (activeView === 'overview' || activeView === 'primary') {
      setStatusFilter('全部状态');
    }
    if (activeView !== 'primary') {
      setIsPrimaryInspectorOpen(false);
      setIsEvidenceDetailOpen(false);
      setIsEvidenceEditOpen(false);
      setSelectedId('');
      setSelectedEvidenceIds([]);
    }
  }, [activeView]);

  const notifyAction = (message: string) => setActionNotice(message);

  const registerAttachmentFiles = (files: File[]) => {
    const registration = buildFilePreviewRegistration(files, url => attachmentObjectUrlsRef.current.push(url));
    if (Object.keys(registration.previews).length) {
      setAttachmentPreviewRegistry(current => ({ ...current, ...registration.previews }));
    }
    return registration;
  };

  const updateDraft = <K extends keyof EvidenceDraftForm>(field: K, value: EvidenceDraftForm[K]) => {
    setDraftForm(current => ({ ...current, [field]: value }));
    if (draftError) setDraftError('');
  };

  const updateExtendedDraftField = (field: string, value: string) => {
    setDraftForm(current => ({
      ...current,
      extendedFields: {
        ...current.extendedFields,
        [field]: value,
      },
    }));
    if (draftError) setDraftError('');
  };

  const updatePrimaryColumn = (key: PrimaryColumnKey, patch: Partial<PrimaryColumnSetting>) => {
    setPrimaryColumnSettings(current => current.map(setting => (
      setting.key === key ? { ...setting, ...patch } : setting
    )));
  };

  const movePrimaryColumn = (fromKey: PrimaryColumnKey, toKey: PrimaryColumnKey) => {
    if (fromKey === toKey) return;
    setPrimaryColumnSettings(current => {
      const fromIndex = current.findIndex(setting => setting.key === fromKey);
      const toIndex = current.findIndex(setting => setting.key === toKey);
      if (fromIndex < 0 || toIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const visiblePrimaryColumnCount = primaryColumnSettings.filter(setting => setting.visible).length;

  const openCreatePanel = (type: EvidenceType = VIEW_TYPE_FILTER[activeView] || '场景证据卡') => {
    setIsEvidenceDetailOpen(false);
    setIsEvidenceEditOpen(false);
    setCreateOriginView(activeView);
    setDraftForm({
      ...DEFAULT_DRAFT_FORM,
      type,
      extendedFields: {},
      status: '草稿',
      sourceType: type === '视频' ? '现场实拍视频' : type === '报告' ? '报告生成中心' : '内部测试',
      processType: type === '视频' ? '过程拍摄' : type === '报告' ? '证据组合报告' : '热烫',
      trustLevel: type === '素材审核' ? 'L1' : 'L2',
    });
    setDraftError('');
    setIsCreatePanelOpen(true);
  };

  const openEvidenceDetail = (id: string) => {
    setSelectedId(id);
    setDetailRecordId(id);
    setIsCreatePanelOpen(false);
    setIsEvidenceEditOpen(false);
    setIsEvidenceDetailOpen(true);
  };

  const toggleEvidenceSelection = (id: string) => {
    setSelectedEvidenceIds(current => (
      current.includes(id) ? current.filter(item => item !== id) : [...current, id]
    ));
  };

  const selectAllVisibleEvidence = () => {
    setSelectedEvidenceIds(filteredRecords.map(record => record.id));
    notifyAction(`已选择当前主表 ${filteredRecords.length} 条证据。`);
  };

  const clearSelectedEvidence = () => {
    setSelectedEvidenceIds([]);
    notifyAction('已取消主表选择。');
  };

  const openEvidenceEditPanel = (ids: string[]) => {
    const normalizedIds = Array.from(new Set(ids)).filter(id => evidenceRecords.some(record => record.id === id));
    if (!normalizedIds.length) {
      notifyAction('请先选择需要编辑的证据。');
      return;
    }
    const firstRecord = evidenceRecords.find(record => record.id === normalizedIds[0]);
    const isSingle = normalizedIds.length === 1;
    setEditingEvidenceIds(normalizedIds);
    setEditForm(isSingle && firstRecord ? {
      title: firstRecord.title,
      type: firstRecord.type,
      status: firstRecord.status,
      sourceType: firstRecord.sourceType,
      scene: firstRecord.scene,
      industry: firstRecord.industry,
      substrate: firstRecord.substrate,
      surfaceTreatment: firstRecord.surfaceTreatment,
      foilModel: firstRecord.foilModel,
      foilColor: firstRecord.foilColor,
      processType: firstRecord.processType,
      keyParameters: firstRecord.keyParameters,
      equipment: firstRecord.equipment,
      visualResult: firstRecord.visualResult,
      testResult: firstRecord.testResult,
      defectResult: firstRecord.defectResult,
      trustLevel: firstRecord.trustLevel,
      visibility: firstRecord.visibility,
      realShotFlag: firstRecord.realShotFlag ? 'true' : 'false',
      riskBoundary: firstRecord.riskBoundary,
      forbiddenClaims: firstRecord.forbiddenClaims,
      salesScript: firstRecord.salesScript,
      owner: firstRecord.owner,
      tags: firstRecord.tags.join('，'),
      extendedFields: { ...(firstRecord.extendedFields || {}) },
    } : EMPTY_EVIDENCE_EDIT_FORM);
    setIsCreatePanelOpen(false);
    setIsEvidenceDetailOpen(false);
    setIsEvidenceEditOpen(true);
  };

  const applyEvidencePatch = (ids: string[], patch: Partial<EvidenceAsset>) => {
    if (!ids.length || Object.keys(patch).length === 0) return;
    const updatedAt = formatDate();
    const nextPatch = { ...patch, updatedAt };
    const mergeIntoRecord = (record: EvidenceAsset): EvidenceAsset => ({
      ...record,
      ...nextPatch,
      extendedFields: patch.extendedFields
        ? { ...(record.extendedFields || {}), ...patch.extendedFields }
        : record.extendedFields,
    });
    setEvidenceOverrides(current => {
      const next = { ...current };
      ids.forEach(id => {
        const currentOverride = next[id] || {};
        const sourceRecord = evidenceRecords.find(record => record.id === id);
        const mergedOverride: Partial<EvidenceAsset> = { ...currentOverride, ...nextPatch };
        if (patch.extendedFields) {
          mergedOverride.extendedFields = {
            ...(sourceRecord?.extendedFields || {}),
            ...(currentOverride.extendedFields || {}),
            ...patch.extendedFields,
          };
        }
        next[id] = mergedOverride;
      });
      return next;
    });
    setLocalEvidenceAssets(current => current.map(record => (
      ids.includes(record.id) ? mergeIntoRecord(record) : record
    )));
  };

  const saveEvidenceEdit = () => {
    const isBatch = editingEvidenceIds.length > 1;
    const patch: Partial<EvidenceAsset> = {};
    if (editForm.type) patch.type = editForm.type;
    if (editForm.status) patch.status = editForm.status;
    if (editForm.trustLevel) patch.trustLevel = editForm.trustLevel;
    if (editForm.visibility) patch.visibility = editForm.visibility;
    if (editForm.realShotFlag) patch.realShotFlag = editForm.realShotFlag === 'true';
    if (!isBatch || editForm.title.trim()) patch.title = editForm.title.trim();
    if (!isBatch || editForm.sourceType.trim()) patch.sourceType = editForm.sourceType.trim();
    if (!isBatch || editForm.scene.trim()) patch.scene = editForm.scene.trim();
    if (!isBatch || editForm.industry.trim()) patch.industry = editForm.industry.trim();
    if (!isBatch || editForm.substrate.trim()) patch.substrate = editForm.substrate.trim();
    if (!isBatch || editForm.surfaceTreatment.trim()) patch.surfaceTreatment = editForm.surfaceTreatment.trim();
    if (!isBatch || editForm.foilModel.trim()) patch.foilModel = editForm.foilModel.trim();
    if (!isBatch || editForm.foilColor.trim()) patch.foilColor = editForm.foilColor.trim();
    if (!isBatch || editForm.processType.trim()) patch.processType = editForm.processType.trim();
    if (!isBatch || editForm.keyParameters.trim()) patch.keyParameters = editForm.keyParameters.trim();
    if (!isBatch || editForm.equipment.trim()) patch.equipment = editForm.equipment.trim();
    if (!isBatch || editForm.visualResult.trim()) patch.visualResult = editForm.visualResult.trim();
    if (!isBatch || editForm.testResult.trim()) patch.testResult = editForm.testResult.trim();
    if (!isBatch || editForm.defectResult.trim()) patch.defectResult = editForm.defectResult.trim();
    if (!isBatch || editForm.owner.trim()) patch.owner = editForm.owner.trim();
    if (!isBatch || editForm.riskBoundary.trim()) patch.riskBoundary = editForm.riskBoundary.trim();
    if (!isBatch || editForm.forbiddenClaims.trim()) patch.forbiddenClaims = editForm.forbiddenClaims.trim();
    if (!isBatch || editForm.salesScript.trim()) patch.salesScript = editForm.salesScript.trim();
    if (!isBatch || editForm.tags.trim()) patch.tags = draftTagsToArray(editForm.tags);
    const extendedEntries = Object.entries(editForm.extendedFields || {})
      .map(([key, value]) => [key, String(value).trim()] as const);
    const extendedFields = Object.fromEntries(
      isBatch ? extendedEntries.filter(([, value]) => Boolean(value)) : extendedEntries
    );
    if (!isBatch || Object.keys(extendedFields).length > 0) patch.extendedFields = extendedFields;

    const cleanPatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => {
        if (Array.isArray(value)) return value.length > 0;
        if (value && typeof value === 'object') return Object.keys(value).length > 0;
        return value !== undefined && value !== '';
      })
    ) as Partial<EvidenceAsset>;

    if (Object.keys(cleanPatch).length === 0) {
      notifyAction('请至少填写一个需要编辑的字段。');
      return;
    }

    applyEvidencePatch(editingEvidenceIds, cleanPatch);
    setIsEvidenceEditOpen(false);
    notifyAction(`已更新 ${editingEvidenceIds.length} 条证据，主表数据已刷新。`);
  };

  const saveDraftEvidence = () => {
    const missing = REQUIRED_DRAFT_FIELDS
      .filter(([field]) => !String(draftForm[field] || '').trim())
      .map(([, label]) => label);
    if (missing.length) {
      setDraftError(`请先补齐 P0 字段：${missing.join('、')}`);
      return;
    }

    const timestamp = Date.now();
    const newAsset: EvidenceAsset = {
      ...draftForm,
      id: `${ID_PREFIX_BY_EVIDENCE_TYPE[draftForm.type]}-MKT-${timestamp}`,
      title: draftForm.title.trim(),
      sourceType: draftForm.sourceType.trim() || '内部测试',
      scene: draftForm.scene.trim(),
      industry: draftForm.industry.trim() || '待补行业',
      substrate: draftForm.substrate.trim(),
      surfaceTreatment: draftForm.surfaceTreatment.trim() || '待补表面处理',
      foilModel: draftForm.foilModel.trim(),
      foilColor: draftForm.foilColor.trim() || '待补颜色',
      processType: draftForm.processType.trim() || '热烫',
      keyParameters: draftForm.keyParameters.trim(),
      equipment: draftForm.equipment.trim() || '待补设备',
      visualResult: draftForm.visualResult.trim() || '待补视觉结论',
      testResult: draftForm.testResult.trim(),
      defectResult: draftForm.defectResult.trim() || '待观察',
      riskBoundary: draftForm.riskBoundary.trim(),
      forbiddenClaims: draftForm.forbiddenClaims.trim() || '不得外推到未验证材料或未验证参数。',
      salesScript: draftForm.salesScript.trim() || `该证据基于 ${draftForm.substrate.trim()} 和 ${draftForm.foilModel.trim()} 的测试记录，客户实际材料仍建议重新打样确认。`,
      owner: draftForm.owner.trim(),
      extendedFields: Object.fromEntries(
        Object.entries(draftForm.extendedFields || {})
          .map(([key, value]) => [key, String(value).trim()] as const)
          .filter(([, value]) => Boolean(value))
      ),
      updatedAt: formatDate(),
      tags: draftTagsToArray(draftForm.tags || '').length
        ? draftTagsToArray(draftForm.tags || '')
        : [draftForm.type, draftForm.scene.trim(), draftForm.substrate.trim(), draftForm.foilModel.trim()].filter(Boolean),
    };

    setLocalEvidenceAssets(current => [newAsset, ...current]);
    setSelectedId(newAsset.id);
    const shouldStayInPrimary = createOriginView === 'primary';
    onActiveViewChange(shouldStayInPrimary ? 'primary' : VIEW_BY_EVIDENCE_TYPE[newAsset.type]);
    setTypeFilter(shouldStayInPrimary ? '全部类型' : newAsset.type);
    setStatusFilter('草稿');
    setTrustFilter('全部等级');
    setSearchQuery('');
    setIsCreatePanelOpen(false);
    notifyAction(`已创建 ${newAsset.id}，草稿已保存在${shouldStayInPrimary ? '证据主表' : '对应业务页面'}并等待审核。`);
  };

  const removeLocalEvidence = (id: string) => {
    setLocalEvidenceAssets(current => current.filter(record => record.id !== id));
    setSelectedEvidenceIds(current => current.filter(item => item !== id));
    setSelectedId('');
    if (detailRecordId === id) {
      setDetailRecordId('');
      setIsEvidenceDetailOpen(false);
    }
    notifyAction(`${id} 已从本地营销可信草稿中删除。`);
  };

  const appendNeedChip = (chip: string) => {
    setCustomerNeed(current => {
      const trimmed = current.trim();
      if (trimmed.includes(chip)) return current;
      return `${trimmed}${trimmed ? '，' : ''}${chip}`;
    });
  };

  const useSalesRecommendation = (record: EvidenceAsset) => {
    setSelectedId(record.id);
    onActiveViewChange(VIEW_BY_EVIDENCE_TYPE[record.type]);
    setTypeFilter(record.type);
    setStatusFilter('全部状态');
    setTrustFilter('全部等级');
    setSearchQuery('');
    notifyAction(`已选中 ${record.id}，可继续生成客户回复、报告或 WhatsApp 图文。`);
  };

  const copyCustomerReply = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(customerReply);
        setCopiedReply(true);
        if (typeof window !== 'undefined') {
          window.setTimeout(() => setCopiedReply(false), 1600);
        }
        notifyAction('客户回复已复制，可直接粘贴到 WhatsApp / 邮件。');
        return;
      }
      notifyAction('当前浏览器不支持剪贴板 API，请手动选中复制客户回复。');
    } catch {
      notifyAction('复制失败，请手动选中客户回复。');
    }
  };

  const toggleReportEvidence = (id: string) => {
    setSelectedReportEvidenceIds(current => {
      const base = current.length ? current : reportEvidenceRecords.map(record => record.id);
      if (base.includes(id)) {
        const next = base.filter(item => item !== id);
        return next.length ? next : base;
      }
      return [...base, id].slice(-6);
    });
  };

  const useRecommendedEvidenceForReport = () => {
    const ids = salesRecommendations.slice(0, 4).map(item => item.record.id);
    setSelectedReportEvidenceIds(ids);
    onActiveViewChange('report');
    setTypeFilter('报告');
    setStatusFilter('全部状态');
    setTrustFilter('全部等级');
    notifyAction(`已把 ${ids.length} 条推荐证据带入可信报告生成中心。`);
  };

  const handleViewChange = (view: MarketingView) => {
    onActiveViewChange(view);
    setSelectedId('');
    setSelectedEvidenceIds([]);
    setIsEvidenceEditOpen(false);
    setIsEvidenceDetailOpen(false);
    setTypeFilter(VIEW_TYPE_FILTER[view] || '全部类型');
    if (view === 'overview' || view === 'primary') {
      setStatusFilter('全部状态');
    }
  };

  const metrics = useMemo(() => {
    const highTrust = evidenceRecords.filter(record => record.trustLevel === 'L4' || record.trustLevel === 'L5').length;
    const publicCount = evidenceRecords.filter(record => record.visibility === '可公开' || record.visibility === '脱敏公开').length;
    const realShotCount = evidenceRecords.filter(record => record.realShotFlag).length;
    const realShotRatio = evidenceRecords.length ? Math.round((realShotCount / evidenceRecords.length) * 100) : 0;
    const complete = evidenceRecords.length ? Math.round(evidenceRecords.reduce((sum, record) => sum + completeness(record), 0) / evidenceRecords.length) : 0;
    return { highTrust, publicCount, realShotCount, realShotRatio, complete };
  }, [evidenceRecords]);

  const candidateRecords = baseFilteredRecords.length ? baseFilteredRecords : evidenceRecords;
  const typeFiltered = (type: EvidenceType) => baseFilteredRecords.filter(record => record.type === type);
  const fallbackFor = (predicate: (record: EvidenceAsset) => boolean, limit = 18) => {
    const matched = candidateRecords.filter(predicate);
    return (matched.length ? matched : candidateRecords).slice(0, limit);
  };
  const primaryDataViewType = PRIMARY_DATA_VIEW_TYPES[activeView];
  const currentRecords = primaryDataViewType
    ? typeFiltered(primaryDataViewType)
    : activeView === 'review'
            ? fallbackFor(record => record.status === '待审核' || record.type === '素材审核' || completeness(record) < 100)
            : activeView === 'publish'
              ? fallbackFor(record => record.status === '已发布' && record.visibility !== '仅内部')
              : activeView === 'questions'
                ? (typeFiltered('客户问题').length ? typeFiltered('客户问题') : fallbackFor(record => record.salesScript !== '待生成客户话术'))
                : filteredRecords;
  const activeRecord = currentRecords.find(record => record.id === selectedId)
    || (primaryDataViewType ? undefined : filteredRecords.find(record => record.id === selectedId))
    || currentRecords[0]
    || (primaryDataViewType ? undefined : filteredRecords[0])
    || (primaryDataViewType ? undefined : evidenceRecords[0]);
  const detailRecord = evidenceRecords.find(record => record.id === detailRecordId)
    || (isEvidenceDetailOpen && activeView === 'primary' ? activeRecord : undefined);
  const selectedRecordId = activeRecord?.id || '';
  const expectedViewType = VIEW_TYPE_FILTER[activeView];
  const isUsingCandidateRecords = Boolean(
    expectedViewType
    && !PRIMARY_DATA_VIEW_TYPES[activeView]
    && baseFilteredRecords.filter(record => record.type === expectedViewType).length === 0
    && currentRecords.length > 0
  );

  const renderCoreChecklist = (record: EvidenceAsset) => (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black text-[#071a41]">5 个不可缺字段</h2>
        <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">{completeness(record)}% 完整</span>
      </div>
      <div className="mt-3 space-y-2">
        {CORE_FIELDS.map(field => {
          const ok = field === '是否实拍'
            ? record.realShotFlag
            : field === '使用底材'
              ? record.substrate !== '待识别底材'
              : field === '关键参数'
                ? !record.keyParameters.startsWith('待补')
                : field === '风险边界'
                  ? !record.riskBoundary.startsWith('待补')
                  : Boolean(record.trustLevel);
          return (
            <div key={field} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
              <span className="text-xs font-black text-slate-600">{field}</span>
              {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderSalesCallWorkspace = () => {
    const quickChips = ['化妆品盒', '白卡纸', '亮金', '哑膜', '掉粉', '耐磨', '实拍', '报价附件'];
    return (
      <section className="rounded-lg border border-blue-100 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div>
            <h2 className="text-base font-black text-[#071a41]">销售调用证据</h2>
            <p className="mt-0.5 text-xs font-bold text-slate-500">输入客户需求，系统按场景、底材、膜型号、风险边界和可信等级推荐可发证据。</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-black">
            <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">候选 {salesRecommendations.length}</span>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">可公开 {salesRecommendations.filter(item => item.record.visibility !== '仅内部').length}</span>
            <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">风险需同步</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 2xl:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.15fr)_minmax(340px,1fr)]">
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-500">客户需求输入</span>
              <span className="text-[11px] font-bold text-slate-400">{customerNeed.trim().length} 字</span>
            </div>
            <textarea
              value={customerNeed}
              onChange={(event) => setCustomerNeed(event.target.value)}
              className="mt-2 min-h-32 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold leading-relaxed text-[#071a41] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              placeholder="例如：客户要做化妆品盒亮金效果，底材白卡纸覆哑膜，担心掉粉和耐磨，需要实拍参数。"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {quickChips.map(chip => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => appendNeedChip(chip)}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                  + {chip}
                </button>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/70 p-2">
              <p className="text-[11px] font-black text-blue-700">识别标签</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(salesKeywords.length ? salesKeywords : ['等待输入']).slice(0, 10).map(keyword => (
                  <span key={keyword} className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-[#071a41] shadow-sm">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-500">推荐证据卡 / 对比图 / 视频 / 报告</span>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery(salesKeywords[0] || '');
                  notifyAction('已把首个识别标签写入搜索框，用于继续检索证据资产。');
                }}
                className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-black text-slate-600 hover:bg-slate-50"
              >
                深入检索
              </button>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-2">
              {salesRecommendations.slice(0, 4).map(({ record, score }, index) => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => useSalesRecommendation(record)}
                  className="rounded-lg border border-slate-200 bg-slate-50/50 p-2 text-left transition hover:border-blue-200 hover:bg-blue-50/70"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-black text-white">#{index + 1}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-slate-500">匹配 {score}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-black leading-snug text-[#071a41]">{record.title}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] font-bold leading-relaxed text-slate-500">{record.substrate} · {record.foilModel} · {record.keyParameters}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${toneForTrust(record.trustLevel)}`}>{record.trustLevel}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-slate-500">{record.type}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-slate-500">{record.visibility}</span>
                    {record.realShotFlag && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">实拍</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-[#071a41] p-3 text-white shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-blue-100">客户回复生成</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={copyCustomerReply}
                  className="rounded-md bg-white px-2 py-1 text-[11px] font-black text-[#071a41] hover:bg-blue-50"
                >
                  <Copy className="mr-1 inline h-3.5 w-3.5" />{copiedReply ? '已复制' : '复制'}
                </button>
                <button
                  type="button"
                  onClick={useRecommendedEvidenceForReport}
                  className="rounded-md bg-blue-600 px-2 py-1 text-[11px] font-black text-white hover:bg-blue-500"
                >
                  PDF
                </button>
              </div>
            </div>
            <textarea
              readOnly
              value={customerReply}
              className="mt-2 min-h-44 w-full resize-y rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold leading-relaxed text-white outline-none"
            />
            <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[11px] font-black">
              <button
                type="button"
                onClick={() => notifyAction('已生成 WhatsApp 图文结构：证据摘要 + 实拍说明 + 风险边界 + 打样建议。')}
                className="rounded-md bg-white/10 px-2 py-2 text-blue-50 hover:bg-white/15"
              >
                WhatsApp 图文
              </button>
              <button
                type="button"
                onClick={() => notifyAction('已记录销售调用：后续可接调用次数与转化率。')}
                className="rounded-md bg-white/10 px-2 py-2 text-blue-50 hover:bg-white/15"
              >
                记录调用
              </button>
              <button
                type="button"
                onClick={() => openCreatePanel('场景证据卡')}
                className="rounded-md bg-white/10 px-2 py-2 text-blue-50 hover:bg-white/15"
              >
                补新证据
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  };

  const renderOverview = () => (
    <div className="space-y-3 p-4">
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-6">
        <Metric label="证据资产总数" value={evidenceRecords.length} note="证据主表 COUNT" icon={Database} tone="bg-blue-600 text-white" />
        <Metric label="高可信案例" value={metrics.highTrust} note="L4/L5 可强推荐" icon={ShieldCheck} tone="bg-emerald-500 text-white" />
        <Metric label="客户可公开" value={metrics.publicCount} note="公开/脱敏公开" icon={Eye} tone="bg-cyan-500 text-white" />
        <Metric label="实拍素材占比" value={`${metrics.realShotRatio}%`} note={`${metrics.realShotCount}/${evidenceRecords.length} 含图片/视频线索`} icon={Camera} tone="bg-violet-500 text-white" />
        <Metric label="平均完整度" value={`${metrics.complete}%`} note="P0 字段完整率" icon={BarChart3} tone="bg-orange-500 text-white" />
        <Metric label="待审核风险" value={evidenceRecords.filter(record => record.status === '待审核').length} note="需人工复核" icon={AlertTriangle} tone="bg-rose-500 text-white" />
      </div>

      <section className="rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs font-bold leading-relaxed text-blue-800 shadow-sm">
        数据边界：营销可信证据卡来自营销可信证据库与实践云打样记录；知识云只作为规则引用和标准来源，不直接生成证据卡。
      </section>

      {renderSalesCallWorkspace()}

      <div className="grid grid-cols-1 gap-3 2xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-3">
          <EvidenceTable records={filteredRecords.slice(0, 60)} selectedId={selectedRecordId} onSelect={setSelectedId} compact />
        </div>
        {activeRecord && (
          <aside className="space-y-3">
            {renderCoreChecklist(activeRecord)}
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <h2 className="text-sm font-black text-[#071a41]">当前证据客户可见摘要</h2>
              <div className="mt-3 h-32"><VisualTile label={activeRecord.type} tone={activeRecord.realShotFlag ? 'gold' : 'paper'} /></div>
              <p className="mt-3 text-base font-black leading-snug text-[#071a41]">{activeRecord.title}</p>
              <p className="mt-2 text-xs font-bold leading-relaxed text-slate-600">{activeRecord.salesScript}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {activeRecord.tags.slice(0, 6).map(tag => <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600">{tag}</span>)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <h2 className="text-sm font-black text-[#071a41]">8 张核心表 + 2 张辅助表</h2>
              <div className="mt-2 space-y-1">
                {TABLE_BLUEPRINTS.map(([name, purpose]) => (
                  <div key={name} className="flex items-center justify-between rounded-md border border-slate-100 px-2 py-1.5">
                    <span className="text-xs font-black text-[#071a41]">{name}</span>
                    <span className="max-w-[150px] truncate text-[11px] font-bold text-slate-400">{purpose}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );

  const renderPrimary = () => (
    <div className="p-4">
      {visibleSelectedEvidenceIds.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={selectAllVisibleEvidence}
              disabled={filteredRecords.length === 0}
              className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              全选当前
            </button>
            <button
              type="button"
              onClick={clearSelectedEvidence}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50"
            >
              取消全选
            </button>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
              已选 {visibleSelectedEvidenceIds.length} / 当前 {filteredRecords.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => openEvidenceEditPanel(visibleSelectedEvidenceIds)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-blue-700"
          >
            <Pencil className="h-4 w-4" />
            批量编辑
          </button>
        </div>
      )}
      <EvidenceTable
        records={filteredRecords}
        selectedId={selectedRecordId}
        onSelect={openEvidenceDetail}
        expanded
        columns={primaryColumns}
        onColumnWidthChange={(key, width) => updatePrimaryColumn(key, { width })}
        selectable
        selectedIds={selectedEvidenceIds}
        onToggleSelect={toggleEvidenceSelection}
        onEdit={(id) => openEvidenceEditPanel([id])}
      />
    </div>
  );

  const renderColumnConfigModal = () => {
    if (!isColumnConfigOpen) return null;
    const columnByKey = new Map(PRIMARY_TABLE_COLUMNS.map(column => [column.key, column]));
    const normalizedFieldQuery = fieldViewQuery.trim().toLowerCase();
    const displayedColumnSettings = primaryColumnSettings.filter(setting => {
      const column = columnByKey.get(setting.key);
      if (!column) return false;
      if (!normalizedFieldQuery) return true;
      return [
        column.label,
        column.group,
        column.key,
      ].join(' ').toLowerCase().includes(normalizedFieldQuery);
    });
    const displayedColumnKeys = new Set(displayedColumnSettings.map(setting => setting.key));
    const setDisplayedColumnsVisible = (visible: boolean) => {
      setPrimaryColumnSettings(current => current.map(setting => (
        displayedColumnKeys.has(setting.key) ? { ...setting, visible } : setting
      )));
    };

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm"
        onClick={() => setIsColumnConfigOpen(false)}
      >
        <div
          className="max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl shadow-slate-950/20"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-blue-600">Table fields</p>
              <h2 className="mt-1 text-xl font-black text-[#071a41]">证据主表字段视图</h2>
              <p className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
                可操作字段已与“新建证据”收集字段保持一致；列宽请直接拖动主表表头字段分隔线调整。
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPrimaryColumnSettings(DEFAULT_PRIMARY_COLUMN_SETTINGS)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm hover:bg-slate-50"
              >
                重置默认
              </button>
              <button
                type="button"
                onClick={() => setIsColumnConfigOpen(false)}
                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-blue-700"
              >
                完成
              </button>
            </div>
          </div>

          <div className="max-h-[68vh] overflow-y-auto p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setDisplayedColumnsVisible(true)}
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 shadow-sm hover:bg-blue-100"
              >
                全选
              </button>
              <button
                type="button"
                onClick={() => setDisplayedColumnsVisible(false)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm hover:bg-slate-50"
              >
                取消全选
              </button>
              <div className="relative ml-auto min-w-[220px] flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={fieldViewQuery}
                  onChange={(event) => setFieldViewQuery(event.target.value)}
                  placeholder="搜索字段名称、分组或字段代码"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-bold text-[#071a41] shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2">
              {displayedColumnSettings.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm font-black text-slate-400">
                  没有匹配的字段
                </div>
              )}
              {displayedColumnSettings.map((setting) => {
                const column = columnByKey.get(setting.key);
                if (!column) return null;
                const displayIndex = primaryColumnSettings.findIndex(item => item.key === setting.key) + 1;
                return (
                  <div
                    key={setting.key}
                    draggable
                    onDragStart={() => setDraggedColumnKey(setting.key)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (draggedColumnKey) movePrimaryColumn(draggedColumnKey, setting.key);
                      setDraggedColumnKey(null);
                    }}
                    onDragEnd={() => setDraggedColumnKey(null)}
                    className={`mb-2 rounded-lg border bg-white p-3 shadow-sm transition last:mb-0 ${
                      draggedColumnKey === setting.key ? 'border-blue-300 opacity-70' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-400">
                        {displayIndex}
                      </div>
                      <label className="flex min-w-[150px] flex-1 items-center gap-2 text-sm font-black text-[#071a41]">
                        <input
                          type="checkbox"
                          checked={setting.visible}
                          onChange={(event) => updatePrimaryColumn(setting.key, { visible: event.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>
                          <span className="block">{column.label}</span>
                          <span className="mt-0.5 block text-[10px] font-black uppercase tracking-wide text-slate-400">{column.group}</span>
                        </span>
                      </label>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-400">
                        拖动排序
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs font-bold leading-relaxed text-slate-500">
              当前显示 {visiblePrimaryColumnCount} / {PRIMARY_TABLE_COLUMNS.length} 个字段；当前筛选 {displayedColumnSettings.length} 个字段。字段列宽在主表表头拖动分隔线调整。
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderPrimaryInspectorModal = () => {
    if (!isPrimaryInspectorOpen || !activeRecord) return null;
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm"
        onClick={() => setIsPrimaryInspectorOpen(false)}
      >
        <div
          className="max-h-[86vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-white/70 bg-white p-4 shadow-2xl shadow-slate-950/20"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-rose-300 bg-rose-50 text-xl font-black text-rose-500">
                !
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-rose-500">Field health</p>
                <h2 className="mt-1 text-xl font-black text-[#071a41]">证据主表字段检查</h2>
                <p className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
                  当前选中：{activeRecord.title}。这里集中查看必填完整度和主表字段，不再占用主表宽度。
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPrimaryInspectorOpen(false)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm hover:bg-slate-50"
            >
              关闭
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
            {renderCoreChecklist(activeRecord)}
            <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-[#071a41]">证据主表字段</h3>
                <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">
                  {PRIMARY_FIELDS.filter(field => field.priority === 'P0').length} 个 P0 字段
                </span>
              </div>
              <div className="mt-3">
                <FieldGrid asset={activeRecord} />
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  };

  const renderScene = () => {
    const records = currentRecords;
    const record = records.find(item => item.id === selectedRecordId) || records[0] || activeRecord;
    return (
      <div className="grid grid-cols-1 gap-3 p-4 2xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-3 py-2 text-sm font-black text-[#071a41]">证据主表 · 场景证据卡视图</div>
          <div className="max-h-[680px] overflow-y-auto p-2">
            {records.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-xs font-black text-slate-400">
                当前证据主表中没有匹配的场景证据卡
              </div>
            )}
            {records.slice(0, 24).map(item => (
              <button key={item.id} onClick={() => setSelectedId(item.id)} className={`mb-2 w-full rounded-lg border p-3 text-left transition ${item.id === record?.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-black text-[#071a41]">{item.title}</p>
                  <span className={`rounded-full border px-2 py-1 text-[11px] font-black ${toneForTrust(item.trustLevel)}`}>{item.trustLevel}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs font-bold text-slate-500">{item.substrate} · {item.keyParameters}</p>
              </button>
            ))}
          </div>
        </section>
        {record && (
          <>
            <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h2 className="text-base font-black text-[#071a41]">创建 / 编辑证据卡 P0 字段</h2>
                  <p className="text-xs font-bold text-slate-500">场景、底材、膜型号、参数、实拍图、测试结果、风险边界、可信等级</p>
                </div>
                <button
                  onClick={() => notifyAction(`已基于 ${record.id} 生成客户版证据卡预览，待审核后可导出。`)}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white"
                >
                  <Sparkles className="mr-1 inline h-4 w-4" />生成客户版卡片
                </button>
              </div>
              <div className="mt-3"><FieldGrid asset={record} fields={PRIMARY_FIELDS.filter(field => field.priority === 'P0')} /></div>
              <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
                {['实拍图上传', '局部特写', '测试图', '短视频'].map((label, index) => (
                  <button
                    key={label}
                    onClick={() => notifyAction(`${label}上传位已选中：需要绑定证据 ${record.id} 后进入审核。`)}
                    className="rounded-lg border border-dashed border-blue-200 bg-blue-50/40 p-3 text-left"
                  >
                    {index === 3 ? <Video className="h-5 w-5 text-blue-600" /> : <Camera className="h-5 w-5 text-blue-600" />}
                    <p className="mt-2 text-xs font-black text-[#071a41]">{label}</p>
                    <p className="text-[11px] font-bold text-slate-400">JPG/PNG/MP4</p>
                  </button>
                ))}
              </div>
            </section>
            <aside className="space-y-3">
              <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <h2 className="text-sm font-black text-[#071a41]">客户版证据卡预览</h2>
                <div className="mt-3 h-36"><VisualTile label={record.foilModel} tone="gold" /></div>
                <p className="mt-3 text-lg font-black leading-snug text-[#071a41]">{record.title}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black text-slate-600">
                  {record.keyParameters.split('/').slice(0, 3).map(item => <span key={item} className="rounded-md bg-slate-50 px-2 py-2">{item.trim()}</span>)}
                </div>
                <p className="mt-3 rounded-lg bg-orange-50 p-2 text-xs font-bold leading-relaxed text-orange-700">{record.riskBoundary}</p>
              </section>
              {renderCoreChecklist(record)}
            </aside>
          </>
        )}
      </div>
    );
  };

  const renderCompare = () => {
    const records = currentRecords;
    const record = records.find(item => item.id === selectedRecordId) || records[0] || activeRecord;
    const comparisonTypes = ['同一膜，不同底材', '同一底材，不同膜', '同一工艺，不同参数', '测试前后对比', '成功 vs 失败'];
    const tableRows = records.slice(0, 6);
    const activeComparisonType = comparisonTypes.includes(compareFilter) ? compareFilter : comparisonTypes[0];

    return (
      <div className="grid grid-cols-1 gap-3 p-4 2xl:grid-cols-[250px_minmax(0,1fr)_300px]">
        <aside className="space-y-3">
          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="text-sm font-black text-[#071a41]">筛选条件</h2>
            <div className="mt-3 space-y-3 text-xs font-bold text-slate-600">
              {[
                ['对比类型', comparisonTypes],
                ['底材', ['白卡纸', '特种纸', 'PP/PET/PVC', '皮革/织物']],
                ['产品系列', ['K系列', 'L系列', 'S系列', 'U系列']],
                ['可信等级', ['L2', 'L3', 'L4', 'L5']],
              ].map(([group, items]) => (
                <div key={group as string}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-black text-slate-700">{group as string}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (group === '对比类型') {
                          setCompareFilter(comparisonTypes[0]);
                          notifyAction('已重置为默认对比类型：同一膜，不同底材。');
                        }
                      }}
                      className="text-[11px] text-blue-600"
                    >
                      清空
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {(items as string[]).slice(0, 5).map(item => (
                      <label key={item} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-blue-50">
                        <input
                          type="checkbox"
                          checked={group === '对比类型' ? compareFilter === item : false}
                          onChange={() => {
                            if (group === '对比类型') {
                              setCompareFilter(item);
                              notifyAction(`对比图口径已切换为：${item}`);
                            } else {
                              notifyAction(`${group as string}筛选「${item}」已记录，后续可接真实数据查询。`);
                            }
                          }}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                        />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
            {comparisonTypes.map((item, index) => (
              <button
                key={item}
                onClick={() => {
                  setCompareFilter(item);
                  notifyAction(`已选择对比口径：${item}`);
                }}
                className={`rounded-lg border px-3 py-2 text-left shadow-sm transition ${
                  activeComparisonType === item ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <p className={`text-[11px] font-black ${activeComparisonType === item ? 'text-blue-700' : 'text-slate-500'}`}>{item}</p>
                <p className="mt-1 text-xl font-black text-blue-600">{Math.max(6, records.length * (index + 2))}</p>
              </button>
            ))}
          </div>

          {record && (
            <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-black text-blue-700">白卡纸 / 特种纸 / PP / PVC 效果差异</h2>
                  <p className="text-xs font-bold text-slate-500">当前口径：{activeComparisonType}。对比目的：让客户看到变量差异，而不是只看卖点。</p>
                </div>
                <span className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-black text-white">客户最常查看</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
                {[
                  ['白卡纸 (250g)', 'gold'],
                  ['特种纸 (星幻纸)', 'paper'],
                  ['PP (哑光)', 'dark'],
                  ['PVC (透明)', 'blue'],
                ].map(([label, tone]) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <div className="h-36"><VisualTile label={label} tone={tone as 'gold' | 'blue' | 'dark' | 'paper'} /></div>
                    <div className="mt-2 flex items-center justify-between text-[11px] font-black text-slate-500">
                      <span>120℃</span>
                      <span>中压</span>
                      <span>25m/min</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-3 py-2 text-sm font-black text-[#071a41]">证据主表 · 对比证据图视图</div>
            <div className="overflow-x-auto">
              <table className="min-w-[780px] w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-black text-slate-500">
                  <tr>
                    {['编号', '对比类型', '主图', '细节图', '测试图', '关键结论', '可信等级', '操作'].map(head => <th key={head} className="px-3 py-2">{head}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tableRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-10 text-center font-black text-slate-400">
                        当前证据主表中没有匹配的对比证据图
                      </td>
                    </tr>
                  )}
                  {tableRows.map(item => {
                    const heroValue = firstExtendedFieldValue(item, ['hero_image', 'object_a_image', 'thumbnail', 'video_cover']);
                    const detailValue = firstExtendedFieldValue(item, ['detail_images', 'object_b_image', 'test_before_image', 'test_after_image']);
                    const testValue = firstExtendedFieldValue(item, ['test_images', 'raw_video_file', 'edited_video_file', 'report_file', 'supporting_files']);

                    return (
                      <tr key={item.id} onClick={() => setSelectedId(item.id)} className="cursor-pointer hover:bg-blue-50/50">
                        <td className="px-3 py-2 font-black text-[#071a41]">{item.id}</td>
                        <td className="px-3 py-2 font-bold text-slate-600">{activeComparisonType}</td>
                        <td className="px-3 py-2 font-bold text-slate-600">
                          {heroValue ? (
                            <AttachmentPreviewStrip value={heroValue} previewRegistry={attachmentPreviewRegistry} compact />
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2 font-bold text-slate-600">
                          {detailValue ? (
                            <AttachmentPreviewStrip value={detailValue} previewRegistry={attachmentPreviewRegistry} compact />
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2 font-bold text-slate-600">
                          {testValue ? (
                            <AttachmentPreviewStrip value={testValue} previewRegistry={attachmentPreviewRegistry} compact />
                          ) : '—'}
                        </td>
                        <td className="max-w-[220px] px-3 py-2 font-bold text-slate-600">{item.riskBoundary}</td>
                        <td className="px-3 py-2"><span className={`rounded-full border px-2 py-1 font-black ${toneForTrust(item.trustLevel)}`}>{item.trustLevel}</span></td>
                        <td className="px-3 py-2 text-blue-600"><Eye className="inline h-4 w-4" /> <Pencil className="inline h-4 w-4" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </section>

        <aside className="space-y-3">
          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="text-sm font-black text-[#071a41]">对比图说明模板</h2>
            {[
              ['对比目的', '说明要验证的差异点与业务意义'],
              ['对比对象 A / B', '明确两组对比对象的产品/方案'],
              ['控制变量', '保持一致的条件与环境'],
              ['关键参数', '温度、压力、速度等核心参数'],
              ['图像说明', '每张图的拍摄条件与呈现说明'],
              ['风险边界', '适用范围与不适用场景说明'],
            ].map(([title, desc]) => (
              <div key={title} className="mt-2 flex gap-2 rounded-md bg-slate-50 px-3 py-2">
                <FileText className="mt-0.5 h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-xs font-black text-[#071a41]">{title}</p>
                  <p className="text-[11px] font-bold text-slate-500">{desc}</p>
                </div>
              </div>
            ))}
          </section>
          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="text-sm font-black text-[#071a41]">客户最关心的问题</h2>
            {['哪个底材效果更真实？', '同一底材换膜差别多大？', '错误参数会怎样？'].map((question, index) => (
              <div key={question} className="mt-2 flex items-center justify-between rounded-md border border-slate-100 px-3 py-2">
                <span className="text-xs font-black text-[#071a41]">Q{index + 1} {question}</span>
                <span className="text-[11px] font-bold text-slate-400">{128 - index * 32} 人浏览</span>
              </div>
            ))}
          </section>
        </aside>
      </div>
    );
  };

  const renderVideo = () => {
    const records = currentRecords;
    const record = records.find(item => item.id === selectedRecordId) || records[0] || activeRecord;
    const videoStructure = ['展示底材', '展示膜材', '展示设备/测试动作', '展示烫印过程', '展示局部效果', '展示耐磨/胶带/折弯测试', '展示结论字幕'];

    return (
      <div className="grid grid-cols-1 gap-3 p-4 2xl:grid-cols-[260px_minmax(0,1fr)_390px]">
        <aside className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <h2 className="text-sm font-black text-[#071a41]">标准视频结构</h2>
          <div className="mt-3 space-y-2">
            {videoStructure.map((step, index) => (
              <div key={step} className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50/40 px-3 py-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">{index + 1}</span>
                <span className="text-xs font-black text-[#071a41]">{step}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs font-bold leading-relaxed text-slate-500">建议时长 60-180 秒，必须能看到底材、膜材、设备动作、参数或结论字幕，避免只展示结果图。</p>
        </aside>

        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
            {[
              ['已发布视频', records.filter(item => item.status === '已发布').length],
              ['待审核视频', records.filter(item => item.status === '待审核').length],
              ['公开视频', records.filter(item => item.visibility !== '仅内部').length],
              ['平均完整度', `${records.length ? Math.round(records.reduce((sum, item) => sum + completeness(item), 0) / records.length) : 0}%`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <p className="text-[11px] font-black text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-black text-[#071a41]">{value}</p>
              </div>
            ))}
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-black text-[#071a41]">证据主表 · 过程短视频视图</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => notifyAction('视频上传已进入结构化流程：上传后必须标注底材、膜材、过程和结论字幕。')}
                  className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-black text-blue-700"
                >
                  <Upload className="mr-1 inline h-4 w-4" />上传视频素材
                </button>
                <button
                  onClick={() => notifyAction('已按标准视频结构生成客户版短视频任务，等待审核后发布。')}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white"
                >
                  <Sparkles className="mr-1 inline h-4 w-4" />生成客户版短视频
                </button>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {records.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-10 text-center text-xs font-black text-slate-400">
                  当前证据主表中没有匹配的过程短视频
                </div>
              )}
              {records.slice(0, 6).map((item, index) => (
                <button key={item.id} onClick={() => setSelectedId(item.id)} className={`grid w-full grid-cols-[150px_minmax(0,1fr)_170px] gap-3 rounded-lg border p-2 text-left transition ${item.id === record?.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                  <div className="relative h-24 overflow-hidden rounded-lg">
                    <VisualTile label={`0${index + 1}:${28 + index * 9}`} tone={index % 2 ? 'paper' : 'gold'} />
                    <span className="absolute inset-0 flex items-center justify-center text-2xl font-black text-white/90">▶</span>
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-black text-[#071a41]">{item.title}</p>
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-bold text-slate-500">
                      <span>场景：{item.scene}</span>
                      <span>底材：{item.substrate}</span>
                      <span>产品：{item.foilModel}</span>
                      <span>参数：{item.keyParameters}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <div className="flex gap-1">
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-black ${toneForTrust(item.trustLevel)}`}>{item.trustLevel}</span>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-black ${statusTone(item.status)}`}>{item.status}</span>
                    </div>
                    <div className="flex gap-3 text-xs font-black text-blue-600">
                      <span><Eye className="inline h-4 w-4" /> 预览</span>
                      <span><Pencil className="inline h-4 w-4" /> 编辑</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </section>

        <aside className="space-y-3">
          {record && (
            <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <h2 className="text-sm font-black text-[#071a41]">视频元数据 / 审核信息</h2>
              <div className="mt-3 h-44 overflow-hidden rounded-lg">
                <VisualTile label="视频预览" tone="gold" />
              </div>
              <div className="mt-3 grid grid-cols-[90px_minmax(0,1fr)] gap-y-1.5 text-xs">
                {[
                  ['视频编号', `VID-${record.id.replace(/\D/g, '').slice(-6) || '0001'}`],
                  ['关联证据卡', record.id],
                  ['场景', record.scene],
                  ['底材', record.substrate],
                  ['关键参数', record.keyParameters],
                  ['风险提示', record.riskBoundary],
                  ['审核状态', record.status],
                ].map(([label, value]) => (
                  <React.Fragment key={label}>
                    <span className="font-black text-slate-500">{label}</span>
                    <span className="font-bold text-[#071a41]">{value}</span>
                  </React.Fragment>
                ))}
              </div>
            </section>
          )}
          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="text-sm font-black text-[#071a41]">为什么视频更可信</h2>
            {['现场实拍', '参数同步展示', '过程可验证', '失败也可记录', '可与证据卡联动'].map(item => (
              <div key={item} className="mt-2 flex items-center gap-2 rounded-md bg-blue-50/50 px-3 py-2 text-xs font-black text-blue-700">
                <CheckCircle2 className="h-4 w-4" />{item}
              </div>
            ))}
          </section>
        </aside>
      </div>
    );
  };

  const renderReport = () => {
    const records = currentRecords;
    const record = records.find(item => item.id === selectedRecordId) || records[0] || activeRecord;
    const reportSections = ['客户需求', '推荐方案', '关联证据', '关键参数', '测试结果', '风险提示', '下一步建议'];
    const reportCandidateRecords = Array.from(new Map([
      ...salesRecommendations.map(item => item.record),
      ...records,
      ...evidenceRecords.filter(item => item.type === '场景证据卡' || item.type === '对比图' || item.type === '视频'),
    ].map(item => [item.id, item])).values()).slice(0, 10);
    const effectiveReportIds = new Set(reportEvidenceRecords.map(item => item.id));
    const reportPrimary = reportEvidenceRecords[0] || record;
    const reportTrust = strongestTrustLevel(reportEvidenceRecords);
    const reportSolution = summarizeRecommendedSolution(reportEvidenceRecords);
    const reportRisks = uniqueValues(reportEvidenceRecords.map(item => item.riskBoundary), 3);
    const reportParameters = uniqueValues(reportEvidenceRecords.map(item => item.keyParameters), 4);
    const reportRealShotCount = reportEvidenceRecords.filter(item => item.realShotFlag).length;
    const fieldClass = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-[#071a41] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

    return (
      <div className="grid grid-cols-1 gap-3 p-4 2xl:grid-cols-[260px_minmax(320px,0.95fr)_minmax(420px,1.3fr)]">
        <aside className="space-y-3">
          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="text-sm font-black text-[#071a41]">报告模板</h2>
            {[
              ['一页式可信报告', '用于快速询盘沟通'],
              ['场景验证报告', '用于重点客户打样推进'],
              ['英文版报告', '面向海外客户沟通'],
            ].map(([title, desc]) => {
              const active = reportTemplate === title;
              return (
              <button
                key={title}
                onClick={() => {
                  setReportTemplate(title);
                  notifyAction(`报告模板已切换为：${title}`);
                }}
                className={`mt-2 flex w-full items-center gap-3 rounded-lg border p-3 text-left ${active ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-[#071a41]">{title}</p>
                  <p className="text-xs font-bold text-slate-500">{desc}</p>
                </div>
              </button>
              );
            })}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="text-sm font-black text-[#071a41]">客户信息</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[11px] font-black text-slate-500">客户名称</span>
                <input value={reportCustomerName} onChange={(event) => setReportCustomerName(event.target.value)} className={fieldClass} />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-black text-slate-500">客户阶段</span>
                <select value={reportCustomerStage} onChange={(event) => setReportCustomerStage(event.target.value)} className={fieldClass}>
                  {['询盘', '打样', '报价', '重点客户', '复购'].map(stage => <option key={stage} value={stage}>{stage}</option>)}
                </select>
              </label>
            </div>
            <label className="mt-3 block space-y-1">
              <span className="text-[11px] font-black text-slate-500">客户需求摘要</span>
              <textarea
                value={customerNeed}
                onChange={(event) => setCustomerNeed(event.target.value)}
                className="min-h-28 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold leading-relaxed text-[#071a41] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </section>

          <section className="rounded-lg border border-blue-100 bg-blue-50/70 p-3 shadow-sm">
            <h2 className="text-sm font-black text-blue-800">生成流程</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {['选择模板', '选择证据', '生成报告', '审核导出'].map((step, index) => (
                <div key={step} className="rounded-lg bg-white/80 px-2 py-2 text-center">
                  <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[11px] font-black text-white">{index + 1}</span>
                  <p className="mt-1 text-[11px] font-black text-slate-600">{step}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              ['关联证据', reportEvidenceRecords.length],
              ['实拍证据', reportRealShotCount],
              ['整体可信等级', reportTrust],
              ['风险边界', reportRisks.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <p className="text-[11px] font-black text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-black text-[#071a41]">{value}</p>
              </div>
            ))}
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-[#071a41]">证据池选择</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={useRecommendedEvidenceForReport}
                  className="rounded-md border border-blue-200 px-2 py-1 text-[11px] font-black text-blue-700 hover:bg-blue-50"
                >
                  使用推荐
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedReportEvidenceIds([]);
                    notifyAction('已恢复为按客户需求自动推荐的报告证据池。');
                  }}
                  className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-black text-slate-600 hover:bg-slate-50"
                >
                  自动推荐
                </button>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {reportCandidateRecords.map(item => {
                const selected = effectiveReportIds.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleReportEvidence(item.id)}
                    className={`w-full rounded-lg border p-2 text-left transition ${selected ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="line-clamp-1 text-sm font-black text-[#071a41]">{item.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] font-bold text-slate-500">{item.type} · {item.substrate} · {item.keyParameters}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${toneForTrust(item.trustLevel)}`}>{item.trustLevel}</span>
                        {selected ? <CheckCircle2 className="h-4 w-4 text-blue-600" /> : <Plus className="h-4 w-4 text-slate-300" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-[#071a41]">报告内容编排</h2>
              <span className="text-xs font-bold text-slate-400">由客户需求 + 证据池生成</span>
            </div>
            <div className="mt-3 space-y-1.5">
              {reportSections.map((section, index) => (
                <div key={section} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300">::</span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-xs font-black text-blue-700">{index + 1}</span>
                    <span className="text-sm font-black text-[#071a41]">{section}</span>
                  </div>
                  <span className="text-xs font-black text-emerald-600">{index === 0 ? '来自客户需求' : '来自证据主表'}</span>
                </div>
              ))}
            </div>
          </section>
        </section>

        {reportPrimary && (
          <aside className="space-y-3">
            <div className="flex justify-end gap-2">
              <button
                onClick={() => notifyAction(`已创建 ${reportTemplate} 草稿，并关联 ${reportEvidenceRecords.length} 条证据。`)}
                className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-black text-blue-700"
              >
                <Plus className="mr-1 inline h-4 w-4" />新建报告
              </button>
              <button
                onClick={() => notifyAction(`${reportTemplate} 已进入导出队列：${reportEvidenceRecords.length} 条证据、${reportRisks.length} 条风险边界会随报告导出。`)}
                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white"
              >
                <Download className="mr-1 inline h-4 w-4" />导出 PDF
              </button>
            </div>
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <p className="text-xs font-black text-blue-600">可信云｜营销可信</p>
                  <h2 className="mt-1 text-xl font-black text-[#071a41]">{reportTemplate}</h2>
                  <p className="text-sm font-bold text-slate-500">{reportCustomerName} · {reportCustomerStage}</p>
                </div>
                <div className="text-right text-xs font-bold text-slate-500">
                  <p>报告编号：RPT-{reportPrimary.id.replace(/\D/g, '').slice(-6) || '000001'}</p>
                  <p>生成时间：2026-07-06</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-black text-blue-600">01 客户需求</p>
                  <p className="mt-1 line-clamp-4 text-xs font-bold leading-relaxed text-slate-600">{customerNeed}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-black text-blue-600">02 推荐方案</p>
                  <p className="mt-1 line-clamp-4 text-xs font-bold leading-relaxed text-slate-600">{reportSolution}</p>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-blue-600">03 关联证据</p>
                  <span className={`rounded-full border px-2 py-1 text-[11px] font-black ${toneForTrust(reportTrust)}`}>整体 {reportTrust}</span>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {reportEvidenceRecords.slice(0, 4).map((item, index) => (
                    <div key={item.id} className="grid grid-cols-[70px_minmax(0,1fr)] gap-2 rounded-lg bg-slate-50 p-2">
                      <VisualTile label={item.type} tone={index % 3 === 0 ? 'gold' : index % 3 === 1 ? 'paper' : 'blue'} />
                      <div className="min-w-0">
                        <p className="line-clamp-1 text-xs font-black text-[#071a41]">{item.title}</p>
                        <p className="mt-1 line-clamp-2 text-[11px] font-bold text-slate-500">{item.testResult}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-black text-blue-600">04 关键参数</p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs font-black text-slate-600">
                  {(reportParameters.length ? reportParameters : [reportPrimary.keyParameters]).slice(0, 3).map(value => <span key={value} className="rounded-md bg-slate-50 px-2 py-2">{value}</span>)}
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3">
                <p className="text-xs font-black text-orange-700">06 风险提示</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs font-bold leading-relaxed text-orange-700">
                  {(reportRisks.length ? reportRisks : [reportPrimary.riskBoundary]).map(risk => <li key={risk}>{risk}</li>)}
                </ul>
              </div>
              <p className="mt-4 text-center text-xs font-black text-slate-500">最终效果建议以客户实际材料打样确认</p>
            </section>
          </aside>
        )}
      </div>
    );
  };

  const renderReview = () => (
    <div className="grid grid-cols-1 gap-3 p-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <EvidenceTable records={currentRecords.length ? currentRecords : filteredRecords.filter(record => record.status !== '已发布')} selectedId={selectedRecordId} onSelect={setSelectedId} />
      <aside className="space-y-3">
        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <h2 className="text-sm font-black text-[#071a41]">审核四件事</h2>
          {[
            ['是否真实拍摄', activeRecord?.realShotFlag ? '通过' : '需补图'],
            ['参数是否可见', activeRecord && !activeRecord.keyParameters.startsWith('待补') ? '通过' : '不完整'],
            ['技术结论是否准确', activeRecord && !activeRecord.testResult.startsWith('待补') ? '通过' : '需修改'],
            ['是否有过度承诺', activeRecord?.forbiddenClaims ? '未发现' : '待复核'],
          ].map(([item, result]) => (
            <div key={item} className="mt-2 flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-xs font-black text-slate-600">
              {item}
              <span className={`rounded-full px-2 py-1 ${result === '通过' || result === '未发现' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{result}</span>
            </div>
          ))}
        </section>
        {activeRecord && (
          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="text-sm font-black text-[#071a41]">审核结论</h2>
            <p className="mt-2 text-xs font-bold leading-relaxed text-slate-500">{activeRecord.title}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => notifyAction(`${activeRecord.id} 已标记为审核通过：可进入发布中心。`)}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white"
              >
                审核通过
              </button>
              <button
                onClick={() => notifyAction(`${activeRecord.id} 已退回修改：请补充实拍、参数或风险边界。`)}
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700"
              >
                退回修改
              </button>
            </div>
          </section>
        )}
        {activeRecord && renderCoreChecklist(activeRecord)}
      </aside>
    </div>
  );

  const renderTags = () => (
    <div className="space-y-3 p-4">
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-base font-black text-[#071a41]">标签体系决定销售检索效率</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-7">
          {['行业', '底材', '效果', '工艺', '风险', '产品', '客户阶段'].map((tagType, index) => (
            <button
              key={tagType}
              onClick={() => {
                setSearchQuery(tagType);
                notifyAction(`已切换到「${tagType}」标签检索，下面列表显示相关候选证据。`);
              }}
              className="rounded-lg border border-slate-200 p-3 text-left hover:border-blue-200 hover:bg-blue-50/40"
            >
              <Tags className="h-5 w-5 text-blue-600" />
              <p className="mt-2 text-sm font-black text-[#071a41]">{tagType}</p>
              <p className="text-xs font-bold text-slate-500">使用 {Math.max(8, Math.round(evidenceRecords.length / (index + 2)))} 次</p>
            </button>
          ))}
        </div>
      </section>
      <EvidenceTable records={filteredRecords} selectedId={selectedRecordId} onSelect={setSelectedId} compact />
    </div>
  );

  const renderPublish = () => (
    <div className="grid grid-cols-1 gap-3 p-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-[#071a41]">发布中心</h2>
          <button
            onClick={() => notifyAction('已创建发布记录草稿：请选择渠道、格式、语言并复核可见范围。')}
            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white"
          >
            <Upload className="mr-1 inline h-4 w-4" />创建发布记录
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-6">
          {['阿里巴巴国际站', '官网', 'Shopify', 'WhatsApp', '邮件', '展会'].map(channel => (
            <button
              key={channel}
              onClick={() => notifyAction(`发布渠道已选中：${channel}。系统将只推荐可公开或脱敏公开证据。`)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-left hover:border-blue-200 hover:bg-blue-50/40"
            >
              <p className="text-sm font-black text-[#071a41]">{channel}</p>
              <p className="text-xs font-bold text-slate-500">待发布 {Math.max(1, Math.round(metrics.publicCount / 12))}</p>
            </button>
          ))}
        </div>
        <div className="mt-3">
          <EvidenceTable records={currentRecords.length ? currentRecords : filteredRecords.filter(record => record.visibility !== '仅内部')} selectedId={selectedRecordId} onSelect={setSelectedId} compact />
        </div>
      </section>
      <aside className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-sm font-black text-[#071a41]">发布前检查</h2>
        {['可见范围不是仅内部', '风险边界已写明', '客户信息已脱敏', '禁止承诺已确认'].map(item => (
          <div key={item} className="mt-2 flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs font-black text-slate-600">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />{item}
          </div>
        ))}
      </aside>
    </div>
  );

  const renderQuestions = () => (
    <div className="grid grid-cols-1 gap-3 p-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-base font-black text-[#071a41]">客户问题库</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {[
            ['这个是不是实拍？', '实拍', '推荐证据卡 + 过程短视频'],
            ['换我的底材会怎样？', '底材', '推荐对比图 + 风险边界'],
            ['参数是多少？', '参数', '推荐主表关键参数'],
            ['有没有失败案例？', '失败案例', '推荐风险复盘'],
            ['样品和量产是否一致？', '量产一致性', '推荐交付可信链'],
            ['能不能公开给客户？', '公开权限', '检查可见范围'],
          ].map(([question, type, answer]) => (
            <button
              key={question}
              onClick={() => {
                setSearchQuery(type);
                notifyAction(`已按客户问题「${question}」匹配证据与标准话术。`);
              }}
              className="rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-blue-200 hover:bg-blue-50/40"
            >
              <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">{type}</span>
              <p className="mt-3 text-sm font-black text-[#071a41]">{question}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">{answer}</p>
            </button>
          ))}
        </div>
      </section>
      <aside className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-sm font-black text-[#071a41]">推荐回答规则</h2>
        {['先确认客户场景', '只调用已审核证据', '必须带风险边界', '不能承诺所有底材通用'].map(item => (
          <div key={item} className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs font-black text-slate-600">{item}</div>
        ))}
      </aside>
    </div>
  );

  const renderEvidenceDetailPanel = () => {
    if (!detailRecord) return null;
    const detailCompleteness = completeness(detailRecord);
    const detailExtendedSections = MAIN_TABLE_EXTENSION_SECTIONS
      .map(section => ({
        ...section,
        fields: section.fields
          .map(field => ({
            ...field,
            value: detailRecord.extendedFields?.[field.key] || '',
          }))
          .filter(field => Boolean(String(field.value).trim())),
      }))
      .filter(section => section.fields.length > 0);
    const extendedCount = detailExtendedSections.reduce((sum, section) => sum + section.fields.length, 0);
    const readingPath = [
      ['场景', detailRecord.scene],
      ['底材', detailRecord.substrate],
      ['膜材', detailRecord.foilModel],
      ['参数', detailRecord.keyParameters],
      ['结论', detailRecord.testResult],
    ];
    const healthItems = [
      ['字段完整度', `${detailCompleteness}%`, detailCompleteness >= 100 ? 'text-emerald-700 bg-emerald-50' : detailCompleteness >= 80 ? 'text-blue-700 bg-blue-50' : 'text-amber-700 bg-amber-50'],
      ['可信等级', detailRecord.trustLevel, toneForTrust(detailRecord.trustLevel)],
      ['当前状态', detailRecord.status, statusTone(detailRecord.status)],
      ['可见范围', detailRecord.visibility, 'text-slate-600 bg-slate-100'],
    ];

    const copyEvidenceId = async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(detailRecord.id);
          notifyAction(`已复制证据编号：${detailRecord.id}`);
          return;
        }
      } catch {
        // Fall through to the manual copy message.
      }
      notifyAction(`请手动复制证据编号：${detailRecord.id}`);
    };

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        onClick={() => setIsEvidenceDetailOpen(false)}
        className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-xs"
      >
        <motion.div
          initial={{ x: '100%', opacity: 0.92 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0.92 }}
          transition={{ type: 'spring', damping: 28, stiffness: 240 }}
          onClick={(event) => event.stopPropagation()}
          className="flex h-full w-full max-w-6xl flex-col border-l border-slate-200 bg-white text-[#071a41] shadow-2xl"
        >
          <div className="shrink-0 border-b border-slate-200 bg-white">
            <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                    证据资产详情
                  </span>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${toneForTrust(detailRecord.trustLevel)}`}>
                    {detailRecord.trustLevel}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${statusTone(detailRecord.status)}`}>
                    {detailRecord.status}
                  </span>
                </div>
                <h2 className="mt-3 max-w-4xl text-2xl font-black leading-tight text-[#071a41]">{detailRecord.title}</h2>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {detailRecord.id} · {detailRecord.type} · {detailRecord.sourceType} · 更新 {detailRecord.updatedAt}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEvidenceEditPanel([detailRecord.id])}
                  className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-blue-700"
                >
                  <Pencil className="mr-1 inline h-4 w-4" />编辑数据
                </button>
                <button
                  type="button"
                  onClick={copyEvidenceId}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm hover:bg-slate-50"
                >
                  <Copy className="mr-1 inline h-4 w-4" />复制编号
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onActiveViewChange(VIEW_BY_EVIDENCE_TYPE[detailRecord.type]);
                    setTypeFilter(detailRecord.type);
                    setSelectedId(detailRecord.id);
                    setIsEvidenceDetailOpen(false);
                  }}
                  className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-blue-700"
                >
                  打开类型视图
                </button>
                <button
                  type="button"
                  onClick={() => setIsEvidenceDetailOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-[#071a41]"
                  aria-label="关闭证据详情"
                  title="关闭"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#f6f8fc] p-5">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-4">
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 bg-[#071a41] px-4 py-3 text-white">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-blue-100">Evidence reading strip</p>
                        <h3 className="mt-1 text-lg font-black">可信判读带</h3>
                      </div>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-blue-50">
                        从客户场景读到风险边界
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-5 md:divide-x md:divide-y-0">
                    {readingPath.map(([label, value], index) => (
                      <div key={label} className="relative min-h-28 bg-white px-4 py-3">
                        <div className="absolute left-0 top-0 h-1 w-full bg-blue-600" style={{ opacity: 0.35 + index * 0.12 }} />
                        <p className="text-[11px] font-black text-slate-400">{label}</p>
                        <p className="mt-2 line-clamp-4 text-sm font-black leading-relaxed text-[#071a41]">{value || '未填写'}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-base font-black text-blue-700">证据主表核心字段</h3>
                      <p className="mt-1 text-xs font-bold text-slate-500">销售检索、报告生成和类型视图优先读取这些字段。</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                      P0 / P1 字段
                    </span>
                  </div>
                  <div className="mt-3">
                    <FieldGrid asset={detailRecord} />
                  </div>
                </section>

                <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                      <h3 className="text-base font-black text-orange-800">风险边界</h3>
                    </div>
                    <p className="mt-3 text-sm font-bold leading-relaxed text-orange-800">{detailRecord.riskBoundary || '未填写风险边界。'}</p>
                    <div className="mt-3 rounded-xl bg-white/75 px-3 py-2">
                      <p className="text-[11px] font-black text-orange-600">禁止承诺</p>
                      <p className="mt-1 text-xs font-bold leading-relaxed text-slate-700">{detailRecord.forbiddenClaims || '未填写禁止承诺。'}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="h-5 w-5 text-blue-600" />
                      <h3 className="text-base font-black text-blue-700">客户可用话术</h3>
                    </div>
                    <p className="mt-3 text-sm font-bold leading-relaxed text-[#071a41]">{detailRecord.salesScript || '未生成客户话术。'}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerNeed(detailRecord.salesScript || detailRecord.title);
                        notifyAction('已把该证据话术带入销售调用区。');
                      }}
                      className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
                    >
                      带入销售调用
                    </button>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-base font-black text-blue-700">扩展字段</h3>
                      <p className="mt-1 text-xs font-bold text-slate-500">场景证据卡、对比图、视频、报告等类型视图共享证据主表扩展字段。</p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{extendedCount} 已填写</span>
                  </div>
                  {detailExtendedSections.length === 0 ? (
                    <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-black text-slate-400">
                      当前资产暂无已填写扩展字段
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {detailExtendedSections.map(section => (
                        <div key={section.title} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                          <p className="text-xs font-black text-slate-500">{section.title}</p>
                          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                            {section.fields.map(field => (
                              <div key={field.key} className="rounded-lg bg-white px-3 py-2 shadow-sm">
                                <p className="text-[11px] font-black text-slate-400">{field.label}</p>
                                <div className="mt-1 text-sm font-black leading-relaxed text-[#071a41]">
                                  {isAttachmentField(field) ? (
                                    <AttachmentPreviewStrip value={field.value} previewRegistry={attachmentPreviewRegistry} />
                                  ) : (
                                    field.value
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <aside className="space-y-4">
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-black text-[#071a41]">资产健康摘要</h3>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {healthItems.map(([label, value, tone]) => (
                      <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                        <p className="text-[11px] font-black text-slate-400">{label}</p>
                        <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-black ${tone}`}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {renderCoreChecklist(detailRecord)}

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-black text-[#071a41]">证据归属</h3>
                  <div className="mt-3 space-y-2 text-xs font-bold text-slate-600">
                    {[
                      ['负责人', detailRecord.owner],
                      ['应用行业', detailRecord.industry],
                      ['工艺方式', detailRecord.processType],
                      ['设备', detailRecord.equipment],
                      ['关联知识', detailRecord.linkedKnowledgeId || '未关联'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                        <span className="shrink-0 font-black text-slate-400">{label}</span>
                        <span className="text-right text-[#071a41]">{value}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-black text-[#071a41]">标签</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {detailRecord.tags.length ? detailRecord.tags.map(tag => (
                      <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">{tag}</span>
                    )) : (
                      <span className="text-xs font-black text-slate-400">未设置标签</span>
                    )}
                  </div>
                </section>

                {localEvidenceIds.has(detailRecord.id) && (
                  <button
                    type="button"
                    onClick={() => removeLocalEvidence(detailRecord.id)}
                    className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700 shadow-sm hover:bg-rose-100"
                  >
                    删除本地草稿
                  </button>
                )}
              </aside>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  const renderEvidenceEditPanel = () => {
    if (!isEvidenceEditOpen) return null;
    const isBatch = editingEvidenceIds.length > 1;
    const targetRecords = editingEvidenceIds
      .map(id => evidenceRecords.find(record => record.id === id))
      .filter((record): record is EvidenceAsset => Boolean(record));
    const fieldClass = 'h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-[#071a41] shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100';
    const textareaClass = 'min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold leading-relaxed text-[#071a41] shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100';
    const labelClass = 'text-xs font-black text-slate-500';

    const updateEditForm = <K extends keyof EvidenceEditForm>(field: K, value: EvidenceEditForm[K]) => {
      setEditForm(current => ({ ...current, [field]: value }));
    };
    const updateExtendedEditField = (field: string, value: string) => {
      setEditForm(current => ({
        ...current,
        extendedFields: {
          ...current.extendedFields,
          [field]: value,
        },
      }));
    };
    const renderEditTextField = (
      field: keyof EvidenceEditForm,
      label: string,
      placeholder: string,
      kind: 'input' | 'textarea' = 'input',
    ) => (
      <label className="space-y-1.5">
        <span className={labelClass}>{label}</span>
        {kind === 'textarea' ? (
          <textarea
            value={String(editForm[field] || '')}
            onChange={(event) => updateEditForm(field, event.target.value as EvidenceEditForm[typeof field])}
            className={textareaClass}
            placeholder={isBatch ? `留空不修改${label}` : placeholder}
          />
        ) : (
          <input
            value={String(editForm[field] || '')}
            onChange={(event) => updateEditForm(field, event.target.value as EvidenceEditForm[typeof field])}
            className={fieldClass}
            placeholder={isBatch ? `留空不修改${label}` : placeholder}
          />
        )}
      </label>
    );

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        onClick={() => setIsEvidenceEditOpen(false)}
        className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-xs"
      >
        <motion.div
          initial={{ x: '100%', opacity: 0.92 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0.92 }}
          transition={{ type: 'spring', damping: 28, stiffness: 240 }}
          onClick={(event) => event.stopPropagation()}
          className="flex h-full w-full max-w-3xl flex-col border-l border-slate-200 bg-white text-[#071a41] shadow-2xl"
        >
          <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-blue-600">Evidence editor</p>
                <h2 className="mt-1 text-2xl font-black leading-tight text-[#071a41]">
                  {isBatch ? '批量编辑证据数据' : '编辑证据数据'}
                </h2>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {isBatch ? `将对 ${targetRecords.length} 条选中证据应用非空字段。` : targetRecords[0]?.title || '当前证据'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEvidenceEditOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-[#071a41]"
                aria-label="关闭编辑面板"
                title="关闭"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#f6f8fc] p-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Database className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-black text-blue-700">主表可编辑字段</h3>
                  <p className="mt-0.5 text-xs font-bold text-slate-500">
                    {isBatch ? '批量模式下空白字段不会覆盖原数据。' : '单条模式已带入当前值，保存后主表和详情会立即刷新。'}
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-5">
                <div>
                  <p className="mb-3 text-xs font-black text-blue-700">1. 基础信息</p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className={labelClass}>证据类型</span>
                      <select
                        value={editForm.type}
                        onChange={(event) => updateEditForm('type', event.target.value as EvidenceEditForm['type'])}
                        className={fieldClass}
                      >
                        <option value="">{isBatch ? '不修改' : '请选择类型'}</option>
                        {EVIDENCE_TYPE_OPTIONS.filter(option => option !== '全部类型').map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1.5">
                      <span className={labelClass}>状态</span>
                      <select
                        value={editForm.status}
                        onChange={(event) => updateEditForm('status', event.target.value as EvidenceEditForm['status'])}
                        className={fieldClass}
                      >
                        <option value="">{isBatch ? '不修改' : '请选择状态'}</option>
                        {STATUS_OPTIONS.filter(option => option !== '全部状态').map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                    {renderEditTextField('title', '证据标题', '例如：化妆品盒亮金烫印实拍证据卡')}
                    {renderEditTextField('sourceType', '数据来源', '内部测试 / 客户打样 / 现场实拍视频')}
                    {renderEditTextField('owner', '负责人', '数据运营 / 工艺主管 / 销售')}
                    {renderEditTextField('scene', '客户场景', '化妆品盒 / 酒盒 / 标签 / 皮革')}
                    {renderEditTextField('industry', '应用行业', '化妆品包装 / 礼盒包装')}
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs font-black text-blue-700">2. 材料与工艺</p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {renderEditTextField('substrate', '使用底材', '350g 白卡纸 + 哑膜')}
                    {renderEditTextField('surfaceTreatment', '表面处理', '覆膜 / UV / 油墨层')}
                    {renderEditTextField('foilModel', '膜型号', 'PN-Gold-01 / KJ-302G')}
                    {renderEditTextField('foilColor', '颜色 / 型号', '亮金 / 哑金 / 镭射银')}
                    {renderEditTextField('processType', '工艺方式', '热烫 / 冷烫 / 热转印')}
                    {renderEditTextField('equipment', '设备类型', '平压烫金机 / 打样机')}
                    {renderEditTextField('keyParameters', '关键参数', '120℃ / 中压 / 25m/min')}
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs font-black text-blue-700">3. 测试、结果与风险</p>
                  <div className="grid grid-cols-1 gap-4">
                    {renderEditTextField('testResult', '测试结果', '附着力通过，耐磨 200 次无明显掉色；或说明失败结果。', 'textarea')}
                    {renderEditTextField('visualResult', '视觉与耐磨效果', '高亮、边缘清晰、无明显飞金。', 'textarea')}
                    {renderEditTextField('defectResult', '缺陷 / 异常', '无 / 掉粉 / 漏烫 / 糊版 / 色差', 'textarea')}
                    {renderEditTextField('riskBoundary', '风险边界', '换底材、换覆膜、换 UV 油墨、换设备或参数时需重新测试。', 'textarea')}
                    {renderEditTextField('forbiddenClaims', '禁止承诺', '不得承诺所有底材 100% 稳定，未测试条件必须先打样。', 'textarea')}
                    {renderEditTextField('salesScript', '销售客户话术', '用于询盘回复、报价附件或 WhatsApp 图文。', 'textarea')}
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs font-black text-blue-700">4. 发布与标签</p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <label className="space-y-1.5">
                      <span className={labelClass}>可信等级</span>
                      <select
                        value={editForm.trustLevel}
                        onChange={(event) => updateEditForm('trustLevel', event.target.value as EvidenceEditForm['trustLevel'])}
                        className={fieldClass}
                      >
                        <option value="">{isBatch ? '不修改' : '请选择等级'}</option>
                        {TRUST_OPTIONS.filter(option => option !== '全部等级').map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1.5">
                      <span className={labelClass}>可见范围</span>
                      <select
                        value={editForm.visibility}
                        onChange={(event) => updateEditForm('visibility', event.target.value as EvidenceEditForm['visibility'])}
                        className={fieldClass}
                      >
                        <option value="">{isBatch ? '不修改' : '请选择范围'}</option>
                        {(['可公开', '脱敏公开', '仅内部', '指定客户'] as Visibility[]).map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1.5">
                      <span className={labelClass}>是否实拍</span>
                      <select
                        value={editForm.realShotFlag}
                        onChange={(event) => updateEditForm('realShotFlag', event.target.value as EvidenceEditForm['realShotFlag'])}
                        className={fieldClass}
                      >
                        <option value="">{isBatch ? '不修改' : '未设置'}</option>
                        <option value="true">是</option>
                        <option value="false">否</option>
                      </select>
                    </label>
                  </div>
                  <label className="mt-4 block space-y-1.5">
                    <span className={labelClass}>标签体系（逗号分隔）</span>
                    <textarea
                      value={editForm.tags}
                      onChange={(event) => updateEditForm('tags', event.target.value)}
                      className="min-h-20 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold leading-relaxed text-[#071a41] shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      placeholder={isBatch ? '留空不修改标签' : '化妆品盒，白卡纸，亮金'}
                    />
                  </label>
                </div>

                <div>
                  <p className="mb-3 text-xs font-black text-blue-700">5. 扩展字段</p>
                  <div className="space-y-4">
                    {MAIN_TABLE_EXTENSION_SECTIONS.map(section => (
                      <div key={section.title} className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                        <p className="text-xs font-black text-slate-600">{section.title}</p>
                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                          {section.fields.map(field => {
                            const value = editForm.extendedFields[field.key] || '';
                            if (isAttachmentField(field)) {
                              return (
                                <div key={field.key} className="md:col-span-2">
                                  <AttachmentUploadField
                                    field={field}
                                    value={value}
                                    onChange={(nextValue) => updateExtendedEditField(field.key, nextValue)}
                                    previewRegistry={attachmentPreviewRegistry}
                                    onRegisterFiles={registerAttachmentFiles}
                                    batchMode={isBatch}
                                  />
                                </div>
                              );
                            }
                            if (field.kind === 'boolean') {
                              return (
                                <label key={field.key} className="space-y-1.5">
                                  <span className={labelClass}>{field.label}</span>
                                  <select
                                    value={value}
                                    onChange={(event) => updateExtendedEditField(field.key, event.target.value)}
                                    className={fieldClass}
                                  >
                                    <option value="">{isBatch ? '不修改' : '未设置'}</option>
                                    <option value="是">是</option>
                                    <option value="否">否</option>
                                  </select>
                                </label>
                              );
                            }
                            if (field.kind === 'select') {
                              return (
                                <label key={field.key} className="space-y-1.5">
                                  <span className={labelClass}>{field.label}</span>
                                  <select
                                    value={value}
                                    onChange={(event) => updateExtendedEditField(field.key, event.target.value)}
                                    className={fieldClass}
                                  >
                                    <option value="">{isBatch ? '不修改' : '请选择'}</option>
                                    {(field.options || []).map(option => <option key={option} value={option}>{option}</option>)}
                                  </select>
                                </label>
                              );
                            }
                            return (
                              <label key={field.key} className={`space-y-1.5 ${field.kind === 'textarea' ? 'md:col-span-2' : ''}`}>
                                <span className={labelClass}>{field.label}</span>
                                {field.kind === 'textarea' ? (
                                  <textarea
                                    value={value}
                                    onChange={(event) => updateExtendedEditField(field.key, event.target.value)}
                                    className={textareaClass}
                                    placeholder={isBatch ? `留空不修改${field.label}` : field.placeholder}
                                  />
                                ) : (
                                  <input
                                    value={value}
                                    onChange={(event) => updateExtendedEditField(field.key, event.target.value)}
                                    className={fieldClass}
                                    placeholder={isBatch ? `留空不修改${field.label}` : field.placeholder}
                                  />
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4">
            <p className="text-xs font-bold leading-relaxed text-slate-500">
              已选 {editingEvidenceIds.length} 条。内置证据会在当前会话覆盖显示，本地草稿会同步写入本机存储。
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setIsEvidenceEditOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 shadow-sm hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveEvidenceEdit}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-700"
              >
                {isBatch ? '应用批量编辑' : '保存编辑'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  const renderCreatePanel = () => {
    const fieldClass = 'h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-[#071a41] shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100';
    const textareaClass = 'min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold leading-relaxed text-[#071a41] shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100';
    const labelClass = 'text-xs font-black text-slate-500';
    const draftMissing = REQUIRED_DRAFT_FIELDS.filter(([field]) => !String(draftForm[field] || '').trim()).length;
    const createdFromPrimary = createOriginView === 'primary';
    const renderExtendedField = (field: DraftFieldSpec) => {
      const value = draftForm.extendedFields[field.key] || '';
      if (isAttachmentField(field)) {
        return (
          <div key={field.key} className="md:col-span-2">
            <AttachmentUploadField
              field={field}
              value={value}
              onChange={(nextValue) => updateExtendedDraftField(field.key, nextValue)}
              previewRegistry={attachmentPreviewRegistry}
              onRegisterFiles={registerAttachmentFiles}
            />
          </div>
        );
      }
      if (field.kind === 'boolean') {
        return (
          <label key={field.key} className="flex min-h-24 items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <span>
              <span className="block text-sm font-black text-[#071a41]">{field.label}</span>
              <span className="mt-1 block text-[11px] font-bold text-slate-400">{field.description}</span>
            </span>
            <input
              type="checkbox"
              checked={value === '是'}
              onChange={(event) => updateExtendedDraftField(field.key, event.target.checked ? '是' : '')}
              className="h-5 w-5 rounded border-slate-300 text-blue-600"
            />
          </label>
        );
      }
      if (field.kind === 'select') {
        return (
          <label key={field.key} className="space-y-1">
            <span className={labelClass}>{field.label}</span>
            <select className={fieldClass} value={value} onChange={(event) => updateExtendedDraftField(field.key, event.target.value)}>
              <option value="">未填写</option>
              {(field.options || []).map(option => <option key={option} value={option}>{option}</option>)}
            </select>
            <span className="block text-[11px] font-bold text-slate-400">{field.description}</span>
          </label>
        );
      }
      if (field.kind === 'textarea') {
        return (
          <label key={field.key} className="space-y-1 md:col-span-2">
            <span className={labelClass}>{field.label}</span>
            <textarea
              className={textareaClass}
              value={value}
              onChange={(event) => updateExtendedDraftField(field.key, event.target.value)}
              placeholder={field.placeholder}
            />
            <span className="block text-[11px] font-bold text-slate-400">{field.description}</span>
          </label>
        );
      }
      return (
        <label key={field.key} className="space-y-1">
          <span className={labelClass}>{field.label}</span>
          <input
            className={fieldClass}
            value={value}
            onChange={(event) => updateExtendedDraftField(field.key, event.target.value)}
            placeholder={field.placeholder}
          />
          <span className="block text-[11px] font-bold text-slate-400">{field.description}</span>
        </label>
      );
    };

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        onClick={() => setIsCreatePanelOpen(false)}
        className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-xs"
      >
        <motion.div
          initial={{ x: '100%', opacity: 0.92 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0.92 }}
          transition={{ type: 'spring', damping: 28, stiffness: 240 }}
          onClick={(event) => event.stopPropagation()}
          className="flex h-full w-full max-w-6xl flex-col border-l border-slate-200 bg-white text-[#071a41] shadow-2xl"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-black text-blue-700">新建营销可信证据</h2>
              </div>
              <p className="mt-1 text-xs font-bold text-slate-500">
                {createdFromPrimary ? '当前从证据主表创建，保存后仍停留在证据主表。' : '当前从业务页面创建，保存后进入对应业务页面。'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-3 py-1.5 text-xs font-black ${draftMissing ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                待补 P0：{draftMissing}
              </span>
              <button
                onClick={() => setIsCreatePanelOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm hover:bg-slate-50"
              >
                关闭
              </button>
              <button
                onClick={saveDraftEvidence}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-blue-700"
              >
                保存证据
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#f6f8fc] p-6">
            {draftError && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-700 shadow-sm">
                {draftError}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-4">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-black text-blue-700">1. 证据主表核心字段</h3>
                    <p className="mt-1 text-xs font-bold text-slate-500">列表、筛选、报告和客户话术会优先读取这些字段。</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">自动编号</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className={labelClass}>证据类型 *</span>
                    <select className={fieldClass} value={draftForm.type} onChange={(event) => updateDraft('type', event.target.value as EvidenceType)}>
                      {EVIDENCE_TYPE_OPTIONS.filter((item): item is EvidenceType => item !== '全部类型').map(item => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className={labelClass}>状态</span>
                    <select className={fieldClass} value={draftForm.status} onChange={(event) => updateDraft('status', event.target.value as EvidenceStatus)}>
                      {STATUS_OPTIONS.filter((item): item is EvidenceStatus => item !== '全部状态').map(item => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="col-span-2 space-y-1">
                    <span className={labelClass}>证据标题 *</span>
                    <input className={fieldClass} value={draftForm.title} onChange={(event) => updateDraft('title', event.target.value)} placeholder="例如：化妆品盒亮金烫印实拍证据卡" />
                  </label>
                  <label className="space-y-1">
                    <span className={labelClass}>数据来源</span>
                    <input className={fieldClass} value={draftForm.sourceType} onChange={(event) => updateDraft('sourceType', event.target.value)} placeholder="内部测试 / 客户打样 / 现场实拍视频" />
                  </label>
                  <label className="space-y-1">
                    <span className={labelClass}>负责人 *</span>
                    <input className={fieldClass} value={draftForm.owner} onChange={(event) => updateDraft('owner', event.target.value)} placeholder="数据运营 / 工艺主管 / 销售" />
                  </label>
                  <label className="space-y-1">
                    <span className={labelClass}>客户场景 *</span>
                    <input className={fieldClass} value={draftForm.scene} onChange={(event) => updateDraft('scene', event.target.value)} placeholder="化妆品盒 / 酒盒 / 标签 / 皮革" />
                  </label>
                  <label className="space-y-1">
                    <span className={labelClass}>应用行业</span>
                    <input className={fieldClass} value={draftForm.industry} onChange={(event) => updateDraft('industry', event.target.value)} placeholder="化妆品包装 / 礼盒包装" />
                  </label>
                  <label className="space-y-1">
                    <span className={labelClass}>使用底材 *</span>
                    <input className={fieldClass} value={draftForm.substrate} onChange={(event) => updateDraft('substrate', event.target.value)} placeholder="350g 白卡纸 + 哑膜" />
                  </label>
                  <label className="space-y-1">
                    <span className={labelClass}>表面处理</span>
                    <input className={fieldClass} value={draftForm.surfaceTreatment} onChange={(event) => updateDraft('surfaceTreatment', event.target.value)} placeholder="覆膜 / UV / 油墨层" />
                  </label>
                  <label className="space-y-1">
                    <span className={labelClass}>膜型号 *</span>
                    <input className={fieldClass} value={draftForm.foilModel} onChange={(event) => updateDraft('foilModel', event.target.value)} placeholder="PN-Gold-01 / KJ-302G" />
                  </label>
                  <label className="space-y-1">
                    <span className={labelClass}>颜色 / 效果</span>
                    <input className={fieldClass} value={draftForm.foilColor} onChange={(event) => updateDraft('foilColor', event.target.value)} placeholder="亮金 / 哑金 / 镭射银" />
                  </label>
                  <label className="space-y-1">
                    <span className={labelClass}>工艺方式</span>
                    <input className={fieldClass} value={draftForm.processType} onChange={(event) => updateDraft('processType', event.target.value)} placeholder="热烫 / 冷烫 / 热转印" />
                  </label>
                  <label className="space-y-1">
                    <span className={labelClass}>设备</span>
                    <input className={fieldClass} value={draftForm.equipment} onChange={(event) => updateDraft('equipment', event.target.value)} placeholder="平压烫金机 / 打样机" />
                  </label>
                  <label className="col-span-2 space-y-1">
                    <span className={labelClass}>关键参数 *</span>
                    <input className={fieldClass} value={draftForm.keyParameters} onChange={(event) => updateDraft('keyParameters', event.target.value)} placeholder="120℃ / 中压 / 25m/min" />
                  </label>
                  <label className="col-span-2 space-y-1">
                    <span className={labelClass}>测试结果摘要 *</span>
                    <textarea className={textareaClass} value={draftForm.testResult} onChange={(event) => updateDraft('testResult', event.target.value)} placeholder="附着力通过，耐磨 200 次无明显掉色；或说明失败结果。" />
                  </label>
                  <label className="space-y-1">
                    <span className={labelClass}>视觉效果结论</span>
                    <textarea className={textareaClass} value={draftForm.visualResult} onChange={(event) => updateDraft('visualResult', event.target.value)} placeholder="高亮、边缘清晰、无明显飞金。" />
                  </label>
                  <label className="space-y-1">
                    <span className={labelClass}>缺陷结果</span>
                    <textarea className={textareaClass} value={draftForm.defectResult} onChange={(event) => updateDraft('defectResult', event.target.value)} placeholder="无 / 掉粉 / 漏烫 / 糊版 / 色差" />
                  </label>
                  <label className="col-span-2 space-y-1">
                    <span className={labelClass}>风险边界 *</span>
                    <textarea className={textareaClass} value={draftForm.riskBoundary} onChange={(event) => updateDraft('riskBoundary', event.target.value)} placeholder="换底材、换覆膜、换 UV 油墨、换设备或参数时需重新测试。" />
                  </label>
                  <label className="col-span-2 space-y-1">
                    <span className={labelClass}>禁止承诺</span>
                    <textarea className={textareaClass} value={draftForm.forbiddenClaims} onChange={(event) => updateDraft('forbiddenClaims', event.target.value)} />
                  </label>
                  <label className="col-span-2 space-y-1">
                    <span className={labelClass}>销售客户话术</span>
                    <textarea className={textareaClass} value={draftForm.salesScript} onChange={(event) => updateDraft('salesScript', event.target.value)} placeholder="用于询盘回复、报价附件或 WhatsApp 图文。" />
                  </label>
                </div>
              </section>

              {MAIN_TABLE_EXTENSION_SECTIONS.map((section, index) => (
                <section key={section.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-base font-black text-blue-700">{index + 2}. {section.title}</h3>
                      <p className="mt-1 text-xs font-bold text-slate-500">{section.subtitle}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black text-blue-700">
                      {section.fields.length} 字段
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {section.fields.map(renderExtendedField)}
                  </div>
                </section>
              ))}
              </div>

              <aside className="space-y-4">
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-black text-[#071a41]">信任与发布控制</h3>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className={labelClass}>可信等级</span>
                      <select className={fieldClass} value={draftForm.trustLevel} onChange={(event) => updateDraft('trustLevel', event.target.value as TrustLevel)}>
                        {TRUST_OPTIONS.filter((item): item is TrustLevel => item !== '全部等级').map(item => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className={labelClass}>可见范围</span>
                      <select className={fieldClass} value={draftForm.visibility} onChange={(event) => updateDraft('visibility', event.target.value as Visibility)}>
                        {['可公开', '脱敏公开', '仅内部', '指定客户'].map(item => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </label>
                  </div>
                  <label className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <span>
                      <span className="block text-sm font-black text-[#071a41]">是否实拍</span>
                      <span className="block text-[11px] font-bold text-slate-500">决定客户第一层真实感</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={draftForm.realShotFlag}
                      onChange={(event) => updateDraft('realShotFlag', event.target.checked)}
                      className="h-5 w-5 rounded border-slate-300 text-blue-600"
                    />
                  </label>
                  <label className="mt-3 block space-y-1">
                    <span className={labelClass}>标签体系（逗号分隔）</span>
                    <textarea className={textareaClass} value={draftForm.tags} onChange={(event) => updateDraft('tags', event.target.value)} placeholder="化妆品盒, 白卡纸, 亮金, 实拍优先" />
                  </label>
                </section>

                <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 shadow-sm">
                  <h3 className="text-sm font-black text-blue-800">业务校验</h3>
                  <div className="mt-2 space-y-2">
                    {REQUIRED_DRAFT_FIELDS.map(([field, label]) => {
                      const ok = Boolean(String(draftForm[field] || '').trim());
                      return (
                        <div key={field} className="flex items-center justify-between rounded-md bg-white/80 px-3 py-2 text-xs font-black text-slate-600">
                          {label}
                          {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-black text-[#071a41]">保存后流向</h3>
                  <p className="mt-2 text-xs font-bold leading-relaxed text-slate-500">
                    {createdFromPrimary
                      ? '本次从「证据主表」创建，保存后仍停留在证据主表；证据类型只作为主表字段，不会强制跳转到子页面。'
                      : `当前类型会进入「${MARKETING_TRUST_NAV_ITEMS.find(item => item.id === VIEW_BY_EVIDENCE_TYPE[draftForm.type])?.label}」，同时计入总览、证据主表、审核与发布筛选。`}
                  </p>
                </section>
              </aside>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  const pageTitle = {
    overview: ['营销可信系统总览', '证据资产数量、完整度、等级分布、销售调用情况'],
    primary: ['营销可信证据主表', '所有图片、视频、报告都先挂到这张主表下面'],
    scene: ['场景证据卡视图', '证据主表中“场景证据卡”类型的数据视图'],
    compare: ['对比证据图视图', '证据主表中“对比图”类型的数据视图'],
    video: ['过程短视频视图', '证据主表中“视频”类型的数据视图'],
    report: ['可信报告视图', '证据主表中“报告”类型的数据视图'],
    review: ['素材审核中心', '审核真实性、风险边界、过度承诺'],
    tags: ['营销可信标签体系', '行业、底材、效果、工艺、风险、客户阶段'],
    publish: ['发布中心', '发布到国际站、官网、邮件、WhatsApp'],
    questions: ['客户问题库', '根据客户问题推荐证据和话术'],
  }[activeView];

  const renderPage = () => {
    if (activeView === 'overview') return renderOverview();
    if (activeView === 'primary') return renderPrimary();
    if (activeView === 'scene') return renderScene();
    if (activeView === 'compare') return renderCompare();
    if (activeView === 'video') return renderVideo();
    if (activeView === 'report') return renderReport();
    if (activeView === 'review') return renderReview();
    if (activeView === 'tags') return renderTags();
    if (activeView === 'publish') return renderPublish();
    return renderQuestions();
  };

  const renderFilterStrip = () => (
    <div className="border-b border-slate-200 bg-[#f6f8fc] px-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-[#071a41] shadow-sm">
          <Filter className="h-4 w-4 text-blue-600" />
          字段筛选
        </div>
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as '全部类型' | EvidenceType)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 shadow-sm outline-none focus:border-blue-400"
        >
          {EVIDENCE_TYPE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as '全部状态' | EvidenceStatus)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 shadow-sm outline-none focus:border-blue-400"
        >
          {STATUS_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        <select
          value={trustFilter}
          onChange={(event) => setTrustFilter(event.target.value as '全部等级' | TrustLevel)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 shadow-sm outline-none focus:border-blue-400"
        >
          {TRUST_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        <span className="rounded-full bg-slate-200/80 px-3 py-1.5 text-xs font-black text-slate-600">
          显示 {filteredRecords.length} / {evidenceRecords.length}
        </span>
        {isUsingCandidateRecords && (
          <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">
            暂无正式{expectedViewType}记录，正在显示可转化候选证据 {currentRecords.length} 条
          </span>
        )}
        {activeView === 'primary' && selectedId && activeRecord?.id === selectedId && localEvidenceIds.has(activeRecord.id) && (
          <button
            onClick={() => removeLocalEvidence(activeRecord.id)}
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 shadow-sm hover:bg-rose-100"
          >
            删除本地草稿
          </button>
        )}
        {(typeFilter !== '全部类型' || statusFilter !== '全部状态' || trustFilter !== '全部等级' || searchQuery.trim()) && (
          <button
            onClick={() => {
              setTypeFilter('全部类型');
              setStatusFilter('全部状态');
              setTrustFilter('全部等级');
              setSearchQuery('');
              notifyAction('筛选条件已清空，已恢复证据主表全量视图。');
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm hover:bg-slate-50"
          >
            清除筛选
          </button>
        )}
        {actionNotice && (
          <span className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 shadow-sm">
            {actionNotice}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div id="marketing-trust-workspace" className="h-full min-h-[680px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <main className="h-full min-w-0 overflow-y-auto bg-[#f6f8fc]">
        <ShellHeader
          title={pageTitle[0]}
          subtitle={pageTitle[1]}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          noticeAction={activeView === 'primary' && activeRecord ? (
            <button
              type="button"
              onClick={() => setIsPrimaryInspectorOpen(true)}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-xs font-black leading-none text-slate-500 shadow-sm transition hover:border-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
              title="查看不可缺字段与主表字段"
              aria-label="查看不可缺字段与主表字段"
            >
              !
            </button>
          ) : undefined}
          action={
            <div className="flex shrink-0 gap-1.5 sm:gap-2">
              <button
                onClick={() => {
                  if (activeView === 'primary') {
                    setIsColumnConfigOpen(true);
                  } else {
                    handleViewChange('primary');
                  }
                }}
                className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50 sm:px-3"
                title="字段视图"
              >
                <SlidersHorizontal className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">字段视图</span>
              </button>
              <button
                onClick={() => {
                  openCreatePanel(VIEW_TYPE_FILTER[activeView] || '场景证据卡');
                  notifyAction('已打开新建证据面板：先补齐 P0 字段，再保存草稿。');
                }}
                className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-lg bg-blue-600 px-2 text-xs font-black text-white shadow-sm hover:bg-blue-700 sm:px-3"
                title="新建证据"
              >
                <Pencil className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">新建证据</span>
              </button>
            </div>
          }
        />
        {renderFilterStrip()}
        {renderPage()}
      </main>
      {renderColumnConfigModal()}
      {renderPrimaryInspectorModal()}
      <AnimatePresence>
        {isEvidenceDetailOpen && renderEvidenceDetailPanel()}
        {isEvidenceEditOpen && renderEvidenceEditPanel()}
        {isCreatePanelOpen && renderCreatePanel()}
      </AnimatePresence>
    </div>
  );
}
