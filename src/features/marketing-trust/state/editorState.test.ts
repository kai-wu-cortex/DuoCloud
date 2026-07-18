import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEvidenceEditorState,
  evidenceEditorReducer,
} from './editorState';

test('drawer retains table scroll position and tracks save lifecycle', () => {
  let state = createEvidenceEditorState();
  state = evidenceEditorReducer(state, {
    type: 'open',
    evidenceId: 'MKT-1',
    version: 3,
    draft: { title: '原始标题' },
    scrollTop: 640,
  });
  state = evidenceEditorReducer(state, {
    type: 'change',
    patch: { title: '本地修改' },
  });
  assert.equal(state.saveStatus, 'dirty');
  state = evidenceEditorReducer(state, { type: 'saveStarted', requestId: 7 });
  assert.equal(state.saveStatus, 'saving');
  state = evidenceEditorReducer(state, {
    type: 'saveSucceeded',
    requestId: 7,
    version: 4,
  });
  assert.equal(state.saveStatus, 'synced');
  assert.equal(state.baseVersion, 4);
  state = evidenceEditorReducer(state, { type: 'close' });
  assert.equal(state.scrollTop, 640);
});

test('409 conflict preserves local draft until reload or save-as-draft decision', () => {
  let state = createEvidenceEditorState();
  state = evidenceEditorReducer(state, {
    type: 'open',
    evidenceId: 'MKT-1',
    version: 2,
    draft: { title: '服务器标题' },
    scrollTop: 0,
  });
  state = evidenceEditorReducer(state, {
    type: 'change',
    patch: { title: '不能丢失的本地标题' },
  });
  state = evidenceEditorReducer(state, { type: 'saveStarted', requestId: 8 });
  state = evidenceEditorReducer(state, {
    type: 'saveConflicted',
    requestId: 8,
    details: { currentVersion: 3 },
  });

  assert.equal(state.saveStatus, 'conflict');
  assert.equal(state.draft.title, '不能丢失的本地标题');

  const reloaded = evidenceEditorReducer(state, {
    type: 'reload',
    version: 3,
    draft: { title: '最新服务器标题' },
  });
  assert.equal(reloaded.draft.title, '最新服务器标题');
  assert.equal(reloaded.saveStatus, 'synced');

  const copied = evidenceEditorReducer(state, { type: 'saveAsNewDraft' });
  assert.equal(copied.mode, 'create');
  assert.equal(copied.evidenceId, null);
  assert.equal(copied.draft.title, '不能丢失的本地标题');
});

test('network failure marks draft unsynced and stale save responses are ignored', () => {
  let state = createEvidenceEditorState();
  state = evidenceEditorReducer(state, {
    type: 'open',
    evidenceId: 'MKT-1',
    version: 1,
    draft: { title: '证据' },
    scrollTop: 0,
  });
  state = evidenceEditorReducer(state, { type: 'change', patch: { title: '修改' } });
  state = evidenceEditorReducer(state, { type: 'saveStarted', requestId: 10 });
  state = evidenceEditorReducer(state, {
    type: 'saveFailed',
    requestId: 10,
    message: '断网',
  });
  assert.equal(state.saveStatus, 'unsynced');
  state = evidenceEditorReducer(state, {
    type: 'saveSucceeded',
    requestId: 9,
    version: 2,
  });
  assert.equal(state.saveStatus, 'unsynced');
});
