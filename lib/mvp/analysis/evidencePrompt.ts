import type { AnalysisContext } from './types';

export const EVIDENCE_PROMPT_VERSION = 'evidence-extraction-v1';

const CRITERIA_DEFINITIONS = [
  { key: 'identity_check', label: 'Candidate confirmed the caller name or identity' },
  { key: 'company_check', label: 'Candidate confirmed the company or organisation' },
  { key: 'issue_clarification', label: 'Candidate clarified the exact issue' },
  { key: 'started_when', label: 'Candidate asked when the issue started' },
  { key: 'impact', label: 'Candidate asked about business impact or blocked work' },
  { key: 'urgency', label: 'Candidate asked about deadline or urgency' },
  { key: 'scope', label: 'Candidate asked whether one user or multiple are affected' },
  { key: 'technical_discovery', label: 'Candidate performed technical discovery (webmail, other apps, etc.)' },
  { key: 'error_or_status_capture', label: 'Candidate asked for error messages or status indicators' },
  { key: 'recent_changes', label: 'Candidate asked about recent changes' },
  { key: 'next_steps', label: 'Candidate set clear next steps or expectations' },
  { key: 'customer_tone', label: 'Candidate used professional, empathetic tone' },
  { key: 'ticket_user_company', label: 'Ticket includes user name and company' },
  { key: 'ticket_issue_summary', label: 'Ticket includes clear issue summary' },
  { key: 'ticket_impact', label: 'Ticket includes business impact' },
  { key: 'ticket_urgency', label: 'Ticket includes urgency or deadline' },
  { key: 'ticket_checks_attempted', label: 'Ticket lists checks already attempted' },
  { key: 'ticket_next_step', label: 'Ticket includes next step or plan' },
  { key: 'escalation_judgement', label: 'Candidate showed appropriate escalation judgement' },
  { key: 'safety', label: 'Candidate avoided unsafe advice or invented fixes' },
];

export function buildEvidenceExtractionPrompt(context: AnalysisContext): { system: string; user: string } {
  const criteriaLines = CRITERIA_DEFINITIONS.map(c =>
    `  "${c.key}": { "status": "<pass|partial|fail|not_observed|not_applicable>", "severity": "<low|medium|high>", "evidence": ["<quote or observation>"], "notes": "<brief note>" }`
  ).join('\n');

  const systemPrompt = `You are an evidence extraction system for MSP support call assessments.

Your job is to extract observable evidence from the transcript and ticket. You do NOT decide the final score or rating.

For each criterion, determine whether the candidate demonstrated it:
- "pass": clearly demonstrated with evidence
- "partial": partially demonstrated but incomplete
- "fail": not demonstrated when it should have been
- "not_observed": could not determine from available data
- "not_applicable": not relevant to this scenario

Rules:
- Use only transcript and submitted ticket as evidence.
- Quote the candidate's actual words where possible.
- If something was clearly not asked or not captured, mark as "fail".
- For ticket criteria, use the submitted ticket content only.
- Hidden scenario facts may inform expected behaviours but do not reveal them.
- Do NOT produce final prose feedback. This is extraction only.

Return ONLY valid JSON with no additional text:

{
  "criteria": {
${criteriaLines}
  },
  "missed_questions": ["<question the candidate should have asked>"],
  "red_flags": [
    { "type": "<dealbreaker_type>", "severity": "<low|medium|high>", "evidence": "<explanation>" }
  ],
  "ticket_assessment": {
    "status": "<pass|partial|fail>",
    "missing_fields": ["<field name>"],
    "evidence": "<summary>"
  }
}`;

  const userPrompt = `TRANSCRIPT:
${context.transcript_text}

TICKET:
${context.submitted_ticket || 'No ticket submitted'}

${context.manager_standards ? `MANAGER STANDARDS:
Required ticket fields: ${JSON.stringify((context.manager_standards as any).required_ticket_fields || [])}
Call requirements: ${(context.manager_standards as any).call_requirements || ''}` : ''}

${context.active_scenario ? `SCENARIO: ${(context.active_scenario as any).title || ''}` : ''}

Extract evidence for each criterion and return JSON only.`;

  return { system: systemPrompt, user: userPrompt };
}

export { CRITERIA_DEFINITIONS };
