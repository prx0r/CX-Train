import type { STTProvider, TTSProvider, ChatModelProvider } from './providers';
import { GroqSttProvider, OpenRouterSttProvider, MockSttProvider } from './stt';
import { OpenRouterTtsProvider, OpenAiTtsProvider, MockTtsProvider } from './tts';
import { OpenRouterChatProvider, OpenAiChatProvider, MockChatProvider } from './chat';

export type ProviderName = 'openrouter' | 'groq' | 'openai' | 'mock';

function detectAiProvider(): ProviderName {
  const env = process.env.AI_PROVIDER?.toLowerCase() as ProviderName | undefined;
  if (env && ['openrouter', 'groq', 'openai', 'mock'].includes(env)) return env;
  if (process.env.OPENROUTER_API_KEY) return 'openrouter';
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'mock';
}

const AI_PROVIDER = detectAiProvider();

export function getProviderName(service: 'stt' | 'tts' | 'roleplay' | 'evaluator'): string {
  const override = process.env[`${service.toUpperCase()}_PROVIDER`]?.toLowerCase();
  return override ?? AI_PROVIDER;
}

export function createSttProvider(): STTProvider {
  const provider = getProviderName('stt');
  switch (provider) {
    case 'openrouter':
      return new OpenRouterSttProvider(process.env.OPENROUTER_API_KEY, process.env.STT_MODEL);
    case 'groq':
      return new GroqSttProvider(process.env.GROQ_API_KEY, process.env.STT_MODEL);
    case 'openai':
      return new OpenRouterSttProvider(process.env.OPENAI_API_KEY, process.env.STT_MODEL ?? 'whisper-1');
    default:
      return new MockSttProvider();
  }
}

export function createTtsProvider(): TTSProvider {
  const provider = getProviderName('tts');
  switch (provider) {
    case 'openrouter':
      return new OpenRouterTtsProvider(process.env.OPENROUTER_API_KEY, process.env.TTS_MODEL);
    case 'openai':
      return new OpenAiTtsProvider(process.env.OPENAI_API_KEY);
    default:
      return new MockTtsProvider();
  }
}

export function createChatProvider(): ChatModelProvider {
  const provider = getProviderName('roleplay');
  switch (provider) {
    case 'openrouter':
      return new OpenRouterChatProvider(process.env.OPENROUTER_API_KEY, process.env.ROLEPLAY_MODEL);
    case 'openai':
      return new OpenAiChatProvider(process.env.OPENAI_API_KEY);
    case 'groq':
      return new OpenRouterChatProvider(process.env.GROQ_API_KEY, process.env.ROLEPLAY_MODEL ?? 'groq/llama-3.1-8b-instant');
    default:
      return new MockChatProvider();
  }
}
