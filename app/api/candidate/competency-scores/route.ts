import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/mvp/db';
import { headers } from 'next/headers';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const attemptId = searchParams.get('attemptId');
  if (!attemptId) return NextResponse.json({ error: 'Missing attemptId' }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const db = getDb();
  const scores = db.prepare(`
    SELECT acs.competency_id, c.name as competency_name, c.category,
           acs.raw_score, acs.normalized_score, acs.max_score,
           acs.evidence_count, acs.missed_count
    FROM attempt_competency_scores acs
    JOIN competencies c ON c.id = acs.competency_id
    WHERE acs.attempt_id = ?
    ORDER BY acs.normalized_score DESC
  `).all(attemptId);

  return NextResponse.json({ scores });
}
