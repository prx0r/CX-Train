import type { RubricItem, EvaluationOutput } from '../types';

export interface STTProvider {
  transcribe(audioBase64: string, contentType: string): Promise<SttResult>;
}

export interface TTSProvider {
  speak(text: string, voiceId?: string): Promise<TtsResult>;
}

export interface ChatModelProvider {
  nextClientTurn(config: VoiceSessionConfig, history: { speaker: string; text: string }[]): Promise<ChatResult>;
}

export interface EvaluatorProvider {
  evaluate(params: {
    scenarioTitle: string;
    scenarioDescription: string;
    hiddenFacts: Record<string, unknown>;
    requiredCheckpoints: Record<string, boolean>;
    rubric: RubricItem[];
    transcript: string;
    turns: { speaker: string; text: string; turnIndex: number }[];
    ticket: string;
  }): Promise<EvaluationProviderResult>;
}

export interface SttResult {
  text: string;
  confidence?: number;
  durationMs: number;
  model: string;
  provider?: string;
}

export interface TtsResult {
  audioBase64: string;
  durationMs: number;
  model: string;
}

export interface ChatResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface EvaluationProviderResult {
  output: EvaluationOutput;
  rawJson: string;
  model: string;
  valid: boolean;
  errors: string[];
}

export interface VoiceSessionConfig {
  scenarioId: string;
  scenarioTitle: string;
  hiddenFacts: Record<string, unknown>;
  callerPersona: string;
  intensity: number;
}

export interface VoiceTurnMetadata {
  id: string;
  sessionId: string;
  turnIndex: number;
  speaker: 'candidate' | 'client';
  text: string;
  audioUrl?: string;
  audioDurationMs?: number;
  sttProvider?: string;
  sttModel?: string;
  sttConfidence?: number;
  ttsProvider?: string;
  ttsModel?: string;
  roleplayProvider?: string;
  roleplayModel?: string;
  roleplayInputTokens?: number;
  roleplayOutputTokens?: number;
  createdAt: string;
}

export interface VoiceSession {
  id: string;
  assessmentSessionId: string;
  inviteToken: string;
  scenarioId: string;
  scenarioTitle: string;
  candidateName: string;
  status: 'in_progress' | 'ended' | 'ticket_writing' | 'completed';
  currentTurnIndex: number;
  history: VoiceTurnMetadata[];
  sttProvider: string;
  ttsProvider: string;
  roleplayProvider: string;
  sttSeconds: number;
  ttsSeconds: number;
  llmInputTokens: number;
  llmOutputTokens: number;
  evaluationTokens: number;
  evaluationProvider: string;
  estimatedCostUsd: number;
  startedAt: string;
  endedAt?: string;
}

export type TtsProviderName = 'fixture' | 'kokoro' | 'openrouter' | 'openai';
export type SttProviderName = 'fixture' | 'vosk' | 'sherpa' | 'whisper_cpp' | 'openrouter' | 'groq';

export const DEFAULT_TTS_VOICE = 'af_heart';
export const MAX_TTS_TEXT_LENGTH = 1000;
export const MAX_AUDIO_SIZE_BYTES = 8 * 1024 * 1024;

export const VOICE_PROVIDER_COSTS: Record<string, { sttPerSecond: number; ttsPerSecond: number; llmPerInputToken: number; llmPerOutputToken: number }> = {
  openrouter: { sttPerSecond: 0.000011, ttsPerSecond: 0.000000172, llmPerInputToken: 0.00000005, llmPerOutputToken: 0.00000008 },
  groq: { sttPerSecond: 0.000011, ttsPerSecond: 0, llmPerInputToken: 0.0000001, llmPerOutputToken: 0.0000004 },
  openai: { sttPerSecond: 0.006, ttsPerSecond: 0.015, llmPerInputToken: 0.0000025, llmPerOutputToken: 0.00001 },
  chutes: { sttPerSecond: 0, ttsPerSecond: 0.0005, llmPerInputToken: 0, llmPerOutputToken: 0 },
  kokoro: { sttPerSecond: 0, ttsPerSecond: 0, llmPerInputToken: 0, llmPerOutputToken: 0 },
  vosk: { sttPerSecond: 0, ttsPerSecond: 0, llmPerInputToken: 0, llmPerOutputToken: 0 },
  whisper_cpp: { sttPerSecond: 0, ttsPerSecond: 0, llmPerInputToken: 0, llmPerOutputToken: 0 },
  fixture: { sttPerSecond: 0, ttsPerSecond: 0, llmPerInputToken: 0, llmPerOutputToken: 0 },
  mock: { sttPerSecond: 0, ttsPerSecond: 0, llmPerInputToken: 0, llmPerOutputToken: 0 },
};
