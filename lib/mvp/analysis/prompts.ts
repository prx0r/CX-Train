export const PROMPT_VERSION = 'base-callum-v1';
export const RUBRIC_VERSION = 'msp-first-line-v1';

export const PROMPT_SUFFIX = `Return ONLY valid JSON with this exact structure:
{
  "overall_score": <number 0-100>,
  "readiness_label": "ready|needs_supervision|not_ready",
  "summary": "<2-3 sentence summary>",
  "strengths": ["<strength 1>", ...],
  "weaknesses": ["<weakness 1>", ...],
  "checkpoints": {
    "confirmed_user": false,
    "confirmed_company": false,
    "captured_device_or_hostname": false,
    "clarified_issue": false,
    "asked_scope": false,
    "asked_impact": false,
    "asked_deadline_or_urgency": false,
    "asked_error_message": false,
    "asked_recent_changes": false,
    "set_next_steps": false,
    "used_clear_language": false,
    "showed_empathy": false,
    "invented_fix": false,
    "unsafe_advice": false
  },
  "evidence_quotes": ["<quote from transcript>", ...],
  "ticket_score": <number 0-100>,
  "ticket_feedback": "<feedback on ticket>"
}

Be honest and specific. Quote the candidate's actual words.`;

export function getDefaultModel(): string {
  return process.env.AI_EVALUATOR_MODEL || 'openai/gpt-4o-mini';
}
