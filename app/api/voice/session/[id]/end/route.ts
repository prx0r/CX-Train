import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSessionStatus, getHistory } from '@/lib/voice/session';
import { createServerClient } from '@/lib/supabase';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const voiceSession = getSession(id);
    if (!voiceSession) return NextResponse.json({ error: 'Voice session not found' }, { status: 404 });

    const history = getHistory(id);
    const transcriptText = history.map((t) => `${t.speaker === 'candidate' ? 'Candidate' : 'Caller'}: ${t.text}`).join('\n');

    const supabase = createServerClient();

    // Store raw transcript in the assessment session
    await supabase.from('sessions').update({
      transcript_text: transcriptText,
      conversation_transcript: transcriptText,
      transcript_json: history.map((t) => ({ speaker: t.speaker === 'candidate' ? 'candidate' : 'caller', text: t.text })),
    }).eq('id', voiceSession.assessmentSessionId);

    // Store voice transcript record
    const { data: transcriptRecord } = await supabase.from('assessment_call_transcripts').insert({
      assessment_session_id: voiceSession.assessmentSessionId,
      candidate_id: '',  // populated from invite context
      scenario_id: voiceSession.scenarioId,
      raw_transcript: transcriptText,
      source: 'web_voice',
      transcript_version: 1,
    }).select('id').single();

    if (transcriptRecord?.id) {
      for (const turn of history) {
        await supabase.from('assessment_call_turns').insert({
          transcript_id: transcriptRecord.id,
          turn_index: turn.turnIndex,
          speaker: turn.speaker === 'candidate' ? 'candidate' : 'caller',
          text: turn.text,
        });
      }
    }

    updateSessionStatus(id, 'ticket_writing');

    return NextResponse.json({
      ended: true,
      sessionId: id,
      assessmentSessionId: voiceSession.assessmentSessionId,
      turnCount: history.length,
      transcriptText,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
