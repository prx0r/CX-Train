import { SimState, SimAction, VisibleSimState, VisibleAction } from './types';

function outlookVisible(state: SimState): boolean {
  return state.discovered.some(t => t.startsWith('tool.outlook.'));
}

function networkVisible(state: SimState): boolean {
  return state.discovered.some(t => t.startsWith('tool.cmd.') || t.startsWith('tool.browser.check_webmail'));
}

function connectwiseVisible(state: SimState): boolean {
  return state.discovered.some(t => t.startsWith('tool.connectwise.'));
}

function printerVisible(state: SimState): boolean {
  return state.discovered.some(t => t.startsWith('tool.printer.'));
}

function vpnVisible(state: SimState): boolean {
  return state.discovered.some(t => t.startsWith('tool.vpn.'));
}

function fixVerifiedVisible(state: SimState): boolean {
  const outlookState = state.toolStates.outlook;
  return state.discovered.includes('fix.correct_root_cause') || outlookState?.sentTestEmail === true;
}

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

  if (raw.toolStates.outlook && outlookVisible(raw)) {
    const o = { ...raw.toolStates.outlook };
    if (!fixVerifiedVisible(raw)) {
      delete o.sentTestEmail;
    }
    safe.outlook = o;
  }

  if (raw.toolStates.network && networkVisible(raw)) {
    const n = { ...raw.toolStates.network };
    safe.network = n;
  }

  if (raw.toolStates.connectwise && connectwiseVisible(raw)) {
    const c: Record<string, unknown> = {};
    if (raw.toolStates.connectwise.ticketId !== undefined) c.ticketId = raw.toolStates.connectwise.ticketId;
    if (raw.toolStates.connectwise.priority !== undefined) c.priority = raw.toolStates.connectwise.priority;
    if (raw.toolStates.connectwise.status !== undefined) c.status = raw.toolStates.connectwise.status;
    safe.connectwise = c;
  }

  if (raw.toolStates.printer && printerVisible(raw)) {
    safe.printer = { ...raw.toolStates.printer };
  }

  if (raw.toolStates.vpn && vpnVisible(raw)) {
    safe.vpn = { ...raw.toolStates.vpn };
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
    .map(a => ({
      id: a.id,
      tool: a.tool,
      label: a.label,
      redFlag: !!a.redFlag,
    }));
}
