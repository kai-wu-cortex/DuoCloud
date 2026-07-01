import {
  handleKnowledgeAssetsRequest,
  sendKnowledgeAssetError,
} from '../../src/server/knowledgeAssetApi.ts';

export default async function handler(
  req: Parameters<typeof handleKnowledgeAssetsRequest>[0],
  res: Parameters<typeof handleKnowledgeAssetsRequest>[1],
) {
  try {
    return await handleKnowledgeAssetsRequest(req, res);
  } catch (error) {
    return sendKnowledgeAssetError(res, error);
  }
}
