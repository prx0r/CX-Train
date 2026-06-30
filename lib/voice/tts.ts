import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { TTSProvider, TtsResult, TtsProviderName } from './providers';
import { DEFAULT_TTS_VOICE, MAX_TTS_TEXT_LENGTH } from './providers';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

/* ── TTS Caching ── */

function cacheDir(): string {
  return path.resolve(process.cwd(), process.env.TTS_CACHE_DIR || './data/tts-cache');
}

function cachePath(text: string, voice: string, format: string): string {
  const hash = crypto.createHash('sha1').update(`${voice}\n${format}\n${text}`).digest('hex');
  return path.join(cacheDir(), `${voice}-${hash}.${format}`);
}

/* ── Mock / Fixture ── */

function mockTtsProvider(text: string): TtsResult {
  const durationMs = Math.floor(text.length * 60);
  const sampleRate = 24000;
  const numSamples = Math.floor(durationMs * sampleRate / 1000);
  const wavHeader = Buffer.alloc(44);
  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + numSamples * 2, 4);
  wavHeader.write('WAVE', 8);
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20);
  wavHeader.writeUInt16LE(1, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(sampleRate * 2, 28);
  wavHeader.writeUInt16LE(2, 32);
  wavHeader.writeUInt16LE(16, 34);
  const silent = Buffer.alloc(numSamples * 2, 0);
  const wav = Buffer.concat([wavHeader, silent]);
  return { audioBase64: wav.toString('base64'), durationMs, model: 'mock/silence' };
}

export class MockTtsProvider implements TTSProvider {
  async speak(text: string, _voiceId?: string): Promise<TtsResult> {
    return mockTtsProvider(text);
  }
}

/* ── OpenRouter TTS ── */

export class OpenRouterTtsProvider implements TTSProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey ?? process.env.OPENROUTER_API_KEY ?? '';
    this.model = model ?? process.env.TTS_MODEL ?? 'hexgrad/kokoro-82m';
    if (!this.apiKey) console.warn('OPENROUTER_API_KEY not set — OpenRouter TTS will fall back to mock');
  }

  async speak(text: string, voiceId?: string): Promise<TtsResult> {
    if (!this.apiKey) return mockTtsProvider(text);

    const res = await fetch(`${OPENROUTER_BASE}/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://callcallum.app',
        'X-Title': 'CallCallum',
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
        voice: voiceId ?? 'af_bella',
        response_format: 'wav',
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter TTS failed: ${res.status} ${await res.text()}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    return { audioBase64: buffer.toString('base64'), durationMs: Math.floor(text.length * 60), model: `openrouter/${this.model}` };
  }
}

/* ── OpenAI TTS ── */

export class OpenAiTtsProvider implements TTSProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.OPENAI_API_KEY ?? '';
    if (!this.apiKey) console.warn('OPENAI_API_KEY not set — TTS will fall back to mock');
  }

  async speak(text: string, voiceId?: string): Promise<TtsResult> {
    if (!this.apiKey) return mockTtsProvider(text);

    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voiceId ?? 'alloy',
        response_format: 'wav',
      }),
    });
    if (!res.ok) throw new Error(`OpenAI TTS failed: ${res.status} ${await res.text()}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    return { audioBase64: buffer.toString('base64'), durationMs: Math.floor(text.length * 60), model: 'openai/tts-1' };
  }
}

/* ── Self-hosted Kokoro TTS (from audiator) ── */

export class KokoroTtsProvider implements TTSProvider {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl ?? process.env.KOKORO_BASE_URL ?? 'http://127.0.0.1:8880').replace(/\/$/, '');
  }

  async speak(text: string, voiceId?: string): Promise<TtsResult> {
    const voice = voiceId ?? process.env.TTS_VOICE ?? DEFAULT_TTS_VOICE;
    const res = await fetch(`${this.baseUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.TTS_MODEL || 'kokoro',
        input: text,
        voice,
        response_format: 'mp3',
      }),
    });
    if (!res.ok) throw new Error(`Kokoro TTS failed (${res.status}): ${await res.text()}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    return { audioBase64: buffer.toString('base64'), durationMs: Math.floor(text.length * 60), model: `kokoro/${voice}` };
  }
}

/* ── Cached synthesis function (from audiator) ── */

export async function synthesizeSpeech(text: string, voice?: string): Promise<ArrayBuffer> {
  if (!text.trim()) throw new Error('Text is required for TTS');
  if (text.length > MAX_TTS_TEXT_LENGTH) throw new Error(`Text too long: ${text.length} chars (max ${MAX_TTS_TEXT_LENGTH})`);

  const ttsVoice = voice || process.env.TTS_VOICE || DEFAULT_TTS_VOICE;
  const provider = (process.env.TTS_PROVIDER as TtsProviderName | undefined) ?? 'openrouter';
  const format = provider === 'fixture' ? 'wav' : 'mp3';
  const filePath = cachePath(text, ttsVoice, format);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) return fs.readFileSync(filePath).buffer as ArrayBuffer;

  let audio: Buffer;
  if (provider === 'fixture') {
    const r = mockTtsProvider(text);
    audio = Buffer.from(r.audioBase64, 'base64');
  } else if (provider === 'kokoro') {
    const tts = new KokoroTtsProvider();
    const r = await tts.speak(text, ttsVoice);
    audio = Buffer.from(r.audioBase64, 'base64');
  } else if (provider === 'openrouter') {
    const tts = new OpenRouterTtsProvider();
    const r = await tts.speak(text, ttsVoice);
    audio = Buffer.from(r.audioBase64, 'base64');
  } else if (provider === 'openai') {
    const tts = new OpenAiTtsProvider();
    const r = await tts.speak(text, ttsVoice);
    audio = Buffer.from(r.audioBase64, 'base64');
  } else {
    throw new Error(`Unsupported TTS provider: ${provider}`);
  }

  fs.writeFileSync(filePath, audio);
  return audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength) as ArrayBuffer;
}
