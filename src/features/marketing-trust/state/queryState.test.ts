import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEvidenceQueryState,
  evidenceQueryReducer,
  hasBulkSelection,
} from './queryState';

test('search filters sort and pagination reset selection consistently', () => {
  let state = createEvidenceQueryState('primary');
  state = evidenceQueryReducer(state, { type: 'toggleSelected', evidenceId: 'MKT-1' });
  assert.equal(hasBulkSelection(state), true);

  state = evidenceQueryReducer(state, { type: 'setSearch', search: 'PET' });
  assert.equal(state.search, 'PET');
  assert.equal(state.page, 1);
  assert.equal(state.selectedIds.size, 0);

  state = evidenceQueryReducer(state, {
    type: 'setFilter',
    key: 'contentForms',
    values: ['image', 'video'],
  });
  state = evidenceQueryReducer(state, {
    type: 'setSort',
    field: 'trust.level',
    direction: 'asc',
  });
  state = evidenceQueryReducer(state, { type: 'setPage', page: 3 });

  assert.deepEqual(state.contentForms, ['image', 'video']);
  assert.equal(state.sortField, 'trust.level');
  assert.equal(state.sortDirection, 'asc');
  assert.equal(state.page, 3);
});

test('select current page, cancel all and page changes never leak cross-page selection', () => {
  let state = createEvidenceQueryState('primary');
  state = evidenceQueryReducer(state, {
    type: 'selectPage',
    evidenceIds: ['MKT-1', 'MKT-2'],
  });
  assert.deepEqual([...state.selectedIds], ['MKT-1', 'MKT-2']);
  state = evidenceQueryReducer(state, { type: 'setPage', page: 2 });
  assert.equal(state.selectedIds.size, 0);
  state = evidenceQueryReducer(state, {
    type: 'selectPage',
    evidenceIds: ['MKT-3'],
  });
  state = evidenceQueryReducer(state, { type: 'clearSelection' });
  assert.equal(hasBulkSelection(state), false);
});

test('quick filters and view changes clear incompatible actions and preserve view query snapshots', () => {
  let state = createEvidenceQueryState('primary');
  state = evidenceQueryReducer(state, {
    type: 'setQuickFilter',
    contentForm: 'comparison',
  });
  state = evidenceQueryReducer(state, {
    type: 'toggleSelected',
    evidenceId: 'MKT-1',
  });
  state = evidenceQueryReducer(state, { type: 'setView', view: 'drafts' });

  assert.equal(state.view, 'drafts');
  assert.deepEqual(state.statuses, ['private_draft', 'rejected']);
  assert.equal(state.selectedIds.size, 0);

  state = evidenceQueryReducer(state, { type: 'setSearch', search: '我的草稿' });
  state = evidenceQueryReducer(state, { type: 'setView', view: 'primary' });
  assert.equal(state.search, '');
  assert.deepEqual(state.contentForms, ['comparison']);
  state = evidenceQueryReducer(state, { type: 'setView', view: 'drafts' });
  assert.equal(state.search, '我的草稿');
});
