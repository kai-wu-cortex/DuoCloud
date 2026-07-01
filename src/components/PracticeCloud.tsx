/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Database, 
  Plus, 
  Gauge, 
  Award, 
  Calendar, 
  User, 
  X,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  Bookmark,
  Sparkles,
  Info,
  Download,
  Share2,
  CheckCircle,
  MoreVertical,
  Maximize2,
  Sliders,
  ChevronRight,
  Flame,
  FileText,
  List,
  LayoutGrid,
  ExternalLink,
  Clock,
  Star,
  Paperclip,
  Users,
  Layers,
  Droplet,
  ArrowUpRight,
  Heart,
  MapPin,
  Send
} from 'lucide-react';
import { PracticeCard, KnowledgeAsset, KnowledgeTableType } from '../types';
import { addDaysToDateString } from '../lib/appState';

interface PracticeCloudProps {
  cards: PracticeCard[];
  knowledgeAssets: KnowledgeAsset[];
  onAddCard: (newCard: Omit<PracticeCard, 'id' | 'evidenceNo' | 'testDate'>) => void;
}

interface ActivityLogEntry {
  id: string;
  author: string;
  message: string;
  time: string;
}

const RECOMMEND_LEVELS = {
  high: { label: '高度推荐 (合格)', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  medium: { label: '中度可用 (特定窗口)', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  low: { label: '风险极高 (警告)', color: 'text-rose-700 bg-rose-50 border-rose-200' }
};

const getSwatchGradient = (sku: string) => {
  const s = sku.toUpperCase();
  if (s.includes('K-600') || s.includes('L-200')) {
    return 'from-amber-500 via-yellow-400 to-yellow-200 text-slate-900';
  }
  if (s.includes('K-800') || s.includes('H-300')) {
    return 'from-yellow-600 via-amber-500 to-amber-300 text-slate-950';
  }
  if (s.includes('S-500')) {
    return 'from-yellow-500 via-yellow-300 via-amber-400 to-yellow-600 text-slate-900';
  }
  if (s.includes('L-220') || s.includes('S-550') || s.includes('H-350')) {
    return 'from-slate-400 via-zinc-300 to-zinc-100 text-slate-900';
  }
  if (s.includes('U-900') || s.includes('U-950')) {
    return 'from-purple-500 via-pink-500 via-yellow-400 via-emerald-400 to-blue-500 text-white';
  }
  if (s.includes('D-100')) {
    return 'from-slate-100 via-amber-100/50 to-blue-100/40 text-slate-800';
  }
  return 'from-slate-300 to-slate-200 text-slate-800';
};

export default function PracticeCloud({ cards, knowledgeAssets, onAddCard }: PracticeCloudProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubstrate, setSelectedSubstrate] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'split' | 'grid'>('split');
  const [detailTab, setDetailTab] = useState<'activity' | 'metrics' | 'risk' | 'rules'>('activity');
  const [isStarred, setIsStarred] = useState(false);
  const [activityDraft, setActivityDraft] = useState('');
  const [activityLogsByCard, setActivityLogsByCard] = useState<Record<string, ActivityLogEntry[]>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = window.localStorage.getItem('duocloud-practice-activity-logs');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    setDetailTab('activity');
    setIsStarred(false);
    setActivityDraft('');
  }, [selectedCardId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('duocloud-practice-activity-logs', JSON.stringify(activityLogsByCard));
  }, [activityLogsByCard]);

  // Form State for new test log
  const [sku, setSku] = useState('K-600');
  const [series, setSeries] = useState('K系列 (高端精细包装)');
  const [color, setColor] = useState('经典亮金');
  const [substrate, setSubstrate] = useState('');
  const [inkType, setInkType] = useState('无');
  const [processType, setProcessType] = useState('平压平自动烫金机');
  const [machineModel, setMachineModel] = useState('');
  const [temp, setTemp] = useState(120);
  const [pressure, setPressure] = useState(50);
  const [speed, setSpeed] = useState(3000);
  const [dwellTime, setDwellTime] = useState(0.15);
  const [clearness, setClearness] = useState(5);
  const [gloss, setGloss] = useState(5);
  const [adhesion, setAdhesion] = useState(5);
  const [abrasion, setAbrasion] = useState(5);
  const [defectNotes, setDefectNotes] = useState('极细线条边缘无任何毛刺，百格测试通过。');
  const [recommendLevel, setRecommendLevel] = useState<'high' | 'medium' | 'low'>('high');
  const [riskNotes, setRiskNotes] = useState('');
  const [operator, setOperator] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!substrate.trim() || !machineModel.trim() || !operator.trim()) {
      setFormError('请完整填写底材名称、打样机型号以及测试工艺师姓名！');
      return;
    }
    setFormError(null);

    onAddCard({
      sku,
      series,
      color,
      substrate,
      inkType,
      processType,
      machineModel,
      parameters: { temp, pressure, speed, dwellTime },
      results: { 
        clearness, 
        gloss, 
        adhesion, 
        abrasion, 
        photoUrl: sku.includes('L') ? 'bg-gradient-to-tr from-amber-400 to-yellow-200' :
                  sku.includes('S') ? 'bg-gradient-to-tr from-yellow-500 via-amber-300 to-yellow-600' :
                  sku.includes('U') ? 'bg-gradient-to-tr from-purple-500 via-amber-400 to-emerald-500' :
                  sku.includes('H') ? 'bg-gradient-to-br from-red-600 to-amber-500' : 'bg-gradient-to-tr from-amber-200 to-yellow-100',
        defectNotes 
      },
      recommendLevel,
      riskNotes: riskNotes || '测试通过，可推广使用',
      operator
    });

    // Reset Form
    setSubstrate('');
    setInkType('无');
    setMachineModel('');
    setTemp(120);
    setPressure(50);
    setSpeed(3000);
    setDwellTime(0.15);
    setClearness(5);
    setGloss(5);
    setAdhesion(5);
    setAbrasion(5);
    setDefectNotes('');
    setRecommendLevel('high');
    setRiskNotes('');
    setOperator('');
    setIsModalOpen(false);
    setToastMsg('打样卡片已成功录入');
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Extract unique substrates options
  const substratesOptions = [
    { label: '全部底材', value: 'all' },
    { label: '卡纸/普通白纸', value: '纸' },
    { label: '特种艺术纸', value: '特种' },
    { label: 'PP/PE/PET塑料', value: '塑料' },
    { label: '皮革/织物面料', value: '革' },
    { label: 'UV光油/油墨表面', value: 'UV' },
  ];

  // Filter cards
  const filteredCards = cards.filter(card => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      card.sku.toLowerCase().includes(q) ||
      card.substrate.toLowerCase().includes(q) ||
      card.color.toLowerCase().includes(q) ||
      card.operator.toLowerCase().includes(q);

    const matchesSubstrate = selectedSubstrate === 'all' || 
      card.substrate.toLowerCase().includes(selectedSubstrate.toLowerCase()) || 
      card.sku.toLowerCase().includes(selectedSubstrate.toLowerCase());

    const matchesLevel = selectedLevel === 'all' || card.recommendLevel === selectedLevel;

    return matchesSearch && matchesSubstrate && matchesLevel;
  });

  // Automatically find selected card
  const activeCard = filteredCards.find(c => c.id === selectedCardId) || filteredCards[0] || cards[0] || null;

  const renderStars = (score: number) => {
    return (
      <div className="flex gap-0.5 text-amber-500" title={`测试评分: ${score}/5`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={`text-xs ${i < score ? 'opacity-100 font-bold' : 'opacity-25'}`}>★</span>
        ))}
      </div>
    );
  };

  const handleDownload = (evNo: string) => {
    setToastMsg(`报告 ${evNo} 生成中...`);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleShare = (evNo: string) => {
    const appUrl = `${window.location.origin}/evidence/${evNo}`;
    navigator.clipboard.writeText(`【打样证据 App】查看详细报告与测试交互画板：${appUrl}`);
    setToastMsg('应用链接已复制！');
    setTimeout(() => setToastMsg(null), 3000);
  };

  const openAppCanvas = (evNo: string) => {
    navigate(`/evidence/${evNo}`);
  };

  const handlePublishActivityLog = (card: PracticeCard) => {
    const message = activityDraft.trim();
    if (!message) return;

    const now = new Date();
    const time = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    const author = operator.trim() || card.operator || '当前用户';
    const entry: ActivityLogEntry = {
      id: `${card.id}-${now.getTime()}`,
      author,
      message,
      time
    };

    setActivityLogsByCard((prev) => ({
      ...prev,
      [card.id]: [entry, ...(prev[card.id] || [])]
    }));
    setActivityDraft('');
    triggerToast('动态日志已发表');
  };

  const renderSidebarDetailContent = (card: PracticeCard, onClose?: () => void) => {
    // calculate average rating to determine status
    const avgScore = (card.results.clearness + card.results.adhesion + card.results.gloss + card.results.abrasion) / 4;
    const isApproved = avgScore >= 4;
    const userActivityLogs = activityLogsByCard[card.id] || [];

    return (
      <div className="flex flex-col h-full bg-white select-none font-sans text-left" id={`sidebar-detail-${card.id}`}>
        {/* Detail Header / Top Actions */}
        <div className="h-14 border-b border-slate-100 px-6 flex justify-between items-center bg-white sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-2">
            {onClose && (
              <button 
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition cursor-pointer -ml-2"
                title="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            <span className="text-xs text-slate-400 font-mono font-medium">
              证据详情：{card.evidenceNo}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Clock action (toggles activity tab) - styled as a beautiful light badge container */}
            <button 
              onClick={() => {
                setDetailTab('activity');
                triggerToast("已切换到「Activity (动态日志)」栏目");
              }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-2xs border ${
                detailTab === 'activity' 
                  ? 'bg-indigo-50 border-indigo-100 text-indigo-700' 
                  : 'bg-slate-50 border-slate-200/40 text-slate-700 hover:bg-slate-100'
              }`}
              title="查看历史记录与操作日志"
            >
              <Clock className="w-4.5 h-4.5" />
            </button>

            {/* Star Favorite toggle */}
            <button 
              onClick={() => {
                setIsStarred(!isStarred);
                triggerToast(!isStarred ? "✓ 报告已成功添加至收藏夹" : "已取消收藏该报告");
              }}
              className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition cursor-pointer"
              title={isStarred ? "取消收藏" : "收藏该报告"}
            >
              <Star className={`w-4.5 h-4.5 transition-colors ${isStarred ? 'text-amber-500 fill-amber-400' : 'text-slate-400'}`} />
            </button>

            {/* More action */}
            <button 
              className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition cursor-pointer"
              title="更多选项"
              onClick={() => triggerToast('💡 更多打样操作已解锁：支持打包下载、一键生成工艺PPT！')}
            >
              <MoreVertical className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Detail Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Main Display Title */}
          <div>
            <h2 className="text-[24px] font-bold text-slate-950 tracking-tight leading-snug font-sans flex items-center gap-2">
              {card.sku} - {card.color} 打样报告
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200/50 px-2 py-0.5 rounded-md font-mono font-bold uppercase">
                {card.series}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                双云数字实验室标准认证数据
              </span>
            </div>
          </div>

          {/* Metadata Table (Notion & Linear style) */}
          <div className="border-t border-slate-100 pt-5 space-y-3.5">
            {/* Row 1: Created Time */}
            <div className="flex items-center text-xs">
              <div className="w-36 text-slate-400 flex items-center gap-2 font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-400/80" />
                <span>录入时间</span>
              </div>
              <div className="flex-1 text-slate-700 font-semibold flex items-center gap-1.5">
                <span>{card.testDate} 10:35 AM</span>
              </div>
            </div>

            {/* Row 2: Status */}
            <div className="flex items-center text-xs">
              <div className="w-36 text-slate-400 flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-400/80" />
                <span>检测状态</span>
              </div>
              <div className="flex-1">
                {isApproved ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#F0FDF4] text-[#15803d] border border-[#bfe3c6] rounded-md font-semibold text-xs">
                    <span className="w-1.5 h-1.5 bg-[#16a34a] rounded-full" />
                    已通过验证 (Approved)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#FFF7ED] text-[#c2410c] border border-[#fed7aa] rounded-md font-semibold text-xs">
                    <span className="w-1.5 h-1.5 bg-[#ea580c] rounded-full" />
                    需开机防范 (Risk Warning)
                  </span>
                )}
              </div>
            </div>

            {/* Row 3: Priority */}
            <div className="flex items-center text-xs">
              <div className="w-36 text-slate-400 flex items-center gap-2 font-medium">
                <Award className="w-3.5 h-3.5 text-slate-400/80" />
                <span>时效优先级</span>
              </div>
              <div className="flex-1">
                {card.results.abrasion >= 5 ? (
                  <span className="inline-flex items-center px-2 py-0.5 bg-red-50 text-red-700 border border-red-100 rounded-md font-semibold text-xs">
                    加急打样 (High)
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md font-semibold text-xs">
                    标准时效 (Medium)
                  </span>
                )}
              </div>
            </div>

            {/* Row 4: Due Date */}
            <div className="flex items-center text-xs">
              <div className="w-36 text-slate-400 flex items-center gap-2 font-medium">
                <Calendar className="w-3.5 h-3.5 text-slate-400/80" />
                <span>交付日期</span>
              </div>
              <div className="flex-1 text-slate-700 font-semibold text-left">
                <span>{card.testDate} 至 {addDaysToDateString(card.testDate, 3)} (3个工作日内)</span>
              </div>
            </div>

            {/* Row 5: Tags */}
            <div className="flex items-start text-xs pt-1">
              <div className="w-36 text-slate-400 flex items-center gap-2 font-medium mt-1">
                <Bookmark className="w-3.5 h-3.5 text-slate-400/80" />
                <span>打样标签</span>
              </div>
              <div className="flex-1 flex flex-wrap gap-1.5 text-left">
                <span className="bg-[#F8F9FA] border border-slate-200/50 text-slate-600 px-2.5 py-0.5 rounded-md font-bold text-[11px]">
                  {card.substrate}
                </span>
                <span className="bg-[#F8F9FA] border border-slate-200/50 text-slate-600 px-2.5 py-0.5 rounded-md font-bold text-[11px]">
                  {card.machineModel}
                </span>
                {card.inkType !== '无' && (
                  <span className="bg-[#F8F9FA] border border-slate-200/50 text-slate-600 px-2.5 py-0.5 rounded-md font-bold text-[11px]">
                    {card.inkType}
                  </span>
                )}
                <span className="bg-[#F8F9FA] border border-slate-200/50 text-slate-600 px-2.5 py-0.5 rounded-md font-bold text-[11px]">
                  {card.processType || '精密烫印'}
                </span>
              </div>
            </div>

            {/* Row 6: Assignees */}
            <div className="flex items-center text-xs pt-1">
              <div className="w-36 text-slate-400 flex items-center gap-2 font-medium">
                <User className="w-3.5 h-3.5 text-slate-400/80" />
                <span>工艺负责人</span>
              </div>
              <div className="flex-1 flex items-center gap-2 text-left">
                <div className="flex items-center -space-x-1.5">
                  <div className="w-6 h-6 rounded-full bg-primary text-white border-2 border-white flex items-center justify-center text-[10px] font-black shadow-sm" title={`主检工艺师: ${card.operator}`}>
                    {card.operator.charAt(0)}
                  </div>
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-white border-2 border-white flex items-center justify-center text-[10px] font-black shadow-sm" title="王工 (协同复检员)">
                    王
                  </div>
                  <div className="w-6 h-6 rounded-full bg-amber-500 text-white border-2 border-white flex items-center justify-center text-[10px] font-black shadow-sm" title="陈工 (品质控制)">
                    陈
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 font-semibold ml-1">
                  {card.operator}、王工、陈工
                </span>
              </div>
            </div>
          </div>

          {/* Description Block ("Project Description") */}
          <div className="bg-[#F8F9FA] border border-slate-100 rounded-2xl p-4 shadow-sm text-left">
            <h4 className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-500" />
              <span>Project Description / 打样测试实烫现象与细节描述</span>
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              {card.results.defectNotes || "经双云实验室全套测试测定，该电化铝大底在推荐机台温度与行速下成色稳定，边缘锋利度高，未见拉断与起泡现象。"}
            </p>
          </div>

          {/* Tab Navigation (Notion & Linear Style) */}
          <div className="border-b border-slate-100 flex gap-4 text-xs font-semibold shrink-0">
            <button 
              onClick={() => setDetailTab('activity')}
              className={`pb-2.5 relative transition-colors cursor-pointer px-1 ${detailTab === 'activity' ? 'text-primary font-bold border-b-2 border-primary' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Activity (动态日志)
            </button>
            <button 
              onClick={() => setDetailTab('metrics')}
              className={`pb-2.5 relative transition-colors cursor-pointer px-1 ${detailTab === 'metrics' ? 'text-primary font-bold border-b-2 border-primary' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Metrics (物理指标)
            </button>
            <button 
              onClick={() => setDetailTab('risk')}
              className={`pb-2.5 relative transition-colors cursor-pointer px-1 ${detailTab === 'risk' ? 'text-primary font-bold border-b-2 border-primary' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Safety (开机忠告)
            </button>
            <button 
              onClick={() => setDetailTab('rules')}
              className={`pb-2.5 relative transition-colors cursor-pointer px-1 ${detailTab === 'rules' ? 'text-primary font-bold border-b-2 border-primary' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Rules (关联规则)
            </button>
          </div>

          {/* Tab Content Areas */}
          <div className="pt-2 text-left">
            {detailTab === 'activity' && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm shrink-0">
                      {(operator.trim() || card.operator || '我').slice(0, 1)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <textarea
                        value={activityDraft}
                        onChange={(event) => setActivityDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                            event.preventDefault();
                            handlePublishActivityLog(card);
                          }
                        }}
                        placeholder="发表一条打样动态，例如：已完成第二轮实烫复核，边缘毛刺已消除。"
                        className="w-full min-h-[76px] resize-y rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-xs font-medium leading-relaxed text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-primary/60 focus:bg-white focus:ring-2 focus:ring-primary/10"
                      />
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-semibold text-slate-400">
                          Ctrl/⌘ + Enter 快速发表
                        </span>
                        <button
                          type="button"
                          onClick={() => handlePublishActivityLog(card)}
                          disabled={!activityDraft.trim()}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-primary-container disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                        >
                          <Send className="w-3.5 h-3.5" />
                          发表日志
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section Today */}
                <div className="space-y-4">
                  <h5 className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">Today</h5>
                  
                  {/* Timeline container */}
                  <div className="relative pl-5 border-l-2 border-slate-100 ml-2.5 space-y-6">
                    {userActivityLogs.map((log) => (
                      <div className="relative" key={log.id}>
                        <span className="absolute -left-[27px] top-0.5 bg-indigo-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-white shadow-sm">
                          +
                        </span>
                        <div className="text-xs rounded-xl bg-indigo-50/60 border border-indigo-100 px-3 py-2.5">
                          <div className="mb-1">
                            <span className="font-bold text-slate-800">{log.author}</span>
                            <span className="text-slate-500"> 发表了动态日志 </span>
                            <span className="text-[10px] text-slate-400 ml-2">{log.time}</span>
                          </div>
                          <p className="whitespace-pre-wrap break-words text-slate-700 leading-relaxed font-medium">
                            {log.message}
                          </p>
                        </div>
                      </div>
                    ))}

                    {/* Node 1 */}
                    <div className="relative">
                      <span className="absolute -left-[27px] top-0.5 bg-emerald-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-white shadow-sm">
                        ✓
                      </span>
                      <div className="text-xs">
                        <span className="font-bold text-slate-800">{card.operator}</span>
                        <span className="text-slate-500"> 将该打样证据卡检测状态置为 </span>
                        <span className="font-bold text-emerald-600">已通过验证</span>
                        <span className="text-[10px] text-slate-400 ml-2">10:45 AM</span>
                      </div>
                    </div>

                    {/* Node 2 */}
                    <div className="relative">
                      <span className="absolute -left-[27px] top-0.5 bg-primary text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-white shadow-sm">
                        ★
                      </span>
                      <div className="text-xs">
                        <span className="font-bold text-slate-800">系统数据中心</span>
                        <span className="text-slate-500"> 自动生成了精密物理拉力及工艺性能指标报告 </span>
                        <span className="text-[10px] text-slate-400 ml-2">10:20 AM</span>
                      </div>
                    </div>

                    {/* Node 3: File Attachment Block (Exact Wireframe replication) */}
                    <div className="relative">
                      <span className="absolute -left-[27px] top-0.5 bg-amber-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-white shadow-sm">
                        ↑
                      </span>
                      <div className="space-y-2">
                        <div className="text-xs">
                          <span className="font-bold text-slate-800">双云质检组</span>
                          <span className="text-slate-500"> 上传了该烫金打样证据的离线电子文档：</span>
                          <span className="text-[10px] text-slate-400 ml-2">10:15 AM</span>
                        </div>
                        {/* Beautiful File Attachment Card */}
                        <div 
                          onClick={() => handleDownload(card.evidenceNo)}
                          className="flex items-center justify-between p-3.5 bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl shadow-xs hover:shadow-sm transition cursor-pointer max-w-sm text-left"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-11 bg-red-50 border border-red-200 rounded-lg flex flex-col justify-between p-1 shadow-2xs relative shrink-0">
                              <span className="text-[8px] font-extrabold text-red-600 font-mono tracking-tighter uppercase">PDF</span>
                              <FileText className="w-5 h-5 text-red-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-85" />
                              <div className="w-full h-1 bg-red-500 rounded-xs" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[11px] font-bold text-slate-800 truncate block max-w-[200px]" title={`【双云实验室】${card.sku}打样检测数据报告.pdf`}>
                                {card.sku}打样数据报告.pdf
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                PDF • 2.35 MB
                              </span>
                            </div>
                          </div>
                          <button 
                            className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-primary transition"
                            title="点击下载PDF报告"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section Yesterday */}
                <div className="space-y-4">
                  <h5 className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">Yesterday</h5>
                  <div className="relative pl-5 border-l-2 border-slate-100 ml-2.5 space-y-4">
                    <div className="relative">
                      <span className="absolute -left-[27px] top-0.5 bg-blue-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-white shadow-sm">
                        ✦
                      </span>
                      <div className="text-xs">
                        <span className="font-bold text-slate-800">系统匹配器</span>
                        <span className="text-slate-500"> 自动关联了 </span>
                        <strong className="text-primary font-bold">{(card.relatedKnowledgeAssetIds || []).length} 条云端知识库标准规则</strong>
                        <span className="text-[10px] text-slate-400 ml-2">09:30 AM</span>
                      </div>
                    </div>

                    <div className="relative">
                      <span className="absolute -left-[27px] top-0.5 bg-slate-400 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-white shadow-sm">
                        +
                      </span>
                      <div className="text-xs">
                        <span className="font-bold text-slate-800">{card.operator}</span>
                        <span className="text-slate-500"> 录入了初始调试参数并创建了此打样证据卡 </span>
                        <span className="text-[10px] text-slate-400 ml-2">09:00 AM</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {detailTab === 'metrics' && (
              <div className="space-y-5">
                {/* Star performance table */}
                <div className="bg-white border border-slate-150 rounded-2xl overflow-hidden shadow-xs">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                    <h5 className="text-xs font-bold text-slate-800">打样拉力与表面特性检测</h5>
                  </div>
                  <div className="divide-y divide-slate-100 text-xs">
                    <div className="px-4 py-3 flex justify-between items-center">
                      <span className="font-medium text-slate-600">精细线条清晰度 (Clearness)</span>
                      <div className="flex items-center gap-3">
                        {renderStars(card.results.clearness)}
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">&ge;4星</span>
                      </div>
                    </div>
                    <div className="px-4 py-3 flex justify-between items-center">
                      <span className="font-medium text-slate-600">3M胶带附着拉力 (Adhesion)</span>
                      <div className="flex items-center gap-3">
                        {renderStars(card.results.adhesion)}
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">&ge;4星</span>
                      </div>
                    </div>
                    <div className="px-4 py-3 flex justify-between items-center">
                      <span className="font-medium text-slate-600">镜面反射亮度光泽 (Gloss)</span>
                      <div className="flex items-center gap-3">
                        {renderStars(card.results.gloss)}
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">&ge;4星</span>
                      </div>
                    </div>
                    <div className="px-4 py-3 flex justify-between items-center">
                      <span className="font-medium text-slate-600">耐刮摩擦力防阻表现 (Abrasion)</span>
                      <div className="flex items-center gap-3">
                        {renderStars(card.results.abrasion)}
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">&ge;4星</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mechanical parameter grid */}
                <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-xs space-y-3">
                  <h5 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-primary" />
                    <span>打样工艺调机机台参数</span>
                  </h5>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="text-[9px] text-slate-400 font-bold uppercase">热烫温度</div>
                      <div className="text-sm font-bold text-primary font-mono mt-0.5">{card.parameters.temp}℃</div>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="text-[9px] text-slate-400 font-bold uppercase">调机压力</div>
                      <div className="text-sm font-bold text-primary font-mono mt-0.5">{card.parameters.pressure}kg</div>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="text-[9px] text-slate-400 font-bold uppercase">生产车速</div>
                      <div className="text-sm font-bold text-primary font-mono mt-0.5">{card.parameters.speed}印</div>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="text-[9px] text-slate-400 font-bold uppercase">驻留时间</div>
                      <div className="text-sm font-bold text-primary font-mono mt-0.5">{card.parameters.dwellTime}s</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {detailTab === 'risk' && (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-xs leading-relaxed space-y-3">
                  <div className="flex items-center gap-2 text-red-800 font-extrabold text-sm border-b border-red-200 pb-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>开机工艺安全红线 / Avoidance Advice</span>
                  </div>
                  <p className="text-red-900 font-medium text-[11px] leading-relaxed">
                    {card.riskNotes || "在车间量量产开机前，请确保印刷表面完全干燥且底漆已经固化，以免附着力不佳。"}
                  </p>
                </div>

                <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 text-xs space-y-2">
                  <h6 className="font-bold text-blue-900">双云实验室专业开机防范提醒：</h6>
                  <ul className="list-disc pl-4 space-y-1.5 text-blue-950/80 font-medium">
                    <li>工艺员应严格比对推荐调机气压（{card.parameters.pressure}kg），误差超过1.5kg可能导致哑面变亮。</li>
                    <li>承印底材为 {card.substrate} 时，注意冬季静电消除，避免热烫跳空或边缘起毛。</li>
                    <li>若行速超过每小时 {card.parameters.speed + 200} 印，请适当补偿加热温度 3-5℃。</li>
                  </ul>
                </div>
              </div>
            )}

            {detailTab === 'rules' && (
              <div className="space-y-3">
                {card.relatedKnowledgeAssetIds && card.relatedKnowledgeAssetIds.length > 0 ? (
                  <div className="space-y-2.5">
                    <p className="text-xs text-slate-400 font-medium">已自动关联以下标准工艺判定规则与解决方法：</p>
                    {card.relatedKnowledgeAssetIds.map(kaId => {
                      const ka = knowledgeAssets.find(k => k.id === kaId);
                      if (!ka) return null;
                      return (
                        <div key={kaId} className="p-3.5 bg-white border border-slate-150 rounded-xl hover:border-slate-300 shadow-2xs transition-shadow flex justify-between items-start gap-2 text-left">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-md font-mono text-[9px] font-bold border border-blue-100">
                                {ka.id}
                              </span>
                              <span className="text-[10px] text-blue-600 bg-blue-50/50 px-1.5 py-0.5 rounded-md border border-blue-100/50">
                                {ka.category === 'compatibility_rule' ? '适配规则' : ka.category === 'process_knowledge' ? '工艺知识' : ka.category === 'substrate_knowledge' ? '底材知识' : '标准资产'}
                              </span>
                            </div>
                            <span className="font-bold text-slate-800 text-xs block truncate" title={ka.title}>
                              {ka.title}
                            </span>
                          </div>
                          <button 
                            onClick={() => alert(`【云知识库联动】正在打开核心工艺知识条目：${ka.title}`)}
                            className="p-1 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-primary transition shrink-0"
                            title="查看详情"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400 text-xs font-medium bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                    该证据卡当前未关联任何标准知识资产规则
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background gap-2 relative" id="practice-cloud">
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

      {/* 1. Unified Control Toolbar */}
      <div className="bg-white border border-outline-variant/85 rounded-xl p-4 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-2 shrink-0">
        {/* Left Side: Title + Stats + View Mode Switcher */}
        <div className="flex flex-col md:flex-row md:items-center gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary shrink-0" />
              <h1 className="text-base font-black text-primary">实践云证据卡</h1>
            </div>
            <div className="text-[10px] text-on-surface-variant flex items-center gap-4 mt-0.5 font-semibold">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-xl bg-primary inline-block"></span> 
                共 {cards.length} 条测试
              </span>
              <span className="text-outline-variant">|</span>
              <span>检索到 {filteredCards.length} 条记录</span>
            </div>
          </div>

          {/* View Mode Toggle Group */}
          <div className="inline-flex bg-surface-container-low p-1 rounded-xl border border-outline-variant/65 self-start md:self-auto">
            <button
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-4 px-1.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'split' 
                  ? 'bg-white text-primary shadow-sm' 
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title="分栏详细视图"
            >
              <List className="w-3.5 h-3.5" />
              <span>分栏视图</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-4 px-1.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'grid' 
                  ? 'bg-white text-primary shadow-sm' 
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title="卡片网格视图"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>卡片视图</span>
            </button>
          </div>
        </div>

        {/* Right Side: Search, Filters, Add Button */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search bar */}
          <div className="relative min-w-[180px] sm:min-w-[240px] flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-2.5 text-on-surface-variant w-4 h-4" />
            <input 
              type="text"
              placeholder="搜索 SKU / 底材 / 工艺师..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant rounded-xl pl-8.5 pr-3 py-1.5 text-xs text-on-surface placeholder-on-surface-variant focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all font-semibold"
              id="practice-search-input"
            />
          </div>

          {/* Substrate Filter */}
          <select
            value={selectedSubstrate}
            onChange={(e) => setSelectedSubstrate(e.target.value)}
            className="bg-surface-container-low border border-outline-variant rounded-xl text-xs px-2.5 py-1.5 text-on-surface font-bold outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            id="practice-substrate-filter"
          >
            {substratesOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Level Filter */}
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="bg-surface-container-low border border-outline-variant rounded-xl text-xs px-2.5 py-1.5 text-on-surface font-bold outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            id="practice-level-filter"
          >
            <option value="all">等级: 全部</option>
            <option value="high">合格 (高度推荐)</option>
            <option value="medium">限制 (中度条件)</option>
            <option value="low">警告 (风险极高)</option>
          </select>

          {/* Add practice card button */}
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-primary hover:bg-primary-container text-white text-xs font-bold px-4 py-1.5 rounded-xl flex items-center gap-4 shadow-md hover:shadow-lg active:scale-95 transition-all ml-1"
            title="录入打样测试"
            id="add-practice-card-btn"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">录入测试实践</span>
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      {viewMode === 'split' ? (
        /* Split Layout Container */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-stretch h-[calc(100vh-11rem)] md:h-[calc(100vh-10.5rem)] min-h-[500px] w-full">
          
          {/* LEFT COLUMN: Command Center List Pane */}
          <div className="lg:col-span-5 xl:col-span-4 bg-white border border-outline-variant/80 rounded-xl flex flex-col h-full overflow-hidden shadow-sm" id="list-pane">
            {/* Split List Header Subtitle */}
            <div className="p-4 border-b border-outline-variant bg-surface-container-low/50 font-bold text-xs text-primary flex items-center justify-between shrink-0">
              <span>测试材料记录目录</span>
              <span className="text-[10px] text-on-surface-variant">找到 {filteredCards.length} 项</span>
            </div>

            {/* Ultra-Compact Scrollable Cards List */}
            <div className="flex-1 overflow-y-auto p-2 bg-surface-container-lowest divide-y divide-outline-variant/10">
              {filteredCards.length > 0 ? (
                filteredCards.map((card) => {
                  const rLevel = RECOMMEND_LEVELS[card.recommendLevel];
                  const isSelected = activeCard && activeCard.id === card.id;
                  
                  return (
                    <div
                      key={card.id}
                      onClick={() => {
                        setSelectedCardId(card.id);
                        if (window.innerWidth < 1024) {
                          setIsMobileDetailOpen(true);
                        }
                      }}
                      className={`p-4 mb-1.5 rounded-xl cursor-pointer flex gap-4 items-center relative transition-all group border ${
                        isSelected 
                          ? 'bg-secondary border-primary/40 shadow-md text-white' 
                          : 'bg-surface border-transparent hover:border-outline-variant hover:bg-surface-variant/40'
                      }`}
                    >
                      {/* Left status badge icon */}
                      <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center border ${
                        card.recommendLevel === 'high' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
                        card.recommendLevel === 'medium' ? 'bg-amber-50 border-amber-200 text-amber-600' :
                        'bg-rose-50 border-rose-200 text-rose-600'
                      }`}>
                        {card.recommendLevel === 'high' && <CheckCircle className="w-5 h-5" />}
                        {card.recommendLevel === 'medium' && <Info className="w-5 h-5" />}
                        {card.recommendLevel === 'low' && <AlertTriangle className="w-5 h-5" />}
                      </div>

                      {/* Middle Card Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <span className={`text-[9px] font-mono font-black tracking-wider uppercase ${isSelected ? 'text-indigo-200' : 'text-on-surface-variant'}`}>
                            {card.evidenceNo}
                          </span>
                          <span className={`text-[9px] font-medium ${isSelected ? 'text-slate-300' : 'text-on-surface-variant'}`}>{card.testDate}</span>
                        </div>
                        <h3 className={`text-xs font-black truncate ${isSelected ? 'text-white' : 'text-on-surface'}`}>
                          {card.sku} - {card.color}
                        </h3>
                        <div className={`text-[10px] truncate mt-0.5 font-medium ${isSelected ? 'text-slate-300' : 'text-on-surface-variant'}`}>
                          {card.substrate} ｜ {card.processType}
                        </div>
                      </div>

                      {/* Right Key Metrics mini */}
                      <div className="flex flex-col items-end flex-shrink-0 gap-0.5 ml-1 text-[9px] font-bold font-mono">
                        <div className={`flex items-center gap-1 ${isSelected ? 'text-slate-300' : 'text-on-surface-variant'}`}>
                          <span>附着:</span>
                          <span className={`${isSelected ? 'text-[#FFD700]' : 'text-primary'}`}>{card.results.adhesion}★</span>
                        </div>
                        <div className={`flex items-center gap-1 ${isSelected ? 'text-slate-300' : 'text-on-surface-variant'}`}>
                          <span>锐度:</span>
                          <span className={`${isSelected ? 'text-[#FFD700]' : 'text-primary'}`}>{card.results.clearness}★</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-20 text-center space-y-2.5">
                  <Database className="w-12 h-12 text-on-surface-variant/40 mx-auto" />
                  <p className="text-xs font-bold text-on-surface">没有查到符合筛选条件的实践证据卡</p>
                  <p className="text-[11px] text-on-surface-variant">建议重新输入关键词或重置筛选条件</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Detailed Preview Pane */}
          <div className="hidden lg:flex lg:col-span-7 xl:col-span-8 bg-white border border-outline-variant/80 rounded-xl flex-col h-full overflow-hidden shadow-sm" id="preview-pane">
            {activeCard ? (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-hidden">
                  {renderSidebarDetailContent(activeCard)}
                </div>
                {/* Desktop Quick action buttons at the bottom of detail pane */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/50 grid grid-cols-3 gap-3 shrink-0">
                  <button 
                    onClick={() => openAppCanvas(activeCard.evidenceNo)}
                    className="flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl border border-indigo-100 hover:border-indigo-200 bg-white hover:bg-indigo-50/10 text-indigo-700 text-xs font-bold transition shadow-2xs cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>进入App画板</span>
                  </button>
                  <button 
                    onClick={() => handleDownload(activeCard.evidenceNo)}
                    className="flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl border border-slate-200/60 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>下载报告</span>
                  </button>
                  <button 
                    onClick={() => handleShare(activeCard.evidenceNo)}
                    className="flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl bg-[#092B5C] hover:bg-[#072146] text-white text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>复制App链接</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center items-center py-20 text-on-surface-variant">
                <Database className="w-16 h-16 text-on-surface-variant/40 animate-pulse" />
                <p className="text-sm font-bold text-on-surface mt-2">尚未载入或选择任何打样测试记录</p>
                <p className="text-xs">请在左侧列表中点击选择一条记录进行深度预览</p>
              </div>
            )}
          </div>

        </div>
      ) : (
        /* CARD VIEW: Grid Card View Mode */
        <div className="flex-1 overflow-y-auto h-[calc(100vh-11rem)] md:h-[calc(100vh-10.5rem)] min-h-[500px] w-full pb-12 compact-scrollbar">
          {filteredCards.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {filteredCards.map((card) => {
                const isSelected = activeCard && activeCard.id === card.id;
                
                return (
                  <div
                    key={card.id}
                    onClick={() => {
                      setSelectedCardId(card.id);
                      setIsMobileDetailOpen(true);
                    }}
                    className={`bg-white border rounded-[32px] p-3 shadow-sm hover:shadow-md transition-all flex flex-col gap-5 relative cursor-pointer mx-auto w-full max-w-sm ${
                      isSelected ? 'border-primary ring-1 ring-primary/20' : 'border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    {/* Header Image Area */}
                    <div className={`relative h-[220px] rounded-[24px] overflow-hidden bg-gradient-to-tr ${getSwatchGradient(card.sku)} flex flex-col justify-between p-4 shadow-inner group`}>
                      <div className="absolute inset-0 opacity-20 bg-black/10" />
                      <div className="absolute inset-y-0 w-32 bg-white/10 rotate-12 -translate-x-48 group-hover:animate-shine pointer-events-none transition-transform duration-700" />
                      
                      {/* Top Bar */}
                      <div className="relative z-10 flex justify-end gap-2 items-center">
                        <div className="bg-white/90 backdrop-blur-sm text-slate-900 px-3.5 py-1.5 rounded-full text-[11px] font-bold shadow-sm">
                          {card.recommendLevel === 'high' ? 'Approved' : card.recommendLevel === 'medium' ? 'Popular' : 'Warning'}
                        </div>
                        <button className="bg-white/90 backdrop-blur-sm text-slate-900 p-2 rounded-full hover:bg-white transition-colors shadow-sm">
                          <Heart className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Bottom Bar */}
                      <div className="relative z-10 flex items-end justify-between">
                        <div className="flex flex-col gap-1 text-slate-900 drop-shadow-md pb-1 min-w-0 pr-2">
                          <h3 className="text-xl font-black tracking-tight leading-none text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] truncate">
                            {card.sku} {card.color && `- ${card.color}`}
                          </h3>
                          <div className="flex items-center gap-1 text-white/90 text-xs font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] truncate">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{card.operator} • {card.substrate}</span>
                          </div>
                        </div>
                        
                        <button className="bg-white/95 backdrop-blur-sm text-slate-900 px-4 py-2.5 rounded-full font-bold text-[11px] flex items-center gap-1.5 hover:bg-white transition-colors shadow-sm shrink-0">
                          Details <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Stats Area */}
                    <div className="px-3 pb-3 flex flex-col gap-5 text-left">
                      {/* 3 Columns Stats */}
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-900 font-black text-sm">{card.parameters.temp} ℃</span>
                          <span className="text-slate-500 text-[11px] font-medium">Temp</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-900 font-black text-sm">{card.parameters.pressure} kg</span>
                          <span className="text-slate-500 text-[11px] font-medium">Pressure</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-900 font-black text-sm">{card.parameters.speed} /h</span>
                          <span className="text-slate-500 text-[11px] font-medium">Speed</span>
                        </div>
                      </div>

                      {/* Bottom Row */}
                      <div className="flex items-end justify-between gap-4 mt-1">
                        {/* Level */}
                        <div className="flex flex-col gap-2 flex-1">
                          <div className="flex gap-1.5 h-2 w-3/4">
                            <div className="h-full rounded-full flex-1 bg-[#60A5FA]" />
                            <div className="h-full rounded-full w-1/3 bg-slate-100" />
                          </div>
                          <span className="text-slate-500 text-[11px] font-medium">
                            {((card.results.clearness + card.results.adhesion + card.results.gloss + card.results.abrasion) / 4) >= 4 ? 'High Performance' : 'Moderate Level'}
                          </span>
                        </div>

                        {/* Rating */}
                        <div className="flex flex-col gap-0.5 items-center px-2">
                          <div className="flex items-center gap-1 text-slate-900 font-black text-sm">
                            {((card.results.clearness + card.results.adhesion + card.results.gloss + card.results.abrasion) / 4).toFixed(1)} <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          </div>
                          <span className="text-slate-500 text-[11px] font-medium">Rating</span>
                        </div>

                        {/* Mini abstract map block */}
                        <div className="w-[84px] h-14 bg-[#F4F4F5] rounded-[14px] flex items-center justify-center overflow-hidden shrink-0">
                          <svg viewBox="0 0 100 50" className="w-full h-full text-slate-400/80 fill-none stroke-current stroke-[2.5]">
                            <path d="M10,40 L25,35 L30,25 L45,28 L50,15 L65,10 L70,20 L80,10 L90,15" strokeLinecap="round" strokeLinejoin="round"/>
                            <circle cx="90" cy="15" r="2.5" className="fill-slate-500 stroke-none" />
                            <circle cx="10" cy="40" r="2.5" className="fill-slate-500 stroke-none" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-24 text-center space-y-3 bg-white border border-outline-variant rounded-xl shadow-sm">
              <Database className="w-12 h-12 text-on-surface-variant/40 mx-auto" />
              <p className="text-xs font-bold text-on-surface">没有查到符合筛选条件的实践证据卡</p>
              <p className="text-[11px] text-on-surface-variant">建议重新输入关键词或重置筛选条件</p>
            </div>
          )}
        </div>
      )}

      {/* MOBILE DRAWER/POPUP (Native-like experience when clicking a card on mobile/modal on desktop) */}
      <AnimatePresence>
        {isMobileDetailOpen && activeCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileDetailOpen(false)}
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
              <div className="flex-1 overflow-hidden">
                {renderSidebarDetailContent(activeCard, () => setIsMobileDetailOpen(false))}
              </div>

              {/* Quick action buttons for mobile drawer at the very bottom */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 grid grid-cols-3 gap-2 shrink-0">
                <button 
                  onClick={() => openAppCanvas(activeCard.evidenceNo)}
                  className="flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-xl border border-indigo-100 bg-white text-indigo-700 font-bold hover:bg-indigo-50/10 transition cursor-pointer text-[10px]"
                >
                  <ExternalLink className="w-4 h-4 text-indigo-600" />
                  <span>进入App画板</span>
                </button>
                <button 
                  onClick={() => handleDownload(activeCard.evidenceNo)}
                  className="flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-xl border border-slate-200/60 bg-white text-slate-700 font-bold hover:bg-slate-50 transition cursor-pointer text-[10px]"
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  <span>下载报告</span>
                </button>
                <button 
                  onClick={() => handleShare(activeCard.evidenceNo)}
                  className="flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-xl bg-[#092B5C] text-white font-bold hover:bg-[#072146] transition cursor-pointer text-[10px]"
                >
                  <Share2 className="w-4 h-4 text-white" />
                  <span>复制App链接</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CREATE PRACTICE CARD MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 z-50">
          <div className="bg-white border border-outline-variant rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 text-on-background">
            <div className="px-1.5 py-2 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
              <h3 className="font-bold text-primary text-sm flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-primary" />
                录入全新打样测试结果（实践云）
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-2 text-xs max-h-[75vh] overflow-y-auto">
              {/* Product SKU and Info */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-3">
                  <label className="text-on-surface-variant font-bold block">测试使用膜型 SKU *</label>
                  <select
                    value={sku}
                    onChange={(e) => {
                      const selectedSku = e.target.value;
                      setSku(selectedSku);
                      if (selectedSku.startsWith('K')) {
                        setSeries('K系列 (高端精细包装)');
                        setColor(selectedSku === 'K-600' ? '经典亮金' : '哑金 (香槟金)');
                      } else if (selectedSku.startsWith('L')) {
                        setSeries('L系列 (经济型通用电化铝)');
                        setColor(selectedSku === 'L-200' ? '标准亮金' : '经典亮银');
                      } else if (selectedSku.startsWith('S')) {
                        setSeries('S系列 (超强附着力塑料膜)');
                        setColor(selectedSku === 'S-500' ? '极亮金' : '冰感亮银');
                      } else if (selectedSku.startsWith('U')) {
                        setSeries('U系列 (耐UV上光后道)');
                        setColor(selectedSku === 'U-900' ? '激光防伪金' : '绚彩炫银');
                      } else {
                        setSeries('H系列 (皮革/特种织物)');
                        setColor(selectedSku === 'H-300' ? '复古红金' : '香槟哑银');
                      }
                    }}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3 text-on-surface outline-none focus:border-primary/50 font-semibold"
                    id="new-practice-sku"
                  >
                    <option value="K-600">K-600 经典亮金</option>
                    <option value="K-800">K-800 哑金 (香槟金)</option>
                    <option value="L-200">L-200 标准亮金</option>
                    <option value="L-220">L-220 经典亮银</option>
                    <option value="S-500">S-500 极亮金</option>
                    <option value="S-550">S-550 冰感亮银</option>
                    <option value="U-900">U-900 激光防伪金</option>
                    <option value="U-950">U-950 绚彩炫银</option>
                    <option value="H-300">H-300 复古红金</option>
                    <option value="H-350">H-350 香槟哑银</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-on-surface-variant font-bold block">打样工艺师姓名 *</label>
                  <input
                    type="text"
                    required
                    placeholder="例如：张工艺"
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3 text-on-surface outline-none focus:border-primary/50 font-medium"
                    id="new-practice-operator"
                  />
                </div>
              </div>

              {/* Substrate and Ink */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-3">
                  <label className="text-on-surface-variant font-bold block">具体试验底材材料 *</label>
                  <input
                    type="text"
                    required
                    placeholder="例如：250g哑粉纸 + 亮油"
                    value={substrate}
                    onChange={(e) => setSubstrate(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3 text-on-surface outline-none focus:border-primary/50 font-semibold"
                    id="new-practice-substrate"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-on-surface-variant font-bold block">印刷油墨或底漆涂料</label>
                  <input
                    type="text"
                    placeholder="如：UV油墨, 无, 大豆环保墨"
                    value={inkType}
                    onChange={(e) => setInkType(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3 text-on-surface outline-none focus:border-primary/50 font-medium"
                    id="new-practice-ink"
                  />
                </div>
              </div>

              {/* Machine Model and Process type */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-3">
                  <label className="text-on-surface-variant font-bold block">使用的烫印设备机型 *</label>
                  <input
                    type="text"
                    required
                    placeholder="例如：Bobst 106-ER, TY-105"
                    value={machineModel}
                    onChange={(e) => setMachineModel(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3 text-on-surface outline-none focus:border-primary/50 font-medium"
                    id="new-practice-machine"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-on-surface-variant font-bold block">烫印工艺模式</label>
                  <select
                    value={processType}
                    onChange={(e) => setProcessType(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3 text-on-surface outline-none focus:border-primary/50 font-medium"
                    id="new-practice-process-type"
                  >
                    <option value="平压平自动烫金机">平压平自动烫</option>
                    <option value="圆压平自动烫金机">圆压平起凸</option>
                    <option value="高速轮转热转印机">轮转热转印</option>
                    <option value="数码无版冷烫联动机">数码冷烫联动</option>
                  </select>
                </div>
              </div>

              {/* Machine params values */}
              <div className="p-2 bg-surface-container-low rounded-2xl border border-outline-variant/60 space-y-3">
                <span className="text-primary block font-bold">机台工艺调机参数</span>
                <div className="grid grid-cols-4 gap-2.5 text-center font-semibold">
                  <div>
                    <label className="text-[10px] text-on-surface-variant block font-medium">温度 (℃)</label>
                    <input
                      type="number"
                      required
                      value={temp}
                      onChange={(e) => setTemp(Number(e.target.value))}
                      className="w-full bg-white border border-outline-variant text-center rounded-xl p-3 text-on-surface font-mono mt-1 focus:border-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-on-surface-variant block font-medium">压力 (kg/c㎡)</label>
                    <input
                      type="number"
                      required
                      value={pressure}
                      onChange={(e) => setPressure(Number(e.target.value))}
                      className="w-full bg-white border border-outline-variant text-center rounded-xl p-3 text-on-surface font-mono mt-1 focus:border-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-on-surface-variant block font-medium">行速 (印/时)</label>
                    <input
                      type="number"
                      required
                      value={speed}
                      onChange={(e) => setSpeed(Number(e.target.value))}
                      className="w-full bg-white border border-outline-variant text-center rounded-xl p-3 text-on-surface font-mono mt-1 focus:border-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-on-surface-variant block font-medium">驻留 (秒)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={dwellTime}
                      onChange={(e) => setDwellTime(Number(e.target.value))}
                      className="w-full bg-white border border-outline-variant text-center rounded-xl p-3 text-on-surface font-mono mt-1 focus:border-primary/50"
                    />
                  </div>
                </div>
              </div>

              {/* Quality scores and ratings */}
              <div className="p-2 bg-surface-container-low rounded-2xl border border-outline-variant/60 space-y-3 font-semibold">
                <span className="text-primary block font-bold">打样检测物理指标评定 (1-5级)</span>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant text-[11px] font-medium">精细线条清晰度</span>
                    <select value={clearness} onChange={(e) => setClearness(Number(e.target.value))} className="bg-white border border-outline-variant text-on-surface rounded-lg p-4 font-mono outline-none">
                      {[5, 4, 3, 2, 1].map(v => <option key={v} value={v}>{v}级</option>)}
                    </select>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant text-[11px] font-medium">3M胶带粘接度</span>
                    <select value={adhesion} onChange={(e) => setAdhesion(Number(e.target.value))} className="bg-white border border-outline-variant text-on-surface rounded-lg p-4 font-mono outline-none">
                      {[5, 4, 3, 2, 1].map(v => <option key={v} value={v}>{v}级</option>)}
                    </select>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant text-[11px] font-medium">表面亮面反射度</span>
                    <select value={gloss} onChange={(e) => setGloss(Number(e.target.value))} className="bg-white border border-outline-variant text-on-surface rounded-lg p-4 font-mono outline-none">
                      {[5, 4, 3, 2, 1].map(v => <option key={v} value={v}>{v}级</option>)}
                    </select>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant text-[11px] font-medium">高阻抗摩擦表现</span>
                    <select value={abrasion} onChange={(e) => setAbrasion(Number(e.target.value))} className="bg-white border border-outline-variant text-on-surface rounded-lg p-4 font-mono outline-none">
                      {[5, 4, 3, 2, 1].map(v => <option key={v} value={v}>{v}级</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Recommend level */}
              <div className="space-y-3">
                <label className="text-on-surface-variant block font-bold">最终打样推荐评级</label>
                <select
                  value={recommendLevel}
                  onChange={(e) => setRecommendLevel(e.target.value as 'high' | 'medium' | 'low')}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3 text-on-surface outline-none focus:border-primary/50 font-bold"
                  id="new-practice-recommend-level"
                >
                  <option value="high">高度推荐 - 材料完全合格且稳定复现</option>
                  <option value="medium">中度可用 - 需控制特定较小的工艺窗口才合格</option>
                  <option value="low">风险极高 - 严重掉粉 / 飞金不附着，不推荐该材料配型</option>
                </select>
              </div>

              {/* Textnotes */}
              <div className="space-y-3">
                <label className="text-on-surface-variant block font-bold">打样测试实烫现象描述 *</label>
                <input
                  type="text"
                  required
                  placeholder="例如：极细线条无糊字；大字边缘在4200印/h速度时有1-2%飞金..."
                  value={defectNotes}
                  onChange={(e) => setDefectNotes(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3 text-on-surface outline-none focus:border-primary/50 font-medium"
                  id="new-practice-defects"
                />
              </div>

              <div className="space-y-3">
                <label className="text-on-surface-variant block font-bold">避坑防范忠告 (开机安全红线)</label>
                <input
                  type="text"
                  placeholder="例如：温度千万不可超125°C，否则飞金粘脏极其严重..."
                  value={riskNotes}
                  onChange={(e) => setRiskNotes(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3 text-on-surface outline-none focus:border-primary/50 font-medium"
                  id="new-practice-risks"
                />
              </div>

              <div className="flex justify-end gap-4 pt-4.5 border-t border-outline-variant/60">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-2.5 py-2.5 bg-surface-container-high hover:bg-outline-variant/40 text-on-surface font-bold rounded-xl transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-2.5 py-2.5 bg-primary hover:bg-primary-container text-white font-bold rounded-xl shadow-md transition"
                  id="save-practice-card-btn"
                >
                  验证并通过入库
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
