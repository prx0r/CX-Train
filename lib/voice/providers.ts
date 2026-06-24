import type { SttResult, TtsResult, ClientBrainResult, VoiceSessionConfig } from './types';

export interface STTProvider {
  transcribe(audioBase64: string, contentType: string): Promise<SttResult>;
}

export interface TTSProvider {
  speak(text: string, voiceId?: string): Promise<TtsResult>;
}

export interface ClientBrainProvider {
  nextClientTurn(config: VoiceSessionConfig, history: { speaker: string; text: string }[]): Promise<ClientBrainResult>;
}

export interface EvaluatorProvider {
  evaluate(transcript: string, ticket: string, scenarioId: string): Promise<{ readinessLabel: string; readinessScore: number; summary: string }>;
}

export const VOICE_PROVIDER_COSTS: Record<string, { sttPerSecond: number; ttsPerSecond: number; llmPerInputToken: number; llmPerOutputToken: number }> = {
  groq: { sttPerSecond: 0, ttsPerSecond: 0, llmPerInputToken: 0.0000001, llmPerOutputToken: 0.0000004 },
  openai: { sttPerSecond: 0.006, ttsPerSecond: 0.015, llmPerInputToken: 0.0000025, llmPerOutputToken: 0.00001 },
  chutes: { sttPerSecond: 0, ttsPerSecond: 0, llmPerInputToken: 0, llmPerOutputToken: 0 },
  mock: { sttPerSecond: 0, ttsPerSecond: 0, llmPerInputToken: 0, llmPerOutputToken: 0 },
};
