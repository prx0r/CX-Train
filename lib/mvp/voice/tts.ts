import { DEFAULT_TTS_VOICE, MAX_TTS_TEXT_LENGTH } from './types';

export interface AzureTtsConfig {
  voiceName?: string;
  style?: string;
  styleDegree?: number;
  rate?: string;
  pitch?: string;
  role?: string;
}

/**
 * Synthesize speech from text.
 *
 * Provider priority:
 *   1. Azure Neural TTS (if AZURE_TTS_KEY set)
 *   2. OpenRouter TTS (fallback)
 */
export async function synthesizeSpeech(
  text: string,
  _voice?: string,
  azureConfig?: AzureTtsConfig,
): Promise<ArrayBuffer> {
  if (!text.trim()) {
    throw new Error('Text is required for TTS');
  }

  if (text.length > MAX_TTS_TEXT_LENGTH) {
    throw new Error(`Text too long: ${text.length} chars (max ${MAX_TTS_TEXT_LENGTH})`);
  }

  /* Try Azure Neural TTS first */
  const azureKey = process.env.AZURE_TTS_KEY || process.env.AZURE_API_KEY;
  const azureRegion = process.env.AZURE_TTS_REGION || 'eastus';
  if (azureKey) {
    return synthesizeAzure(text, azureKey, azureRegion, azureConfig);
  }

  /* Fallback to OpenRouter */
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    return synthesizeOpenRouter(text, openRouterKey, _voice);
  }

  throw new Error('No TTS provider configured. Set AZURE_TTS_KEY or OPENROUTER_API_KEY.');
}

/**
 * Azure Neural TTS via Cognitive Services REST API
 *
 * Supports SSML voice styles, prosody, and role-play.
 * Docs: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech
 */
async function synthesizeAzure(
  text: string,
  apiKey: string,
  region: string,
  config?: AzureTtsConfig,
): Promise<ArrayBuffer> {
  const voiceName = config?.voiceName || process.env.AZURE_TTS_VOICE || 'en-GB-SoniaNeural';
  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

  /* Build SSML with voice style, prosody, and role */
  const styleAttr = config?.style ? ` style="${escapeXml(config.style)}"` : '';
  const styleDegreeAttr = config?.styleDegree ? ` styledegree="${config.styleDegree}"` : '';
  const roleAttr = config?.role ? ` role="${escapeXml(config.role)}"` : '';

  const rateAttr = config?.rate ? ` rate="${escapeXml(config.rate)}"` : ' rate="medium"';
  const pitchAttr = config?.pitch ? ` pitch="${escapeXml(config.pitch)}"` : '';
  const volumeAttr = ' volume="medium"';

  const ssml = `<?xml version="1.0" encoding="UTF-8"?>
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-GB">
  <voice name="${escapeXml(voiceName)}"${styleAttr}${styleDegreeAttr}${roleAttr}>
    <prosody${rateAttr}${pitchAttr}${volumeAttr}>
      ${escapeXml(text)}
    </prosody>
  </voice>
</speak>`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
    },
    body: ssml,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown');
    throw new Error(`Azure TTS failed (${response.status}): ${errorText.slice(0, 200)}`);
  }

  return response.arrayBuffer();
}

/**
 * OpenRouter TTS (fallback — Kokoro or other models)
 */
async function synthesizeOpenRouter(
  text: string,
  apiKey: string,
  voice?: string,
): Promise<ArrayBuffer> {
  const model = process.env.VOICE_TTS_MODEL || 'hexgrad/kokoro-82m';
  const ttsVoice = voice || process.env.VOICE_TTS_VOICE || DEFAULT_TTS_VOICE;

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
    throw new Error(`OpenRouter TTS failed (${response.status}): ${errorText}`);
  }

  return response.arrayBuffer();
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
