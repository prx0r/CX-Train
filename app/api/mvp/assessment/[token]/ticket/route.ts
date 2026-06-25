import { NextRequest, NextResponse } from 'next/server';
import { getDb, initTables } from '@/lib/mvp/db';
import { getAssessmentByToken, getSessionByAssessment, makeId, getAssessmentPack } from '@/lib/mvp/query';
import { insertSimEvent, getSimEvents } from '@/lib/mvp/sim/eventLog';
import { appendSessionEvent } from '@/lib/mvp/events/eventLog';

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
    if (!ticketText) {
      return NextResponse.json({ error: 'Ticket text is required' }, { status: 400 });
    }

    const db = getDb();
    db.prepare(`INSERT INTO tickets (id, session_id, candidate_ticket_text, created_at)
      VALUES (?, ?, ?, datetime('now'))`).run(makeId(), session.id, ticketText);
    db.prepare('UPDATE assessments SET status = ? WHERE id = ?').run('completed', assessment.id);

    // Write unified session_events
    appendSessionEvent({
      assessment_id: assessment.id,
      session_id: session.id,
      event_type: 'ticket_submitted',
      actor: 'candidate',
      text: ticketText,
      payload: { ticket_text: ticketText },
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

    // Complete sim_session for dashboard_sim
    const assessmentMode = (assessment as any).assessment_mode || 'chat_call';
    if (assessmentMode === 'dashboard_sim') {
      const simSession = db.prepare('SELECT id, current_state_json FROM sim_sessions WHERE session_id = ?').get(session.id) as any;
      if (simSession) {
        const currentState = JSON.parse(simSession.current_state_json);
        currentState.ticket_note_submitted = true;
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

    return NextResponse.json({ status: 'completed', message: 'Ticket submitted' });
  } catch (err) {
    console.error('[MVP] Ticket error:', err);
    return NextResponse.json({ error: 'Failed to submit ticket' }, { status: 500 });
  }
}
