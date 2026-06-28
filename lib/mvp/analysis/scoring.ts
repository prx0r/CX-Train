import type { FailGateHit, GateSeverity, ReadinessLabel, EvidenceItem } from './types';

export interface CriterionWeight {
  [key: string]: number;
}

export interface ScoringResult {
  score: number;
  rawScoreBeforeCaps: number;
  rating: ReadinessLabel;
  verdict: 'PASS' | 'FAIL';
  criticalFailure: string | null;
  earnedScore: number;
  maxPossibleScore: number;
  failedRequiredChecks: string[];
  triggeredDealbreakers: string[];
  gateHits: FailGateHit[];
  skillBreakdown: Record<string, { score: number; maxScore: number; percent: number }>;
  bonus: number;
  coreEarned: number;
}

export const RUBRIC_VERSION = 'callcallum-base-v0.4-analysis-hardening';

/* Binary scoring: 1pt per criterion = each is a yes/no check */
export const DEFAULT_WEIGHTS: CriterionWeight = {
  identity_check: 1,
  company_check: 1,
  issue_clarification: 1,
  started_when: 1,
  impact: 1,
  urgency: 1,
  scope: 1,
  technical_discovery: 1,
  error_or_status_capture: 1,
  recent_changes: 1,
  next_steps: 1,
  customer_tone: 1,
  professional_conduct: 1,
  customer_communication: 1,
  ticket_user_company: 1,
  ticket_issue_summary: 1,
  ticket_impact: 1,
  ticket_urgency: 1,
  ticket_checks_attempted: 1,
  ticket_next_step: 1,
  escalation_judgement: 1,
  safety: 1,
};
/* Total binary criteria: 22 → max binary score = 22pts */

export const FUNDAMENTAL_CRITERIA = new Set([
  'submitted_ticket',
  'performed_triage',
  'next_steps',
]);

export const EXCEPTIONAL_SERVICE_CRITERIA = new Set([
  'customer_tone',
  'professional_conduct',
  'customer_communication',
]);

export const DEFAULT_THRESHOLDS = {
  ready_min: 80,
  needs_supervision_min: 60,
};

const STATUS_SCORES: Record<string, number> = {
  pass: 1,
  partial: 0.5,
  fail: 0,
  not_observed: 0,
  not_applicable: -1,
};

export interface FailGateDefinition {
  id: string;
  label: string;
  severity: GateSeverity;
  scoreCap: number;
  redFlagType: string;
  overrideReadiness?: ReadinessLabel;
}

interface DerivedGateDefinition {
  id: string;
  label: string;
  severity: GateSeverity;
  scoreCap: number;
  overrideReadiness?: ReadinessLabel;
  rationale: string;
  when: (criteria: NormalizedCriteria, rawScore: number) => boolean;
}

type NormalizedCriterion = { status: string; severity?: string; evidence?: string[]; notes?: string };
type NormalizedCriteria = Record<string, NormalizedCriterion>;

export const FAIL_GATES: FailGateDefinition[] = [
  {
    id: 'severe_customer_abuse',
    label: 'Severe customer conduct failure',
    severity: 'critical',
    scoreCap: 10,
    redFlagType: 'severe_customer_abuse',
    overrideReadiness: 'not_ready',
  },
  {
    id: 'unsafe_security_behaviour',
    label: 'Unsafe security behaviour',
    severity: 'critical',
    scoreCap: 25,
    redFlagType: 'unsafe_security_behaviour',
    overrideReadiness: 'not_ready',
  },
  {
    id: 'refusal_to_help',
    label: 'Refusal to help or abandonment',
    severity: 'critical',
    scoreCap: 20,
    redFlagType: 'refusal_to_help',
    overrideReadiness: 'not_ready',
  },
  {
    id: 'hallucinated_fix',
    label: 'Invented fix without evidence',
    severity: 'major',
    scoreCap: 50,
    redFlagType: 'hallucinated_fix',
    overrideReadiness: 'needs_supervision',
  },
  {
    id: 'no_troubleshooting',
    label: 'No meaningful troubleshooting',
    severity: 'major',
    scoreCap: 40,
    redFlagType: 'no_troubleshooting',
    overrideReadiness: 'not_ready',
  },
  {
    id: 'invented_fix_without_evidence',
    label: 'Invented fix without evidence',
    severity: 'major',
    scoreCap: 50,
    redFlagType: 'invented_fix_without_evidence',
    overrideReadiness: 'needs_supervision',
  },
  {
    id: 'unsupported_ticket_claims',
    label: 'Ticket contains unsupported claims',
    severity: 'major',
    scoreCap: 70,
    redFlagType: 'unsupported_ticket_claims',
    overrideReadiness: 'needs_supervision',
  },
  {
    id: 'critical_urgency_missed',
    label: 'Critical urgency not captured',
    severity: 'major',
    scoreCap: 70,
    redFlagType: 'critical_urgency_missed',
    overrideReadiness: 'needs_supervision',
  },
  {
    id: 'unprofessional_conduct',
    label: 'Unprofessional conduct',
    severity: 'major',
    scoreCap: 50,
    redFlagType: 'unprofessional_conduct',
    overrideReadiness: 'needs_supervision',
  },
];

const DERIVED_GATES: DerivedGateDefinition[] = [
  {
    id: 'poor_ticket_quality',
    label: 'Poor ticket quality',
    severity: 'major',
    scoreCap: 60,
    overrideReadiness: 'needs_supervision',
    rationale: 'Ticket documentation missed most required fields.',
    when: criteria => countFailed(criteria, [
      'ticket_user_company',
      'ticket_issue_summary',
      'ticket_impact',
      'ticket_urgency',
      'ticket_checks_attempted',
      'ticket_next_step',
    ]) >= 5,
  },
  {
    id: 'severe_data_gap',
    label: 'Severe assessment data gap',
    severity: 'major',
    scoreCap: 30,
    overrideReadiness: 'not_ready',
    rationale: 'Candidate captured almost none of the required call or ticket information.',
    when: criteria => countFailed(criteria, [
      'company_check',
      'issue_clarification',
      'impact',
      'urgency',
      'scope',
      'technical_discovery',
      'error_or_status_capture',
      'recent_changes',
      'next_steps',
      'ticket_impact',
      'ticket_urgency',
      'ticket_checks_attempted',
      'ticket_next_step',
      'escalation_judgement',
    ]) >= 12,
  },
  {
    id: 'missing_next_steps',
    label: 'Missing next steps or closure',
    severity: 'major',
    scoreCap: 80,
    overrideReadiness: 'needs_supervision',
    rationale: 'Candidate did not set a clear next step or closure plan.',
    when: (criteria, rawScore) => rawScore >= 80 && isFail(criteria, 'next_steps'),
  },
  {
    id: 'critical_discovery_gap',
    label: 'Critical discovery gap',
    severity: 'major',
    scoreCap: 80,
    overrideReadiness: 'needs_supervision',
    rationale: 'A manager-critical discovery item was missed in an otherwise strong call.',
    when: (criteria, rawScore) => rawScore >= 80 && (
      isFail(criteria, 'recent_changes') ||
      isFail(criteria, 'error_or_status_capture') ||
      isFail(criteria, 'technical_discovery') ||
      (isFail(criteria, 'urgency') && isFail(criteria, 'ticket_urgency'))
    ),
  },
  {
    id: 'scope_missed',
    label: 'Scope not established',
    severity: 'major',
    scoreCap: 85,
    overrideReadiness: 'needs_supervision',
    rationale: 'Candidate did not establish whether the issue affected one user or many.',
    when: (criteria, rawScore) => rawScore >= 80 && isFail(criteria, 'scope'),
  },
  {
    id: 'ticket_priority_mismatch',
    label: 'Ticket priority mismatch',
    severity: 'major',
    scoreCap: 80,
    overrideReadiness: 'needs_supervision',
    rationale: 'Ticket urgency or priority did not match the customer impact.',
    when: (criteria, rawScore) => rawScore >= 80 && isFail(criteria, 'ticket_urgency') && !isPartial(criteria, 'urgency'),
  },
  {
    id: 'device_or_environment_gap',
    label: 'Device or environment not captured',
    severity: 'major',
    scoreCap: 85,
    overrideReadiness: 'needs_supervision',
    rationale: 'Candidate did not capture enough device or environment detail for follow-up.',
    when: (criteria, rawScore) => rawScore >= 90 && isPartial(criteria, 'technical_discovery'),
  },
  {
    id: 'minor_tone_gap',
    label: 'Minor communication polish gap',
    severity: 'warning',
    scoreCap: 95,
    rationale: 'Call was strong but tone or empathy was only partially demonstrated.',
    when: (criteria, rawScore) => rawScore > 95 && isPartial(criteria, 'customer_tone'),
  },
  {
    id: 'minor_closure_gap',
    label: 'Minor closure polish gap',
    severity: 'warning',
    scoreCap: 90,
    rationale: 'Call was good but closure or documentation of next steps was incomplete.',
    when: (criteria, rawScore) => rawScore > 90 && (isPartial(criteria, 'next_steps') || isPartial(criteria, 'ticket_next_step')),
  },
  {
    id: 'minor_urgency_documentation_gap',
    label: 'Minor urgency documentation gap',
    severity: 'warning',
    scoreCap: 90,
    rationale: 'Call was strong but urgency was incomplete in the call or ticket.',
    when: (criteria, rawScore) => rawScore > 90 && (isPartial(criteria, 'urgency') || isFail(criteria, 'ticket_urgency')),
  },
];

export function detectFailGates(
  redFlags: Array<{ type: string; severity?: string; evidence?: string }> | null | undefined,
  extractEvidence: (flagType: string) => string[],
): FailGateHit[] {
  const hits: FailGateHit[] = [];
  const seen = new Set<string>();

  for (const flag of redFlags || []) {
    if (!flag || !flag.type) continue;
    const normalizedType = flag.type.toString().toLowerCase().trim();
    const gate = FAIL_GATES.find(g => g.redFlagType === normalizedType);
    if (!gate) continue;
    if (seen.has(gate.id)) continue;
    seen.add(gate.id);

    const evidenceQuotes = extractEvidence(normalizedType);
    hits.push({
      id: gate.id,
      label: gate.label,
      severity: gate.severity,
      scoreCap: gate.scoreCap,
      overrideReadiness: gate.overrideReadiness,
      evidence: evidenceQuotes.length > 0
        ? evidenceQuotes.map(q => ({ source: 'transcript' as const, quote: q }))
        : flag.evidence
          ? [{ source: 'analysis' as const, quote: flag.evidence }]
          : [{ source: 'analysis' as const, note: `Red flag: ${flag.type}` }],
      rationale: gate.label + (flag.evidence ? `: ${flag.evidence}` : ''),
    });
  }

  return hits;
}

export function computeFinalScore(
  rawScore: number,
  gateHits: FailGateHit[],
): { score: number; readiness: ReadinessLabel } {
  if (gateHits.length === 0) {
    let readiness: ReadinessLabel = rawScore >= DEFAULT_THRESHOLDS.ready_min ? 'ready'
      : rawScore >= DEFAULT_THRESHOLDS.needs_supervision_min ? 'needs_supervision'
      : 'not_ready';
    return { score: rawScore, readiness };
  }

  const criticalGates = gateHits.filter(g => g.severity === 'critical');
  const majorGates = gateHits.filter(g => g.severity === 'major');

  const strictestCap = Math.min(...gateHits.map(g => g.scoreCap));
  const finalScore = Math.min(rawScore, strictestCap);

  let readiness: ReadinessLabel;
  const criticalOverride = criticalGates.find(g => g.severity === 'critical');
  if (criticalOverride) {
    readiness = 'not_ready';
  } else if (majorGates.length > 0) {
    const strictestMajor = majorGates.reduce((a, b) => a.scoreCap < b.scoreCap ? a : b);
    readiness = strictestMajor.overrideReadiness || 'needs_supervision';
    if (readiness === 'needs_supervision' && finalScore < DEFAULT_THRESHOLDS.needs_supervision_min) {
      readiness = 'not_ready';
    }
  } else {
    readiness = finalScore >= DEFAULT_THRESHOLDS.ready_min ? 'ready'
      : finalScore >= DEFAULT_THRESHOLDS.needs_supervision_min ? 'needs_supervision'
      : 'not_ready';
  }

  return { score: finalScore, readiness };
}

function detectDerivedGates(criteria: NormalizedCriteria, rawScore: number): FailGateHit[] {
  const hits: FailGateHit[] = [];
  for (const gate of DERIVED_GATES) {
    if (!gate.when(criteria, rawScore)) continue;
    hits.push({
      id: gate.id,
      label: gate.label,
      severity: gate.severity,
      scoreCap: gate.scoreCap,
      overrideReadiness: gate.overrideReadiness,
      evidence: [{ source: 'analysis', note: gate.rationale }],
      rationale: gate.rationale,
    });
  }
  return hits;
}

function statusOf(criteria: NormalizedCriteria, key: string): string {
  return String(criteria[key]?.status || 'not_observed').toLowerCase().trim();
}

function isFail(criteria: NormalizedCriteria, key: string): boolean {
  return statusOf(criteria, key) === 'fail' || statusOf(criteria, key) === 'not_observed';
}

function isPartial(criteria: NormalizedCriteria, key: string): boolean {
  return statusOf(criteria, key) === 'partial';
}

function countFailed(criteria: NormalizedCriteria, keys: string[]): number {
  return keys.filter(key => isFail(criteria, key)).length;
}

export function scoreExtraction(params: {
  criteria: Record<string, { status: string; severity?: string; evidence?: string[]; notes?: string }> | null | undefined;
  redFlags?: Array<{ type: string; severity?: string; evidence?: string }> | null;
  weights?: CriterionWeight;
  thresholds?: { ready_min: number; needs_supervision_min: number };
  fundamentals?: { submitted_ticket: boolean; performed_triage: boolean };
  exceptionalServiceScore?: number;
  /** Optional set of criterion keys to scope scoring to. If omitted, all weighted criteria are scored. */
  enabledCriteria?: Set<string>;
}): ScoringResult {
  const weights = params.weights || DEFAULT_WEIGHTS;
  const criteria: NormalizedCriteria = params.criteria && typeof params.criteria === 'object' ? params.criteria : {};
  let earnedScore = 0;
  let maxPossibleScore = 0;
  const failedRequiredChecks: string[] = [];
  const skillBreakdown: Record<string, { score: number; maxScore: number; percent: number }> = {};

  for (const [key, criterion] of Object.entries(criteria)) {
    const weight = weights[key];
    if (weight === undefined) continue;
    if (!criterion || typeof criterion !== 'object') continue;
    if (params.enabledCriteria && !params.enabledCriteria.has(key)) continue;
    const status = String(criterion.status || 'not_observed').toLowerCase().trim();
    const statusScore = STATUS_SCORES[status] ?? 0;

    if (statusScore === -1) continue;

    const earned = weight * statusScore;
    earnedScore += earned;
    maxPossibleScore += weight;

    skillBreakdown[key] = {
      score: earned,
      maxScore: weight,
      percent: Math.round((earned / weight) * 100),
    };

    if (status === 'fail') {
      failedRequiredChecks.push(key);
    }
  }

  /* Binary: coreEarned = number of passed core criteria (1pt each, partial = 0.5) */
  /* When enabledCriteria is set, only score the enabled criteria */
  const enabledWeights = params.enabledCriteria
    ? Object.fromEntries(Object.entries(weights).filter(([k]) => params.enabledCriteria!.has(k)))
    : weights;
  const coreEarned = maxPossibleScore > 0
    ? Object.entries(criteria).reduce((sum, [key, c]) => {
        if (weights[key] === undefined) return sum;
        if (params.enabledCriteria && !params.enabledCriteria.has(key)) return sum;
        const s = String(c?.status || 'not_observed').toLowerCase().trim();
        const score = STATUS_SCORES[s] ?? 0;
        return score === -1 ? sum : sum + score;
      }, 0)
    : 0;
  const totalCore = Object.keys(enabledWeights).length;

  /* Exceptional service bonus: up to +10 */
  const bonus = Math.min(10, params.exceptionalServiceScore ?? 0);

  /* Raw score = ((coreEarned + bonus) / totalCore) × 100, capped at 100 */
  let rawScore = totalCore > 0 ? Math.round(((coreEarned + bonus) / totalCore) * 100) : 0;
  rawScore = Math.min(100, Math.max(0, rawScore));

  /* ── Critical criteria check ── */
  const fundamentals = params.fundamentals || { submitted_ticket: true, performed_triage: true };
  let criticalFailure: string | null = null;

  if (!fundamentals.submitted_ticket) criticalFailure = 'No ticket submitted';
  else if (!fundamentals.performed_triage) criticalFailure = 'Ticket was not triaged';
  else if (statusOf(criteria, 'safety') === 'fail') criticalFailure = 'Safety violation — unsafe action performed';
  else if (statusOf(criteria, 'next_steps') === 'fail') criticalFailure = 'Customer left without clear next steps';

  /* ── Fail gates ── */
  const redFlags = params.redFlags || [];
  const extractEvidence = (flagType: string): string[] => {
    const flag = redFlags.find(f => f?.type?.toString().toLowerCase().trim() === flagType);
    return flag?.evidence ? [flag.evidence] : [];
  };
  const gateHits = [
    ...detectFailGates(redFlags, extractEvidence),
    ...detectDerivedGates(criteria, rawScore),
  ];

  /* Auto-fail gates that override everything */
  const autoFailGates = ['severe_customer_abuse', 'unsafe_security_behaviour', 'refusal_to_help', 'hallucinated_fix', 'invented_fix_without_evidence', 'unprofessional_conduct'];
  const hasAutoFail = redFlags.some(f => autoFailGates.includes(f?.type?.toString().toLowerCase().trim()));
  if (hasAutoFail && !criticalFailure) {
    criticalFailure = 'Critical behavioural failure';
  }

  /* ── Delegate score + readiness to computeFinalScore ── */
  const { score: finalScore, readiness } = computeFinalScore(rawScore, gateHits);

  /* ── Verdict (PASS/FAIL) derived from final state ── */
  const thresholds = params.thresholds || DEFAULT_THRESHOLDS;
  let verdict: 'PASS' | 'FAIL' = 'PASS';
  if (criticalFailure || finalScore < thresholds.needs_supervision_min) {
    verdict = 'FAIL';
  }

  return {
    score: finalScore,
    rawScoreBeforeCaps: rawScore,
    rating: readiness,
    verdict,
    criticalFailure,
    earnedScore: coreEarned,
    maxPossibleScore: totalCore,
    failedRequiredChecks: [...new Set([...failedRequiredChecks])],
    triggeredDealbreakers: gateHits.map(g => g.id),
    gateHits,
    skillBreakdown,
    bonus,
    coreEarned,
  };
}

export function buildFallbackResult(error: string): ScoringResult {
  return {
    score: 0,
    rawScoreBeforeCaps: 0,
    rating: 'not_ready',
    verdict: 'FAIL',
    criticalFailure: 'Analysis pipeline error',
    earnedScore: 0,
    maxPossibleScore: 0,
    failedRequiredChecks: [],
    triggeredDealbreakers: [],
    gateHits: [{
      id: 'analysis_error',
      label: 'Analysis pipeline error',
      severity: 'critical',
      scoreCap: 0,
      overrideReadiness: 'not_ready',
      evidence: [{ source: 'analysis', note: error }],
      rationale: error,
    }],
    skillBreakdown: {},
    bonus: 0,
    coreEarned: 0,
  };
}
