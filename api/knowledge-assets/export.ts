import {
  handleKnowledgeAssetExportRequest,
  sendKnowledgeAssetError,
} from '../../src/server/knowledgeAssetApi.ts';

export default async function handler(
  req: Parameters<typeof handleKnowledgeAssetExportRequest>[0],
  res: Parameters<typeof handleKnowledgeAssetExportRequest>[1],
) {
  try {
    return await handleKnowledgeAssetExportRequest(req, res);
  } catch (error) {
    return sendKnowledgeAssetError(res, error);
  }
}
