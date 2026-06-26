import type { AnalysisContext } from './types';

export const EVIDENCE_PROMPT_VERSION = 'evidence-extraction-v2-analysis-hardening';

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
  { key: 'professional_conduct', label: 'Candidate remained professional, did not abuse or dismiss the customer' },
  { key: 'customer_communication', label: 'Candidate communicated clearly and respectfully throughout' },
  { key: 'ticket_user_company', label: 'Ticket includes user name and company' },
  { key: 'ticket_issue_summary', label: 'Ticket includes clear issue summary' },
  { key: 'ticket_impact', label: 'Ticket includes business impact' },
  { key: 'ticket_urgency', label: 'Ticket includes urgency or deadline' },
  { key: 'ticket_checks_attempted', label: 'Ticket lists checks already attempted' },
  { key: 'ticket_next_step', label: 'Ticket includes next step or plan' },
  { key: 'escalation_judgement', label: 'Candidate showed appropriate escalation judgement' },
  { key: 'safety', label: 'Candidate avoided unsafe advice or invented fixes' },
];

const RED_FLAG_DEFINITIONS = [
  { type: 'severe_customer_abuse', label: 'Candidate directly insulted, swore at, mocked, threatened, or abused the customer', severity: 'critical' },
  { type: 'unsafe_security_behaviour', label: 'Candidate asked for password, MFA code, or sensitive credentials, or suggested disabling security', severity: 'critical' },
  { type: 'refusal_to_help', label: 'Candidate refused to troubleshoot, dismissed the issue, or abandoned the customer without valid reason', severity: 'critical' },
  { type: 'hallucinated_fix', label: 'Candidate claimed issue is resolved or invented a diagnosis without evidence', severity: 'high' },
  { type: 'unsafe_advice', label: 'Candidate gave advice that could cause harm or data loss', severity: 'high' },
  { type: 'invented_fix_without_evidence', label: 'Candidate invented a fix not supported by the transcript', severity: 'high' },
  { type: 'no_troubleshooting', label: 'Candidate performed no meaningful troubleshooting', severity: 'high' },
];

export function buildEvidenceExtractionPrompt(context: AnalysisContext): { system: string; user: string } {
  const criteriaLines = CRITERIA_DEFINITIONS.map(c =>
    `  "${c.key}": { "status": "<pass|partial|fail|not_observed|not_applicable>", "severity": "<low|medium|high>", "evidence": ["<exact quote from transcript>"], "notes": "<brief rationale>" }`
  ).join('\n');

  const redFlagLines = RED_FLAG_DEFINITIONS.map(r =>
    `  { "type": "${r.type}", "severity": "${r.severity}", "evidence": "<explanation with quote if applicable>" }`
  ).join('\n');

  const systemPrompt = `You are an evidence extraction system for MSP support call assessments.

Your job is to extract observable evidence from the transcript and ticket. You do NOT decide the final score or rating.

For each criterion, determine whether the candidate demonstrated it:
- "pass": clearly demonstrated with evidence
- "partial": partially demonstrated but incomplete
- "fail": not demonstrated when it should have been
- "not_observed": could not determine from available data
- "not_applicable": not relevant to this scenario

CRITICAL RULES:
1. If the candidate swore at, insulted, mocked, threatened, or was hostile toward the customer, you MUST set "professional_conduct" to "fail" and add a red flag of type "severe_customer_abuse".
2. If the candidate asked for passwords, MFA codes, or sensitive credentials, or suggested disabling security controls, you MUST add a red flag of type "unsafe_security_behaviour".
3. If the candidate refused to help, dismissed the issue, or ended the call without valid reason, you MUST add a red flag of type "refusal_to_help".
4. If the candidate claimed a fix or diagnosis without evidence from the transcript, you MUST add a red flag of type "hallucinated_fix" or "invented_fix_without_evidence".
5. If the candidate asked no meaningful questions and performed no troubleshooting, you MUST add a red flag of type "no_troubleshooting".
6. Use only transcript and submitted ticket as evidence.
7. Quote the candidate's actual words where possible. Exact quotes are critical.
8. For ticket criteria, use the submitted ticket content only.
9. Do NOT produce final prose feedback. This is extraction only.
10. Severe conduct failures override normal scoring. Flag them even if other parts of the call seemed good.

Return ONLY valid JSON with no additional text:

{
  "criteria": {
${criteriaLines}
  },
  "missed_questions": ["<question the candidate should have asked>"],
  "red_flags": [
${redFlagLines}
  ],
  "ticket_assessment": {
    "status": "<pass|partial|fail>",
    "missing_fields": ["<field name>"],
    "evidence": "<summary>"
  }
}`;

  const scenarioContext = context.active_scenario
    ? `Scenario: ${(context.active_scenario as any).title || ''}`
    : '';

  const timelineText = context.evidence_timeline && context.evidence_timeline.length > 0
    ? `\n\nSIMULATION TIMELINE (actions performed by the candidate):\n${context.evidence_timeline.map((e: any) =>
        `[${e.formatted_time}] ${e.actor}: ${e.label || e.event_type}${e.result_text ? ' → ' + e.result_text : ''}${e.is_red_flag ? ' ⚠' : ''}`
      ).join('\n')}`
    : '';

  const userPrompt = `TRANSCRIPT:
${context.transcript_text}${timelineText}

TICKET:
${context.submitted_ticket || 'No ticket submitted'}

${context.manager_standards ? `MANAGER STANDARDS:
Required ticket fields: ${JSON.stringify((context.manager_standards as any).required_ticket_fields || [])}
Call requirements: ${(context.manager_standards as any).call_requirements || ''}` : ''}

${scenarioContext}

Extract evidence for each criterion and return JSON only. Remember: quote exact words, flag conduct failures.`;

  return { system: systemPrompt, user: userPrompt };
}

export { CRITERIA_DEFINITIONS, RED_FLAG_DEFINITIONS };
