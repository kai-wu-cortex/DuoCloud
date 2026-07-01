import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, BookOpen, Plus, Tag, Calendar, User, Filter, Sliders, DollarSign, ShieldAlert, Truck, MessageSquare, Layers, X, PlusCircle, CheckCircle2,
  Box, Puzzle, BookText, AlertTriangle, HelpCircle, MoreHorizontal, FileText, Video,
  LayoutGrid, List as ListIcon, Folder, Sparkles, Pencil,
  Bold, Italic, Underline, Link, Image as ImageIcon, Paperclip, ExternalLink, Upload, Download, Code2, Eye, Maximize2, Save, RotateCcw, Trash2
} from 'lucide-react';
import { KnowledgeAsset, KnowledgeTableType } from '../types';
import { formatLocalDate } from '../lib/appState';
import { getKnowledgeCardClickState } from '../lib/knowledgeSelection';
import {
  buildKnowledgeAssetDraft,
  createInitialKnowledgeFields,
  getKnowledgeFieldSchema,
  markdownToKnowledgeHtml,
  renderKnowledgeRichText,
  validateKnowledgeAssetDraft,
} from '../lib/knowledgeFieldSchemas';
import {
  exportKnowledgeAssetsWorkbook,
  parseKnowledgeImportWorkbook,
} from '../lib/knowledgeImportExport';
import { getKnowledgePreviewText } from '../lib/knowledgePreview';
import { DEFAULT_MARKDOWN_EDITOR_MODE, getMarkdownEditorModeValue, type MarkdownEditorMode } from '../lib/markdownEditorModes';
import type { AuthUser } from '../lib/authApi';
import { uploadKnowledgeAttachment, type KnowledgeApiBulkResult, type KnowledgeAttachmentUploadResult } from '../lib/knowledgeApi';

interface KnowledgeCloudProps {
  assets: KnowledgeAsset[];
  onAddAsset: (newAsset: Omit<KnowledgeAsset, 'id' | 'lastUpdated'>) => Promise<KnowledgeAsset>;
  onUpdateAsset: (asset: KnowledgeAsset) => Promise<KnowledgeAsset>;
  onImportAssets?: (newAssets: Array<Omit<KnowledgeAsset, 'id' | 'lastUpdated'>>) => Promise<KnowledgeApiBulkResult>;
  onBulkUpdateAssets: (assets: KnowledgeAsset[]) => Promise<KnowledgeApiBulkResult>;
  onDeleteAsset: (asset: KnowledgeAsset) => Promise<void>;
  onExportAssets: () => Promise<KnowledgeAsset[]>;
  currentUser: AuthUser;
  isOffline: boolean;
  isSyncing?: boolean;
  onRefreshAssets: () => Promise<KnowledgeAsset[] | void>;
  isAppSidebarCollapsed?: boolean;
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

const GRID_BATCH_SIZE = 180;
const LIST_BATCH_SIZE = 120;

interface DirectoryTreeNode {
  name: string;
  path: string;
  count: number;
  children: DirectoryTreeNode[];
}

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

function getAssetDirectoryParts(asset: KnowledgeAsset) {
  const fromFields = [asset.directoryLevel1, asset.directoryLevel2, asset.directoryLevel3].filter(Boolean) as string[];
  if (fromFields.length > 0) return fromFields;
  if (!asset.sourcePath) return [];
  return asset.sourcePath.split('/').slice(0, -1).filter(Boolean).slice(0, 3);
}

function getAssetDirectoryPath(asset: KnowledgeAsset) {
  return getAssetDirectoryParts(asset).join('/');
}

function buildDirectoryTree(assets: KnowledgeAsset[]) {
  const roots: DirectoryTreeNode[] = [];
  const nodes = new Map<string, DirectoryTreeNode>();

  for (const asset of assets) {
    const parts = getAssetDirectoryParts(asset).slice(0, 3);
    let parentPath = '';
    for (const part of parts) {
      const path = parentPath ? `${parentPath}/${part}` : part;
      let node = nodes.get(path);
      if (!node) {
        node = { name: part, path, count: 0, children: [] };
        nodes.set(path, node);
        if (parentPath) nodes.get(parentPath)?.children.push(node);
        else roots.push(node);
      }
      node.count += 1;
      parentPath = path;
    }
  }

  return roots.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-Hans-CN'));
}

function directoryMatches(asset: KnowledgeAsset, activeDirectoryPath: string) {
  if (!activeDirectoryPath) return true;
  const directoryPath = getAssetDirectoryPath(asset);
  return directoryPath === activeDirectoryPath || directoryPath.startsWith(`${activeDirectoryPath}/`);
}

function buildAssetSearchText(asset: KnowledgeAsset) {
  return Object.values(asset)
    .flatMap(value => Array.isArray(value) ? value : [value])
    .filter(value => value != null)
    .join(' ')
    .toLowerCase();
}

type KnowledgeDetailTab = 'info' | 'attachments';

interface KnowledgeAttachmentItem {
  id: string;
  type: 'image' | 'link' | 'source' | 'practice' | 'file';
  label: string;
  href?: string;
  previewSrc?: string;
  meta: string;
}

function getFileNameFromPath(path: string) {
  return decodeURIComponent(path.split(/[\\/]/).filter(Boolean).at(-1) || path);
}

function cleanAttachmentToken(value: string) {
  return value
    .replace(/[`*_~\]|）)\s]+$/g, '')
    .replace(/^[`*_~\s（(]+/g, '')
    .trim();
}

function isImageAttachmentUrl(value: string) {
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?.*)?$/i.test(value);
}

function isOpenableAttachmentUrl(value: string) {
  if (/^obsidian:/i.test(value)) return false;
  if (/internal-api-drive-stream\.feishu\.cn/i.test(value)) return false;
  return /^(https?:\/\/|\/|data:image\/)/i.test(value);
}

function isDisplayableAttachmentLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  if (['obsidia', 'obsidian', 'undefined', 'null'].includes(normalized)) return false;
  return true;
}

function collectKnowledgeAttachments(asset: KnowledgeAsset): KnowledgeAttachmentItem[] {
  const attachments: KnowledgeAttachmentItem[] = [];
  const seen = new Set<string>();
  const addAttachment = (item: Omit<KnowledgeAttachmentItem, 'id'>) => {
    if (!isDisplayableAttachmentLabel(item.label)) return;
    const previewSrc = item.previewSrc && isOpenableAttachmentUrl(item.previewSrc) ? item.previewSrc : undefined;
    const href = item.href && (item.href.startsWith('/evidence/') || isOpenableAttachmentUrl(item.href)) ? item.href : undefined;
    if (!previewSrc && !href) return;
    const key = `${item.type}:${href || previewSrc || item.label}`;
    if (seen.has(key)) return;
    seen.add(key);
    attachments.push({ ...item, href, previewSrc, id: key });
  };

  const searchableValues = Object.entries(asset)
    .filter(([key, value]) => key !== 'id' && key !== 'tags' && typeof value === 'string')
    .map(([key, value]) => ({ key, value: String(value || '') }))
    .filter(item => item.value.trim().length > 0);

  for (const { key, value } of searchableValues) {
    const imageTagPattern = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
    let imageMatch: RegExpExecArray | null;
    while ((imageMatch = imageTagPattern.exec(value)) !== null) {
      const fullTag = imageMatch[0];
      const src = cleanAttachmentToken(imageMatch[1]);
      if (!src) continue;
      const alt = fullTag.match(/\balt=["']([^"']*)["']/i)?.[1]?.trim();
      addAttachment({
        type: 'image',
        label: alt || getFileNameFromPath(src),
        href: src,
        previewSrc: src,
        meta: key === 'content' ? '详细描述图片' : `字段图片：${key}`,
      });
    }

    const markdownImagePattern = /!\[([^\]]*)]\(([^)]+)\)/g;
    let markdownImageMatch: RegExpExecArray | null;
    while ((markdownImageMatch = markdownImagePattern.exec(value)) !== null) {
      const src = cleanAttachmentToken(markdownImageMatch[2]);
      if (!src) continue;
      addAttachment({
        type: 'image',
        label: markdownImageMatch[1]?.trim() || getFileNameFromPath(src),
        href: src,
        previewSrc: src,
        meta: key === 'content' ? 'Markdown 图片' : `字段 Markdown 图片：${key}`,
      });
    }

    const urlPattern = /https?:\/\/[^\s<>"'，。；、)）]+/gi;
    let urlMatch: RegExpExecArray | null;
    while ((urlMatch = urlPattern.exec(value)) !== null) {
      const href = cleanAttachmentToken(urlMatch[0]);
      if (!href) continue;
      if (!isImageAttachmentUrl(href)) continue;
      addAttachment({
        type: 'image',
        label: getFileNameFromPath(href),
        href,
        previewSrc: href,
        meta: key === 'content' ? '详细描述链接' : `字段链接：${key}`,
      });
    }

    const practicePattern = /\bSY-\d{4}-[A-Z0-9-]+\b/g;
    let practiceMatch: RegExpExecArray | null;
    while ((practiceMatch = practicePattern.exec(value)) !== null) {
      addAttachment({
        type: 'practice',
        label: practiceMatch[0],
        href: `/evidence/${practiceMatch[0]}`,
        meta: '关联实践云证据卡',
      });
    }

    const fileHintPattern = /(?:附件|原始文件|重命名文件|OCR文本|导入文件)\s*[：:|]\s*([^|\n<]+?\.(?:txt|pdf|xlsx?|docx?|pptx?|png|jpe?g|webp|gif|yml|yaml|md))/gi;
    let fileHintMatch: RegExpExecArray | null;
    while ((fileHintMatch = fileHintPattern.exec(value)) !== null) {
      const label = cleanAttachmentToken(fileHintMatch[1]);
      if (!label) continue;
      addAttachment({
        type: isImageAttachmentUrl(label) ? 'image' : 'file',
        label: getFileNameFromPath(label),
        href: isOpenableAttachmentUrl(label) ? label : undefined,
        previewSrc: isImageAttachmentUrl(label) ? label : undefined,
        meta: `知识正文附件线索：${key}`,
      });
    }
  }

  return attachments;
}

interface RichKnowledgeEditorProps {
  id: string;
  value: string;
  placeholder?: string;
  minHeight?: string;
  onChange: (value: string) => void;
  uploadContext?: {
    assetId?: string;
    fieldName?: string;
  };
  onUploadAttachment?: (
    file: File,
    context: { assetId?: string; fieldName?: string; kind: 'image' | 'file' },
  ) => Promise<KnowledgeAttachmentUploadResult>;
  onUploadError?: (message: string) => void;
}

function RichKnowledgeEditor({
  id,
  value,
  placeholder,
  minHeight = 'min-h-[92px]',
  onChange,
  uploadContext,
  onUploadAttachment,
  onUploadError,
}: RichKnowledgeEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fullscreenEditorRef = useRef<HTMLDivElement | null>(null);
  const previewEditorRef = useRef<HTMLDivElement | null>(null);
  const fullscreenPreviewEditorRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fullscreenTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const isComposingRef = useRef(false);
  const [editorMode, setEditorMode] = useState<MarkdownEditorMode>(DEFAULT_MARKDOWN_EDITOR_MODE);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [uploadingKind, setUploadingKind] = useState<'image' | 'file' | null>(null);
  const draftKey = `duocloud:knowledge-editor-draft:${id}`;
  const hasRichMarkup = (html: string) => /<(b|strong|i|em|u|a|img|ul|ol|li|table|thead|tbody|tr|th|td|h[1-6]|pre|code|blockquote)\b/i.test(html);
  const hasMarkdownSyntax = (text: string) => /(^|\n)\s{0,3}(#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s+|```|\|.+\|)|!\[[^\]]*]\([^)]+\)|\[[^\]]+]\([^)]+\)|\*\*[^*]+\*\*|__[^_]+__|`[^`]+`/.test(text);

  useEffect(() => {
    const renderedPreview = getMarkdownEditorModeValue(value, 'preview');
    const editors = [
      { node: editorRef.current, html: value, mode: 'rich' },
      { node: fullscreenEditorRef.current, html: value, mode: 'rich' },
      { node: previewEditorRef.current, html: renderedPreview, mode: 'preview' },
      { node: fullscreenPreviewEditorRef.current, html: renderedPreview, mode: 'preview' },
    ];

    for (const editor of editors) {
      if (!editor.node || editorMode !== editor.mode || document.activeElement === editor.node || isComposingRef.current) continue;
      if (editor.node.innerHTML !== editor.html) editor.node.innerHTML = editor.html;
    }
  }, [editorMode, value, isFullscreen]);

  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(draftKey);
      if (!rawDraft) {
        setDraftSavedAt(null);
        return;
      }
      const parsed = JSON.parse(rawDraft) as { savedAt?: number };
      setDraftSavedAt(parsed.savedAt ? new Date(parsed.savedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '已保存');
    } catch {
      setDraftSavedAt(null);
    }
  }, [draftKey]);

  const syncFromEditor = () => {
    const editor =
      document.activeElement === fullscreenEditorRef.current ? fullscreenEditorRef.current :
      document.activeElement === previewEditorRef.current ? previewEditorRef.current :
      document.activeElement === fullscreenPreviewEditorRef.current ? fullscreenPreviewEditorRef.current :
      editorRef.current;
    onChange(editor?.innerHTML ?? '');
  };

  const getActiveTextarea = () => (
    document.activeElement === fullscreenTextareaRef.current ? fullscreenTextareaRef.current : textareaRef.current
  );

  const applyMarkdownWrap = (before: string, after = before, fallback = '文本') => {
    const textarea = getActiveTextarea();
    if (!textarea) {
      onChange(`${value}${before}${fallback}${after}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.slice(start, end) || fallback;
    const nextValue = `${value.slice(0, start)}${before}${selectedText}${after}${value.slice(end)}`;
    onChange(nextValue);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    });
  };

  const insertMarkdownAtCursor = (snippet: string) => {
    const textarea = getActiveTextarea();
    if (!textarea) {
      onChange(`${value}${value ? '\n' : ''}${snippet}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextValue = `${value.slice(0, start)}${snippet}${value.slice(end)}`;
    onChange(nextValue);
    window.requestAnimationFrame(() => {
      textarea.focus();
      const nextCursor = start + snippet.length;
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const applyCommand = (command: string, commandValue?: string) => {
    if (editorMode === 'code') {
      if (command === 'bold') applyMarkdownWrap('**');
      if (command === 'italic') applyMarkdownWrap('*');
      if (command === 'underline') applyMarkdownWrap('<u>', '</u>');
      if (command === 'createLink' && commandValue) applyMarkdownWrap('[', `](${commandValue})`, '链接文本');
      if (command === 'insertImage' && commandValue) applyMarkdownWrap('![', `](${commandValue})`, '图片描述');
      return;
    }
    document.execCommand(command, false, commandValue);
    syncFromEditor();
  };

  const escapeHtml = (text: string) => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const insertAttachmentMarkup = (
    upload: KnowledgeAttachmentUploadResult,
    kind: 'image' | 'file',
  ) => {
    const label = upload.fileName || (kind === 'image' ? '图片' : '附件');
    if (editorMode === 'code') {
      const markdown = kind === 'image'
        ? `![${label}](${upload.url})`
        : `[${label}](${upload.url})`;
      insertMarkdownAtCursor(markdown);
      return;
    }

    const safeLabel = escapeHtml(label);
    const safeUrl = escapeHtml(upload.url);
    const html = kind === 'image'
      ? `<img src="${safeUrl}" alt="${safeLabel}" />`
      : `<a href="${safeUrl}" target="_blank" rel="noreferrer">${safeLabel}</a>`;
    document.execCommand('insertHTML', false, html);
    syncFromEditor();
  };

  const insertLink = () => {
    const url = window.prompt('输入链接 URL');
    if (!url) return;
    applyCommand('createLink', url);
  };

  const insertImage = () => {
    if (onUploadAttachment) {
      imageInputRef.current?.click();
      return;
    }
    const url = window.prompt('输入图片 URL');
    if (!url) return;
    applyCommand('insertImage', url);
  };

  const handleAttachmentUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    kind: 'image' | 'file',
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !onUploadAttachment || uploadingKind) return;

    setUploadingKind(kind);
    try {
      const upload = await onUploadAttachment(file, {
        assetId: uploadContext?.assetId,
        fieldName: uploadContext?.fieldName ?? id,
        kind,
      });
      insertAttachmentMarkup(upload, kind === 'image' || upload.contentType.startsWith('image/') ? 'image' : 'file');
    } catch (error) {
      onUploadError?.(error instanceof Error ? error.message : '附件上传失败');
    } finally {
      setUploadingKind(null);
    }
  };

  const applyMarkdown = () => {
    if (editorMode === 'code') {
      onChange(markdownToKnowledgeHtml(value));
      setEditorMode('preview');
      return;
    }
    const editor =
      document.activeElement === fullscreenEditorRef.current ? fullscreenEditorRef.current :
      document.activeElement === previewEditorRef.current ? previewEditorRef.current :
      document.activeElement === fullscreenPreviewEditorRef.current ? fullscreenPreviewEditorRef.current :
      editorRef.current;
    if (!editor) return;
    const rawValue = editor.innerText || editor.textContent || editor.innerHTML;
    const rendered = markdownToKnowledgeHtml(rawValue);
    editor.innerHTML = rendered;
    onChange(rendered);
  };

  const saveDraft = () => {
    const savedAt = Date.now();
    try {
      window.localStorage.setItem(draftKey, JSON.stringify({ value, savedAt }));
      setDraftSavedAt(new Date(savedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      setDraftSavedAt('保存失败');
    }
  };

  const restoreDraft = () => {
    try {
      const rawDraft = window.localStorage.getItem(draftKey);
      if (!rawDraft) return;
      const parsed = JSON.parse(rawDraft) as { value?: string; savedAt?: number };
      if (typeof parsed.value !== 'string') return;
      onChange(parsed.value);
      if (parsed.savedAt) {
        setDraftSavedAt(new Date(parsed.savedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
      }
    } catch {
      setDraftSavedAt(null);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const text = event.clipboardData.getData('text/plain');
    if (!text) return;
    event.preventDefault();
    document.execCommand('insertHTML', false, markdownToKnowledgeHtml(text));
    syncFromEditor();
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const editor = event.currentTarget;
    const rawValue = editor.innerText || editor.textContent || editor.innerHTML;
    if (hasRichMarkup(editor.innerHTML) || !hasMarkdownSyntax(rawValue)) {
      onChange(editor.innerHTML);
      return;
    }

    const rendered = markdownToKnowledgeHtml(rawValue);
    if (rendered !== editor.innerHTML) {
      editor.innerHTML = rendered;
      onChange(rendered);
      return;
    }
    onChange(editor.innerHTML);
  };

  const renderToolbar = (compact = false) => (
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-outline-variant/60 bg-surface-container-low">
        <button type="button" title="加粗" onClick={() => applyCommand('bold')} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-primary transition cursor-pointer">
          <Bold className="w-4 h-4" />
        </button>
        <button type="button" title="斜体" onClick={() => applyCommand('italic')} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-primary transition cursor-pointer">
          <Italic className="w-4 h-4" />
        </button>
        <button type="button" title="下划线" onClick={() => applyCommand('underline')} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-primary transition cursor-pointer">
          <Underline className="w-4 h-4" />
        </button>
        <span className="h-5 w-px bg-outline-variant/70 mx-1 shrink-0" />
        <button type="button" title="插入链接" onClick={insertLink} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-primary transition cursor-pointer">
          <Link className="w-4 h-4" />
        </button>
        <button type="button" title={onUploadAttachment ? '上传并插入图片' : '插入图片 URL'} onClick={insertImage} disabled={uploadingKind !== null} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-primary transition cursor-pointer disabled:opacity-45 disabled:cursor-wait">
          <ImageIcon className={`w-4 h-4 ${uploadingKind === 'image' ? 'animate-pulse' : ''}`} />
        </button>
        <button type="button" title="上传并插入附件" onClick={() => attachmentInputRef.current?.click()} disabled={!onUploadAttachment || uploadingKind !== null} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-primary transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed">
          <Paperclip className={`w-4 h-4 ${uploadingKind === 'file' ? 'animate-pulse' : ''}`} />
        </button>
        <span className="h-5 w-px bg-outline-variant/70 mx-1 shrink-0" />
        <button type="button" title="应用 Markdown" onClick={applyMarkdown} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-primary transition cursor-pointer">
          <FileText className="w-4 h-4" />
        </button>
        <button
          type="button"
          title="Markdown 源码模式"
          onClick={() => setEditorMode(editorMode === 'code' ? 'rich' : 'code')}
          className={`w-8 h-8 inline-flex items-center justify-center rounded-lg transition cursor-pointer shrink-0 ${editorMode === 'code' ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-primary'}`}
        >
          <Code2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          title="Markdown 预览模式"
          onClick={() => setEditorMode(editorMode === 'preview' ? 'rich' : 'preview')}
          className={`w-8 h-8 inline-flex items-center justify-center rounded-lg transition cursor-pointer shrink-0 ${editorMode === 'preview' ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-primary'}`}
        >
          <Eye className="w-4 h-4" />
        </button>
        <span className="h-5 w-px bg-outline-variant/70 mx-1 shrink-0" />
        <button type="button" title="保存草稿" onClick={saveDraft} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-primary transition cursor-pointer shrink-0">
          <Save className="w-4 h-4" />
        </button>
        <button type="button" title="恢复草稿" onClick={restoreDraft} disabled={!draftSavedAt || draftSavedAt === '保存失败'} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-primary transition cursor-pointer shrink-0 disabled:opacity-35 disabled:cursor-not-allowed">
          <RotateCcw className="w-4 h-4" />
        </button>
        {!compact && (
          <button type="button" title="全屏输入" onClick={() => setIsFullscreen(true)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-primary transition cursor-pointer shrink-0">
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
        {draftSavedAt && (
          <span className="px-2 py-1 text-[10px] font-bold text-slate-500 shrink-0">
            草稿 {draftSavedAt}
          </span>
        )}
      </div>
  );

  const renderEditorBody = (bodyId: string, bodyMinHeight: string, isModalBody = false) => (
    <>
      {editorMode === 'code' ? (
        <textarea
          id={bodyId}
          ref={isModalBody ? fullscreenTextareaRef : textareaRef}
          value={getMarkdownEditorModeValue(value, 'code')}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`knowledge-rich-editor ${bodyMinHeight} ${isModalBody ? 'max-h-none flex-1' : 'max-h-64'} w-full resize-y overflow-y-auto px-3 py-2.5 text-on-surface outline-none font-mono text-xs leading-relaxed placeholder:text-slate-400 bg-white`}
        />
      ) : editorMode === 'preview' ? (
        <div
          id={bodyId}
          ref={isModalBody ? fullscreenPreviewEditorRef : previewEditorRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={(event) => {
            if (isComposingRef.current) return;
            onChange(event.currentTarget.innerHTML);
          }}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={(event) => {
            isComposingRef.current = false;
            onChange(event.currentTarget.innerHTML);
          }}
          onPaste={handlePaste}
          onBlur={handleBlur}
          className={`knowledge-rich-output knowledge-rich-editor ${bodyMinHeight} ${isModalBody ? 'max-h-none flex-1' : 'max-h-64'} overflow-y-auto px-3 py-2.5 text-on-surface outline-none font-medium leading-relaxed bg-white empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400`}
        />
      ) : (
        <div
          id={bodyId}
          ref={isModalBody ? fullscreenEditorRef : editorRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={(event) => {
            if (isComposingRef.current) return;
            onChange(event.currentTarget.innerHTML);
          }}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={(event) => {
            isComposingRef.current = false;
            onChange(event.currentTarget.innerHTML);
          }}
          onPaste={handlePaste}
          onBlur={handleBlur}
          className={`knowledge-rich-editor ${bodyMinHeight} ${isModalBody ? 'max-h-none flex-1' : 'max-h-64'} overflow-y-auto px-3 py-2.5 text-on-surface outline-none font-medium leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400`}
        />
      )}
    </>
  );

  return (
    <>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => handleAttachmentUpload(event, 'image')}
        aria-label="上传知识云图片"
      />
      <input
        ref={attachmentInputRef}
        type="file"
        className="hidden"
        onChange={(event) => handleAttachmentUpload(event, 'file')}
        aria-label="上传知识云附件"
      />
      <div className="min-w-0 bg-white border border-outline-variant rounded-xl shadow-sm overflow-hidden focus-within:border-primary/50">
        {renderToolbar()}
        {renderEditorBody(id, minHeight)}
      </div>
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-xs p-4 sm:p-6"
            onClick={() => setIsFullscreen(false)}
          >
            <motion.div
              initial={{ scale: 0.98, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, y: 10 }}
              onClick={(event) => event.stopPropagation()}
              className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between gap-4 border-b border-outline-variant bg-surface-container-low px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-black text-[#0D0B3D]">全屏输入</div>
                  <div className="truncate text-[11px] font-bold text-slate-500">{id}</div>
                </div>
                <button type="button" onClick={() => setIsFullscreen(false)} className="w-9 h-9 inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-white hover:text-on-surface transition cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                {renderToolbar(true)}
                {renderEditorBody(`${id}-fullscreen`, 'min-h-0', true)}
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-outline-variant bg-surface-container-low px-4 py-3">
                <div className="text-[11px] font-bold text-slate-500">
                  {draftSavedAt ? `本地草稿：${draftSavedAt}` : '未保存本地草稿'}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={saveDraft} className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm hover:text-primary transition cursor-pointer">
                    <Save className="w-4 h-4" /> 保存草稿
                  </button>
                  <button type="button" onClick={() => setIsFullscreen(false)} className="rounded-xl bg-primary px-4 py-2 text-xs font-black text-white shadow-md transition hover:bg-primary-container cursor-pointer">
                    完成输入
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function KnowledgeCloud({
  assets,
  onAddAsset,
  onUpdateAsset,
  onImportAssets,
  onBulkUpdateAssets,
  onDeleteAsset,
  onExportAssets,
  currentUser,
  isOffline,
  isSyncing = false,
  onRefreshAssets,
  isAppSidebarCollapsed = false,
}: KnowledgeCloudProps) {
  const [activeCategory, setActiveCategory] = useState<KnowledgeTableType | 'all'>('all');
  const [activeTagFilter, setActiveTagFilter] = useState('all');
  const [activeDirectoryPath, setActiveDirectoryPath] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<KnowledgeAsset | null>(null);
  const [detailTab, setDetailTab] = useState<KnowledgeDetailTab>('info');
  const [editingAsset, setEditingAsset] = useState<KnowledgeAsset | null>(null);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [cardsPerRow, setCardsPerRow] = useState(3);
  const [cardSpacing, setCardSpacing] = useState<'regular' | 'wide'>('regular');
  const [activeCardId, setActiveCardId] = useState<string | null>('T02-001');
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState<KnowledgeTableType | ''>('');
  const [bulkAuthor, setBulkAuthor] = useState('');
  const [bulkTags, setBulkTags] = useState('');
  const [bulkFieldName, setBulkFieldName] = useState('');
  const [bulkFieldValue, setBulkFieldValue] = useState('');
  const [bulkContentMode, setBulkContentMode] = useState<'append' | 'replace'>('append');
  const [bulkContent, setBulkContent] = useState('');
  const [renderLimit, setRenderLimit] = useState(GRID_BATCH_SIZE);
  const [syncSummary, setSyncSummary] = useState<{ added: number; removed: number; beforeTotal: number; afterTotal: number } | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const canEdit = !isOffline && (currentUser.role === 'editor' || currentUser.role === 'admin');
  const canAdmin = !isOffline && currentUser.role === 'admin';

  // New Asset Form State
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<KnowledgeTableType>('product_master');
  const [newContent, setNewContent] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newTagsString, setNewTagsString] = useState('');
  
  // Dynamic Fields State
  const [dynamicFields, setDynamicFields] = useState<Record<string, string>>(() => createInitialKnowledgeFields('product_master'));

  const handleDynamicChange = (field: string, value: string) => {
    setDynamicFields(prev => ({ ...prev, [field]: value }));
  };

  const handleCategoryChange = (category: KnowledgeTableType) => {
    setNewCategory(category);
    setDynamicFields(createInitialKnowledgeFields(category));
  };

  const resetKnowledgeForm = () => {
    setNewTitle('');
    setNewCategory('product_master');
    setNewContent('');
    setNewAuthor('');
    setNewTagsString('');
    setDynamicFields(createInitialKnowledgeFields('product_master'));
    setEditingAsset(null);
  };

  const openCreateAssetDrawer = () => {
    if (!canEdit) {
      showToast(isOffline ? '离线缓存模式下暂不能新增知识卡片' : '当前账号没有编辑权限');
      return;
    }
    resetKnowledgeForm();
    setIsModalOpen(true);
  };

  const openEditAssetDrawer = (asset: KnowledgeAsset) => {
    if (!canEdit) {
      showToast(isOffline ? '离线缓存模式下暂不能编辑知识卡片' : '当前账号没有编辑权限');
      return;
    }
    const schema = getKnowledgeFieldSchema(asset.category);
    const nextFields = createInitialKnowledgeFields(asset.category);
    for (const field of schema.fields) {
      nextFields[field.name] = String((asset as any)[field.name] ?? '');
    }

    setEditingAsset(asset);
    setNewTitle(asset.title);
    setNewCategory(asset.category);
    setNewContent(asset.content);
    setNewAuthor(asset.author);
    setNewTagsString(asset.tags.join('，'));
    setDynamicFields(nextFields);
    setIsModalOpen(true);
  };

  const closeAssetForm = () => {
    setIsModalOpen(false);
    resetKnowledgeForm();
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      showToast(isOffline ? '离线缓存模式下暂不能保存知识卡片' : '当前账号没有编辑权限');
      return;
    }
    const validation = validateKnowledgeAssetDraft({
      category: newCategory,
      title: newTitle,
      author: newAuthor,
      fields: dynamicFields,
    });

    if (!validation.valid) {
      setToastMsg(`请补全必填字段：${validation.missingFieldLabels.slice(0, 3).join('、')}`);
      setTimeout(() => setToastMsg(null), 3000);
      return;
    }

    const tags = newTagsString
      .split(/[,，]/)
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const draft = buildKnowledgeAssetDraft({
      title: newTitle,
      category: newCategory,
      content: newContent,
      author: newAuthor,
      tags: tags.length > 0 ? tags : ['自定义'],
      fields: dynamicFields,
    });

    if (editingAsset) {
      const updatedAsset = {
        ...editingAsset,
        ...draft,
        id: editingAsset.id,
        lastUpdated: formatLocalDate(),
      } as KnowledgeAsset;
      try {
        const savedAsset = await onUpdateAsset(updatedAsset);
        setSelectedAsset(savedAsset);
        showToast('知识卡片已同步更新');
      } catch (error) {
        console.error('Failed to update knowledge asset', error);
        showToast(error instanceof Error ? error.message : '知识卡片更新失败', 3600);
        return;
      }
    } else {
      try {
        await onAddAsset(draft);
        showToast('知识卡片已同步创建');
      } catch (error) {
        console.error('Failed to create knowledge asset', error);
        showToast(error instanceof Error ? error.message : '知识卡片创建失败', 3600);
        return;
      }
    }

    closeAssetForm();
  };

  const handleRichOutputDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) return;
    setPreviewZoom(1);
    setPreviewImage({
      src: target.currentSrc || target.src,
      alt: target.alt || '知识卡片图片',
    });
  };

  const closeImagePreview = () => {
    setPreviewImage(null);
    setPreviewZoom(1);
  };

  const handlePreviewWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const zoomFactor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    setPreviewZoom(currentZoom => {
      const nextZoom = currentZoom * zoomFactor;
      return Math.max(0.05, Math.round(nextZoom * 1000) / 1000);
    });
  };

  useEffect(() => {
    setRenderLimit(viewMode === 'grid' ? GRID_BATCH_SIZE : LIST_BATCH_SIZE);
  }, [activeCategory, activeDirectoryPath, activeTagFilter, deferredSearchQuery, viewMode, cardsPerRow, cardSpacing]);

  const selectedAssetIdSet = useMemo(() => new Set(selectedAssetIds), [selectedAssetIds]);

  const assetSearchRecords = useMemo(
    () => assets.map(asset => ({
      asset,
      directoryPath: getAssetDirectoryPath(asset),
      searchText: buildAssetSearchText(asset),
    })),
    [assets],
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map<KnowledgeTableType, number>();
    for (const asset of assets) {
      counts.set(asset.category, (counts.get(asset.category) || 0) + 1);
    }
    return counts;
  }, [assets]);

  const baseFilteredAssets = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    return assetSearchRecords
      .filter(({ asset, directoryPath, searchText }) => {
        if (activeCategory !== 'all' && asset.category !== activeCategory) return false;
        if (activeDirectoryPath && directoryPath !== activeDirectoryPath && !directoryPath.startsWith(`${activeDirectoryPath}/`)) return false;
        return !query || searchText.includes(query);
      })
      .map(record => record.asset);
  }, [activeCategory, activeDirectoryPath, assetSearchRecords, deferredSearchQuery]);

  const tagFilterOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const asset of baseFilteredAssets) {
      for (const tag of asset.tags || []) {
        const normalized = tag.trim();
        if (!normalized) continue;
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans-CN'))
      .slice(0, 14)
      .map(([tag, count]) => ({ tag, count }));
  }, [baseFilteredAssets]);

  useEffect(() => {
    if (activeTagFilter === 'all') return;
    if (!tagFilterOptions.some(option => option.tag === activeTagFilter)) {
      setActiveTagFilter('all');
    }
  }, [activeTagFilter, tagFilterOptions]);

  const filteredAssets = useMemo(() => {
    if (activeTagFilter === 'all') return baseFilteredAssets;
    return baseFilteredAssets.filter(asset => (asset.tags || []).includes(activeTagFilter));
  }, [activeTagFilter, baseFilteredAssets]);

  const visibleAssets = useMemo(() => filteredAssets.slice(0, renderLimit), [filteredAssets, renderLimit]);
  const hasMoreFilteredAssets = visibleAssets.length < filteredAssets.length;

  const selectedAssets = useMemo(
    () => assets.filter(asset => selectedAssetIdSet.has(asset.id)),
    [assets, selectedAssetIdSet],
  );
  const selectedVisibleAssets = useMemo(
    () => visibleAssets.filter(asset => selectedAssetIdSet.has(asset.id)),
    [selectedAssetIdSet, visibleAssets],
  );
  const allVisibleSelected = visibleAssets.length > 0 && selectedVisibleAssets.length === visibleAssets.length;
  const selectedAssetCategories = useMemo(
    () => Array.from(new Set(selectedAssets.map(asset => asset.category))),
    [selectedAssets],
  );
  const commonSelectedCategory = selectedAssetCategories.length === 1 ? selectedAssetCategories[0] : '';
  const effectiveBulkCategory = (bulkCategory || commonSelectedCategory || selectedAssets[0]?.category || 'product_master') as KnowledgeTableType;
  const bulkSchema = useMemo(() => getKnowledgeFieldSchema(effectiveBulkCategory), [effectiveBulkCategory]);
  const canBulkEditStructuredField = Boolean(bulkCategory || commonSelectedCategory);
  const selectedAssetAttachments = useMemo(
    () => selectedAsset ? collectKnowledgeAttachments(selectedAsset) : [],
    [selectedAsset],
  );

  const resetBulkEditForm = () => {
    setBulkCategory('');
    setBulkAuthor('');
    setBulkTags('');
    setBulkFieldName('');
    setBulkFieldValue('');
    setBulkContentMode('append');
    setBulkContent('');
  };

  const showToast = (message: string, duration = 2400) => {
    setToastMsg(message);
    setTimeout(() => setToastMsg(null), duration);
  };

  const handleRefreshAssets = async () => {
    const beforeAssets = assets;
    const beforeIds = new Set(beforeAssets.map(asset => asset.id));
    try {
      const refreshedAssets = await onRefreshAssets();
      const afterAssets = Array.isArray(refreshedAssets) ? refreshedAssets : beforeAssets;
      const afterIds = new Set(afterAssets.map(asset => asset.id));
      const added = afterAssets.filter(asset => !beforeIds.has(asset.id)).length;
      const removed = beforeAssets.filter(asset => !afterIds.has(asset.id)).length;
      setSyncSummary({
        added,
        removed,
        beforeTotal: beforeAssets.length,
        afterTotal: afterAssets.length,
      });
      showToast(`同步完成：新增 ${added}，删除 ${removed}，总数 ${afterAssets.length}`, 3200);
    } catch (error) {
      console.error('Failed to refresh knowledge assets', error);
      showToast(error instanceof Error ? error.message : '同步失败：请稍后重试', 3600);
    }
  };

  const handleEditorAttachmentUpload = async (
    file: File,
    context: { assetId?: string; fieldName?: string; kind: 'image' | 'file' },
  ) => {
    if (!canEdit) {
      throw new Error(isOffline ? '离线缓存模式下暂不能上传附件' : '当前账号没有编辑权限');
    }
    const result = await uploadKnowledgeAttachment({
      file,
      assetId: context.assetId,
      fieldName: context.fieldName,
    });
    showToast(context.kind === 'image' ? '图片已上传并插入' : '附件已上传并插入');
    return result;
  };

  const handleImportWorkbook = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!canAdmin) {
      showToast(isOffline ? '离线缓存模式下暂不能导入知识卡片' : '当前账号没有批量导入权限');
      return;
    }
    if (!onImportAssets) {
      showToast('当前页面未接入批量导入能力');
      return;
    }

    let importedAssets: Array<Omit<KnowledgeAsset, 'id' | 'lastUpdated'>>;
    try {
      ({ importedAssets } = await parseKnowledgeImportWorkbook(file));
      if (importedAssets.length === 0) {
        showToast('未识别到可导入的知识云字段，请检查模板工作表和表头', 3600);
        return;
      }
    } catch (error) {
      console.error('Failed to parse knowledge workbook', error);
      showToast('导入失败：请确认文件为知识云字段模板 Excel', 3600);
      return;
    }

    try {
      const result = await onImportAssets(importedAssets);
      showToast(`导入完成：新增 ${result.created}，更新 ${result.updated}，跳过 ${result.skipped}，失败 ${result.failed}`, 3600);
    } catch (error) {
      console.error('Failed to import knowledge assets', error);
      showToast(error instanceof Error ? error.message : '导入失败：知识云同步服务暂不可用', 3600);
    }
  };

  const handleExportWorkbook = async () => {
    try {
      const remoteAssets = await onExportAssets();
      await exportKnowledgeAssetsWorkbook(remoteAssets);
      showToast(`已导出 ${remoteAssets.length} 张知识卡片`);
    } catch (error) {
      console.error('Failed to export knowledge workbook', error);
      showToast(error instanceof Error ? error.message : '导出失败：请稍后重试');
    }
  };

  const toggleEditMode = () => {
    if (!canEdit) {
      showToast(isOffline ? '离线缓存模式下暂不能进入编辑模式' : '当前账号没有编辑权限');
      return;
    }
    setIsEditMode(prev => {
      const next = !prev;
      if (!next) {
        setSelectedAssetIds([]);
        setIsBulkEditOpen(false);
        resetBulkEditForm();
      }
      return next;
    });
  };

  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssetIds(prev => (
      prev.includes(assetId)
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    ));
  };

  const toggleVisibleAssetSelection = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(visibleAssets.map(asset => asset.id));
      setSelectedAssetIds(prev => prev.filter(id => !visibleIds.has(id)));
      return;
    }

    setSelectedAssetIds(prev => Array.from(new Set([...prev, ...visibleAssets.map(asset => asset.id)])));
  };

  const openBulkEditDrawer = () => {
    if (!canAdmin) {
      showToast(isOffline ? '离线缓存模式下暂不能批量编辑' : '当前账号没有批量编辑权限');
      return;
    }
    if (selectedAssetIds.length === 0) {
      showToast('请先选择要批量编辑的知识卡片');
      return;
    }
    setIsBulkEditOpen(true);
  };

  const closeBulkEditDrawer = () => {
    setIsBulkEditOpen(false);
    resetBulkEditForm();
  };

  const applyBulkEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canAdmin) {
      showToast(isOffline ? '离线缓存模式下暂不能批量编辑' : '当前账号没有批量编辑权限');
      return;
    }
    if (selectedAssets.length === 0) {
      showToast('请先选择要批量编辑的知识卡片');
      return;
    }

    const tagUpdates = bulkTags
      .split(/[,，]/)
      .map(tag => tag.trim())
      .filter(Boolean);
    const selectedField = bulkFieldName
      ? bulkSchema.fields.find(field => field.name === bulkFieldName)
      : undefined;
    const hasBulkFieldValue = Boolean(selectedField && bulkFieldValue.trim());
    const hasContentValue = Boolean(bulkContent.trim());
    const hasAuthorValue = Boolean(bulkAuthor.trim());
    const hasCategoryValue = Boolean(bulkCategory);

    if (!hasCategoryValue && !hasAuthorValue && tagUpdates.length === 0 && !hasBulkFieldValue && !hasContentValue) {
      showToast('请至少填写一个要批量修改的内容');
      return;
    }

    const nextAssets = selectedAssets.map(asset => {
      const nextAsset: Record<string, any> = { ...asset };

      if (bulkCategory) {
        const nextFields = createInitialKnowledgeFields(bulkCategory);
        const nextSchema = getKnowledgeFieldSchema(bulkCategory);
        for (const field of nextSchema.fields) {
          nextFields[field.name] = String(nextAsset[field.name] ?? nextFields[field.name] ?? '');
        }
        Object.assign(nextAsset, nextFields, { category: bulkCategory });
      }

      if (hasAuthorValue) {
        nextAsset.author = bulkAuthor.trim();
      }

      if (tagUpdates.length > 0) {
        nextAsset.tags = Array.from(new Set([...(asset.tags || []), ...tagUpdates]));
      }

      if (hasBulkFieldValue && selectedField) {
        nextAsset[selectedField.name] = bulkFieldValue;
      }

      if (hasContentValue) {
        nextAsset.content = bulkContentMode === 'replace'
          ? bulkContent
          : [asset.content, bulkContent].filter(Boolean).join('\n\n');
      }

      nextAsset.lastUpdated = formatLocalDate();
      return nextAsset as KnowledgeAsset;
    });

    try {
      const result = await onBulkUpdateAssets(nextAssets);
      showToast(`批量同步完成：新增 ${result.created}，更新 ${result.updated}，跳过 ${result.skipped}，失败 ${result.failed}`, 3600);
      setSelectedAssetIds([]);
      closeBulkEditDrawer();
    } catch (error) {
      console.error('Failed to bulk update knowledge assets', error);
      showToast(error instanceof Error ? error.message : '批量编辑同步失败', 3600);
    }
  };

  const handleDeleteSelectedAsset = async () => {
    if (!selectedAsset) return;
    if (!canAdmin) {
      showToast(isOffline ? '离线缓存模式下暂不能删除知识卡片' : '当前账号没有删除权限');
      return;
    }
    if (!window.confirm(`确认删除知识卡片「${selectedAsset.title}」？`)) return;

    try {
      await onDeleteAsset(selectedAsset);
      showToast('知识卡片已删除');
      setSelectedAsset(null);
      setSelectedAssetIds(prev => prev.filter(id => id !== selectedAsset.id));
    } catch (error) {
      console.error('Failed to delete knowledge asset', error);
      showToast(error instanceof Error ? error.message : '知识卡片删除失败', 3600);
    }
  };

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
            {f.value ? (
              <div
                className="knowledge-rich-output text-sm font-medium text-on-surface leading-relaxed bg-white border border-outline-variant/40 px-1.5 py-2 rounded-xl"
                onDoubleClick={handleRichOutputDoubleClick}
                dangerouslySetInnerHTML={{ __html: renderKnowledgeRichText(String(f.value)) }}
              />
            ) : (
              <div className="text-sm font-medium text-on-surface leading-relaxed bg-white border border-outline-variant/40 px-1.5 py-2 rounded-xl">-</div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderDynamicInputs = () => {
    const schema = getKnowledgeFieldSchema(newCategory);

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {schema.fields.map((field) => {
          const value = dynamicFields[field.name] ?? '';
          const commonClassName = 'w-full bg-white border border-outline-variant rounded-xl px-3 py-2.5 text-on-surface outline-none focus:border-primary/50 font-medium shadow-sm placeholder:text-slate-400';
          const fieldId = `knowledge-field-${field.name}`;

          return (
            <div key={field.name} className={`space-y-2 ${field.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
              <label htmlFor={fieldId} className="text-on-surface-variant font-bold block">
                {field.label}
              </label>

              {field.type === 'select' && field.options ? (
                <select
                  id={fieldId}
                  value={value}
                  onChange={(e) => handleDynamicChange(field.name, e.target.value)}
                  className={`${commonClassName} cursor-pointer`}
                >
                  {field.options.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              ) : (
                <RichKnowledgeEditor
                  id={fieldId}
                  value={value}
                  placeholder={field.placeholder || `录入${field.label}`}
                  onChange={(nextValue) => handleDynamicChange(field.name, nextValue)}
                  minHeight={field.type === 'textarea' ? 'min-h-[112px]' : 'min-h-[76px]'}
                  uploadContext={{ assetId: editingAsset?.id, fieldName: field.name }}
                  onUploadAttachment={handleEditorAttachmentUpload}
                  onUploadError={(message) => showToast(message, 3600)}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const openAssetDetail = (asset: KnowledgeAsset) => {
    const nextState = getKnowledgeCardClickState(asset);
    setActiveCardId(nextState.activeCardId);
    setSelectedAsset(nextState.selectedAsset);
    setDetailTab('info');
  };

  const categoryTitle = activeCategory === 'all' 
    ? 'Derivation Libraries' 
    : (CATEGORY_MAP[activeCategory]?.enLabel || 'Derivation Libraries');
  const directoryTreeAssets = useMemo(
    () => activeCategory === 'all' ? assets : assets.filter(asset => asset.category === activeCategory),
    [activeCategory, assets],
  );
  const directoryTree = useMemo(() => buildDirectoryTree(directoryTreeAssets), [directoryTreeAssets]);
  const activeDirectoryLabel = activeDirectoryPath ? activeDirectoryPath.split('/').at(-1) : '';

  const renderDirectoryNodes = (nodes: DirectoryTreeNode[], level = 0) => (
    <div className={level === 0 ? 'space-y-1' : 'mt-1 space-y-1'}>
      {nodes.map(node => {
        const isSelected = activeDirectoryPath === node.path;
        return (
          <div key={node.path}>
            <button
              type="button"
              onClick={() => setActiveDirectoryPath(node.path)}
              className={`w-full flex items-center justify-between gap-2 py-2 pr-2 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                isSelected ? 'bg-[#5F52EE]/10 text-[#5F52EE]' : 'text-[#0D0B3D] hover:bg-slate-50 hover:text-[#5F52EE]'
              }`}
              style={{ paddingLeft: `${10 + level * 14}px` }}
              title={node.path}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Folder className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#5F52EE]' : 'text-slate-400'}`} />
                <span className="truncate text-left">{node.name}</span>
              </span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-lg shrink-0 ${isSelected ? 'bg-[#5F52EE] text-white' : 'bg-slate-100 text-slate-500'}`}>
                {node.count}
              </span>
            </button>
            {node.children.length > 0 && renderDirectoryNodes(node.children.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-Hans-CN')), level + 1)}
          </div>
        );
      })}
    </div>
  );

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
      <div className={`hidden lg:fixed lg:top-6 lg:bottom-6 lg:z-20 lg:flex lg:w-64 shrink-0 flex-col gap-3 overflow-y-auto overflow-x-hidden custom-scrollbar pr-1 transition-[left] duration-300 ${
        isAppSidebarCollapsed ? 'lg:left-22' : 'lg:left-70'
      }`}>
        <div className="bg-white border border-[#E2E4E9] rounded-2xl p-4 space-y-1 shadow-xs shrink-0">
          <h3 className="text-xs font-black text-[#0D0B3D] tracking-wider uppercase mb-3 flex items-center gap-2 font-sans px-2">
            <Filter className="w-3.5 h-3.5 text-[#5F52EE]" />
            知识云业务分类
          </h3>
          
          <button
            onClick={() => {
              setActiveCategory('all');
              setActiveDirectoryPath('');
            }}
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
            const count = categoryCounts.get(cat) || 0;
            const item = CATEGORY_MAP[cat];
            const isSelected = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  setActiveDirectoryPath('');
                }}
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

        <div className="bg-white border border-[#E2E4E9] rounded-2xl p-4 shadow-xs shrink-0">
          <div className="flex items-center justify-between mb-3 px-2">
            <h3 className="text-xs font-black text-[#0D0B3D] tracking-wider uppercase flex items-center gap-2 font-sans">
              <Folder className="w-3.5 h-3.5 text-[#5F52EE]" />
              资料目录
            </h3>
            {activeDirectoryPath && (
              <button
                type="button"
                onClick={() => setActiveDirectoryPath('')}
                className="text-[10px] font-bold text-[#5F52EE] hover:underline cursor-pointer"
              >
                清除
              </button>
            )}
          </div>
          {directoryTree.length > 0 ? (
            renderDirectoryNodes(directoryTree)
          ) : (
            <div className="px-2 py-3 text-[11px] font-bold text-slate-400">
              当前数据暂无目录层级
            </div>
          )}
        </div>
      </div>

      {/* Main content column on the right */}
      <div className="flex-1 flex flex-col gap-5 overflow-hidden lg:pl-[17.5rem]">
        <div className="flex flex-col gap-3 pb-2 shrink-0">
          <div className="flex flex-col gap-3">
            <h1 className="text-xl md:text-2xl font-black text-[#0D0B3D] tracking-tight flex flex-wrap items-baseline gap-x-2 gap-y-1 min-w-0">
              <span>{categoryTitle}</span>
              {activeDirectoryLabel && <span className="text-[#5F52EE] text-sm font-black">/ {activeDirectoryLabel}</span>}
              <span className="text-slate-400 font-semibold text-xs md:text-sm">({filteredAssets.length})</span>
              {deferredSearchQuery !== searchQuery && (
                <span className="text-[#5F52EE] text-[11px] font-black bg-[#5F52EE]/10 px-2 py-0.5 rounded-lg">
                  搜索中
                </span>
              )}
            </h1>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:overflow-x-auto sm:pb-1 sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden">
              <div className="relative bg-white border border-[#E2E4E9] rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm focus-within:border-slate-300 transition min-w-0 w-full sm:w-[12rem] xl:w-[10rem] 2xl:w-[10rem] shrink-0">
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

                <div className="flex flex-wrap sm:flex-nowrap items-center justify-start gap-1.5 min-w-0 sm:min-w-max">
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

                  {viewMode === 'grid' && (
                    <div className="hidden md:flex items-center gap-1 bg-white border border-[#E2E4E9] rounded-xl p-1 shadow-sm shrink-0">
                      <div className="flex items-center gap-0.5 border-r border-[#E2E4E9] pr-1.5 shrink-0">
                        <span className="px-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">每行</span>
                        {[3, 4, 5].map(count => (
                          <button
                            key={count}
                            type="button"
                            onClick={() => setCardsPerRow(count)}
                            className={`min-w-6 h-7 rounded-lg text-[11px] font-black transition cursor-pointer ${
                              cardsPerRow === count ? 'bg-[#0D0B3D] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                            }`}
                            title={`每行显示 ${count} 张卡片`}
                          >
                            {count}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {[
                          { id: 'regular', label: '常规' },
                          { id: 'wide', label: '宽' },
                        ].map(option => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setCardSpacing(option.id as 'regular' | 'wide')}
                            className={`h-7 px-2 rounded-lg text-[11px] font-black transition cursor-pointer ${
                              cardSpacing === option.id ? 'bg-[#5F52EE] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                            }`}
                            title={`卡片间距：${option.label}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={toggleEditMode}
                    disabled={!canEdit}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-2 font-extrabold text-xs rounded-xl transition shadow-sm shrink-0 ${
                      !canEdit
                        ? 'bg-slate-100 border border-[#E2E4E9] text-slate-300 cursor-not-allowed'
                        : isEditMode
                        ? 'bg-[#0D0B3D] text-white hover:bg-[#181548]'
                        : 'bg-white border border-[#E2E4E9] text-[#0D0B3D] hover:border-[#5F52EE]/50 hover:text-[#5F52EE] cursor-pointer'
                    }`}
                    id="knowledge-edit-mode-btn"
                    title={!canEdit ? (isOffline ? '离线缓存模式下不可编辑' : '当前账号没有编辑权限') : undefined}
                  >
                    <Pencil className="w-4 h-4" />
                    <span>{isEditMode ? '退出编辑' : '编辑模式'}</span>
                  </button>

                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleImportWorkbook}
                    className="hidden"
                    aria-label="导入知识云 Excel 模板"
                  />
                  <button
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                    disabled={!canAdmin}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-2 border font-extrabold text-xs rounded-xl transition shadow-sm shrink-0 ${
                      canAdmin
                        ? 'bg-white border-[#E2E4E9] text-[#0D0B3D] hover:border-[#5F52EE]/50 hover:text-[#5F52EE] cursor-pointer'
                        : 'bg-slate-100 border-[#E2E4E9] text-slate-300 cursor-not-allowed'
                    }`}
                    id="knowledge-import-btn"
                    title={canAdmin ? '按知识云字段模板导入 Excel' : '仅管理员可导入'}
                  >
                    <Upload className="w-4 h-4" />
                    <span>导入</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportWorkbook}
                    className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-white border border-[#E2E4E9] text-[#0D0B3D] hover:border-[#5F52EE]/50 hover:text-[#5F52EE] font-extrabold text-xs rounded-xl transition shadow-sm cursor-pointer shrink-0"
                    id="knowledge-export-btn"
                    title="导出当前筛选结果为知识云字段模板 Excel"
                  >
                    <Download className="w-4 h-4" />
                    <span>导出</span>
                  </button>

                  <button
                    onClick={openCreateAssetDrawer}
                    disabled={!canEdit}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 font-extrabold text-xs rounded-xl transition shadow-md shadow-primary/10 shrink-0 ${
                      canEdit
                        ? 'bg-[#5F52EE] hover:bg-[#4E41DC] text-white cursor-pointer'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                    id="add-knowledge-btn"
                    title={canEdit ? '创建知识卡片' : '当前不可创建知识卡片'}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void handleRefreshAssets();
                    }}
                    disabled={isSyncing}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-2 bg-white border border-[#E2E4E9] font-extrabold text-xs rounded-xl transition shadow-sm shrink-0 ${
                      isSyncing
                        ? 'text-[#5F52EE] border-[#5F52EE]/40 cursor-wait'
                        : 'text-[#0D0B3D] hover:border-[#5F52EE]/50 hover:text-[#5F52EE] cursor-pointer'
                    }`}
                    title={isSyncing ? '正在同步知识云' : '重新同步知识云'}
                  >
                    <RotateCcw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? '同步中' : '同步'}</span>
                  </button>
                </div>
            </div>
          </div>

          {syncSummary && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#5F52EE]/15 bg-white/80 px-3 py-2 shadow-sm text-[11px] font-black text-[#0D0B3D]">
              <span className="inline-flex items-center gap-1.5 text-[#5F52EE]">
                <RotateCcw className="w-3.5 h-3.5" />
                同步完成
              </span>
              <span className="text-slate-400">新增</span>
              <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-emerald-700">{syncSummary.added}</span>
              <span className="text-slate-400">删除</span>
              <span className="rounded-lg bg-red-50 px-2 py-0.5 text-red-700">{syncSummary.removed}</span>
              <span className="text-slate-400">总数</span>
              <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-slate-700">{syncSummary.afterTotal}</span>
              <span className="text-slate-400">原 {syncSummary.beforeTotal}</span>
              <button
                type="button"
                onClick={() => setSyncSummary(null)}
                className="ml-auto text-slate-400 hover:text-slate-600 cursor-pointer"
                title="关闭同步提示"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E2E4E9] bg-white/70 px-3 py-2 shadow-sm">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-slate-500 shrink-0">
              <Tag className="w-3.5 h-3.5 text-[#5F52EE]" />
              标签分组
            </span>
            <button
              type="button"
              onClick={() => setActiveTagFilter('all')}
              className={`h-7 px-2.5 rounded-lg text-[11px] font-black transition cursor-pointer ${
                activeTagFilter === 'all'
                  ? 'bg-[#0D0B3D] text-white shadow-sm'
                  : 'bg-white text-slate-500 hover:text-[#5F52EE] hover:bg-slate-50 border border-[#E2E4E9]'
              }`}
            >
              全部标签
            </button>
            {tagFilterOptions.map(option => (
              <button
                key={option.tag}
                type="button"
                onClick={() => setActiveTagFilter(option.tag)}
                className={`h-7 max-w-[11rem] inline-flex items-center gap-1.5 px-2.5 rounded-lg text-[11px] font-black transition cursor-pointer ${
                  activeTagFilter === option.tag
                    ? 'bg-[#5F52EE] text-white shadow-sm'
                    : 'bg-white text-[#0D0B3D] hover:text-[#5F52EE] hover:bg-slate-50 border border-[#E2E4E9]'
                }`}
                title={option.tag}
              >
                <span className="truncate">{option.tag}</span>
                <span className={`font-mono rounded-md px-1.5 py-0.5 ${activeTagFilter === option.tag ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {option.count}
                </span>
              </button>
            ))}
            {activeTagFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setActiveTagFilter('all')}
                className="ml-auto text-[11px] font-black text-[#5F52EE] hover:underline cursor-pointer"
              >
                清除标签筛选
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative block lg:hidden w-full sm:w-64">
              <select
                value={activeCategory}
                onChange={(e) => {
                  setActiveCategory(e.target.value as any);
                  setActiveDirectoryPath('');
                }}
                className="w-full bg-white border border-[#5F52EE]/60 rounded-xl pl-4 pr-10 py-2.5 text-sm font-extrabold text-[#5F52EE] outline-none appearance-none shadow-sm cursor-pointer hover:border-[#4E41DC] transition"
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

            {viewMode === 'grid' && (
              <div className="flex md:hidden items-center gap-2 bg-white border border-[#E2E4E9] rounded-xl p-1 shadow-sm shrink-0">
                <div className="flex items-center gap-1 border-r border-[#E2E4E9] pr-2">
                  <span className="px-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">每行</span>
                  {[3, 4, 5].map(count => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setCardsPerRow(count)}
                      className={`min-w-7 h-7 rounded-lg text-[11px] font-black transition cursor-pointer ${
                        cardsPerRow === count ? 'bg-[#0D0B3D] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                      }`}
                      title={`每行显示 ${count} 张卡片`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  {[
                    { id: 'regular', label: '常规' },
                    { id: 'wide', label: '宽' },
                  ].map(option => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setCardSpacing(option.id as 'regular' | 'wide')}
                      className={`h-7 px-2 rounded-lg text-[11px] font-black transition cursor-pointer ${
                        cardSpacing === option.id ? 'bg-[#5F52EE] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                      }`}
                      title={`卡片间距：${option.label}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isEditMode && (
              <>
                <button
                  type="button"
                  onClick={toggleVisibleAssetSelection}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-[#E2E4E9] hover:border-[#5F52EE]/50 text-[#5F52EE] font-extrabold text-xs rounded-xl transition shadow-sm cursor-pointer shrink-0"
                  id="knowledge-select-visible-btn"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{allVisibleSelected ? '取消本页' : '选择本页'}</span>
                </button>
                <button
                  type="button"
                  onClick={openBulkEditDrawer}
                  disabled={!canAdmin || selectedAssetIds.length === 0}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#5F52EE] hover:bg-[#4E41DC] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none text-white font-extrabold text-xs rounded-xl transition shadow-md shadow-primary/10 cursor-pointer disabled:cursor-not-allowed shrink-0"
                  id="bulk-edit-knowledge-btn"
                  title={canAdmin ? undefined : '仅管理员可批量编辑'}
                >
                  <Layers className="w-4 h-4" />
                  <span>批量编辑 ({selectedAssetIds.length})</span>
                </button>
              </>
            )}
          </div>
        </div>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Section Heading like "Recently Created" */}
        <div className="flex items-center justify-between font-medium shrink-0">
          <span className="text-xs font-extrabold text-slate-400 tracking-wider uppercase">
            Recently Created ({filteredAssets.length})
          </span>
          {isEditMode && (
            <span className="text-[11px] font-black text-[#5F52EE] bg-[#5F52EE]/10 border border-[#5F52EE]/15 px-2.5 py-1 rounded-lg">
              已选择 {selectedAssetIds.length} 张
            </span>
          )}
          {activeCategory !== 'all' && (
            <button 
              onClick={() => {
                setActiveCategory('all');
                setActiveDirectoryPath('');
              }} 
              className="text-xs text-[#5F52EE] font-bold hover:underline cursor-pointer"
            >
              Clear Category Filter
            </button>
          )}
        </div>

        {/* Grid and Card Renderers */}
        {viewMode === 'grid' ? (
          <div
            className={`flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 pt-2 pb-12 pr-2 custom-scrollbar ${
              cardSpacing === 'wide' ? 'gap-6' : 'gap-4'
            } ${
              cardsPerRow === 3 ? 'lg:grid-cols-3' : cardsPerRow === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-5'
            }`}
          >
            {filteredAssets.length > 0 ? (
              <>
              {visibleAssets.map((asset) => {
                const catItem = CATEGORY_MAP[asset.category] || { label: asset.category, enLabel: 'Asset', icon: <Box className="w-4 h-4" /> };
                const isActive = activeCardId === asset.id;
                const isSelectedForEdit = selectedAssetIdSet.has(asset.id);
                const primaryTag = asset.tags[0] || '未标记';
                const tagSuffix = asset.tags.length > 1 ? ` +${asset.tags.length - 1}` : '';
                const previewText = getKnowledgePreviewText(asset.content);
                return (
                  <div
                    key={asset.id}
                    data-knowledge-card-id={asset.id}
                    onClick={() => {
                      if (isEditMode) {
                        toggleAssetSelection(asset.id);
                        return;
                      }
                      openAssetDetail(asset);
                    }}
                    className={`knowledge-grid-card group relative rounded-[20px] px-4 py-3.5 transition-all duration-300 cursor-pointer flex flex-col justify-between h-[168px] select-none ${
                      isSelectedForEdit
                        ? 'bg-white border-2 border-[#5F52EE] text-on-background shadow-lg shadow-[#5F52EE]/15'
                        : isActive 
                        ? 'bg-[#5F52EE] text-white shadow-xl shadow-[#5F52EE]/25 border-none transform -translate-y-1'
                        : 'bg-white border border-[#E2E4E9] text-on-background hover:shadow-md hover:border-slate-300'
                    }`}
                  >
                    {/* Top line of card */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        {isEditMode && (
                          <input
                            type="checkbox"
                            checked={isSelectedForEdit}
                            onChange={() => toggleAssetSelection(asset.id)}
                            onClick={(event) => event.stopPropagation()}
                            className="w-4 h-4 rounded border-slate-300 text-[#5F52EE] focus:ring-[#5F52EE] cursor-pointer shrink-0"
                            aria-label={`选择 ${asset.title}`}
                          />
                        )}
                        {/* Category Badge */}
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition min-w-0 ${
                          isActive && !isEditMode
                            ? 'bg-white/15 text-white border-white/20'
                            : getCategoryThemeClasses(asset.category)
                        }`}>
                          {React.cloneElement(catItem.icon as React.ReactElement, { className: 'w-3 h-3' })}
                          <span className="truncate max-w-[116px]">{catItem.enLabel || catItem.label}</span>
                        </div>
                      </div>

                      {/* Modify/Detail button exactly like reference image */}
                      {(isActive || isEditMode) ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditAssetDrawer(asset);
                          }}
                          disabled={!canEdit}
                          className={`flex items-center gap-1 px-3 py-1 bg-white font-black text-[10px] rounded-lg shadow-sm transition active:scale-95 ${
                            canEdit ? 'hover:bg-white/95 text-[#5F52EE] cursor-pointer' : 'text-slate-300 cursor-not-allowed'
                          }`}
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Modify</span>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openAssetDetail(asset);
                          }}
                          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2.5 py-1 bg-[#F4F5FA] hover:bg-[#EAECEF] text-[#5F52EE] font-bold text-[10px] rounded-lg transition cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Detail</span>
                        </button>
                      )}
                    </div>

                    {/* Content Section */}
                    <div className="mt-2.5 flex-1 min-h-0">
                      <h3 className={`font-black tracking-tight text-[13px] leading-snug line-clamp-2 ${
                        isActive && !isEditMode ? 'text-white' : 'text-[#0D0B3D]'
                      }`}>
                        {asset.title}
                      </h3>
                      <p className={`text-[11px] mt-1.5 leading-snug line-clamp-2 font-semibold ${
                        isActive && !isEditMode ? 'text-white/80' : 'text-slate-400'
                      }`}>
                        {previewText || '暂无详细描述'}
                      </p>
                    </div>

                    {/* Bottom Metadata row */}
                    <div className={`flex items-center justify-between gap-3 text-[10px] font-extrabold pt-2.5 border-t font-mono tracking-wider uppercase ${
                      isActive && !isEditMode ? 'border-white/10 text-white/70' : 'border-[#F1F3F7] text-slate-400'
                    }`}>
                      <div className="flex items-center gap-1 min-w-0">
                        <Folder className="w-3.5 h-3.5 opacity-75 shrink-0" />
                        <span className="truncate">{catItem.label}</span>
                      </div>
                      <div className="flex items-center gap-1 min-w-0 justify-end">
                        <Tag className="w-3.5 h-3.5 opacity-75 shrink-0" />
                        <span className="truncate max-w-[96px]">{primaryTag}{tagSuffix}</span>
                      </div>
                    </div>

                    {/* Sparkling stars decorative overlay on active card */}
                    {isActive && !isEditMode && (
                      <div className="absolute right-3.5 bottom-3.5 opacity-15 pointer-events-none">
                        <Sparkles className="w-11 h-11 text-white" />
                      </div>
                    )}
                  </div>
                );
              })}
              {hasMoreFilteredAssets && (
                <div className="col-span-full flex justify-center py-4">
                  <button
                    type="button"
                    onClick={() => setRenderLimit(prev => prev + (viewMode === 'grid' ? GRID_BATCH_SIZE : LIST_BATCH_SIZE))}
                    className="px-4 py-2 rounded-xl bg-white border border-[#E2E4E9] hover:border-[#5F52EE]/40 text-[#5F52EE] text-xs font-black shadow-sm transition cursor-pointer"
                  >
                    加载更多（已显示 {visibleAssets.length} / {filteredAssets.length}）
                  </button>
                </div>
              )}
              </>
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
                <div className="overflow-x-auto custom-scrollbar">
                <table className="min-w-[1160px] w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-[#E2E4E9] text-slate-400 font-extrabold text-[10px] uppercase tracking-wider">
                      {isEditMode && (
                        <th className="py-3 pl-5 pr-2 w-12">
                          <input
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={toggleVisibleAssetSelection}
                            className="w-4 h-4 rounded border-slate-300 text-[#5F52EE] focus:ring-[#5F52EE] cursor-pointer"
                            aria-label="选择当前列表"
                          />
                        </th>
                      )}
                      <th className="py-3 px-5">Standard Title</th>
                      <th className="py-3 px-5">Category</th>
                      <th className="py-3 px-5">Author</th>
                      <th className="py-3 px-5">Last Updated</th>
                      <th className="py-3 px-5">Status</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F3F7] text-xs font-semibold">
                    {visibleAssets.map((asset) => {
                      const cat = CATEGORY_MAP[asset.category] || { label: asset.category, enLabel: 'Asset' };
                      const isActive = activeCardId === asset.id;
                      const isSelectedForEdit = selectedAssetIdSet.has(asset.id);
                      return (
                        <tr
                          key={asset.id}
                          data-knowledge-card-id={asset.id}
                          onClick={() => {
                            if (isEditMode) {
                              toggleAssetSelection(asset.id);
                              return;
                            }
                            openAssetDetail(asset);
                          }}
                          className={`transition cursor-pointer ${
                            isSelectedForEdit
                              ? 'bg-[#5F52EE]/10'
                              : isActive
                              ? 'bg-[#5F52EE]/5'
                              : 'hover:bg-slate-50/70'
                          }`}
                        >
                          {isEditMode && (
                            <td className="py-3.5 pl-5 pr-2">
                              <input
                                type="checkbox"
                                checked={isSelectedForEdit}
                                onChange={() => toggleAssetSelection(asset.id)}
                                onClick={(event) => event.stopPropagation()}
                                className="w-4 h-4 rounded border-slate-300 text-[#5F52EE] focus:ring-[#5F52EE] cursor-pointer"
                                aria-label={`选择 ${asset.title}`}
                              />
                            </td>
                          )}
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
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isEditMode) {
                                  openEditAssetDrawer(asset);
                                  return;
                                }
                                openAssetDetail(asset);
                              }}
                              className="text-[#5F52EE] hover:underline font-extrabold cursor-pointer"
                            >
                              {isEditMode ? 'Edit' : 'View'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                {hasMoreFilteredAssets && (
                  <div className="flex justify-center border-t border-[#F1F3F7] bg-white py-3">
                    <button
                      type="button"
                      onClick={() => setRenderLimit(prev => prev + LIST_BATCH_SIZE)}
                      className="px-4 py-2 rounded-xl bg-white border border-[#E2E4E9] hover:border-[#5F52EE]/40 text-[#5F52EE] text-xs font-black shadow-sm transition cursor-pointer"
                    >
                      加载更多（已显示 {visibleAssets.length} / {filteredAssets.length}）
                    </button>
                  </div>
                )}
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
                <div className="flex items-center gap-2">
                  {canAdmin && (
                    <button
                      type="button"
                      onClick={handleDeleteSelectedAsset}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition cursor-pointer text-[11px] font-black shadow-sm"
                      title="删除该知识卡片"
                      id="delete-selected-knowledge-btn"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      删除
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openEditAssetDrawer(selectedAsset)}
                    disabled={!canEdit}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition text-[11px] font-black shadow-sm ${
                      canEdit
                        ? 'bg-[#5F52EE] text-white hover:bg-[#4E41DC] cursor-pointer'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                    title={canEdit ? '编辑该知识卡片' : '当前不可编辑知识卡片'}
                    id="edit-selected-knowledge-btn"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    编辑
                  </button>
                  <button
                    onClick={() => setSelectedAsset(null)}
                    className="text-on-surface-variant hover:text-on-surface transition cursor-pointer"
                    title="关闭详情"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
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

                <div className="flex items-center gap-2 bg-surface-container-low border border-outline-variant/60 rounded-xl p-1 shadow-sm">
                  {[
                    { id: 'info', label: '信息', icon: <BookText className="w-4 h-4" /> },
                    { id: 'attachments', label: `附件 (${selectedAssetAttachments.length})`, icon: <Paperclip className="w-4 h-4" /> },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setDetailTab(tab.id as KnowledgeDetailTab)}
                      className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition cursor-pointer ${
                        detailTab === tab.id
                          ? 'bg-white text-[#5F52EE] shadow-sm border border-outline-variant/50'
                          : 'text-on-surface-variant hover:text-primary hover:bg-white/60'
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>

                {detailTab === 'info' ? (
                  <>
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
                      <div
                        className="knowledge-rich-output p-4 bg-surface-container-low rounded-xl text-xs text-on-surface leading-relaxed border border-outline-variant/50 font-medium"
                        onDoubleClick={handleRichOutputDoubleClick}
                        dangerouslySetInnerHTML={{ __html: renderKnowledgeRichText(selectedAsset.content) }}
                      />
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
                  </>
                ) : (
                  <div className="bg-surface-container-low border border-outline-variant/60 rounded-xl p-4 space-y-4">
                    <h3 className="text-xs font-bold text-primary flex items-center gap-4 border-b border-outline-variant/60 pb-2">
                      <Paperclip className="w-4 h-4" /> 附件汇总
                    </h3>
                    {selectedAssetAttachments.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3">
                        {selectedAssetAttachments.map(item => (
                          <div key={item.id} className="bg-white border border-outline-variant/50 rounded-xl p-3 shadow-sm">
                            <div className="flex items-start gap-3">
                              <div className="w-12 h-12 rounded-xl bg-[#5F52EE]/8 text-[#5F52EE] flex items-center justify-center shrink-0 overflow-hidden border border-[#5F52EE]/10">
                                {item.previewSrc ? (
                                  <img src={item.previewSrc} alt={item.label} className="w-full h-full object-cover" />
                                ) : item.type === 'link' ? (
                                  <ExternalLink className="w-5 h-5" />
                                ) : item.type === 'practice' ? (
                                  <BookOpen className="w-5 h-5" />
                                ) : item.type === 'source' ? (
                                  <Folder className="w-5 h-5" />
                                ) : (
                                  <FileText className="w-5 h-5" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-black text-[#0D0B3D] truncate">{item.label}</p>
                                    <p className="text-[11px] font-bold text-slate-400 mt-1 break-all">{item.meta}</p>
                                  </div>
                                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-slate-50 text-slate-500 border border-slate-100 shrink-0">
                                    {item.type}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-3">
                                  {item.previewSrc && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPreviewZoom(1);
                                        setPreviewImage({ src: item.previewSrc!, alt: item.label });
                                      }}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5F52EE] text-white hover:bg-[#4E41DC] transition cursor-pointer text-[11px] font-black"
                                    >
                                      <ImageIcon className="w-3.5 h-3.5" />
                                      预览图片
                                    </button>
                                  )}
                                  {item.href && (
                                    <a
                                      href={item.href}
                                      target={item.href.startsWith('/evidence/') ? '_self' : '_blank'}
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-outline-variant hover:bg-surface-container-low text-on-surface font-black transition cursor-pointer text-[11px]"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      打开
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-outline-variant bg-white p-6 text-center">
                        <Paperclip className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm font-bold text-primary">暂无可识别附件</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Preview */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeImagePreview}
            onWheel={handlePreviewWheel}
            className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 overflow-hidden"
            data-testid="knowledge-image-preview"
          >
            <button
              type="button"
              onClick={closeImagePreview}
              className="absolute right-5 top-5 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              title="关闭图片预览"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="absolute left-5 top-5 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white/90">
              滚轮缩放 · {Math.round(previewZoom * 100)}%
            </div>
            <motion.img
              initial={{ scale: 0.96 }}
              animate={{ scale: previewZoom }}
              exit={{ scale: 0.96 }}
              src={previewImage.src}
              alt={previewImage.alt}
              onClick={(e) => e.stopPropagation()}
              className="max-w-[92vw] max-h-[88vh] object-contain rounded-xl bg-white shadow-2xl cursor-zoom-in select-none"
              data-testid="knowledge-image-preview-img"
              draggable={false}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Edit Drawer */}
      <AnimatePresence>
        {isBulkEditOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeBulkEditDrawer}
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
                  <Layers className="w-5 h-5 text-primary" />
                  批量编辑知识卡片
                </h3>
                <button type="button" onClick={closeBulkEditDrawer} className="text-on-surface-variant hover:text-on-surface cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={applyBulkEdit} className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs bg-surface-container/30">
                  <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-on-surface-variant font-bold">已选择</div>
                        <div className="text-lg font-black text-[#0D0B3D]">{selectedAssets.length} 张知识卡片</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedAssetIds([])}
                        className="px-3 py-2 bg-white border border-outline-variant hover:bg-surface-container-low text-on-surface font-bold rounded-xl transition cursor-pointer shadow-sm"
                      >
                        清空选择
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedAssetCategories.map(category => (
                        <span key={category} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black border ${getCategoryThemeClasses(category)}`}>
                          {CATEGORY_MAP[category].label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 space-y-3 shadow-sm">
                    <h4 className="font-bold text-primary flex items-center gap-4 pb-2 border-b border-outline-variant/60">
                      <Sliders className="w-4 h-4" /> 基础字段
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label htmlFor="bulk-category" className="text-on-surface-variant font-bold block">数据表类型</label>
                        <select
                          id="bulk-category"
                          value={bulkCategory}
                          onChange={(event) => {
                            setBulkCategory(event.target.value as KnowledgeTableType | '');
                            setBulkFieldName('');
                            setBulkFieldValue('');
                          }}
                          className="w-full bg-white border border-outline-variant rounded-xl px-3 py-2.5 text-on-surface outline-none focus:border-primary/50 font-medium shadow-sm cursor-pointer"
                        >
                          <option value="">不修改分类</option>
                          {(Object.keys(CATEGORY_MAP) as KnowledgeTableType[]).map(category => (
                            <option key={category} value={category}>{CATEGORY_MAP[category].label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="bulk-author" className="text-on-surface-variant font-bold block">责任人</label>
                        <input
                          id="bulk-author"
                          type="text"
                          value={bulkAuthor}
                          onChange={(event) => setBulkAuthor(event.target.value)}
                          placeholder="留空不修改"
                          className="w-full bg-white border border-outline-variant rounded-xl px-3 py-2.5 text-on-surface outline-none focus:border-primary/50 font-medium shadow-sm placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="bulk-tags" className="text-on-surface-variant font-bold block">追加标签</label>
                      <input
                        id="bulk-tags"
                        type="text"
                        value={bulkTags}
                        onChange={(event) => setBulkTags(event.target.value)}
                        placeholder="例如：主推，需复核，客户常问"
                        className="w-full bg-white border border-outline-variant rounded-xl px-3 py-2.5 text-on-surface outline-none focus:border-primary/50 font-medium shadow-sm placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 space-y-3 shadow-sm">
                    <h4 className="font-bold text-primary flex items-center gap-4 pb-2 border-b border-outline-variant/60">
                      <Layers className="w-4 h-4" /> 结构化字段
                    </h4>
                    <div className="space-y-2">
                      <label htmlFor="bulk-field-name" className="text-on-surface-variant font-bold block">字段名称</label>
                      <select
                        id="bulk-field-name"
                        value={bulkFieldName}
                        onChange={(event) => {
                          const fieldName = event.target.value;
                          const nextField = bulkSchema.fields.find(field => field.name === fieldName);
                          setBulkFieldName(fieldName);
                          setBulkFieldValue(nextField?.type === 'select' ? nextField.options?.[0] ?? '' : '');
                        }}
                        disabled={!canBulkEditStructuredField}
                        className="w-full bg-white border border-outline-variant rounded-xl px-3 py-2.5 text-on-surface outline-none focus:border-primary/50 font-medium shadow-sm cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                      >
                        <option value="">{canBulkEditStructuredField ? '选择要修改的字段' : '先选择统一分类或单一分类卡片'}</option>
                        {canBulkEditStructuredField && bulkSchema.fields.map(field => (
                          <option key={field.name} value={field.name}>{field.label}</option>
                        ))}
                      </select>
                    </div>

                    {bulkFieldName && (() => {
                      const selectedField = bulkSchema.fields.find(field => field.name === bulkFieldName);
                      if (!selectedField) return null;
                      if (selectedField.type === 'select' && selectedField.options) {
                        return (
                          <div className="space-y-2">
                            <label htmlFor="bulk-field-value" className="text-on-surface-variant font-bold block">字段内容</label>
                            <select
                              id="bulk-field-value"
                              value={bulkFieldValue}
                              onChange={(event) => setBulkFieldValue(event.target.value)}
                              className="w-full bg-white border border-outline-variant rounded-xl px-3 py-2.5 text-on-surface outline-none focus:border-primary/50 font-medium shadow-sm cursor-pointer"
                            >
                              {selectedField.options.map(option => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-2">
                          <label className="text-on-surface-variant font-bold block">字段内容</label>
                          <RichKnowledgeEditor
                            id="bulk-field-value"
                            value={bulkFieldValue}
                            placeholder={selectedField.placeholder || `批量修改${selectedField.label}`}
                            onChange={setBulkFieldValue}
                            minHeight={selectedField.type === 'textarea' ? 'min-h-[112px]' : 'min-h-[76px]'}
                            uploadContext={{ assetId: 'bulk-edit', fieldName: selectedField.name }}
                            onUploadAttachment={handleEditorAttachmentUpload}
                            onUploadError={(message) => showToast(message, 3600)}
                          />
                        </div>
                      );
                    })()}
                  </div>

                  <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 space-y-3 shadow-sm">
                    <h4 className="font-bold text-primary flex items-center gap-4 pb-2 border-b border-outline-variant/60">
                      <BookText className="w-4 h-4" /> 详细内容
                    </h4>
                    <div className="flex items-center gap-2 bg-white border border-outline-variant rounded-xl p-1 w-max shadow-sm">
                      {[
                        { id: 'append', label: '追加' },
                        { id: 'replace', label: '替换' },
                      ].map(option => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setBulkContentMode(option.id as 'append' | 'replace')}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition cursor-pointer ${
                            bulkContentMode === option.id ? 'bg-[#5F52EE] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <RichKnowledgeEditor
                      id="bulk-content"
                      value={bulkContent}
                      placeholder="支持 Markdown、图片、链接、URL..."
                      onChange={setBulkContent}
                      minHeight="min-h-[132px]"
                      uploadContext={{ assetId: 'bulk-edit', fieldName: 'content' }}
                      onUploadAttachment={handleEditorAttachmentUpload}
                      onUploadError={(message) => showToast(message, 3600)}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-4 px-1.5 py-2.5 bg-surface-container-low border-t border-outline-variant/60 shrink-0">
                  <button
                    type="button"
                    onClick={closeBulkEditDrawer}
                    className="px-2.5 py-2.5 bg-white border border-outline-variant hover:bg-surface-container-low text-on-surface font-bold rounded-xl transition cursor-pointer shadow-sm"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-2.5 py-2.5 bg-primary hover:bg-primary-container text-white font-bold rounded-xl shadow-md transition cursor-pointer"
                    id="save-bulk-knowledge-btn"
                  >
                    保存批量修改
                  </button>
                </div>
              </form>
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
            onClick={closeAssetForm}
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
                  {editingAsset ? <Pencil className="w-5 h-5 text-primary" /> : <PlusCircle className="w-5 h-5 text-primary" />}
                  {editingAsset ? '编辑知识云卡片' : '录入知识云主数据'}
                </h3>
                <button type="button" onClick={closeAssetForm} className="text-on-surface-variant hover:text-on-surface cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs bg-surface-container/30">
                  
                  {/* Step 1: Base Type & Title */}
                  <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 space-y-3 shadow-sm">
                    <div className="space-y-3">
                      <label className="text-on-surface-variant font-bold block">1. 选择数据表类型</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(CATEGORY_MAP) as KnowledgeTableType[]).map((cat) => (
                          <label key={cat} className={`flex items-center gap-2 p-4 rounded-xl border cursor-pointer transition ${newCategory === cat ? 'bg-primary/5 border-primary/50 text-primary' : 'bg-white border-outline-variant text-on-surface hover:bg-surface-container-low'}`}>
                            <input 
                              type="radio" 
                              name="knowledgeType" 
                              value={cat} 
                              checked={newCategory === cat} 
                              onChange={(e) => handleCategoryChange(e.target.value as KnowledgeTableType)}
                              className="hidden" 
                            />
                            {CATEGORY_MAP[cat].icon}
                            <span className="font-bold">{CATEGORY_MAP[cat].label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-on-surface-variant font-bold block">知识条目标题</label>
                      <input
                        type="text"
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
                      <RichKnowledgeEditor
                        id="knowledge-field-content"
                        placeholder="补充描述或非结构化的经验说明..."
                        value={newContent}
                        onChange={setNewContent}
                        minHeight="min-h-[132px]"
                        uploadContext={{ assetId: editingAsset?.id, fieldName: 'content' }}
                        onUploadAttachment={handleEditorAttachmentUpload}
                        onUploadError={(message) => showToast(message, 3600)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-3">
                        <label className="text-on-surface-variant font-bold block">责任人</label>
                        <input
                          type="text"
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
                    onClick={closeAssetForm}
                    className="px-2.5 py-2.5 bg-white border border-outline-variant hover:bg-surface-container-low text-on-surface font-bold rounded-xl transition cursor-pointer shadow-sm"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-2.5 py-2.5 bg-primary hover:bg-primary-container text-white font-bold rounded-xl shadow-md transition cursor-pointer"
                    id="save-knowledge-btn"
                  >
                    {editingAsset ? '保存修改' : '提交审核并发布'}
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
