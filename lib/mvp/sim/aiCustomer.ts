import { SimPack, SimState } from './types';

export interface AiCustomerContext {
  systemPrompt: string;
  availableFacts: string[];
  forbiddenFacts: string[];
  customerMoodDescription: string;
}

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

  /* Add conditional facts based on state */
  if (state.outlook && state.outlook.workOffline === false) {
    availableFacts.push('Outlook is now connected and online');
  }
  if (state.outlook && state.outlook.sentTestEmail) {
    availableFacts.push('Test email was sent and received successfully');
  }
  if (state.network && state.network.exchangeReachable === false) {
    availableFacts.push('Exchange server appears unreachable');
  }
  if (state.evidence.checkedObviousCause) {
    availableFacts.push('The obvious causes have been checked');
  }

  /* Forbidden facts — things the AI must not reveal unprompted */
  const forbiddenFacts: string[] = [
    'The root cause is Work Offline mode — do not suggest this unless the candidate discovers it through tool actions',
    `The correct fix is disabling Work Offline — do not tell the candidate this directly`,
    `${customer.name} does not know what Work Offline is — do not have them suggest it`,
    'Do not solve the issue for the candidate',
    'Do not reveal information the candidate has not asked for or discovered',
  ];

  const moodDescription = moodMap[state.call.customerMood] || 'stressed but polite';

  const systemPrompt = `You are ${customer.name}, a ${customer.role.toLowerCase()} at ${customer.company}, on a support call with an IT technician.

Personality: ${customer.temperament}, ${moodDescription}.

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
