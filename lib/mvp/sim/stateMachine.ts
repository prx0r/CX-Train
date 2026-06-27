import { SimState, SimAction, SimActionResult, SimPhase, SimErrorCode } from './types';

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

export function transitionPhase(state: SimState, targetPhase: SimPhase): SimState {
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

function resolveEffectValue(val: unknown): unknown {
  if (val === '$now') return Date.now();
  return val;
}

export function applyAction(
  state: SimState,
  action: SimAction,
): { result: SimActionResult; updatedState: SimState } {
  const state_before = deepClone(state);
  let updated = deepClone(state);

  let unmetPrecondition: string | null = null;
  if (action.requiresState) {
    for (const [key, val] of Object.entries(action.requiresState)) {
      const currentVal = getNested(updated as unknown as Record<string, unknown>, parseDotPath(key));
      if (currentVal !== val) {
        unmetPrecondition = `${key}=${val}`;
        break;
      }
    }
  }

  const shouldApplyEffects = !unmetPrecondition || !action.strictPreconditions;
  if (action.effects && shouldApplyEffects) {
    for (const [key, val] of Object.entries(action.effects)) {
      setNested(updated as unknown as Record<string, unknown>, parseDotPath(key), resolveEffectValue(val));
    }
  }

  const revealedFacts: string[] = [];
  if (action.revealsFacts && !unmetPrecondition) {
    for (const fact of action.revealsFacts) {
      if (!updated.call.factsRevealed.includes(fact)) {
        updated.call.factsRevealed.push(fact);
        revealedFacts.push(fact);
      }
    }
  }

  if (action.taxonomyTags) {
    for (const tag of action.taxonomyTags) {
      if (!updated.discovered.includes(tag)) {
        updated.discovered.push(tag);
      }
    }
  }

  const taxonomyTags = action.taxonomyTags ?? [];

  let phaseTransition = false;
  if (action.transitionsTo) {
    updated = transitionPhase(updated, action.transitionsTo);
    if (action.transitionsTo === 'remote_active') {
      updated.remote.connected = true;
    }
    if (action.id === 'remote_disconnect' || action.transitionsTo === 'call_active') {
      updated.remote.connected = false;
    }
    phaseTransition = true;
  }

  const resultText = unmetPrecondition && action.failureObservation
    ? action.failureObservation
    : action.observation;

  return {
    result: {
      ok: true,
      action_id: action.id,
      label: action.label,
      result_text: resultText,
      state_before: state_before as unknown as Record<string, unknown>,
      state_after: updated as unknown as Record<string, unknown>,
      phaseTransition,
      revealedFacts,
      taxonomyTags,
      redFlag: action.redFlag ?? null,
      errorCode: unmetPrecondition ? 'PRECONDITION_FAILED' : null,
    },
    updatedState: updated,
  };
}
