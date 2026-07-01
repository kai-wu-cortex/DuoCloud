import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankEvidencePage, getPageSelectionAfterDelete } from './evidencePages';

test('new evidence pages return an active section id that exists on the page', () => {
  let value = 1000;
  const nextId = () => String(value++);

  const result = createBlankEvidencePage(3, nextId);

  assert.equal(result.page.id, 'page-1000');
  assert.equal(result.page.sections[0].id, 'sec-header-1001');
  assert.equal(result.page.sections[1].id, 'sec-text-1002');
  assert.equal(result.activeSectionId, 'sec-header-1001');
  assert.ok(result.page.sections.some(section => section.id === result.activeSectionId));
});

test('deleting the active evidence page selects the first section on the next page', () => {
  const first = createBlankEvidencePage(1, () => 'a').page;
  const second = createBlankEvidencePage(2, () => 'b').page;

  const result = getPageSelectionAfterDelete(
    [first, second],
    second.id,
    second.sections[1].id,
    second.id,
  );

  assert.ok(result);
  assert.equal(result?.pages.length, 1);
  assert.equal(result?.activePageId, first.id);
  assert.equal(result?.activeSectionId, first.sections[0].id);
});

test('deleting an inactive evidence page preserves the current page and section', () => {
  const first = createBlankEvidencePage(1, () => 'a').page;
  const second = createBlankEvidencePage(2, () => 'b').page;

  const result = getPageSelectionAfterDelete(
    [first, second],
    first.id,
    first.sections[1].id,
    second.id,
  );

  assert.ok(result);
  assert.equal(result?.pages.length, 1);
  assert.equal(result?.activePageId, first.id);
  assert.equal(result?.activeSectionId, first.sections[1].id);
});

test('deleting the last evidence page is rejected', () => {
  const page = createBlankEvidencePage(1, () => 'a').page;

  assert.equal(getPageSelectionAfterDelete([page], page.id, page.sections[0].id, page.id), null);
});
