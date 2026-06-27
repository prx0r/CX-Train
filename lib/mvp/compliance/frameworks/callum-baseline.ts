import { FrameworkDefinition } from '../evaluator';

/**
 * Callum Baseline v1 — Standard Callum Assessment Rubric
 *
 * This is our internal assessment framework for MSP first-line support readiness.
 * It measures the fundamental behaviours required for effective support call handling:
 * identity verification, issue clarification, diagnosis, ticket documentation,
 * professional conduct, and safe security practices.
 *
 * Criteria are binary (pass/fail/not_observed) with 22 criteria across
 * 5 categories: fundamentals, call control, diagnosis, resolution, ticket quality.
 */
export const CALLUM_BASELINE_V1: FrameworkDefinition = {
  id: 'callum_baseline_v1',
  name: 'Callum Baseline',
  version: '1.0',
  type: 'baseline',
  category: 'call_quality',
  passThreshold: 60,
  weight: 1.0,
  description: 'Standard Callum assessment rubric for MSP first-line support readiness. 22 criteria across fundamentals, call control, diagnosis, resolution, and ticket quality. This is the primary scoring framework for candidate readiness assessment.',
  standardsAlignments: ['ITIL 4 Incident Management', 'ITIL 4 Service Desk', 'HDI Call Monitoring 4.0'],
  criteria: [
    // ── Fundamentals (Required) ──
    {
      id: 'submitted_ticket',
      label: 'Submitted a ticket — Did the candidate create a ticket for this interaction? Without a ticket, the interaction is not recorded and cannot be tracked, escalated, or billed.',
      weight: 0, critical: true, category: 'fundamentals',
      checkType: 'event_check', checkTarget: 'ticket_submitted', passIf: 'pass',
      evidenceDescription: 'A ticket must be submitted for every support interaction. Assessment: the ticket submission event is logged in the system. The candidate must complete the ticket creation process. If no ticket is created, this criterion fails.',
    },
    {
      id: 'performed_triage',
      label: 'Performed ticket triage — Did the candidate classify the ticket with the correct category, impact, and urgency? Triage enables correct routing and prioritisation.',
      weight: 0, critical: true, category: 'fundamentals',
      checkType: 'event_check', checkTarget: 'ticket_triage_submitted', passIf: 'pass',
      evidenceDescription: 'Ticket must be classified with appropriate category, impact level, and urgency. Assessment: the triage submission event is logged. The ticket must have the required classification fields populated — not left at defaults.',
    },
    {
      id: 'safety',
      label: 'No unsafe actions — Did the candidate avoid performing any actions that could compromise security, data integrity, or system stability?',
      weight: 0, critical: true, category: 'fundamentals',
      checkType: 'action_not_performed', checkTarget: 'red_flag_triggered', passIf: 'pass',
      evidenceDescription: 'The candidate must not perform any red-flagged unsafe actions. This includes: asking for passwords, disabling security controls, suggesting destructive actions without proper procedure, or any action that could cause harm. Assessment: the system monitors for red-flagged actions. If any are detected, this criterion fails automatically.',
    },
    {
      id: 'next_steps',
      label: 'Customer knows next steps — Did the candidate clearly communicate what will happen next, by when, and who will be responsible?',
      weight: 1, critical: true, category: 'fundamentals',
      checkType: 'ai_criteria', checkTarget: 'next_steps', passIf: 'pass',
      evidenceDescription: 'The candidate must set clear expectations for what happens next. Assessment criteria: (1) states what action will be taken; (2) states who will take it; (3) states the expected timeframe; (4) confirms the customer understands and agrees. A good example: "I\'m going to escalate this to our Level 2 team. They\'ll review it within the next hour and call you back. If you haven\'t heard from them by 3pm, please call us again." A poor example: "Someone will get back to you" with no timeframe or ownership.',
    },
    // ── Call Control ──
    {
      id: 'identity_check',
      label: 'Confirmed caller identity — Did the candidate ask who they were speaking to before discussing account details or proceeding with the request?',
      weight: 1, critical: false, category: 'call_control',
      checkType: 'ai_criteria', checkTarget: 'identity_check', passIf: 'pass_or_partial',
      evidenceDescription: 'The candidate must confirm the caller\'s identity. Assessment criteria: (1) asks for the caller\'s name; (2) uses additional verification for sensitive actions (password resets, account changes); (3) does not proceed without identity confirmation. A good example: "Before I proceed, can I take your name and confirm a few details?" A poor example: Proceeding with account changes without verifying who the caller is.',
    },
    {
      id: 'company_check',
      label: 'Confirmed company/client — Did the candidate confirm which company or client the caller is associated with?',
      weight: 1, critical: false, category: 'call_control',
      checkType: 'ai_criteria', checkTarget: 'company_check', passIf: 'pass_or_partial',
      evidenceDescription: 'The candidate must confirm the caller\'s company or organisation, particularly important for MSPs serving multiple clients. Assessment criteria: (1) asks which company the caller is from; (2) confirms against known client records; (3) ensures the correct client context for the ticket. A good example: "And which company are you with?" A poor example: Assuming the company based on caller ID without confirming.',
    },
    {
      id: 'customer_tone',
      label: 'Professional, respectful tone — Did the candidate maintain a professional and respectful tone throughout the interaction?',
      weight: 1, critical: false, category: 'call_control',
      checkType: 'ai_criteria', checkTarget: 'customer_tone', passIf: 'pass_or_partial',
      evidenceDescription: 'The candidate must maintain a professional tone. Assessment criteria: (1) uses polite language — please, thank you, you\'re welcome; (2) does not sound frustrated, dismissive, or condescending; (3) does not interrupt the customer; (4) adapts tone to the customer\'s emotional state — more empathetic when the customer is frustrated. A good example: Calm, measured tone even when the customer is upset. A poor example: Sighing, sounding annoyed, or being dismissive of the customer\'s concern.',
    },
    {
      id: 'customer_communication',
      label: 'Clear communication — Did the candidate communicate clearly, avoid unexplained jargon, and confirm the customer\'s understanding?',
      weight: 1, critical: false, category: 'call_control',
      checkType: 'ai_criteria', checkTarget: 'customer_communication', passIf: 'pass_or_partial',
      evidenceDescription: 'The candidate must communicate in a way the customer can understand. Assessment criteria: (1) explains technical concepts in plain language when speaking to non-technical users; (2) uses appropriate technical language when speaking to IT contacts; (3) confirms the customer\'s understanding — "Does that make sense?"; (4) avoids unexplained acronyms or jargon. A good example: "I\'m going to reset the connection between your computer and the email server. This should take about two minutes." A poor example: "Let me flush the DNS cache and reset the Winsock catalog" without explaining what that means.',
    },
    // ── Diagnosis ──
    {
      id: 'issue_clarification',
      label: 'Clarified the exact issue — Did the candidate ask the customer to describe the specific problem in their own words?',
      weight: 1, critical: false, category: 'diagnosis',
      checkType: 'ai_criteria', checkTarget: 'issue_clarification', passIf: 'pass_or_partial',
      evidenceDescription: 'The candidate must get a clear description of the issue from the customer. Assessment criteria: (1) asks the customer to describe what is happening; (2) asks follow-up questions to clarify vague descriptions; (3) distinguishes between symptoms and the underlying issue. A good example: "Tell me exactly what happens when you try to send an email. What error message do you see? What were you doing just before it stopped working?" A poor example: Accepting "Email is broken" at face value without asking for specifics.',
    },
    {
      id: 'started_when',
      label: 'Asked when it started — Did the candidate ask when the problem first began? Timing is essential for identifying recent changes.',
      weight: 1, critical: false, category: 'diagnosis',
      checkType: 'ai_criteria', checkTarget: 'started_when', passIf: 'pass_or_partial',
      evidenceDescription: 'The candidate must establish a timeline for the issue. Assessment criteria: (1) asks when the problem first started; (2) asks if it started suddenly or gradually; (3) correlates the start time with potential causes. A good example: "When did this start happening? Was it after an update or any change?" A poor example: Not asking about timing at all.',
    },
    {
      id: 'impact',
      label: 'Asked about business impact — Did the candidate ask how the issue affects the customer\'s work? This helps determine priority.',
      weight: 1, critical: false, category: 'diagnosis',
      checkType: 'ai_criteria', checkTarget: 'impact', passIf: 'pass_or_partial',
      evidenceDescription: 'The candidate must understand the business impact of the issue. Assessment criteria: (1) asks how the issue affects the customer\'s ability to work; (2) identifies what work is blocked or delayed; (3) uses the impact information to determine priority. A good example: "How is this affecting your work? Do you have any deadlines that might be impacted?" A poor example: Not asking about impact, or treating all issues as equally urgent.',
    },
    {
      id: 'urgency',
      label: 'Asked about urgency/deadline — Did the candidate ask about time sensitivity? Is there a deadline, a meeting, or a specific time by which the issue must be resolved?',
      weight: 1, critical: false, category: 'diagnosis',
      checkType: 'ai_criteria', checkTarget: 'urgency', passIf: 'pass_or_partial',
      evidenceDescription: 'The candidate must assess the urgency of the issue. Assessment criteria: (1) asks if there is a deadline or time-sensitive need; (2) distinguishes between urgent (blocked, deadline) and non-urgent (cosmetic, nice-to-have); (3) factors urgency into the response. A good example: "Is there a specific deadline or time you need this resolved by?" A poor example: Treating every issue with the same level of urgency.',
    },
    {
      id: 'scope',
      label: 'Asked scope — Did the candidate ask whether one user or multiple users are affected? This determines incident scope and priority.',
      weight: 1, critical: false, category: 'diagnosis',
      checkType: 'ai_criteria', checkTarget: 'scope', passIf: 'pass_or_partial',
      evidenceDescription: 'The candidate must determine the scope of the issue. Assessment criteria: (1) asks if the issue affects one person or multiple people; (2) asks if others in the same location or role are affected. A good example: "Is this just affecting you, or are other people in your team having the same issue?" A poor example: Treating it as a single-user issue without checking scope.',
    },
    {
      id: 'error_or_status_capture',
      label: 'Captured error/status details — Did the candidate ask for specific error messages, codes, or status indicators? Exact error details are critical for diagnosis.',
      weight: 1, critical: false, category: 'diagnosis',
      checkType: 'ai_criteria', checkTarget: 'error_or_status_capture', passIf: 'pass_or_partial',
      evidenceDescription: 'The candidate must capture specific error details. Assessment criteria: (1) asks for the exact error message text; (2) asks where the error appears; (3) records the exact message in the ticket. A good example: "What exactly does the error message say? Can you read it to me word for word?" A poor example: Accepting "It says there\'s an error" without getting the specific message.',
    },
    {
      id: 'recent_changes',
      label: 'Asked about recent changes — Did the candidate ask what changed before the problem started? Most issues are caused by a change.',
      weight: 1, critical: false, category: 'diagnosis',
      checkType: 'ai_criteria', checkTarget: 'recent_changes', passIf: 'pass_or_partial',
      evidenceDescription: 'The candidate must investigate recent changes. Assessment criteria: (1) asks about recent updates, installations, or changes; (2) asks about changes the user might not think to mention; (3) correlates change timing with issue timing. A good example: "Did anything change just before this started — any updates installed, settings changed, or new software added?" A poor example: Not asking about changes at all.',
    },
    {
      id: 'technical_discovery',
      label: 'Performed technical investigation — Did the candidate perform structured troubleshooting beyond surface-level questions?',
      weight: 1, critical: false, category: 'diagnosis',
      checkType: 'ai_criteria', checkTarget: 'technical_discovery', passIf: 'pass_or_partial',
      evidenceDescription: 'The candidate must perform active technical investigation. Assessment criteria: (1) uses available diagnostic tools (remote access, status checks, command line); (2) follows a logical diagnostic path rather than guessing; (3) checks the most likely causes first; (4) involves the user in diagnostic steps they can perform. A good example: "Let me check a few things. First, can you try accessing webmail to see if it\'s Outlook-specific or account-wide? While you do that, I\'ll check the server status from here." A poor example: Guessing the solution without any investigation, or asking the user to try unrelated steps.',
    },
    // ── Resolution ──
    {
      id: 'escalation_judgement',
      label: 'Appropriate escalation — Did the candidate escalate when appropriate, with sufficient context, to the right team?',
      weight: 1, critical: false, category: 'resolution',
      checkType: 'ai_criteria', checkTarget: 'escalation_judgement', passIf: 'pass_or_partial',
      evidenceDescription: 'The candidate must know when to escalate. Assessment criteria: (1) attempts first-line resolution before escalating; (2) recognises when an issue is beyond their capability; (3) provides complete context with escalation; (4) does not escalate unnecessarily. A good example: "I\'ve checked the basics and the issue appears to be server-side. I\'m going to escalate this to our server team with details of what I\'ve already checked." A poor example: "I don\'t know, I\'ll pass you to someone else" without providing context.',
    },
    // ── Ticket Quality ──
    {
      id: 'ticket_user_company',
      label: 'Ticket: user + company — Does the ticket clearly identify the user and their company?',
      weight: 1, critical: false, category: 'ticket_quality',
      checkType: 'ticket_field', checkTarget: 'requester', passIf: 'pass_or_partial',
      evidenceDescription: 'The ticket must identify who the caller is and which organisation they belong to. Assessment: the ticket has the requester name and company/account fields populated.',
    },
    {
      id: 'ticket_issue_summary',
      label: 'Ticket: clear issue summary — Does the ticket have a clear, descriptive summary of the issue?',
      weight: 1, critical: false, category: 'ticket_quality',
      checkType: 'ticket_field', checkTarget: 'issue', passIf: 'pass_or_partial',
      evidenceDescription: 'The ticket must have a descriptive summary. Assessment criteria: the summary field captures the issue clearly — not generic like "Email problem" but specific like "Outlook stuck in Work Offline mode after network change — cannot send emails."',
    },
    {
      id: 'ticket_impact',
      label: 'Ticket: business impact — Does the ticket document the business impact of the issue?',
      weight: 1, critical: false, category: 'ticket_quality',
      checkType: 'ticket_field', checkTarget: 'impact', passIf: 'pass_or_partial',
      evidenceDescription: 'The ticket must record the business impact. Assessment: the impact field is populated with the actual business effect, not left blank or set to a default value.',
    },
    {
      id: 'ticket_urgency',
      label: 'Ticket: urgency/deadline — Does the ticket record the urgency or deadline for resolution?',
      weight: 1, critical: false, category: 'ticket_quality',
      checkType: 'ticket_field', checkTarget: 'urgent', passIf: 'pass_or_partial',
      evidenceDescription: 'The ticket must record the urgency level. Assessment: the urgency field reflects the actual time sensitivity discussed during the call.',
    },
    {
      id: 'ticket_checks_attempted',
      label: 'Ticket: checks attempted — Does the ticket list the diagnostic checks or troubleshooting steps that were performed?',
      weight: 1, critical: false, category: 'ticket_quality',
      checkType: 'ticket_field', checkTarget: 'checked', passIf: 'pass_or_partial',
      evidenceDescription: 'The ticket must document what was checked. Assessment: the ticket includes a record of diagnostic steps taken and their results, not just the final resolution.',
    },
    {
      id: 'ticket_next_step',
      label: 'Ticket: next step — Does the ticket document the next action or follow-up plan?',
      weight: 1, critical: false, category: 'ticket_quality',
      checkType: 'ticket_field', checkTarget: 'next steps', passIf: 'pass_or_partial',
      evidenceDescription: 'The ticket must document what happens next. Assessment: the ticket includes the next action, who is responsible, and the expected timeframe for follow-up.',
    },
  ],
};
