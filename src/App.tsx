/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  BookOpen, 
  Cloud,
  ClipboardCheck,
  Database, 
  Cpu, 
  FileText,
  Image as ImageIcon,
  ListChecks,
  Workflow, 
  Megaphone,
  MessageSquareText,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  LogOut,
  MessageCircle,
  Send,
  Tags,
  UserRound,
  Video,
  Maximize2
} from 'lucide-react';

// Shared data and types
import { initialProducts, initialPracticeCards, initialKnowledgeAssets } from './data/mockData';
import { KnowledgeAsset, PracticeCard } from './types';
import {
  createPracticeCard,
  loadKnowledgeAssets,
  loadPracticeCards,
  saveKnowledgeAssets,
  savePracticeCards,
} from './lib/appState';
import { curateKnowledgeAsset, curateKnowledgeAssets } from './lib/knowledgeCuration';
import DuoCloudLogin from './components/DuoCloudLogin';
import { AuthUser, getDuoCloudSession, signInToDuoCloud, signOutOfDuoCloud } from './lib/authApi';
import {
  KnowledgeApiError,
  bulkImportKnowledgeAssets,
  bulkPatchKnowledgeAssets,
  createRemoteKnowledgeAsset,
  deleteRemoteKnowledgeAsset,
  exportRemoteKnowledgeAssets,
  listKnowledgeAssets,
  updateRemoteKnowledgeAsset,
} from './lib/knowledgeApi';
import type { MarketingView } from './components/MarketingTrustWorkspace';

const CombatToolkit = lazy(() => import('./components/CombatToolkit'));
const KnowledgeCloud = lazy(() => import('./components/KnowledgeCloud'));
const PracticeCloud = lazy(() => import('./components/PracticeCloud'));

type TrustedCloudModule = 'marketing' | 'delivery';
const MARKETING_TRUST_VIEW_IDS: MarketingView[] = [
  'overview',
  'primary',
  'scene',
  'compare',
  'video',
  'report',
  'review',
  'tags',
  'publish',
  'questions',
];

const DIFY_CHATBOT_TOKEN = 'Pqyg8S5HUiWNYD72';
const DIFY_EMBED_SRC = 'https://udify.app/embed.min.js';

const lightweightKnowledgeAssets = curateKnowledgeAssets(initialKnowledgeAssets);

function loadLocalKnowledgeFallback() {
  return curateKnowledgeAssets(loadKnowledgeAssets(lightweightKnowledgeAssets));
}

type DifyWindow = Window & {
  difyChatbotConfig?: {
    token: string;
    dynamicScript: boolean;
    inputs: Record<string, unknown>;
    systemVariables: Record<string, unknown>;
    userVariables: Record<string, unknown>;
  };
};

function DifyChatbotLauncher({ isSidebarCollapsed }: { isSidebarCollapsed: boolean }) {
  const [isOpening, setIsOpening] = useState(false);
  const [isDifyOpen, setIsDifyOpen] = useState(false);
  const [isDifyFullscreen, setIsDifyFullscreen] = useState(false);
  const [difyControlPosition, setDifyControlPosition] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const difyWindow = window as DifyWindow;
    difyWindow.difyChatbotConfig = {
      token: DIFY_CHATBOT_TOKEN,
      dynamicScript: true,
      inputs: {},
      systemVariables: {},
      userVariables: {},
    };

    let style = document.getElementById('dify-chatbot-style-overrides') as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = 'dify-chatbot-style-overrides';
      document.head.appendChild(style);
    }
    style.textContent = `
      #dify-chatbot-bubble-button {
        background-color: #1C64F2 !important;
        width: 1px !important;
        height: 1px !important;
        min-width: 1px !important;
        opacity: 0 !important;
        pointer-events: none !important;
        transform: scale(0.01) !important;
      }
      #dify-chatbot-bubble-window {
        position: fixed !important;
        top: auto !important;
        left: auto !important;
        right: max(1rem, env(safe-area-inset-right)) !important;
        bottom: max(1rem, env(safe-area-inset-bottom)) !important;
        transform: none !important;
        width: min(28rem, calc(100vw - 2rem)) !important;
        height: min(44rem, calc(100vh - 2rem)) !important;
        max-width: calc(100vw - 2rem) !important;
        max-height: calc(100vh - 2rem) !important;
        border: 1px solid rgba(125, 178, 255, 0.75) !important;
        border-radius: 24px !important;
        overflow: hidden !important;
        background: rgba(255, 255, 255, 0.68) !important;
        backdrop-filter: blur(18px) saturate(1.25) !important;
        -webkit-backdrop-filter: blur(18px) saturate(1.25) !important;
        box-shadow: 0 24px 70px rgba(15, 23, 42, 0.24), 0 0 0 1px rgba(255, 255, 255, 0.35) inset !important;
        z-index: 2147482999 !important;
        transition: width 180ms ease, height 180ms ease, inset 180ms ease, border-radius 180ms ease, box-shadow 180ms ease !important;
      }
      html.dify-chatbot-fullscreen #dify-chatbot-bubble-window {
        top: max(0.75rem, env(safe-area-inset-top)) !important;
        right: max(0.75rem, env(safe-area-inset-right)) !important;
        bottom: max(0.75rem, env(safe-area-inset-bottom)) !important;
        left: max(0.75rem, env(safe-area-inset-left)) !important;
        width: calc(100vw - max(0.75rem, env(safe-area-inset-left)) - max(0.75rem, env(safe-area-inset-right))) !important;
        height: calc(100vh - max(0.75rem, env(safe-area-inset-top)) - max(0.75rem, env(safe-area-inset-bottom))) !important;
        max-width: none !important;
        max-height: none !important;
        border-radius: 18px !important;
        box-shadow: 0 30px 90px rgba(15, 23, 42, 0.32), 0 0 0 1px rgba(255, 255, 255, 0.38) inset !important;
      }
    `;

    document.getElementById('dify-chatbot-bubble-button')?.remove();
    document.getElementById('dify-chatbot-bubble-window')?.remove();
    document.getElementById(DIFY_CHATBOT_TOKEN)?.remove();

    const script = document.createElement('script');
    script.src = DIFY_EMBED_SRC;
    script.id = DIFY_CHATBOT_TOKEN;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  const isDifyWindowVisible = useCallback((bubbleWindow: HTMLElement) => {
    const rect = bubbleWindow.getBoundingClientRect();
    const styles = window.getComputedStyle(bubbleWindow);
    return styles.display !== 'none' && styles.visibility !== 'hidden' && rect.width > 20 && rect.height > 20;
  }, []);

  const showDifyWindow = useCallback((bubbleWindow: HTMLElement) => {
    bubbleWindow.style.setProperty('display', 'flex', 'important');
    bubbleWindow.style.setProperty('visibility', 'visible', 'important');
    bubbleWindow.style.setProperty('opacity', '1', 'important');
  }, []);

  const hideDifyWindow = useCallback((bubbleWindow: HTMLElement) => {
    bubbleWindow.style.setProperty('display', 'none', 'important');
    bubbleWindow.style.setProperty('visibility', 'hidden', 'important');
    bubbleWindow.style.setProperty('opacity', '0', 'important');
  }, []);

  const syncDifyWindowFrame = useCallback(() => {
    const bubbleWindow = document.getElementById('dify-chatbot-bubble-window') as HTMLElement | null;
    if (!bubbleWindow) return false;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = isDifyFullscreen ? 12 : 16;
    const normalWidth = Math.min(448, Math.max(320, viewportWidth - margin * 2));
    const normalHeight = Math.min(704, Math.max(360, viewportHeight - margin * 2));

    bubbleWindow.style.setProperty('position', 'fixed', 'important');
    bubbleWindow.style.setProperty('transform', 'none', 'important');
    bubbleWindow.style.setProperty('z-index', '2147482999', 'important');
    bubbleWindow.style.setProperty('overflow', 'hidden', 'important');

    if (isDifyFullscreen) {
      const fullscreenWidth = Math.max(320, viewportWidth - margin * 2);
      const fullscreenHeight = Math.max(360, viewportHeight - margin * 2);
      bubbleWindow.style.setProperty('top', `${margin}px`, 'important');
      bubbleWindow.style.setProperty('right', `${margin}px`, 'important');
      bubbleWindow.style.setProperty('bottom', `${margin}px`, 'important');
      bubbleWindow.style.setProperty('left', `${margin}px`, 'important');
      bubbleWindow.style.setProperty('width', `${fullscreenWidth}px`, 'important');
      bubbleWindow.style.setProperty('height', `${fullscreenHeight}px`, 'important');
      bubbleWindow.style.setProperty('max-width', 'none', 'important');
      bubbleWindow.style.setProperty('max-height', 'none', 'important');
      bubbleWindow.style.setProperty('border-radius', '18px', 'important');
    } else {
      bubbleWindow.style.setProperty('top', 'auto', 'important');
      bubbleWindow.style.setProperty('left', 'auto', 'important');
      bubbleWindow.style.setProperty('right', `${margin}px`, 'important');
      bubbleWindow.style.setProperty('bottom', `${margin}px`, 'important');
      bubbleWindow.style.setProperty('width', `${normalWidth}px`, 'important');
      bubbleWindow.style.setProperty('height', `${normalHeight}px`, 'important');
      bubbleWindow.style.setProperty('max-width', `calc(100vw - ${margin * 2}px)`, 'important');
      bubbleWindow.style.setProperty('max-height', `calc(100vh - ${margin * 2}px)`, 'important');
      bubbleWindow.style.setProperty('border-radius', '24px', 'important');
    }

    const rect = bubbleWindow.getBoundingClientRect();
    setDifyControlPosition({
      top: Math.max(rect.top + 14, 10),
      right: Math.max(viewportWidth - rect.right + 14, 10),
    });
    return true;
  }, [isDifyFullscreen]);

  useEffect(() => {
    document.documentElement.classList.toggle('dify-chatbot-fullscreen', isDifyFullscreen);
    return () => document.documentElement.classList.remove('dify-chatbot-fullscreen');
  }, [isDifyFullscreen]);

  useEffect(() => {
    if (!isDifyOpen) return undefined;

    syncDifyWindowFrame();
    const handleResize = () => syncDifyWindowFrame();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isDifyOpen, syncDifyWindowFrame]);

  useEffect(() => {
    if (!isDifyOpen) return undefined;

    const intervalId = window.setInterval(() => {
      const bubbleWindow = document.getElementById('dify-chatbot-bubble-window') as HTMLElement | null;
      if (!bubbleWindow) {
        setIsDifyOpen(false);
        setIsDifyFullscreen(false);
        return;
      }

      if (!isDifyWindowVisible(bubbleWindow)) {
        setIsDifyOpen(false);
        setIsDifyFullscreen(false);
        setDifyControlPosition({ top: 0, right: 0 });
        return;
      }

      syncDifyWindowFrame();
    }, 600);

    return () => window.clearInterval(intervalId);
  }, [isDifyOpen, isDifyWindowVisible, syncDifyWindowFrame]);

  const toggleDifyChatbot = () => {
    const existingWindow = document.getElementById('dify-chatbot-bubble-window') as HTMLElement | null;
    if (isDifyOpen && existingWindow && isDifyWindowVisible(existingWindow)) {
      hideDifyWindow(existingWindow);
      setIsDifyOpen(false);
      setIsDifyFullscreen(false);
      setDifyControlPosition({ top: 0, right: 0 });
      return;
    }

    let attempts = 0;
    setIsOpening(true);

    const clickWhenReady = () => {
      const bubbleWindow = document.getElementById('dify-chatbot-bubble-window') as HTMLElement | null;
      if (bubbleWindow) {
        showDifyWindow(bubbleWindow);
        setIsDifyOpen(true);
        window.requestAnimationFrame(() => syncDifyWindowFrame());
        window.setTimeout(syncDifyWindowFrame, 120);
        setIsOpening(false);
        return;
      }

      const bubbleButton = document.getElementById('dify-chatbot-bubble-button') as HTMLElement | null;
      if (bubbleButton) {
        const openIcon = document.getElementById('openIcon');
        (openIcon ?? bubbleButton).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        window.setTimeout(() => {
          const openedWindow = document.getElementById('dify-chatbot-bubble-window') as HTMLElement | null;
          if (openedWindow) {
            showDifyWindow(openedWindow);
            setIsDifyOpen(true);
            syncDifyWindowFrame();
          }
        }, 120);
        setIsOpening(false);
        return;
      }

      attempts += 1;
      if (attempts < 24) {
        window.setTimeout(clickWhenReady, 250);
        return;
      }

      setIsOpening(false);
    };

    clickWhenReady();
  };

  return (
    <>
      <button
        type="button"
        onClick={toggleDifyChatbot}
        className={`w-full flex items-center rounded-xl border border-[#1C64F2]/20 bg-[#1C64F2] text-white hover:bg-[#1557D6] shadow-sm shadow-[#1C64F2]/20 transition ${
          isSidebarCollapsed ? 'md:justify-center md:p-1.5 p-2.5' : 'gap-3 p-2.5'
        }`}
        title={isSidebarCollapsed ? 'Dify AI 助手' : undefined}
        id="dify-sidebar-launcher"
      >
        <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-white shrink-0">
          <MessageCircle className="w-4 h-4" />
        </div>
        <div className={`min-w-0 text-left ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>
          <p className="text-[11px] font-bold leading-tight">{isOpening ? '正在打开 Dify...' : 'Dify AI 助手'}</p>
          <p className="text-[10px] font-mono opacity-75 leading-tight">Knowledge Copilot</p>
        </div>
      </button>

      {isDifyOpen && typeof document !== 'undefined' && createPortal(
        <button
          type="button"
          onClick={() => setIsDifyFullscreen(value => !value)}
          className="fixed z-[2147483001] w-8 h-8 rounded-lg bg-white/75 border border-white/70 text-[#1C64F2] shadow-lg shadow-slate-900/10 backdrop-blur-md flex items-center justify-center hover:bg-white/90 hover:text-[#1557D6] transition"
          style={{
            top: `${difyControlPosition.top}px`,
            right: `${difyControlPosition.right}px`,
          }}
          title={isDifyFullscreen ? '退出全屏' : '全屏显示'}
          aria-label={isDifyFullscreen ? '退出全屏' : '全屏显示'}
        >
          <Maximize2 className="w-4 h-4" />
        </button>,
        document.body,
      )}
    </>
  );
}

export default function App() {
  // Read tab parameter from URL query string
  const queryParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const urlTab = queryParams.get('tab');
  const urlModule = queryParams.get('module');
  const urlMarketingView = queryParams.get('view');
  const viteEnv = (import.meta as unknown as { env?: { DEV?: boolean } }).env;
  const isDevAuthRequested = Boolean(viteEnv?.DEV) && queryParams.get('devAuth') === '1';
  const initialTab = (urlTab === 'toolkit' || urlTab === 'knowledge' || urlTab === 'practice') ? urlTab : 'toolkit';
  const initialTrustedCloudModule: TrustedCloudModule = urlModule === 'marketing' || urlModule === 'delivery'
    ? urlModule
    : 'delivery';
  const initialMarketingTrustView: MarketingView = MARKETING_TRUST_VIEW_IDS.includes(urlMarketingView as MarketingView)
    ? urlMarketingView as MarketingView
    : 'overview';

  const [activeTab, setActiveTab] = useState<'toolkit' | 'knowledge' | 'practice'>(initialTab);
  const [trustedCloudModule, setTrustedCloudModule] = useState<TrustedCloudModule>(initialTrustedCloudModule);
  const [marketingTrustView, setMarketingTrustView] = useState<MarketingView>(initialMarketingTrustView);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>(
    isDevAuthRequested ? 'authenticated' : 'checking',
  );
  const [authUser, setAuthUser] = useState<AuthUser | null>(
    isDevAuthRequested ? { uid: 'local-dev', username: 'test', role: 'admin' } : null,
  );
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [knowledgeCloudStatus, setKnowledgeCloudStatus] = useState<'idle' | 'loading' | 'online' | 'offline'>('idle');
  
  // App-level state for persistent live sandbox interaction
  const [knowledgeAssets, setKnowledgeAssets] = useState<KnowledgeAsset[]>(loadLocalKnowledgeFallback);
  const knowledgeAssetsRef = useRef<KnowledgeAsset[]>(knowledgeAssets);
  const [practiceCards, setPracticeCards] = useState<PracticeCard[]>(() => loadPracticeCards(initialPracticeCards));

  useEffect(() => {
    knowledgeAssetsRef.current = knowledgeAssets;
  }, [knowledgeAssets]);

  const refreshKnowledgeAssets = useCallback(async () => {
    setKnowledgeCloudStatus('loading');

    try {
      const remoteAssets = curateKnowledgeAssets(await listKnowledgeAssets({ summary: true, limit: 5000 }));
      setKnowledgeAssets(remoteAssets);
      saveKnowledgeAssets(remoteAssets);
      setKnowledgeCloudStatus('online');
      return remoteAssets;
    } catch (error) {
      if (error instanceof KnowledgeApiError && error.code === 'UNAUTHORIZED') {
        setAuthUser(null);
        setAuthStatus('unauthenticated');
        setAuthError(error.message);
        setKnowledgeAssets([]);
        setKnowledgeCloudStatus('idle');
        return [];
      }

      const currentAssets = knowledgeAssetsRef.current;
      setKnowledgeAssets(currentAssets);
      setKnowledgeCloudStatus('offline');
      return currentAssets;
    }
  }, []);

  const handleKnowledgeApiError = useCallback((error: unknown, fallback: string) => {
    const message = error instanceof Error ? error.message : fallback;
    if (error instanceof KnowledgeApiError && error.code === 'UNAUTHORIZED') {
      setAuthUser(null);
      setAuthStatus('unauthenticated');
      setAuthError(message);
      setKnowledgeAssets([]);
      setKnowledgeCloudStatus('idle');
      return;
    }
    setAuthError(message);
    throw error;
  }, []);

  // Add new knowledge asset to state
  const handleAddKnowledgeAsset = async (newAsset: Omit<KnowledgeAsset, 'id' | 'lastUpdated'>) => {
    try {
      const asset = curateKnowledgeAsset(await createRemoteKnowledgeAsset(newAsset));
      setKnowledgeAssets(prevAssets => {
        const nextAssets = [asset, ...prevAssets];
        saveKnowledgeAssets(nextAssets);
        return nextAssets;
      });
      setKnowledgeCloudStatus('online');
      setAuthError(null);
      return asset;
    } catch (error) {
      handleKnowledgeApiError(error, '新增知识卡片失败。');
      throw error;
    }
  };

  const handleUpdateKnowledgeAsset = async (updatedAsset: KnowledgeAsset) => {
    try {
      const savedAsset = curateKnowledgeAsset(await updateRemoteKnowledgeAsset(updatedAsset));
      setKnowledgeAssets(prevAssets => {
        const nextAssets = prevAssets.map(asset => (
          asset.id === savedAsset.id ? savedAsset : asset
        ));
        saveKnowledgeAssets(nextAssets);
        return nextAssets;
      });
      setKnowledgeCloudStatus('online');
      setAuthError(null);
      return savedAsset;
    } catch (error) {
      handleKnowledgeApiError(error, '更新知识卡片失败。');
      throw error;
    }
  };

  const handleImportKnowledgeAssets = async (newAssets: Array<Omit<KnowledgeAsset, 'id' | 'lastUpdated'>>) => {
    if (newAssets.length === 0) return { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };

    try {
      const result = await bulkImportKnowledgeAssets(newAssets);
      await refreshKnowledgeAssets();
      setAuthError(null);
      return result;
    } catch (error) {
      handleKnowledgeApiError(error, '导入知识卡片失败。');
      throw error;
    }
  };

  const handleBulkUpdateKnowledgeAssets = async (updatedAssets: KnowledgeAsset[]) => {
    try {
      const curatedAssets = curateKnowledgeAssets(updatedAssets);
      const result = await bulkPatchKnowledgeAssets({ assets: curatedAssets });
      await refreshKnowledgeAssets();
      setAuthError(null);
      return result;
    } catch (error) {
      handleKnowledgeApiError(error, '批量更新知识卡片失败。');
      throw error;
    }
  };

  const handleDeleteKnowledgeAsset = async (asset: KnowledgeAsset) => {
    try {
      const version = typeof (asset as KnowledgeAsset & { serverVersion?: unknown }).serverVersion === 'number'
        ? (asset as KnowledgeAsset & { serverVersion: number }).serverVersion
        : 0;
      await deleteRemoteKnowledgeAsset(asset.id, version);
      setKnowledgeAssets(prevAssets => {
        const nextAssets = prevAssets.filter(item => item.id !== asset.id);
        saveKnowledgeAssets(nextAssets);
        return nextAssets;
      });
      setAuthError(null);
    } catch (error) {
      handleKnowledgeApiError(error, '删除知识卡片失败。');
      throw error;
    }
  };

  const handleExportKnowledgeAssets = async () => {
    try {
      const assets = curateKnowledgeAssets(await exportRemoteKnowledgeAssets());
      setAuthError(null);
      return assets;
    } catch (error) {
      handleKnowledgeApiError(error, '导出知识卡片失败。');
      throw error;
    }
  };

  // Add new practice card to state
  const handleAddPracticeCard = (newCard: Omit<PracticeCard, 'id' | 'evidenceNo' | 'testDate'>) => {
    const card = createPracticeCard(newCard);
    setPracticeCards(prevCards => {
      const nextCards = [card, ...prevCards];
      savePracticeCards(nextCards);
      return nextCards;
    });
  };

  const navItems = [
    { id: 'toolkit', label: '前线销售作战箱', desc: 'Workbench', icon: Cpu },
    { id: 'knowledge', label: '知识云标答库', desc: 'Knowledge Cloud', icon: BookOpen },
    { id: 'practice', label: '可信云', desc: 'Trusted Cloud', icon: Database },
  ] as const;
  const trustedCloudModules = [
    { id: 'marketing', label: '营销可信', desc: 'Marketing Trust', icon: Megaphone },
    { id: 'delivery', label: '交付可信', desc: 'Delivery Trust', icon: Database },
  ] as const;
  const marketingTrustViews: Array<{ id: MarketingView; label: string; icon: React.ComponentType<{ className?: string }> }> = [
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

  const practiceSearchFor = (module: TrustedCloudModule, view: MarketingView = marketingTrustView) => (
    module === 'marketing'
      ? `?tab=practice&module=marketing&view=${view}`
      : '?tab=practice&module=delivery'
  );

  const handleMarketingTrustViewChange = (view: MarketingView) => {
    setMarketingTrustView(view);
    setTrustedCloudModule('marketing');
    setActiveTab('practice');
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', practiceSearchFor('marketing', view));
    }
  };

  useEffect(() => {
    if (isDevAuthRequested) return;
    let isMounted = true;

    const loadSession = async () => {
      try {
        const user = await getDuoCloudSession();
        if (!isMounted) return;

        setAuthUser(user);
        setAuthStatus(user ? 'authenticated' : 'unauthenticated');
      } catch (error) {
        if (!isMounted) return;

        const message = error instanceof Error ? error.message : '登录状态验证失败。';
        setAuthError(message);
        setAuthUser(null);
        setAuthStatus('unauthenticated');
      }
    };

    void loadSession();

    return () => {
      isMounted = false;
    };
  }, [isDevAuthRequested]);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    void refreshKnowledgeAssets();
  }, [authStatus, refreshKnowledgeAssets]);

  const handleSignIn = async (username: string, password: string) => {
    setIsSigningIn(true);
    setAuthError(null);

    try {
      const user = await signInToDuoCloud(username, password);
      setAuthUser(user);
      setAuthStatus('authenticated');
    } catch (error) {
      const message = error instanceof Error ? error.message : '登录失败。';
      setAuthUser(null);
      setAuthStatus('unauthenticated');
      setAuthError(message);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    setAuthError(null);

    try {
      await signOutOfDuoCloud();
      setAuthUser(null);
      setAuthError(null);
      setAuthStatus('unauthenticated');
      setKnowledgeAssets([]);
      setKnowledgeCloudStatus('idle');
      setIsMobileMenuOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : '退出登录失败。';
      setAuthError(message);
    }
  };

  if (authStatus === 'checking') {
    return (
      <div className="min-h-screen bg-background text-on-background flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <Workflow className="w-6 h-6" />
          </div>
          <div>
            <p className="text-lg font-bold text-primary">PINTE 品特</p>
            <p className="text-sm text-on-surface-variant">正在验证双云平台登入状态...</p>
          </div>
        </div>
      </div>
    );
  }

  if (authStatus !== 'authenticated' || !authUser) {
    return (
      <DuoCloudLogin
        isConfigured={true}
        isSigningIn={isSigningIn}
        error={authError}
        onSignIn={handleSignIn}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-background flex font-sans selection:bg-primary/10 selection:text-primary" id="app-container">
      
      {/* Sidebar Navigation - Fixed Desktop / Slidout Mobile */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 ${isSidebarCollapsed ? 'md:w-16 md:p-2' : 'md:w-64 md:p-4'} w-64 bg-surface-container-low border-r border-outline-variant flex flex-col justify-between p-4 transform transition-all duration-300 md:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        id="side-navigation"
      >
        <div className="space-y-1.5">
          {/* Logo Brand Header */}
          <div className={`flex items-center ${isSidebarCollapsed ? 'md:flex-col md:gap-2 justify-center' : 'justify-between'}`}>
            <div className={`flex items-center ${isSidebarCollapsed ? 'md:flex-col md:gap-2' : 'gap-4'}`}>
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-md shrink-0">
                <Workflow className="w-5 h-5" />
              </div>
              <div className={isSidebarCollapsed ? 'md:hidden' : 'block'}>
                <div className="text-lg font-bold text-primary tracking-tight leading-none">PINTE 品特</div>
                <div className="text-[11px] font-semibold text-on-surface-variant tracking-wider uppercase">烫金膜双云平台</div>
              </div>
            </div>
            {/* Close Mobile Menu */}
            <button 
              onClick={() => setIsMobileMenuOpen(false)} 
              className="md:hidden text-on-surface-variant hover:text-on-surface p-1.5 rounded-full hover:bg-surface-container-high"
            >
              <X className="w-5 h-5" />
            </button>
            
            {/* Collapse/Expand Toggle Button (only on desktop) */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={`hidden md:flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high w-8 h-8 rounded-lg transition-all ${
                isSidebarCollapsed ? 'mt-1' : ''
              }`}
              title={isSidebarCollapsed ? "展开导航栏" : "收起导航栏"}
              id="sidebar-toggle-btn"
            >
              {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          <div className="border-b border-outline-variant/50 my-2" />

          {/* Navigation Links */}
          <nav className="space-y-1.5" id="main-navigation-menu">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <div key={item.id}>
                  <button
                    onClick={() => {
                      setActiveTab(item.id);
                      if (typeof window !== 'undefined') {
                        const nextSearch = item.id === 'practice'
                          ? practiceSearchFor(trustedCloudModule)
                          : `?tab=${item.id}`;
                        window.history.replaceState(null, '', nextSearch);
                      }
                      if (item.id !== 'practice') {
                        setIsMobileMenuOpen(false);
                      }
                    }}
                    className={`w-full flex items-center transition-all duration-150 text-left ${
                      isSidebarCollapsed 
                        ? 'md:px-0 md:justify-center md:h-11 md:w-11 md:mx-auto gap-0 px-4 py-1.5 rounded-xl' 
                        : 'gap-4 px-4 py-1.5 rounded-xl'
                    } ${
                      isActive 
                        ? 'bg-primary text-white font-semibold shadow-md shadow-primary/15 md:translate-x-0' 
                        : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                    }`}
                    title={isSidebarCollapsed ? item.label : undefined}
                    id={`nav-${item.id}-btn`}
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-on-surface-variant/80'}`} />
                    <div className={isSidebarCollapsed ? 'md:hidden block' : 'block'}>
                      <div className="text-[13px] font-bold leading-none">{item.label}</div>
                      <div className={`text-[10px] mt-0.5 ${isActive ? 'text-white/70' : 'text-on-surface-variant/60 font-mono'}`}>
                        {item.desc}
                      </div>
                    </div>
                  </button>
                  {item.id === 'practice' && isActive && (
                    <div className={`mt-1.5 space-y-1 ${isSidebarCollapsed ? 'md:hidden' : 'pl-6'}`}>
                      {trustedCloudModules.map(module => {
                        const ModuleIcon = module.icon;
                        const moduleActive = trustedCloudModule === module.id;
                        return (
                          <div key={module.id} className="space-y-1">
                            <button
                              type="button"
                              onClick={() => {
                                setTrustedCloudModule(module.id);
                                setActiveTab('practice');
                                if (typeof window !== 'undefined') {
                                  window.history.replaceState(null, '', practiceSearchFor(module.id));
                                }
                                if (module.id === 'delivery') {
                                  setIsMobileMenuOpen(false);
                                }
                              }}
                              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                                moduleActive
                                  ? 'bg-primary/10 text-primary border border-primary/15'
                                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                              }`}
                              id={`nav-trusted-${module.id}-btn`}
                            >
                              <ModuleIcon className="w-4 h-4 shrink-0" />
                              <div className="min-w-0">
                                <div className="text-[12px] font-black leading-none">{module.label}</div>
                                <div className="text-[9px] font-mono opacity-60 mt-0.5">{module.desc}</div>
                              </div>
                            </button>
                            {module.id === 'marketing' && moduleActive && (
                              <div className="ml-4 space-y-0.5 border-l border-primary/15 pl-2">
                                {marketingTrustViews.map(view => {
                                  const ViewIcon = view.icon;
                                  const viewActive = marketingTrustView === view.id;
                                  return (
                                    <button
                                      key={view.id}
                                      type="button"
                                      onClick={() => {
                                        handleMarketingTrustViewChange(view.id);
                                        setIsMobileMenuOpen(false);
                                      }}
                                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-black transition ${
                                        viewActive
                                          ? 'bg-primary text-white shadow-sm shadow-primary/15'
                                          : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                                      }`}
                                      id={`nav-marketing-${view.id}-btn`}
                                    >
                                      <ViewIcon className="h-3.5 w-3.5 shrink-0" />
                                      <span className="truncate">{view.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Details */}
        <div className="space-y-2">
          <div className="border-b border-outline-variant/50" />

          <div className={`flex items-center ${isSidebarCollapsed ? 'md:justify-center md:p-1.5' : 'gap-3 p-2.5'} rounded-xl border border-outline-variant/60 bg-surface-container-high/60`}>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <UserRound className="w-4 h-4" />
            </div>
            <div className={`min-w-0 text-left ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>
              <p className="text-[11px] font-bold text-on-surface truncate">{authUser.username}</p>
              <p className="text-[10px] text-on-surface-variant/80 font-mono uppercase">{authUser.role}</p>
            </div>
          </div>

          <button
            onClick={() => {
              void handleSignOut();
            }}
            className={`w-full flex items-center rounded-xl border border-outline-variant/60 bg-surface-container-high/40 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition ${
              isSidebarCollapsed ? 'md:justify-center md:px-0 px-3 py-2.5' : 'gap-3 px-3 py-2.5'
            }`}
            title={isSidebarCollapsed ? '退出登录' : undefined}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className={`text-[11px] font-bold ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>退出登录</span>
          </button>
          
          <DifyChatbotLauncher isSidebarCollapsed={isSidebarCollapsed} />

          <div className={`text-[10px] text-on-surface-variant/60 leading-relaxed font-mono ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
              <span>实时双云引擎正常运转</span>
            </div>
            <p className="mt-1">© 2026 PINTE 品特双云平台</p>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile sidebar */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)} 
          className="fixed inset-0 bg-black/30 z-40 md:hidden" 
        />
      )}

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col ${isSidebarCollapsed ? 'md:ml-16' : 'md:ml-64'} min-w-0 transition-all duration-300 relative`} id="main-content-layout">
        
        {/* Floating Mobile Sidebar Toggle Button */}
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="md:hidden fixed top-3 left-3 z-40 bg-surface-container-low text-on-surface hover:text-primary p-2.5 rounded-xl border border-outline-variant/80 shadow-md hover:shadow-lg active:scale-95 transition-all"
          title="打开菜单"
          id="mobile-sidebar-toggle-floating"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Primary Viewport Pane */}
        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6" id="primary-viewport">
          {authError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {authError}
            </div>
          )}
          <Suspense fallback={<div className="h-full min-h-[360px] flex items-center justify-center text-sm font-bold text-on-surface-variant">正在加载双云工作台...</div>}>
            {activeTab === 'toolkit' && (
              <CombatToolkit 
                products={initialProducts} 
                practiceCards={practiceCards} 
              />
            )}
            {activeTab === 'knowledge' && (
              <KnowledgeCloud 
                assets={knowledgeAssets} 
                onAddAsset={handleAddKnowledgeAsset}
                onUpdateAsset={handleUpdateKnowledgeAsset}
                onImportAssets={handleImportKnowledgeAssets}
                onBulkUpdateAssets={handleBulkUpdateKnowledgeAssets}
                onDeleteAsset={handleDeleteKnowledgeAsset}
                onExportAssets={handleExportKnowledgeAssets}
                currentUser={authUser}
                isOffline={knowledgeCloudStatus === 'offline'}
                isSyncing={knowledgeCloudStatus === 'loading'}
                onRefreshAssets={refreshKnowledgeAssets}
                isAppSidebarCollapsed={isSidebarCollapsed}
              />
            )}
            {activeTab === 'practice' && (
              <PracticeCloud 
                module={trustedCloudModule}
                marketingView={marketingTrustView}
                cards={practiceCards} 
                knowledgeAssets={knowledgeAssets}
                onAddCard={handleAddPracticeCard} 
                onMarketingViewChange={handleMarketingTrustViewChange}
              />
            )}
          </Suspense>
        </main>

        {/* Minimalized Footer info bar */}
        <footer className="h-8 bg-surface-container-low border-t border-outline-variant/85 px-1.5 flex justify-between items-center text-[10px] text-on-surface-variant/80 shrink-0 select-none font-mono">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-4 text-emerald-600 font-bold">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block animate-pulse" />
              双云工业协同引擎联调合格
            </span>
            <span className="hidden sm:inline">|</span>
            <span className="hidden sm:inline">实时响应响应时效提高98%</span>
          </div>
          <div>
            <span>双云精工作战规范 V1.2.0 © 2026</span>
          </div>
        </footer>

      </div>

    </div>
  );
}
