import type { STTProvider, SttResult, SttProviderName } from './providers';
import { MAX_AUDIO_SIZE_BYTES } from './providers';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

/* ── Mock ── */

function mockSttProvider(_audioBase64: string): SttResult {
  return { text: 'Mock transcription — set OPENROUTER_API_KEY or GROQ_API_KEY for real STT.', confidence: 0.5, durationMs: 1000, model: 'mock' };
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

/* ── OpenRouter STT ── */

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

/* ── Groq STT ── */

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

/* ── Self-hosted Vosk STT (from audiator) ── */

export class VoskSttProvider implements STTProvider {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl ?? process.env.VOSK_BASE_URL ?? 'http://127.0.0.1:2700').replace(/\/$/, '');
  }

  async transcribe(audioBase64: string, contentType: string): Promise<SttResult> {
    const res = await fetch(`${this.baseUrl}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64, mimeType: contentType, language: 'en' }),
    });
    if (!res.ok) throw new Error(`Vosk transcription failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    return { text: data.text ?? data.transcript ?? '', provider: 'vosk', model: data.model ?? 'vosk-local', durationMs: 0 };
  }
}

/* ── Self-hosted whisper.cpp STT (from audiator) ── */

export class WhisperCppSttProvider implements STTProvider {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl ?? process.env.WHISPER_CPP_BASE_URL ?? '').replace(/\/$/, '');
    if (!this.baseUrl) throw new Error('WHISPER_CPP_BASE_URL not configured');
  }

  async transcribe(audioBase64: string, contentType: string): Promise<SttResult> {
    const res = await fetch(`${this.baseUrl}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64, mimeType: contentType, language: 'en' }),
    });
    if (!res.ok) throw new Error(`whisper.cpp transcription failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    return { text: data.text ?? data.transcript ?? '', provider: 'whisper_cpp', model: data.model ?? 'whisper.cpp', durationMs: 0 };
  }
}

/* ── Fixture (for testing/text mode) ── */

export class FixtureSttProvider implements STTProvider {
  async transcribe(audioBase64: string, _contentType: string): Promise<SttResult> {
    const decoded = Buffer.from(audioBase64, 'base64').toString('utf8').trim();
    return { text: decoded || process.env.FIXTURE_STT_TEXT || '', provider: 'fixture', model: 'text-fixture', durationMs: 0 };
  }
}

/* ── Provider factory ── */

export function getSttProvider(providerName?: string): STTProvider {
  const name = (providerName ?? process.env.VOICE_STT_PROVIDER ?? 'openrouter') as SttProviderName;
  switch (name) {
    case 'openrouter': return new OpenRouterSttProvider();
    case 'groq': return new GroqSttProvider();
    case 'vosk': return new VoskSttProvider();
    case 'whisper_cpp': return new WhisperCppSttProvider();
    case 'fixture': return new FixtureSttProvider();
    default: return new MockSttProvider();
  }
}

export function validateAudioSize(bytes: number): void {
  if (bytes > MAX_AUDIO_SIZE_BYTES) throw new Error(`Audio file too large: ${bytes} bytes (max ${MAX_AUDIO_SIZE_BYTES})`);
}
