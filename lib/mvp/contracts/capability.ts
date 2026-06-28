import type { FieldSchema } from '../schema/tool';

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
  /** Optional field schemas for LLM tool-calling. Keys are field names. */
  inputFields?: Record<string, FieldSchema>;
  /** Optional field schemas for output validation. */
  outputFields?: Record<string, FieldSchema>;
  /** Short description for LLM tool selection. */
  description?: string;
}

export interface CapabilityInvocationResult {
  capability: string;
  ok: boolean;
  output?: unknown;
  error?: string;
}
