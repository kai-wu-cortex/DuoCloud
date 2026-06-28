import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { initialPracticeCards, initialKnowledgeAssets } from '../data/mockData';
import { PracticeCard, KnowledgeAsset } from '../types';
import { 
  ArrowLeft, 
  Share2, 
  Download,
  Settings,
  Bell,
  Plus,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Undo2,
  Redo2,
  Minus,
  Sparkles,
  MoreHorizontal,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Type,
  AlignLeft,
  Bold,
  Italic,
  Underline,
  Link as LinkIcon,
  List,
  Trash2,
  MoreVertical,
  Calendar,
  Layers,
  LayoutGrid,
  Sliders,
  GripVertical,
  Box,
  Puzzle,
  DollarSign,
  AlertTriangle,
  Truck,
  HelpCircle,
  Tag,
  ShieldAlert,
  Search,
  X,
  Play,
  Pause,
  Video,
  Table,
  Check,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { KnowledgeTableType } from '../types';

const CATEGORY_MAP: Record<KnowledgeTableType, { label: string; icon: React.ReactNode; color: string; bgColor: string; borderColor: string }> = {
  product_master: { label: '产品主数据', icon: <Box className="w-4 h-4" />, color: 'text-blue-750', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  substrate_knowledge: { label: '底材知识', icon: <Layers className="w-4 h-4" />, color: 'text-amber-750', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  compatibility_rule: { label: '适配规则', icon: <Puzzle className="w-4 h-4" />, color: 'text-purple-750', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
  process_knowledge: { label: '工艺知识', icon: <Sliders className="w-4 h-4" />, color: 'text-emerald-750', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  pricing_rule: { label: '报价规则', icon: <DollarSign className="w-4 h-4" />, color: 'text-sky-750', bgColor: 'bg-sky-50', borderColor: 'border-sky-200' },
  quality_issue: { label: '质量问题', icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-750', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  supply_chain_capability: { label: '供应链能力', icon: <Truck className="w-4 h-4" />, color: 'text-orange-750', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
  faq_pitch: { label: 'FAQ与话术', icon: <HelpCircle className="w-4 h-4" />, color: 'text-pink-750', bgColor: 'bg-pink-50', borderColor: 'border-pink-200' },
  tag_system: { label: '知识标签', icon: <Tag className="w-4 h-4" />, color: 'text-teal-750', bgColor: 'bg-teal-50', borderColor: 'border-teal-200' },
  knowledge_governance: { label: '知识治理', icon: <ShieldAlert className="w-4 h-4" />, color: 'text-indigo-750', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200' }
};

interface Section {
  id: string;
  type: 'header' | 'text' | 'process_data' | 'image' | 'video' | 'metrics_table' | 'operator_notes' | 'knowledge_refs';
  title: string;
  content?: string;
  imageUrl?: string;
  videoUrl?: string;
  videoPlaying?: boolean;
  videoProgress?: number;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderlined?: boolean;
  listItems?: string[];
}

interface Page {
  id: string;
  name: string;
  visible: boolean;
  sections: Section[];
}

type TemplateId = 'standard' | 'elegant' | 'technical' | 'minimalist';

const TEMPLATE_PRESETS: Record<TemplateId, { name: string; description: string; layoutGrid: 'single' | 'double' | 'bento'; pageOrientation: 'portrait' | 'landscape' }> = {
  standard: { name: '标准单栏报告', description: '严谨单栏流式，适合文字与大图纵向详尽阅览', layoutGrid: 'single', pageOrientation: 'portrait' },
  elegant: { name: '学术双栏对比', description: '左右对称分栏，适合核心参数与备注直观并排', layoutGrid: 'double', pageOrientation: 'portrait' },
  technical: { name: '多维智能Bento', description: '拼图磁贴栅格，适合视频、图像与数据多维混排', layoutGrid: 'bento', pageOrientation: 'landscape' },
  minimalist: { name: '精简单页横排', description: '极简宽屏流式，适合大卡片展示和视频流', layoutGrid: 'single', pageOrientation: 'landscape' }
};

const PAGE_DIMENSIONS: Record<'A4' | 'A3' | 'A5' | 'Letter' | '16:9', { width: string; minHeight: string }> = {
  A4: { width: '740px', minHeight: '1020px' },
  A3: { width: '920px', minHeight: '1280px' },
  A5: { width: '520px', minHeight: '740px' },
  Letter: { width: '760px', minHeight: '980px' },
  '16:9': { width: '1000px', minHeight: '562px' }
};

function getInitialPagesForCard(foundCard: PracticeCard | null): Page[] {
  if (!foundCard) return [];
  return [
    {
      id: 'page-1',
      name: 'Page 1',
      visible: true,
      sections: [
        {
          id: 'sec-header',
          type: 'header',
          title: `${foundCard.sku} 打样数据及技术证据报告`,
          content: `此工艺实践证据卡（简称“报告”）由 DualCloud 工业云协同引擎于 ${foundCard.testDate} 自动对账生成，执行单元：DualCloud 前线作战销售实验室 与 质检工程师 ${foundCard.operator}。`
        },
        {
          id: 'sec-process-data',
          type: 'process_data',
          title: '1. 工艺核心参数 (Process Parameters)',
          content: `检测完成！操作员已在生产环境下调试并锁定 SKU ${foundCard.sku} 的黄金释放临界点：`,
          listItems: [
            `打样目标温度：${foundCard.parameters.temp} ℃, 热释放特性最适宜，不易灼化。`,
            `千分表额定压力：${foundCard.parameters.pressure} kg, 确保极高附着强度。`,
            `生产联动转速：${foundCard.parameters.speed} 印张/小时, 保持运行张力恒定。`
          ]
        },
        {
          id: 'sec-text-materials',
          type: 'text',
          title: '2. 打样基材与材料配比 (Substrate & Materials)',
          content: `测试基底选定：${foundCard.substrate}。打样压烫设备采用：${foundCard.machineModel}。墨层透光分析、打底层树脂指定型号：${foundCard.inkType || '无指定'}。实验表面贴附及粘合特性完美复合标准。`
        },
        {
          id: 'sec-metrics-table',
          type: 'metrics_table',
          title: '3. 物性拉拔与剥离测试 (Physical Metrics)'
        },
        {
          id: 'sec-operator-notes',
          type: 'operator_notes',
          title: '4. 质检工程师综合评语 (Operator Notes)',
          content: foundCard.results.defectNotes || '报告：打样全程未观察到崩边、漏热或烫印不实等微观损伤。边缘轮廓饱满清晰，质感细腻有金属光泽，判定为优质合格样张。'
        },
        {
          id: 'sec-knowledge-refs',
          type: 'knowledge_refs',
          title: '5. 关联知识标答资产 (References)'
        }
      ]
    },
    {
      id: 'page-2',
      name: 'Page 2',
      visible: true,
      sections: [
        {
          id: 'sec-page2-header',
          type: 'header',
          title: '打样微观特征与视频比对分析',
          content: '使用微观红外对焦及实时视频对流排版技术，以下是当前样板在动态运行和超显微状态下的反馈。'
        },
        {
          id: 'sec-video',
          type: 'video',
          title: '实时视频检测流 (Production live feed)',
          content: '200倍高倍相机监控超低空滚压烫金气泡率、平整度以及动态拉丝模拟（可播放比对）。',
          videoUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop&q=60',
          videoPlaying: false,
          videoProgress: 45
        },
        {
          id: 'sec-image',
          type: 'image',
          title: '微观粘附分析图像 (Microscopic Adhesion Map)',
          content: '在 40x 微距镜头下对聚氨酯层十字纹理和微孔渗透深度进行的拉网三维检测，色块亮区粘附力达到最佳极化分布。',
          imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60'
        }
      ]
    }
  ];
}

export default function EvidenceApp() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Find card synchronously during state initialization to avoid loading screen rendering / white flashes
  const initialCard = id ? (initialPracticeCards.find(c => c.evidenceNo === id || c.id === id) || null) : null;
  const [card, setCard] = useState<PracticeCard | null>(initialCard);

  // Core interactive states
  const [pages, setPages] = useState<Page[]>(() => getInitialPagesForCard(initialCard));
  const [activePageId, setActivePageId] = useState<string>('page-1');
  const [activeSectionId, setActiveSectionId] = useState<string>(initialCard ? 'sec-process-data' : '');
  
  // Theme Styling parameters
  const [bgColor, setBgColor] = useState<string>('#ffffff');
  const [textColor, setTextColor] = useState<string>('#0F172A');
  const [fontFamily, setFontFamily] = useState<string>('Inter');
  const [fontSize, setFontSize] = useState<string>('12pt');
  const [activeTemplate, setActiveTemplate] = useState<TemplateId>('standard');
  const [zoom, setZoom] = useState<number>(100);

  // Modals state
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);
  const [isAddingRef, setIsAddingRef] = useState(false);
  const [searchRefQuery, setSearchRefQuery] = useState('');
  const [referencedAssets, setReferencedAssets] = useState<KnowledgeAsset[]>(() => {
    return initialKnowledgeAssets.slice(0, 2);
  });
  const [isSizeDropdownOpen, setIsSizeDropdownOpen] = useState(false);
  const [isCustomSize, setIsCustomSize] = useState<boolean>(false);
  const [customWidth, setCustomWidth] = useState<number>(800);
  const [customHeight, setCustomHeight] = useState<number>(1100);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Page rename state
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingPageName, setEditingPageName] = useState<string>('');

  // Floating notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // Paper & Layout parameters
  const [pageSize, setPageSize] = useState<'A4' | 'A3' | 'A5' | 'Letter' | '16:9'>('A4');
  const [pageOrientation, setPageOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [layoutGrid, setLayoutGrid] = useState<'single' | 'double' | 'bento'>('single');
  
  // Custom height for resizable blocks
  const [sectionHeights, setSectionHeights] = useState<Record<string, number>>({});
  
  // Drag and drop sorting state
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dragReadyId, setDragReadyId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index?: number) => {
    e.preventDefault();
    if (index !== undefined && dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIdx(null);
  };

  const handleDropSection = (targetIdx: number) => {
    setDragOverIdx(null);
    if (draggedIdx === null || draggedIdx === targetIdx) return;
    const newSections = [...activePage.sections];
    const draggedSection = newSections[draggedIdx];
    newSections.splice(draggedIdx, 1);
    newSections.splice(targetIdx, 0, draggedSection);
    setPages(prev => prev.map(p => p.id === activePageId ? { ...p, sections: newSections } : p));
    setDraggedIdx(null);
    triggerToast("通过拖拽成功调整模块排版顺序");
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleResizeMouseDown = (e: React.MouseEvent, sectionId: string, defaultHeight: number) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startHeight = sectionHeights[sectionId] || defaultHeight;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const newHeight = Math.max(100, Math.min(600, startHeight + deltaY));
      setSectionHeights(prev => ({
        ...prev,
        [sectionId]: newHeight
      }));
    };
    
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      triggerToast("组件高度已成功保存");
    };
    
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const updateCardParameter = (key: 'temp' | 'pressure' | 'speed' | 'dwellTime', val: number) => {
    setCard(prev => {
      if (!prev) return null;
      const nextParams = { ...prev.parameters, [key]: val };
      return { ...prev, parameters: nextParams };
    });
    
    // Propagate to listItems
    setPages(prevPages => prevPages.map(page => ({
      ...page,
      sections: page.sections.map(sec => {
        if (sec.id === 'sec-process-data' || sec.type === 'process_data') {
          const items = [...(sec.listItems || [])];
          if (key === 'temp' && items[0]) {
            items[0] = `打样目标温度：${val} ℃, 热释放特性最适宜，不易灼化。`;
          } else if (key === 'pressure' && items[1]) {
            items[1] = `千分表额定压力：${val} kg, 确保极高附着强度。`;
          } else if (key === 'speed' && items[2]) {
            items[2] = `生产联动转速：${val} 印张/小时, 保持运行张力恒定。`;
          }
          return { ...sec, listItems: items };
        }
        return sec;
      })
    })));
  };

  // Load card data and initialize pages
  useEffect(() => {
    const foundCard = initialPracticeCards.find(c => c.evidenceNo === id || c.id === id);
    if (foundCard) {
      setCard(foundCard);
      setPages(getInitialPagesForCard(foundCard));
      setActiveSectionId('sec-process-data');
      
      const mockedRefs = initialKnowledgeAssets.slice(0, 2);
      setReferencedAssets(mockedRefs);
    }
  }, [id]);

  // Video progress simulator timer
  useEffect(() => {
    const timer = setInterval(() => {
      setPages(prevPages => 
        prevPages.map(p => ({
          ...p,
          sections: p.sections.map(s => {
            if (s.type === 'video' && s.videoPlaying) {
              const currentProgress = s.videoProgress ?? 0;
              return {
                ...s,
                videoProgress: currentProgress >= 100 ? 0 : currentProgress + 1.5
              };
            }
            return s;
          })
        }))
      );
    }, 200);
    return () => clearInterval(timer);
  }, []);

  if (!card || pages.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <h2 className="text-xl font-bold text-slate-800">正在加载打样画板工程...</h2>
        <Link to="/" className="text-primary hover:underline">返回控制台</Link>
      </div>
    );
  }

  const activePage = pages.find(p => p.id === activePageId) || pages[0];

  // Apply layout template properties
  const applyTemplate = (tplId: TemplateId) => {
    setActiveTemplate(tplId);
    const config = TEMPLATE_PRESETS[tplId];
    setLayoutGrid(config.layoutGrid);
    setPageOrientation(config.pageOrientation);
    setIsTemplateModalOpen(false);
    triggerToast(`已成功更换整体页面排版布局为 [${config.name}]`);
  };

  // Reorder sections
  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newSections = [...activePage.sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSections.length) return;

    // Swap
    const temp = newSections[index];
    newSections[index] = newSections[targetIndex];
    newSections[targetIndex] = temp;

    setPages(prev => prev.map(p => p.id === activePageId ? { ...p, sections: newSections } : p));
    triggerToast("模块排版顺序已调整");
  };

  // Add section
  const handleAddSection = (type: Section['type']) => {
    const id = `sec-${type}-${Date.now()}`;
    let newSec: Section;

    switch (type) {
      case 'text':
        newSec = {
          id,
          type,
          title: '点击此处编辑新段落标题',
          content: '这是一段全新添加的工艺描述，双击此画布内任何字符或在右侧调整数据均能进行即时修改并固化。'
        };
        break;
      case 'video':
        newSec = {
          id,
          type,
          title: '动态工业相机监测视频 (Stamping Video Feed)',
          content: '该段视频流用于在实际打样过程中回溯金属膜层的脱皮拉伸阻力曲线。',
          videoUrl: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=800&auto=format&fit=crop&q=60',
          videoPlaying: false,
          videoProgress: 0
        };
        break;
      case 'image':
        newSec = {
          id,
          type,
          title: '新打样细节切片图 (Material Micrometer Image)',
          content: '高分辨率切片照片，显示贴合面纹理深度与高分子热压黏连度。',
          imageUrl: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800&auto=format&fit=crop&q=60'
        };
        break;
      case 'process_data':
        newSec = {
          id,
          type,
          title: '新工艺性能约束参数',
          content: '以下是由现场微型温控和张力传感器反馈的调试结果数据：',
          listItems: ['热压临界值：130 ℃', '静态支撑力：60 kg', '回转平稳系数：99.2%']
        };
        break;
      case 'metrics_table':
        newSec = {
          id,
          type,
          title: '物性与可靠性量化数据'
        };
        break;
      case 'operator_notes':
        newSec = {
          id,
          type,
          title: '新增备注批注',
          content: '质检结论：压花深度符合客户送样标准，可以进入外贸批量加工调试。'
        };
        break;
      default:
        newSec = {
          id,
          type,
          title: '新增空白段落',
          content: '这里是关于此打样的额外记录内容。'
        };
    }

    setPages(prev => prev.map(p => p.id === activePageId ? { ...p, sections: [...p.sections, newSec] } : p));
    setActiveSectionId(id);
    setIsAddSectionModalOpen(false);
    triggerToast("已成功插入新 section 模板组件");
  };

  // Delete section
  const handleDeleteSection = (sectionId: string) => {
    setPages(prev => prev.map(p => p.id === activePageId ? {
      ...p,
      sections: p.sections.filter(s => s.id !== sectionId)
    } : p));
    if (activeSectionId === sectionId) {
      setActiveSectionId('');
    }
    triggerToast("排版组件已从当前页面移除");
  };

  // Inline styling toggle for selected section
  const toggleSectionStyle = (style: 'bold' | 'italic' | 'underline') => {
    if (!activeSectionId) return;
    setPages(prev => prev.map(p => ({
      ...p,
      sections: p.sections.map(s => {
        if (s.id !== activeSectionId) return s;
        if (style === 'bold') return { ...s, isBold: !s.isBold };
        if (style === 'italic') return { ...s, isItalic: !s.isItalic };
        if (style === 'underline') return { ...s, isUnderlined: !s.isUnderlined };
        return s;
      })
    })));
  };

  // Update text inside section
  const updateSectionTitle = (secId: string, val: string) => {
    setPages(prev => prev.map(p => ({
      ...p,
      sections: p.sections.map(s => s.id === secId ? { ...s, title: val } : s)
    })));
  };

  const updateSectionContent = (secId: string, val: string) => {
    setPages(prev => prev.map(p => ({
      ...p,
      sections: p.sections.map(s => s.id === secId ? { ...s, content: val } : s)
    })));
  };

  const updateSectionListItems = (secId: string, newItems: string[]) => {
    setPages(prev => prev.map(p => ({
      ...p,
      sections: p.sections.map(s => s.id === secId ? { ...s, listItems: newItems } : s)
    })));
  };

  // Page Operations
  const handleAddPage = () => {
    const newPageId = `page-${Date.now()}`;
    const newPage: Page = {
      id: newPageId,
      name: `Page ${pages.length + 1}`,
      visible: true,
      sections: [
        {
          id: `sec-header-${Date.now()}`,
          type: 'header',
          title: `全新页面 (页码 ${pages.length + 1})`,
          content: '双击左侧的导航器可以重命名页面，利用下方的添加组件和主题配置，快速丰富您的对账报告画板。'
        },
        {
          id: `sec-text-${Date.now()}`,
          type: 'text',
          title: '空组件段落',
          content: '请在侧边栏中选择插入图片、操作视频或关联您在知识云库中沉淀的标答文献来完成这页打样佐证。'
        }
      ]
    };
    setPages(prev => [...prev, newPage]);
    setActivePageId(newPageId);
    setActiveSectionId(`sec-header-${Date.now()}`);
    triggerToast("已成功新建一个空白画板页");
  };

  const handleDeletePage = (pageId: string) => {
    if (pages.length <= 1) {
      triggerToast("无法删除最后一页");
      return;
    }
    const filtered = pages.filter(p => p.id !== pageId);
    setPages(filtered);
    if (activePageId === pageId) {
      setActivePageId(filtered[0].id);
    }
    triggerToast("页面已从导航器中删除");
  };

  const togglePageVisibility = (pageId: string) => {
    setPages(prev => prev.map(p => p.id === pageId ? { ...p, visible: !p.visible } : p));
    const p = pages.find(p => p.id === pageId);
    if (p) {
      triggerToast(`页面已设置为 [${p.visible ? '不可见/隐藏' : '可见/导出'}]`);
    }
  };

  const startRenamePage = (page: Page) => {
    setEditingPageId(page.id);
    setEditingPageName(page.name);
  };

  const savePageRename = () => {
    if (!editingPageName.trim()) return;
    setPages(prev => prev.map(p => p.id === editingPageId ? { ...p, name: editingPageName } : p));
    setEditingPageId(null);
    triggerToast("页面名称已重命名");
  };

  const triggerFileSave = () => {
    const title = activePage ? activePage.name : "打样排版对账报告";
    
    // Process sections to generate structured high-fidelity HTML content matching the UI
    const sectionsHtml = activePage ? activePage.sections.map((section) => {
      if (section.type === 'header') {
        return `
          <div class="mb-10 pb-6 border-b-2 border-slate-100">
            <h1 class="text-3xl font-black text-slate-900 tracking-tight mb-3">${section.title}</h1>
            <p class="text-sm text-slate-500 leading-relaxed max-w-2xl">${section.content || ''}</p>
          </div>
        `;
      }
      if (section.type === 'text') {
        return `
          <div class="mb-8">
            <h3 class="text-lg font-bold text-slate-800 mb-3 border-l-4 border-indigo-500 pl-3">${section.title}</h3>
            <p class="text-sm text-slate-650 leading-relaxed whitespace-pre-line">${section.content || ''}</p>
          </div>
        `;
      }
      if (section.type === 'process_data') {
        const items = section.listItems?.map(item => {
          const parts = item.split('：');
          if (parts.length > 1) {
            return `
              <li class="flex items-start text-sm text-slate-700">
                <span class="bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-0.5 rounded text-[11px] mr-2.5 border border-indigo-100 shrink-0 font-mono">${parts[0]}</span>
                <span class="leading-relaxed">${parts[1]}</span>
              </li>
            `;
          }
          const enParts = item.split(':');
          if (enParts.length > 1) {
            return `
              <li class="flex items-start text-sm text-slate-700">
                <span class="bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-0.5 rounded text-[11px] mr-2.5 border border-indigo-100 shrink-0 font-mono">${enParts[0]}</span>
                <span class="leading-relaxed">${enParts[1]}</span>
              </li>
            `;
          }
          return `<li class="text-sm text-slate-700 list-disc list-inside leading-relaxed">${item}</li>`;
        }).join('') || '';

        return `
          <div class="mb-8 bg-slate-50/70 p-6 rounded-xl border border-slate-200/60">
            <h3 class="text-base font-bold text-slate-900 mb-2">${section.title}</h3>
            <p class="text-xs text-slate-400 mb-4 font-medium">${section.content || ''}</p>
            <ul class="space-y-3">
              ${items}
            </ul>
          </div>
        `;
      }
      if (section.type === 'video' || section.type === 'image') {
        const mediaUrl = section.type === 'video' ? section.videoUrl : section.imageUrl;
        const typeLabel = section.type === 'video' ? 'LIVE INSPECTION SCREEN' : '40x INFRARED MICRO-FOCUS';
        const typeBg = section.type === 'video' ? 'bg-rose-100 text-rose-700' : 'bg-slate-800 text-white';
        return `
          <div class="mb-8">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-base font-bold text-slate-900">${section.title}</h3>
              <span class="text-[10px] font-mono uppercase ${typeBg} px-2.5 py-0.5 rounded-full font-extrabold tracking-wider">${typeLabel}</span>
            </div>
            <div class="rounded-xl overflow-hidden border border-slate-200 bg-slate-950 flex justify-center items-center shadow-sm" style="height: 320px;">
              <img src="${mediaUrl || ''}" alt="${section.title}" class="w-full h-full object-cover" referrerpolicy="no-referrer" />
            </div>
            ${section.content ? `<p class="text-xs text-slate-500 italic mt-2.5 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">${section.content}</p>` : ''}
          </div>
        `;
      }
      if (section.type === 'metrics_table') {
        return `
          <div class="mb-8">
            <h3 class="text-base font-bold text-slate-900 mb-3">${section.title}</h3>
            <div class="overflow-hidden border border-slate-200 rounded-xl shadow-xs">
              <table class="w-full text-left text-sm border-collapse bg-white">
                <thead>
                  <tr class="border-b border-slate-200 bg-slate-50">
                    <th class="py-3 px-4 font-bold text-slate-500 text-xs uppercase tracking-wider">性能维度 (Metric Category)</th>
                    <th class="py-3 px-4 font-bold text-slate-500 text-xs uppercase tracking-wider text-center">测试得分 (Rating)</th>
                    <th class="py-3 px-4 font-bold text-slate-500 text-xs uppercase tracking-wider text-right">协同状态 (Result)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr>
                    <td class="py-3.5 px-4 text-slate-700 font-medium">图案微观平整清晰度 (Clearness)</td>
                    <td class="py-3.5 px-4 text-center font-bold text-slate-800 font-mono">${card ? card.results.clearness : 5}/5</td>
                    <td class="py-3.5 px-4 text-right"><span class="text-[11px] font-bold bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded-full border border-emerald-150">PASS 通过</span></td>
                  </tr>
                  <tr>
                    <td class="py-3.5 px-4 text-slate-700 font-medium">3M胶带粘附力测试 (Adhesion Test)</td>
                    <td class="py-3.5 px-4 text-center font-bold text-slate-800 font-mono">${card ? card.results.adhesion : 5}/5</td>
                    <td class="py-3.5 px-4 text-right"><span class="text-[11px] font-bold bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded-full border border-emerald-150">PASS 通过</span></td>
                  </tr>
                  <tr>
                    <td class="py-3.5 px-4 text-slate-700 font-medium">表面金属光泽饱满度 (Gloss level)</td>
                    <td class="py-3.5 px-4 text-center font-bold text-slate-800 font-mono">${card ? card.results.gloss : 5}/5</td>
                    <td class="py-3.5 px-4 text-right"><span class="text-[11px] font-bold bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded-full border border-emerald-150">PASS 通过</span></td>
                  </tr>
                  <tr>
                    <td class="py-3.5 px-4 text-slate-700 font-medium">耐摩擦抗刮擦等级 (Abrasion level)</td>
                    <td class="py-3.5 px-4 text-center font-bold text-slate-800 font-mono">${card ? card.results.abrasion : 5}/5</td>
                    <td class="py-3.5 px-4 text-right"><span class="text-[11px] font-bold bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded-full border border-emerald-150">PASS 通过</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        `;
      }
      if (section.type === 'operator_notes') {
        return `
          <div class="mb-8 border-l-4 border-indigo-600 bg-slate-50/80 p-5 rounded-r-xl">
            <h4 class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">${section.title}</h4>
            <p class="text-sm italic text-slate-700 leading-relaxed font-semibold">"${section.content || ''}"</p>
          </div>
        `;
      }
      if (section.type === 'knowledge_refs') {
        const refItems = referencedAssets.map(asset => `
          <div class="border border-slate-200/80 rounded-xl p-4 bg-white shadow-3xs">
            <div class="text-[9px] font-bold uppercase tracking-wider text-indigo-500 mb-1">${asset.category.replace('_', ' ')}</div>
            <div class="text-xs font-extrabold text-slate-800 leading-snug mb-1">${asset.title}</div>
            <div class="text-[9px] text-slate-400 font-mono">ID: ${asset.id} • 更新时间: ${asset.lastUpdated}</div>
          </div>
        `).join('') || `
          <div class="col-span-2 text-center py-8 text-xs text-slate-400 border border-dashed border-slate-250 rounded-xl bg-slate-50/50">
            暂无关联文献。
          </div>
        `;

        return `
          <div class="mb-8">
            <h3 class="text-base font-bold text-slate-900 mb-3">${section.title}</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${refItems}
            </div>
          </div>
        `;
      }
      return '';
    }).join('') : '';

    // Create a spectacular, professional HTML report package
    const htmlReport = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>${title} - K-600 烫金打样与技术证据报告</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }
    @media print {
      .no-print { display: none !important; }
      body { background: white !important; color: black !important; padding: 0 !important; margin: 0 !important; }
      .print-shadow-none { box-shadow: none !important; border: none !important; }
    }
  </style>
</head>
<body class="bg-slate-50 text-slate-900 min-h-screen">
  
  <!-- Interactive Top Bar Inside Saved Document -->
  <div class="no-print bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50">
    <div class="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-sm">OS</div>
        <div>
          <h1 class="text-sm font-black tracking-tight">K-600 工艺证据卡离线高保真浏览器</h1>
          <p class="text-[10px] text-slate-400">已就绪，可在任何标准浏览器中离线阅览</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="window.print()" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5">
          🖨️ 打印 / 另存为 PDF
        </button>
      </div>
    </div>
  </div>

  <div class="max-w-3xl mx-auto my-10 px-4">
    <!-- Main Styled Page Container -->
    <div class="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-12 print-shadow-none relative">
      
      <!-- Brand Watermark Logo -->
      <div class="flex justify-between items-center mb-10 select-none">
        <div class="flex items-center gap-2 font-bold text-slate-900">
          <div class="w-5 h-5 bg-slate-900 rounded-md flex items-center justify-center text-white text-[10px]">L</div>
          <span class="font-mono text-[10px] tracking-widest uppercase text-slate-400 font-black">DualCloud OS</span>
        </div>
        <div class="text-right">
          <span class="text-[10px] text-slate-400 font-mono">报告编号: ${card ? card.evidenceNo : 'EV-K600'}</span>
        </div>
      </div>

      <!-- Core Content -->
      <div class="space-y-6">
        ${sectionsHtml}
      </div>

      <!-- Footer Info -->
      <div class="mt-16 pt-6 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 select-none">
        <div>
          <span class="font-bold text-slate-700">双云工艺证据卡排版系统™</span>
          <span class="mx-1.5">|</span>
          <span>高保真标准对账模块</span>
        </div>
        <div class="font-mono">
          导出于: 2026-06-28
        </div>
      </div>

    </div>
  </div>

</body>
</html>`;

    const blob = new Blob([htmlReport], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title}_打样对账画册_K-600.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerToast("✓ 高保真对账报告已成功保存至您的本地设备！");
  };

  // Simulating download / export
  const handleExport = () => {
    setIsExportModalOpen(true);
    setExportProgress(0);
    const interval = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          // Auto-trigger native file save interaction
          setTimeout(() => {
            triggerFileSave();
          }, 300);
          return 100;
        }
        return prev + Math.floor(Math.random() * 15) + 10;
      });
    }, 150);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-100 font-sans text-slate-800 overflow-hidden">
      
      {/* Dynamic Toast Alerts */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white backdrop-blur-md px-4 py-2.5 rounded-lg shadow-xl text-xs font-bold z-50 flex items-center gap-2 border border-slate-700/50"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Toolbar (Now moved to absolute top replacing deleted brand header, matching "修改返回路径" & "向上" annotations) */}
      <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
        
        {/* Interactive Breadcrumb Return Path (修改为返回路径) */}
        <div className="flex items-center gap-2.5 text-[13px] font-medium text-slate-500">
          <button 
            onClick={() => navigate('/?tab=practice')}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 hover:bg-slate-150 text-slate-700 font-semibold border border-slate-200 transition-all shadow-xs group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            返回实践云
          </button>
          
          <span className="text-slate-300">/</span>
          <button onClick={() => navigate('/?tab=practice')} className="hover:text-primary transition-colors hover:underline">Dashboard</button>
          <span className="text-slate-300">/</span>
          <button onClick={() => navigate('/?tab=practice')} className="hover:text-primary transition-colors hover:underline">Apps</button>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900 font-bold flex items-center gap-1.5">
            {card.sku} Report <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          </span>
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <span className="text-slate-400 flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-slate-50 flex items-center justify-center text-[8px] border border-slate-200 text-slate-400">
              ✓
            </div>
            实时储存
          </span>
          
          <div className="w-px h-4 bg-slate-200 mx-1" />
          
          {/* 画布尺寸显示以及自定义 (Canvas Sizing Control) */}
          <div className="relative">
            <button
              onClick={() => setIsSizeDropdownOpen(!isSizeDropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:bg-slate-100/70 text-slate-700 text-xs font-semibold rounded-lg transition-all shadow-2xs group cursor-pointer"
              title="画布排版大小与自定义尺寸"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-600 transition-colors" />
              <span>
                {isCustomSize 
                  ? `自定义尺寸: ${customWidth} × ${customHeight}px` 
                  : `${pageSize} 纸张 (${pageOrientation === 'portrait' ? '纵向' : '横向'})`
                }
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </button>
            
            {isSizeDropdownOpen && (
              <div className="absolute top-10 left-0 bg-white border border-slate-200 rounded-xl shadow-lg p-4 w-72 z-40 text-slate-700 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                  <span className="font-extrabold text-xs text-slate-900">画布尺寸与排版</span>
                  <button 
                    onClick={() => setIsSizeDropdownOpen(false)} 
                    className="text-slate-400 hover:text-slate-600 font-extrabold"
                  >
                    ✕
                  </button>
                </div>
                
                {/* Mode toggle */}
                <div className="grid grid-cols-2 gap-2 mb-3.5">
                  <button
                    onClick={() => {
                      setIsCustomSize(false);
                      triggerToast("使用标准纸张规格");
                    }}
                    className={`py-1.5 px-2 rounded-lg text-center font-bold text-[11px] border transition-all ${
                      !isCustomSize 
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    标准规格
                  </button>
                  <button
                    onClick={() => {
                      setIsCustomSize(true);
                      triggerToast("已开启自定义画布尺寸");
                    }}
                    className={`py-1.5 px-2 rounded-lg text-center font-bold text-[11px] border transition-all ${
                      isCustomSize 
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    自定义尺寸
                  </button>
                </div>

                {!isCustomSize ? (
                  <div className="space-y-3">
                    {/* Paper Presets */}
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-1">纸张规格 (Page Size)</span>
                      <div className="grid grid-cols-3 gap-1">
                        {(['A4', 'A3', 'A5', 'Letter', '16:9'] as const).map(size => (
                          <button
                            key={size}
                            onClick={() => {
                              setPageSize(size);
                              triggerToast(`页面尺寸调整为 ${size}`);
                            }}
                            className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold text-center transition-all ${
                              pageSize === size && !isCustomSize
                                ? 'border-indigo-500 bg-indigo-50/30 text-indigo-600'
                                : 'border-slate-150 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Paper Orientation */}
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-1">纸张方向 (Orientation)</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(['portrait', 'landscape'] as const).map(dir => (
                          <button
                            key={dir}
                            onClick={() => {
                              setPageOrientation(dir);
                              triggerToast(`方向调整为 ${dir === 'portrait' ? '纵向' : '横向'}`);
                            }}
                            className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold text-center transition-all ${
                              pageOrientation === dir
                                ? 'border-indigo-500 bg-indigo-50/30 text-indigo-600'
                                : 'border-slate-150 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {dir === 'portrait' ? '纵向 (Portrait)' : '横向 (Landscape)'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Custom Width & Height Inputs */}
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-1.5">自定义画布分辨率 (500 - 1600px)</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] text-slate-400 font-bold block mb-0.5">宽度 (Width)</label>
                          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                            <input
                              type="number"
                              min="500"
                              max="1600"
                              value={customWidth}
                              onChange={(e) => {
                                const val = Math.max(500, Math.min(1600, Number(e.target.value)));
                                setCustomWidth(val);
                              }}
                              className="w-full bg-transparent text-xs font-mono text-slate-700 outline-none text-right font-bold pr-1"
                            />
                            <span className="text-[10px] text-slate-400 font-bold">px</span>
                          </div>
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-400 font-bold block mb-0.5">高度 (Height)</label>
                          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                            <input
                              type="number"
                              min="500"
                              max="1600"
                              value={customHeight}
                              onChange={(e) => {
                                const val = Math.max(500, Math.min(1600, Number(e.target.value)));
                                setCustomHeight(val);
                              }}
                              className="w-full bg-transparent text-xs font-mono text-slate-700 outline-none text-right font-bold pr-1"
                            />
                            <span className="text-[10px] text-slate-400 font-bold">px</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick sliders for drag customization */}
                    <div className="space-y-2">
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                          <span>调节宽度</span>
                          <span className="font-mono">{customWidth}px</span>
                        </div>
                        <input
                          type="range"
                          min="500"
                          max="1600"
                          step="10"
                          value={customWidth}
                          onChange={(e) => setCustomWidth(Number(e.target.value))}
                          className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                          <span>调节高度</span>
                          <span className="font-mono">{customHeight}px</span>
                        </div>
                        <input
                          type="range"
                          min="500"
                          max="1600"
                          step="10"
                          value={customHeight}
                          onChange={(e) => setCustomHeight(Number(e.target.value))}
                          className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Grid layout is also here since it's about layout structure */}
                <div className="mt-3.5 pt-3 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 block mb-1">多级排版列布局 (Layout Grid)</span>
                  <div className="grid grid-cols-3 gap-1">
                    {(['single', 'double', 'bento'] as const).map(grid => (
                      <button
                        key={grid}
                        onClick={() => {
                          setLayoutGrid(grid);
                          triggerToast(`页面布局切换为 [${grid === 'single' ? '单栏流' : grid === 'double' ? '双栏栅格' : '智能Bento'}]`);
                        }}
                        className={`px-1.5 py-1.5 rounded-lg border text-[10px] font-bold text-center transition-all ${
                          layoutGrid === grid
                            ? 'border-indigo-500 bg-indigo-50/30 text-indigo-600'
                            : 'border-slate-150 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {grid === 'single' ? '单栏流' : grid === 'double' ? '双栏格' : '智能Bento'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Zoom View Controller */}
        <div className="flex items-center gap-3 text-slate-600">
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5 shadow-2xs">
            <button 
              onClick={() => triggerToast("已撤销上一步操作")}
              className="p-1 hover:bg-white hover:shadow-2xs rounded text-slate-400 hover:text-slate-700 transition-all"
              title="Undo"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => triggerToast("已恢复上一步操作")}
              className="p-1 hover:bg-white hover:shadow-2xs rounded text-slate-400 hover:text-slate-700 transition-all"
              title="Redo"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="w-px h-4 bg-slate-200" />
          <div className="flex items-center gap-2 text-[12px] font-bold bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg shadow-2xs">
            <button onClick={() => setZoom(Math.max(50, zoom - 10))} className="p-0.5 hover:bg-slate-200 rounded"><Minus className="w-3 h-3" /></button>
            <span className="w-10 text-center text-slate-700 font-mono">{zoom}%</span>
            <button onClick={() => setZoom(Math.min(150, zoom + 10))} className="p-0.5 hover:bg-slate-200 rounded"><Plus className="w-3 h-3" /></button>
          </div>
        </div>

        {/* Download & AI Assists Action bar */}
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExport}
            className="px-3 py-1.5 rounded-lg hover:bg-slate-50 border border-slate-200 transition-colors flex items-center gap-1.5 text-[12px] font-bold text-slate-700 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> 导出PDF画册
          </button>
          <button 
            onClick={() => triggerToast("已为您复制该打样画板在线查看链接！")}
            className="px-3 py-1.5 rounded-lg hover:bg-slate-50 border border-slate-200 transition-colors flex items-center gap-1.5 text-[12px] font-bold text-slate-700"
          >
            <Share2 className="w-3.5 h-3.5" /> 复制分享链接
          </button>
        </div>
      </div>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar (Navigator, Sections, Styling) */}
        <aside className="w-[280px] bg-[#FAFAFA] border-r border-slate-200 overflow-y-auto flex flex-col p-4 gap-6 shrink-0 z-10 custom-scrollbar">
          
          {/* 1. Page Template selector card (实现证据卡模板功能) */}
          <div className="space-y-3 bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-slate-400 block">工艺书模板规格 (Template)</span>
            
            <div className="flex justify-between items-center bg-slate-50 rounded-lg p-2 border border-slate-150">
              <div className="flex items-center gap-2">
                <div className="w-8 h-10 bg-white border border-slate-200 rounded text-[6px] text-slate-300 p-1 font-mono flex flex-col justify-between shrink-0 shadow-3xs">
                  <div className="h-[2px] bg-slate-350 w-full rounded-xs"></div>
                  <div className="h-[2px] bg-slate-200 w-3/4 rounded-xs"></div>
                  <div className="h-[2px] bg-slate-200 w-full rounded-xs"></div>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">排版套系</span>
                  <span className="text-[12px] font-extrabold text-slate-800 truncate">{TEMPLATE_PRESETS[activeTemplate].name}</span>
                </div>
              </div>
              <button 
                onClick={() => setIsTemplateModalOpen(true)}
                className="px-2 py-1 text-[11px] font-extrabold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all flex items-center gap-1 border border-indigo-100 shrink-0"
              >
                更换
              </button>
            </div>

            {/* Dynamic Layout Sizing Controllers */}
            <div className="space-y-2 pt-2 border-t border-slate-100 text-[11px]">
              {/* Paper Size selector */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">页面大小</span>
                <div className="flex items-center gap-1 bg-slate-50 p-0.5 rounded-lg border border-slate-200">
                  {(['A4', 'A3', 'A5', 'Letter', '16:9'] as const).map(size => (
                    <button
                      key={size}
                      onClick={() => {
                        setPageSize(size);
                        triggerToast(`页面尺寸切换为 ${size}`);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold transition-all ${
                        pageSize === size ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Paper Orientation Selector */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">页面方向</span>
                <div className="flex items-center gap-1 bg-slate-50 p-0.5 rounded-lg border border-slate-200">
                  {(['portrait', 'landscape'] as const).map(dir => (
                    <button
                      key={dir}
                      onClick={() => {
                        setPageOrientation(dir);
                        triggerToast(`方向调整为 ${dir === 'portrait' ? '纵向' : '横向'}`);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold transition-all ${
                        pageOrientation === dir ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      {dir === 'portrait' ? '纵向' : '横向'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Page Layout Column selector */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">排版布局</span>
                <div className="flex items-center gap-1 bg-slate-50 p-0.5 rounded-lg border border-slate-200">
                  {(['single', 'double', 'bento'] as const).map(grid => (
                    <button
                      key={grid}
                      onClick={() => {
                        setLayoutGrid(grid);
                        triggerToast(`页面布局切换为 [${grid === 'single' ? '单栏流' : grid === 'double' ? '双栏栅格' : '智能Bento'}]`);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold transition-all ${
                        layoutGrid === grid ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      {grid === 'single' ? '单栏' : grid === 'double' ? '双栏' : 'Bento'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Active Page Content Sections Reordering (当前选中以及模块顺序可挪动) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[13px] font-bold text-slate-700">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-3.5 h-3.5 text-indigo-500" />
                <span>画布组件重排</span>
              </div>
              <button 
                onClick={() => setIsAddSectionModalOpen(true)}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded"
              >
                <Plus className="w-3 h-3" />
                组件
              </button>
            </div>

            <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1 custom-scrollbar">
              {activePage.sections.map((section, idx) => {
                const isActive = activeSectionId === section.id;
                const isDragged = draggedIdx === idx;
                return (
                  <div 
                    key={section.id}
                    onClick={() => setActiveSectionId(section.id)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDropSection(idx)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center justify-between border rounded-lg px-2.5 py-2 text-[11px] font-medium cursor-grab active:cursor-grabbing transition-all ${
                      isDragged ? 'opacity-40 border-dashed border-indigo-300 bg-indigo-50/10' :
                      isActive 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-350 hover:shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <GripVertical className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white/80' : 'text-slate-400'}`} />
                      <span className="truncate flex-1 font-bold">{section.title}</span>
                    </div>
                    
                    {/* Reordering and Delete Controllers */}
                    <div className="flex items-center gap-0.5 shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
                      <button 
                        disabled={idx === 0}
                        onClick={() => moveSection(idx, 'up')}
                        className={`p-1 rounded ${isActive ? 'hover:bg-indigo-700 text-white/80' : 'hover:bg-slate-100 text-slate-400'} disabled:opacity-20`}
                        title="上移模块"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button 
                        disabled={idx === activePage.sections.length - 1}
                        onClick={() => moveSection(idx, 'down')}
                        className={`p-1 rounded ${isActive ? 'hover:bg-indigo-700 text-white/80' : 'hover:bg-slate-100 text-slate-400'} disabled:opacity-20`}
                        title="下移模块"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={() => handleDeleteSection(section.id)}
                        className={`p-1 rounded ${isActive ? 'hover:bg-indigo-700 text-white/80' : 'hover:bg-rose-50 hover:text-rose-500 text-slate-400'}`}
                        title="删除该模块"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {activePage.sections.length === 0 && (
                <div className="text-center py-4 text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-lg">
                  当前页无排版组件
                </div>
              )}
            </div>
          </div>

          {/* 3. Page Navigator panel (实现页面导航功能) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[13px] font-bold text-slate-700">
              <div className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-sky-500" />
                <span>页面导航 (Navigator)</span>
              </div>
              <button 
                onClick={handleAddPage}
                className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 rounded text-[11px] text-slate-700 font-bold flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" /> 页
              </button>
            </div>

            <div className="space-y-1.5">
              {pages.map((p) => {
                const isActive = activePageId === p.id;
                const isEditing = editingPageId === p.id;
                return (
                  <div 
                    key={p.id}
                    onClick={() => {
                      if (!isEditing) setActivePageId(p.id);
                    }}
                    className={`flex items-center justify-between rounded-lg p-2 transition-all ${
                      isActive 
                        ? 'bg-slate-800 text-white shadow-md' 
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                    } cursor-pointer`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Mini visual page design representation */}
                      <div className={`w-5 h-7 rounded-sm relative shrink-0 flex flex-col justify-between p-0.5 border ${isActive ? 'bg-slate-900 border-slate-600' : 'bg-slate-50 border-slate-300'}`}>
                        <div className="w-3 h-0.5 bg-slate-400 rounded-xs"></div>
                        <div className="w-4 h-0.5 bg-slate-300 rounded-xs"></div>
                        <div className="w-2.5 h-0.5 bg-rose-400 rounded-xs"></div>
                      </div>

                      {isEditing ? (
                        <input 
                          type="text"
                          value={editingPageName}
                          onChange={(e) => setEditingPageName(e.target.value)}
                          onBlur={savePageRename}
                          onKeyDown={(e) => e.key === 'Enter' && savePageRename()}
                          autoFocus
                          className="bg-slate-700 text-white text-[11px] px-1 py-0.5 rounded border border-indigo-400 w-24 outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span 
                          onDoubleClick={() => startRenamePage(p)}
                          className="text-[12px] font-bold truncate"
                          title="双击进行重命名"
                        >
                          {p.name} {!p.visible && <span className="text-[9px] text-amber-500 font-normal ml-1">(已隐藏)</span>}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 ml-1" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => togglePageVisibility(p.id)}
                        className={`p-1 rounded hover:bg-slate-700/50 ${p.visible ? 'text-slate-400' : 'text-amber-500'}`}
                        title={p.visible ? "隐藏该页不进行导出" : "设为可见"}
                      >
                        {p.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button 
                        onClick={() => startRenamePage(p)}
                        className="p-1 rounded hover:bg-slate-700/50 text-slate-400"
                        title="重命名该页"
                      >
                        <Type className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDeletePage(p.id)}
                        className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-rose-400"
                        title="删除该页"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Canvas theme styling parameters panel (实现主题样式功能) */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between text-[13px] font-bold text-slate-700">
              <div className="flex items-center gap-2">
                <PaletteIcon className="w-3.5 h-3.5 text-emerald-500" />
                <span>画板主题样式</span>
              </div>
            </div>

            <div className="space-y-2">
              {/* Background Color Custom Picker */}
              <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                <div className="w-10 flex justify-center text-[10px] font-bold text-slate-400 py-1.5 border-r border-slate-100 uppercase">Bg</div>
                <div className="flex items-center gap-2 px-3 py-1 flex-1">
                  <input 
                    type="color" 
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-5 h-5 rounded border border-slate-300 cursor-pointer p-0 bg-transparent"
                  />
                  <input 
                    type="text" 
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="text-[11px] font-bold text-slate-700 font-mono w-16 outline-none bg-transparent"
                  />
                </div>
              </div>

              {/* Text Color Custom Picker */}
              <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                <div className="w-10 flex justify-center text-[10px] font-bold text-slate-400 py-1.5 border-r border-slate-100 uppercase">Text</div>
                <div className="flex items-center gap-2 px-3 py-1 flex-1">
                  <input 
                    type="color" 
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-5 h-5 rounded border border-slate-300 cursor-pointer p-0 bg-transparent"
                  />
                  <input 
                    type="text" 
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="text-[11px] font-bold text-slate-700 font-mono w-16 outline-none bg-transparent"
                  />
                </div>
              </div>

              {/* Font Family Selection */}
              <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                <div className="w-10 flex justify-center text-[10px] font-bold text-slate-400 py-1.5 border-r border-slate-100 uppercase">Font</div>
                <div className="px-3 py-1 flex-1">
                  <select 
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="text-[11px] font-bold text-slate-700 bg-transparent border-none outline-none w-full cursor-pointer py-1"
                  >
                    <option value="Inter">Inter (无衬线默认)</option>
                    <option value="Playfair Display">Playfair Display (雅致衬线)</option>
                    <option value="Space Grotesk">Space Grotesk (极简设计)</option>
                    <option value="JetBrains Mono">JetBrains Mono (技术等宽)</option>
                  </select>
                </div>
              </div>

              {/* Text Font Size Selection */}
              <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                <div className="w-[50px] flex justify-center text-[10px] font-bold text-slate-400 py-1.5 border-r border-slate-100 uppercase shrink-0">Size</div>
                <div className="px-3 py-1 flex-1">
                  <select 
                    value={fontSize}
                    onChange={(e) => setFontSize(e.target.value)}
                    className="text-[11px] font-bold text-slate-700 bg-transparent border-none outline-none w-full cursor-pointer py-1"
                  >
                    <option value="11pt">11pt (等宽微紧)</option>
                    <option value="12pt">12pt (标准适中)</option>
                    <option value="13pt">13pt (宽舒优雅)</option>
                    <option value="14pt">14pt (大字幻灯)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Canvas Stage (Zoom and scroll responsive) */}
        <main className="flex-1 bg-[#F1F3F5] overflow-auto flex justify-center py-10 relative custom-scrollbar">
          
          <div 
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
            className="transition-transform duration-200 ease-out"
          >
            {/* The Document Sheet */}
            <div 
              style={{ 
                backgroundColor: bgColor, 
                color: textColor,
                fontFamily: fontFamily === 'Playfair Display' ? '"Playfair Display", serif' : 
                            fontFamily === 'JetBrains Mono' ? '"JetBrains Mono", monospace' : 
                            fontFamily === 'Space Grotesk' ? '"Space Grotesk", sans-serif' : 
                            '"Inter", sans-serif',
                fontSize: fontSize === '11pt' ? '14px' : 
                          fontSize === '13pt' ? '17px' : 
                          fontSize === '14pt' ? '19px' : 
                          '15px',
                width: isCustomSize 
                  ? `${customWidth}px` 
                  : (pageOrientation === 'portrait' ? PAGE_DIMENSIONS[pageSize].width : PAGE_DIMENSIONS[pageSize].minHeight),
                minHeight: isCustomSize 
                  ? `${customHeight}px` 
                  : (pageOrientation === 'portrait' ? PAGE_DIMENSIONS[pageSize].minHeight : PAGE_DIMENSIONS[pageSize].width),
              }}
              className="shadow-md ring-1 ring-black/5 rounded-sm p-14 relative flex flex-col shrink-0 transition-all duration-300 print-page"
            >
              
              {/* Floating Page Status indicators */}
              <div className="absolute top-4 left-4 bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-1.5 select-none no-print">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Active Canvas: {activePage.name}</span>
                {!activePage.visible && <span className="text-amber-400 font-normal">(此页不会被打包导出)</span>}
              </div>

              {/* Float Floating Action Palette for adding components directly to active canvas */}
              <div className="absolute top-4 right-4 bg-slate-800 text-white rounded-md flex items-center shadow-lg p-1 z-15 select-none no-print">
                <button 
                  onClick={() => setIsAddSectionModalOpen(true)}
                  className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-300 hover:text-white"
                  title="插入新组件"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-3 bg-slate-650 mx-1" />
                <button 
                  onClick={() => handleAddSection('image')}
                  className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-300 hover:text-white"
                  title="快捷插入微观显微图"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => handleAddSection('text')}
                  className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-300 hover:text-white"
                  title="快捷插入打样描述段"
                >
                  <Type className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Brand Top Right Badge */}
              <div className="flex justify-end mb-12 select-none">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-[18px]">
                  <div className="w-6 h-6 bg-slate-900 rounded-md flex items-center justify-center text-white">
                    <Layers className="w-3 h-3" />
                  </div>
                  <span className="font-mono text-xs tracking-wider uppercase text-slate-400 font-extrabold">DualCloud OS</span>
                </div>
              </div>

              {/* Document Blocks Mapping */}
              <div className={`flex-1 ${
                layoutGrid === 'double' 
                  ? 'grid grid-cols-2 gap-x-8 gap-y-6 items-start' 
                  : layoutGrid === 'bento' 
                  ? 'grid grid-cols-3 gap-6 items-start' 
                  : 'space-y-8'
              }`}>
                {activePage.sections.map((section, idx) => {
                  const isSelected = activeSectionId === section.id;
                  const spanClass = layoutGrid === 'double' 
                    ? (section.type === 'header' ? 'col-span-2 w-full' : 'col-span-1 w-full') 
                    : layoutGrid === 'bento' 
                    ? (section.type === 'header' ? 'col-span-3 w-full' : (section.type === 'video' || section.type === 'image' || section.type === 'metrics_table' ? 'col-span-2 w-full' : 'col-span-1 w-full')) 
                    : 'w-full';
                  
                  const isDragOver = dragOverIdx === idx && draggedIdx !== idx;
                  const isCurrentlyDragged = draggedIdx === idx;
                  
                  return (
                    <div 
                      key={section.id}
                      draggable={dragReadyId === section.id}
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragEnd={() => {
                        handleDragEnd();
                        setDragReadyId(null);
                      }}
                      onClick={() => setActiveSectionId(section.id)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragLeave={handleDragLeave}
                      onDrop={() => handleDropSection(idx)}
                      className={`relative rounded-md p-4 transition-all duration-200 ${spanClass} ${
                        isCurrentlyDragged
                          ? 'opacity-30 border-2 border-dashed border-slate-350 bg-slate-50'
                          : isDragOver
                          ? 'border-2 border-dashed border-indigo-500 bg-indigo-50/10 scale-[1.01] shadow-md z-10'
                          : isSelected 
                          ? 'border-2 border-indigo-600 bg-indigo-50/5' 
                          : 'border border-transparent hover:bg-slate-50/40 cursor-pointer'
                      }`}
                    >
                      {/* Interactive Section Header Flag */}
                      {isSelected && (
                        <div 
                          onMouseDown={(e) => {
                            if (e.button === 0) {
                              setDragReadyId(section.id);
                            }
                          }}
                          onMouseUp={() => setDragReadyId(null)}
                          className="absolute -top-3 left-4 bg-indigo-600 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-1.5 select-none cursor-grab active:cursor-grabbing hover:bg-indigo-700 transition-colors z-20 animate-fade-in"
                          title="按住并拖拽此处调整该区块在页面中的排版顺序"
                        >
                          <GripVertical className="w-2.5 h-2.5 opacity-80 shrink-0" />
                          <span>{section.type.toUpperCase()} BLOCK</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSection(section.id);
                            }}
                            className="hover:text-red-300 text-white transition-colors ml-0.5"
                            title="删除该板块"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}

                      {/* Content rendering based on type */}
                      {section.type === 'header' && (
                        <div>
                          {isSelected ? (
                            <div className="space-y-2">
                              <input 
                                type="text"
                                value={section.title}
                                onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                                className="w-full text-2xl font-bold bg-slate-50 border border-indigo-300 rounded px-2.5 py-1 text-slate-800 outline-none"
                              />
                              <textarea 
                                value={section.content}
                                onChange={(e) => updateSectionContent(section.id, e.target.value)}
                                className="w-full text-xs bg-slate-50 border border-indigo-300 rounded p-2 text-slate-700 outline-none"
                                rows={2}
                              />
                            </div>
                          ) : (
                            <div>
                              <h1 className={`text-2xl font-bold mb-4 ${section.isBold ? 'font-bold' : ''} ${section.isItalic ? 'italic' : ''} ${section.isUnderlined ? 'underline' : ''}`}>
                                {section.title}
                              </h1>
                              <p className="text-xs text-slate-500 leading-relaxed font-normal">
                                {section.content}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {section.type === 'text' && (
                        <div>
                          {isSelected ? (
                            <div className="space-y-2">
                              <input 
                                type="text"
                                value={section.title}
                                onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                                className="w-full text-sm font-bold bg-slate-50 border border-indigo-300 rounded px-2 py-1 text-slate-800 outline-none"
                              />
                              <textarea 
                                value={section.content}
                                onChange={(e) => updateSectionContent(section.id, e.target.value)}
                                className="w-full text-xs bg-slate-50 border border-indigo-300 rounded p-2 text-slate-700 outline-none"
                                rows={3}
                              />
                            </div>
                          ) : (
                            <div>
                              <h3 className={`text-sm font-bold mb-2 ${section.isBold ? 'font-bold' : ''} ${section.isItalic ? 'italic' : ''} ${section.isUnderlined ? 'underline' : ''}`}>
                                {section.title}
                              </h3>
                              <p className={`text-[12.5px] leading-relaxed text-slate-600 ${section.isBold ? 'font-bold' : ''} ${section.isItalic ? 'italic' : ''} ${section.isUnderlined ? 'underline' : ''}`}>
                                {section.content}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {section.type === 'process_data' && (
                        <div>
                          {isSelected ? (
                            <div className="space-y-2">
                              <input 
                                type="text"
                                value={section.title}
                                onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                                className="w-full text-sm font-bold bg-slate-50 border border-indigo-300 rounded px-2 py-1 text-slate-800 outline-none animate-pulse-slow"
                              />
                              <textarea 
                                value={section.content}
                                onChange={(e) => updateSectionContent(section.id, e.target.value)}
                                className="w-full text-xs bg-slate-50 border border-indigo-300 rounded p-1 text-slate-700 outline-none"
                                rows={1}
                              />
                              <div className="space-y-1 bg-slate-50 p-2 rounded border border-slate-200">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">排版列表元素编辑</span>
                                {section.listItems?.map((item, lIdx) => (
                                  <div key={lIdx} className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-slate-400">#{lIdx+1}</span>
                                    <input 
                                      type="text"
                                      value={item}
                                      onChange={(e) => {
                                        const nextItems = [...(section.listItems || [])];
                                        nextItems[lIdx] = e.target.value;
                                        updateSectionListItems(section.id, nextItems);
                                      }}
                                      className="flex-1 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-700 outline-none focus:border-indigo-400"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <h3 className="text-sm font-bold text-slate-900 mb-2">{section.title}</h3>
                              <p className="text-[12px] text-slate-500 mb-3">{section.content}</p>
                              <ul className="list-disc pl-5 space-y-2 text-[12.5px]">
                                {section.listItems?.map((item, lIdx) => {
                                  // Parse key variable labels
                                  const parts = item.split('：');
                                  if (parts.length > 1) {
                                    return (
                                      <li key={lIdx} className="text-slate-650">
                                        <span className="bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded mr-1 border border-indigo-100">{parts[0]}</span>
                                        <span>{parts[1]}</span>
                                      </li>
                                    );
                                  }
                                  const enParts = item.split(':');
                                  if (enParts.length > 1) {
                                    return (
                                      <li key={lIdx} className="text-slate-650">
                                        <span className="bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded mr-1 border border-indigo-100">{enParts[0]}</span>
                                        <span>{enParts[1]}</span>
                                      </li>
                                    );
                                  }
                                  return (
                                    <li key={lIdx} className="text-slate-655">{item}</li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {section.type === 'video' && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                              <Video className="w-4 h-4 text-rose-500" />
                              {section.title}
                            </h3>
                            <span className="text-[9px] font-mono uppercase bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full font-bold animate-pulse">LIVE INSPECTION</span>
                          </div>
                          
                          {/* Rich Interactive Industrial Video Mock Player */}
                          <div 
                            style={{ height: sectionHeights[section.id] ? `${sectionHeights[section.id]}px` : '176px' }}
                            className="w-full rounded-xl bg-slate-950 relative overflow-hidden flex flex-col justify-between p-3 border border-slate-800 shadow-md group/box"
                          >
                            <div className="flex justify-between items-start z-10">
                              <div className="flex items-center gap-1.5 bg-slate-900/80 text-white text-[9px] px-1.5 py-0.5 rounded backdrop-blur-xs font-mono font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                CAM-01 (STAMPING_SPEED_DWELL)
                              </div>
                              <span className="text-[10px] text-white/50 font-mono">1080p @ 60fps</span>
                            </div>

                            {/* Centered Stamping machinery simulation screen */}
                            <div className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-overlay transition-opacity" style={{ backgroundImage: `url(${section.videoUrl})` }}></div>
                            
                            {/* Inner dynamic motion simulation lines */}
                            {section.videoPlaying && (
                              <div className="absolute inset-x-0 top-1/2 h-0.5 bg-emerald-400/70 shadow-[0_0_8px_#34d399] animate-bounce pointer-events-none"></div>
                            )}

                            <div className="flex items-center justify-center h-20 z-10">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPages(prev => prev.map(p => ({
                                    ...p,
                                    sections: p.sections.map(s => s.id === section.id ? { ...s, videoPlaying: !s.videoPlaying } : s)
                                  })));
                                }}
                                className="w-11 h-11 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-all scale-100 hover:scale-105 active:scale-95 shadow-md border border-white/20"
                              >
                                {section.videoPlaying ? (
                                  <Pause className="w-5 h-5 fill-white text-white" />
                                ) : (
                                  <Play className="w-5 h-5 fill-white text-white translate-x-0.5" />
                                )}
                              </button>
                            </div>

                            {/* Timeline Control bar */}
                            <div className="z-10 bg-slate-900/70 backdrop-blur-xs rounded-lg p-1.5 flex items-center gap-2 text-white text-[10px] mb-1">
                              <span className="font-mono text-slate-300">0:{Math.floor(((section.videoProgress ?? 0) / 100) * 15).toString().padStart(2, '0')} / 0:15</span>
                              <div className="flex-1 h-1 bg-slate-700 rounded-full relative overflow-hidden cursor-pointer">
                                <div className="absolute left-0 top-0 h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${section.videoProgress}%` }}></div>
                              </div>
                              <span className="text-[9px] font-mono text-emerald-400 uppercase font-bold">{section.videoPlaying ? '同步回放中' : '已暂停'}</span>
                            </div>

                            {/* Dynamic Drag Resizer Handle - Optimized & highly intuitive */}
                            <div 
                              className="absolute bottom-0 inset-x-0 h-4 bg-slate-950/20 hover:bg-indigo-600/35 cursor-ns-resize flex items-center justify-center z-20 group-hover/box:bg-slate-950/40 transition-all border-t border-white/5"
                              onMouseDown={(e) => handleResizeMouseDown(e, section.id, 176)}
                              title="按住并上下拖动以调整高度"
                            >
                              <div className="w-12 h-1 bg-white/70 rounded-full shadow-md flex items-center justify-center gap-0.5">
                                <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
                                <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
                                <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
                              </div>
                              <span className="absolute right-3 text-[9px] text-white/50 font-mono font-bold uppercase select-none opacity-0 group-hover/box:opacity-100 transition-opacity">拖拽高度</span>
                            </div>
                          </div>

                          {/* Quick Digital Sizing Control Toolbar */}
                          <div className="flex items-center justify-between gap-2 mt-2 bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs text-slate-600 shadow-3xs select-none">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-extrabold text-slate-400 uppercase">高度:</span>
                              <span className="text-[11px] font-extrabold text-indigo-600 font-mono">{sectionHeights[section.id] || 176}px</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => setSectionHeights(prev => ({ ...prev, [section.id]: Math.max(100, (prev[section.id] || 176) - 25) }))}
                                className="p-1 hover:bg-slate-200 active:scale-95 rounded text-slate-700 font-bold transition-all border border-slate-200 bg-white"
                                title="减小高度"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={() => setSectionHeights(prev => ({ ...prev, [section.id]: Math.min(600, (prev[section.id] || 176) + 25) }))}
                                className="p-1 hover:bg-slate-200 active:scale-95 rounded text-slate-700 font-bold transition-all border border-slate-200 bg-white"
                                title="增加高度"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                              <div className="w-px h-3 bg-slate-200 mx-1" />
                              <button 
                                onClick={() => setSectionHeights(prev => ({ ...prev, [section.id]: 120 }))}
                                className={`px-2 py-0.5 rounded text-[10px] font-extrabold transition-all border ${ (sectionHeights[section.id] || 176) === 120 ? 'bg-indigo-600 text-white border-indigo-600 shadow-3xs' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'}`}
                              >
                                小 (120px)
                              </button>
                              <button 
                                onClick={() => setSectionHeights(prev => ({ ...prev, [section.id]: 200 }))}
                                className={`px-2 py-0.5 rounded text-[10px] font-extrabold transition-all border ${ (sectionHeights[section.id] || 176) === 200 ? 'bg-indigo-600 text-white border-indigo-600 shadow-3xs' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'}`}
                              >
                                中 (200px)
                              </button>
                              <button 
                                onClick={() => setSectionHeights(prev => ({ ...prev, [section.id]: 320 }))}
                                className={`px-2 py-0.5 rounded text-[10px] font-extrabold transition-all border ${ (sectionHeights[section.id] || 176) === 320 ? 'bg-indigo-600 text-white border-indigo-600 shadow-3xs' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'}`}
                              >
                                大 (320px)
                              </button>
                            </div>
                          </div>

                          {isSelected ? (
                            <textarea 
                              value={section.content}
                              onChange={(e) => updateSectionContent(section.id, e.target.value)}
                              className="w-full text-xs bg-slate-50 border border-indigo-300 rounded p-1.5 mt-2 text-slate-700 outline-none font-inherit"
                              rows={2}
                            />
                          ) : (
                            <p className="text-[11.5px] text-slate-500 italic mt-2 leading-relaxed">
                              {section.content}
                            </p>
                          )}
                        </div>
                      )}

                      {section.type === 'image' && (
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                            <ImageIcon className="w-4 h-4 text-indigo-500" />
                            {section.title}
                          </h3>
                          <div 
                            style={{ height: sectionHeights[section.id] ? `${sectionHeights[section.id]}px` : '176px' }}
                            className="w-full rounded-xl overflow-hidden relative border border-slate-200 shadow-sm bg-slate-100 group/box"
                          >
                            <img 
                              src={section.imageUrl} 
                              alt="Microscope stamping view" 
                              className="w-full h-full object-cover select-none pointer-events-none"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[9px] px-2 py-0.5 rounded backdrop-blur-xs font-mono select-none">
                              40x INFRARED MICRO-FOCUS
                            </div>

                            {/* Dynamic Drag Resizer Handle - Optimized & highly intuitive */}
                            <div 
                              className="absolute bottom-0 inset-x-0 h-4 bg-slate-950/15 hover:bg-indigo-600/30 cursor-ns-resize flex items-center justify-center z-20 group-hover/box:bg-slate-950/30 transition-all border-t border-slate-200/5"
                              onMouseDown={(e) => handleResizeMouseDown(e, section.id, 176)}
                              title="按住并上下拖动以调整高度"
                            >
                              <div className="w-12 h-1 bg-white/85 rounded-full shadow-md flex items-center justify-center gap-0.5">
                                <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
                                <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
                                <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
                              </div>
                              <span className="absolute right-3 text-[9px] text-white/60 font-mono font-bold uppercase select-none opacity-0 group-hover/box:opacity-100 transition-opacity">拖拽高度</span>
                            </div>
                          </div>

                          {/* Quick Digital Sizing Control Toolbar */}
                          <div className="flex items-center justify-between gap-2 mt-2 bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs text-slate-600 shadow-3xs select-none">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-extrabold text-slate-400 uppercase">高度:</span>
                              <span className="text-[11px] font-extrabold text-indigo-600 font-mono">{sectionHeights[section.id] || 176}px</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => setSectionHeights(prev => ({ ...prev, [section.id]: Math.max(100, (prev[section.id] || 176) - 25) }))}
                                className="p-1 hover:bg-slate-200 active:scale-95 rounded text-slate-700 font-bold transition-all border border-slate-200 bg-white"
                                title="减小高度"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={() => setSectionHeights(prev => ({ ...prev, [section.id]: Math.min(600, (prev[section.id] || 176) + 25) }))}
                                className="p-1 hover:bg-slate-200 active:scale-95 rounded text-slate-700 font-bold transition-all border border-slate-200 bg-white"
                                title="增加高度"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                              <div className="w-px h-3 bg-slate-200 mx-1" />
                              <button 
                                onClick={() => setSectionHeights(prev => ({ ...prev, [section.id]: 120 }))}
                                className={`px-2 py-0.5 rounded text-[10px] font-extrabold transition-all border ${ (sectionHeights[section.id] || 176) === 120 ? 'bg-indigo-600 text-white border-indigo-600 shadow-3xs' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'}`}
                              >
                                小 (120px)
                              </button>
                              <button 
                                onClick={() => setSectionHeights(prev => ({ ...prev, [section.id]: 200 }))}
                                className={`px-2 py-0.5 rounded text-[10px] font-extrabold transition-all border ${ (sectionHeights[section.id] || 176) === 200 ? 'bg-indigo-600 text-white border-indigo-600 shadow-3xs' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'}`}
                              >
                                中 (200px)
                              </button>
                              <button 
                                onClick={() => setSectionHeights(prev => ({ ...prev, [section.id]: 320 }))}
                                className={`px-2 py-0.5 rounded text-[10px] font-extrabold transition-all border ${ (sectionHeights[section.id] || 176) === 320 ? 'bg-indigo-600 text-white border-indigo-600 shadow-3xs' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'}`}
                              >
                                大 (320px)
                              </button>
                            </div>
                          </div>
                          
                          {isSelected ? (
                            <textarea 
                              value={section.content}
                              onChange={(e) => updateSectionContent(section.id, e.target.value)}
                              className="w-full text-xs bg-slate-50 border border-indigo-300 rounded p-1.5 mt-2 text-slate-700 outline-none font-inherit"
                              rows={2}
                            />
                          ) : (
                            <p className="text-[11.5px] text-slate-500 italic mt-2 leading-relaxed">
                              {section.content}
                            </p>
                          )}
                        </div>
                      )}

                      {section.type === 'metrics_table' && (
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5 select-none">
                            <Table className="w-4 h-4 text-sky-500" />
                            {section.title}
                          </h3>
                          <table className="w-full text-left text-[12px] border-collapse bg-white border border-slate-100 rounded-lg overflow-hidden shadow-sm">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50/80">
                                <th className="py-2.5 px-3 font-semibold text-slate-600">性能维度 (Metric Category)</th>
                                <th className="py-2.5 px-3 font-semibold text-slate-600 text-center">测试得分 (Rating)</th>
                                <th className="py-2.5 px-3 font-semibold text-slate-600 text-right">协同状态 (Result)</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                <td className="py-2.5 px-3 text-slate-700 font-medium">图案微观平整清晰度 (Clearness)</td>
                                <td className="py-2.5 px-3 text-center font-bold text-slate-800 font-mono">{card.results.clearness}/5</td>
                                <td className="py-2.5 px-3 text-right"><span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100">PASS 通过</span></td>
                              </tr>
                              <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                <td className="py-2.5 px-3 text-slate-700 font-medium">3M胶带粘附力测试 (Adhesion Test)</td>
                                <td className="py-2.5 px-3 text-center font-bold text-slate-800 font-mono">{card.results.adhesion}/5</td>
                                <td className="py-2.5 px-3 text-right"><span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100">PASS 通过</span></td>
                              </tr>
                              <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                <td className="py-2.5 px-3 text-slate-700 font-medium">表面金属光泽饱满度 (Gloss level)</td>
                                <td className="py-2.5 px-3 text-center font-bold text-slate-800 font-mono">{card.results.gloss}/5</td>
                                <td className="py-2.5 px-3 text-right"><span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100">PASS 通过</span></td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="py-2.5 px-3 text-slate-700 font-medium">耐摩擦抗刮擦等级 (Abrasion level)</td>
                                <td className="py-2.5 px-3 text-center font-bold text-slate-800 font-mono">{card.results.abrasion}/5</td>
                                <td className="py-2.5 px-3 text-right"><span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100">PASS 通过</span></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}

                      {section.type === 'operator_notes' && (
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 mb-2 select-none">{section.title}</h3>
                          {isSelected ? (
                            <textarea 
                              value={section.content}
                              onChange={(e) => updateSectionContent(section.id, e.target.value)}
                              className="w-full text-xs bg-white border border-indigo-300 rounded p-2.5 text-slate-700 outline-none font-inherit"
                              rows={3}
                            />
                          ) : (
                            <div className="border-l-4 border-indigo-500 bg-slate-50/70 p-3 rounded-r-lg">
                              <p className="text-[12px] italic text-slate-600 leading-relaxed font-medium">
                                "{section.content}"
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {section.type === 'knowledge_refs' && (
                        <div>
                          <div className="flex items-center justify-between mb-3 select-none">
                            <h3 className="text-sm font-bold text-slate-900">{section.title}</h3>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsAddingRef(true);
                              }}
                              className="text-[10px] font-extrabold text-indigo-600 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 transition-colors"
                            >
                              <Plus className="w-3 h-3" /> 添加标答参考
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {referencedAssets.map(asset => {
                              const catItem = CATEGORY_MAP[asset.category];
                              return (
                                <div key={asset.id} className="flex flex-col border border-slate-200 rounded-lg p-3 bg-white shadow-sm hover:border-slate-350 transition-all group relative">
                                  <div className="flex items-center gap-2 mb-1.5 select-none">
                                    <div className={`w-5 h-5 rounded ${catItem.bgColor} ${catItem.color} flex items-center justify-center shrink-0 border ${catItem.borderColor}`}>
                                      {React.cloneElement(catItem.icon as React.ReactElement, { className: 'w-3 h-3' })}
                                    </div>
                                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{catItem.label}</div>
                                  </div>
                                  <div className="text-[11px] font-extrabold text-slate-700 leading-tight mb-1 group-hover:text-primary transition-colors">
                                    {asset.title}
                                  </div>
                                  <div className="text-[9.5px] text-slate-400 font-mono">
                                    ID: {asset.id} • {asset.lastUpdated}
                                  </div>
                                  
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setReferencedAssets(prev => prev.filter(a => a.id !== asset.id));
                                    }}
                                    className="absolute top-2.5 right-2.5 p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-all opacity-0 group-hover:opacity-100"
                                    title="移出此关联"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                            {referencedAssets.length === 0 && (
                              <div className="col-span-2 text-center py-6 text-[11px] text-slate-400 border border-dashed border-slate-250 rounded-lg">
                                暂无关联文献。点击右上角“添加标答参考”进行引入。
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Rich-Text floating formatting toolbar - dynamically floats below the selected content block */}
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 bg-white border border-slate-200 shadow-xl rounded-xl flex items-center p-1.5 z-30 gap-1 select-none"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button 
                              onClick={() => toggleSectionStyle('bold')}
                              className={`p-1.5 rounded transition-colors ${section.isBold ? 'bg-slate-100 text-indigo-600 font-bold' : 'hover:bg-slate-50 text-slate-500'}`}
                              title="加粗文字 (Bold)"
                            >
                              <Bold className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => toggleSectionStyle('italic')}
                              className={`p-1.5 rounded transition-colors ${section.isItalic ? 'bg-slate-100 text-indigo-600' : 'hover:bg-slate-50 text-slate-500'}`}
                              title="斜体文字 (Italic)"
                            >
                              <Italic className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => toggleSectionStyle('underline')}
                              className={`p-1.5 rounded transition-colors ${section.isUnderlined ? 'bg-slate-100 text-indigo-600' : 'hover:bg-slate-50 text-slate-500'}`}
                              title="下划线文字 (Underline)"
                            >
                              <Underline className="w-3.5 h-3.5" />
                            </button>

                            <div className="w-px h-4 bg-slate-250 mx-1" />
                            <button 
                              onClick={() => triggerToast("已将所选文本内容对齐")}
                              className="px-2 py-1.5 hover:bg-slate-100 rounded text-slate-650 text-[10px] font-bold flex items-center gap-0.5"
                            >
                              正文字体 <ChevronDown className="w-3 h-3 text-slate-400" />
                            </button>
                            <div className="w-px h-4 bg-slate-250 mx-1" />

                            <button 
                              onClick={() => triggerToast("超链接配置功能已就绪")}
                              className="p-1.5 hover:bg-slate-100 rounded text-slate-500"
                              title="插入超链接"
                            >
                              <LinkIcon className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => triggerToast("列表结构已调整")}
                              className="p-1.5 hover:bg-slate-100 rounded text-slate-500"
                              title="列表项目符号"
                            >
                              <List className="w-3.5 h-3.5" />
                            </button>
                            <div className="w-px h-4 bg-slate-250 mx-1" />
                            <button 
                              onClick={() => handleDeleteSection(section.id)}
                              className="p-1.5 hover:bg-rose-50 text-rose-500 rounded transition-colors"
                              title="彻底移除该模块"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>

                    </div>
                  );
                })}
              </div>

              {/* Decorative Document Bottom footer info */}
              <div className="pt-8 border-t border-slate-100 flex justify-between text-[10px] text-slate-400 font-mono select-none mt-14">
                <span>打样单流水: {card.evidenceNo}</span>
                <span>DualCloud 工业外贸数字生态系统</span>
                <span>Page 1 of {pages.length}</span>
              </div>

            </div>
          </div>
        </main>
      </div>

      {/* A. Template Switch Modal (实现证据卡模板功能) */}
      <AnimatePresence>
        {isTemplateModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50"
            onClick={() => setIsTemplateModalOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-100"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <PaletteIcon className="w-4 h-4 text-indigo-500" />
                  <span>选择工艺证据卡排版模板</span>
                </h3>
                <button 
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="p-4 grid grid-cols-2 gap-4">
                {(Object.keys(TEMPLATE_PRESETS) as TemplateId[]).map((tplId) => {
                  const preset = TEMPLATE_PRESETS[tplId];
                  const isCurrent = activeTemplate === tplId;
                  
                  return (
                    <button
                      key={tplId}
                      onClick={() => applyTemplate(tplId)}
                      className={`text-left p-4 rounded-xl border-2 transition-all flex flex-col gap-2 ${
                        isCurrent 
                          ? 'border-indigo-600 bg-indigo-50/20' 
                          : 'border-slate-150 bg-white hover:border-slate-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start w-full">
                        <span className="text-[13px] font-extrabold text-slate-800">{preset.name}</span>
                        {isCurrent && (
                          <span className="text-[9px] bg-indigo-600 text-white font-bold px-1.5 py-0.5 rounded-full">ACTIVE 使用中</span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">{preset.description}</span>
                      
                      {/* Mini Preview bar */}
                      <div 
                        className="w-full h-12 bg-slate-50 border border-slate-250 rounded p-2 text-[10px] flex flex-col gap-1 mt-1 shrink-0 select-none font-mono text-slate-500"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-700">布局:</span>
                          <span className="bg-indigo-50 text-indigo-700 px-1 py-0.2 rounded text-[9px] font-bold">{preset.layoutGrid === 'single' ? '单栏' : preset.layoutGrid === 'double' ? '双栏对半' : 'Bento 磁贴'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-700">纸张方向:</span>
                          <span className="bg-slate-100 text-slate-700 px-1 py-0.2 rounded text-[9px] font-bold">{preset.pageOrientation === 'portrait' ? '纵向 (Portrait)' : '横向 (Landscape)'}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* B. Component Insertion Modal (添加组件功能，视频，图片，这些作为section模版) */}
      <AnimatePresence>
        {isAddSectionModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50"
            onClick={() => setIsAddSectionModalOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-100"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <Box className="w-4 h-4 text-indigo-500" />
                  <span>添加画布排版组件</span>
                </h3>
                <button 
                  onClick={() => setIsAddSectionModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 grid grid-cols-1 gap-1.5 max-h-[380px] overflow-y-auto custom-scrollbar">
                <button 
                  onClick={() => handleAddSection('text')}
                  className="flex items-center gap-3.5 p-3 text-left rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-150 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Type className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-slate-700 group-hover:text-indigo-600">常规工艺文本块 (Rich Text Block)</div>
                    <div className="text-[10px] text-slate-400">插入一个可直接编写普通文本、标题和长句的自适应区块。</div>
                  </div>
                </button>

                <button 
                  onClick={() => handleAddSection('video')}
                  className="flex items-center gap-3.5 p-3 text-left rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-150 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <Video className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-slate-700 group-hover:text-rose-600">工业高分辨率视频流 (Live Video Feed)</div>
                    <div className="text-[10px] text-slate-400">插入支持点播、高保真回放和状态指示灯的仿真机器镜头监控帧。</div>
                  </div>
                </button>

                <button 
                  onClick={() => handleAddSection('image')}
                  className="flex items-center gap-3.5 p-3 text-left rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-150 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-slate-700 group-hover:text-sky-600">微观细节检测切片图 (顕微 Microscopic Adhesion)</div>
                    <div className="text-[10px] text-slate-400">支持缩放状态标注和动态备注输入的高倍相机切片图片框架。</div>
                  </div>
                </button>

                <button 
                  onClick={() => handleAddSection('process_data')}
                  className="flex items-center gap-3.5 p-3 text-left rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-150 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-slate-700 group-hover:text-emerald-600">核心指标大纲列表 (Parameter Lists)</div>
                    <div className="text-[10px] text-slate-400">高亮显示主参数、温控数据，支持在右侧输入框中直接追加条目。</div>
                  </div>
                </button>

                <button 
                  onClick={() => handleAddSection('metrics_table')}
                  className="flex items-center gap-3.5 p-3 text-left rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-150 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Table className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-slate-700 group-hover:text-amber-600">物理性能物性表格 (Metrics Score Table)</div>
                    <div className="text-[10px] text-slate-400">用于拉拔、附着力和耐划擦等级测试打分的工业量化对账矩阵表。</div>
                  </div>
                </button>

                <button 
                  onClick={() => handleAddSection('operator_notes')}
                  className="flex items-center gap-3.5 p-3 text-left rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-150 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-slate-700 group-hover:text-indigo-600">评审与总结批注栏 (Signoff Quotes)</div>
                    <div className="text-[10px] text-slate-400">插入一个带有加粗左边栏和淡灰色底色的工程师评审结论块。</div>
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* C. Add Knowledge Reference Modal (Keep standard functional matching) */}
      <AnimatePresence>
        {isAddingRef && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50"
            onClick={() => setIsAddingRef(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
              style={{ maxHeight: '80vh' }}
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-slate-800 text-sm">关联工业知识云标答文献</h3>
                <button 
                  onClick={() => setIsAddingRef(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="p-4 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="输入检索关键词，如 '产品数据'、'适配'..."
                    value={searchRefQuery}
                    onChange={(e) => setSearchRefQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                <div className="grid grid-cols-1 gap-1">
                  {initialKnowledgeAssets
                    .filter(asset => 
                      !referencedAssets.some(ref => ref.id === asset.id) &&
                      (asset.title.toLowerCase().includes(searchRefQuery.toLowerCase()) || 
                       asset.id.toLowerCase().includes(searchRefQuery.toLowerCase()))
                    )
                    .map(asset => {
                      const catItem = CATEGORY_MAP[asset.category];
                      return (
                        <button
                          key={asset.id}
                          onClick={() => {
                            setReferencedAssets(prev => [...prev, asset]);
                            setIsAddingRef(false);
                            setSearchRefQuery('');
                            triggerToast(`成功关联知识参考：${asset.title}`);
                          }}
                          className="flex items-center gap-3 p-3 text-left rounded-lg hover:bg-slate-50 transition-colors group border border-transparent hover:border-slate-100"
                        >
                          <div className={`w-8 h-8 rounded-lg ${catItem.bgColor} ${catItem.color} flex items-center justify-center shrink-0 border ${catItem.borderColor}`}>
                            {React.cloneElement(catItem.icon as React.ReactElement, { className: 'w-4 h-4' })}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[13px] font-bold text-slate-700 truncate group-hover:text-primary transition-colors">{asset.title}</span>
                              <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">{asset.id}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{catItem.label}</span>
                              <span className="text-[10px] text-slate-400 truncate hidden sm:inline">• {asset.content}</span>
                            </div>
                          </div>
                          <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus className="w-3.5 h-3.5" />
                          </div>
                        </button>
                      );
                    })}
                  {initialKnowledgeAssets.filter(asset => 
                    !referencedAssets.some(ref => ref.id === asset.id) &&
                    (asset.title.toLowerCase().includes(searchRefQuery.toLowerCase()) || 
                     asset.id.toLowerCase().includes(searchRefQuery.toLowerCase()))
                  ).length === 0 && (
                    <div className="py-8 text-center text-[13px] text-slate-500">
                      未检索到匹配的知识资产文献。
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* D. Vector PDF Export Modal (功能修复: 高保真PDF导出引擎) */}
      <AnimatePresence>
        {isExportModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 no-print"
            onClick={() => setIsExportModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-100"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-indigo-500 animate-bounce" />
                  <span>高保真 PDF 矢量画册导出引擎</span>
                </h3>
                <button 
                  onClick={() => setIsExportModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-5 text-xs text-slate-600">
                {exportProgress < 100 ? (
                  <div className="space-y-3 py-4 text-center">
                    <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
                    <span className="font-extrabold text-sm text-slate-800 block">系统正在解析当前矢量排版并渲染...</span>
                    <span className="text-[11px] text-slate-400 font-mono block">正在解析底材、工艺机台和微观检验切片...</span>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-2.5 rounded-full transition-all duration-150 ease-out"
                        style={{ width: `${exportProgress}%` }}
                      />
                    </div>
                    <span className="font-mono font-bold text-indigo-600">{exportProgress}%</span>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-250">
                    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-150 rounded-xl p-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                        <Check className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-black text-xs text-emerald-800 block">✓ 矢量排版构建完成！已进入高保真保存就绪状态</span>
                        <span className="text-[10px] text-emerald-600 block">所有底材对账与打样切片均已合并为自适应矢量版式</span>
                      </div>
                    </div>

                    <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <span className="font-extrabold text-xs text-slate-800 block">💡 推荐操作指南 (高保真保存方案):</span>
                      <ul className="space-y-2 pl-4 list-decimal text-[11px] text-slate-500 leading-relaxed font-semibold">
                        <li>
                          您可以点击 <span className="text-emerald-600 font-extrabold">「保存高保真画册 (.html)」</span>，文件将完美保存至您的设备。双击打开即为极速响应、离线可用的精美数字对账单，并能随时一键保存为高保真 PDF。
                        </li>
                        <li>
                          或者，直接点击 <span className="text-indigo-600 font-extrabold">「系统直接打印 PDF」</span> 唤醒浏览器自带的打印功能；
                        </li>
                        <li>
                          在打印对话框中将 <strong>目标/打印机</strong> 选择为 <span className="text-indigo-600 font-extrabold">「另存为 PDF」</span> 并勾选 <span className="text-indigo-600 font-extrabold">「背景图形」</span>，即可获得完美矢量版 PDF。
                        </li>
                      </ul>
                    </div>

                    <div className="flex flex-col gap-2.5 pt-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            triggerFileSave();
                          }}
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md text-center transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Download className="w-4 h-4" />
                          保存高保真画册 (.html)
                        </button>
                        <button
                          onClick={() => {
                            setIsExportModalOpen(false);
                            setTimeout(() => {
                              window.print();
                            }, 300);
                          }}
                          className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md text-center transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Printer className="w-4 h-4" />
                          系统直接打印 PDF
                        </button>
                      </div>
                      <button
                        onClick={() => setIsExportModalOpen(false)}
                        className="py-2 bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold rounded-xl border border-slate-200 text-center transition cursor-pointer text-xs"
                      >
                        返回画布
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Embedded CSS Scrollbars */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: #94a3b8;
        }
      `}</style>
    </div>
  );
}

const FileTextIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);

const PaletteIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19C5.37434 19.5228 5.41372 20.3553 5.06941 21.0116L4.8211 21.4842C4.52184 22.0537 3.93172 22.4045 3.29221 22.385C3.12558 22.3799 2.9614 22.3712 2.8 22" />
    <circle cx="7.5" cy="10.5" r="1.5" fill="currentColor"/>
    <circle cx="11.5" cy="7.5" r="1.5" fill="currentColor"/>
    <circle cx="16.5" cy="9.5" r="1.5" fill="currentColor"/>
    <circle cx="15.5" cy="14.5" r="1.5" fill="currentColor"/>
  </svg>
);
