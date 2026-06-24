export interface VoiceTurn {
  id: string;
  sessionId: string;
  turnIndex: number;
  speaker: 'candidate' | 'client';
  text: string;
  audioUrl?: string;
  audioDurationMs?: number;
  sttModel?: string;
  sttConfidence?: number;
  ttsModel?: string;
  llmModel?: string;
  llmInputTokens?: number;
  llmOutputTokens?: number;
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
  history: VoiceTurn[];
  sttSeconds: number;
  ttsSeconds: number;
  llmInputTokens: number;
  llmOutputTokens: number;
  evaluationTokens: number;
  estimatedCostUsd: number;
  startedAt: string;
  endedAt?: string;
}

export interface SttResult {
  text: string;
  confidence?: number;
  durationMs: number;
  model: string;
}

export interface TtsResult {
  audioBase64: string;
  durationMs: number;
  model: string;
}

export interface ClientBrainResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  labels?: string[];
}

export interface VoiceSessionConfig {
  scenarioId: string;
  scenarioTitle: string;
  hiddenFacts: Record<string, unknown>;
  callerPersona: string;
  intensity: number;
}
