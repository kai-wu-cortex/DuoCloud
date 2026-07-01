import assert from 'node:assert/strict';
import test from 'node:test';
import { createEvidenceShareText, createEvidenceShareUrl } from './shareLinks';

test('evidence share URL is built from origin and evidence number', () => {
  assert.equal(
    createEvidenceShareUrl('http://localhost:3000/', 'SY-2026-803609-PPAD'),
    'http://localhost:3000/evidence/SY-2026-803609-PPAD',
  );
});

test('evidence share text contains the evidence app URL', () => {
  assert.equal(
    createEvidenceShareText('http://localhost:3000', 'SY-2026-803609-PPAD'),
    '【打样证据 App】查看详细报告与测试交互画板：http://localhost:3000/evidence/SY-2026-803609-PPAD',
  );
});
