import { SimPack, SimState } from './types';

export interface AiCustomerContext {
  systemPrompt: string;
  availableFacts: string[];
  forbiddenFacts: string[];
  customerMoodDescription: string;
}

export interface AiCustomerCheckpoint {
  id: string;
  label: string;
  satisfied: boolean;
  critical: boolean;
}

/**
 * Build a system prompt for the AI caller persona.
 * Generic — reads from pack.hiddenTruth.factsOnlyRevealAfter
 * for state-conditioned facts. No hardcoded Outlook references.
 */
export function buildAiCustomerContext(pack: SimPack, state: SimState): AiCustomerContext {
  const moodMap: Record<string, string> = {
    neutral: 'calm and cooperative',
    frustrated: 'visibly frustrated but staying polite',
    reassured: 'noticeably relieved and grateful',
  };

  const customer = pack.customer;

  /* Available facts — start with identity and basic info */
  const availableFacts: string[] = [
    `Name: ${customer.name}`,
    `Company: ${customer.company}`,
    `Role: ${customer.role}`,
    `Issue started: this morning`,
  ];

  /* Add facts revealed through state machine */
  if (state.call.factsRevealed.length > 0) {
    availableFacts.push(...state.call.factsRevealed.map(f => `Discovered: ${f}`));
  }

  /* Generic state-conditioned facts from hiddenTruth.factsOnlyRevealAfter.
     Each key is an action ID that was performed; each value is an array of strings
     the customer should volunteer once that action is done. */
  if (pack.hiddenTruth.factsOnlyRevealAfter) {
    const triggeredKeys: string[] = [];
    for (const requiredActionId of Object.keys(pack.hiddenTruth.factsOnlyRevealAfter)) {
      const performed = state.call.factsRevealed.some(
        f => f.toLowerCase().includes(requiredActionId.replace(/_/g, ' '))
      ) || state.discovered.some(d => d.includes(requiredActionId));
      if (performed) {
        triggeredKeys.push(requiredActionId);
      }
    }
    for (const key of triggeredKeys) {
      const lines = pack.hiddenTruth.factsOnlyRevealAfter[key];
      if (lines) {
        for (const line of lines) {
          if (!availableFacts.includes(line)) {
            availableFacts.push(line);
          }
        }
      }
    }
  }

  /* Add mood changes based on what fixed state */
  if (state.call.customerMood === 'reassured') {
    availableFacts.push('The user is now relieved that the issue is being handled');
  }

  /* Forbidden facts — generic rules */
  const forbiddenFacts: string[] = [
    `The root cause is "${pack.hiddenTruth.rootCause}" — do not suggest this unless the candidate discovers it through tool actions`,
    `The correct fix is "${pack.hiddenTruth.correctFix}" — do not tell the candidate this directly`,
    `${customer.name} is not technical — do not have them suggest fixes`,
    'Do not solve the issue for the candidate',
    'Do not reveal information the candidate has not asked for or discovered',
  ];

  const moodDescription = moodMap[state.call.customerMood] || 'stressed but polite';

  /* Archetype-based behavior modifiers */
  const archetypeHints: Record<string, string> = {
    uncertain: 'You are unsure of technical details. Be polite but vague when pressed. May overshare slightly if asked gently.',
    direct: 'You are clear and concise. You dislike vagueness from the technician. If they waste time, become pushier.',
    executive: 'You are time-sensitive and outcome-focused. Your tone improves if the technician handles things professionally.',
  };

  const archetypeHint = archetypeHints[pack.callerBehavior?.archetype] || '';

  const systemPrompt = `You are ${customer.name}, a ${customer.role.toLowerCase()} at ${customer.company}, on a support call with an IT technician.

Personality: ${customer.temperament}, ${moodDescription}.
${archetypeHint}

CONSTRAINTS:
- You may ONLY reveal facts listed in "Available facts" below.
- You may NEVER reveal facts listed in "Forbidden facts".
- Stay in character as a non-technical user. You do not know IT terminology.
- Keep answers short (1-3 sentences) like a real user on a busy workday.
- Do not solve the issue. The technician must diagnose and fix it.
- If asked something you do not know, say "I'm not sure about that" or "I don't know".
- If the technician asks you to check something on your screen, describe what you see honestly based on the current situation.
- If the technician has resolved the issue and asks you to verify, confirm whether the fix worked.

Available facts:
${availableFacts.map(f => `- ${f}`).join('\n')}

Forbidden facts:
${forbiddenFacts.map(f => `- ${f}`).join('\n')}`;

  return {
    systemPrompt,
    availableFacts,
    forbiddenFacts,
    customerMoodDescription: moodDescription,
  };
}

/**
 * Track which universal MSP call checkpoints have been satisfied.
 * Returns a list of checkpoint IDs and whether they've been met based
 * on current state.
 */
export function trackCheckpoints(pack: SimPack, state: SimState): AiCustomerCheckpoint[] {
  const checkpoints: AiCustomerCheckpoint[] = [
    { id: 'verified_name', label: 'Verified caller name', satisfied: state.evidence.confirmedUser, critical: true },
    { id: 'confirmed_company', label: 'Confirmed company', satisfied: state.call.factsRevealed.length > 0, critical: true },
    { id: 'got_hostname', label: 'Got device hostname', satisfied: state.discovered.some(d => d.includes('remote.connect')), critical: true },
    { id: 'asked_impact', label: 'Asked business impact', satisfied: state.evidence.askedImpact, critical: true },
    { id: 'asked_scope', label: 'Asked scope', satisfied: state.evidence.askedScope, critical: true },
    { id: 'checked_obvious_cause', label: 'Checked obvious cause', satisfied: state.evidence.checkedObviousCause, critical: false },
    { id: 'verified_fix', label: 'Verified fix', satisfied: state.evidence.verifiedFix, critical: true },
  ];
  return checkpoints;
}
