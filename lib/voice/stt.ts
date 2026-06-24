import type { STTProvider, SttResult } from './providers';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

export class OpenRouterSttProvider implements STTProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey ?? process.env.OPENROUTER_API_KEY ?? '';
    this.model = model ?? process.env.STT_MODEL ?? 'openai/whisper-large-v3-turbo';
    if (!this.apiKey) console.warn('OPENROUTER_API_KEY not set — OpenRouter STT will fall back to mock');
  }

  async transcribe(audioBase64: string, contentType: string): Promise<SttResult> {
    if (!this.apiKey) return mockSttProvider(audioBase64);

    const buffer = Buffer.from(audioBase64, 'base64');
    const ext = contentType.includes('webm') ? 'webm' : 'wav';
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: contentType }), `audio.${ext}`);
    form.append('model', this.model);

    const res = await fetch(`${OPENROUTER_BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://callcallum.app',
        'X-Title': 'CallCallum',
      },
      body: form,
    });
    if (!res.ok) throw new Error(`OpenRouter STT failed: ${res.status} ${await res.text()}`);
    const json = await res.json() as { text: string };
    return { text: json.text, durationMs: Math.floor(buffer.length / 16000 * 1000), model: `openrouter/${this.model}` };
  }
}

export class GroqSttProvider implements STTProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey ?? process.env.GROQ_API_KEY ?? '';
    this.model = model ?? 'whisper-large-v3-turbo';
    if (!this.apiKey) console.warn('GROQ_API_KEY not set — Groq STT will fall back to mock');
  }

  async transcribe(audioBase64: string, contentType: string): Promise<SttResult> {
    if (!this.apiKey) return mockSttProvider(audioBase64);

    const buffer = Buffer.from(audioBase64, 'base64');
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: contentType }), `audio.${contentType.includes('webm') ? 'webm' : 'wav'}`);
    form.append('model', this.model);
    form.append('response_format', 'json');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
      body: form,
    });
    if (!res.ok) throw new Error(`Groq STT failed: ${res.status} ${await res.text()}`);
    const json = await res.json() as { text: string; segments?: { confidence: number }[] };
    const avgConfidence = json.segments?.length
      ? json.segments.reduce((s, seg) => s + seg.confidence, 0) / json.segments.length
      : undefined;
    return { text: json.text, confidence: avgConfidence, durationMs: buffer.length / 16000 * 1000, model: `groq/${this.model}` };
  }
}

export class MockSttProvider implements STTProvider {
  private alternatives: string[];

  constructor(alternatives?: string[]) {
    this.alternatives = alternatives ?? [
      "Hello, is this the service desk?",
      "My name is Tom and I'm calling from Acme Corp.",
      "I can't get my email to send since this morning.",
      "Yes, I'm the only one affected.",
      "It's urgent — I have a client deadline in 30 minutes.",
      "The error says send/receive failure.",
      "I changed my password yesterday.",
      "I can still access webmail though.",
      "What should I try next?",
      "Okay, I'll check the outbox and call back.",
      "Thanks for your help, I'll try that now.",
    ];
  }

  async transcribe(_audioBase64: string, _contentType: string): Promise<SttResult> {
    const idx = Math.floor(Math.random() * this.alternatives.length);
    const text = this.alternatives[idx];
    return { text, confidence: 0.92 + Math.random() * 0.07, durationMs: Math.floor(text.length * 60), model: 'mock' };
  }
}

function mockSttProvider(_audioBase64: string): SttResult {
  return { text: 'Mock transcription — set OPENROUTER_API_KEY or GROQ_API_KEY for real STT.', confidence: 0.5, durationMs: 1000, model: 'mock' };
}
