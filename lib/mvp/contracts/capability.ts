export const CAPABILITY_CONTRACT_VERSION = 'capability-v1';

export type CapabilityDomain =
  | 'assessment'
  | 'result'
  | 'standards'
  | 'sim_pack'
  | 'training'
  | 'navigation'
  | 'memory'
  | 'audio';

export type CapabilityAccess = 'read' | 'propose' | 'execute';

export interface CapabilityContext {
  managerProfileId: string;
  threadId?: string;
  pageContext?: unknown;
}

export interface CapabilityDefinition<Input = unknown, Output = unknown> {
  name: string;
  domain: CapabilityDomain;
  access: CapabilityAccess;
  requiresConfirmation: boolean;
  inputSchemaVersion: string;
  outputSchemaVersion: string;
  handler: (input: Input, ctx: CapabilityContext) => Promise<Output>;
}

export interface CapabilityInvocationResult {
  capability: string;
  ok: boolean;
  output?: unknown;
  error?: string;
}
