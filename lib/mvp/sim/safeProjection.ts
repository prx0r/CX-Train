import { SimState, SimAction, VisibleSimState, VisibleAction } from './types';

/* ── Visibility rules ──────────────────────────────────
 *
 * Phase-based gating:
 *   not_started / call_active → only call info
 *   remote_active             → remote info + unlocked subsections
 *   ticketing / submitted     → everything discovered so far
 *
 * Subsection visibility requires a key in state.discovered:
 *   'tool.outlook.*'    → outlook block visible
 *   'tool.cmd.ping'     → network block visible
 *   'tool.connectwise.*'→ connectwise block visible
 *   'fix.correct_root_cause' → sentTestEmail / verifiedFix visible
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

  /* Remote info visible only in remote_active+ */
  if (raw.phase === 'remote_active' || raw.phase === 'ticketing' || raw.phase === 'submitted') {
    safe.remote = {
      connected: raw.remote.connected,
      currentApp: raw.remote.currentApp,
    };
  }

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
    .map(a => ({
      id: a.id,
      tool: a.tool,
      label: a.label,
      redFlag: !!a.redFlag,
    }));
}
