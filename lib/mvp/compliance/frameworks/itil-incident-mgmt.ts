import { FrameworkDefinition } from '../evaluator';

export const ITIL_INCIDENT_MGMT: FrameworkDefinition = {
  id: 'itil_incident_mgmt',
  name: 'ITIL Incident Management',
  version: '1.0',
  type: 'skills_framework',
  category: 'technical_troubleshooting',
  passThreshold: 70,
  weight: 1.0,
  description: 'ITIL 4 Incident Management practice. Assesses process adherence: categorization, prioritization, initial diagnosis, escalation, resolution verification, and closure.',
  standardsAlignments: ['ITIL 4 Incident Management Practice', 'ITIL 4 Problem Management Practice'],
  criteria: [
    {
      id: 'itil_inc_categorization', label: 'Incident categorised correctly', weight: 8, critical: false, category: 'triage',
      checkType: 'triage_check', checkTarget: 'category', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate assigned the correct category and subcategory to the incident',
    },
    {
      id: 'itil_inc_prioritization', label: 'Priority set appropriately', weight: 8, critical: false, category: 'triage',
      checkType: 'ai_criteria', checkTarget: 'itil_inc_prioritization', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate set priority based on impact (business effect) and urgency (time sensitivity)',
    },
    {
      id: 'itil_inc_initial_diagnosis', label: 'Attempted initial diagnosis', weight: 8, critical: false, category: 'diagnosis',
      checkType: 'ai_criteria', checkTarget: 'technical_discovery', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate attempted first-line diagnosis before escalating',
    },
    {
      id: 'itil_inc_escalation', label: 'Escalated appropriately', weight: 8, critical: false, category: 'escalation',
      checkType: 'ai_criteria', checkTarget: 'escalation_judgement', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate escalated at the right time with appropriate context to the right team',
    },
    {
      id: 'itil_inc_resolution_verify', label: 'Verified resolution with user', weight: 8, critical: false, category: 'resolution',
      checkType: 'ai_criteria', checkTarget: 'itil_inc_resolution_verify', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate confirmed with the user that the issue is resolved before closing',
    },
    {
      id: 'itil_inc_closure', label: 'Ticket completed properly', weight: 8, critical: false, category: 'documentation',
      checkType: 'ticket_field', checkTarget: 'resolution', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate documented resolution, closure code, and next steps in the ticket',
    },
  ],
};
