import { SimScoringResult, SimState, SimPackScoringCriterion, SimCategoryScore, SimCostlyMiss, ScoringCategory, SCORING_CATEGORIES, SimFailGateMap, SimDerivedGate } from './types';

export interface ScoringConfig {
  version?: string;
  categoryWeights: Record<string, number>;
  criteria: SimPackScoringCriterion[];
  mandatoryCheckpoints: string[];
  redFlags: SimRedFlagMeta[];
  diagnosticChecklist: { id: string; label: string; criteria: string }[];
  failGates: SimFailGateMap[];
  derivedGates: SimDerivedGate[];
  thresholds: { ready: number; needs_supervision: number };
  idealTicket: { summary: string; requiredFields: string[] };
}

export interface SimRedFlagMeta {
  id: string;
  severity: 'minor' | 'major' | 'critical';
  message: string;
}

export interface ScoringEvent {
  event_type: string;
  action_id?: string | null;
  text?: string | null;
  label?: string | null;
  result_text?: string | null;
  payload?: Record<string, unknown> | null;
}

export function scoreSimEvents(params: {
  config: ScoringConfig;
  events: ScoringEvent[];
  finalState: SimState;
  triggeredRedFlags?: string[];
}): SimScoringResult {
  const { config, events, finalState, triggeredRedFlags } = params;
  const criteria = config.criteria || [];
  const checklist = config.diagnosticChecklist || [];
  const failGates = config.failGates || [];
  const derivedGates = config.derivedGates || [];
  const mandatoryIds = new Set(config.mandatoryCheckpoints || []);

  const performedActionIds = new Set(
    events.filter(e => e.event_type === 'action_performed').map(e => e.action_id).filter(Boolean)
  );

  const redFlagEventIds = new Set(
    events.filter(e => e.event_type === 'red_flag_triggered').map(e => e.action_id).filter(Boolean)
  );

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

  const actionCriteria: Record<string, 'pass' | 'partial' | 'fail'> = {};
  let earnedTotal = 0;
  let maxTotal = 0;
  const mandatoryFailures: string[] = [];

  for (const c of criteria) {
    let result: 'pass' | 'partial' | 'fail' = 'fail';

    switch (c.check) {
      case 'action_performed':
        result = performedActionIds.has(c.target) ? 'pass' : 'fail';
        break;
      case 'tag_present':
        result = hasTag(c.target) ? 'pass' : 'fail';
        break;
      case 'tag_in_event':
        result = events.some(e => hasTagInEvent(e.action_id || '', c.target)) ? 'pass' : 'fail';
        break;
      case 'state_value': {
        const actual = getNested(finalState, c.target);
        result = actual === c.value ? 'pass' : 'fail';
        break;
      }
      case 'fact_revealed':
        result = finalState.call.factsRevealed.includes(c.target) ? 'pass' : 'fail';
        break;
    }

    actionCriteria[c.id] = result;

    const resultStr = result as string;
    const earned = resultStr === 'pass' ? c.weight : (resultStr === 'partial' ? c.weight * 0.5 : 0);
    if (c.positive) {
      earnedTotal += earned;
      maxTotal += c.weight;
    } else if ((resultStr === 'pass' && !c.positive) || (resultStr === 'fail' && c.positive === false)) {
      earnedTotal -= c.weight;
    }

    if (mandatoryIds.has(c.id) && resultStr !== 'pass') {
      mandatoryFailures.push(c.id);
    }
  }

  if (finalState.phase === 'submitted') {
    earnedTotal += 5;
    maxTotal += 5;
  }

  const blacklistedActions: string[] = triggeredRedFlags || (Array.from(redFlagEventIds) as string[]);
  const redFlagNames: string[] = [];
  for (const rfId of blacklistedActions) {
    const rf = config.redFlags.find(r => r.id === rfId);
    if (rf) redFlagNames.push(rf.message || rfId);
    else redFlagNames.push(rfId);
  }

  let rawScore = maxTotal > 0 ? Math.round((earnedTotal / maxTotal) * 100) : 0;

  // Apply fail gates from red flags
  const gateHits: Array<{ id: string; label: string; severity: string; scoreCap: number; rationale: string }> = [];
  let forceReadiness: string | null = null;
  for (const gate of failGates) {
    if (gate.redFlagType && blacklistedActions.some(id => id === gate.redFlagType)) {
      rawScore = Math.min(rawScore, gate.scoreCap);
      gateHits.push({
        id: gate.id,
        label: gate.label,
        severity: gate.severity,
        scoreCap: gate.scoreCap,
        rationale: `Red flag triggered: ${gate.redFlagType}`,
      });
      if (gate.overrideReadiness) forceReadiness = gate.overrideReadiness;
    }
  }

  // Apply derived gates from criteria patterns
  for (const gate of derivedGates) {
    if (gate.condition(actionCriteria, rawScore)) {
      const wasCapped = rawScore > gate.scoreCap;
      rawScore = Math.min(rawScore, gate.scoreCap);
      if (wasCapped) {
        gateHits.push({
          id: gate.id,
          label: gate.label,
          severity: gate.severity,
          scoreCap: gate.scoreCap,
          rationale: 'Criteria pattern matched derived gate condition',
        });
      }
    }
  }

  // Apply mandatory checkpoint cap
  if (mandatoryFailures.length > 0) {
    rawScore = Math.min(rawScore, 70);
    gateHits.push({
      id: 'mandatory_checkpoints',
      label: 'Mandatory checkpoints missed',
      severity: 'major',
      scoreCap: 70,
      rationale: `Mandatory checkpoints failed: ${mandatoryFailures.join(', ')}`,
    });
  }

  rawScore = Math.max(0, Math.min(100, rawScore));

  // Compute category scores
  const categoryScores: Record<ScoringCategory, SimCategoryScore> = {} as any;
  for (const cat of SCORING_CATEGORIES) {
    const catCriteria = criteria.filter(c => c.category === cat && c.positive);
    let catEarned = 0;
    let catMax = 0;
    const catResults: Record<string, 'pass' | 'partial' | 'fail'> = {};
    for (const c of catCriteria) {
      const res = actionCriteria[c.id] || 'fail';
      catResults[c.id] = res;
      const earned = res === 'pass' ? c.weight : (res === 'partial' ? c.weight * 0.5 : 0);
      catEarned += earned;
      catMax += c.weight;
    }
    categoryScores[cat] = {
      score: catMax > 0 ? Math.round((catEarned / catMax) * 100) : 0,
      maxScore: 100,
      earnedWeight: catEarned,
      maxWeight: catMax,
      criteriaResults: catResults,
    };
  }

  // Build "what cost you most"
  const whatCostYouMost: SimCostlyMiss[] = [];
  const misses = criteria
    .filter(c => c.positive && (actionCriteria[c.id] === 'fail' || actionCriteria[c.id] === 'partial'))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);
  for (const miss of misses) {
    const isPartial = actionCriteria[miss.id] === 'partial';
    whatCostYouMost.push({
      criterionId: miss.id,
      label: miss.label,
      pointsLost: Math.round(miss.weight * (isPartial ? 0.5 : 1)),
      whyItMatters: miss.gradingGuide || miss.description,
    });
  }

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
    const p = actionCriteria[step.criteria] === 'pass';
    technicalPath.push(`${p ? 'V' : 'X'} ${step.label}`);
  }
  if (redFlagNames.length > 0) technicalPath.push(`Triggered red flags: ${redFlagNames.join(', ')}`);

  return {
    overallScore: rawScore,
    categoryScores,
    actionCriteria,
    mandatoryFailures,
    redFlags: redFlagNames,
    gateHits,
    whatCostYouMost,
    timelineSummary,
    technicalPath,
  };
}
