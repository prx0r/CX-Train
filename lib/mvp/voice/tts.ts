import { DEFAULT_TTS_VOICE, MAX_TTS_TEXT_LENGTH } from './types';

export interface AzureTtsConfig {
  voiceName?: string;
  style?: string;
  styleDegree?: number;
  rate?: string;
  pitch?: string;
  role?: string;
}

/* ── Types ── */

export type VoiceLocale = 'en-GB' | 'en-US' | 'en-AU' | 'en-CA' | 'en-IE';

export type CustomerMood =
  | 'neutral'
  | 'friendly'
  | 'confused'
  | 'rushed'
  | 'frustrated'
  | 'angry'
  | 'anxious'
  | 'panicked'
  | 'sad'
  | 'relieved'
  | 'passive_aggressive';

export type CustomerPersonaId =
  | 'rushed_finance_manager'
  | 'confused_receptionist'
  | 'annoyed_ceo'
  | 'passive_aggressive_office_manager'
  | 'panicked_teacher'
  | 'non_technical_employee';

export interface CustomerVoiceRequest {
  text: string;
  locale?: VoiceLocale;
  persona?: CustomerPersonaId;
  mood: CustomerMood;
  intensity?: 0 | 1 | 2 | 3 | 4 | 5;
  voiceName?: string;
}

export interface AzureStyleConfig {
  style?: string;
  styleDegree: string;
  rate: string;
  pitch: string;
  volume: string;
}

export interface CustomerPersonaPreset {
  id: CustomerPersonaId;
  label: string;
  locale: VoiceLocale;
  defaultVoice: string;
  defaultMood: CustomerMood;
  defaultIntensity: 0 | 1 | 2 | 3 | 4 | 5;
  speechPattern: string;
  typicalPressure: string;
}

export const CUSTOMER_PERSONAS: CustomerPersonaPreset[] = [
  {
    id: 'rushed_finance_manager',
    label: 'Rushed finance manager',
    locale: 'en-GB',
    defaultVoice: 'en-GB-SoniaNeural',
    defaultMood: 'rushed',
    defaultIntensity: 4,
    speechPattern: 'short, pressured, practical, little patience for vague troubleshooting',
    typicalPressure: 'payroll, board meeting, invoice run, month end',
  },
  {
    id: 'confused_receptionist',
    label: 'Confused receptionist',
    locale: 'en-GB',
    defaultVoice: 'en-GB-SoniaNeural',
    defaultMood: 'confused',
    defaultIntensity: 2,
    speechPattern: 'polite, non-technical, unsure of terminology, needs plain English',
    typicalPressure: 'front desk queue, calls waiting, visitors arriving',
  },
  {
    id: 'annoyed_ceo',
    label: 'Annoyed CEO',
    locale: 'en-US',
    defaultVoice: 'en-US-GuyNeural',
    defaultMood: 'frustrated',
    defaultIntensity: 4,
    speechPattern: 'direct, impatient, expects fast ownership, dislikes scripted replies',
    typicalPressure: 'meeting starting, client presentation, travel',
  },
  {
    id: 'passive_aggressive_office_manager',
    label: 'Passive-aggressive office manager',
    locale: 'en-GB',
    defaultVoice: 'en-GB-SoniaNeural',
    defaultMood: 'passive_aggressive',
    defaultIntensity: 3,
    speechPattern: 'polite words but cold tone, implies this always happens, tests confidence',
    typicalPressure: 'staff complaining, recurring issue, previous bad support experience',
  },
  {
    id: 'panicked_teacher',
    label: 'Panicked teacher',
    locale: 'en-GB',
    defaultVoice: 'en-GB-SoniaNeural',
    defaultMood: 'panicked',
    defaultIntensity: 4,
    speechPattern: 'fast, worried, distracted, classroom pressure, needs calming and clarity',
    typicalPressure: 'lesson starting, projector broken, students waiting',
  },
  {
    id: 'non_technical_employee',
    label: 'Non-technical employee',
    locale: 'en-GB',
    defaultVoice: 'en-GB-SoniaNeural',
    defaultMood: 'confused',
    defaultIntensity: 2,
    speechPattern: 'describes symptoms in everyday language, may say "the email thing" or "the blue Outlook"',
    typicalPressure: 'general work deadline, needs things explained simply',
  },
];

export const AZURE_STARTER_VOICES: Record<string, { female: string; male: string }> = {
  'en-US': { female: 'en-US-JennyNeural', male: 'en-US-GuyNeural' },
  'en-GB': { female: 'en-GB-SoniaNeural', male: 'en-GB-RyanNeural' },
  'en-AU': { female: 'en-AU-NatashaNeural', male: 'en-AU-WilliamNeural' },
  'en-CA': { female: 'en-CA-ClaraNeural', male: 'en-CA-LiamNeural' },
};

/* ── Mappers ── */

export function intensityToStyleDegree(intensity: 0 | 1 | 2 | 3 | 4 | 5): string {
  const map: Record<number, string> = { 0: '0.8', 1: '0.9', 2: '1.0', 3: '1.15', 4: '1.35', 5: '1.6' };
  return map[intensity] || '1.0';
}

export function defaultVoiceForLocale(locale: VoiceLocale, gender?: string): string {
  const voices = AZURE_STARTER_VOICES[locale] || AZURE_STARTER_VOICES['en-GB'];
  return gender === 'male' ? voices.male : voices.female;
}

export function mapMoodToAzureStyle(mood: CustomerMood, intensity: 0 | 1 | 2 | 3 | 4 | 5): AzureStyleConfig {
  const sd = intensityToStyleDegree(intensity);

  switch (mood) {
    case 'friendly':
      return { style: 'friendly', styleDegree: sd, rate: '0%', pitch: '0st', volume: 'medium' };
    case 'confused':
      return { style: 'chat', styleDegree: sd, rate: '-5%', pitch: '+0st', volume: 'medium' };
    case 'rushed':
      return { style: 'chat', styleDegree: sd, rate: '+16%', pitch: '+1st', volume: 'loud' };
    case 'frustrated':
      return { style: 'angry', styleDegree: sd, rate: '+8%', pitch: '+0st', volume: 'loud' };
    case 'angry':
      return { style: 'angry', styleDegree: sd, rate: '+12%', pitch: '+1st', volume: 'x-loud' };
    case 'anxious':
      return { style: 'terrified', styleDegree: sd, rate: '+10%', pitch: '+1st', volume: 'medium' };
    case 'panicked':
      return { style: 'terrified', styleDegree: sd, rate: '+18%', pitch: '+2st', volume: 'x-loud' };
    case 'sad':
      return { style: 'sad', styleDegree: sd, rate: '-8%', pitch: '-1st', volume: 'soft' };
    case 'relieved':
      return { style: 'cheerful', styleDegree: sd, rate: '-2%', pitch: '0st', volume: 'medium' };
    case 'passive_aggressive':
      return { style: 'unfriendly', styleDegree: sd, rate: '-2%', pitch: '-1st', volume: 'medium' };
    case 'neutral':
    default:
      return { style: 'chat', styleDegree: '1.0', rate: '0%', pitch: '0st', volume: 'medium' };
  }
}

const VOICE_STYLE_MAP: Record<string, string[]> = {
  'en-GB-SoniaNeural': ['cheerful', 'sad'],
  'en-GB-RyanNeural': ['cheerful', 'chat', 'whispering', 'sad'],
  'en-US-JennyNeural': ['angry', 'cheerful', 'excited', 'friendly', 'hopeful', 'sad', 'shouting', 'terrified', 'unfriendly', 'whisper', 'chat', 'customerservice', 'newscast', 'narration'],
  'en-US-GuyNeural': ['angry', 'cheerful', 'excited', 'friendly', 'hopeful', 'sad', 'shouting', 'terrified', 'unfriendly', 'whisper', 'chat', 'customerservice', 'newscast', 'narration'],
  'en-AU-NatashaNeural': ['cheerful', 'sad'],
  'en-AU-WilliamNeural': ['cheerful', 'sad', 'chat'],
};

const STYLE_FALLBACKS: Record<string, string[]> = {
  angry: ['unfriendly', 'chat'],
  terrified: ['sad', 'chat'],
  unfriendly: ['chat'],
  cheerful: ['friendly', 'chat'],
  friendly: ['chat'],
  sad: ['chat'],
  excited: ['cheerful', 'chat'],
  hopeful: ['friendly', 'chat'],
  shouting: ['angry', 'unfriendly', 'chat'],
  whisper: ['chat'],
  newscast: ['narration', 'chat'],
  customerservice: ['friendly', 'chat'],
  narration: ['chat'],
};

export function resolveAzureStyle(style: string | undefined, voiceName: string): string | undefined {
  if (!style) return undefined;

  const supportedStyles = VOICE_STYLE_MAP[voiceName];
  if (supportedStyles?.includes(style)) return style;

  /* Walk fallback chain to find a style the voice supports */
  const fallbacks = STYLE_FALLBACKS[style];
  if (fallbacks) {
    for (const fb of fallbacks) {
      if (supportedStyles?.includes(fb)) return fb;
    }
  }

  /* Ultimate fallback: if the voice supports 'chat', use it. Otherwise omit style. */
  if (supportedStyles?.includes('chat')) return 'chat';
  return undefined;
}

/* ── SSML Builder ── */

export function buildAzureSsml(req: CustomerVoiceRequest): string {
  const locale = req.locale || 'en-GB';
  const voiceName = req.voiceName || defaultVoiceForLocale(locale);
  const intensity = req.intensity || 3;
  const config = mapMoodToAzureStyle(req.mood, intensity);
  const safeText = escapeXml(req.text);

  const resolvedStyle = resolveAzureStyle(config.style, voiceName);

  const inner = resolvedStyle
    ? `<mstts:express-as style="${resolvedStyle}" styledegree="${config.styleDegree}">${safeText}</mstts:express-as>`
    : safeText;

  const prosody = `<prosody rate="${config.rate}" pitch="${config.pitch}" volume="${config.volume}">${inner}</prosody>`;

  return `<speak version="1.0"
       xmlns="http://www.w3.org/2001/10/synthesis"
       xmlns:mstts="https://www.w3.org/2001/mstts"
       xml:lang="${locale}">
  <voice name="${voiceName}">
    ${prosody}
  </voice>
</speak>`.trim();
}

/* ── Main synthesis ── */

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

  const azureKey = process.env.AZURE_TTS_KEY || process.env.AZURE_API_KEY;
  const azureRegion = process.env.AZURE_TTS_REGION || 'eastus';
  if (azureKey) {
    return synthesizeAzure(text, azureKey, azureRegion, azureConfig);
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    return synthesizeOpenRouter(text, openRouterKey, _voice);
  }

  throw new Error('No TTS provider configured. Set AZURE_TTS_KEY or OPENROUTER_API_KEY.');
}

async function synthesizeAzure(
  text: string,
  apiKey: string,
  region: string,
  config?: AzureTtsConfig,
): Promise<ArrayBuffer> {
  const voiceName = config?.voiceName || process.env.AZURE_TTS_VOICE || 'en-GB-SoniaNeural';
  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

  const style = config?.style;
  const styleDegree = config?.styleDegree;
  const rate = config?.rate || '0%';
  const pitch = config?.pitch || '0st';

  const safeText = escapeXml(text);

  const inner = style
    ? `<mstts:express-as style="${style}" styledegree="${styleDegree || '1.0'}">${safeText}</mstts:express-as>`
    : safeText;
  const prosody = `<prosody rate="${rate}" pitch="${pitch}">${inner}</prosody>`;

  const ssml = `<speak version="1.0"
       xmlns="http://www.w3.org/2001/10/synthesis"
       xmlns:mstts="https://www.w3.org/2001/mstts"
       xml:lang="en-GB">
  <voice name="${escapeXml(voiceName)}">
    ${prosody}
  </voice>
</speak>`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
    },
    body: ssml,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown');
    throw new Error(`Azure TTS failed (${response.status}): ${errorText.slice(0, 200)}`);
  }

  return response.arrayBuffer();
}

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

export function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
