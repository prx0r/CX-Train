import { SimState, SimAction, SimPack, VisibleSimState, VisibleAction } from './types';

/**
 * Build a visibility mask based on what the candidate has discovered.
 * Generic — reads action's revealsToolState to determine which tool states
 * are visible. No per-tool hardcoded functions.
 */
function buildVisibilityMask(state: SimState, pack: SimPack): Set<string> {
  const visible = new Set<string>();

  /* Always visible metadata */
  visible.add('phase');
  visible.add('call.customerMood');
  visible.add('call.startedAt');
  visible.add('remote.connected');
  visible.add('remote.currentApp');

  /* If any action tagged with a tool's taxonomy tag was performed, that tool's state is visible */
  const toolPrefixes = new Map<string, string>();
  for (const action of pack.actions || []) {
    const tags = action.taxonomyTags || [];
    for (const tag of tags) {
      const parts = tag.split('.');
      if (parts.length >= 2 && parts[0] === 'tool') {
        const toolName = parts[1];
        toolPrefixes.set(toolName, `tool.${toolName}`);
      }
    }
  }

  for (const [toolName, prefix] of toolPrefixes) {
    if (state.discovered.some(d => d.startsWith(prefix))) {
      visible.add(`toolStates.${toolName}`);
    }
  }

  /* If fix was verified, reveal fix-related state */
  if (state.discovered.some(d => d.startsWith('fix.')) || state.evidence.verifiedFix) {
    for (const toolName of toolPrefixes.keys()) {
      visible.add(`toolStates.${toolName}.verified`);
    }
  }

  return visible;
}

function pickSafe(raw: SimState, pack: SimPack): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  const visible = buildVisibilityMask(raw, pack);

  safe.phase = raw.phase;

  safe.call = {
    customerMood: raw.call.customerMood,
    startedAt: raw.call.startedAt,
  };

  safe.remote = {
    connected: raw.remote.connected,
    currentApp: raw.remote.currentApp,
  };

  /* Generic tool state visibility — any tool with discovered tags becomes visible */
  if (raw.toolStates) {
    for (const [toolKey, toolState] of Object.entries(raw.toolStates)) {
      if (visible.has(`toolStates.${toolKey}`) && toolState) {
        const cloned = { ...toolState } as Record<string, unknown>;
        /* Hide verification keys unless fix was confirmed */
        if (!visible.has(`toolStates.${toolKey}.verified`)) {
          for (const k of Object.keys(cloned)) {
            if (k.toLowerCase().includes('verified') || k.toLowerCase().includes('confirmed')) {
              delete cloned[k];
            }
          }
        }
        safe[toolKey] = cloned;
      }
    }
  }

  return safe;
}

export function getVisibleState(state: SimState, pack?: SimPack): VisibleSimState {
  return {
    phase: state.phase,
    safe_state: pack ? pickSafe(state, pack) : { phase: state.phase },
  };
}

export function getVisibleActions(state: SimState, actions: SimAction[]): VisibleAction[] {
  return actions
    .map(a => ({
      id: a.id,
      tool: a.tool,
      label: a.label,
      redFlag: !!a.redFlag,
    }));
}
