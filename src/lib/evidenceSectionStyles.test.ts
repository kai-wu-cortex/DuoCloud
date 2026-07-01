import assert from 'node:assert/strict';
import test from 'node:test';
import { getEvidenceTextStyleClassName } from './evidenceSectionStyles';
import type { EvidenceSection } from './evidencePages';

const section = (styles: Partial<EvidenceSection>): EvidenceSection => ({
  id: 'sec-style',
  type: 'header',
  title: 'Style target',
  ...styles,
});

test('text style class names include active bold italic and underline flags', () => {
  const className = getEvidenceTextStyleClassName(
    section({ isBold: true, isItalic: true, isUnderlined: true }),
    { baseWeight: 'font-normal', activeBoldWeight: 'font-bold' },
  );

  assert.match(className, /\bfont-bold\b/);
  assert.match(className, /\bitalic\b/);
  assert.match(className, /\bunderline\b/);
  assert.doesNotMatch(className, /\bfont-normal\b/);
});

test('text style class names keep the default weight when bold is inactive', () => {
  const className = getEvidenceTextStyleClassName(
    section({ isBold: false, isItalic: false, isUnderlined: false }),
    { baseWeight: 'font-bold', activeBoldWeight: 'font-black' },
  );

  assert.equal(className, 'font-bold');
});
