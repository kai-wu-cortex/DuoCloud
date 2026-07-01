export interface EvidenceSection {
  id: string;
  type: 'header' | 'text' | 'process_data' | 'image' | 'video' | 'metrics_table' | 'operator_notes' | 'knowledge_refs';
  title: string;
  content?: string;
  imageUrl?: string;
  videoUrl?: string;
  videoPlaying?: boolean;
  videoProgress?: number;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderlined?: boolean;
  listItems?: string[];
}

export interface EvidencePage {
  id: string;
  name: string;
  visible: boolean;
  sections: EvidenceSection[];
}

function defaultIdSeed() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createBlankEvidencePage(pageNumber: number, nextId: () => string = defaultIdSeed) {
  const pageId = `page-${nextId()}`;
  const headerSectionId = `sec-header-${nextId()}`;
  const textSectionId = `sec-text-${nextId()}`;

  const page: EvidencePage = {
    id: pageId,
    name: `Page ${pageNumber}`,
    visible: true,
    sections: [
      {
        id: headerSectionId,
        type: 'header',
        title: `全新页面 (页码 ${pageNumber})`,
        content: '双击左侧的导航器可以重命名页面，利用下方的添加组件和主题配置，快速丰富您的对账报告画板。'
      },
      {
        id: textSectionId,
        type: 'text',
        title: '空组件段落',
        content: '请在侧边栏中选择插入图片、操作视频或关联您在知识云库中沉淀的标答文献来完成这页打样佐证。'
      }
    ]
  };

  return {
    page,
    activeSectionId: headerSectionId,
  };
}

export function getPageSelectionAfterDelete(
  pages: EvidencePage[],
  activePageId: string,
  activeSectionId: string,
  pageIdToDelete: string,
) {
  if (pages.length <= 1) return null;

  const nextPages = pages.filter(page => page.id !== pageIdToDelete);
  if (activePageId !== pageIdToDelete) {
    return {
      pages: nextPages,
      activePageId,
      activeSectionId,
    };
  }

  const nextActivePage = nextPages[0];
  return {
    pages: nextPages,
    activePageId: nextActivePage.id,
    activeSectionId: nextActivePage.sections[0]?.id ?? '',
  };
}
