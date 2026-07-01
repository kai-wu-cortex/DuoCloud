/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type KnowledgeTableType = 
  | 'product_master'
  | 'substrate_knowledge'
  | 'compatibility_rule'
  | 'process_knowledge'
  | 'pricing_rule'
  | 'quality_issue'
  | 'supply_chain_capability'
  | 'faq_pitch'
  | 'tag_system'
  | 'knowledge_governance';

export interface KnowledgeAssetBase {
  id: string;
  category: KnowledgeTableType;
  title: string;
  tags: string[];
  lastUpdated: string;
  author: string;
  content: string;
  sourcePath?: string;
  directoryLevel1?: string;
  directoryLevel2?: string;
  directoryLevel3?: string;
  localEditedAt?: string;
}

export interface ProductMasterAsset extends KnowledgeAssetBase {
  category: 'product_master';
  productName: string; // 产品名称
  productCategory: string; // 产品大类分类
  colorName: string; // 颜色名称
  colorCode: string; // 色号 / 内部代号
  specifications: string; // 规格
  surfaceEffect: string; // 表面效果
  productStatus: string; // 产品状态
  productImage: string; // 产品图片
  recommendedIndustries: string; // 推荐应用行业
  recommendedSubstrates: string; // 推荐底材
  notRecommendedSubstrates: string; // 不推荐底材
  moq: string; // MOQ
  leadTime: string; // 常规交期
  hasStock: string; // 是否有库存
  alternativeModels: string; // 替代型号
  riskLevel: string; // 使用风险等级
  mustTestScenarios: string; // 必须打样场景
  createdAt: string; // 创建时间
  updatedAt: string; // 更新时间
  reviewer: string; // 审核人
}

export interface SubstrateKnowledgeAsset extends KnowledgeAssetBase {
  category: 'substrate_knowledge';
  substrateName: string; // 底材名称
  substrateCategory: string; // 底材分类
  surfaceRoughness: string; // 表面粗糙度
  surfaceTreatment: string; // 表面处理
  adhesionDifficulty: string; // 吸附难易度
  temperatureResistance: string; // 耐温情况
  recommendedSeries: string; // 推荐膜系列
  highRiskSeries: string; // 高风险膜系列
  commonApplications: string; // 常见应用
  commonIssues: string; // 常见问题
  treatmentAdvice: string; // 处理建议
  reviewStatus: string; // 审核状态
}

export interface CompatibilityRuleAsset extends KnowledgeAssetBase {
  category: 'compatibility_rule';
  ruleNo: string; // 规则编号
  productNo: string; // 产品型号
  substrateName: string; // 底材名称
  surfaceTreatment: string; // 表面处理
  compatibilityLevel: string; // 适配等级
  recommendReason: string; // 推荐理由
  riskNotes: string; // 风险说明
  tempRange: string; // 温度范围
  pressureRange: string; // 压力范围
  speedRange: string; // 速度范围
  requiresTesting: string; // 是否必须打样
  relatedPracticeCases: string; // 关联实践云案例
  salesPitch: string; // 销售推荐话术
  reviewer: string; // 审核人
}

export interface ProcessKnowledgeAsset extends KnowledgeAssetBase {
  category: 'process_knowledge';
  processName: string; // 工艺名称
  applicableProducts: string; // 适用产品
  tempRange: string; // 温度范围
  pressureRange: string; // 压力范围
  speedRange: string; // 速度范围
  dwellTime: string; // 时间/停留时
  moldRequirements: string; // 模具要求
  equipmentRequirements: string; // 设备要求
  environmentRequirements: string; // 环境要求
  commonAnomalies: string; // 常见异常
  adjustmentAdvice: string; // 调机建议
  clientExplanation: string; // 客户解释口径
}

export interface PricingRuleAsset extends KnowledgeAssetBase {
  category: 'pricing_rule';
  ruleNo: string; // 报价规则编号
  productNo: string; // 产品型号 / 系
  baseCost: string; // 基础成本
  widthImpact: string; // 宽幅影响
  quantityTiers: string; // 数量阶梯
  lossFactor: string; // 损耗系数
  moq: string; // MOQ
  leadTimeRule: string; // 交期规则
  expediteFee: string; // 加急费用
  customizationFee: string; // 定制费用
  priceLevel: string; // 价格等级
  concessionBoundary: string; // 让步边界
  alternativeSolutions: string; // 替代方案
  pricingNotes: string; // 报价备注
}

export interface QualityIssueAsset extends KnowledgeAssetBase {
  category: 'quality_issue';
  issueNo: string; // 问题编号
  defectName: string; // 缺陷名称
  defectImage: string; // 缺陷图片
  cause1: string; // 可能原因 1
  cause2: string; // 可能原因 2
  cause3: string; // 可能原因 3
  adjustmentAdvice: string; // 调整建议
  alternativeProduct: string; // 替代产品
  requiresReprint: string; // 是否需要重打
  clientExplanation: string; // 对客户解释
  severity: string; // 严重程度
  reviewStatus: string; // 审核状态
}

export interface SupplyChainCapabilityAsset extends KnowledgeAssetBase {
  category: 'supply_chain_capability';
  vendorCode: string; // 供应商编号
  vendorName: string; // 供应商名称
  providedProducts: string; // 提供产品
  qualityLevel: string; // 质量稳定性等级
  batchStability: string; // 批次稳定性
  normalLeadTime: string; // 常规供货周期
  maxCapacityMoq: string; // 最大供货量 / MOQ
  supplyRisk: string; // 供应风险
  alternativeVendor: string; // 替代供应商
  salesConstraint: string; // 对外承诺限制
}

export interface FaqPitchAsset extends KnowledgeAssetBase {
  category: 'faq_pitch';
  faqNo: string; // 问题编号
  clientQuestion: string; // 客户常问问题
  questionCategory: string; // 问题分类
  chineseAnswer: string; // 中文回答
  englishAnswer: string; // 英文回答
  relatedProducts: string; // 关联产品
  relatedPracticeCases: string; // 关联实践案例
  forbiddenPromises: string; // 禁止承诺内容
  applicableClientStage: string; // 适用客户阶段
}

export interface TagSystemAsset extends KnowledgeAssetBase {
  category: 'tag_system';
  tagNo: string; // 标签编号
  tagName: string; // 标签名称
  tagCategory: string; // 标签分类
  applicationRule: string; // 使用规则
  parentTag: string; // 上级标签
  synonyms: string; // 同义词
  conflictingTags: string; // 互斥标签
  applicationScenarios: string; // 应用场景/推荐/案例匹配
}

export interface KnowledgeGovernanceAsset extends KnowledgeAssetBase {
  category: 'knowledge_governance';
  ruleNo: string; // 知识编号
  knowledgeDomain: string; // 知识领域
  briefTitle: string; // 简短标题
  detailedContent: string; // 完整说明
  source: string; // 来源信息
  reliability: string; // 来源可靠度
  reviewer: string; // 审核信息
  reviewStatus: string; // 审核状态
  version: string; // 版本信息
  updatedAt: string; // 更新时间
  failureCondition: string; // 失效条件
  usageCount: string; // 使用频次
  feedbackScore: string; // 反馈评分
}

export type KnowledgeAsset = 
  | ProductMasterAsset
  | SubstrateKnowledgeAsset
  | CompatibilityRuleAsset
  | ProcessKnowledgeAsset
  | PricingRuleAsset
  | QualityIssueAsset
  | SupplyChainCapabilityAsset
  | FaqPitchAsset
  | TagSystemAsset
  | KnowledgeGovernanceAsset;

export interface FoilProduct {
  sku: string;
  series: string;
  color: string;
  finish: string; // e.g. 亮金, 哑金, 镭射金, 珠光白, 哑银
  substrates: string[]; // e.g. 纸张, PP, PVC, PET, 皮革, UV油墨, 覆膜
  pricePerSqm: number; // in USD or RMB
  moq: number; // in SQM
  leadTimeDays: number;
  optimalTemp: string; // e.g. "115 - 125 °C"
  optimalPressure: string; // e.g. "45 - 55 kg/cm²"
  optimalSpeed: string; // e.g. "3500 - 4000 印/小时"
  risks: string[];
  features: string[];
  alternatives: string[]; // alternative SKUs
}

export interface PracticeCard {
  id: string;
  evidenceNo: string; // e.g. SY-2026-0042
  sku: string;
  series: string;
  color: string;
  substrate: string; // specific substrate (e.g. "250g哑粉纸 + 哑膜", "化妆品级PP软管")
  inkType: string; // e.g. "普通胶印油墨", "UV哑光油墨", "无"
  processType: string; // e.g. "平压平自动烫", "圆压平起凸", "高速轮转热转印"
  machineModel: string; // e.g. "Bobst 106-ER", "MK-1050"
  parameters: {
    temp: number; // in °C
    pressure: number; // in kg or tons
    speed: number; // sheets/hour
    dwellTime: number; // seconds
  };
  results: {
    clearness: number; // 1-5
    gloss: number; // 1-5
    adhesion: number; // 1-5
    abrasion: number; // 1-5
    photoUrl: string; // placeholder description or custom SVG visualization
    defectNotes: string; // defects found or "无明显缺陷，附着力极佳"
  };
  recommendLevel: 'high' | 'medium' | 'low';
  riskNotes: string;
  operator: string;
  testDate: string;
  relatedKnowledgeAssetIds?: string[]; // References to Knowledge Cloud articles/rules
}

export interface DiagnosedRequirement {
  id: string;
  clientProduct: string; // e.g. 化妆品彩盒, 葡萄酒标, 手机盒, 运动鞋帮
  substrate: string; // e.g. PP塑料, 铜版纸覆哑膜, 压纹皮革, 玻璃瓶UV底漆
  targetEffect: string; // e.g. 极细线条亮金, 大面积镜面金, 珠光幻彩
  budget: 'high' | 'medium' | 'low';
  moqTarget: number;
  leadTimeDays: number;
  completenessScore: number;
  missingFields: string[];
  suggestedQuestions: string[];
  scenarioTags: string[];
  riskAlerts: string[];
  timestamp: string;
}

export interface PricingProposal {
  sku: string;
  qtySqm: number;
  baseCost: number;
  samplingFee: number;
  processSurcharge: number;
  urgencySurcharge: number;
  totalPrice: number;
  unitPrice: number;
  marginRate: number;
  adjustedPrice: number;
  paymentTerm: string;
  deliveryTerms: string;
}
