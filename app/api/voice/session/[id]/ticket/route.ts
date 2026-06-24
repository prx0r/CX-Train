import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSessionStatus, getHistory } from '@/lib/voice/session';
import { calculateWeightedScore, scoreTicketWithPatterns } from '@/lib/evaluation/scoring';
import { getRubric } from '@/lib/evaluation/scenarios';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const voiceSession = getSession(id);
    if (!voiceSession) return NextResponse.json({ error: 'Voice session not found' }, { status: 404 });

    const body = await request.json();
    const ticket = String(body.ticket || '').trim();
    if (ticket.length < 30) return NextResponse.json({ error: 'A useful ticket is required (min 30 chars)' }, { status: 400 });

    const supabase = createServerClient();
    const { data: session } = await supabase.from('sessions')
      .select('id, transcript_text, scenarios(*)')
      .eq('id', voiceSession.assessmentSessionId)
      .single();
    if (!session) return NextResponse.json({ error: 'Assessment session not found' }, { status: 404 });

    const scenario = Array.isArray(session.scenarios) ? session.scenarios[0] : session.scenarios;
    const history = getHistory(id);
    const transcriptText = history.map((t) => `${t.speaker === 'candidate' ? 'Candidate' : 'Caller'}: ${t.text}`).join('\n');
    const rubric = getRubric(scenario?.title ?? '', scenario?.rubric ?? []);

    // Score ticket
    const ticketResult = scoreTicketWithPatterns(ticket, transcriptText);

    // Use mock evaluation (no LLM call for now — evaluator runs async)
    const mockCheckpoints = rubric.map((r) => ({
      checkpointKey: r.key,
      status: history.some((t) => t.text.toLowerCase().includes(r.key.replace(/^(ask_|capture_|confirm_|check_)/, '').replace(/_/g, ' ')))
        ? 'observed' as const : 'missed' as const,
      evidenceQuote: null,
      turnIndex: null,
      reason: '',
      confidence: 0.8,
    }));

    const mockEvaluation = {
      callSummary: `Voice call completed — ${history.length} turns, ${voiceSession.scenarioTitle}`,
      checkpointEvidence: mockCheckpoints,
      skillLabels: [],
      riskLabels: [],
      scenarioLabels: [voiceSession.scenarioTitle.toLowerCase().includes('password') ? 'password_reset'
        : voiceSession.scenarioTitle.toLowerCase().includes('outlook') ? 'outlook'
        : voiceSession.scenarioTitle.toLowerCase().includes('printer') ? 'printer' : 'email'],
      dataQualityLabels: ['usable_for_training'],
      coachingNotes: [],
    };

    const scoringResult = calculateWeightedScore(rubric, mockEvaluation, ticketResult.score);

    // Save to assessment session
    await supabase.from('sessions').update({
      candidate_ticket_text: ticket,
      transcript_text: transcriptText,
      conversation_transcript: transcriptText,
      ticket_assessed: true,
      ticket_score: ticketResult,
      score: scoringResult.callScore,
      score_breakdown: {
        call_score: scoringResult.callScore,
        ticket_score: scoringResult.ticketScore,
        final_score: scoringResult.finalScore,
        missed: scoringResult.missedPenalties,
        risk_penalties: scoringResult.riskPenalties,
      },
      readiness_score: scoringResult.finalScore,
      readiness_label: scoringResult.readinessLabel,
    }).eq('id', voiceSession.assessmentSessionId);

    // Store evaluation
    const { data: transcriptRecord } = await supabase.from('assessment_call_transcripts')
      .select('id').eq('assessment_session_id', voiceSession.assessmentSessionId).limit(1).single();
    if (transcriptRecord?.id) {
      const { data: evalRecord } = await supabase.from('assessment_call_evaluations').insert({
        transcript_id: transcriptRecord.id,
        evaluator_model: 'mock',
        evaluator_prompt_version: '1.0.0',
        rubric_version: '1.0.0',
        raw_ai_output_json: mockEvaluation,
        validated: true,
        final_call_score: scoringResult.callScore,
        final_ticket_score: scoringResult.ticketScore,
        final_readiness_score: scoringResult.finalScore,
        readiness_label: scoringResult.readinessLabel,
      }).select('id').single();

      if (evalRecord?.id) {
        for (const ev of mockCheckpoints) {
          await supabase.from('assessment_evidence').insert({
            evaluation_id: evalRecord.id,
            assessment_session_id: voiceSession.assessmentSessionId,
            checkpoint_key: ev.checkpointKey,
            status: ev.status,
            evidence_quote: ev.evidenceQuote,
            turn_index: ev.turnIndex,
            reason: ev.reason,
            confidence: ev.confidence,
          });
        }

        // Store outcome label
        await supabase.from('assessment_labels').insert({
          assessment_session_id: voiceSession.assessmentSessionId,
          transcript_id: transcriptRecord.id,
          label_type: 'outcome',
          label_key: scoringResult.readinessLabel,
          confidence: 0.85,
          source: 'system',
        });
      }
    }

    // Check if assessment is complete
    const { count } = await supabase.from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('assessment_pack_id', voiceSession.assessmentSessionId)
      .not('candidate_ticket_text', 'is', null);
    const complete = (count ?? 0) >= 3;

    if (complete) {
      const { data: sessions } = await supabase.from('sessions')
        .select('readiness_score,score_breakdown,readiness_label')
        .eq('assessment_pack_id', voiceSession.assessmentSessionId);
      const average = Math.round((sessions ?? []).reduce((sum, s) => sum + (s.readiness_score ?? 0), 0) / Math.max(1, sessions?.length ?? 0));
      const labels = (sessions ?? []).map((s) => s.readiness_label).filter(Boolean);
      const worstLabel = labels.includes('not_ready') ? 'not_ready'
        : labels.includes('ready_with_supervision') ? 'ready_with_supervision' : 'ready_low_risk_calls';
      await supabase.from('assessment_packs').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        final_recommendation: worstLabel,
      }).eq('id', voiceSession.assessmentSessionId);
    }

    updateSessionStatus(id, 'completed');

    return NextResponse.json({
      saved: true,
      readinessLabel: scoringResult.readinessLabel,
      readinessScore: scoringResult.finalScore,
      ticketScore: ticketResult.score,
      callScore: scoringResult.callScore,
      complete,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
