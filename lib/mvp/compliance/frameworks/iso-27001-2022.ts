import { FrameworkDefinition } from '../evaluator';

export const ISO_27001_2022: FrameworkDefinition = {
  id: 'iso_27001_2022',
  name: 'ISO 27001:2022',
  version: '2022',
  type: 'compliance_standard',
  category: 'security',
  passThreshold: 75,
  weight: 0.3,
  description: 'ISO 27001:2022 Annex A controls. Key criteria: A.5.15 Access Control, A.5.24 Incident Management, A.5.33 Records Protection, A.8.8 Patch Management.',
  standardsAlignments: ['ISO 27001 A.5.15', 'ISO 27001 A.5.24', 'ISO 27001 A.8.8'],
  criteria: [
    {
      id: 'iso_access_control', label: 'A.5.15 — Access control', weight: 10, critical: true, category: 'access_control',
      checkType: 'ai_criteria', checkTarget: 'identity_check', passIf: 'pass',
      evidenceDescription: 'Access control verified — candidate confirmed identity before proceeding',
    },
    {
      id: 'iso_incident_management', label: 'A.5.24 — Incident management', weight: 10, critical: true, category: 'incident_management',
      checkType: 'event_check', checkTarget: 'ticket_submitted', passIf: 'pass',
      evidenceDescription: 'Incident recorded and tracked via ticket — maps to ticket_submitted event',
    },
    {
      id: 'iso_records_protection', label: 'A.5.33 — Records protection', weight: 5, critical: false, category: 'documentation',
      checkType: 'ticket_field', checkTarget: 'ticket', passIf: 'pass_or_partial',
      evidenceDescription: 'Ticket contains documented evidence of work performed',
    },
    {
      id: 'iso_patch_management', label: 'A.8.8 — Patch management', weight: 10, critical: false, category: 'operations',
      checkType: 'ai_criteria', checkTarget: 'recent_changes', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate asked about recent changes — maps to recent_changes criterion',
    },
    {
      id: 'iso_escalation', label: 'Escalation procedures followed', weight: 5, critical: false, category: 'incident_management',
      checkType: 'ai_criteria', checkTarget: 'escalation_judgement', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate escalated appropriately — maps to escalation_judgement criterion',
    },
    {
      id: 'iso_classification', label: 'Incident classified correctly', weight: 5, critical: false, category: 'incident_management',
      checkType: 'event_check', checkTarget: 'ticket_triage_submitted', passIf: 'pass',
      evidenceDescription: 'Candidate classified the ticket — maps to triage event',
    },
    {
      id: 'iso_continuous_improvement', label: 'Documentation supports improvement', weight: 5, critical: false, category: 'quality',
      checkType: 'ticket_field', checkTarget: 'resolution', passIf: 'pass_or_partial',
      evidenceDescription: 'Ticket documents resolution steps for future reference',
    },
    {
      id: 'iso_security_awareness', label: 'Security awareness demonstrated', weight: 5, critical: false, category: 'security',
      checkType: 'transcript_keyword', checkTarget: 'security|secure|safe|safety|compromise|incident',
      passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate mentioned or demonstrated security awareness in their actions or communication',
    },
  ],
};
