import { renderKnowledgeRichText } from './knowledgeFieldSchemas';

export type MarkdownEditorMode = 'rich' | 'code' | 'preview';
export const DEFAULT_MARKDOWN_EDITOR_MODE: MarkdownEditorMode = 'code';

export function getMarkdownEditorModeValue(value: string, mode: MarkdownEditorMode) {
  if (mode === 'preview') return renderKnowledgeRichText(value);
  return value;
}
