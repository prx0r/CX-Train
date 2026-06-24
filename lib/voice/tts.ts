import type { TTSProvider } from './providers';
import type { TtsResult } from './types';

export class KokoroTtsProvider implements TTSProvider {
  private chutesApiKey: string;

  constructor(apiKey?: string) {
    this.chutesApiKey = apiKey ?? process.env.CHUTES_API_KEY ?? '';
    if (!this.chutesApiKey) console.warn('CHUTES_API_KEY not set — TTS will fall back to mock');
  }

  async speak(text: string, _voiceId?: string): Promise<TtsResult> {
    if (!this.chutesApiKey) return mockTts(text);

    const res = await fetch('https://api.chutes.ai/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.chutesApiKey}`,
      },
      body: JSON.stringify({
        model: 'koko',
        input: text,
        voice: _voiceId ?? 'af_bella',
        response_format: 'wav',
      }),
    });
    if (!res.ok) throw new Error(`Chutes TTS failed: ${res.status} ${await res.text()}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    return { audioBase64: buffer.toString('base64'), durationMs: Math.floor(text.length * 60), model: 'chutes/kokoro' };
  }
}

export class OpenAiTtsProvider implements TTSProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.OPENAI_API_KEY ?? '';
    if (!this.apiKey) console.warn('OPENAI_API_KEY not set — TTS will fall back to mock');
  }

  async speak(text: string, voiceId?: string): Promise<TtsResult> {
    if (!this.apiKey) return mockTts(text);

    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
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

export class MockTtsProvider implements TTSProvider {
  async speak(text: string, _voiceId?: string): Promise<TtsResult> {
    return mockTts(text);
  }
}

function mockTts(text: string): TtsResult {
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
