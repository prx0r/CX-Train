import { SimPack } from './types';
import { getOutlookWorkOfflinePack, OUTLOOK_WORK_OFFLINE_PACK_ID } from './packConfig';

const registry: Record<string, () => SimPack> = {
  [OUTLOOK_WORK_OFFLINE_PACK_ID]: getOutlookWorkOfflinePack,
};

export function getPackById(packId: string): SimPack {
  const factory = registry[packId];
  if (!factory) {
    throw new Error(`Unknown sim pack: "${packId}". Supported packs: ${Object.keys(registry).join(', ')}`);
  }
  return factory();
}

export function getPackIdForMode(assessmentMode: string, preferredPackId?: string | null): string {
  if (assessmentMode !== 'dashboard_sim') {
    throw new Error(`Assessment mode "${assessmentMode}" is not a sim mode`);
  }
  if (preferredPackId && registry[preferredPackId]) {
    return preferredPackId;
  }
  return OUTLOOK_WORK_OFFLINE_PACK_ID;
}

export function listPacks(): { id: string; title: string }[] {
  return Object.entries(registry).map(([id, factory]) => {
    const pack = factory();
    return { id, title: pack.title };
  });
}
