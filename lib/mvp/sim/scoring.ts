import { SimScoringResult, SimState, SimPackScoringCriterion } from './types';

interface ScoringEvent {
  event_type: string;
  action_id?: string | null;
  text?: string | null;
  label?: string | null;
  result_text?: string | null;
  payload?: Record<string, unknown> | null;
}

export function scoreSimEvents(params: {
  pack: {
    actions?: any[];
    rubric?: Record<string, { weight: number }>;
    scoringCriteria?: SimPackScoringCriterion[];
    diagnosticChecklist?: { id: string; label: string; criteria: string }[];
  };
  events: ScoringEvent[];
  finalState: SimState;
}): SimScoringResult {
  const { pack, events, finalState } = params;

  const performedActionIds = new Set(
    events.filter(e => e.event_type === 'action_performed').map(e => e.action_id).filter(Boolean)
  );

  const redFlagEvents = events.filter(e => e.event_type === 'red_flag_triggered');
  const redFlagActionIds = new Set(redFlagEvents.map(e => e.action_id).filter(Boolean));

  function hasTag(tag: string): boolean {
    return events.some(e => {
      const payload = e.payload;
      if (!payload || !Array.isArray(payload.taxonomy_tags)) return false;
      return (payload.taxonomy_tags as string[]).includes(tag);
    });
  }

  function hasTagInEvent(actionId: string, tag: string): boolean {
    return events.some(e => {
      if (e.action_id !== actionId) return false;
      const payload = e.payload;
      if (!payload || !Array.isArray(payload.taxonomy_tags)) return false;
      return (payload.taxonomy_tags as string[]).includes(tag);
    });
  }

  function getNested(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  const criteria = pack.scoringCriteria || [];
  const checklist = pack.diagnosticChecklist || [];
  const actionCriteria: Record<string, 'pass' | 'partial' | 'fail'> = {};

  let scoreDelta = 0;
  const redFlags = redFlagEvents.map(e => e.action_id).filter(Boolean) as string[];

  for (const c of criteria) {
    let passed = false;

    switch (c.check) {
      case 'action_performed':
        passed = performedActionIds.has(c.target);
        break;
      case 'tag_present':
        passed = hasTag(c.target);
        break;
      case 'tag_in_event':
        passed = events.some(e => hasTagInEvent(e.action_id || '', c.target));
        break;
      case 'state_value': {
        const actual = getNested(finalState, c.target);
        passed = actual === c.value;
        break;
      }
    }

    actionCriteria[c.id] = passed ? 'pass' : 'fail';

    if (passed) {
      if (c.positive !== false) {
        scoreDelta += c.weight;
      }
    } else if (c.positive === false) {
      scoreDelta -= Math.abs(c.weight);
    }
  }

  if (finalState.phase === 'submitted') scoreDelta += 5;

  scoreDelta = Math.max(0, Math.min(100, scoreDelta));

  const timelineSummary: string[] = [];
  for (const ev of events) {
    if (ev.event_type === 'customer_message' && ev.text) {
      timelineSummary.push(`[Customer] ${ev.text}`);
    } else if (ev.event_type === 'candidate_message' && ev.text) {
      timelineSummary.push(`[Candidate] ${ev.text}`);
    } else if (ev.event_type === 'action_performed' && ev.label) {
      timelineSummary.push(`[Action] ${ev.label} -> ${ev.result_text || ''}`);
    } else if (ev.event_type === 'observation_returned' && ev.result_text) {
      timelineSummary.push(`[System] ${ev.result_text}`);
    } else if (ev.event_type === 'red_flag_triggered' && ev.label) {
      timelineSummary.push(`[Red Flag] ${ev.label}`);
    }
  }

  const technicalPath: string[] = [];
  for (const step of checklist) {
    const passed = actionCriteria[step.criteria] === 'pass';
    technicalPath.push(`${passed ? 'V' : 'X'} ${step.label}`);
  }
  if (redFlags.length > 0) technicalPath.push(`Triggered red flags: ${redFlags.join(', ')}`);

  return {
    actionCriteria,
    redFlags,
    scoreDelta,
    timelineSummary,
    technicalPath,
  };
}
