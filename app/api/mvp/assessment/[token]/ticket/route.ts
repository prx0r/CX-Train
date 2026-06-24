import { NextRequest, NextResponse } from 'next/server';
import { getDb, initTables } from '@/lib/mvp/db';
import { getAssessmentByToken, getSessionByAssessment, makeId } from '@/lib/mvp/query';

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

    return NextResponse.json({ status: 'completed', message: 'Ticket submitted' });
  } catch (err) {
    console.error('[MVP] Ticket error:', err);
    return NextResponse.json({ error: 'Failed to submit ticket' }, { status: 500 });
  }
}
