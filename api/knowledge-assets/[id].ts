import {
  handleKnowledgeAssetDocumentRequest,
  sendKnowledgeAssetError,
} from '../../src/server/knowledgeAssetApi.ts';

export default async function handler(
  req: Parameters<typeof handleKnowledgeAssetDocumentRequest>[0],
  res: Parameters<typeof handleKnowledgeAssetDocumentRequest>[1],
) {
  try {
    return await handleKnowledgeAssetDocumentRequest(req, res);
  } catch (error) {
    return sendKnowledgeAssetError(res, error);
  }
}
