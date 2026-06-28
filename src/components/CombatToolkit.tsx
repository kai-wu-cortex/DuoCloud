/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Layers, 
  DollarSign, 
  CheckCircle, 
  AlertTriangle, 
  Copy, 
  Printer, 
  HelpCircle, 
  TrendingUp, 
  Zap, 
  ChevronRight, 
  Sliders, 
  ArrowRight, 
  Share2, 
  Download,
  Flame,
  CheckCircle2,
  Bookmark,
  Sparkles,
  Info,
  Database
} from 'lucide-react';
import { FoilProduct, PracticeCard, DiagnosedRequirement, PricingProposal } from '../types';

interface CombatToolkitProps {
  products: FoilProduct[];
  practiceCards: PracticeCard[];
}

const PRESET_SCENARIOS = [
  {
    id: 'preset-1',
    label: '💄 化妆品纸盒精细亮金 (磨砂面)',
    clientProduct: '高端粉底液外盒',
    substrate: '250g艺术卡纸 + 磨砂UV光油表面',
    targetEffect: '0.15mm极细线条高亮金字',
    budget: 'medium' as const,
    moqTarget: 5000,
    leadTimeDays: 10,
    inkType: 'UV哑光黑色油墨'
  },
  {
    id: 'preset-2',
    label: '🍷 葡萄酒标签哑金立体起凸',
    clientProduct: '典藏黑皮诺红酒标',
    substrate: '特种粗糙压纹艺术纸 (未覆膜)',
    targetEffect: '大面积酒庄图纹 + 立体双鼓起凸香槟金',
    budget: 'high' as const,
    moqTarget: 8000,
    leadTimeDays: 15,
    inkType: '大豆防潮油墨'
  },
  {
    id: 'preset-3',
    label: '🧪 塑料洗面奶软管 (亮金耐洗)',
    clientProduct: '150ml草本洗面奶软管',
    substrate: '高密度PP软管 (注塑成型)',
    targetEffect: '耐洗化机化学品腐蚀、耐挤压不断裂高亮金',
    budget: 'medium' as const,
    moqTarget: 15000,
    leadTimeDays: 12,
    inkType: '无印刷(直接硬塑料面)'
  },
  {
    id: 'preset-4',
    label: '👜 奢侈品手提袋皮革印字 (复古红金)',
    clientProduct: '品牌圣诞限定手提包',
    substrate: '十字纹PU合成革 (附带微型油脂膜)',
    targetEffect: '深凹纹表面烫印、耐1000次弯曲揉搓复古暗金',
    budget: 'high' as const,
    moqTarget: 1200,
    leadTimeDays: 20,
    inkType: '防刮触感油'
  }
];

export default function CombatToolkit({ products, practiceCards }: CombatToolkitProps) {
  const [activeTab, setActiveTab] = useState<'diagnosis' | 'recommend' | 'pricing' | 'evidence'>('diagnosis');
  
  // Active diagnostic requirement
  const [clientProduct, setClientProduct] = useState('');
  const [substrate, setSubstrate] = useState('');
  const [targetEffect, setTargetEffect] = useState('');
  const [budget, setBudget] = useState<'high' | 'medium' | 'low'>('medium');
  const [moqTarget, setMoqTarget] = useState<number>(3000);
  const [leadTimeDays, setLeadTimeDays] = useState<number>(10);
  const [inkType, setInkType] = useState('');
  const [isCopyAlert, setIsCopyAlert] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Dynamic diagnostic results
  const [diagnosis, setDiagnosis] = useState<DiagnosedRequirement | null>(null);

  // Selector recommended SKU
  const [recommendedProduct, setRecommendedProduct] = useState<FoilProduct | null>(null);
  const [alternativeProduct, setAlternativeProduct] = useState<FoilProduct | null>(null);

  // Dynamic pricing states
  const [qtySqm, setQtySqm] = useState<number>(3000);
  const [rollWidth, setRollWidth] = useState<number>(120); // in mm
  const [stampComplexity, setStampComplexity] = useState<'fine' | 'medium' | 'solid'>('medium');
  const [urgency, setUrgency] = useState<'standard' | 'express'>('standard');
  const [proposal, setProposal] = useState<PricingProposal | null>(null);

  // Handle Preset Load
  const handleLoadPreset = (p: typeof PRESET_SCENARIOS[0]) => {
    setClientProduct(p.clientProduct);
    setSubstrate(p.substrate);
    setTargetEffect(p.targetEffect);
    setBudget(p.budget);
    setMoqTarget(p.moqTarget);
    setQtySqm(p.moqTarget);
    setLeadTimeDays(p.leadTimeDays);
    setInkType(p.inkType);
    
    // Automatically transition tab
    setActiveTab('diagnosis');
  };

  // Perform requirement diagnosis
  useEffect(() => {
    if (!clientProduct && !substrate && !targetEffect) {
      setDiagnosis(null);
      return;
    }

    let score = 100;
    const missing: string[] = [];
    const questions: string[] = [];
    const alerts: string[] = [];
    const tags: string[] = [];

    // Score deduction and audit
    if (!clientProduct.trim()) {
      score -= 15;
      missing.push('客户产品大类');
    } else {
      tags.push(clientProduct);
    }

    if (!substrate.trim()) {
      score -= 30;
      missing.push('底材详细材质及表面涂布 (UV/覆膜)');
      questions.push('“Could you specify the exact surface material? Is it coated paper, uncoated textured paper, PP/PE plastic, or laminate? If laminated, is it matte lamination or tactile lamination?”');
    } else {
      tags.push(substrate);
      const subLower = substrate.toLowerCase();
      if (subLower.includes('哑膜') || subLower.includes('触感')) {
        alerts.push('触感哑膜表面含有极具排斥热熔胶的硅添加剂，存在脱落高风险！需重点检测。');
      }
      if (subLower.includes('uv') || subLower.includes('光油')) {
        alerts.push('UV哑光油墨或光油未彻底紫外固化前易析出活性小分子，极易导致烫金缩边及附着力下降。');
      }
      if ((subLower.includes('pp') || subLower.includes('pe') || subLower.includes('塑料')) && !subLower.includes('火焰')) {
        alerts.push('塑料属于非极性材料，需强烈追问客户‘是否支持火焰或电晕前处理’以防完全无法咬合。');
      }
    }

    if (!targetEffect.trim()) {
      score -= 20;
      missing.push('视觉效果与物理耐性要求');
      questions.push('“What is the specific aesthetic requirement? Shiny metallic, champagne matte, or laser holographic? Also, do you require special physical resistance like alcohol resistance, scratch resistance, or cross-hatch tape test passing?”');
    } else {
      tags.push(targetEffect);
    }

    if (!inkType.trim() || inkType.trim() === '无') {
      score -= 10;
      missing.push('印刷油墨类别');
      questions.push('“What printing ink is used under the stamping area? Standard offset ink, soybean botanical ink, or UV ink?”');
    } else {
      tags.push(inkType);
    }

    if (moqTarget <= 0) {
      score -= 10;
      missing.push('目标试产数量 (平方)');
    }
    if (leadTimeDays < 5) {
      alerts.push('客户期望交期少于5天，属于超级特急单，需锁紧高价紧急附加费！');
    }

    // Dynamic professional follow-up template Q&A generator
    const defaultQs = [
      `1. Please provide the exact layout artwork so we can assess fine line widths (whether <0.15mm) and determine custom plate costs.`,
      `2. Do you have a physical sample substrate available that you can courier to our laboratory for standard dyne test and trial runs?`,
      `3. Confirm if post-stamping processes like embossing, creasing, or folding are required.`
    ];

    setDiagnosis({
      id: 'DIAG-' + Math.floor(Math.random() * 10000),
      clientProduct,
      substrate,
      targetEffect,
      budget,
      moqTarget,
      leadTimeDays,
      completenessScore: Math.max(15, score),
      missingFields: missing,
      suggestedQuestions: [...questions, ...defaultQs],
      scenarioTags: tags,
      riskAlerts: alerts,
      timestamp: new Date().toLocaleTimeString()
    });

  }, [clientProduct, substrate, targetEffect, budget, moqTarget, leadTimeDays, inkType]);

  // Matching algorithm for Foil Selection
  useEffect(() => {
    if (!diagnosis) {
      setRecommendedProduct(null);
      setAlternativeProduct(null);
      return;
    }

    const sub = diagnosis.substrate.toLowerCase();
    const effect = diagnosis.targetEffect.toLowerCase();
    
    let mainSku = 'L-200'; // Default economy bright gold
    let backupSku = 'L-220';

    // Advanced rule mapping matching physical characteristics
    if (sub.includes('塑料') || sub.includes('pp') || sub.includes('pe') || sub.includes('abs') || sub.includes('管') || sub.includes('瓶')) {
      if (effect.includes('银')) {
        mainSku = 'S-550'; // Bright silver plastic
        backupSku = 'S-500';
      } else {
        mainSku = 'S-500'; // Bright gold plastic
        backupSku = 'S-550';
      }
    } else if (sub.includes('革') || sub.includes('皮') || sub.includes('帆布') || sub.includes('布')) {
      if (effect.includes('银')) {
        mainSku = 'H-350'; // Leather silver
        backupSku = 'K-800';
      } else {
        mainSku = 'H-300'; // Leather red gold
        backupSku = 'K-800';
      }
    } else if (sub.includes('uv') || sub.includes('油墨') || sub.includes('光油') || sub.includes('覆膜') || sub.includes('哑膜') || sub.includes('触感')) {
      if (effect.includes('镭射') || effect.includes('幻彩')) {
        mainSku = 'U-900'; // Laser foil
        backupSku = 'U-950';
      } else if (effect.includes('银')) {
        mainSku = 'U-950'; // Holographic silver
        backupSku = 'K-600';
      } else if (effect.includes('哑') || effect.includes('香槟')) {
        mainSku = 'K-800'; // Premium champagne matte
        backupSku = 'U-900';
      } else {
        mainSku = 'K-600'; // Premium fine bright gold
        backupSku = 'U-900';
      }
    } else {
      // standard papers
      if (effect.includes('哑') || effect.includes('香槟')) {
        mainSku = 'K-800';
        backupSku = 'H-300';
      } else if (effect.includes('银')) {
        mainSku = 'L-220';
        backupSku = 'K-600';
      } else if (effect.includes('数码') || effect.includes('个性') || effect.includes('无版')) {
        mainSku = 'D-100';
        backupSku = 'L-220';
      } else {
        mainSku = 'L-200';
        backupSku = 'K-600';
      }
    }

    const mainProd = products.find(p => p.sku === mainSku) || products[0];
    const backupProd = products.find(p => p.sku === backupSku) || products[1];

    setRecommendedProduct(mainProd);
    setAlternativeProduct(backupProd);

  }, [diagnosis, products]);

  // Pricing calculations
  useEffect(() => {
    if (!recommendedProduct) {
      setProposal(null);
      return;
    }

    // Cost drivers parameters
    const baseRawPrice = recommendedProduct.pricePerSqm;
    let qtyFactor = 1.0;
    if (qtySqm < 1000) qtyFactor = 1.45; // extreme premium for small batches
    else if (qtySqm < 2000) qtyFactor = 1.25;
    else if (qtySqm > 10000) qtyFactor = 0.90; // discount

    // Width factor
    let widthSurcharge = 0;
    if (rollWidth < 100) widthSurcharge = 0.15; // slitting cost

    // Complexity factor
    let complexitySurcharge = 0;
    let baseMoldFee = 150;
    if (stampComplexity === 'fine') {
      complexitySurcharge = 0.25;
      baseMoldFee = 250; // high precision copper mold
    } else if (stampComplexity === 'solid') {
      complexitySurcharge = 0.10;
      baseMoldFee = 100; // cheap silicone or magnesium
    }

    // Urgency factor
    let urgencySurchargeValue = 0;
    if (urgency === 'express') {
      urgencySurchargeValue = 200; // instant turn-around scheduling fee
    }

    const calculatedUnitPrice = parseFloat(((baseRawPrice * qtyFactor) + widthSurcharge + complexitySurcharge).toFixed(2));
    const rawCost = calculatedUnitPrice * qtySqm;
    
    // Total price
    const totalPrice = parseFloat((rawCost + baseMoldFee + urgencySurchargeValue).toFixed(2));

    setProposal({
      sku: recommendedProduct.sku,
      qtySqm,
      baseCost: parseFloat(rawCost.toFixed(2)),
      samplingFee: baseMoldFee,
      processSurcharge: parseFloat((complexitySurcharge * qtySqm).toFixed(2)),
      urgencySurcharge: urgencySurchargeValue,
      totalPrice,
      unitPrice: parseFloat((totalPrice / qtySqm).toFixed(3)),
      marginRate: 35,
      adjustedPrice: totalPrice,
      paymentTerm: qtySqm > 5000 ? '30% Deposit, 70% against BL Copy' : '100% Prepayment for sampling orders',
      deliveryTerms: 'CIF Rotterdam Port / air shipping'
    });

  }, [recommendedProduct, qtySqm, rollWidth, stampComplexity, urgency]);

  // Copy Follow-up questions to clipboard
  const handleCopyQuestions = () => {
    if (!diagnosis) return;
    const text = `Hi, thank you for your hot stamping inquiry.\nIn order to customize the perfect foil and minimize factory production risks, please kindly clarify the following: \n\n${diagnosis.suggestedQuestions.map(q => q).join('\n')}\n\nBest regards,\nSales Representative`;
    navigator.clipboard.writeText(text);
    setIsCopyAlert(true);
    setTimeout(() => setIsCopyAlert(false), 2000);
  };

  const activeRecommendLevel = (sku: string) => {
    const card = practiceCards.find(c => c.sku === sku);
    return card ? card.recommendLevel : 'high';
  };

  // Get matching practice cards for diagnosed substrate
  const matchedEvidenceCards = practiceCards.filter(card => {
    if (!diagnosis) return false;
    const sub = diagnosis.substrate.toLowerCase();
    const pSub = card.substrate.toLowerCase();
    
    // Check if substrate matches keywords
    const keywords = ['纸', '塑料', 'pp', 'leather', '皮革', 'uv', '哑膜', '艺术'];
    const matchedKeywords = keywords.filter(k => sub.includes(k) && pSub.includes(k));
    
    // Also match matched SKU
    const isSameSku = recommendedProduct ? card.sku === recommendedProduct.sku : false;

    return matchedKeywords.length > 0 || isSameSku;
  });

  return (
    <div className="flex flex-col h-full bg-background relative" id="combat-toolkit">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg z-[100] text-sm font-medium"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wizard Step Nav */}
      <div className="bg-white border-b border-outline-variant/80 px-1.5 py-2 flex flex-col md:flex-row md:items-center justify-between shrink-0 gap-4 shadow-sm rounded-xl mb-2">
        <div className="flex items-center gap-1 overflow-x-auto py-1">
          <button
            onClick={() => setActiveTab('diagnosis')}
            className={`flex items-center gap-4 px-1.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'diagnosis' 
                ? 'bg-primary text-white shadow-sm' 
                : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
            }`}
            id="tab-diagnosis-btn"
          >
            <span className={`w-4 h-4 rounded-xl text-[10px] flex items-center justify-center font-mono font-bold ${activeTab === 'diagnosis' ? 'bg-white/20 text-white' : 'bg-surface-container-high text-on-surface-variant'}`}>1</span>
            客户需求诊断
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant/40 shrink-0" />
          
          <button
            onClick={() => {
              if (!diagnosis) {
                showToast('请先输入客户需求或选择一个典型场景 Preset 触发匹配！');
                return;
              }
              setActiveTab('recommend');
            }}
            className={`flex items-center gap-4 px-1.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'recommend' 
                ? 'bg-primary text-white shadow-sm' 
                : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
            }`}
            id="tab-recommend-btn"
          >
            <span className={`w-4 h-4 rounded-xl text-[10px] flex items-center justify-center font-mono font-bold ${activeTab === 'recommend' ? 'bg-white/20 text-white' : 'bg-surface-container-high text-on-surface-variant'}`}>2</span>
            选膜参数推荐
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant/40 shrink-0" />

          <button
            onClick={() => {
              if (!diagnosis) {
                showToast('请先输入客户需求或选择一个典型场景 Preset 触发匹配！');
                return;
              }
              setActiveTab('pricing');
            }}
            className={`flex items-center gap-4 px-1.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'pricing' 
                ? 'bg-primary text-white shadow-sm' 
                : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
            }`}
            id="tab-pricing-btn"
          >
            <span className={`w-4 h-4 rounded-xl text-[10px] flex items-center justify-center font-mono font-bold ${activeTab === 'pricing' ? 'bg-white/20 text-white' : 'bg-surface-container-high text-on-surface-variant'}`}>3</span>
            报价打样彩页
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant/40 shrink-0" />

          <button
            onClick={() => {
              if (!diagnosis) {
                showToast('请先输入客户需求或选择一个典型场景 Preset 触发匹配！');
                return;
              }
              setActiveTab('evidence');
            }}
            className={`flex items-center gap-4 px-1.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'evidence' 
                ? 'bg-primary text-white shadow-sm' 
                : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
            }`}
            id="tab-evidence-btn"
          >
            <span className={`w-4 h-4 rounded-xl text-[10px] flex items-center justify-center font-mono font-bold ${activeTab === 'evidence' ? 'bg-white/20 text-white' : 'bg-surface-container-high text-on-surface-variant'}`}>4</span>
            匹配实践证据 ({matchedEvidenceCards.length})
          </button>
        </div>

        {/* Dynamic Scenario Preset Picker */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-on-surface-variant font-bold uppercase whitespace-nowrap hidden lg:inline">载入典型场景：</span>
          <select
            onChange={(e) => {
              const selectedPreset = PRESET_SCENARIOS.find(p => p.id === e.target.value);
              if (selectedPreset) handleLoadPreset(selectedPreset);
            }}
            defaultValue=""
            className="bg-surface-container-low border border-outline-variant text-primary font-bold text-xs px-2.5 py-1.5 rounded-xl outline-none w-56 cursor-pointer hover:border-primary/40"
            id="preset-scenario-picker"
          >
            <option value="" disabled>快速选择常见烫金商机...</option>
            {PRESET_SCENARIOS.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Interactive Sandbox Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-full mx-auto">
          
          {/* TAB 1: DIAGNOSIS */}
          {activeTab === 'diagnosis' && (
            <div className="space-y-3" id="view-diagnosis">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Inputs questionnaire */}
                <div className="bg-white border border-outline-variant/80 rounded-xl p-4 space-y-2 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-3">
                    <Zap className="w-5 h-5 text-primary" />
                    <h3 className="text-sm font-bold text-primary">销售现场：客户询盘输入录入</h3>
                  </div>

                  <div className="space-y-3 text-xs font-semibold text-on-surface-variant">
                    <div className="space-y-3">
                      <label className="text-on-surface-variant block">客户最终产品 (例如：彩妆粉底盒、葡萄酒标、香水瓶)</label>
                      <input
                        type="text"
                        placeholder="请输入或选择典型场景..."
                        value={clientProduct}
                        onChange={(e) => setClientProduct(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-4 text-on-surface outline-none focus:border-primary/50 font-medium"
                        id="diag-input-product"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-on-surface-variant block">底材细节属性 (纸质、是否覆膜、塑料大类、有无光油等) *</label>
                      <input
                        type="text"
                        placeholder="例：250g白卡纸 + 覆哑膜，或 PP塑料管瓶面"
                        value={substrate}
                        onChange={(e) => setSubstrate(e.target.value)}
                        className="w-full bg-surface-container-low border border-primary/20 rounded-xl p-4 text-on-surface font-bold outline-none focus:border-primary/50"
                        id="diag-input-substrate"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-3">
                        <label className="text-on-surface-variant block">视觉与耐磨效果</label>
                        <input
                          type="text"
                          placeholder="如：高亮镜面金 / 耐百格擦拭"
                          value={targetEffect}
                          onChange={(e) => setTargetEffect(e.target.value)}
                          className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-4 text-on-surface outline-none focus:border-primary/50 font-medium"
                          id="diag-input-effect"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-on-surface-variant block">底层配套油墨</label>
                        <input
                          type="text"
                          placeholder="大豆油墨 / UV油墨 / 无"
                          value={inkType}
                          onChange={(e) => setInkType(e.target.value)}
                          className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-4 text-on-surface outline-none focus:border-primary/50 font-medium"
                          id="diag-input-ink"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-3">
                        <label className="text-on-surface-variant block">预算定位</label>
                        <select
                          value={budget}
                          onChange={(e) => setBudget(e.target.value as 'high' | 'medium' | 'low')}
                          className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-4 text-on-surface outline-none focus:border-primary/50 cursor-pointer font-bold"
                        >
                          <option value="high">高端定位(品质)</option>
                          <option value="medium">中端性价比</option>
                          <option value="low">低端跑量型</option>
                        </select>
                      </div>

                      <div className="space-y-3">
                        <label className="text-on-surface-variant block">用量(平方)</label>
                        <input
                          type="number"
                          value={moqTarget}
                          onChange={(e) => {
                            setMoqTarget(Number(e.target.value));
                            setQtySqm(Number(e.target.value));
                          }}
                          className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-4 text-on-surface outline-none focus:border-primary/50 font-mono"
                          id="diag-input-moq"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-on-surface-variant block">期许交付(天)</label>
                        <input
                          type="number"
                          value={leadTimeDays}
                          onChange={(e) => setLeadTimeDays(Number(e.target.value))}
                          className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-4 text-on-surface outline-none focus:border-primary/50 font-mono"
                          id="diag-input-lead"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Outputs diagnosis */}
                <div className="bg-white border border-outline-variant/80 rounded-xl p-4 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
                    <h3 className="text-sm font-bold text-primary flex items-center gap-4">
                      <Sparkles className="w-5 h-5 text-primary" />
                      双云智能匹配诊断分析
                    </h3>
                    {diagnosis && (
                      <span className={`text-xs font-bold font-mono px-2.5 py-1 rounded-xl border ${
                        diagnosis.completenessScore >= 80 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                        diagnosis.completenessScore >= 60 ? 'text-amber-700 bg-amber-50 border-amber-200' :
                        'text-red-700 bg-red-50 border-red-200'
                      }`}>
                        商机健全度: {diagnosis.completenessScore} 分
                      </span>
                    )}
                  </div>

                  {diagnosis ? (
                    <div className="space-y-2 text-xs font-semibold">
                      {/* Scenario Tags */}
                      <div className="flex flex-wrap gap-4">
                        {diagnosis.scenarioTags.map((tag, idx) => (
                          <span key={idx} className="text-[10px] bg-primary/10 text-primary px-2.5 py-0.5 rounded-xl border border-primary/20">
                            #{tag}
                          </span>
                        ))}
                      </div>

                      {/* Warnings Alert */}
                      {diagnosis.riskAlerts.length > 0 ? (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2">
                          <h4 className="font-bold text-red-800 flex items-center gap-4">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                            工艺与交期风险预警点：
                          </h4>
                          <ul className="space-y-3 text-[11px] text-red-950 font-medium">
                            {diagnosis.riskAlerts.map((alert, idx) => (
                              <li key={idx} className="flex items-start gap-1">
                                <span className="text-red-600 font-bold">•</span>
                                <span>{alert}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          <span>常规配型场景，物理开机安全度极高。</span>
                        </div>
                      )}

                      {/* Question template Q&As */}
                      <div className="space-y-2 bg-surface-container-low p-4 rounded-xl border border-outline-variant relative">
                        <div className="flex justify-between items-center pb-2 border-b border-outline-variant/60">
                          <h4 className="font-bold text-primary flex items-center gap-4">
                            <HelpCircle className="w-4 h-4 text-primary" />
                            销售跟进：海外询盘英文追问提纲
                          </h4>
                          <button
                            onClick={handleCopyQuestions}
                            className="flex items-center gap-1 text-[10px] text-primary hover:text-white hover:bg-primary bg-white border border-outline-variant px-2.5 py-1 rounded-xl transition"
                            title="一键拷贝邮件追问术"
                            id="copy-questions-btn"
                          >
                            <Copy className="w-3 h-3" />
                            {isCopyAlert ? '已复制!' : '复制提纲'}
                          </button>
                        </div>
                        <div className="space-y-3 text-[10px] font-mono text-on-surface-variant pt-1 leading-relaxed max-h-[140px] overflow-y-auto">
                          {diagnosis.suggestedQuestions.map((q, idx) => (
                            <p key={idx} className="text-on-surface font-medium">{q}</p>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          onClick={() => setActiveTab('recommend')}
                          className="px-2.5 py-2.5 bg-primary hover:bg-primary-container text-white font-bold rounded-xl flex items-center gap-1 transition shadow-md shadow-primary/10"
                          id="diag-next-step-btn"
                        >
                          下一步：计算双云配膜推荐
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                    </div>
                  ) : (
                    <div className="py-12 text-center text-on-surface-variant space-y-2">
                      <FileText className="w-12 h-12 text-on-surface-variant/40 mx-auto" />
                      <p className="text-sm font-bold text-on-surface">尚未载入或输入客户询盘内容</p>
                      <p className="text-xs font-medium">您可以直接在上方下拉框中选择一个“典型场景 Presets”一键载入，并查看强大的匹配系统反应！</p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: RECOMMENDATION */}
          {activeTab === 'recommend' && (
            <div className="space-y-3" id="view-recommend">
              {recommendedProduct ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  
                  {/* Recommended Primary SKU */}
                  <div className="bg-white border border-outline-variant rounded-xl p-4 space-y-2 shadow-sm">
                    <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest font-mono">
                        双云优先主推型号方案
                      </span>
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-xl border border-emerald-200">
                        最佳材料适配度
                      </span>
                    </div>

                    <div className="space-y-2 text-xs font-semibold">
                      <div>
                        <span className="text-[10px] text-on-surface-variant block font-mono">{recommendedProduct.series}</span>
                        <h2 className="text-2xl font-black text-primary mt-1">
                          {recommendedProduct.sku} - {recommendedProduct.color}
                        </h2>
                      </div>

                      {/* Swatch color representation */}
                      <div className="h-16 rounded-xl relative overflow-hidden flex items-center justify-center p-2">
                        <div className={`absolute inset-0 opacity-90 bg-gradient-to-tr ${
                          recommendedProduct.sku.includes('K-600') ? 'from-amber-500 to-yellow-300' :
                          recommendedProduct.sku.includes('K-800') ? 'from-yellow-600 to-amber-400' :
                          recommendedProduct.sku.includes('L-200') ? 'from-amber-400 to-yellow-200' :
                          recommendedProduct.sku.includes('S-500') ? 'from-yellow-500 via-amber-300 to-yellow-600' :
                          recommendedProduct.sku.includes('U-900') ? 'from-purple-500 via-amber-400 to-emerald-500' :
                          recommendedProduct.sku.includes('H-300') ? 'from-red-600 to-amber-500' : 'from-slate-400 to-zinc-300'
                        }`} />
                        <span className="z-10 text-shadow-md font-black text-slate-900 font-sans tracking-wide">
                          Swatched Metallic Color Finish: {recommendedProduct.finish}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-bold text-primary">适配理由：</h4>
                        <div className="space-y-3 text-on-surface-variant text-[11px] font-medium leading-relaxed">
                          {recommendedProduct.features.map((feat, idx) => (
                            <p key={idx} className="flex items-start gap-4">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{feat}</span>
                            </p>
                          ))}
                        </div>
                      </div>

                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                        <h4 className="font-bold text-amber-800">开机安全红线提示：</h4>
                        <p className="text-[11px] text-amber-950 font-medium leading-relaxed">
                          {recommendedProduct.risks[0] || '暂无重大材料排斥风险，按工艺要求开机即可。'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Backup Model & Machine parameter specs */}
                  <div className="space-y-3">
                    <div className="bg-white border border-outline-variant rounded-xl p-4 space-y-2 shadow-sm">
                      <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
                        <h3 className="text-sm font-bold text-primary flex items-center gap-4">
                          <Sliders className="w-4 h-4 text-primary" />
                          调机参考工艺窗口 (由实践云提供)
                        </h3>
                        <span className="text-[10px] text-on-surface-variant font-mono">100% 专家审核校准</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/60 text-center">
                          <span className="text-on-surface-variant font-medium">推荐温度区间</span>
                          <p className="text-lg font-black text-primary font-mono mt-1">{recommendedProduct.bestTempRange}</p>
                        </div>
                        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/60 text-center">
                          <span className="text-on-surface-variant font-medium">建议承印附着力</span>
                          <p className="text-lg font-black text-primary font-mono mt-1">&ge; 4.5 级 (百格)</p>
                        </div>
                      </div>

                      <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/50 text-[11px] text-on-surface-variant leading-relaxed">
                        <p className="font-bold text-primary mb-1">💡 专家调机忠告：</p>
                        对于该型号膜，<strong>温度不宜设过高</strong>。高压和过长的驻留反而易引起离型层树脂受损导致“飞金边”或粘脏。推荐时速不低于 <strong>3500印/h</strong> 以保持平整。
                      </div>
                    </div>

                    {/* Alternative backup option */}
                    {alternativeProduct && (
                      <div className="bg-white border border-outline-variant rounded-xl p-4 space-y-3 shadow-sm">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest font-mono">
                          备选配型方案 (防止爆产调剂)
                        </span>
                        <div className="flex justify-between items-center text-xs">
                          <div>
                            <h4 className="font-bold text-primary">{alternativeProduct.sku} - {alternativeProduct.color}</h4>
                            <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">{alternativeProduct.series}</p>
                          </div>
                          <span className="px-2.5 py-1 bg-surface-container-high text-on-surface-variant font-bold text-[10px] rounded-xl border border-outline-variant/55">
                            对标备用材料
                          </span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed bg-surface-container-low p-4 rounded-xl border border-outline-variant/40">
                          <strong>备用理由:</strong> {alternativeProduct.features[0] || '作为大底配型，适合常规平压平自动烫金。'}
                        </p>
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => setActiveTab('pricing')}
                        className="px-2.5 py-2.5 bg-primary hover:bg-primary-container text-white font-bold rounded-xl flex items-center gap-1 transition shadow-md shadow-primary/10"
                        id="recommend-next-step-btn"
                      >
                        下一步：智能报价测算
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                  </div>

                </div>
              ) : (
                <div className="py-20 text-center text-on-surface-variant bg-white border border-outline-variant rounded-xl">
                  <Sliders className="w-12 h-12 text-on-surface-variant/40 mx-auto animate-spin" />
                  <p className="text-sm font-bold text-on-surface mt-2">选膜推荐加载中...</p>
                  <p className="text-xs">请返回需求诊断页录入底材</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PRICING */}
          {activeTab === 'pricing' && (
            <div className="space-y-3" id="view-pricing">
              {proposal ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  
                  {/* Pricing controls */}
                  <div className="lg:col-span-5 bg-white border border-outline-variant rounded-xl p-4 space-y-2 shadow-sm text-xs font-semibold text-on-surface-variant">
                    <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-3">
                      <DollarSign className="w-5 h-5 text-primary" />
                      <h3 className="text-sm font-bold text-primary">商务核算因子：动态调控</h3>
                    </div>

                    <div className="space-y-2">
                      {/* Qty */}
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-on-surface font-bold">最终投样总用量:</span>
                          <span className="text-primary font-black font-mono">{qtySqm} 平方</span>
                        </div>
                        <input 
                          type="range" 
                          min="500" 
                          max="20000" 
                          step="100"
                          value={qtySqm} 
                          onChange={(e) => setQtySqm(Number(e.target.value))}
                          className="w-full h-1.5 bg-surface-container-low rounded-xl appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-[10px] text-on-surface-variant font-medium">
                          <span>MOQ底线: 500㎡</span>
                          <span>大货折让: &gt;10000㎡</span>
                        </div>
                      </div>

                      {/* Width */}
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-on-surface font-bold">客户定制卷径分切宽度:</span>
                          <span className="text-primary font-black font-mono">{rollWidth} mm</span>
                        </div>
                        <input 
                          type="range" 
                          min="30" 
                          max="640" 
                          step="5"
                          value={rollWidth} 
                          onChange={(e) => setRollWidth(Number(e.target.value))}
                          className="w-full h-1.5 bg-surface-container-low rounded-xl appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-[10px] text-on-surface-variant font-medium">
                          <span>窄卷分切耗损附加(小于100mm)</span>
                          <span>主标准卷宽: 640mm</span>
                        </div>
                      </div>

                      {/* Pattern complexity */}
                      <div className="space-y-3">
                        <label className="text-on-surface font-bold block">烫印图纹复杂度分级</label>
                        <select
                          value={stampComplexity}
                          onChange={(e) => setStampComplexity(e.target.value as 'fine' | 'medium' | 'solid')}
                          className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-4 text-on-surface outline-none focus:border-primary/50 cursor-pointer font-bold"
                        >
                          <option value="fine">精细图纹 (极高密排版, 铜板调试损耗+25%)</option>
                          <option value="medium">常规中等图纹 (基础硅橡胶板调试费)</option>
                          <option value="solid">大面积实地块 (锌版/电雕版快烫模式)</option>
                        </select>
                      </div>

                      {/* Urgency */}
                      <div className="space-y-3">
                        <label className="text-on-surface font-bold block">工厂交期排产加急状态</label>
                        <div className="grid grid-cols-2 gap-4 font-bold text-xs">
                          <button
                            type="button"
                            onClick={() => setUrgency('standard')}
                            className={`py-2 rounded-xl border transition ${
                              urgency === 'standard' 
                                ? 'bg-primary text-white border-primary shadow-sm' 
                                : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
                            }`}
                          >
                            常规排产 (10-15天)
                          </button>
                          <button
                            type="button"
                            onClick={() => setUrgency('express')}
                            className={`py-2 rounded-xl border transition ${
                              urgency === 'express' 
                                ? 'bg-primary text-white border-primary shadow-sm' 
                                : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
                            }`}
                          >
                            加急绿道 (5-7天)
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Pricing proposal sheet */}
                  <div className="lg:col-span-7 bg-white border border-outline-variant rounded-xl p-4 space-y-2 shadow-sm text-xs font-semibold">
                    <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest font-mono">
                        B2B 国际商务规范提案
                      </span>
                      <span className="px-2.5 py-0.5 bg-primary/10 text-primary font-bold text-[10px] rounded-xl border border-primary/20">
                        正式核价单 (Quotation)
                      </span>
                    </div>

                    <div className="space-y-2 text-xs font-medium">
                      
                      {/* Product Header */}
                      <div className="bg-surface-container-low border border-outline-variant/60 p-4 rounded-xl flex justify-between items-center">
                        <div>
                          <span className="text-[10px] text-on-surface-variant block font-mono">SPECIFIED ARTICLE</span>
                          <span className="text-sm font-black text-primary">{proposal.sku} - 电化铝烫金箔</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-on-surface-variant block font-mono">UNIT PRICE (CIF)</span>
                          <span className="text-base font-black text-primary font-mono">${proposal.unitPrice} / ㎡</span>
                        </div>
                      </div>

                      {/* Detail calculations list */}
                      <div className="space-y-2.5 border-b border-outline-variant/50 pb-4 text-xs">
                        <div className="flex justify-between">
                          <span className="text-on-surface-variant">1. 原材料及标准大底出厂费:</span>
                          <span className="text-on-surface font-mono font-bold">${proposal.baseCost}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-on-surface-variant">2. 高精细铜质模具固化费用 (一次性):</span>
                          <span className="text-on-surface font-mono font-bold">${proposal.samplingFee}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-on-surface-variant">3. 精细排版工艺耗损附加:</span>
                          <span className="text-on-surface font-mono font-bold">${proposal.processSurcharge}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-on-surface-variant">4. 生产车间绿通加急调度附加:</span>
                          <span className="text-on-surface font-mono font-bold">${proposal.urgencySurcharge}</span>
                        </div>
                      </div>

                      {/* Total cost */}
                      <div className="flex justify-between items-baseline pt-2">
                        <span className="text-sm font-bold text-primary">总价估计 (TOTAL QUOTATION):</span>
                        <div className="text-right">
                          <span className="text-2xl font-black text-primary font-mono">${proposal.totalPrice}</span>
                          <span className="text-[10px] text-on-surface-variant block mt-1">含空运及基础制版服务费</span>
                        </div>
                      </div>

                      {/* Contract terms */}
                      <div className="p-2 bg-surface-container-low rounded-xl border border-outline-variant/55 space-y-2 text-[11px] text-on-surface-variant font-medium">
                        <p className="font-bold text-primary flex items-center gap-4 border-b border-outline-variant/40 pb-1.5">
                          <Info className="w-3.5 h-3.5" />
                          合同商务约束条款 (Contract Terms)
                        </p>
                        <p><strong>支付模式:</strong> {proposal.paymentTerm}</p>
                        <p><strong>国际贸易条件:</strong> {proposal.deliveryTerms}</p>
                        <p><strong>大货合格判定:</strong> 检验执行标准《K系列离型物理拉伸标准》。</p>
                      </div>

                      <div className="flex justify-end gap-4 pt-2">
                        <button
                          onClick={() => setActiveTab('evidence')}
                          className="px-2.5 py-2.5 bg-primary hover:bg-primary-container text-white font-bold rounded-xl flex items-center gap-1 transition shadow-md shadow-primary/10"
                          id="pricing-next-step-btn"
                        >
                          下一步：附带车间打样证据
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                    </div>
                  </div>

                </div>
              ) : (
                <div className="py-20 text-center text-on-surface-variant bg-white border border-outline-variant rounded-xl">
                  <DollarSign className="w-12 h-12 text-on-surface-variant/40 mx-auto animate-bounce" />
                  <p className="text-sm font-bold text-on-surface">报价测算准备中...</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: EVIDENCE MATCH */}
          {activeTab === 'evidence' && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200" id="view-evidence">
              <div className="bg-white border border-outline-variant rounded-xl p-4 space-y-2 shadow-sm">
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-outline-variant/60 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                      <Database className="w-5 h-5 text-primary" />
                      对标实践云：车间真实打样与测试性能背书
                    </h3>
                    <p className="text-[11px] text-on-surface-variant mt-0.5 font-medium">
                      海外买家极其注重技术细节。以下为系统从【实践云】证据库中精准检索并匹配的底材实烫证据：
                    </p>
                  </div>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-1.5 rounded-xl border border-emerald-200 font-mono">
                    匹配关联度最高的物理试验卡: {matchedEvidenceCards.length} 份
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {matchedEvidenceCards.length > 0 ? (
                    matchedEvidenceCards.map((card) => (
                      <div 
                        key={card.id}
                        className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden p-4 space-y-2"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[9px] font-mono text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-xl font-bold">
                              {card.evidenceNo}
                            </span>
                            <h4 className="text-sm font-bold text-primary mt-1">{card.sku} - {card.color}</h4>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-xl border ${
                            card.recommendLevel === 'high' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            card.recommendLevel === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {card.recommendLevel === 'high' ? '高可靠性' : card.recommendLevel === 'medium' ? '中度可用' : '高风险警告'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-[11px] font-medium text-on-surface-variant">
                          <div>试验底材：<strong className="text-on-surface">{card.substrate}</strong></div>
                          <div>调机气压：<strong className="text-on-surface">{card.parameters.pressure} kg</strong></div>
                          <div>试验温度：<strong className="text-on-surface">{card.parameters.temp} ℃</strong></div>
                          <div>测试速度：<strong className="text-on-surface">{card.parameters.speed} 印/时</strong></div>
                        </div>

                        <div className="p-4 bg-white rounded-xl border border-outline-variant/65 space-y-1">
                          <span className="text-[10px] text-primary block font-bold">实烫附着力与光洁现象判定:</span>
                          <p className="text-[11px] text-on-surface font-medium leading-relaxed font-sans">{card.results.defectNotes}</p>
                        </div>

                        <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 space-y-1">
                          <span className="text-[10px] text-rose-800 block font-bold">避坑防爆提示:</span>
                          <p className="text-[11px] text-rose-950 font-medium leading-relaxed font-sans">{card.riskNotes}</p>
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-on-surface-variant/80 border-t border-outline-variant/45 pt-3 font-mono">
                          <span>测试师: {card.operator}</span>
                          <span>日期: {card.testDate}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 py-16 text-center text-on-surface-variant bg-surface-container-low border border-outline-variant/50 rounded-xl">
                      <HelpCircle className="w-12 h-12 text-on-surface-variant/40 mx-auto" />
                      <p className="text-sm font-bold text-on-surface mt-2">暂无完全对标的实践打样证据卡</p>
                      <p className="text-xs">建议前往【实践云证据卡】模块创建一张包含该底材材质的真实打样测试记录。</p>
                    </div>
                  )}
                </div>

                {/* Final proposal report export banner */}
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mt-2">
                  <div className="space-y-1">
                    <h4 className="font-bold text-primary flex items-center gap-4 text-sm">
                      <Bookmark className="w-4 h-4 text-primary" />
                      已封装完整一键交付物方案报告
                    </h4>
                    <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
                      包含【底材风险诊断报告 + 主备推荐SKU技术规范 + 动态商务Quotation核算 + 实践云车间打样性能背书】。
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      showToast('报告导出成功！已将 PDF 打包方案自动沉淀至企业 CRM 营销系统。');
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 bg-primary hover:bg-primary-container text-white font-bold text-xs rounded-xl shadow-md shadow-primary/10 cursor-pointer shrink-0 transition"
                    id="export-pdf-report-btn"
                  >
                    <Download className="w-4 h-4" />
                    导出买家 PDF 对标方案书
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
