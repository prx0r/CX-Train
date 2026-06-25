import { SimState, SimAction, SimActionResult, SimPhase } from './types';

function setNested(obj: Record<string, unknown>, path: string[], value: unknown): void {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    if (!current[path[i]] || typeof current[path[i]] !== 'object') {
      current[path[i]] = {};
    }
    current = current[path[i]] as Record<string, unknown>;
  }
  current[path[path.length - 1]] = value;
}

function getNested(obj: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

function parseDotPath(key: string): string[] {
  return key.split('.');
}

/* ── Phase transition map ───────────────────────────── */

const PHASE_TRANSITIONS: Record<SimPhase, SimPhase[]> = {
  not_started: ['call_active'],
  call_active: ['remote_active', 'ticketing'],
  remote_active: ['call_active', 'ticketing'],
  ticketing: ['submitted'],
  submitted: [],
};

function canTransition(from: SimPhase, to: SimPhase): boolean {
  return PHASE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionPhase(state: SimState, targetPhase: SimPhase): SimState {
  if (!canTransition(state.phase, targetPhase)) {
    return state;
  }
  const next = deepClone(state);
  next.phase = targetPhase;

  if (targetPhase === 'call_active' && next.call.startedAt === null) {
    next.call.startedAt = Date.now();
  }
  if (targetPhase === 'ticketing' && next.call.endedAt === null) {
    next.call.endedAt = Date.now();
  }

  return next;
}

/* ── Core action application ────────────────────────── */

export function applyAction(
  state: SimState,
  action: SimAction,
): { result: SimActionResult; updatedState: SimState } {
  const state_before = deepClone(state);
  let updated = deepClone(state);

  /* 1. Phase check */
  if (!action.allowedPhases.includes(state.phase)) {
    return {
      result: {
        action_id: action.id,
        label: action.label,
        result_text: `Action "${action.id}" not allowed during phase "${state.phase}".`,
        state_before: state_before as unknown as Record<string, unknown>,
        state_after: state_before as unknown as Record<string, unknown>,
        phaseTransition: false,
        revealedFacts: [],
        evidenceTags: [],
        redFlag: null,
      },
      updatedState: state,
    };
  }

  /* 2. Precondition check */
  if (action.requiresState) {
    for (const [key, val] of Object.entries(action.requiresState)) {
      const currentVal = getNested(updated as unknown as Record<string, unknown>, parseDotPath(key));
      if (currentVal !== val) {
        return {
          result: {
            action_id: action.id,
            label: action.label,
            result_text: `Precondition not met: requires ${key}=${val} but current=${JSON.stringify(currentVal)}.`,
            state_before: state_before as unknown as Record<string, unknown>,
            state_after: state_before as unknown as Record<string, unknown>,
            phaseTransition: false,
            revealedFacts: [],
            evidenceTags: [],
            redFlag: null,
          },
          updatedState: state,
        };
      }
    }
  }

  /* 3. Apply effects (nested dot-path) */
  if (action.effects) {
    for (const [key, val] of Object.entries(action.effects)) {
      setNested(updated as unknown as Record<string, unknown>, parseDotPath(key), val);
    }
  }

  /* 4. Track revealed facts */
  const revealedFacts: string[] = [];
  if (action.revealsFacts) {
    for (const fact of action.revealsFacts) {
      if (!updated.call.factsRevealed.includes(fact)) {
        updated.call.factsRevealed.push(fact);
        revealedFacts.push(fact);
      }
    }
  }

  /* 5. Mark evidence */
  const evidenceTags = action.evidenceTags ?? [];

  /* 6. Determine phase transition */
  let phaseTransition = false;
  if (action.id === 'start_call' && updated.phase === 'not_started') {
    updated = transitionPhase(updated, 'call_active');
    phaseTransition = true;
  }
  if (action.id === 'remote_connect' && updated.phase === 'call_active') {
    updated = transitionPhase(updated, 'remote_active');
    updated.remote.connected = true;
    phaseTransition = true;
  }
  if (action.id === 'end_call') {
    if (updated.phase === 'call_active' || updated.phase === 'remote_active') {
      updated = transitionPhase(updated, 'ticketing');
      phaseTransition = true;
    }
  }

  return {
    result: {
      action_id: action.id,
      label: action.label,
      result_text: action.observation,
      state_before: state_before as unknown as Record<string, unknown>,
      state_after: updated as unknown as Record<string, unknown>,
      phaseTransition,
      revealedFacts,
      evidenceTags,
      redFlag: action.redFlag ?? null,
    },
    updatedState: updated,
  };
}
