import type { MarketingEvidenceDraft } from '../domain/types';

export type EvidenceEditorSaveStatus =
  | 'clean'
  | 'dirty'
  | 'saving'
  | 'synced'
  | 'unsynced'
  | 'conflict';

export interface EvidenceEditorState {
  isOpen: boolean;
  mode: 'create' | 'edit';
  evidenceId: string | null;
  baseVersion: number | null;
  draft: MarketingEvidenceDraft;
  saveStatus: EvidenceEditorSaveStatus;
  activeRequestId: number | null;
  errorMessage?: string;
  conflictDetails?: unknown;
  scrollTop: number;
}

export function createEvidenceEditorState(): EvidenceEditorState {
  return {
    isOpen: false,
    mode: 'create',
    evidenceId: null,
    baseVersion: null,
    draft: {},
    saveStatus: 'clean',
    activeRequestId: null,
    scrollTop: 0,
  };
}

function mergeDraft(
  base: MarketingEvidenceDraft,
  patch: MarketingEvidenceDraft,
): MarketingEvidenceDraft {
  const next = structuredClone(base) as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (
      value
      && typeof value === 'object'
      && !Array.isArray(value)
      && next[key]
      && typeof next[key] === 'object'
      && !Array.isArray(next[key])
    ) {
      next[key] = mergeDraft(
        next[key] as MarketingEvidenceDraft,
        value as MarketingEvidenceDraft,
      );
    } else {
      next[key] = structuredClone(value);
    }
  }
  return next as MarketingEvidenceDraft;
}

export type EvidenceEditorAction =
  | {
      type: 'open';
      evidenceId: string;
      version: number;
      draft: MarketingEvidenceDraft;
      scrollTop: number;
    }
  | { type: 'openCreate'; draft?: MarketingEvidenceDraft; scrollTop: number }
  | { type: 'close' }
  | { type: 'change'; patch: MarketingEvidenceDraft }
  | { type: 'saveStarted'; requestId: number }
  | { type: 'saveSucceeded'; requestId: number; version: number }
  | { type: 'saveFailed'; requestId: number; message: string }
  | { type: 'saveConflicted'; requestId: number; details?: unknown }
  | { type: 'reload'; version: number; draft: MarketingEvidenceDraft }
  | { type: 'saveAsNewDraft' };

export function evidenceEditorReducer(
  state: EvidenceEditorState,
  action: EvidenceEditorAction,
): EvidenceEditorState {
  switch (action.type) {
    case 'open':
      return {
        isOpen: true,
        mode: 'edit',
        evidenceId: action.evidenceId,
        baseVersion: action.version,
        draft: structuredClone(action.draft),
        saveStatus: 'clean',
        activeRequestId: null,
        scrollTop: action.scrollTop,
      };
    case 'openCreate':
      return {
        isOpen: true,
        mode: 'create',
        evidenceId: null,
        baseVersion: null,
        draft: structuredClone(action.draft ?? {}),
        saveStatus: 'dirty',
        activeRequestId: null,
        scrollTop: action.scrollTop,
      };
    case 'close':
      return { ...state, isOpen: false };
    case 'change':
      return {
        ...state,
        draft: mergeDraft(state.draft, action.patch),
        saveStatus: state.saveStatus === 'conflict' ? 'conflict' : 'dirty',
        errorMessage: undefined,
      };
    case 'saveStarted':
      if (state.saveStatus === 'conflict') return state;
      return {
        ...state,
        saveStatus: 'saving',
        activeRequestId: action.requestId,
        errorMessage: undefined,
      };
    case 'saveSucceeded':
      if (state.activeRequestId !== action.requestId) return state;
      return {
        ...state,
        baseVersion: action.version,
        saveStatus: 'synced',
        activeRequestId: null,
        errorMessage: undefined,
      };
    case 'saveFailed':
      if (state.activeRequestId !== action.requestId) return state;
      return {
        ...state,
        saveStatus: 'unsynced',
        activeRequestId: null,
        errorMessage: action.message,
      };
    case 'saveConflicted':
      if (state.activeRequestId !== action.requestId) return state;
      return {
        ...state,
        saveStatus: 'conflict',
        activeRequestId: null,
        conflictDetails: action.details,
      };
    case 'reload':
      return {
        ...state,
        baseVersion: action.version,
        draft: structuredClone(action.draft),
        saveStatus: 'synced',
        activeRequestId: null,
        errorMessage: undefined,
        conflictDetails: undefined,
      };
    case 'saveAsNewDraft':
      return {
        ...state,
        mode: 'create',
        evidenceId: null,
        baseVersion: null,
        saveStatus: 'dirty',
        activeRequestId: null,
        errorMessage: undefined,
        conflictDetails: undefined,
      };
  }
}
