import type { AssessmentMode, FinalReadiness } from './types';

export interface EvidenceCheckpoint {
  passed: boolean;
  evidence?: string;
}

export interface TicketScoreResult {
  score: number;
  checks: Record<string, boolean>;
  feedback: string[];
}

const CRITICAL_CHECKPOINTS = [
  'confirm_user',
  'confirm_company',
  'ask_business_impact',
  'ask_scope_one_or_many',
  'safe_advice',
  'no_invented_fix',
  'usable_ticket',
  'set_next_steps',
] as const;

export function calculateCheckpointScore(
  required: Record<string, boolean>,
  results: Record<string, boolean | EvidenceCheckpoint>
): { score: number; missed: string[]; criticalMisses: string[] } {
  const keys = Object.keys(required).filter((key) => required[key]);
  const passed = keys.filter((key) => {
    const result = results[key];
    return typeof result === 'boolean' ? result : result?.passed === true;
  });
  const missed = keys.filter((key) => !passed.includes(key));
  const criticalMisses = missed.filter((key) => (CRITICAL_CHECKPOINTS as readonly string[]).includes(key));
  return {
    score: keys.length ? Math.round((passed.length / keys.length) * 100) : 0,
    missed,
    criticalMisses,
  };
}

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

export function scoreTicket(ticket: string, transcriptText = ''): TicketScoreResult {
  const normalized = ticket.trim();
  const checks = Object.fromEntries(
    Object.entries(TICKET_PATTERNS).map(([key, pattern]) => [key, pattern.test(normalized)])
  );
  checks.sufficient_detail = normalized.split(/\s+/).filter(Boolean).length >= 25;

  const claimsResolution = /(?:definitely|confirmed cause|fixed by|root cause is|issue (?:is )?resolved|resolved by)/i.test(normalized);
  const transcriptSupportsResolution = /(?:confirmed (?:the )?cause|root cause|issue (?:is|was) resolved|fixed (?:the|by)|now working)/i.test(transcriptText);
  const suspiciousClaims = claimsResolution && !transcriptSupportsResolution;
  checks.no_invention = !suspiciousClaims;

  const score = Math.round(
    (Object.values(checks).filter(Boolean).length / Object.keys(checks).length) * 100
  );
  const feedback = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([key]) => `Missing or unclear: ${key.replace(/_/g, ' ')}.`);
  return { score, checks, feedback };
}

export function getReadinessLabel(
  averageScore: number,
  mode: AssessmentMode,
  criticalMisses: string[] = []
): FinalReadiness {
  const unsafe = criticalMisses.some((key) => ['safe_advice', 'no_invented_fix'].includes(key));
  const repeatedCritical = criticalMisses.length >= 2;
  if (mode === 'hiring') {
    if (averageScore >= 85 && criticalMisses.length === 0) return 'strong_hire';
    if (averageScore >= 70 && !unsafe && !repeatedCritical) return 'possible_hire';
    if (averageScore >= 50 && !unsafe) return 'risky_hire';
    return 'not_recommended';
  }
  if (averageScore >= 85 && criticalMisses.length === 0) return 'ready_low_risk_calls';
  if (averageScore >= 70 && !unsafe && !repeatedCritical) return 'ready_with_supervision';
  if (averageScore >= 50 && !unsafe) return 'triage_only';
  return 'not_ready';
}

export function combineCallAndTicketScore(callScore: number, ticketScore: number): number {
  return Math.round(callScore * 0.75 + ticketScore * 0.25);
}
