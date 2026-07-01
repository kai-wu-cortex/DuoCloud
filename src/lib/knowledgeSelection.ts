import type { KnowledgeAsset } from '../types';

export function getKnowledgeCardClickState(asset: KnowledgeAsset) {
  return {
    activeCardId: asset.id,
    selectedAsset: asset,
  };
}
