/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { 
  BookOpen, 
  Database, 
  Cpu, 
  Workflow, 
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  LogOut,
  UserRound
} from 'lucide-react';

// Shared data and types
import { initialProducts, initialPracticeCards, initialKnowledgeAssets } from './data/mockData';
import { obsidianKnowledgeAssets } from './data/obsidianKnowledgeAssets';
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

const CombatToolkit = lazy(() => import('./components/CombatToolkit'));
const KnowledgeCloud = lazy(() => import('./components/KnowledgeCloud'));
const PracticeCloud = lazy(() => import('./components/PracticeCloud'));

const seededKnowledgeAssets = curateKnowledgeAssets([...obsidianKnowledgeAssets, ...initialKnowledgeAssets]);

function loadLocalKnowledgeFallback() {
  return curateKnowledgeAssets(loadKnowledgeAssets(seededKnowledgeAssets));
}

export default function App() {
  // Read tab parameter from URL query string
  const queryParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const urlTab = queryParams.get('tab');
  const initialTab = (urlTab === 'toolkit' || urlTab === 'knowledge' || urlTab === 'practice') ? urlTab : 'toolkit';

  const [activeTab, setActiveTab] = useState<'toolkit' | 'knowledge' | 'practice'>(initialTab);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [knowledgeCloudStatus, setKnowledgeCloudStatus] = useState<'idle' | 'loading' | 'online' | 'offline'>('idle');
  
  // App-level state for persistent live sandbox interaction
  const [knowledgeAssets, setKnowledgeAssets] = useState<KnowledgeAsset[]>(loadLocalKnowledgeFallback);
  const [practiceCards, setPracticeCards] = useState<PracticeCard[]>(() => loadPracticeCards(initialPracticeCards));

  const refreshKnowledgeAssets = useCallback(async () => {
    setKnowledgeCloudStatus('loading');
    setKnowledgeAssets(loadLocalKnowledgeFallback());

    try {
      const remoteAssets = curateKnowledgeAssets(await listKnowledgeAssets());
      setKnowledgeAssets(remoteAssets);
      saveKnowledgeAssets(remoteAssets);
      setKnowledgeCloudStatus('online');
    } catch (error) {
      if (error instanceof KnowledgeApiError && error.code === 'UNAUTHORIZED') {
        setAuthUser(null);
        setAuthStatus('unauthenticated');
        setAuthError(error.message);
        setKnowledgeAssets([]);
        setKnowledgeCloudStatus('idle');
        return;
      }

      setKnowledgeAssets(loadLocalKnowledgeFallback());
      setKnowledgeCloudStatus('offline');
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
    { id: 'practice', label: '实践云证据卡', desc: 'Practice Cloud', icon: Database },
  ] as const;

  useEffect(() => {
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
  }, []);

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
            <p className="text-lg font-bold text-primary">Double Cloud</p>
            <p className="text-sm text-on-surface-variant">正在验证知识云登入状态...</p>
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
                <div className="text-lg font-bold text-primary tracking-tight leading-none">Double Cloud</div>
                <div className="text-[11px] font-semibold text-on-surface-variant tracking-wider uppercase">Industrial OS</div>
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
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
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
          
          <div className={`flex items-center ${isSidebarCollapsed ? 'md:justify-center md:p-1' : 'gap-4 p-2.5'} rounded-xl bg-surface-container-high/60`}>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
              M1
            </div>
            <div className={`text-left ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>
              <p className="text-[11px] font-bold text-on-surface">外贸精工系统</p>
              <p className="text-[10px] text-on-surface-variant/80 font-mono">Enterprise v1.2</p>
            </div>
          </div>

          <div className={`text-[10px] text-on-surface-variant/60 leading-relaxed font-mono ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
              <span>实时双云引擎正常运转</span>
            </div>
            <p className="mt-1">© 2026 Double Cloud OS</p>
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
                onRefreshAssets={refreshKnowledgeAssets}
                isAppSidebarCollapsed={isSidebarCollapsed}
              />
            )}
            {activeTab === 'practice' && (
              <PracticeCloud 
                cards={practiceCards} 
                knowledgeAssets={knowledgeAssets}
                onAddCard={handleAddPracticeCard} 
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
