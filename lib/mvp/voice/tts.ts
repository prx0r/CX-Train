import { DEFAULT_TTS_MODEL, DEFAULT_TTS_VOICE, MAX_TTS_TEXT_LENGTH } from './types';

export async function synthesizeSpeech(text: string, voice?: string): Promise<ArrayBuffer> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  const model = process.env.VOICE_TTS_MODEL || DEFAULT_TTS_MODEL;
  const ttsVoice = voice || process.env.VOICE_TTS_VOICE || DEFAULT_TTS_VOICE;

  if (!text.trim()) {
    throw new Error('Text is required for TTS');
  }

  if (text.length > MAX_TTS_TEXT_LENGTH) {
    throw new Error(`Text too long: ${text.length} chars (max ${MAX_TTS_TEXT_LENGTH})`);
  }

  const response = await fetch('https://openrouter.ai/api/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text,
      voice: ttsVoice,
      response_format: 'mp3',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TTS failed (${response.status}): ${errorText}`);
  }

  return response.arrayBuffer();
}
