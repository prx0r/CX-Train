import {
  type CapabilityContext,
  type CapabilityDefinition,
  type CapabilityInvocationResult,
} from '../contracts/capability';

const registry = new Map<string, CapabilityDefinition<any, any>>();

export function registerCapability(definition: CapabilityDefinition<any, any>): void {
  if (registry.has(definition.name)) {
    throw new Error(`Capability already registered: ${definition.name}`);
  }
  registry.set(definition.name, definition);
}

export function getCapability(name: string): CapabilityDefinition<any, any> | null {
  return registry.get(name) || null;
}

export function listCapabilities(): CapabilityDefinition<any, any>[] {
  return [...registry.values()];
}

export async function invokeCapability(
  name: string,
  input: unknown,
  ctx: CapabilityContext,
): Promise<CapabilityInvocationResult> {
  const capability = getCapability(name);
  if (!capability) {
    return { capability: name, ok: false, error: `Unknown capability: ${name}` };
  }

  if (capability.access === 'execute' && capability.requiresConfirmation) {
    return {
      capability: name,
      ok: false,
      error: `Capability "${name}" requires a confirmed proposal before execution`,
    };
  }

  try {
    const output = await capability.handler(input as any, ctx);
    return { capability: name, ok: true, output };
  } catch (err) {
    return {
      capability: name,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
