import { FrameworkDefinition } from '../evaluator';

export const SBAR_COMMUNICATION: FrameworkDefinition = {
  id: 'sbar_communication',
  name: 'SBAR Structured Communication',
  version: '1.0',
  type: 'skills_framework',
  category: 'customer_experience',
  passThreshold: 70,
  weight: 1.0,
  description: 'SBAR (Situation-Background-Assessment-Recommendation) structured communication protocol. Assesses clarity and completeness of escalations, handoffs, and complex explanations.',
  standardsAlignments: ['SBAR (Kaiser Permanente)', 'NHS SBAR Tool'],
  criteria: [
    {
      id: 'sbar_situation', label: 'Stated situation concisely', weight: 10, critical: false, category: 'communication',
      checkType: 'ai_criteria', checkTarget: 'sbar_situation', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate stated the current issue clearly and concisely',
    },
    {
      id: 'sbar_background', label: 'Provided relevant background', weight: 10, critical: false, category: 'communication',
      checkType: 'ai_criteria', checkTarget: 'sbar_background', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate provided relevant context, history, and what led to the current situation',
    },
    {
      id: 'sbar_assessment', label: 'Gave professional assessment', weight: 10, critical: false, category: 'communication',
      checkType: 'ai_criteria', checkTarget: 'sbar_assessment', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate communicated their professional judgment of what the problem is based on evidence',
    },
    {
      id: 'sbar_recommendation', label: 'Made clear recommendation', weight: 10, critical: false, category: 'communication',
      checkType: 'ai_criteria', checkTarget: 'next_steps', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate stated what should happen next, action required, urgency',
    },
  ],
};
