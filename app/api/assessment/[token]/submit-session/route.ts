import { NextResponse } from 'next/server';
import { getInviteContext } from '@/lib/assessment-data';
import { extractAssessmentEvidence } from '@/lib/assessment-ai';
import { calculateCheckpointScore } from '@/lib/assessment-scoring';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const context = await getInviteContext(token);
  if ('error' in context) return NextResponse.json({ error: context.error === 'expired' ? 'Invite expired' : 'Invite not found' }, { status: context.error === 'expired' ? 410 : 404 });

  const body = await request.json();
  const sessionId = String(body.session_id || '');
  const transcriptText = String(body.transcript_text || '').trim();
  const transcriptJson = Array.isArray(body.transcript_json) ? body.transcript_json : [];
  if (!sessionId || transcriptText.length < 40) return NextResponse.json({ error: 'A complete call transcript is required' }, { status: 400 });

  const supabase = createServerClient();
  const { data: session } = await supabase
    .from('sessions')
    .select('id, scenario_id, transcript_text, scenarios(required_checkpoints)')
    .eq('id', sessionId)
    .eq('assessment_pack_id', context.pack.id)
    .eq('tenant_id', context.pack.tenant_id)
    .single();
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  if (session.transcript_text) return NextResponse.json({ error: 'Call has already been submitted' }, { status: 409 });

  const scenario = Array.isArray(session.scenarios) ? session.scenarios[0] : session.scenarios;
  const required = (scenario?.required_checkpoints ?? {}) as Record<string, boolean>;
  const extracted = await extractAssessmentEvidence(transcriptText, required);
  const checkpointResults = extracted?.checkpoint_results;
  if (!checkpointResults) return NextResponse.json({ error: 'Unable to evaluate transcript; please try again' }, { status: 503 });
  const scored = calculateCheckpointScore(required, checkpointResults);
  const feedback = extracted?.feedback_text || String(body.feedback_text || '') || `${scored.missed.length} required checkpoints missed.`;

  const { error } = await supabase.from('sessions').update({
    transcript_json: transcriptJson,
    transcript_text: transcriptText,
    conversation_transcript: transcriptText,
    checkpoints: checkpointResults,
    rubric_evidence: checkpointResults,
    score: scored.score,
    score_breakdown: { call_score: scored.score, missed: scored.missed, critical_misses: scored.criticalMisses },
    readiness_score: scored.score,
    feedback_text: feedback,
  }).eq('id', session.id).eq('assessment_pack_id', context.pack.id);
  if (error) return NextResponse.json({ error: 'Unable to save call' }, { status: 500 });
  return NextResponse.json({ success: true, call_score: scored.score, step: 'ticket' });
}
