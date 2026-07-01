import type { KnowledgeAsset, PracticeCard } from '../types';
import type { EvidencePage, EvidenceSection } from './evidencePages';

export function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeFilePart(value: string) {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() || '打样排版对账报告';
}

export function getEvidenceReportDownloadName(page: EvidencePage, card: PracticeCard) {
  return `${sanitizeFilePart(page.name)}_打样对账画册_${sanitizeFilePart(card.sku)}.html`;
}

function renderProcessItem(item: string) {
  const separator = item.includes('：') ? '：' : ':';
  const parts = item.split(separator);

  if (parts.length > 1) {
    const label = parts.shift() ?? '';
    const content = parts.join(separator);
    return `
      <li class="flex items-start text-sm text-slate-700">
        <span class="bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-0.5 rounded text-[11px] mr-2.5 border border-indigo-100 shrink-0 font-mono">${escapeHtml(label)}</span>
        <span class="leading-relaxed">${escapeHtml(content)}</span>
      </li>
    `;
  }

  return `<li class="text-sm text-slate-700 list-disc list-inside leading-relaxed">${escapeHtml(item)}</li>`;
}

function renderSection(section: EvidenceSection, card: PracticeCard, referencedAssets: KnowledgeAsset[]) {
  if (section.type === 'header') {
    return `
      <div class="mb-10 pb-6 border-b-2 border-slate-100">
        <h1 class="text-3xl font-black text-slate-900 tracking-tight mb-3">${escapeHtml(section.title)}</h1>
        <p class="text-sm text-slate-500 leading-relaxed max-w-2xl">${escapeHtml(section.content)}</p>
      </div>
    `;
  }

  if (section.type === 'text') {
    return `
      <div class="mb-8">
        <h3 class="text-lg font-bold text-slate-800 mb-3 border-l-4 border-indigo-500 pl-3">${escapeHtml(section.title)}</h3>
        <p class="text-sm text-slate-650 leading-relaxed whitespace-pre-line">${escapeHtml(section.content)}</p>
      </div>
    `;
  }

  if (section.type === 'process_data') {
    const items = section.listItems?.map(renderProcessItem).join('') || '';
    return `
      <div class="mb-8 bg-slate-50/70 p-6 rounded-xl border border-slate-200/60">
        <h3 class="text-base font-bold text-slate-900 mb-2">${escapeHtml(section.title)}</h3>
        <p class="text-xs text-slate-400 mb-4 font-medium">${escapeHtml(section.content)}</p>
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
          <h3 class="text-base font-bold text-slate-900">${escapeHtml(section.title)}</h3>
          <span class="text-[10px] font-mono uppercase ${typeBg} px-2.5 py-0.5 rounded-full font-extrabold tracking-wider">${typeLabel}</span>
        </div>
        <div class="rounded-xl overflow-hidden border border-slate-200 bg-slate-950 flex justify-center items-center shadow-sm" style="height: 320px;">
          <img src="${escapeHtml(mediaUrl)}" alt="${escapeHtml(section.title)}" class="w-full h-full object-cover" referrerpolicy="no-referrer" />
        </div>
        ${section.content ? `<p class="text-xs text-slate-500 italic mt-2.5 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">${escapeHtml(section.content)}</p>` : ''}
      </div>
    `;
  }

  if (section.type === 'metrics_table') {
    return `
      <div class="mb-8">
        <h3 class="text-base font-bold text-slate-900 mb-3">${escapeHtml(section.title)}</h3>
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
                <td class="py-3.5 px-4 text-center font-bold text-slate-800 font-mono">${card.results.clearness}/5</td>
                <td class="py-3.5 px-4 text-right"><span class="text-[11px] font-bold bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded-full border border-emerald-150">PASS 通过</span></td>
              </tr>
              <tr>
                <td class="py-3.5 px-4 text-slate-700 font-medium">3M胶带粘附力测试 (Adhesion Test)</td>
                <td class="py-3.5 px-4 text-center font-bold text-slate-800 font-mono">${card.results.adhesion}/5</td>
                <td class="py-3.5 px-4 text-right"><span class="text-[11px] font-bold bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded-full border border-emerald-150">PASS 通过</span></td>
              </tr>
              <tr>
                <td class="py-3.5 px-4 text-slate-700 font-medium">表面金属光泽饱满度 (Gloss level)</td>
                <td class="py-3.5 px-4 text-center font-bold text-slate-800 font-mono">${card.results.gloss}/5</td>
                <td class="py-3.5 px-4 text-right"><span class="text-[11px] font-bold bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded-full border border-emerald-150">PASS 通过</span></td>
              </tr>
              <tr>
                <td class="py-3.5 px-4 text-slate-700 font-medium">耐摩擦抗刮擦等级 (Abrasion level)</td>
                <td class="py-3.5 px-4 text-center font-bold text-slate-800 font-mono">${card.results.abrasion}/5</td>
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
        <h4 class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">${escapeHtml(section.title)}</h4>
        <p class="text-sm italic text-slate-700 leading-relaxed font-semibold">"${escapeHtml(section.content)}"</p>
      </div>
    `;
  }

  if (section.type === 'knowledge_refs') {
    const refItems = referencedAssets.map(asset => `
      <div class="border border-slate-200/80 rounded-xl p-4 bg-white shadow-3xs">
        <div class="text-[9px] font-bold uppercase tracking-wider text-indigo-500 mb-1">${escapeHtml(asset.category.replace('_', ' '))}</div>
        <div class="text-xs font-extrabold text-slate-800 leading-snug mb-1">${escapeHtml(asset.title)}</div>
        <div class="text-[9px] text-slate-400 font-mono">ID: ${escapeHtml(asset.id)} • 更新时间: ${escapeHtml(asset.lastUpdated)}</div>
      </div>
    `).join('') || `
      <div class="col-span-2 text-center py-8 text-xs text-slate-400 border border-dashed border-slate-250 rounded-xl bg-slate-50/50">
        暂无关联文献。
      </div>
    `;

    return `
      <div class="mb-8">
        <h3 class="text-base font-bold text-slate-900 mb-3">${escapeHtml(section.title)}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${refItems}
        </div>
      </div>
    `;
  }

  return '';
}

interface EvidenceReportOptions {
  page: EvidencePage;
  card: PracticeCard;
  referencedAssets: KnowledgeAsset[];
  exportDate: string;
}

export function createEvidenceReportHtml({ page, card, referencedAssets, exportDate }: EvidenceReportOptions) {
  const sectionsHtml = page.sections
    .map(section => renderSection(section, card, referencedAssets))
    .join('');
  const pageTitle = escapeHtml(page.name);
  const sku = escapeHtml(card.sku);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>${pageTitle} - ${sku} 烫金打样与技术证据报告</title>
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
          <h1 class="text-sm font-black tracking-tight">${sku} 工艺证据卡离线高保真浏览器</h1>
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
          <span class="text-[10px] text-slate-400 font-mono">报告编号: ${escapeHtml(card.evidenceNo)}</span>
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
          导出于: ${escapeHtml(exportDate)}
        </div>
      </div>

    </div>
  </div>

</body>
</html>`;
}
