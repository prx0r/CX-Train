import { FrameworkDefinition } from '../evaluator';

export const GDPR_2018: FrameworkDefinition = {
  id: 'gdpr_2018',
  name: 'GDPR / UK DPA 2018',
  version: '2018',
  type: 'compliance_standard',
  category: 'data_protection',
  passThreshold: 80,
  weight: 0.2,
  description: 'UK General Data Protection Regulation and Data Protection Act 2018. Principles: data minimisation, access control, confidentiality, breach notification.',
  standardsAlignments: ['GDPR Art. 5(1)(f) Integrity & Confidentiality', 'GDPR Art. 33 Breach Notification', 'ISO 27001 A.5.15'],
  criteria: [
    {
      id: 'gdpr_identity_verified', label: 'Identity verified before data access', weight: 10, critical: true, category: 'access_control',
      checkType: 'ai_criteria', checkTarget: 'identity_check', passIf: 'pass',
      evidenceDescription: 'Candidate confirmed caller identity before proceeding — maps to identity_check',
    },
    {
      id: 'gdpr_data_minimization', label: 'Only necessary data collected', weight: 10, critical: true, category: 'data_protection',
      checkType: 'transcript_keyword', checkTarget: 'ask for password|ask for personal|social security|date of birth|bank details',
      passIf: 'pass',  // reversed: if these keywords appear, it's FAIL
      evidenceDescription: 'Candidate did NOT ask for unnecessary personal data (passif: no asking for passwords/SSN)',
    },
    {
      id: 'gdpr_no_data_sharing', label: 'No unauthorised data sharing', weight: 10, critical: true, category: 'data_protection',
      checkType: 'transcript_keyword', checkTarget: 'share password|share credit|disclose to|give out',
      passIf: 'pass',
      evidenceDescription: 'Candidate did not attempt to share or expose personal data',
    },
    {
      id: 'gdpr_ticket_contains_pii', label: 'PII handled appropriately in ticket', weight: 5, critical: false, category: 'data_protection',
      checkType: 'transcript_keyword', checkTarget: 'full name|email address|phone number|home address',
      passIf: 'pass_or_partial',
      evidenceDescription: 'If PII appears in transcript, ticket should not expose unnecessary PII',
    },
    {
      id: 'gdpr_breach_awareness', label: 'Breach notification awareness', weight: 5, critical: false, category: 'data_protection',
      checkType: 'transcript_keyword', checkTarget: 'escalate|report|security|breach|compromise',
      passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate showed awareness of escalation/reporting procedures',
    },
    {
      id: 'gdpr_documentation', label: 'Data protection considerations documented', weight: 5, critical: false, category: 'documentation',
      checkType: 'ticket_field', checkTarget: 'data', passIf: 'pass_or_partial',
      evidenceDescription: 'Ticket references data protection or access considerations',
    },
  ],
};
