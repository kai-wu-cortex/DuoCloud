export function createEvidenceShareUrl(origin: string, evidenceNo: string) {
  return `${origin.replace(/\/+$/, '')}/evidence/${encodeURIComponent(evidenceNo)}`;
}

export function createEvidenceShareText(origin: string, evidenceNo: string) {
  return `【打样证据 App】查看详细报告与测试交互画板：${createEvidenceShareUrl(origin, evidenceNo)}`;
}
