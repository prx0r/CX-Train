import { FrameworkDefinition } from '../evaluator';

export const LEAP_HEAT_RUBRIC: FrameworkDefinition = {
  id: 'leap_heat_rubric',
  name: 'LEAP/HEAT Customer Interaction',
  version: '1.0',
  type: 'skills_framework',
  category: 'customer_experience',
  passThreshold: 70,
  weight: 1.0,
  description: 'LEAP (Listen-Empathize-Apologize-Problem-solve) and HEAT (Hear-Empathize-Apologize-Take action) soft skills framework. Assesses de-escalation and rapport-building on calls.',
  standardsAlignments: ['LEAP Customer Service Model', 'HEAT Framework (Hear-Empathize-Apologize-Take action)'],
  criteria: [
    {
      id: 'leap_listen', label: 'Listened actively without interrupting', weight: 10, critical: false, category: 'active_listening',
      checkType: 'ai_criteria', checkTarget: 'leap_listen', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate listened to the customer without interrupting, let them fully explain the issue',
    },
    {
      id: 'leap_empathize', label: 'Showed genuine empathy', weight: 10, critical: false, category: 'empathy',
      checkType: 'ai_criteria', checkTarget: 'servqual_empathy_acknowledge', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate acknowledged the customer\'s feelings and validated their frustration',
    },
    {
      id: 'leap_apologize', label: 'Apologized appropriately', weight: 10, critical: false, category: 'empathy',
      checkType: 'ai_criteria', checkTarget: 'leap_apologize', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate offered a sincere apology for the inconvenience without over-apologizing or admitting fault improperly',
    },
    {
      id: 'leap_take_action', label: 'Took ownership and action', weight: 10, critical: false, category: 'resolution',
      checkType: 'ai_criteria', checkTarget: 'next_steps', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate took ownership of the issue and committed to specific next steps',
    },
  ],
};
