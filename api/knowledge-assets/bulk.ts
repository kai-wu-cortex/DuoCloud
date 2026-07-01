import {
  handleKnowledgeAssetBulkRequest,
  sendKnowledgeAssetError,
} from '../../src/server/knowledgeAssetApi.ts';

export default async function handler(
  req: Parameters<typeof handleKnowledgeAssetBulkRequest>[0],
  res: Parameters<typeof handleKnowledgeAssetBulkRequest>[1],
) {
  try {
    return await handleKnowledgeAssetBulkRequest(req, res);
  } catch (error) {
    return sendKnowledgeAssetError(res, error);
  }
}
