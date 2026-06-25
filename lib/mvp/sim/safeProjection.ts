import { SimState, SimAction, VisibleSimState, VisibleAction, SimPack, SimPhase } from './types';

const SAFE_STATE_KEYS: string[] = [
  'phase',
  'call.customerMood',
  'call.startedAt',
  'remote.connected',
  'remote.currentApp',
  'outlook.workOffline',
  'outlook.outboxCount',
  'outlook.sentTestEmail',
  'network.internetReachable',
  'connectwise.ticketId',
  'connectwise.priority',
  'connectwise.status',
];

function pickSafe(raw: SimState): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  safe.phase = raw.phase;
  safe.call = {
    customerMood: raw.call.customerMood,
    startedAt: raw.call.startedAt,
  };
  safe.remote = {
    connected: raw.remote.connected,
    currentApp: raw.remote.currentApp,
  };
  if (raw.outlook) {
    safe.outlook = {
      workOffline: raw.outlook.workOffline,
      outboxCount: raw.outlook.outboxCount,
      sentTestEmail: raw.outlook.sentTestEmail,
    };
  }
  if (raw.network) {
    safe.network = {
      internetReachable: raw.network.internetReachable,
    };
  }
  if (raw.connectwise) {
    safe.connectwise = {
      ticketId: raw.connectwise.ticketId,
      priority: raw.connectwise.priority,
      status: raw.connectwise.status,
    };
  }
  return safe;
}

export function getVisibleState(state: SimState): VisibleSimState {
  return {
    phase: state.phase,
    safe_state: pickSafe(state),
  };
}

export function getVisibleActions(state: SimState, actions: SimAction[]): VisibleAction[] {
  return actions
    .filter(a => {
      if (!a.allowedPhases.includes(state.phase)) return false;
      if (a.requiresState) {
        for (const [key, val] of Object.entries(a.requiresState)) {
          const parts = key.split('.');
          let current: unknown = state;
          for (const p of parts) {
            if (current === null || current === undefined) return false;
            current = (current as Record<string, unknown>)[p];
          }
          if (current !== val) return false;
        }
      }
      return true;
    })
    .filter(a => !a.redFlag)
    .map(a => ({ id: a.id, tool: a.tool, label: a.label }));
}

export function buildCandidatePack(pack: SimPack): { state: VisibleSimState; actions: VisibleAction[]; tools: string[]; customerName: string; customerOpeningLine: string } {
  return {
    state: getVisibleState(pack.initialState),
    actions: getVisibleActions(pack.initialState, pack.actions),
    tools: pack.tools,
    customerName: pack.customer.name,
    customerOpeningLine: pack.customer.openingLine,
  };
}
