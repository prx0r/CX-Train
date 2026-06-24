import { NextRequest, NextResponse } from 'next/server';
import { getDb, initTables } from '@/lib/mvp/db';
import { getAssessmentByToken, getSessionByAssessment } from '@/lib/mvp/query';

export async function POST(
  _request: NextRequest,
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

    const db = getDb();
    db.prepare('UPDATE sessions SET status = ?, ended_at = datetime(\'now\') WHERE id = ?').run('completed', session.id);
    db.prepare('UPDATE assessments SET status = ? WHERE id = ?').run('completed', assessment.id);

    return NextResponse.json({ status: 'completed', session_id: session.id });
  } catch (err) {
    console.error('[MVP] End call error:', err);
    return NextResponse.json({ error: 'Failed to end call' }, { status: 500 });
  }
}
