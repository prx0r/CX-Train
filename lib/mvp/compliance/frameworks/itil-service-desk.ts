import { FrameworkDefinition } from '../evaluator';

export const ITIL_SERVICE_DESK: FrameworkDefinition = {
  id: 'itil_service_desk',
  name: 'ITIL Service Desk Practice',
  version: '1.0',
  type: 'skills_framework',
  category: 'process_professionalism',
  passThreshold: 70,
  weight: 1.0,
  description: 'ITIL 4 Service Desk practice. Assesses call lifecycle management: single point of contact, ownership, structured opening, needs assessment, and proper closing.',
  standardsAlignments: ['ITIL 4 Service Desk Practice', 'HDI Support Center Standard'],
  criteria: [
    {
      id: 'sd_proper_opening', label: 'Proper opening and greeting', weight: 8, critical: false, category: 'call_handling',
      checkType: 'ai_criteria', checkTarget: 'sd_proper_opening', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate used a professional greeting, identified themselves and the company',
    },
    {
      id: 'sd_needs_assessment', label: 'Conducted needs assessment', weight: 8, critical: false, category: 'call_handling',
      checkType: 'ai_criteria', checkTarget: 'issue_clarification', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate asked probing questions to understand the full scope of the issue',
    },
    {
      id: 'sd_ownership', label: 'Demonstrated ownership', weight: 8, critical: false, category: 'call_handling',
      checkType: 'ai_criteria', checkTarget: 'sd_ownership', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate took ownership of the issue without unnecessary transfers or deflection',
    },
    {
      id: 'sd_proper_closing', label: 'Proper closing and confirmation', weight: 8, critical: false, category: 'call_handling',
      checkType: 'ai_criteria', checkTarget: 'sd_proper_closing', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate summarized the resolution, confirmed user satisfaction, and set expectations for follow-up',
    },
    {
      id: 'sd_documentation', label: 'Issue documented completely', weight: 8, critical: false, category: 'documentation',
      checkType: 'ticket_field', checkTarget: 'ticket', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate documented the call findings, actions taken, and next steps in the ticket',
    },
  ],
};
