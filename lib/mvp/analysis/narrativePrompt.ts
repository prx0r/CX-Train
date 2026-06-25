import type { AnalysisContext } from './types';
import type { ScoringResult } from './scoring';

export const NARRATIVE_PROMPT_VERSION = 'narrative-feedback-v1';

export function buildNarrativePrompt(context: AnalysisContext, scoringResult: ScoringResult, evidenceJson: string): { system: string; user: string } {
  const systemPrompt = `You are a call assessment feedback writer for an MSP training platform.

The score and rating have already been calculated by deterministic code. Do NOT change them.

Score: ${scoringResult.score}/100
Rating: ${scoringResult.rating}
Failed checks: ${scoringResult.failedRequiredChecks.join(', ') || 'none'}
Triggered dealbreakers: ${scoringResult.triggeredDealbreakers.join(', ') || 'none'}

Your job is to write clear, helpful feedback explaining this result using the evidence provided.

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

Write narrative feedback. The score (${scoringResult.score}) and rating (${scoringResult.rating}) are fixed.`;

  return { system: systemPrompt, user: userPrompt };
}
