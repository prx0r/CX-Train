import { NextRequest, NextResponse } from 'next/server';
import { getDb, initTables } from '@/lib/mvp/db';
import { getAssessmentByToken, getSessionByAssessment, makeId } from '@/lib/mvp/query';
import { insertSimEvent } from '@/lib/mvp/sim/eventLog';
import { appendSessionEvent } from '@/lib/mvp/events/eventLog';
import { getCapabilitiesForType } from '@/lib/mvp/assignment-types';

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    initTables();

    const assessment = getAssessmentByToken(params.token);
    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const session = getSessionByAssessment(assessment.id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const body = await request.json();
    const ticketText = (body.ticket || '').trim();
    const uncertainties = (body.uncertainties || '').trim();
    if (!ticketText && !uncertainties) {
      return NextResponse.json({ error: 'Ticket text or uncertainties required' }, { status: 400 });
    }

    const db = getDb();
    db.prepare(`INSERT INTO tickets (id, session_id, candidate_ticket_text, created_at)
      VALUES (?, ?, ?, datetime('now'))`).run(makeId(), session.id, ticketText);
    db.prepare('UPDATE assessments SET status = ? WHERE id = ?').run('completed', assessment.id);

    if (uncertainties) {
      appendSessionEvent({
        assessment_id: assessment.id,
        session_id: session.id,
        event_type: 'candidate_uncertainties',
        actor: 'candidate',
        text: uncertainties,
        payload: { uncertainties },
        started_at_ms: Date.now(),
      });
    }

    appendSessionEvent({
      assessment_id: assessment.id,
      session_id: session.id,
      event_type: 'ticket_submitted',
      actor: 'candidate',
      text: ticketText,
      payload: { ticket_text: ticketText, uncertainties },
      started_at_ms: Date.now(),
    });

    appendSessionEvent({
      assessment_id: assessment.id,
      session_id: session.id,
      event_type: 'assessment_completed',
      actor: 'system',
      label: 'Assessment completed',
      started_at_ms: Date.now() + 50,
    });

    const assignmentType = (assessment as any).assignment_type || ((assessment as any).assessment_mode === 'dashboard_sim' ? 'training_drill' : 'hiring_exam');
    const capabilities = getCapabilitiesForType(assignmentType);
    if (capabilities?.remoteDesktop || (assessment as any).assessment_mode === 'dashboard_sim') {
      const simSession = db.prepare('SELECT id, current_state_json FROM sim_sessions WHERE session_id = ?').get(session.id) as any;
      if (simSession) {
        const currentState = JSON.parse(simSession.current_state_json);
        currentState.phase = 'submitted';
        db.prepare('UPDATE sim_sessions SET current_state_json = ?, completed_at = datetime(\'now\'), final_state_json = ? WHERE id = ?').run(
          JSON.stringify(currentState), JSON.stringify(currentState), simSession.id
        );

        insertSimEvent({
          session_id: session.id,
          assessment_id: assessment.id,
          assessment_pack_id: (assessment as any).assessment_pack_id,
          event_type: 'sim_completed',
          actor: 'system',
          label: 'Simulation completed',
          state_after: currentState,
          started_at_ms: Date.now(),
        });
      }
    }

    /* Trigger AI analysis with timeout + background fallback */
    let analysisResults = null;
    let candidateAnalysis = null;
    let analysisPending = false;
    try {
      const { runAnalysisWithTimeout } = await import('@/lib/mvp/analysis/jobs');
      const { buildCandidateAnalysis } = await import('@/lib/mvp/analysis/runBaseCallumAnalysis');
      const result = await runAnalysisWithTimeout(assessment.id);

      if (result.status === 'completed') {
        analysisResults = result.analysis;

        if (analysisResults.status === 'analysed') {
          const { getPackById } = await import('@/lib/mvp/sim/packRegistry');
          let pack = null;
          try {
            const packId = (assessment as any).assessment_pack_id;
            if (packId) pack = getPackById(packId);
          } catch {}
          candidateAnalysis = buildCandidateAnalysis(analysisResults, pack);

          /* Normalize scores into skill/criterion tables */
          try {
            const { normalizeAnalysisScores } = await import('@/lib/mvp/analysis/normalize-scores');
            normalizeAnalysisScores(assessment.id, analysisResults);
          } catch (normErr) {
            console.error('[MVP] Score normalization error (non-fatal):', normErr);
          }
        }
      } else if (result.status === 'pending') {
        analysisPending = true;
      }
    } catch (analyseErr) {
      console.error('[MVP] Auto-analysis error:', analyseErr);
      analysisPending = true;
    }

    if (analysisPending && !analysisResults) {
      return NextResponse.json({
        status: 'completed',
        message: 'Ticket submitted',
        analysis_pending: true,
        analysis_status: 'Analysis queued for background processing',
      });
    }

    return NextResponse.json({
      status: 'completed',
      message: 'Ticket submitted',
      analysis: analysisResults ? {
        status: analysisResults.status,
        overall_score: analysisResults.overall_score,
        readiness_label: analysisResults.readiness_label,
        summary: analysisResults.summary,
        strengths: analysisResults.strengths,
        weaknesses: analysisResults.weaknesses,
        checkpoints: analysisResults.checkpoints,
        error: analysisResults.error,
      } : null,
      candidate_analysis: candidateAnalysis,
    });
  } catch (err) {
    console.error('[MVP] Ticket error:', err);
    return NextResponse.json({ error: 'Failed to submit ticket' }, { status: 500 });
  }
}
