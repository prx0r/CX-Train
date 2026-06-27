import { FrameworkDefinition } from '../evaluator';

/**
 * ITIL 4 Service Desk Practice
 *
 * Source: AXELOS/PeopleCert ITIL 4 — official text is paywalled.
 * This implementation uses publicly available descriptions.
 *
 * The ITIL 4 Service Desk is the single point of contact between the
 * service provider and users. Key responsibilities include:
 * - Logging and managing incidents and service requests
 * - Providing first-line support and initial diagnosis
 * - Keeping users informed of progress
 * - Closing incidents and confirming user satisfaction
 * - Proactive user communication
 */
export const ITIL_SERVICE_DESK: FrameworkDefinition = {
  id: 'itil_service_desk',
  name: 'ITIL Service Desk Practice',
  version: '2.0',
  type: 'skills_framework',
  category: 'process_professionalism',
  passThreshold: 70,
  weight: 1.0,
  description: 'ITIL 4 Service Desk practice — aligned via publicly available descriptions. Assesses call lifecycle management: single point of contact, ownership, structured opening and closing, needs assessment, and documentation.',
  standardsAlignments: ['ITIL 4 Service Desk Practice'],
  criteria: [
    {
      id: 'sd_proper_opening',
      label: 'Proper opening and greeting — Did the candidate use a professional greeting, identify themselves and their organization, and set a positive tone for the interaction?',
      weight: 8,
      critical: false,
      category: 'call_handling',
      checkType: 'ai_criteria',
      checkTarget: 'sd_proper_opening',
      passIf: 'pass_or_partial',
      evidenceDescription: 'ITIL 4 Service Desk practice — professional opening. The service desk is the single point of contact and the first impression for the user. Assessment criteria: (1) uses a professional greeting — identifies themselves, their team/organization, and offers assistance; (2) sounds welcoming and prepared to help, not rushed or disinterested; (3) asks for the caller\'s name and begins the verification process naturally; (4) sets the expectation for the call — "I\'ll help you with that, let me start by confirming a few details." A good example: "Good morning, this is Alex from CX-Train Support. How can I help you today?" followed by a natural transition into verification. A poor example: A rushed "Hello" with no identification, or "What\'s the problem?" without any greeting.',
    },
    {
      id: 'sd_needs_assessment',
      label: 'Conducted needs assessment — Did the candidate ask probing questions to fully understand the issue before attempting a solution?',
      weight: 8,
      critical: false,
      category: 'call_handling',
      checkType: 'ai_criteria',
      checkTarget: 'issue_clarification',
      passIf: 'pass_or_partial',
      evidenceDescription: 'ITIL 4 Service Desk — needs assessment: the service desk must gather enough information to understand, categorize, and prioritize the issue before attempting resolution. Assessment criteria: (1) asks open-ended questions to understand the full scope of the issue; (2) does not jump to solutions before understanding the problem; (3) asks clarifying follow-up questions based on the user\'s responses; (4) captures the key details needed for ticket creation — who, what, when, impact. A good example: "Tell me what\'s happening when you try to send an email. When did this start? Is it affecting just Outlook or webmail too? What error message do you see?" A poor example: "Email not working? Okay, let me try resetting your password." — jumping to a solution without understanding the issue.',
    },
    {
      id: 'sd_ownership',
      label: 'Demonstrated ownership — Did the candidate take ownership of the issue and not unnecessarily transfer or deflect the caller?',
      weight: 8,
      critical: false,
      category: 'call_handling',
      checkType: 'ai_criteria',
      checkTarget: 'sd_ownership',
      passIf: 'pass_or_partial',
      evidenceDescription: 'ITIL 4 Service Desk — ownership: the service desk is the single point of contact and should maintain ownership of the issue even when it needs to be escalated. Assessment criteria: (1) takes ownership of the issue from the start — "Let me help you with that"; (2) does not deflect or transfer unnecessarily — tries to handle at first level when appropriate; (3) when escalation is needed, stays involved or ensures a warm handover (introduces the next contact, provides context); (4) follows up if a callback was promised. A good example: "I\'m going to own this ticket. Let me investigate what I can from here, and if I need to involve another team, I\'ll make sure they have everything they need." A poor example: "That\'s not my department, I\'ll transfer you" without attempting to help or providing context to the next team.',
    },
    {
      id: 'sd_proper_closing',
      label: 'Proper closing and confirmation — Did the candidate summarize the resolution, confirm the user\'s satisfaction, and set expectations for follow-up?',
      weight: 8,
      critical: false,
      category: 'call_handling',
      checkType: 'ai_criteria',
      checkTarget: 'sd_proper_closing',
      passIf: 'pass_or_partial',
      evidenceDescription: 'ITIL 4 Service Desk — proper closure: the call should end with a clear summary of what was done, confirmation of resolution, and next steps. Assessment criteria: (1) summarizes what was done during the call; (2) confirms the user\'s issue is resolved or sets clear expectations if not; (3) explains what happens next — any follow-up, escalation, or actions the user needs to take; (4) thanks the user and ends the call professionally; (5) confirms the user has no further questions before ending. A good example: "To summarize what we did today: I\'ve reset your password and sent the reset link to your email. You should be able to log in now. Please try and let me know if there are any issues. Is there anything else I can help you with?" A poor example: "Okay, bye" without any summary, confirmation, or follow-up expectations.',
    },
    {
      id: 'sd_documentation',
      label: 'Issue documented completely — Did the candidate document the call findings, actions taken, and next steps in the ticket?',
      weight: 8,
      critical: false,
      category: 'documentation',
      checkType: 'ticket_field',
      checkTarget: 'ticket',
      passIf: 'pass_or_partial',
      evidenceDescription: 'ITIL 4 Service Desk — documentation: the ticket must be a complete record of the interaction. Assessment criteria: (1) captures the issue description in the user\'s own words; (2) documents diagnostic steps taken and findings; (3) records the resolution applied or reason for escalation; (4) includes any follow-up actions required; (5) the ticket is understandable without the person who took the call needing to explain it. A good example: "Caller: Sarah Thompson, Apex Consulting. Issue: Cannot send emails from Outlook — getting 'Working Offline' in status bar. Checked: Network settings show connected, Outlook status shows offline. Action: Disabled 'Work Offline' mode, sent test email successfully. Resolution: User confirmed email sent. Root cause: Outlook was stuck in offline mode. Follow-up: None required." A poor example: "Email fixed" or a ticket that only contains the resolution without the diagnostic context.',
    },
  ],
};
