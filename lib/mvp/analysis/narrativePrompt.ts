import type { AnalysisContext, FailGateHit } from './types';

export const NARRATIVE_PROMPT_VERSION = 'narrative-feedback-v2-analysis-hardening';

export interface NarrativeScoringInput {
  score: number;
  rawScoreBeforeCaps: number;
  rating: string;
  earnedScore: number;
  maxPossibleScore: number;
  failedRequiredChecks: string[];
  triggeredDealbreakers: string[];
  gateHits: FailGateHit[];
  skillBreakdown: Record<string, { score: number; maxScore: number; percent: number }>;
}

export function buildNarrativePrompt(context: AnalysisContext, scoringResult: NarrativeScoringInput, evidenceJson: string): { system: string; user: string } {
  const gateInfo = scoringResult.gateHits.length > 0
    ? `FAIL GATES TRIGGERED:\n${scoringResult.gateHits.map(g =>
        `  - ${g.label} (severity: ${g.severity}, score cap: ${g.scoreCap})`
      ).join('\n')}\n\nThe score has been capped from ${scoringResult.rawScoreBeforeCaps} to ${scoringResult.score} due to these gates.`
    : 'No fail gates triggered.';

  const systemPrompt = `You are a call assessment feedback writer for an MSP training platform.

The score, rating, and fail gates have already been determined by deterministic code. Do NOT change them.

Score: ${scoringResult.score}/100 (raw before caps: ${scoringResult.rawScoreBeforeCaps})
Rating: ${scoringResult.rating}
Failed checks: ${scoringResult.failedRequiredChecks.join(', ') || 'none'}
Triggered dealbreakers: ${scoringResult.triggeredDealbreakers.join(', ') || 'none'}

${gateInfo}

Your job is to write clear, helpful feedback explaining this result using the evidence provided.
If a critical fail gate was triggered, explain clearly what the candidate did wrong and why it caused a score cap.
If no gates were triggered, provide normal coaching feedback.

Return ONLY valid JSON with no additional text:

{
  "summary": "<2-3 sentence summary of performance>",
  "strengths": ["<strength description>", ...],
  "improvements": ["<area to improve with specific reference to transcript/ticket>", ...],
  "most_costly_miss": "<single most impactful thing the candidate missed>",
  "ticket_feedback": "<feedback on the submitted ticket>",
  "better_phrasing_examples": ["<what the candidate could have said instead>", ...],
  "manager_standard_fit": {
    "status": "pass|partial|fail",
    "notes": ["<note about standards fit>", ...]
  },
  "coaching_focus": ["<specific coaching point>", ...]
}`;

  const userPrompt = `EVIDENCE:
${evidenceJson}

TRANSCRIPT:
${context.transcript_text}

TICKET:
${context.submitted_ticket || 'No ticket submitted'}

${context.manager_standards ? `MANAGER STANDARDS:
Call requirements: ${(context.manager_standards as any).call_requirements || ''}
Good ticket example: ${(context.manager_standards as any).good_ticket_example || ''}` : ''}

Write narrative feedback. The score (${scoringResult.score}), raw score (${scoringResult.rawScoreBeforeCaps}), and rating (${scoringResult.rating}) are fixed.`;

  return { system: systemPrompt, user: userPrompt };
}
