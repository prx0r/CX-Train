import type { FailGateHit, GateSeverity, ReadinessLabel, EvidenceItem } from './types';

export interface CriterionWeight {
  [key: string]: number;
}

export interface ScoringResult {
  score: number;
  rawScoreBeforeCaps: number;
  rating: ReadinessLabel;
  earnedScore: number;
  maxPossibleScore: number;
  failedRequiredChecks: string[];
  triggeredDealbreakers: string[];
  gateHits: FailGateHit[];
  skillBreakdown: Record<string, { score: number; maxScore: number; percent: number }>;
}

export const RUBRIC_VERSION = 'callcallum-base-v0.4-analysis-hardening';

export const DEFAULT_WEIGHTS: CriterionWeight = {
  professional_conduct: 4,
  customer_communication: 3,
  identity_check: 1,
  company_check: 1,
  issue_clarification: 2,
  started_when: 1,
  impact: 3,
  urgency: 3,
  scope: 2,
  technical_discovery: 2,
  error_or_status_capture: 1,
  recent_changes: 1,
  next_steps: 3,
  customer_tone: 2,
  ticket_user_company: 1,
  ticket_issue_summary: 2,
  ticket_impact: 2,
  ticket_urgency: 2,
  ticket_checks_attempted: 2,
  ticket_next_step: 2,
  escalation_judgement: 2,
  safety: 4,
};

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
    id: 'critical_urgency_missed',
    label: 'Critical urgency not captured',
    severity: 'major',
    scoreCap: 70,
    redFlagType: 'critical_urgency_missed',
    overrideReadiness: 'needs_supervision',
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

export function scoreExtraction(params: {
  criteria: Record<string, { status: string; severity?: string; evidence?: string[]; notes?: string }> | null | undefined;
  redFlags?: Array<{ type: string; severity?: string; evidence?: string }> | null;
  weights?: CriterionWeight;
  thresholds?: { ready_min: number; needs_supervision_min: number };
}): ScoringResult {
  const weights = params.weights || DEFAULT_WEIGHTS;
  const criteria = params.criteria && typeof params.criteria === 'object' ? params.criteria : {};
  let earnedScore = 0;
  let maxPossibleScore = 0;
  const failedRequiredChecks: string[] = [];
  const skillBreakdown: Record<string, { score: number; maxScore: number; percent: number }> = {};

  for (const [key, criterion] of Object.entries(criteria)) {
    const weight = weights[key];
    if (weight === undefined) continue;
    if (!criterion || typeof criterion !== 'object') continue;
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

  const rawScore = maxPossibleScore > 0 ? Math.round((earnedScore / maxPossibleScore) * 100) : 0;

  const redFlags = params.redFlags || [];
  const extractEvidence = (flagType: string): string[] => {
    const flag = redFlags.find(f => f?.type?.toString().toLowerCase().trim() === flagType);
    return flag?.evidence ? [flag.evidence] : [];
  };
  const gateHits = detectFailGates(redFlags, extractEvidence);

  const { score: finalScore, readiness } = computeFinalScore(rawScore, gateHits);

  return {
    score: finalScore,
    rawScoreBeforeCaps: rawScore,
    rating: readiness,
    earnedScore,
    maxPossibleScore,
    failedRequiredChecks,
    triggeredDealbreakers: gateHits.map(g => g.id),
    gateHits,
    skillBreakdown,
  };
}

export function buildFallbackResult(error: string): ScoringResult {
  return {
    score: 0,
    rawScoreBeforeCaps: 0,
    rating: 'not_ready',
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
  };
}
