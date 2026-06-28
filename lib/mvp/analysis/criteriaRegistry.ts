export const CATEGORY_CRITERIA_MAP: Record<string, string[]> = {
  fundamentals: ['submitted_ticket', 'performed_triage', 'next_steps'],
  call_control: ['identity_check', 'company_check', 'customer_tone', 'professional_conduct', 'customer_communication'],
  diagnosis: ['issue_clarification', 'started_when', 'impact', 'urgency', 'scope', 'technical_discovery', 'error_or_status_capture', 'recent_changes'],
  resolution: ['safety', 'escalation_judgement'],
  ticket_quality: ['ticket_user_company', 'ticket_issue_summary', 'ticket_impact', 'ticket_urgency', 'ticket_checks_attempted', 'ticket_next_step'],
  professionalism: ['unsafe_security_behaviour', 'severe_customer_abuse', 'refusal_to_help', 'hallucinated_fix', 'unsafe_advice', 'invented_fix_without_evidence', 'no_troubleshooting'],
};

export const CATEGORY_LABELS: Record<string, string> = {
  fundamentals: 'Fundamentals (Required)',
  call_control: 'Call Control & Communication',
  diagnosis: 'Diagnosis & Investigation',
  resolution: 'Resolution & Fix',
  ticket_quality: 'Ticket Quality',
  professionalism: 'Professionalism & Safety',
};

export const CRITERION_LABELS: Record<string, string> = {
  submitted_ticket: 'Submitted a ticket/closure',
  performed_triage: 'Performed ticket triage',
  identity_check: 'Confirmed caller identity',
  company_check: 'Confirmed company name',
  customer_tone: 'Professional tone with customer',
  professional_conduct: 'Professional conduct throughout',
  customer_communication: 'Clear customer communication',
  issue_clarification: 'Clarified the issue',
  started_when: 'Asked when it started',
  impact: 'Asked about business impact',
  urgency: 'Asked about urgency/deadline',
  scope: 'Asked scope (one or many users)',
  technical_discovery: 'Performed technical discovery',
  error_or_status_capture: 'Captured error messages or status',
  recent_changes: 'Asked about recent changes',
  safety: 'Safety awareness',
  escalation_judgement: 'Appropriate escalation judgement',
  next_steps: 'Set clear next steps',
  ticket_user_company: 'Ticket: user + company',
  ticket_issue_summary: 'Ticket: issue summary',
  ticket_impact: 'Ticket: impact noted',
  ticket_urgency: 'Ticket: urgency noted',
  ticket_checks_attempted: 'Ticket: checks attempted',
  ticket_next_step: 'Ticket: next step set',
  unsafe_security_behaviour: 'Unsafe security behaviour',
  severe_customer_abuse: 'Severe customer abuse',
  refusal_to_help: 'Refusal to help',
  hallucinated_fix: 'Hallucinated a fix',
  unsafe_advice: 'Gave unsafe advice',
  invented_fix_without_evidence: 'Invented fix without evidence',
  no_troubleshooting: 'No troubleshooting performed',
};

export function criteriaForCategories(categories: string[]): string[] {
  const criteria = new Set<string>();
  for (const category of categories) {
    for (const criterionId of CATEGORY_CRITERIA_MAP[category] || []) {
      criteria.add(criterionId);
    }
  }
  return [...criteria];
}
