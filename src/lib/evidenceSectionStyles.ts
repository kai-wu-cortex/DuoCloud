import type { EvidenceSection } from './evidencePages';

interface TextStyleClassOptions {
  baseWeight?: string;
  activeBoldWeight?: string;
}

export function getEvidenceTextStyleClassName(
  section: Pick<EvidenceSection, 'isBold' | 'isItalic' | 'isUnderlined'>,
  options: TextStyleClassOptions = {},
) {
  const { baseWeight = 'font-normal', activeBoldWeight = 'font-bold' } = options;

  return [
    section.isBold ? activeBoldWeight : baseWeight,
    section.isItalic ? 'italic' : '',
    section.isUnderlined ? 'underline' : '',
  ].filter(Boolean).join(' ');
}
