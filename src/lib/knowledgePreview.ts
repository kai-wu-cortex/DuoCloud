function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, '[图片]')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[*_`~]+/g, '');
}

export function getKnowledgePreviewText(value: string) {
  const source = String(value ?? '');
  const insightMatch = source.match(/##\s*一眼识别\s*([\s\S]*?)(?=\n##\s+|$)/);
  const focused = insightMatch?.[1]?.trim() || source;

  const plainText = decodeEntities(focused
    .replace(/<img\b[^>]*>/gi, '[图片]')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, ' '));

  return stripMarkdown(plainText).replace(/\s+/g, ' ').trim();
}
