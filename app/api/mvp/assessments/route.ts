import { NextRequest, NextResponse } from 'next/server';
import { getDb, seedDefaults, initTables } from '@/lib/mvp/db';
import { makeId, getActiveScenario, getActiveCriteria, getManagerStandards } from '@/lib/mvp/query';
import { insertSimEvent } from '@/lib/mvp/sim/eventLog';
import { appendSessionEvent } from '@/lib/mvp/events/eventLog';
import { getPackById, getPackIdForMode } from '@/lib/mvp/sim/packRegistry';
import { isAssignmentTypeValid, ASSIGNMENT_TYPES, ENABLED_TRAINING_DRILL_PACKS } from '@/lib/mvp/assignment-types';
import { failWithCustomCode } from '@/lib/mvp/api/responses';

export async function POST(request: NextRequest) {
  try {
    initTables();
    seedDefaults();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'http://localhost:3000';

    const body = await request.json();
    const candidateName = body.candidate_name || 'Unnamed Candidate';
    const candidateEmail = body.candidate_email || null;
    const managerProfileId = body.manager_profile_id || 'manager-default-v1';

    /* Resolve assignment type — default to hiring_exam */
    const rawAssignmentType = body.assignmentType || body.assignment_type || 'hiring_exam';

    if (!isAssignmentTypeValid(rawAssignmentType)) {
      return NextResponse.json({ error: `Invalid assignment type: "${rawAssignmentType}"` }, { status: 400 });
    }

    const assignmentType = rawAssignmentType as import('@/lib/mvp/assignment-types').AssignmentType;

    if (assignmentType === 'training_shift') {
      return failWithCustomCode('TRAINING_SHIFT_NOT_AVAILABLE', 'Training Shift assignments are not yet available. Coming soon.', 400);
    }

    if (assignmentType === 'training_drill' && !ASSIGNMENT_TYPES.training_drill.enabled) {
      return NextResponse.json({ error: 'Training Drill is not enabled.' }, { status: 400 });
    }

    /* Map assignment type to internal mode */
    const assessmentMode = assignmentType === 'training_drill' ? 'dashboard_sim' : 'chat_call';

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

    /* Resolve pack for training_drill */
    let packInitialState: Record<string, unknown> = {};
    let packId: string | null = null;

    if (assignmentType === 'training_drill') {
      const preferredPackId: string = body.assessmentPackId || body.assessment_pack_id || ENABLED_TRAINING_DRILL_PACKS[0];
      const resolvedPackId: string = ENABLED_TRAINING_DRILL_PACKS.includes(preferredPackId) ? preferredPackId : ENABLED_TRAINING_DRILL_PACKS[0];
      packId = resolvedPackId;
      const codePack = getPackById(resolvedPackId);
      packInitialState = codePack.initialState as unknown as Record<string, unknown>;
    }

    /* Snapshot current standards */
    const standards = getManagerStandards();
    const standardsSnapshot = standards ? {
      id: standards.id,
      required_ticket_fields: JSON.parse(standards.required_ticket_fields_json || '[]'),
      call_requirements: standards.call_requirements,
      escalation_requirements: standards.escalation_requirements,
      good_ticket_example: standards.good_ticket_example,
      bad_ticket_example: standards.bad_ticket_example,
    } : null;

    db.prepare(`INSERT INTO assessments (id, title, candidate_name, candidate_email, invite_token, status, scenario_id, criteria_version_id, manager_profile_id, standards_snapshot_json, assessment_pack_id, assessment_mode, assignment_type, created_at)
      VALUES (?, ?, ?, ?, ?, 'invited', ?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(
      assessmentId, title, candidateName, candidateEmail, inviteToken, scenario.id, criteria?.id || null,
      managerProfileId, standardsSnapshot ? JSON.stringify(standardsSnapshot) : null,
      packId, assessmentMode, assignmentType
    );

    db.prepare(`INSERT INTO sessions (id, assessment_id, status, started_at)
      VALUES (?, ?, 'in_progress', datetime('now'))`).run(sessionId, assessmentId);

    db.prepare(`INSERT INTO messages (id, session_id, role, content, created_at)
      VALUES (?, ?, 'caller', ?, datetime('now'))`).run(makeId(), sessionId, scenario.initial_message);

    /* Create sim_session for training_drill */
    if (assignmentType === 'training_drill' && packId) {
      const simSessionId = makeId();
      db.prepare(`INSERT INTO sim_sessions (id, session_id, assessment_id, assessment_pack_id, current_state_json, started_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))`).run(simSessionId, sessionId, assessmentId, packId, JSON.stringify(packInitialState));

      insertSimEvent({
        session_id: sessionId,
        assessment_id: assessmentId,
        assessment_pack_id: packId,
        event_type: 'sim_started',
        actor: 'system',
        label: 'Simulation started',
        state_after: packInitialState,
        started_at_ms: Date.now(),
      });
    }

    /* Write unified session_events */
    appendSessionEvent({
      assessment_id: assessmentId,
      session_id: sessionId,
      event_type: 'assessment_started',
      actor: 'system',
      label: 'Assessment created',
      payload: { assignmentType, mode: assessmentMode, pack_id: packId },
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
      assignment_type: assignmentType,
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
