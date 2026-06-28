import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, BookOpen, Plus, Tag, Calendar, User, Filter, Sliders, DollarSign, ShieldAlert, Truck, MessageSquare, Layers, X, PlusCircle, CheckCircle2,
  Box, Puzzle, BookText, AlertTriangle, HelpCircle, MoreHorizontal, FileText, Video,
  LayoutGrid, List as ListIcon, Globe, Lock, Folder, Sparkles, Pencil
} from 'lucide-react';
import { KnowledgeAsset, KnowledgeTableType } from '../types';

interface KnowledgeCloudProps {
  assets: KnowledgeAsset[];
  onAddAsset: (newAsset: Omit<KnowledgeAsset, 'id' | 'lastUpdated'>) => void;
}

const CATEGORY_MAP: Record<KnowledgeTableType, { label: string; enLabel: string; icon: React.ReactNode; color: string; bgColor: string; borderColor: string }> = {
  product_master: { label: '产品主数据', enLabel: 'Product Master', icon: <Box className="w-4 h-4" />, color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-150' },
  substrate_knowledge: { label: '底材知识', enLabel: 'Substrate', icon: <Layers className="w-4 h-4" />, color: 'text-pink-700', bgColor: 'bg-pink-50', borderColor: 'border-pink-150' },
  compatibility_rule: { label: '适配规则', enLabel: 'Compatibility', icon: <Puzzle className="w-4 h-4" />, color: 'text-indigo-700', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-150' },
  process_knowledge: { label: '工艺知识', enLabel: 'Process Logic', icon: <Sliders className="w-4 h-4" />, color: 'text-teal-700', bgColor: 'bg-teal-50', borderColor: 'border-teal-150' },
  pricing_rule: { label: '报价规则', enLabel: 'Pricing Model', icon: <DollarSign className="w-4 h-4" />, color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-150' },
  quality_issue: { label: '质量问题', enLabel: 'Quality Control', icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-150' },
  supply_chain_capability: { label: '供应链能力', enLabel: 'Supply Chain', icon: <Truck className="w-4 h-4" />, color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-150' },
  faq_pitch: { label: 'FAQ与话术', enLabel: 'FAQ & Pitch', icon: <HelpCircle className="w-4 h-4" />, color: 'text-pink-700', bgColor: 'bg-pink-50', borderColor: 'border-pink-150' },
  tag_system: { label: '知识标签', enLabel: 'Tag System', icon: <Tag className="w-4 h-4" />, color: 'text-teal-700', bgColor: 'bg-teal-50', borderColor: 'border-teal-150' },
  knowledge_governance: { label: '知识治理', enLabel: 'Governance', icon: <ShieldAlert className="w-4 h-4" />, color: 'text-indigo-700', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-150' }
};

function getCategoryThemeClasses(cat: KnowledgeTableType): string {
  switch (cat) {
    case 'product_master':
      return 'bg-blue-50 text-blue-700 border-blue-100';
    case 'substrate_knowledge':
      return 'bg-pink-50 text-pink-700 border-pink-100';
    case 'compatibility_rule':
      return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    case 'process_knowledge':
      return 'bg-teal-50 text-teal-700 border-teal-100';
    case 'pricing_rule':
      return 'bg-amber-50 text-amber-700 border-amber-100';
    case 'quality_issue':
      return 'bg-red-50 text-red-700 border-red-100';
    case 'supply_chain_capability':
      return 'bg-orange-50 text-orange-700 border-orange-100';
    default:
      return 'bg-slate-50 text-slate-750 border-slate-100';
  }
}

export default function KnowledgeCloud({ assets, onAddAsset }: KnowledgeCloudProps) {
  const [activeCategory, setActiveCategory] = useState<KnowledgeTableType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<KnowledgeAsset | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeCardId, setActiveCardId] = useState<string | null>('T02-001');

  // New Asset Form State
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<KnowledgeTableType>('product_master');
  const [newContent, setNewContent] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newTagsString, setNewTagsString] = useState('');
  
  // Dynamic Fields State
  const [dynamicFields, setDynamicFields] = useState<Record<string, any>>({});

  const handleDynamicChange = (field: string, value: any) => {
    setDynamicFields(prev => ({ ...prev, [field]: value }));
  };

  // Handle Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newAuthor.trim()) {
      setToastMsg('请完整填写必填字段！');
      setTimeout(() => setToastMsg(null), 3000);
      return;
    }

    const tags = newTagsString
      .split(/[,，]/)
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const baseData = {
      title: newTitle,
      category: newCategory,
      content: newContent || "（无详细描述）",
      author: newAuthor,
      tags: tags.length > 0 ? tags : ['自定义']
    };

    onAddAsset({
      ...baseData,
      ...dynamicFields
    } as any);

    // Reset Form
    setNewTitle('');
    setNewCategory('product_master');
    setNewContent('');
    setNewAuthor('');
    setNewTagsString('');
    setDynamicFields({});
    setIsModalOpen(false);
  };

  // Filter Assets
  const filteredAssets = assets.filter(asset => {
    const matchesCategory = activeCategory === 'all' || asset.category === activeCategory;
    const query = searchQuery.toLowerCase();
    
    // Convert asset to a searchable string
    const assetString = JSON.stringify(asset).toLowerCase();
    const matchesSearch = assetString.includes(query);
    
    return matchesCategory && matchesSearch;
  });

  const renderDetailFields = (asset: KnowledgeAsset) => {
    const fields: Array<{label: string, value: any}> = [];
    
    switch (asset.category) {
      case 'product_master':
        fields.push(
          { label: '产品名称', value: asset.productName },
          { label: '产品大类', value: asset.productCategory },
          { label: '颜色', value: asset.colorName },
          { label: '色号', value: asset.colorCode },
          { label: '规格', value: asset.specifications },
          { label: '推荐底材', value: asset.recommendedSubstrates },
          { label: 'MOQ', value: asset.moq },
          { label: '使用风险', value: asset.riskLevel },
          { label: '推荐应用', value: asset.recommendedIndustries },
          { label: '产品状态', value: asset.productStatus },
          { label: '交期', value: asset.leadTime },
          { label: '是否有库存', value: asset.hasStock }
        );
        break;
      case 'substrate_knowledge':
        fields.push(
          { label: '底材名称', value: asset.substrateName },
          { label: '底材分类', value: asset.substrateCategory },
          { label: '表面处理', value: asset.surfaceTreatment },
          { label: '吸附难易度', value: asset.adhesionDifficulty },
          { label: '耐温情况', value: asset.temperatureResistance },
          { label: '常见问题', value: asset.commonIssues },
          { label: '处理建议', value: asset.treatmentAdvice }
        );
        break;
      case 'compatibility_rule':
        fields.push(
          { label: '产品型号', value: asset.productNo },
          { label: '底材名称', value: asset.substrateName },
          { label: '表面处理', value: asset.surfaceTreatment },
          { label: '适配等级', value: asset.compatibilityLevel },
          { label: '推荐理由', value: asset.recommendReason },
          { label: '温度范围', value: asset.tempRange },
          { label: '压力/速度', value: asset.pressureRange + ' / ' + asset.speedRange },
          { label: '风险说明', value: asset.riskNotes },
          { label: '必须打样', value: asset.requiresTesting }
        );
        break;
      case 'process_knowledge':
        fields.push(
          { label: '工艺名称', value: asset.processName },
          { label: '适用产品', value: asset.applicableProducts },
          { label: '温度范围', value: asset.tempRange },
          { label: '压力范围', value: asset.pressureRange },
          { label: '速度范围', value: asset.speedRange },
          { label: '设备要求', value: asset.equipmentRequirements },
          { label: '常见异常', value: asset.commonAnomalies },
          { label: '调机建议', value: asset.adjustmentAdvice }
        );
        break;
      case 'pricing_rule':
        fields.push(
          { label: '产品型号/系列', value: asset.productNo },
          { label: '最小起订(MOQ)', value: asset.moq },
          { label: '数量阶梯', value: asset.quantityTiers },
          { label: '交期规则', value: asset.leadTimeRule },
          { label: '加急/定制', value: asset.expediteFee + ' / ' + asset.customizationFee },
          { label: '让步边界', value: asset.concessionBoundary },
          { label: '报价备注', value: asset.pricingNotes }
        );
        break;
      case 'quality_issue':
        fields.push(
          { label: '缺陷名称', value: asset.defectName },
          { label: '可能原因1', value: asset.cause1 },
          { label: '可能原因2', value: asset.cause2 },
          { label: '调整建议', value: asset.adjustmentAdvice },
          { label: '是否需重打', value: asset.requiresReprint },
          { label: '客户解释口径', value: asset.clientExplanation }
        );
        break;
      case 'supply_chain_capability':
        fields.push(
          { label: '供应商名称', value: asset.vendorName },
          { label: '提供产品', value: asset.providedProducts },
          { label: '质量等级', value: asset.qualityLevel },
          { label: '常规交期', value: asset.normalLeadTime },
          { label: '供应风险', value: asset.supplyRisk },
          { label: '替代供应商', value: asset.alternativeVendor }
        );
        break;
      case 'faq_pitch':
        fields.push(
          { label: '问题分类', value: asset.questionCategory },
          { label: '客户常问', value: asset.clientQuestion },
          { label: '中文回答', value: asset.chineseAnswer },
          { label: '适用阶段', value: asset.applicableClientStage },
          { label: '禁止承诺内容', value: asset.forbiddenPromises }
        );
        break;
      case 'tag_system':
        fields.push(
          { label: '标签名称', value: asset.tagName },
          { label: '标签分类', value: asset.tagCategory },
          { label: '使用规则', value: asset.applicationRule },
          { label: '上级标签', value: asset.parentTag },
          { label: '互斥标签', value: asset.conflictingTags }
        );
        break;
      case 'knowledge_governance':
        fields.push(
          { label: '知识领域', value: asset.knowledgeDomain },
          { label: '简短标题', value: asset.briefTitle },
          { label: '版本信息', value: asset.version },
          { label: '审核状态', value: asset.reviewStatus },
          { label: '来源信息', value: asset.source }
        );
        break;
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        {fields.map((f, i) => (
          <div key={i} className={`space-y-1 ${f.value && f.value.length > 50 ? 'sm:col-span-2' : ''}`}>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{f.label}</span>
            <div className="text-sm font-medium text-on-surface leading-relaxed bg-white border border-outline-variant/40 px-1.5 py-2 rounded-xl">
              {f.value || '-'}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderDynamicInputs = () => {
    return (
      <div className="p-2 bg-surface-container rounded-xl border border-outline-variant/60">
        <p className="text-sm text-on-surface-variant mb-2">为了简化演示，各个知识表单的专有字段将记录在下方的“详情描述”中，在实际系统中将自动生成动态表单项。</p>
      </div>
    );
  };

  const categoryTitle = activeCategory === 'all' 
    ? 'Derivation Libraries' 
    : (CATEGORY_MAP[activeCategory]?.enLabel || 'Derivation Libraries');

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full bg-[#F4F5FA] relative min-h-[calc(100vh-140px)]" id="knowledge-cloud">
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

      {/* Left Sidebar for category selection on Desktop */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 shrink-0 gap-3">
        <div className="bg-white border border-[#E2E4E9] rounded-2xl p-4 space-y-1 shadow-xs">
          <h3 className="text-xs font-black text-[#0D0B3D] tracking-wider uppercase mb-3 flex items-center gap-2 font-sans px-2">
            <Filter className="w-3.5 h-3.5 text-[#5F52EE]" />
            知识云业务分类
          </h3>
          
          <button
            onClick={() => setActiveCategory('all')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
              activeCategory === 'all' 
                ? 'bg-[#5F52EE] text-white shadow-sm' 
                : 'text-[#0D0B3D] hover:bg-slate-50 hover:text-[#5F52EE]'
            }`}
          >
            <span className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 shrink-0" />
              全部数据 (All)
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-xl font-mono ${activeCategory === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {assets.length}
            </span>
          </button>

          {(Object.keys(CATEGORY_MAP) as KnowledgeTableType[]).map((cat) => {
            const count = assets.filter(a => a.category === cat).length;
            const item = CATEGORY_MAP[cat];
            const isSelected = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`w-full flex items-center justify-between px-3.5 py-2 transition cursor-pointer rounded-xl text-xs font-extrabold ${
                  isSelected 
                    ? 'bg-[#5F52EE] text-white shadow-sm' 
                    : 'text-[#0D0B3D] hover:bg-slate-50 hover:text-[#5F52EE]'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <span className={`${isSelected ? 'text-white' : 'text-[#5F52EE]'}`}>{item.icon}</span>
                  <span className="truncate text-left">{item.label}</span>
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-xl font-mono shrink-0 ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main content column on the right */}
      <div className="flex-1 flex flex-col gap-5 overflow-hidden">
        {/* Top Header Bar styled strictly like the reference image */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 shrink-0">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-[#0D0B3D] tracking-tight flex items-center gap-2">
              {categoryTitle}
              <span className="text-slate-400 font-semibold text-xs md:text-sm">({filteredAssets.length})</span>
            </h1>
          </div>

          {/* Filters and Actions toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Bar */}
            <div className="relative bg-white border border-[#E2E4E9] rounded-xl px-4 py-2 flex items-center gap-2 shadow-sm focus-within:border-slate-300 transition w-full sm:max-w-xs">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input 
                type="text" 
                placeholder="Search for Library..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs font-bold text-[#0D0B3D] border-none outline-none w-full placeholder-slate-400/80"
                id="knowledge-search-input"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Mobile Dropdown Select - only visible when not lg */}
            <div className="relative block lg:hidden w-full sm:w-auto">
              <select
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value as any)}
                className="w-full sm:w-48 bg-white border-2 border-[#5F52EE] rounded-xl pl-4 pr-10 py-2.5 text-sm font-extrabold text-[#5F52EE] outline-none appearance-none shadow-md cursor-pointer hover:border-[#4E41DC] transition"
              >
                <option value="all">全部数据 (All)</option>
                {(Object.keys(CATEGORY_MAP) as KnowledgeTableType[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_MAP[cat].label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#5F52EE]">
                <svg className="fill-current h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>

            {/* Grid/List View switcher */}
            <div className="flex items-center border border-[#E2E4E9] rounded-xl bg-white p-1 shadow-sm shrink-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'grid' 
                    ? 'bg-[#0D0B3D] text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4.5 h-4.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'list' 
                    ? 'bg-[#0D0B3D] text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="List View"
              >
                <ListIcon className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Create Library Button */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#5F52EE] hover:bg-[#4E41DC] text-white font-extrabold text-xs rounded-xl transition shadow-md shadow-primary/10 cursor-pointer shrink-0"
              id="add-knowledge-btn"
            >
              <Plus className="w-4 h-4" />
              <span>Create Library</span>
            </button>
          </div>
        </div>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Section Heading like "Recently Created" */}
        <div className="flex items-center justify-between font-medium shrink-0">
          <span className="text-xs font-extrabold text-slate-400 tracking-wider uppercase">
            Recently Created ({filteredAssets.length})
          </span>
          {activeCategory !== 'all' && (
            <button 
              onClick={() => setActiveCategory('all')} 
              className="text-xs text-[#5F52EE] font-bold hover:underline cursor-pointer"
            >
              Clear Category Filter
            </button>
          )}
        </div>

        {/* Grid and Card Renderers */}
        {viewMode === 'grid' ? (
          <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-12 pr-2 custom-scrollbar">
            {filteredAssets.length > 0 ? (
              filteredAssets.map((asset) => {
                const catItem = CATEGORY_MAP[asset.category] || { label: asset.category, enLabel: 'Asset', icon: <Box className="w-4 h-4" /> };
                const isActive = activeCardId === asset.id;
                return (
                  <div
                    key={asset.id}
                    onClick={() => setActiveCardId(asset.id)}
                    className={`group relative rounded-[14px] p-5 transition-all duration-300 cursor-pointer flex flex-col justify-between h-[210px] select-none ${
                      isActive 
                        ? 'bg-[#5F52EE] text-white shadow-xl shadow-[#5F52EE]/25 border-none transform -translate-y-1' 
                        : 'bg-white border border-[#E2E4E9] text-on-background hover:shadow-md hover:border-slate-300'
                    }`}
                  >
                    {/* Top line of card */}
                    <div className="flex items-center justify-between">
                      {/* Category Badge */}
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition ${
                        isActive
                          ? 'bg-white/15 text-white border-white/20'
                          : getCategoryThemeClasses(asset.category)
                      }`}>
                        {React.cloneElement(catItem.icon as React.ReactElement, { className: 'w-3.5 h-3.5' })}
                        <span>{catItem.enLabel || catItem.label}</span>
                      </div>

                      {/* Modify/Detail button exactly like reference image */}
                      {isActive ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAsset(asset);
                          }}
                          className="flex items-center gap-1 px-3 py-1 bg-white hover:bg-white/95 text-[#5F52EE] font-black text-[10px] rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Modify</span>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAsset(asset);
                          }}
                          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2.5 py-1 bg-[#F4F5FA] hover:bg-[#EAECEF] text-[#5F52EE] font-bold text-[10px] rounded-lg transition cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Detail</span>
                        </button>
                      )}
                    </div>

                    {/* Content Section */}
                    <div className="mt-2.5 flex-1 flex flex-col justify-center">
                      <h3 className={`font-black tracking-tight text-sm line-clamp-1 ${
                        isActive ? 'text-white' : 'text-[#0D0B3D]'
                      }`}>
                        {asset.title}
                      </h3>
                      <p className={`text-[11px] mt-1 leading-relaxed line-clamp-3 font-semibold ${
                        isActive ? 'text-white/80' : 'text-slate-400'
                      }`}>
                        {asset.content}
                      </p>
                    </div>

                    {/* Bottom Metadata row */}
                    <div className={`flex items-center justify-between text-[10px] font-extrabold pt-3.5 border-t font-mono tracking-wider uppercase ${
                      isActive ? 'border-white/10 text-white/70' : 'border-[#F1F3F7] text-slate-400'
                    }`}>
                      <div className="flex items-center gap-1">
                        {asset.id.charCodeAt(3) % 2 === 0 ? (
                          <>
                            <Lock className="w-3.5 h-3.5 opacity-75" />
                            <span>Private</span>
                          </>
                        ) : (
                          <>
                            <Globe className="w-3.5 h-3.5 opacity-75" />
                            <span>Public</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Folder className="w-3.5 h-3.5 opacity-75" />
                        <span>{((asset.id.charCodeAt(2) + asset.id.charCodeAt(3)) % 18) + 2} Projects</span>
                      </div>
                    </div>

                    {/* Sparkling stars decorative overlay on active card */}
                    {isActive && (
                      <div className="absolute right-3.5 bottom-3.5 opacity-15 pointer-events-none">
                        <Sparkles className="w-11 h-11 text-white" />
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="col-span-full h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-2xl border border-[#E2E4E9] border-dashed">
                <Search className="w-12 h-12 text-slate-300 mb-2" />
                <p className="text-sm font-bold text-primary">暂无匹配的知识资产</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  尝试调整搜索词或分类，或者点击“Create Library”录入数据。
                </p>
              </div>
            )}
          </div>
        ) : (
          /* List View */
          <div className="flex-1 overflow-y-auto pb-12 pr-2 custom-scrollbar">
            {filteredAssets.length > 0 ? (
              <div className="bg-white border border-[#E2E4E9] rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-[#E2E4E9] text-slate-400 font-extrabold text-[10px] uppercase tracking-wider">
                      <th className="py-3 px-5">Standard Title</th>
                      <th className="py-3 px-5">Category</th>
                      <th className="py-3 px-5">Author</th>
                      <th className="py-3 px-5">Last Updated</th>
                      <th className="py-3 px-5">Status</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F3F7] text-xs font-semibold">
                    {filteredAssets.map((asset) => {
                      const cat = CATEGORY_MAP[asset.category] || { label: asset.category, enLabel: 'Asset' };
                      return (
                        <tr key={asset.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-3.5 px-5 font-black text-[#0D0B3D] max-w-xs truncate">{asset.title}</td>
                          <td className="py-3.5 px-5">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${getCategoryThemeClasses(asset.category)}`}>
                              {cat.enLabel || cat.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-slate-500 font-bold">{asset.author}</td>
                          <td className="py-3.5 px-5 text-slate-400 font-mono">{asset.lastUpdated}</td>
                          <td className="py-3.5 px-5">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${asset.id.charCodeAt(3) % 2 === 0 ? 'text-slate-500' : 'text-emerald-600'}`}>
                              {asset.id.charCodeAt(3) % 2 === 0 ? '🔒 Private' : '🌐 Public'}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <button
                              onClick={() => setSelectedAsset(asset)}
                              className="text-[#5F52EE] hover:underline font-extrabold cursor-pointer"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-2xl border border-[#E2E4E9] border-dashed">
                <Search className="w-12 h-12 text-slate-300 mb-2" />
                <p className="text-sm font-bold text-primary">暂无匹配的知识资产</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  尝试调整搜索词或分类。
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      {/* Asset Detail Drawer */}
      <AnimatePresence>
        {selectedAsset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedAsset(null)}
            className="fixed inset-0 bg-black/35 backdrop-blur-xs z-50 flex justify-end"
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border-l border-outline-variant w-full max-w-2xl h-full flex flex-col shadow-2xl text-on-background relative"
            >
              {/* Header */}
              <div className="px-1.5 py-2 bg-surface-container-low border-b border-outline-variant flex items-center justify-between shrink-0">
                <span className={`inline-flex items-center gap-4 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${CATEGORY_MAP[selectedAsset.category].bgColor} ${CATEGORY_MAP[selectedAsset.category].color} ${CATEGORY_MAP[selectedAsset.category].borderColor}`}>
                  {CATEGORY_MAP[selectedAsset.category].icon}
                  {CATEGORY_MAP[selectedAsset.category].label}
                </span>
                <button 
                  onClick={() => setSelectedAsset(null)}
                  className="text-on-surface-variant hover:text-on-surface transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-primary tracking-tight font-sans leading-snug">{selectedAsset.title}</h2>
                  <div className="flex items-center gap-4 mt-3 text-[10px] text-on-surface-variant/85 font-mono font-bold">
                    <span className="flex items-center gap-1"><User className="w-3.5 h-3.5 text-primary" /> 负责人: {selectedAsset.author}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-primary" /> 更新时间: {selectedAsset.lastUpdated}</span>
                  </div>
                </div>

                {/* Structured Fields Grid */}
                <div className="bg-surface-container-low border border-outline-variant/60 rounded-xl p-4">
                  <h3 className="text-xs font-bold text-primary mb-2 flex items-center gap-4 border-b border-outline-variant/60 pb-2">
                    <Layers className="w-4 h-4" /> 结构化字段属性
                  </h3>
                  {renderDetailFields(selectedAsset)}
                </div>
                
                {/* Free Text Content */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-primary flex items-center gap-4">
                    <BookText className="w-4 h-4" /> 详细描述与指导
                  </h3>
                  <div className="p-4 bg-surface-container-low rounded-xl text-xs text-on-surface leading-relaxed whitespace-pre-line border border-outline-variant/50 font-medium">
                    {selectedAsset.content}
                  </div>
                </div>

                {/* Tags */}
                <div className="pt-2">
                  <h3 className="text-xs font-bold text-primary flex items-center gap-4 mb-3">
                    <Tag className="w-4 h-4" /> 知识标签
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedAsset.tags.map(tag => (
                      <span key={tag} className="text-[11px] bg-white text-on-surface-variant px-1.5 py-1 rounded-xl flex items-center gap-1 border border-outline-variant shadow-sm font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Asset Drawer */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsModalOpen(false)}
            className="fixed inset-0 bg-black/35 backdrop-blur-xs z-50 flex justify-end"
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border-l border-outline-variant w-full max-w-xl h-full flex flex-col shadow-2xl text-on-background relative"
            >
              <div className="px-1.5 py-2 bg-surface-container-low border-b border-outline-variant flex items-center justify-between shrink-0">
                <h3 className="font-bold text-primary text-sm flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-primary" />
                  录入知识云主数据
                </h3>
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-on-surface-variant hover:text-on-surface cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs bg-surface-container/30">
                  
                  {/* Step 1: Base Type & Title */}
                  <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 space-y-3 shadow-sm">
                    <div className="space-y-3">
                      <label className="text-on-surface-variant font-bold block">1. 选择数据表类型 <span className="text-rose-500">*</span></label>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(CATEGORY_MAP) as KnowledgeTableType[]).map((cat) => (
                          <label key={cat} className={`flex items-center gap-2 p-4 rounded-xl border cursor-pointer transition ${newCategory === cat ? 'bg-primary/5 border-primary/50 text-primary' : 'bg-white border-outline-variant text-on-surface hover:bg-surface-container-low'}`}>
                            <input 
                              type="radio" 
                              name="knowledgeType" 
                              value={cat} 
                              checked={newCategory === cat} 
                              onChange={(e) => setNewCategory(e.target.value as KnowledgeTableType)}
                              className="hidden" 
                            />
                            {CATEGORY_MAP[cat].icon}
                            <span className="font-bold">{CATEGORY_MAP[cat].label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-on-surface-variant font-bold block">知识条目标题 <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        required
                        placeholder="例如：G-1201 亮金膜产品主数据"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="w-full bg-white border border-outline-variant rounded-xl p-4 text-on-surface outline-none focus:border-primary/50 font-medium shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Step 2: Dynamic Fields */}
                  <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 space-y-3 shadow-sm">
                    <h4 className="font-bold text-primary flex items-center gap-4 pb-2 border-b border-outline-variant/60">
                      <Layers className="w-4 h-4" /> 2. 填写结构化字段
                    </h4>
                    {renderDynamicInputs()}
                  </div>

                  {/* Step 3: Base Detail & Meta */}
                  <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 space-y-3 shadow-sm">
                    <h4 className="font-bold text-primary flex items-center gap-4 pb-2 border-b border-outline-variant/60">
                      <BookText className="w-4 h-4" /> 3. 详情与元数据
                    </h4>
                    <div className="space-y-3">
                      <label className="text-on-surface-variant font-bold block">详细描述 / 备注</label>
                      <textarea
                        rows={3}
                        placeholder="补充描述或非结构化的经验说明..."
                        value={newContent}
                        onChange={(e) => setNewContent(e.target.value)}
                        className="w-full bg-white border border-outline-variant rounded-xl p-4 text-on-surface outline-none focus:border-primary/50 font-sans font-medium shadow-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-3">
                        <label className="text-on-surface-variant font-bold block">责任人 <span className="text-rose-500">*</span></label>
                        <input
                          type="text"
                          required
                          placeholder="例如：产品部李工"
                          value={newAuthor}
                          onChange={(e) => setNewAuthor(e.target.value)}
                          className="w-full bg-white border border-outline-variant rounded-xl p-4 text-on-surface outline-none focus:border-primary/50 font-medium shadow-sm"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-on-surface-variant block font-bold">标签体系（逗号分隔）</label>
                        <input
                          type="text"
                          placeholder="例如：主推, 亮金, G-1201"
                          value={newTagsString}
                          onChange={(e) => setNewTagsString(e.target.value)}
                          className="w-full bg-white border border-outline-variant rounded-xl p-4 text-on-surface outline-none focus:border-primary/50 font-medium shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-4 px-1.5 py-2.5 bg-surface-container-low border-t border-outline-variant/60 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-2.5 py-2.5 bg-white border border-outline-variant hover:bg-surface-container-low text-on-surface font-bold rounded-xl transition cursor-pointer shadow-sm"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-2.5 py-2.5 bg-primary hover:bg-primary-container text-white font-bold rounded-xl shadow-md transition cursor-pointer"
                    id="save-knowledge-btn"
                  >
                    提交审核并发布
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
