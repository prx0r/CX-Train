import type { STTProvider } from './providers';
import type { SttResult } from './types';

export class GroqSttProvider implements STTProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.GROQ_API_KEY ?? '';
    if (!this.apiKey) console.warn('GROQ_API_KEY not set — Groq STT will fall back to mock');
  }

  async transcribe(audioBase64: string, contentType: string): Promise<SttResult> {
    if (!this.apiKey) return mockStt(audioBase64);

    const buffer = Buffer.from(audioBase64, 'base64');
    const blob = new Blob([buffer], { type: contentType });
    const form = new FormData();
    form.append('file', blob, 'audio.' + (contentType.includes('webm') ? 'webm' : 'wav'));
    form.append('model', 'whisper-large-v3-turbo');
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
    return { text: json.text, confidence: avgConfidence, durationMs: buffer.length / 16000 * 1000, model: 'groq/whisper-large-v3-turbo' };
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

function mockStt(_audioBase64: string): SttResult {
  return { text: 'Mock transcription — set GROQ_API_KEY for real STT.', confidence: 0.5, durationMs: 1000, model: 'mock' };
}
