import type { VoiceSession, VoiceTurnMetadata } from './providers';
import { estimateCost } from './cost-tracker';
import { getProviderName } from './provider-factory';

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
    sttProvider: getProviderName('stt'),
    ttsProvider: getProviderName('tts'),
    roleplayProvider: getProviderName('roleplay'),
    sttSeconds: 0,
    ttsSeconds: 0,
    llmInputTokens: 0,
    llmOutputTokens: 0,
    evaluationTokens: 0,
    evaluationProvider: getProviderName('evaluator'),
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
  sttProvider?: string;
  sttModel?: string;
  sttConfidence?: number;
  ttsProvider?: string;
  ttsModel?: string;
  roleplayProvider?: string;
  roleplayModel?: string;
  roleplayInputTokens?: number;
  roleplayOutputTokens?: number;
}): VoiceTurnMetadata | null {
  const session = MOCK_STORE.get(params.sessionId);
  if (!session) return null;

  const turn: VoiceTurnMetadata = {
    id: generateId(),
    sessionId: params.sessionId,
    turnIndex: session.currentTurnIndex + 1,
    speaker: params.speaker,
    text: params.text,
    audioUrl: params.audioUrl,
    audioDurationMs: params.audioDurationMs,
    sttProvider: params.sttProvider,
    sttModel: params.sttModel,
    sttConfidence: params.sttConfidence,
    ttsProvider: params.ttsProvider,
    ttsModel: params.ttsModel,
    roleplayProvider: params.roleplayProvider,
    roleplayModel: params.roleplayModel,
    roleplayInputTokens: params.roleplayInputTokens,
    roleplayOutputTokens: params.roleplayOutputTokens,
    createdAt: new Date().toISOString(),
  };

  session.history.push(turn);
  session.currentTurnIndex = turn.turnIndex;

  if (params.audioDurationMs) {
    if (params.speaker === 'candidate') {
      session.sttSeconds += Math.ceil(params.audioDurationMs / 1000);
    } else {
      session.ttsSeconds += Math.ceil(params.audioDurationMs / 1000);
    }
  }
  session.llmInputTokens += params.roleplayInputTokens ?? 0;
  session.llmOutputTokens += params.roleplayOutputTokens ?? 0;

  session.estimatedCostUsd = estimateCost(session);
  return turn;
}

export function updateSessionStatus(id: string, status: VoiceSession['status']): boolean {
  const session = MOCK_STORE.get(id);
  if (!session) return false;
  session.status = status;
  if (status === 'ended' || status === 'completed') session.endedAt = new Date().toISOString();
  return true;
}

export function getHistory(id: string): VoiceTurnMetadata[] {
  return MOCK_STORE.get(id)?.history ?? [];
}
