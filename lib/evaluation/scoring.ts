import type { EvaluationOutput, RubricItem, EvaluationStatus } from '../types';

export interface WeightedScoreResult {
  callScore: number;
  ticketScore: number;
  finalScore: number;
  readinessLabel: string;
  weightedPassed: number;
  weightedTotal: number;
  missedPenalties: string[];
  riskPenalties: string[];
  coachingNotes: string[];
}

const RISK_PENALTY_MAP: Record<string, number> = {
  missed_identity_check: -15,
  missed_company_check: -10,
  missed_scope_check: -10,
  missed_impact_check: -10,
  jumped_to_solution: -10,
  over_escalated: -5,
  under_escalated: -15,
  gave_wrong_advice: -25,
  poor_client_control: -10,
  unclear_next_steps: -5,
  weak_ticket: -10,
  no_priority: -5,
  no_affected_user: -5,
  no_business_impact: -5,
};

const BONUS_MAP: Record<string, number> = {
  professional_opening: 3,
  used_plain_english: 2,
  summarised_issue: 3,
  closed_call_cleanly: 2,
};

const CRITICAL_RISKS = new Set([
  'missed_identity_check',
  'missed_company_check',
  'missed_scope_check',
  'missed_impact_check',
  'gave_wrong_advice',
  'under_escalated',
  'poor_client_control',
]);

export function calculateWeightedScore(
  rubric: RubricItem[],
  evaluation: EvaluationOutput,
  ticketScore: number,
): WeightedScoreResult {
  const totalWeight = rubric.reduce((sum, item) => sum + item.weight, 0) || 1;

  const checkpointMap = new Map(evaluation.checkpointEvidence.map((c) => [c.checkpointKey, c]));

  let weightedPassed = 0;
  const missedPenalties: string[] = [];

  for (const item of rubric) {
    const evidence = checkpointMap.get(item.key);
    const status: EvaluationStatus = evidence?.status ?? 'missed';
    if (status === 'observed') {
      weightedPassed += item.weight;
    } else if (status === 'partially_observed') {
      weightedPassed += item.weight * 0.5;
    } else if (status === 'missed') {
      missedPenalties.push(item.key);
    }
  }

  const baseCallScore = Math.round((weightedPassed / totalWeight) * 100);

  const riskPenalties: string[] = [];
  let penaltyTotal = 0;
  for (const risk of evaluation.riskLabels) {
    const penalty = RISK_PENALTY_MAP[risk.label];
    if (penalty) {
      riskPenalties.push(risk.label);
      penaltyTotal += penalty;
    }
  }

  let bonusTotal = 0;
  for (const skill of evaluation.skillLabels) {
    const bonus = BONUS_MAP[skill.label];
    if (bonus) bonusTotal += bonus;
  }

  const callScore = Math.max(0, Math.min(100, baseCallScore + penaltyTotal + bonusTotal));

  const finalScore = Math.round(callScore * 0.75 + ticketScore * 0.25);

  const criticalMisses = evaluation.riskLabels
    .filter((r) => CRITICAL_RISKS.has(r.label))
    .map((r) => r.label);
  const unsafe = criticalMisses.some((key) => ['gave_wrong_advice'].includes(key));
  const readinessLabel = getReadinessLabel(finalScore, criticalMisses, unsafe);

  return {
    callScore,
    ticketScore,
    finalScore,
    readinessLabel,
    weightedPassed: Math.round(weightedPassed),
    weightedTotal: totalWeight,
    missedPenalties,
    riskPenalties,
    coachingNotes: evaluation.coachingNotes,
  };
}

function getReadinessLabel(
  score: number,
  criticalMisses: string[],
  unsafe: boolean,
): string {
  if (unsafe || score < 60) return 'not_ready';
  if (score >= 80 && criticalMisses.length === 0) return 'ready_low_risk_calls';
  return 'ready_with_supervision';
}

export function scoreTicketWithPatterns(ticket: string, transcriptText = ''): { score: number; checks: Record<string, boolean>; feedback: string[] } {
  const TICKET_PATTERNS: Record<string, RegExp> = {
    issue_clear: /(cannot|can't|unable|fails?|error|issue|problem|not working|slow|offline|access)/i,
    user_client: /(user|caller|client|customer|company|requested by|affected)/i,
    device_hostname: /(device|hostname|laptop|desktop|printer|pc|computer|LT-\d+)/i,
    impact: /(impact|blocked|unable to work|deadline|meeting|payroll|urgent|business)/i,
    scope: /(single user|one user|multiple users|users|department|site|office|wider)/i,
    troubleshooting: /(checked|tested|restarted|confirmed|tried|verified|diagnostic)/i,
    priority: /(P[1-4]|priority|severity|critical|high|medium|low)/i,
    next_action: /(next step|escalat|follow up|callback|investigate|assigned|monitor)/i,
  };

  const normalized = ticket.trim();
  const checks = Object.fromEntries(
    Object.entries(TICKET_PATTERNS).map(([key, pattern]) => [key, pattern.test(normalized)])
  );
  checks.sufficient_detail = normalized.split(/\s+/).filter(Boolean).length >= 25;

  const claimsResolution = /(?:definitely|confirmed cause|fixed by|root cause is|issue (?:is )?resolved|resolved by)/i.test(normalized);
  const transcriptSupportsResolution = /(?:confirmed (?:the )?cause|root cause|issue (?:is|was) resolved|fixed (?:the|by)|now working)/i.test(transcriptText);
  checks.no_invention = !(claimsResolution && !transcriptSupportsResolution);

  const score = Math.round(
    (Object.values(checks).filter(Boolean).length / Object.keys(checks).length) * 100
  );
  const feedback = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([key]) => `Missing or unclear: ${key.replace(/_/g, ' ')}.`);
  return { score, checks, feedback };
}
