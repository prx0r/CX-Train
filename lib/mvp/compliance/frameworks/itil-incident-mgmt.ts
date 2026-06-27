import { FrameworkDefinition } from '../evaluator';

/**
 * ITIL 4 Incident Management Practice
 *
 * Source: AXELOS/PeopleCert ITIL 4 — official text is paywalled.
 * This implementation uses publicly available descriptions aligned with
 * ITIL 4 practices via the YaSM Service Management Wiki (CC BY-ND 4.0),
 * which explicitly maps each process to the corresponding ITIL 4 practice.
 *
 * ITIL 4 Incident Management key activities:
 * - Incident identification and logging
 * - Categorization and prioritization
 * - Initial diagnosis and escalation
 * - Investigation and diagnosis
 * - Resolution and recovery
 * - Incident closure
 * - Major incident management
 */
export const ITIL_INCIDENT_MGMT: FrameworkDefinition = {
  id: 'itil_incident_mgmt',
  name: 'ITIL Incident Management',
  version: '2.0',
  type: 'skills_framework',
  category: 'technical_troubleshooting',
  passThreshold: 70,
  weight: 1.0,
  description: 'ITIL 4 Incident Management practice — aligned via YaSM reference model. Assesses incident handling from logging through diagnosis, escalation, resolution, and closure. The official ITIL 4 text is copyright AXELOS; this is an assessment mapping.',
  standardsAlignments: ['ITIL 4 Incident Management Practice (aligned via YaSM)'],
  criteria: [
    {
      id: 'itil_inc_categorization',
      label: 'Incident categorised correctly — Did the candidate assign the correct category, type, and sub-type to the incident based on the reported symptoms?',
      weight: 8,
      critical: false,
      category: 'triage',
      checkType: 'triage_check',
      checkTarget: 'category',
      passIf: 'pass_or_partial',
      evidenceDescription: 'ITIL 4 Incident Management — Categorization: "To record all relevant details of incidents and service requests, to verify that all required authorizations are given, and to prioritize the incidents or requests" (YaSM LP4.6.2). The candidate must assign the correct category and subcategory to the incident based on the symptoms described. Assessment criteria: (1) selects a category that matches the reported symptoms; (2) goes beyond the top-level category to assign a specific subcategory; (3) does not use a generic "other" category when a specific one exists; (4) if unsure, asks clarifying questions to determine the correct category. This is critical for reporting, trend analysis, and assigning the ticket to the correct resolution group.',
    },
    {
      id: 'itil_inc_prioritization',
      label: 'Priority set appropriately — Did the candidate assign priority based on both impact (business effect) and urgency (time sensitivity)?',
      weight: 8,
      critical: false,
      category: 'triage',
      checkType: 'ai_criteria',
      checkTarget: 'itil_inc_prioritization',
      passIf: 'pass_or_partial',
      evidenceDescription: 'ITIL 4 Incident Management — Prioritization: priority must be determined by combining impact (how severe the business effect is) and urgency (how quickly the issue needs to be resolved). Assessment criteria: (1) asks about business impact to determine impact level; (2) asks about deadlines or time sensitivity to determine urgency; (3) assigns priority that reflects both dimensions — a critical system failure affecting one user (high impact, medium urgency) differs from a minor issue affecting an entire department (medium impact, high urgency); (4) adjusts priority if more information comes to light during the call. A good example: For a senior user who cannot access email and has a client deadline in one hour — priority set to High/High. For a cosmetic issue reported by one user with no deadline — priority set to Low/Low.',
    },
    {
      id: 'itil_inc_initial_diagnosis',
      label: 'Attempted initial diagnosis — Did the candidate attempt first-line diagnosis using available tools and knowledge before considering escalation?',
      weight: 8,
      critical: false,
      category: 'diagnosis',
      checkType: 'ai_criteria',
      checkTarget: 'technical_discovery',
      passIf: 'pass_or_partial',
      evidenceDescription: 'ITIL 4 Incident Management — Initial Diagnosis: "To resolve an incident within the agreed time frame. The aim is the fast recovery of the service, possibly by applying a workaround. As soon as it becomes clear that 1st level support is not able to resolve the incident itself or when target times for 1st level resolution are exceeded, the incident is transferred to 2nd level support" (YaSM LP4.6.6). The candidate must attempt initial diagnosis using available tools, knowledge base, and diagnostic procedures before escalating. Assessment criteria: (1) checks known error database or knowledge base for similar issues; (2) uses available diagnostic tools (remote access, status checks, logs); (3) attempts at least basic troubleshooting before deciding to escalate; (4) balances speed of resolution with depth of investigation — spends appropriate time on diagnosis without excessive delay. A good example: "Let me remote into your machine and check a few things before I decide whether this needs to go to our senior team." A poor example: Escalating immediately without any diagnostic attempt, or spending 30 minutes on basic checks that a knowledge article could have resolved in 2 minutes.',
    },
    {
      id: 'itil_inc_escalation',
      label: 'Escalated appropriately — Did the candidate escalate at the right time, to the right team, with sufficient context?',
      weight: 8,
      critical: false,
      category: 'escalation',
      checkType: 'ai_criteria',
      checkTarget: 'escalation_judgement',
      passIf: 'pass_or_partial',
      evidenceDescription: 'ITIL 4 Incident Management — Escalation: "If required, specialist support groups or third-party suppliers (3rd level support) may be involved" (YaSM LP4.6.7). When the issue is beyond first-level capability, the candidate must escalate appropriately. Assessment criteria: (1) attempts reasonable first-line diagnosis before escalating (see initial diagnosis); (2) provides complete context with the escalation — what was checked, what the symptoms are, what troubleshooting has been done, relevant history; (3) escalates to the correct team or specialist group; (4) does not escalate unnecessarily — issues that could be resolved at first level should be resolved at first level; (5) if SLAs are at risk, uses hierarchical escalation (informs management) as well as functional escalation (passes to specialist). A good example: "I\'ve checked account status, network connectivity, and tried a basic repair — none have resolved the issue. The error log points to a server-side authentication problem. I\'m escalating to the identity team with full details of what I\'ve checked." A poor example: Escalating with "I don\'t know what\'s wrong, can someone look at this?" without any diagnostic context.',
    },
    {
      id: 'itil_inc_resolution_verify',
      label: 'Verified resolution with user — Did the candidate confirm with the user that the issue is resolved before closing the ticket?',
      weight: 8,
      critical: false,
      category: 'resolution',
      checkType: 'ai_criteria',
      checkTarget: 'itil_inc_resolution_verify',
      passIf: 'pass_or_partial',
      evidenceDescription: 'ITIL 4 Incident Management — Resolution and Recovery: the fix must be verified with the user before incident closure. Assessment criteria: (1) asks the user to confirm the issue is resolved — "Can you try it now and let me know if it\'s working?"; (2) does not assume the fix worked without confirmation; (3) if the fix cannot be immediately verified (e.g., email reset that takes time), sets clear expectations for when and how to confirm; (4) if the fix did not work, returns to diagnosis rather than closing the ticket. A good example: "The reset email has been sent. Please check your inbox — it should arrive within two minutes. Once you\'ve reset and can log in, can you please confirm back to me?" A poor example: "Okay, I\'ve reset your password. Let me know if you have issues" and closing the ticket without confirmation.',
    },
    {
      id: 'itil_inc_closure',
      label: 'Ticket completed properly — Did the candidate document the resolution, closure category, and next steps before closing the ticket?',
      weight: 8,
      critical: false,
      category: 'documentation',
      checkType: 'ticket_field',
      checkTarget: 'resolution',
      passIf: 'pass_or_partial',
      evidenceDescription: 'ITIL 4 Incident Management — Closure: "To submit the incident and service request records to a final quality control before formal closure. The aim is to make sure that the incident\'s or service request\'s resolution history is described in sufficient detail. In addition, findings from the resolution of the incidents are to be recorded for future use" (YaSM LP4.6.9). The ticket must be completed with sufficient detail before closure. Assessment criteria: (1) documents the symptoms, diagnosis, and resolution in the ticket; (2) assigns the correct closure category (resolved, workaround provided, escalated); (3) records any knowledge gained for future use (known error, workaround description); (4) the ticket is self-contained — someone reading it later should understand what happened without needing additional context. A good example: A ticket that captures: user identity, issue description, diagnostic steps taken, root cause identified, resolution applied, verification confirmed, closure category, and any follow-up actions. A poor example: A ticket that says "Fixed it" or "Password reset done" with no supporting detail.',
    },
  ],
};
