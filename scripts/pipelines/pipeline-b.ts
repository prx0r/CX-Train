/**
 * Pipeline B — AI Decides Relevance (One Call)
 *
 * The AI extraction call includes `relevant: bool` per criterion.
 * Criteria marked `relevant: false` are excluded from scoring entirely.
 * This replaces the manual pack-relevance.ts mapping with AI judgment.
 *
 * AI calls: 2 (same as Pipeline A — relevance added to existing extraction call)
 * Cost: Identical to A
 * Risk: AI may mark things relevant when they aren't (false positive) or vice versa
 */

import { scoreExtraction, DEFAULT_WEIGHTS } from '../../lib/mvp/analysis/scoring';
import type { AnalysisFixture, PipelineResult } from '../run-pipeline-tests';

const ALL_WEIGHT_KEYS = Object.keys(DEFAULT_WEIGHTS);

/**
 * Mock AI relevance judgment.
 *
 * In production, the AI would return this inline with the evidence extraction.
 * Here, we simulate it based on the fixture's must_pass/must_fail + heuristics.
 *
 * The key difference from Pipeline A: 
 *   Pipeline A scores ALL 22 criteria (not_observed = 0 points, counted in denominator).
 *   Pipeline B excludes irrelevant criteria entirely from scoring.
 *
 * This affects the score because the denominator shrinks.
 */
function mockAiRelevance(fixture: AnalysisFixture): {
  relevantCriteria: Record<string, { status: string; relevant: boolean }>;
} {
  const passSet = new Set(fixture.expected.must_pass || []);
  const failSet = new Set(fixture.expected.must_fail || []);

  const relevantCriteria: Record<string, { status: string; relevant: boolean }> = {};

  for (const key of ALL_WEIGHT_KEYS) {
    if (passSet.has(key)) {
      // Must-pass criteria are relevant and pass
      relevantCriteria[key] = { status: 'pass', relevant: true };
    } else if (failSet.has(key)) {
      // Must-fail criteria are relevant and fail
      relevantCriteria[key] = { status: 'fail', relevant: true };
    } else {
      // NOT in must_pass or must_fail — AI decides relevance
      // Heuristic: if the scenario description mentions related topics, mark relevant
      // For test purposes, we simulate the AI's decision based on scenario context.
      // In production, the actual AI call would decide.
      relevantCriteria[key] = mockRelevanceJudgment(key, fixture);
    }
  }

  return { relevantCriteria };
}

/**
 * Simulates AI relevance judgment for criteria not explicitly listed as pass/fail.
 * 
 * This models what the AI would do: read the transcript, understand the scenario,
 * and decide if each criterion's topic was actually discussed.
 *
 * For test transcripts about password-reset / account-lockout scenarios:
 *   - Identity, company, issue clarification → always relevant (discussed)
 *   - Impact, urgency → relevant if customer mentioned urgency
 *   - Started_when, scope → relevant if candidate asked
 *   - Technical discovery → relevant if candidate did troubleshooting
 *   - Malware, secure config → NOT relevant for password reset
 *   - Recent changes → relevant if candidate asked about it
 *   - Next steps → relevant if candidate set expectations
 */
function mockRelevanceJudgment(
  key: string,
  fixture: AnalysisFixture,
): { status: string; relevant: boolean } {
  const transcriptText = fixture.transcript.map(m => m.content).join(' ').toLowerCase();
  const ticketText = (fixture.ticket.summary + ' ' + fixture.ticket.description).toLowerCase();
  const combined = transcriptText + ' ' + ticketText;

  // Patterns that suggest a criterion IS relevant to this conversation
  const relevanceIndicators: Record<string, string[]> = {
    started_when: ['when did', 'when this start', 'how long', 'started'],
    impact: ['blocked', 'can\'t work', 'deadline', 'urgent', 'client meeting', 'patients', 'presentation'],
    urgency: ['urgent', 'asap', 'soon', 'deadline', 'client meeting', '45 minutes', 'an hour'],
    scope: ['just you', 'others', 'anyone else', 'one user', 'multiple'],
    error_or_status_capture: ['error', 'message says', 'showing', 'code'],
    recent_changes: ['changed', 'updated', 'installed', 'recent', 'yesterday', 'reboot'],
    technical_discovery: ['check', 'look at', 'investigate', 'diagnos', 'test', 'try'],
    escalation_judgement: ['escalat', 'second line', 'level 2', 'l2', 'manager'],
    customer_tone: ['please', 'thank', 'sorry', 'appreciate', 'apolog'],
    customer_communication: ['clear', 'explain', 'underst', 'let me know', 'call us back'],
    professional_conduct: ['sorry', 'please', 'thank', 'apologise'],
    next_steps: ['check your', 'you should', 'will arrive', 'call us back', 'within'],
    ticket_user_company: ['name', 'company', 'user'],
    ticket_issue_summary: ['issue', 'problem', 'error', 'cannot'],
    ticket_impact: ['blocked', 'urgent', 'deadline', 'impact'],
    ticket_urgency: ['urgent', 'priority', 'deadline'],
    ticket_checks_attempted: ['checked', 'tried', 'attempted', 'log'],
    ticket_next_step: ['next step', 'will', 'follow up', 'reset', 'email'],
    safety: ['password', 'secure', 'safe', 'unsafe', 'lock'],
  };

  const indicators = relevanceIndicators[key];
  if (indicators && indicators.some(i => combined.includes(i))) {
    return { status: 'pass', relevant: true };
  }

  // Default: not relevant (topic wasn't discussed)
  return { status: 'not_observed', relevant: false };
}

export const pipelineB = {
  name: 'B: AI Decides Relevance',
  id: 'pipeline-b',

  async run(fixture: AnalysisFixture): Promise<PipelineResult> {
    const { relevantCriteria } = mockAiRelevance(fixture);

    // Separate relevant from irrelevant
    const scoredCriteria: Record<string, { status: string }> = {};
    let notApplicableCount = 0;

    for (const key of ALL_WEIGHT_KEYS) {
      const entry = relevantCriteria[key];
      if (entry && entry.relevant) {
        scoredCriteria[key] = { status: entry.status };
      } else {
        notApplicableCount++;
      }
    }

    // Build red flags from fixture
    const redFlags: Array<{ type: string; severity?: string; evidence?: string }> = [];
    if (fixture.expected.must_trigger_red_flags) {
      for (const rf of fixture.expected.must_trigger_red_flags) {
        redFlags.push({ type: rf, severity: 'high', evidence: 'fixture expectation' });
      }
    }

    const scoringResult = scoreExtraction({ criteria: scoredCriteria, redFlags });

    const passKeys = fixture.expected.must_pass || [];
    const failKeys = fixture.expected.must_fail || [];
    const relevantKeys = ALL_WEIGHT_KEYS.filter(k => relevantCriteria[k]?.relevant);
    const irrelevantKeys = ALL_WEIGHT_KEYS.filter(k => !relevantCriteria[k]?.relevant);

    return {
      pipelineId: 'pipeline-b',
      pipelineName: this.name,
      score: scoringResult.score,
      rawScore: scoringResult.rawScoreBeforeCaps,
      readiness: scoringResult.rating,
      verdict: scoringResult.verdict,
      redFlags: scoringResult.gateHits.map(g => ({
        type: g.id,
        severity: g.severity,
        evidence: g.evidence.map(e => e.quote || e.note || '').join('; '),
      })),
      triggeredDealbreakers: scoringResult.triggeredDealbreakers,
      criterionCount: {
        total: ALL_WEIGHT_KEYS.length,
        pass: passKeys.length,
        fail: failKeys.length,
        notApplicable: irrelevantKeys.length,
      },
      aiCalls: 2,
      estimatedTokens: 6200, // Slightly more due to `relevant` field in output
      validation: {
        groundedQuotes: 0,
        ungroundedQuotes: 0,
        warnings: [],
      },
    };
  },
};
