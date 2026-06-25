import { NextRequest, NextResponse } from 'next/server';
import { getDb, seedDefaults, initTables } from '@/lib/mvp/db';
import { makeId, getActiveScenario, getActiveCriteria, getManagerStandards, getAssessmentPack } from '@/lib/mvp/query';
import { insertSimEvent } from '@/lib/mvp/sim/eventLog';
import { appendSessionEvent } from '@/lib/mvp/events/eventLog';

export async function POST(request: NextRequest) {
  try {
    initTables();
    seedDefaults();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'http://localhost:3000';

    const body = await request.json();
    const candidateName = body.candidate_name || 'Unnamed Candidate';
    const candidateEmail = body.candidate_email || null;
    const managerProfileId = body.manager_profile_id || 'manager-default-v1';
    const assessmentMode = body.assessment_mode || 'chat_call';
    const assessmentPackId = body.assessment_pack_id || null;

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

    // Load pack if dashboard_sim
    let pack = null;
    if (assessmentMode === 'dashboard_sim') {
      pack = getAssessmentPack(assessmentPackId);
      if (!pack) {
        return NextResponse.json({ error: 'assessment_pack_id required for dashboard_sim mode' }, { status: 400 });
      }
    }

    // Snapshot current standards
    const standards = getManagerStandards();
    const standardsSnapshot = standards ? {
      id: standards.id,
      required_ticket_fields: JSON.parse(standards.required_ticket_fields_json || '[]'),
      call_requirements: standards.call_requirements,
      escalation_requirements: standards.escalation_requirements,
      good_ticket_example: standards.good_ticket_example,
      bad_ticket_example: standards.bad_ticket_example,
    } : null;

    db.prepare(`INSERT INTO assessments (id, title, candidate_name, candidate_email, invite_token, status, scenario_id, criteria_version_id, manager_profile_id, standards_snapshot_json, assessment_pack_id, assessment_mode, created_at)
      VALUES (?, ?, ?, ?, ?, 'invited', ?, ?, ?, ?, ?, ?, datetime('now'))`).run(
      assessmentId, title, candidateName, candidateEmail, inviteToken, scenario.id, criteria?.id || null,
      managerProfileId, standardsSnapshot ? JSON.stringify(standardsSnapshot) : null,
      assessmentPackId, assessmentMode
    );

    db.prepare(`INSERT INTO sessions (id, assessment_id, status, started_at)
      VALUES (?, ?, 'in_progress', datetime('now'))`).run(sessionId, assessmentId);

    db.prepare(`INSERT INTO messages (id, session_id, role, content, created_at)
      VALUES (?, ?, 'caller', ?, datetime('now'))`).run(makeId(), sessionId, scenario.initial_message);

    // Create sim_session for dashboard_sim
    if (assessmentMode === 'dashboard_sim' && pack) {
      const simConfig = pack.sim_config_json ? JSON.parse(pack.sim_config_json) : null;
      const initialState = pack.sim_initial_state_json ? JSON.parse(pack.sim_initial_state_json) : {};

      const simSessionId = makeId();
      db.prepare(`INSERT INTO sim_sessions (id, session_id, assessment_id, assessment_pack_id, current_state_json, started_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))`).run(simSessionId, sessionId, assessmentId, assessmentPackId, JSON.stringify(initialState));

      insertSimEvent({
        session_id: sessionId,
        assessment_id: assessmentId,
        assessment_pack_id: assessmentPackId,
        event_type: 'sim_started',
        actor: 'system',
        label: 'Simulation started',
        state_after: initialState,
        timestamp_ms: Date.now(),
      });
    }

    // Write unified session_events
    appendSessionEvent({
      assessment_id: assessmentId,
      session_id: sessionId,
      event_type: 'assessment_started',
      actor: 'system',
      label: 'Assessment created',
      payload: { mode: assessmentMode, pack_id: assessmentPackId },
      started_at_ms: Date.now(),
    });

    appendSessionEvent({
      assessment_id: assessmentId,
      session_id: sessionId,
      event_type: 'customer_message',
      actor: 'customer',
      text: scenario.initial_message,
      started_at_ms: Date.now() + 50,
    });

    return NextResponse.json({
      assessment_id: assessmentId,
      session_id: sessionId,
      invite_url: `${baseUrl}/mvp/assessment/${inviteToken}`,
      invite_token: inviteToken,
      assessment_mode: assessmentMode,
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
