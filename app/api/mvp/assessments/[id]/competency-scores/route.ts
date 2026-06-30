import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mvp/db';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

/**
 * Report-safe competency scores route.
 * Accessible via:
 *   1. Assessment token (shared report link)
 *   2. Signed-in candidate who owns the attempt
 *   3. Signed-in manager
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const assessmentId = params.id;
  const db = getDb();

  const assessment = db.prepare(
    'SELECT candidate_user_id, invite_token FROM assessments WHERE id = ?'
  ).get(assessmentId) as { candidate_user_id: string | null; invite_token: string } | undefined;

  if (!assessment) {
    return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
  }

  /* Check access: token in query param, or auth session */
  const { searchParams } = new URL(_request.url);
  const token = searchParams.get('token');
  let authorized = token === assessment.invite_token;

  if (!authorized) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session) {
      authorized = session.user.id === assessment.candidate_user_id;
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const scores = db.prepare(`
    SELECT acs.competency_id, c.name as competency_name, c.category,
           acs.raw_score, acs.normalized_score, acs.max_score,
           acs.evidence_count, acs.missed_count
    FROM attempt_competency_scores acs
    JOIN competencies c ON c.id = acs.competency_id
    WHERE acs.attempt_id = ?
    ORDER BY acs.normalized_score DESC
  `).all(assessmentId);

  return NextResponse.json({ scores });
}
