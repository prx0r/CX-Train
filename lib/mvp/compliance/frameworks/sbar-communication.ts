import { FrameworkDefinition } from '../evaluator';

/**
 * SBAR (Situation-Background-Assessment-Recommendation)
 *
 * Source: US Navy nuclear submarine protocol → aviation → healthcare (Kaiser Permanente, 2002)
 * Public domain. Freely documented by IHI, AHRQ, NHS.
 *
 * SBAR is a structured communication framework designed to ensure critical
 * information is transmitted concisely and completely during handovers,
 * escalations, and urgent communications. Each element has a specific purpose
 * and assessment criteria.
 */
export const SBAR_COMMUNICATION: FrameworkDefinition = {
  id: 'sbar_communication',
  name: 'SBAR Structured Communication',
  version: '2.0',
  type: 'skills_framework',
  category: 'customer_experience',
  passThreshold: 70,
  weight: 1.0,
  description: 'SBAR (Situation-Background-Assessment-Recommendation) structured communication protocol. Used for escalations, handoffs, and complex issue explanations. Each of the four elements must be present and correctly ordered for effective communication.',
  standardsAlignments: ['SBAR — US Navy/Kaiser Permanente/IHI'],
  criteria: [
    {
      id: 'sbar_situation',
      label: 'Situation — What is happening right now? A concise statement of the current issue, identifying the parties involved and the specific concern.',
      weight: 10,
      critical: false,
      category: 'communication',
      checkType: 'ai_criteria',
      checkTarget: 'sbar_situation',
      passIf: 'pass_or_partial',
      evidenceDescription: 'SBAR element SITUATION: The candidate must clearly identify who the issue affects, what the specific problem is, and convey the urgency level. Assessment criteria: (1) identifies the affected person/account/service by name; (2) states the specific concern or reason for escalation in one to two sentences; (3) communicates the urgency level explicitly (e.g., "This needs attention within 30 minutes"); (4) avoids extraneous detail — the situation statement should be ten seconds or less. A good example: "I have a user, Sarah Thompson in Finance, who cannot log into her email at all. She has a client deadline in one hour — this is urgent." A poor example: "So there\'s this user who called me about email and I checked a few things and I think there might be an issue with her account."',
    },
    {
      id: 'sbar_background',
      label: 'Background — Relevant context and history. What led to this situation, what has been tried, and what is the relevant background information.',
      weight: 10,
      critical: false,
      category: 'communication',
      checkType: 'ai_criteria',
      checkTarget: 'sbar_background',
      passIf: 'pass_or_partial',
      evidenceDescription: 'SBAR element BACKGROUND: The candidate must provide relevant contextual information that helps the recipient understand the situation. Assessment criteria: (1) includes pertinent history (when the issue started, recent changes, prior tickets); (2) mentions what has already been attempted or checked; (3) provides only information directly relevant to the current situation — no extraneous history; (4) maintains chronological or logical flow. A good example: "Her account was working this morning. She was prompted for MFA and the app showed a code, but the code was rejected. She tried three times before calling in, and now her account is locked." A poor example: "She\'s been here for three years, she usually works in Finance, her manager is John, and she got a new phone last month."',
    },
    {
      id: 'sbar_assessment',
      label: 'Assessment — Your professional judgment. What do you think the problem is based on the evidence you have gathered?',
      weight: 10,
      critical: false,
      category: 'communication',
      checkType: 'ai_criteria',
      checkTarget: 'sbar_assessment',
      passIf: 'pass_or_partial',
      evidenceDescription: 'SBAR element ASSESSMENT: The candidate must provide their professional analysis and judgment based on the situation and background. Assessment criteria: (1) states what they believe is happening or what the likely cause is; (2) the judgment must be clearly based on the evidence presented in the background; (3) distinguishes between facts and opinions; (4) demonstrates technical understanding appropriate to their role. A good example: "I believe the issue is a time sync problem between her phone\'s authenticator app and the authentication server, because the codes are being generated but rejected, which is a classic symptom of clock drift." A poor example: "I think something is wrong with her account — maybe Microsoft is down?"',
    },
    {
      id: 'sbar_recommendation',
      label: 'Recommendation — What needs to happen next? A clear, actionable request for what should be done, by whom, and by when.',
      weight: 10,
      critical: false,
      category: 'communication',
      checkType: 'ai_criteria',
      checkTarget: 'next_steps',
      passIf: 'pass_or_partial',
      evidenceDescription: 'SBAR element RECOMMENDATION: The candidate must state clearly what action they want taken. Assessment criteria: (1) specifies the exact action needed; (2) states who needs to take it; (3) states the timeframe or urgency; (4) the recommendation is realistic and actionable; (5) invites confirmation or alternative suggestions. A good example: "I need you to force a time sync on the authentication server for Sarah\'s account. This needs to happen within the next 15 minutes to meet her client deadline. Can you do that or should I escalate further?" A poor example: "Someone should probably look at her account when they get a chance."',
    },
  ],
};
