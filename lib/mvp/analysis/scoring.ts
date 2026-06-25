export interface CriterionWeight {
  [key: string]: number;
}

export interface DealbreakerRule {
  type: string;
  cap: 'not_ready' | 'needs_supervision';
  severity?: 'low' | 'medium' | 'high';
}

export interface ScoringResult {
  score: number;
  rating: 'ready' | 'needs_supervision' | 'not_ready';
  earnedScore: number;
  maxPossibleScore: number;
  failedRequiredChecks: string[];
  triggeredDealbreakers: string[];
  skillBreakdown: Record<string, { score: number; maxScore: number; percent: number }>;
}

export const DEFAULT_WEIGHTS: CriterionWeight = {
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
  customer_tone: 1,
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

export const DEFAULT_DEALBREAKERS: DealbreakerRule[] = [
  { type: 'unsafe_advice', cap: 'not_ready' },
  { type: 'invented_fix_without_evidence', cap: 'needs_supervision' },
  { type: 'critical_urgency_missed', cap: 'needs_supervision' },
  { type: 'rude_or_blameful_tone', cap: 'needs_supervision' },
  { type: 'no_clear_next_step', cap: 'needs_supervision' },
];

const STATUS_SCORES: Record<string, number> = {
  pass: 1,
  partial: 0.5,
  fail: 0,
  not_observed: 0,
  not_applicable: -1,
};

export function scoreExtraction(params: {
  criteria: Record<string, { status: string; severity?: string; evidence?: string[]; notes?: string }>;
  redFlags?: Array<{ type: string; severity?: string }>;
  weights?: CriterionWeight;
  thresholds?: { ready_min: number; needs_supervision_min: number };
  dealbreakers?: DealbreakerRule[];
}): ScoringResult {
  const weights = params.weights || DEFAULT_WEIGHTS;
  const thresholds = params.thresholds || DEFAULT_THRESHOLDS;
  const dealbreakers = params.dealbreakers || DEFAULT_DEALBREAKERS;
  const redFlags = params.redFlags || [];

  let earnedScore = 0;
  let maxPossibleScore = 0;
  const failedRequiredChecks: string[] = [];
  const triggeredDealbreakers: string[] = [];
  const skillBreakdown: Record<string, { score: number; maxScore: number; percent: number }> = {};

  for (const [key, criterion] of Object.entries(params.criteria)) {
    const weight = weights[key] || 1;
    const status = (criterion.status || 'not_observed').toLowerCase();
    const statusScore = STATUS_SCORES[status] ?? 0;

    if (statusScore === -1) {
      continue;
    }

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

  // Check red flags against dealbreakers
  for (const flag of redFlags) {
    const rule = dealbreakers.find(d => d.type === flag.type);
    if (rule) {
      triggeredDealbreakers.push(flag.type);
    }
  }

  // Calculate score percentage
  let score = maxPossibleScore > 0 ? Math.round((earnedScore / maxPossibleScore) * 100) : 0;

  // Dealbreaker overrides
  let rating: ScoringResult['rating'] = score >= thresholds.ready_min ? 'ready'
    : score >= thresholds.needs_supervision_min ? 'needs_supervision'
    : 'not_ready';

  for (const db of dealbreakers) {
    if (triggeredDealbreakers.includes(db.type)) {
      if (db.cap === 'not_ready') {
        rating = 'not_ready';
      } else if (db.cap === 'needs_supervision' && rating === 'ready') {
        rating = 'needs_supervision';
      }
    }
  }

  return {
    score,
    rating,
    earnedScore,
    maxPossibleScore,
    failedRequiredChecks,
    triggeredDealbreakers,
    skillBreakdown,
  };
}

export function buildFallbackResult(error: string): ScoringResult {
  return {
    score: 0,
    rating: 'not_ready',
    earnedScore: 0,
    maxPossibleScore: 0,
    failedRequiredChecks: [],
    triggeredDealbreakers: [],
    skillBreakdown: {},
  };
}
