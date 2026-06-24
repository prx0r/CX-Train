import { NextRequest, NextResponse } from 'next/server';
import { getInviteContext } from '@/lib/assessment-data';
import { getSession, addTurn, getHistory } from '@/lib/voice/session';
import { createSttProvider, createTtsProvider, createChatProvider, getProviderName } from '@/lib/voice/provider-factory';
import { createServerClient } from '@/lib/supabase';
import type { VoiceSessionConfig } from '@/lib/voice/providers';

const STT_PROVIDER = createSttProvider();
const TTS_PROVIDER = createTtsProvider();
const CLIENT_BRAIN = createChatProvider();
const STT_PROVIDER_NAME = getProviderName('stt');
const TTS_PROVIDER_NAME = getProviderName('tts');
const ROLEPLAY_PROVIDER_NAME = getProviderName('roleplay');

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const voiceSession = getSession(id);
    if (!voiceSession) return NextResponse.json({ error: 'Voice session not found' }, { status: 404 });
    if (voiceSession.status !== 'in_progress') return NextResponse.json({ error: 'Call is not active' }, { status: 409 });

    const body = await request.json();
    const audioBase64 = String(body.audio || '');
    const contentType = body.contentType || 'audio/wav';

    if (!audioBase64 && !body.text) return NextResponse.json({ error: 'Audio or text required' }, { status: 400 });

    let candidateText: string;
    let sttModel = 'mock';
    let sttConfidence: number | undefined;
    let audioDurationMs = 0;

    if (body.text) {
      candidateText = String(body.text);
    } else {
      const sttResult = await STT_PROVIDER.transcribe(audioBase64, contentType);
      candidateText = sttResult.text;
      sttModel = sttResult.model;
      sttConfidence = sttResult.confidence;
      audioDurationMs = sttResult.durationMs;
    }

    const candidateTurn = addTurn({
      sessionId: id, speaker: 'candidate', text: candidateText,
      audioDurationMs, sttProvider: STT_PROVIDER_NAME, sttModel, sttConfidence,
    });

    const supabase = createServerClient();
    const { data: session } = await supabase.from('sessions')
      .select('scenarios(*)')
      .eq('id', voiceSession.assessmentSessionId)
      .single();
    const scenario = Array.isArray(session?.scenarios) ? session.scenarios[0] : session?.scenarios;

    const config: VoiceSessionConfig = {
      scenarioId: scenario?.id ?? voiceSession.scenarioId,
      scenarioTitle: scenario?.title ?? voiceSession.scenarioTitle,
      hiddenFacts: (scenario?.hidden_facts ?? {}) as Record<string, unknown>,
      callerPersona: scenario?.caller_persona ?? 'Client with an IT issue',
      intensity: scenario?.intensity ?? 2,
    };

    const history = getHistory(id).map((t) => ({ speaker: t.speaker, text: t.text }));
    const brainResult = await CLIENT_BRAIN.nextClientTurn(config, history);

    const ttsResult = await TTS_PROVIDER.speak(brainResult.text);

    const clientTurn = addTurn({
      sessionId: id, speaker: 'client', text: brainResult.text,
      audioUrl: `data:audio/wav;base64,${ttsResult.audioBase64}`,
      audioDurationMs: ttsResult.durationMs,
      ttsProvider: TTS_PROVIDER_NAME,
      ttsModel: ttsResult.model,
      roleplayProvider: ROLEPLAY_PROVIDER_NAME,
      roleplayModel: brainResult.model,
      roleplayInputTokens: brainResult.inputTokens,
      roleplayOutputTokens: brainResult.outputTokens,
    });

    return NextResponse.json({
      turnIndex: clientTurn?.turnIndex,
      clientText: brainResult.text,
      clientAudio: `data:audio/wav;base64,${ttsResult.audioBase64}`,
      clientAudioDurationMs: ttsResult.durationMs,
      candidateText: candidateTurn?.text,
      sttModel,
      sttConfidence,
      llmModel: brainResult.model,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const voiceSession = getSession(id);
  if (!voiceSession) return NextResponse.json({ error: 'Voice session not found' }, { status: 404 });

  return NextResponse.json({
    sessionId: voiceSession.id,
    status: voiceSession.status,
    scenarioTitle: voiceSession.scenarioTitle,
    candidateName: voiceSession.candidateName,
    history: voiceSession.history,
    currentTurnIndex: voiceSession.currentTurnIndex,
    estimatedCostUsd: voiceSession.estimatedCostUsd,
    sttProvider: voiceSession.sttProvider,
    ttsProvider: voiceSession.ttsProvider,
    roleplayProvider: voiceSession.roleplayProvider,
    evaluationProvider: voiceSession.evaluationProvider,
  });
}
