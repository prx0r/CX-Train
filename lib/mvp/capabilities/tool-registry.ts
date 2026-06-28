import { listCapabilities } from './registry';
import type { CapabilityDefinition, CapabilityContext, CapabilityInvocationResult } from '../contracts/capability';
import type { FieldSchema } from '../schema/tool';
import { validateObject, describeSchema } from '../schema/tool';

export interface ToolDescriptor {
  name: string;
  description: string;
  domain: string;
  access: string;
  requiresConfirmation: boolean;
  inputSchema: Record<string, FieldSchema>;
  inputSchemaDescription: string;
}

export function listTools(): ToolDescriptor[] {
  return listCapabilities().map(cap => ({
    name: cap.name,
    description: cap.description || cap.name,
    domain: cap.domain,
    access: cap.access,
    requiresConfirmation: cap.requiresConfirmation,
    inputSchema: cap.inputFields || {},
    inputSchemaDescription: cap.inputFields ? describeSchema(cap.inputFields) : 'No schema defined',
  }));
}

export function getToolByName(name: string): ToolDescriptor | null {
  return listTools().find(t => t.name === name) || null;
}

export async function invokeTool(
  name: string,
  input: unknown,
  ctx: CapabilityContext,
): Promise<CapabilityInvocationResult> {
  const { invokeCapability } = await import('./registry');
  return invokeCapability(name, input, ctx);
}
