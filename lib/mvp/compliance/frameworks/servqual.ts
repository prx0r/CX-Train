import { FrameworkDefinition } from '../evaluator';

export const SERVQUAL: FrameworkDefinition = {
  id: 'servqual',
  name: 'SERVQUAL Service Quality',
  version: '1.0',
  type: 'skills_framework',
  category: 'customer_experience',
  passThreshold: 70,
  weight: 1.0,
  description: 'SERVQUAL service quality model across 5 dimensions: Reliability, Assurance, Tangibles, Empathy, Responsiveness. Adapted for IT support call assessment.',
  standardsAlignments: ['SERVQUAL (Parasuraman, Zeithaml, Berry 1988)'],
  criteria: [
    {
      id: 'servqual_reliability_followthrough', label: 'Followed through on commitments', weight: 8, critical: false, category: 'reliability',
      checkType: 'ai_criteria', checkTarget: 'servqual_reliability_followthrough', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate followed through on promises (callbacks, escalations, actions)',
    },
    {
      id: 'servqual_reliability_accuracy', label: 'Provided accurate information', weight: 8, critical: false, category: 'reliability',
      checkType: 'ai_criteria', checkTarget: 'servqual_reliability_accuracy', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate gave correct technical information without errors',
    },
    {
      id: 'servqual_assurance_confidence', label: 'Inspired trust and confidence', weight: 8, critical: false, category: 'assurance',
      checkType: 'ai_criteria', checkTarget: 'servqual_assurance_confidence', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate communicated with authority and inspired confidence in their ability to resolve',
    },
    {
      id: 'servqual_assurance_competence', label: 'Demonstrated technical competence', weight: 8, critical: false, category: 'assurance',
      checkType: 'ai_criteria', checkTarget: 'technical_discovery', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate showed technical knowledge appropriate to the issue',
    },
    {
      id: 'servqual_empathy_acknowledge', label: 'Acknowledged customer frustration', weight: 8, critical: false, category: 'empathy',
      checkType: 'ai_criteria', checkTarget: 'servqual_empathy_acknowledge', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate acknowledged the customer\'s frustration, urgency, or inconvenience',
    },
    {
      id: 'servqual_empathy_individualized', label: 'Gave individualized attention', weight: 8, critical: false, category: 'empathy',
      checkType: 'ai_criteria', checkTarget: 'servqual_empathy_individualized', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate treated the customer as an individual, used their name, understood their specific situation',
    },
    {
      id: 'servqual_empathy_tone', label: 'Used professional, warm tone', weight: 8, critical: false, category: 'empathy',
      checkType: 'ai_criteria', checkTarget: 'customer_tone', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate maintained a professional and warm tone throughout the call',
    },
    {
      id: 'servqual_responsiveness_prompt', label: 'Responded promptly', weight: 8, critical: false, category: 'responsiveness',
      checkType: 'ai_criteria', checkTarget: 'servqual_responsiveness_prompt', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate responded without unnecessary delays, kept the call moving',
    },
    {
      id: 'servqual_responsiveness_updates', label: 'Kept customer updated', weight: 8, critical: false, category: 'responsiveness',
      checkType: 'ai_criteria', checkTarget: 'servqual_responsiveness_updates', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate provided status updates during holds, investigations, or escalations',
    },
    {
      id: 'servqual_responsiveness_willingness', label: 'Showed willingness to help', weight: 8, critical: false, category: 'responsiveness',
      checkType: 'ai_criteria', checkTarget: 'professional_conduct', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate showed genuine willingness to help without deflection or reluctance',
    },
  ],
};
