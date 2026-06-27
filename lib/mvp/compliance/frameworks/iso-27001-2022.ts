import { FrameworkDefinition } from '../evaluator';

/**
 * ISO/IEC 27001:2022 — Annex A Controls
 *
 * Source: ISO (iso.org) — full standard paywalled at 155 CHF
 * Free summaries available at: isms.online, itgovernance.co.uk
 *
 * We select controls relevant to service desk call handling from the
 * 93 Annex A controls. Each criterion maps to a specific control ID.
 * This is an assessment MAPPING — not a formal ISO 27001 audit.
 */
export const ISO_27001_2022: FrameworkDefinition = {
  id: 'iso_27001_2022',
  name: 'ISO 27001:2022',
  version: '2022',
  type: 'compliance_standard',
  category: 'security',
  passThreshold: 70,
  weight: 0.3,
  description: 'ISO 27001:2022 Annex A controls adapted for individual call assessment. Selected controls relevant to service desk operations: A.5.15 Access Control, A.5.24 Incident Management, A.5.33 Records Protection, A.8.8 Patch Management, A.5.16 Identity Management, A.5.17 Authentication, A.5.18 Access Rights, A.6.3 Security Awareness.',
  standardsAlignments: ['ISO 27001 A.5.15', 'ISO 27001 A.5.24', 'ISO 27001 A.5.33', 'ISO 27001 A.8.8'],
  criteria: [
    {
      id: 'iso_access_control',
      label: 'A.5.15 — Access Control. Did the candidate verify identity and authorization before granting access to information or systems?',
      weight: 10,
      critical: true,
      category: 'access_control',
      checkType: 'ai_criteria',
      checkTarget: 'identity_check',
      passIf: 'pass',
      evidenceDescription: 'ISO 27001 Annex A.5.15 Access Control: access to information and assets must be controlled based on business and security requirements. For service desk calls: the candidate must verify the caller\'s identity and their authorization to access the requested information or perform the requested action. Assessment criteria: (1) confirms identity before any access is granted; (2) verifies that the caller is authorized to make the request (e.g., a manager requesting access to a subordinate\'s mailbox needs separate authorization); (3) follows the principle of least privilege — does not grant more access than needed; (4) documents the access granted. A good example: "I can see you\'re listed as a delegate on this mailbox. Let me confirm with the mailbox owner before making changes." A poor example: Granting mailbox access to someone who calls in without verifying they are the owner or an authorized delegate.',
    },
    {
      id: 'iso_incident_management',
      label: 'A.5.24 — Incident Management. Did the candidate recognize, classify, and escalate security incidents appropriately rather than treating them as routine issues?',
      weight: 10,
      critical: true,
      category: 'incident_management',
      checkType: 'event_check',
      checkTarget: 'ticket_submitted',
      passIf: 'pass',
      evidenceDescription: 'ISO 27001 Annex A.5.24 Information Security Incident Management: the organization must plan, prepare, and manage information security incidents. For service desk calls: the candidate must be able to recognize a potential security incident, classify its severity, report it through the correct channel, and not treat it as a routine support ticket. Assessment criteria: (1) recognizes potential security incidents (breaches, unauthorized access, malware infections, phishing); (2) classifies the severity appropriately; (3) follows incident reporting procedures — does not handle it as a standard ticket; (4) preserves evidence where necessary (logs, screenshots, timestamps); (5) does not discuss incident details on unsecured channels. A good example: "This sounds like it could be a security incident. I\'m going to log this as a high-priority security ticket and transfer you to our incident response team." A poor example: Treating a reported account compromise as a routine password reset without any security flagging or escalation.',
    },
    {
      id: 'iso_records_protection',
      label: 'A.5.33 — Protection of Records. Did the candidate ensure that call records, ticket data, and personal information were handled securely and not exposed to unauthorized parties?',
      weight: 5,
      critical: false,
      category: 'documentation',
      checkType: 'ticket_field',
      checkTarget: 'ticket',
      passIf: 'pass_or_partial',
      evidenceDescription: 'ISO 27001 Annex A.5.33 Protection of Records: records must be protected against loss, destruction, falsification, unauthorized access, and unauthorized release. For service desk calls: the candidate must handle call recordings, ticket data, and customer records securely. Assessment criteria: (1) does not expose sensitive ticket information to unauthorized parties; (2) ticket notes do not contain unsecured sensitive data; (3) handles physical records (if any) with appropriate care; (4) follows data classification procedures. A good example: Ticket is created with appropriate confidentiality markings and contains only necessary information. A poor example: Leaving a ticket with password reset details open on screen where others can see, or including unnecessary personal data in ticket notes.',
    },
    {
      id: 'iso_patch_management',
      label: 'A.8.8 — Technical Vulnerability Management. Did the candidate consider whether unpatched vulnerabilities could be the cause, and recommend patching as part of the solution?',
      weight: 10,
      critical: false,
      category: 'operations',
      checkType: 'ai_criteria',
      checkTarget: 'recent_changes',
      passIf: 'pass_or_partial',
      evidenceDescription: 'ISO 27001 Annex A.8.8 Management of Technical Vulnerabilities: vulnerabilities must be identified and remediated in a timely manner. For service desk calls: the candidate should consider whether a known vulnerability or missing patch could be the cause of the issue, and recommend appropriate patching as part of the solution. Assessment criteria: (1) asks about recent updates or changes when relevant; (2) checks whether the system is known to be affected by a recent vulnerability; (3) recommends patching or updating as part of the resolution where appropriate; (4) does not recommend disabling security updates as a workaround. A good example: "There was a security update for Outlook released last week. Let me check if that\'s been applied, as it could be related to the issue you\'re seeing." A poor example: Recommending that the user disable automatic updates or leave the system unpatched.',
    },
    {
      id: 'iso_escalation',
      label: 'A.5.24 — Escalation procedures followed. Did the candidate escalate the issue at the right time, to the right team, with the right context?',
      weight: 5,
      critical: false,
      category: 'incident_management',
      checkType: 'ai_criteria',
      checkTarget: 'escalation_judgement',
      passIf: 'pass_or_partial',
      evidenceDescription: 'ISO 27001 Annex A.5.24 — supporting practice: escalation of incidents must follow defined procedures. For service desk: the candidate should know when an issue is beyond their capability and escalate it appropriately. Assessment criteria: (1) attempts reasonable first-line diagnosis before escalating — does not escalate everything; (2) does not delay escalation when the issue clearly needs higher-tier support; (3) provides sufficient context with the escalation — what was tried, what the symptoms are, what information has been gathered; (4) escalates to the correct team or tier, not randomly. A good example: "I\'ve checked the basics — account status, network connectivity, and password status. The issue appears to be on the server side. I\'m going to escalate this to our infrastructure team with full details of what I\'ve checked." A poor example: "I don\'t know what\'s wrong, I\'ll just pass it to someone else" without providing any diagnostic context.',
    },
    {
      id: 'iso_classification',
      label: 'A.5.24 — Incident classification. Did the candidate correctly classify the type and severity of the issue in the ticket?',
      weight: 5,
      critical: false,
      category: 'incident_management',
      checkType: 'event_check',
      checkTarget: 'ticket_triage_submitted',
      passIf: 'pass',
      evidenceDescription: 'ISO 27001 Annex A.5.24 — supporting practice: incidents must be classified and prioritized correctly. For service desk calls: the candidate must assign the correct category, impact level, and urgency to the ticket. Assessment criteria: (1) selects the correct category and subcategory for the issue; (2) assigns impact based on business effect — how many users affected, how critical the affected service is; (3) assigns urgency based on time sensitivity — is there a deadline, is the user blocked; (4) adjusts priority if more information becomes available during the call. A good example: Setting a ticket to "Impact: High, Urgency: High" when a senior user cannot access email with a client deadline, versus "Impact: Low, Urgency: Low" for a cosmetic issue. A poor example: Defaulting everything to "Medium" priority without considering actual business impact.',
    },
    {
      id: 'iso_continuous_improvement',
      label: 'A.6.3 — Security Awareness, Education and Training. Did the candidate demonstrate appropriate security awareness knowledge during the call?',
      weight: 5,
      critical: false,
      category: 'quality',
      checkType: 'ticket_field',
      checkTarget: 'resolution',
      passIf: 'pass_or_partial',
      evidenceDescription: 'ISO 27001 Annex A.6.3 Information Security Awareness, Education and Training: personnel must demonstrate awareness of their information security responsibilities. For service desk calls: the candidate should show understanding of basic security practices relevant to their role. Assessment criteria: (1) demonstrates knowledge of security procedures relevant to the call; (2) if asked a security-related question, responds appropriately; (3) follows security protocols without needing reminders; (4) can explain why a security step is necessary when questioned. A good example: When the customer asks "Why do you need to verify my identity? You can see who\'s calling." The candidate explains: "It\'s a security requirement to make sure we\'re only discussing account details with authorized people." A poor example: The candidate cannot explain or justify security steps they are following, or skips steps when the customer pushes back.',
    },
    {
      id: 'iso_security_awareness',
      label: 'A.5.17 — Authentication information handling. Did the candidate handle authentication information (passwords, MFA codes, security questions) securely?',
      weight: 5,
      critical: false,
      category: 'security',
      checkType: 'ai_criteria',
      checkTarget: 'iso_security_awareness',
      passIf: 'pass_or_partial',
      evidenceDescription: 'ISO 27001 Annex A.5.17 Authentication Information: authentication information must be handled securely, including password policies, MFA requirements, and secure handling of credentials. For service desk calls: the candidate must never ask for or accept passwords, must use secure methods for password resets, and must recognize social engineering attempts. Assessment criteria: (1) never asks the caller for their password or MFA code; (2) uses secure password reset procedures (sends reset link via email, does not read out temp passwords); (3) recognizes and resists social engineering attempts; (4) reports suspicious authentication-related calls. A good example: "I\'ll send a password reset link to the email address we have on file. You\'ll be prompted to create a new password." A poor example: "What\'s your current password so I can check it?" or "Let me read out your temporary password."',
    },
  ],
};
