import {
  handleKnowledgeAssetAgentRequest,
  sendKnowledgeAssetError,
} from '../../src/server/knowledgeAssetApi.ts';

export default async function handler(
  req: Parameters<typeof handleKnowledgeAssetAgentRequest>[0],
  res: Parameters<typeof handleKnowledgeAssetAgentRequest>[1],
) {
  try {
    return await handleKnowledgeAssetAgentRequest(req, res);
  } catch (error) {
    return sendKnowledgeAssetError(res, error);
  }
}
