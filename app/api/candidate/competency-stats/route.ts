import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/mvp/db';
import { headers } from 'next/headers';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.id !== userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const db = getDb();
  const stats = db.prepare(`
    SELECT ccs.competency_id, c.name as competency_name, c.category,
           ccs.attempts_count, ccs.best_score, ccs.average_score, ccs.latest_score,
           ccs.last_attempt_at
    FROM candidate_competency_stats ccs
    JOIN competencies c ON c.id = ccs.competency_id
    WHERE ccs.user_id = ?
    ORDER BY ccs.latest_score DESC
  `).all(userId);

  return NextResponse.json({ stats });
}
