import type { CapabilityDefinition } from '../contracts/capability';
import { getManagerPackSummaries } from '../manager/context';

export const listSimPacksCapability: CapabilityDefinition<{}, Array<{ id: string; title: string }>> = {
  name: 'list_sim_packs',
  domain: 'sim_pack',
  access: 'read',
  requiresConfirmation: false,
  inputSchemaVersion: 'list-sim-packs-input-v1',
  outputSchemaVersion: 'sim-pack-summary-list-v1',
  description: 'List all available simulation pack summaries (id, title, version, description). No input required.',
  inputFields: {},
  async handler(_input, ctx) {
    return getManagerPackSummaries(ctx.managerProfileId);
  },
};
