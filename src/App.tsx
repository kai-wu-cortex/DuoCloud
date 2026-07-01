/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useState } from 'react';
import { 
  BookOpen, 
  Database, 
  Cpu, 
  Settings,
  Workflow, 
  Menu,
  X,
  FileText,
  User,
  ExternalLink,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

// Shared data and types
import { initialProducts, initialPracticeCards, initialKnowledgeAssets } from './data/mockData';
import { obsidianKnowledgeAssets } from './data/obsidianKnowledgeAssets';
import { KnowledgeAsset, PracticeCard } from './types';
import {
  createKnowledgeAsset,
  createPracticeCard,
  formatLocalDate,
  loadKnowledgeAssets,
  loadPracticeCards,
  saveKnowledgeAssets,
  savePracticeCards,
} from './lib/appState';
import { curateKnowledgeAsset, curateKnowledgeAssets } from './lib/knowledgeCuration';

const CombatToolkit = lazy(() => import('./components/CombatToolkit'));
const KnowledgeCloud = lazy(() => import('./components/KnowledgeCloud'));
const PracticeCloud = lazy(() => import('./components/PracticeCloud'));

const seededKnowledgeAssets = curateKnowledgeAssets([...obsidianKnowledgeAssets, ...initialKnowledgeAssets]);

export default function App() {
  // Read tab parameter from URL query string
  const queryParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const urlTab = queryParams.get('tab');
  const initialTab = (urlTab === 'toolkit' || urlTab === 'knowledge' || urlTab === 'practice') ? urlTab : 'toolkit';

  const [activeTab, setActiveTab] = useState<'toolkit' | 'knowledge' | 'practice'>(initialTab);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // App-level state for persistent live sandbox interaction
  const [knowledgeAssets, setKnowledgeAssets] = useState<KnowledgeAsset[]>(() => curateKnowledgeAssets(loadKnowledgeAssets(seededKnowledgeAssets)));
  const [practiceCards, setPracticeCards] = useState<PracticeCard[]>(() => loadPracticeCards(initialPracticeCards));

  // Add new knowledge asset to state
  const handleAddKnowledgeAsset = (newAsset: Omit<KnowledgeAsset, 'id' | 'lastUpdated'>) => {
    const asset = curateKnowledgeAsset(createKnowledgeAsset(newAsset));
    setKnowledgeAssets(prevAssets => {
      const nextAssets = [asset, ...prevAssets];
      saveKnowledgeAssets(nextAssets);
      return nextAssets;
    });
  };

  const handleUpdateKnowledgeAsset = (updatedAsset: KnowledgeAsset) => {
    const today = formatLocalDate();
    const assetWithUpdatedDate = curateKnowledgeAsset({
      ...updatedAsset,
      lastUpdated: today,
      localEditedAt: today,
    } as KnowledgeAsset);

    setKnowledgeAssets(prevAssets => {
      const nextAssets = prevAssets.map(asset => (
        asset.id === assetWithUpdatedDate.id ? assetWithUpdatedDate : asset
      ));
      saveKnowledgeAssets(nextAssets);
      return nextAssets;
    });
  };

  const handleImportKnowledgeAssets = (newAssets: Array<Omit<KnowledgeAsset, 'id' | 'lastUpdated'>>) => {
    if (newAssets.length === 0) return;

    const importSeed = Date.now().toString().slice(-6);
    setKnowledgeAssets(prevAssets => {
      const importedAssets = newAssets.map((asset, index) => curateKnowledgeAsset(createKnowledgeAsset(asset, {
        idSeed: `IMP-${importSeed}-${index.toString(36).toUpperCase()}`,
      })));
      const nextAssets = [...importedAssets, ...prevAssets];
      saveKnowledgeAssets(nextAssets);
      return nextAssets;
    });
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
