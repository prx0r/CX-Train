import { FrameworkDefinition } from '../evaluator';

/**
 * LEAP / HEAT Customer Interaction Models
 *
 * Source: Common practice in contact centre QA frameworks. Public domain.
 * LEAP: Listen, Empathize, Apologize, Problem-solve
 * HEAT: Hear, Empathize, Apologize, Take action
 *
 * Both models follow the same core sequence: allow the customer to speak,
 * acknowledge their feelings, apologize for the inconvenience, and take
 * ownership of the resolution. These are soft-skill rubrics for de-escalation
 * and rapport-building on support calls.
 */
export const LEAP_HEAT_RUBRIC: FrameworkDefinition = {
  id: 'leap_heat_rubric',
  name: 'LEAP/HEAT Customer Interaction',
  version: '2.0',
  type: 'skills_framework',
  category: 'customer_experience',
  passThreshold: 70,
  weight: 1.0,
  description: 'LEAP (Listen-Empathize-Apologize-Problem-solve) and HEAT (Hear-Empathize-Apologize-Take action) customer interaction models. Assesses de-escalation, empathy, and rapport-building behaviours on calls.',
  standardsAlignments: ['LEAP Model', 'HEAT Framework (Hear-Empathize-Apologize-Take action)'],
  criteria: [
    {
      id: 'leap_listen',
      label: 'Listen/Hear — Give the customer full, uninterrupted attention. Allow them to explain the issue without interruption.',
      weight: 10,
      critical: false,
      category: 'active_listening',
      checkType: 'ai_criteria',
      checkTarget: 'leap_listen',
      passIf: 'pass_or_partial',
      evidenceDescription: 'LEAP/HEAT first element: The candidate must listen actively without interrupting the customer. Assessment criteria: (1) allows the customer to fully explain their issue without cutting them off; (2) uses verbal acknowledgments that show attention — "I see," "Okay," "I understand," "Go on"; (3) does not pre-judge or form a response before the customer has finished speaking; (4) tone conveys patience and attentiveness, not urgency to move on. A good example: The candidate lets the customer explain for several sentences without interrupting, using brief acknowledgments to show they are listening. A poor example: The candidate interrupts the customer mid-sentence to ask a question or jumps to a solution before the customer has finished explaining.',
    },
    {
      id: 'leap_empathize',
      label: 'Empathize — Acknowledge the customer\'s feelings and demonstrate understanding of the impact of the issue on them.',
      weight: 10,
      critical: false,
      category: 'empathy',
      checkType: 'ai_criteria',
      checkTarget: 'servqual_em_individual',
      passIf: 'pass_or_partial',
      evidenceDescription: 'LEAP/HEAT second element: The candidate must demonstrate genuine empathy for the customer\'s situation. Assessment criteria: (1) uses empathetic language that acknowledges the customer\'s frustration or inconvenience — "I can understand why that would be frustrating," "That must be very inconvenient for you"; (2) validates the customer\'s emotions without being patronizing; (3) references the customer\'s specific situation rather than using a generic phrase; (4) does NOT say "I know how you feel" (which can sound presumptuous) — instead says "I can see why you would feel that way." A good example: "I can hear how urgent this is for you with your client deadline approaching. Let me focus on getting this sorted quickly for you." A poor example: A robotic "I understand your frustration" with no follow-up, or saying "I know how you feel" without understanding the specific situation.',
    },
    {
      id: 'leap_apologize',
      label: 'Apologize — Offer a sincere, specific apology for the inconvenience or problem the customer is experiencing.',
      weight: 10,
      critical: false,
      category: 'empathy',
      checkType: 'ai_criteria',
      checkTarget: 'leap_apologize',
      passIf: 'pass_or_partial',
      evidenceDescription: 'LEAP/HEAT third element: The candidate must offer a genuine apology. Assessment criteria: (1) the apology is specific to the situation — not just "sorry" but "I\'m sorry this error has caused you extra work today"; (2) the apology does not shift blame to the customer, another team, or the system; (3) takes ownership on behalf of the organization; (4) sounds sincere, not rushed or scripted. A good example: "I\'m sorry this has locked you out during such an important time. Let me take ownership of this and get it sorted for you." A poor example: "Sorry about that, but the system sometimes does this when..." (shifts blame), or a rushed "Sorry" before moving on without genuine acknowledgment.',
    },
    {
      id: 'leap_take_action',
      label: 'Take action / Problem-solve — Take ownership of the issue and work toward a resolution with clear next steps.',
      weight: 10,
      critical: false,
      category: 'resolution',
      checkType: 'ai_criteria',
      checkTarget: 'next_steps',
      passIf: 'pass_or_partial',
      evidenceDescription: 'LEAP/HEAT fourth element: The candidate must take concrete action to resolve the issue. Assessment criteria: (1) clearly states what actions will be taken and who is responsible; (2) sets realistic expectations for timelines — when will the customer hear back, when will it be resolved; (3) confirms the plan with the customer and gets their agreement; (4) provides reassurance of follow-through; (5) ends with a positive, forward-looking statement. A good example: "Here\'s what I\'m going to do: I\'ll unlock your account right now and send a password reset email to your registered address. You should receive it within two minutes. Once you reset, please try logging in again. If it doesn\'t arrive, call us back and I\'ll escalate it. Does that plan work for you?" A poor example: "Okay, I\'ll look into it and someone will get back to you" with no timeline, specific action, or confirmation.',
    },
  ],
};
