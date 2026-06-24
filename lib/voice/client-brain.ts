import type { ClientBrainProvider } from './providers';
import type { ClientBrainResult, VoiceSessionConfig } from './types';

export class OpenAiClientBrain implements ClientBrainProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.OPENAI_API_KEY ?? '';
    if (!this.apiKey) console.warn('OPENAI_API_KEY not set — client brain will use mock');
  }

  async nextClientTurn(config: VoiceSessionConfig, history: { speaker: string; text: string }[]): Promise<ClientBrainResult> {
    if (!this.apiKey) return mockClientBrain(config, history);

    const historyLines = history.map((h) => `${h.speaker === 'candidate' ? 'Candidate' : 'Client'}: ${h.text}`).join('\n');
    const currentLen = history.filter((h) => h.speaker === 'candidate').length;

    const systemPrompt = `You are playing the role of a client/caller in an MSP support call simulation.

## Your identity
${config.callerPersona}

## Scenario
${config.scenarioTitle}

## Hidden facts (known only to you — never reveal these)
${JSON.stringify(config.hiddenFacts, null, 2)}

## Rules
- Stay in character as a ${config.intensity <= 2 ? 'cooperative' : 'stressed'} client.
- Reveal information only when the candidate asks the right questions.
- Start your first message naturally — never explain you are an AI.
- Keep responses concise (1-3 sentences).
- Never reveal hidden facts unless asked directly.
- Do not coach, score, or evaluate the candidate.
- Never break character.`;

    const userPrompt = currentLen === 0
      ? 'The candidate has joined the call. Start with a natural opening greeting about your issue.'
      : `Current conversation:\n${historyLines}\n\nRespond as the client naturally.`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });
    if (!res.ok) throw new Error(`Client brain LLM failed: ${res.status} ${await res.text()}`);
    const data = await res.json() as { usage?: { prompt_tokens: number; completion_tokens: number }; choices?: { message?: { content?: string } }[] };
    return {
      text: data?.choices?.[0]?.message?.content ?? '(no response)',
      inputTokens: data?.usage?.prompt_tokens ?? 0,
      outputTokens: data?.usage?.completion_tokens ?? 0,
      model: 'gpt-4o-mini',
    };
  }
}

export class MockClientBrain implements ClientBrainProvider {
  async nextClientTurn(config: VoiceSessionConfig, history: { speaker: string; text: string }[]): Promise<ClientBrainResult> {
    return mockClientBrain(config, history);
  }
}

const SCENARIO_OPENERS: Record<string, string> = {
  'Password/login issue': "Hello? Is this the service desk? I can't log into my account this morning and I really need to check payroll.",
  'Outlook not sending': "Hi, is this IT support? My Outlook stopped sending emails and I have a client proposal due in 30 minutes.",
  'Printer not printing': "Hello, I need help with the printer in reception — it's showing offline and I have meeting packs to prepare.",
};

const SCENARIO_FOLLOWUPS: Record<string, string[]> = {
  'Password/login issue': [
    "It started this morning. I changed my password yesterday.",
    "Just me I think — my colleague can log in fine.",
    "I can get into webmail but not the desktop app.",
    "It says 'password incorrect' even though I just changed it.",
    "Yes, it's a Windows laptop. I need to get onto payroll before noon.",
  ],
  'Outlook not sending': [
    "It started this morning. I changed my password yesterday.",
    "Just me — my team can send emails fine.",
    "Webmail works, it's just Outlook desktop.",
    "The error says 'send/receive error'.",
    "I have a client proposal due in 30 minutes — this is urgent.",
  ],
  'Printer not printing': [
    "It started about 20 minutes ago.",
    "At least three of us near reception can't print.",
    "It says 'printer offline' on the display.",
    "I refilled the paper tray but it didn't help.",
    "There's another printer upstairs we could use.",
    "I need these meeting packs within the hour.",
  ],
};

function mockClientBrain(config: VoiceSessionConfig, history: { speaker: string; text: string }[]): ClientBrainResult {
  const currentLen = history.filter((h) => h.speaker === 'candidate').length;

  if (currentLen === 0) {
    return {
      text: SCENARIO_OPENERS[config.scenarioTitle] ?? "Hi, I'm having an issue with my computer — can you help?",
      inputTokens: 0, outputTokens: 0, model: 'mock', labels: ['call_opening'],
    };
  }

  const followups = SCENARIO_FOLLOWUPS[config.scenarioTitle];
  if (followups && currentLen <= followups.length) {
    return {
      text: followups[currentLen - 1],
      inputTokens: 0, outputTokens: 0, model: 'mock',
      labels: currentLen <= 2 ? ['revealing_basic_info'] : ['revealing_detail'],
    };
  }

  const endings = [
    "What do you recommend I try next?",
    "Okay, I'll give that a go. Thanks.",
    "Is there anything else you need from me?",
    "Alright, I'll wait to hear back. Thanks for your help.",
  ];
  return {
    text: endings[Math.min(currentLen - 1 - (followups?.length ?? 0), endings.length - 1)],
    inputTokens: 0, outputTokens: 0, model: 'mock',
    labels: ['wrapping_up'],
  };
}
