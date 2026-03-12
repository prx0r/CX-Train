import type { Checkpoints, ImpactLevel, RubricEvidence, ScoreBreakdown, SeverityLevel } from './types';
import { RUBRIC, RUBRIC_MAX_SCORE } from './rubric';

// Checkpoint weights for score calculation (mirrors GPT scoring)
const CHECKPOINT_WEIGHTS: Record<string, number> = {
  name_verified: 5,
  company_confirmed: 5,
  hostname_gathered: 12,
  location_confirmed: 4,
  issue_defined: 8,
  last_working_asked: 6,
  recent_changes_asked: 6,
  exact_error_asked: 6,
  reboot_asked: 5,
  scope_determined: 8,
  impact_determined: 10,
  priority_assigned: 10,
  ticket_expectation_set: 6,
  timeframe_given: 6,
  callback_window_given: 9,
};

const TOTAL_WEIGHT = Object.values(CHECKPOINT_WEIGHTS).reduce((a, b) => a + b, 0);

export function calculateScoreFromCheckpoints(checkpoints: Checkpoints): number {
  let earned = 0;
  for (const [key, weight] of Object.entries(CHECKPOINT_WEIGHTS)) {
    if (checkpoints[key as keyof Checkpoints] === true) {
      earned += weight;
    }
  }
  return Math.round((earned / TOTAL_WEIGHT) * 100);
}

export function getCheckpointContribution(
  checkpoint: string,
  passed: boolean
): { weight: number; earned: number; percentage: number } {
  const weight = CHECKPOINT_WEIGHTS[checkpoint] ?? 0;
  const earned = passed ? weight : 0;
  const percentage = Math.round((earned / TOTAL_WEIGHT) * 100);
  return { weight, earned, percentage };
}

export { CHECKPOINT_WEIGHTS, TOTAL_WEIGHT };

const CHECKPOINT_TO_EVIDENCE: Record<string, keyof RubricEvidence> = {
  issue_defined: 'asked_symptoms',
  last_working_asked: 'asked_last_working',
  recent_changes_asked: 'asked_recent_changes',
  exact_error_asked: 'asked_exact_error',
  reboot_asked: 'asked_reboot_or_basic_check',
  scope_determined: 'asked_scope',
  impact_determined: 'asked_impact',
  ticket_expectation_set: 'stated_ticket_logging',
  timeframe_given: 'provided_response_time',
  callback_window_given: 'provided_callback_window',
};

export function mergeRubricEvidenceWithCheckpoints(
  evidence: RubricEvidence | undefined,
  checkpoints: Checkpoints
): RubricEvidence {
  const merged: RubricEvidence = { ...(evidence || {}) };
  for (const [checkpoint, evidenceKey] of Object.entries(CHECKPOINT_TO_EVIDENCE)) {
    if (merged[evidenceKey] === undefined && checkpoints[checkpoint as keyof Checkpoints] === true) {
      merged[evidenceKey] = true;
    }
  }
  if (merged.clarified_severity === undefined) {
    merged.clarified_severity = Boolean(checkpoints.scope_determined && checkpoints.impact_determined);
  }
  return merged;
}

export function calculateRubricScores(evidence: RubricEvidence): ScoreBreakdown {
  const breakdown: ScoreBreakdown = {
    professionalism: 0,
    friendliness: 0,
    qualification: 0,
    setting_expectations: 0,
    obtaining_symptoms: 0,
    total_points: 0,
  };

  for (const [category, items] of Object.entries(RUBRIC)) {
    let categoryScore = 0;
    for (const item of items) {
      if (evidence[item.key] === true) {
        categoryScore += item.weight;
      }
    }
    const capped = Math.min(categoryScore, RUBRIC_MAX_SCORE);
    breakdown[category as keyof Omit<ScoreBreakdown, 'total_points'>] = capped;
    breakdown.total_points += capped;
  }

  return breakdown;
}

export function getPriorityFromSla(impact: ImpactLevel, severity: SeverityLevel): string {
  if (impact === 'high' && severity === 'high') return 'P1';
  if (impact === 'high' && severity === 'medium') return 'P1';
  if (impact === 'high' && severity === 'low') return 'P2';
  if (impact === 'medium' && severity === 'high') return 'P1';
  if (impact === 'medium' && severity === 'medium') return 'P2';
  if (impact === 'medium' && severity === 'low') return 'P3';
  if (impact === 'low' && severity === 'high') return 'P2';
  if (impact === 'low' && severity === 'medium') return 'P3';
  return 'P4';
}

export function isPriorityCorrect(
  assigned: string | undefined,
  impact: ImpactLevel | undefined,
  severity: SeverityLevel | undefined
): { expected: string | null; correct: boolean | null } {
  if (!assigned || !impact || !severity) {
    return { expected: null, correct: null };
  }
  const expected = getPriorityFromSla(impact, severity);
  return { expected, correct: assigned.toUpperCase() === expected };
}
