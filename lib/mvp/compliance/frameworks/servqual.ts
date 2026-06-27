import { FrameworkDefinition } from '../evaluator';

/**
 * SERVQUAL (RATER model) — Parasuraman, Zeithaml & Berry 1988
 *
 * Adapted for IT support call assessment. Original 5 dimensions with items
 * that are observable in a single support call interaction.
 *
 * Dimensions measured:
 *   Reliability  (4 items) — dependability and accuracy
 *   Assurance    (3 items) — trust, confidence, competence
 *   Empathy      (3 items) — individualized attention, understanding
 *   Responsiveness (3 items) — promptness, willingness
 *
 * Tangibles dimension excluded — cannot assess physical equipment/facilities
 * from a phone call. IT-specific adaptations noted in evidence descriptions.
 */
export const SERVQUAL: FrameworkDefinition = {
  id: 'servqual',
  name: 'SERVQUAL Service Quality',
  version: '2.0',
  type: 'skills_framework',
  category: 'customer_experience',
  passThreshold: 70,
  weight: 1.0,
  description: 'SERVQUAL (RATER) service quality model: Reliability, Assurance, Empathy, Responsiveness. 13 items adapted for IT support call assessment. Tangibles dimension excluded (not observable via phone).',
  standardsAlignments: ['SERVQUAL — Parasuraman, Zeithaml, Berry 1988'],
  criteria: [
    // ── Reliability: Ability to perform promised service dependably and accurately ──
    {
      id: 'servqual_rl_promise', label: 'Followed through on commitments made during the call', weight: 8, critical: false, category: 'reliability',
      checkType: 'ai_criteria', checkTarget: 'servqual_rl_promise', passIf: 'pass_or_partial',
      evidenceDescription: 'Original: "When they promise to do something by a certain time, they do it." Adapted: Candidate made and kept commitments (callbacks, escalations, email sends, ticket updates). Look for specific promises followed by confirmation of action.',
    },
    {
      id: 'servqual_rl_interest', label: 'Showed sincere interest in solving the problem', weight: 8, critical: false, category: 'reliability',
      checkType: 'ai_criteria', checkTarget: 'servqual_rl_interest', passIf: 'pass_or_partial',
      evidenceDescription: 'Original: "When customer has a problem, they should show sincere interest in solving it." Adapted: Candidate engaged with the issue actively, asked follow-up questions, didn\'t treat it as a nuisance.',
    },
    {
      id: 'servqual_rl_firsttime', label: 'Attempted correct resolution on first attempt', weight: 8, critical: false, category: 'reliability',
      checkType: 'ai_criteria', checkTarget: 'kt_test_causes', passIf: 'pass_or_partial',
      evidenceDescription: 'Original: "Perform the service right the first time." Adapted: Candidate worked toward a correct fix rather than guessing. If escalation was needed, they provided sufficient context for first-time resolution by the next tier.',
    },
    {
      id: 'servqual_rl_records', label: 'Documented the interaction accurately in the ticket', weight: 8, critical: false, category: 'reliability',
      checkType: 'ticket_field', checkTarget: 'ticket', passIf: 'pass_or_partial',
      evidenceDescription: 'Original: "Keep records accurately." Adapted: Ticket note captures the issue, diagnosis, actions taken, and outcome. Not empty or copied from generic template.',
    },

    // ── Assurance: Knowledge and courtesy, ability to inspire trust ──
    {
      id: 'servqual_as_confidence', label: 'Inspired confidence through professional behaviour', weight: 8, critical: false, category: 'assurance',
      checkType: 'ai_criteria', checkTarget: 'servqual_as_confidence', passIf: 'pass_or_partial',
      evidenceDescription: 'Original: "The behaviour of employees instils confidence in customers." Adapted: Candidate communicated with authority, didn\'t sound unsure or hesitant, took ownership with confidence.',
    },
    {
      id: 'servqual_as_polite', label: 'Was polite and courteous throughout', weight: 8, critical: false, category: 'assurance',
      checkType: 'ai_criteria', checkTarget: 'customer_tone', passIf: 'pass_or_partial',
      evidenceDescription: 'Original: "Employees are polite to customers." Adapted: Candidate used courteous language, "please/thank you", did not interrupt, maintained professional decorum.',
    },
    {
      id: 'servqual_as_knowledge', label: 'Demonstrated knowledge to answer the customer\'s questions', weight: 8, critical: false, category: 'assurance',
      checkType: 'ai_criteria', checkTarget: 'technical_discovery', passIf: 'pass_or_partial',
      evidenceDescription: 'Original: "Employees have knowledge to answer customers\' questions." Adapted: Candidate showed technical understanding appropriate to the issue, could explain what was happening and why.',
    },

    // ── Empathy: Caring, individualized attention ──
    {
      id: 'servqual_em_individual', label: 'Gave the customer individual attention', weight: 8, critical: false, category: 'empathy',
      checkType: 'ai_criteria', checkTarget: 'servqual_em_individual', passIf: 'pass_or_partial',
      evidenceDescription: 'Original: "Give customers individual attention." Adapted: Candidate treated the customer as an individual, used their name, referenced their specific situation, did not sound scripted.',
    },
    {
      id: 'servqual_em_interest', label: 'Acted in the customer\'s best interest', weight: 8, critical: false, category: 'empathy',
      checkType: 'ai_criteria', checkTarget: 'servqual_em_interest', passIf: 'pass_or_partial',
      evidenceDescription: 'Original: "Have customers\' best interest at heart." Adapted: Candidate gave advice that genuinely helped the customer, didn\'t upsell unnecessary services, recommended the right path not the easy path.',
    },
    {
      id: 'servqual_em_needs', label: 'Understood the customer\'s specific needs', weight: 8, critical: false, category: 'empathy',
      checkType: 'ai_criteria', checkTarget: 'issue_clarification', passIf: 'pass_or_partial',
      evidenceDescription: 'Original: "Understand the specific needs of their customers." Adapted: Candidate asked clarifying questions to understand the exact situation, didn\'t make assumptions about the problem.',
    },

    // ── Responsiveness: Willingness to help and provide prompt service ──
    {
      id: 'servqual_rn_prompt', label: 'Responded promptly to the customer', weight: 8, critical: false, category: 'responsiveness',
      checkType: 'ai_criteria', checkTarget: 'servqual_rn_prompt', passIf: 'pass_or_partial',
      evidenceDescription: 'Original: "Employees give prompt service to customers." Adapted: Candidate acknowledged the customer quickly, didn\'t keep them waiting unnecessarily, maintained good call pace.',
    },
    {
      id: 'servqual_rn_willing', label: 'Showed willingness to help', weight: 8, critical: false, category: 'responsiveness',
      checkType: 'ai_criteria', checkTarget: 'servqual_rn_willing', passIf: 'pass_or_partial',
      evidenceDescription: 'Original: "Employees are always willing to help customers." Adapted: Candidate took the issue on willingly, didn\'t deflect or avoid responsibility, offered assistance proactively.',
    },
    {
      id: 'servqual_rn_notbusy', label: 'Did not rush or dismiss the customer', weight: 8, critical: false, category: 'responsiveness',
      checkType: 'ai_criteria', checkTarget: 'customer_tone', passIf: 'pass_or_partial',
      evidenceDescription: 'Original: "Employees are never too busy to respond to customer requests." Adapted: Candidate gave the customer adequate time, didn\'t rush to end the call, didn\'t sound dismissive or distracted.',
    },
  ],
};
