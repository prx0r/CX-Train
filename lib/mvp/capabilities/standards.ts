import type { CapabilityDefinition } from '../contracts/capability';
import { getManagerStandardsContext } from '../manager/context';

export const getManagerStandardsCapability: CapabilityDefinition<{}, unknown> = {
  name: 'get_manager_standards',
  domain: 'standards',
  access: 'read',
  requiresConfirmation: false,
  inputSchemaVersion: 'get-manager-standards-input-v1',
  outputSchemaVersion: 'manager-standards-context-v1',
  description: 'Load manager-defined standards including required ticket fields, call requirements, escalation requirements, and good/bad ticket examples.',
  inputFields: {},
  async handler(_input, ctx) {
    return getManagerStandardsContext(ctx.managerProfileId);
  },
};
