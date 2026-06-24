import type { VoiceSession, VoiceTurn } from './types';
import { estimateCost } from './cost-tracker';

const MOCK_STORE = new Map<string, VoiceSession>();

function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createSession(params: {
  assessmentSessionId: string;
  inviteToken: string;
  scenarioId: string;
  scenarioTitle: string;
  candidateName: string;
}): VoiceSession {
  const session: VoiceSession = {
    id: generateId(),
    assessmentSessionId: params.assessmentSessionId,
    inviteToken: params.inviteToken,
    scenarioId: params.scenarioId,
    scenarioTitle: params.scenarioTitle,
    candidateName: params.candidateName,
    status: 'in_progress',
    currentTurnIndex: 0,
    history: [],
    sttSeconds: 0,
    ttsSeconds: 0,
    llmInputTokens: 0,
    llmOutputTokens: 0,
    evaluationTokens: 0,
    estimatedCostUsd: 0,
    startedAt: new Date().toISOString(),
  };
  MOCK_STORE.set(session.id, session);
  return session;
}

export function getSession(id: string): VoiceSession | undefined {
  return MOCK_STORE.get(id);
}

export function addTurn(params: {
  sessionId: string;
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
}): VoiceTurn | null {
  const session = MOCK_STORE.get(params.sessionId);
  if (!session) return null;

  const turn: VoiceTurn = {
    id: generateId(),
    sessionId: params.sessionId,
    turnIndex: session.currentTurnIndex + 1,
    speaker: params.speaker,
    text: params.text,
    audioUrl: params.audioUrl,
    audioDurationMs: params.audioDurationMs,
    sttModel: params.sttModel,
    sttConfidence: params.sttConfidence,
    ttsModel: params.ttsModel,
    llmModel: params.llmModel,
    llmInputTokens: params.llmInputTokens,
    llmOutputTokens: params.llmOutputTokens,
    createdAt: new Date().toISOString(),
  };

  session.history.push(turn);
  session.currentTurnIndex = turn.turnIndex;

  if (params.sttModel?.startsWith('groq') || params.sttModel === 'mock') {
    session.sttSeconds += Math.ceil((params.audioDurationMs ?? 0) / 1000);
  }
  if (params.ttsModel) {
    session.ttsSeconds += Math.ceil((params.audioDurationMs ?? 0) / 1000);
  }
  session.llmInputTokens += params.llmInputTokens ?? 0;
  session.llmOutputTokens += params.llmOutputTokens ?? 0;

  const provider = params.sttModel?.startsWith('groq') ? 'groq'
    : params.sttModel === 'mock' ? 'mock' : 'openai';
  session.estimatedCostUsd = estimateCost(provider, session.sttSeconds, session.ttsSeconds, session.llmInputTokens, session.llmOutputTokens, 0);

  return turn;
}

export function updateSessionStatus(id: string, status: VoiceSession['status']): boolean {
  const session = MOCK_STORE.get(id);
  if (!session) return false;
  session.status = status;
  if (status === 'ended' || status === 'completed') session.endedAt = new Date().toISOString();
  return true;
}

export function getHistory(id: string): VoiceTurn[] {
  return MOCK_STORE.get(id)?.history ?? [];
}
