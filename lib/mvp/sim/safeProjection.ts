import { SimState, SimAction, VisibleSimState, VisibleAction } from './types';

/* ── Visibility rules ──────────────────────────────────
 *
 * The simulator no longer hides controls to force a fixed path. The candidate
 * can try actions freely; scoring and red flags judge the behavior afterwards.
 * We still avoid sending hidden truth, but visible app state is projected once
 * it would naturally be visible on the remote desktop.
 */

function outlookVisible(state: SimState): boolean {
  return state.discovered.some(t => t.startsWith('tool.outlook.'));
}

function networkVisible(state: SimState): boolean {
  return state.discovered.some(t => t.startsWith('tool.cmd.') || t.startsWith('tool.browser.check_webmail'));
}

function connectwiseVisible(state: SimState): boolean {
  return state.discovered.some(t => t.startsWith('tool.connectwise.'));
}

function fixVerifiedVisible(state: SimState): boolean {
  return state.discovered.includes('fix.correct_root_cause') || state.outlook?.sentTestEmail === true;
}

function pickSafe(raw: SimState): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  safe.phase = raw.phase;

  /* Call info always visible */
  safe.call = {
    customerMood: raw.call.customerMood,
    startedAt: raw.call.startedAt,
  };

  safe.remote = {
    connected: raw.remote.connected,
    currentApp: raw.remote.currentApp,
  };

  /* Outlook state — only after discovery */
  if (raw.outlook && outlookVisible(raw)) {
    const o: Record<string, unknown> = {
      workOffline: raw.outlook.workOffline,
      outboxCount: raw.outlook.outboxCount,
    };
    if (fixVerifiedVisible(raw)) {
      o.sentTestEmail = raw.outlook.sentTestEmail;
    }
    safe.outlook = o;
  }

  /* Network state — only after discovery */
  if (raw.network && networkVisible(raw)) {
    safe.network = {
      internetReachable: raw.network.internetReachable,
    };
  }

  /* ConnectWise state — only after discovery */
  if (raw.connectwise && connectwiseVisible(raw)) {
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
    .map(a => ({
      id: a.id,
      tool: a.tool,
      label: a.label,
      redFlag: !!a.redFlag,
    }));
}
