import type {
  MarketingEvidenceContentForm,
  MarketingEvidenceStatus,
} from '../domain/types';

export type MarketingTrustView = 'primary' | 'drafts' | 'review';

interface EvidenceQuerySnapshot {
  search: string;
  statuses: MarketingEvidenceStatus[];
  contentForms: MarketingEvidenceContentForm[];
  sortField: string;
  sortDirection: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface EvidenceQueryState extends EvidenceQuerySnapshot {
  view: MarketingTrustView;
  selectedIds: Set<string>;
  savedByView: Partial<Record<MarketingTrustView, EvidenceQuerySnapshot>>;
}

function defaults(view: MarketingTrustView): EvidenceQuerySnapshot {
  return {
    search: '',
    statuses: view === 'drafts'
      ? ['private_draft', 'rejected']
      : view === 'review' ? ['pending_review'] : [],
    contentForms: [],
    sortField: 'updatedAt',
    sortDirection: 'desc',
    page: 1,
    pageSize: 20,
  };
}

function snapshot(state: EvidenceQueryState): EvidenceQuerySnapshot {
  return {
    search: state.search,
    statuses: [...state.statuses],
    contentForms: [...state.contentForms],
    sortField: state.sortField,
    sortDirection: state.sortDirection,
    page: state.page,
    pageSize: state.pageSize,
  };
}

export function createEvidenceQueryState(
  view: MarketingTrustView = 'primary',
): EvidenceQueryState {
  return {
    view,
    ...defaults(view),
    selectedIds: new Set(),
    savedByView: {},
  };
}

export type EvidenceQueryAction =
  | { type: 'setSearch'; search: string }
  | {
      type: 'setFilter';
      key: 'statuses';
      values: MarketingEvidenceStatus[];
    }
  | {
      type: 'setFilter';
      key: 'contentForms';
      values: MarketingEvidenceContentForm[];
    }
  | { type: 'setQuickFilter'; contentForm?: MarketingEvidenceContentForm }
  | { type: 'setSort'; field: string; direction: 'asc' | 'desc' }
  | { type: 'setPage'; page: number }
  | { type: 'setPageSize'; pageSize: number }
  | { type: 'toggleSelected'; evidenceId: string }
  | { type: 'selectPage'; evidenceIds: string[] }
  | { type: 'clearSelection' }
  | { type: 'setView'; view: MarketingTrustView };

function queryChanged(
  state: EvidenceQueryState,
  patch: Partial<EvidenceQuerySnapshot>,
): EvidenceQueryState {
  return {
    ...state,
    ...patch,
    page: patch.page ?? 1,
    selectedIds: new Set(),
  };
}

export function evidenceQueryReducer(
  state: EvidenceQueryState,
  action: EvidenceQueryAction,
): EvidenceQueryState {
  switch (action.type) {
    case 'setSearch':
      return queryChanged(state, { search: action.search });
    case 'setFilter':
      return queryChanged(state, { [action.key]: [...action.values] });
    case 'setQuickFilter':
      return queryChanged(state, {
        contentForms: action.contentForm ? [action.contentForm] : [],
      });
    case 'setSort':
      return queryChanged(state, {
        sortField: action.field,
        sortDirection: action.direction,
      });
    case 'setPage':
      return {
        ...state,
        page: Math.max(1, action.page),
        selectedIds: new Set(),
      };
    case 'setPageSize':
      return queryChanged(state, {
        pageSize: Math.min(100, Math.max(1, action.pageSize)),
      });
    case 'toggleSelected': {
      const selectedIds = new Set(state.selectedIds);
      if (selectedIds.has(action.evidenceId)) selectedIds.delete(action.evidenceId);
      else selectedIds.add(action.evidenceId);
      return { ...state, selectedIds };
    }
    case 'selectPage':
      return { ...state, selectedIds: new Set(action.evidenceIds) };
    case 'clearSelection':
      return { ...state, selectedIds: new Set() };
    case 'setView': {
      if (action.view === state.view) return state;
      const savedByView = {
        ...state.savedByView,
        [state.view]: snapshot(state),
      };
      return {
        view: action.view,
        ...(savedByView[action.view] ?? defaults(action.view)),
        selectedIds: new Set(),
        savedByView,
      };
    }
  }
}

export function hasBulkSelection(state: EvidenceQueryState): boolean {
  return state.selectedIds.size > 0;
}
