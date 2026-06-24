import { NextRequest, NextResponse } from 'next/server';
import { getDb, seedDefaults, initTables } from '@/lib/mvp/db';
import { makeId, getActiveScenario, getActiveCriteria } from '@/lib/mvp/query';

export async function POST(request: NextRequest) {
  try {
    initTables();
    seedDefaults();

    const body = await request.json();
    const candidateName = body.candidate_name || 'Unnamed Candidate';
    const candidateEmail = body.candidate_email || null;

    const scenario = getActiveScenario();
    const criteria = getActiveCriteria();

    if (!scenario) {
      return NextResponse.json({ error: 'No active scenario found. Run mvp:init-db first.' }, { status: 500 });
    }

    const assessmentId = makeId();
    const sessionId = makeId();
    const inviteToken = makeId();

    const db = getDb();

    const title = `Call Readiness: ${candidateName}`;

    db.prepare(`INSERT INTO assessments (id, title, candidate_name, candidate_email, invite_token, status, scenario_id, criteria_version_id, created_at)
      VALUES (?, ?, ?, ?, ?, 'invited', ?, ?, datetime('now'))`).run(
      assessmentId, title, candidateName, candidateEmail, inviteToken, scenario.id, criteria?.id || null
    );

    db.prepare(`INSERT INTO sessions (id, assessment_id, status, started_at)
      VALUES (?, ?, 'in_progress', datetime('now'))`).run(sessionId, assessmentId);

    db.prepare(`INSERT INTO messages (id, session_id, role, content, created_at)
      VALUES (?, ?, 'caller', ?, datetime('now'))`).run(makeId(), sessionId, scenario.initial_message);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    return NextResponse.json({
      assessment_id: assessmentId,
      session_id: sessionId,
      invite_url: `${baseUrl}/mvp/assessment/${inviteToken}`,
      invite_token: inviteToken,
    });
  } catch (err) {
    console.error('[MVP] Create assessment error:', err);
    return NextResponse.json({ error: 'Failed to create assessment' }, { status: 500 });
  }
}

export async function GET() {
  try {
    initTables();
    const { getAllAssessments } = await import('@/lib/mvp/query');
    const assessments = getAllAssessments();
    return NextResponse.json({ assessments });
  } catch (err) {
    console.error('[MVP] List assessments error:', err);
    return NextResponse.json({ error: 'Failed to list assessments' }, { status: 500 });
  }
}
