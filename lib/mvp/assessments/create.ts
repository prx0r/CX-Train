import { getDb, seedDefaults, initTables } from '../db';
import { makeId, getActiveScenario, getActiveCriteria, getManagerStandards } from '../query';
import { insertSimEvent } from '../sim/eventLog';
import { appendSessionEvent } from '../events/eventLog';
import { getPackById } from '../sim/packRegistry';
import { mergeAssessmentConfig } from '../sim/mergeConfig';
import { isAssignmentTypeValid, ASSIGNMENT_TYPES, ENABLED_TRAINING_DRILL_PACKS, type AssignmentType } from '../assignment-types';
import { buildPackSnapshot, validatePackStructure } from '../sim/snapshot';
import { serializeModeConfigForAssignmentType } from '../workspace/modeConfig';
import { getHiringPack, defaultHiringPack } from '../sim/hiringPacks';

export interface CreateMvpAssessmentInput {
  candidateName?: string;
  candidateEmail?: string | null;
  managerProfileId?: string;
  assignmentType?: string;
  assessmentPackId?: string | null;
  baseUrl?: string;
}

export interface CreateMvpAssessmentResult {
  assessment_id: string;
  session_id: string;
  invite_url: string;
  invite_token: string;
  assignment_type: AssignmentType;
  assessment_mode: string;
  hiring_pack_id?: string;
}

export function createMvpAssessment(input: CreateMvpAssessmentInput): CreateMvpAssessmentResult {
  initTables();
  seedDefaults();

  const baseUrl = input.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const candidateName = input.candidateName || 'Unnamed Candidate';
  const candidateEmail = input.candidateEmail || null;
  const managerProfileId = input.managerProfileId || 'manager-default-v1';

  const rawAssignmentType = input.assignmentType || 'hiring_exam';
  if (!isAssignmentTypeValid(rawAssignmentType)) {
    throw new Error(`Invalid assignment type: "${rawAssignmentType}"`);
  }

  const assignmentType = rawAssignmentType as AssignmentType;

  if (assignmentType === 'training_shift') {
    const err = new Error('Training Shift assignments are not yet available. Coming soon.');
    (err as any).code = 'TRAINING_SHIFT_NOT_AVAILABLE';
    throw err;
  }

  if (assignmentType === 'training_drill' && !ASSIGNMENT_TYPES.training_drill.enabled) {
    throw new Error('Training Drill is not enabled.');
  }

  const assessmentMode = assignmentType === 'training_drill' ? 'dashboard_sim' : 'chat_call';
  const modeConfigJson = serializeModeConfigForAssignmentType(assignmentType);

  const scenario = getActiveScenario();
  const criteria = getActiveCriteria();

  if (!scenario) {
    throw new Error('No active scenario found. Run mvp:init-db first.');
  }

  const assessmentId = makeId();
  const sessionId = makeId();
  const inviteToken = makeId();
  const db = getDb();
  const title = `Call Readiness: ${candidateName}`;

  let packId: string | null = null;
  let packSnapshotJson: string | null = null;
  let packInitialState: Record<string, unknown> = {};
  let firstMessage: string = scenario.initial_message;
  let hiringPackData: Record<string, unknown> | null = null;

  if (assignmentType === 'hiring_exam') {
    /* Use hiring pack for customer persona, fall back to default scenario */
    const hiringPack = input.assessmentPackId
      ? getHiringPack(input.assessmentPackId)
      : defaultHiringPack();
    if (hiringPack) {
      packId = hiringPack.id;
      firstMessage = hiringPack.customer.openingLine;
      hiringPackData = {
        id: hiringPack.id,
        title: hiringPack.title,
        difficulty: hiringPack.difficulty,
        templateId: hiringPack.templateId,
        customer: hiringPack.customer,
      };
      packSnapshotJson = JSON.stringify(hiringPackData);
    }
  } else if (assignmentType === 'training_drill') {
    const preferredPackId = input.assessmentPackId || null;
    if (!preferredPackId || !ENABLED_TRAINING_DRILL_PACKS.includes(preferredPackId)) {
      throw new Error(`Invalid or missing pack ID. Supported packs: ${ENABLED_TRAINING_DRILL_PACKS.join(', ')}`);
    }

    packId = preferredPackId;
    const codePack = getPackById(packId);

    const validation = validatePackStructure(codePack);
    if (!validation.valid) {
      throw new Error(`Pack "${packId}" fails structural validation: ${validation.errors.join(', ')}`);
    }

    const snapshot = buildPackSnapshot(codePack);
    packSnapshotJson = JSON.stringify(snapshot);

    packInitialState = codePack.initialState as unknown as Record<string, unknown>;
    firstMessage = snapshot.customer.opening_line;
  }

  const standards = getManagerStandards();
  const standardsSnapshot = standards ? {
    id: standards.id,
    required_ticket_fields: JSON.parse(standards.required_ticket_fields_json || '[]'),
    call_requirements: standards.call_requirements,
    escalation_requirements: standards.escalation_requirements,
    good_ticket_example: standards.good_ticket_example,
    bad_ticket_example: standards.bad_ticket_example,
  } : null;

  let scoringSnapshot: string | null = null;
  if (packId) {
    try {
      const codePack = getPackById(packId);
      const standardsOverrides = standards?.scoring_overrides_json || null;
      const merged = mergeAssessmentConfig({ pack: codePack, managerStandardsOverrides: standardsOverrides, packId });
      scoringSnapshot = JSON.stringify(merged);
    } catch {
      scoringSnapshot = null;
    }
  }

  const storedScenarioId = assignmentType === 'training_drill' ? null : scenario.id;

  db.prepare(`INSERT INTO assessments (id, title, candidate_name, candidate_email, invite_token, status, scenario_id, criteria_version_id, manager_profile_id, standards_snapshot_json, scoring_snapshot_json, mode_config_json, pack_snapshot_json, assessment_pack_id, assessment_mode, assignment_type, created_at)
    VALUES (?, ?, ?, ?, ?, 'invited', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(
    assessmentId, title, candidateName, candidateEmail, inviteToken,
    storedScenarioId, criteria?.id || null,
    managerProfileId,
    standardsSnapshot ? JSON.stringify(standardsSnapshot) : null,
    scoringSnapshot, modeConfigJson, packSnapshotJson, packId, assessmentMode, assignmentType,
  );

  db.prepare(`INSERT INTO sessions (id, assessment_id, status, started_at)
    VALUES (?, ?, 'in_progress', datetime('now'))`).run(sessionId, assessmentId);

  db.prepare(`INSERT INTO messages (id, session_id, role, content, created_at)
    VALUES (?, ?, 'caller', ?, datetime('now'))`).run(makeId(), sessionId, firstMessage);

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
    text: firstMessage,
    started_at_ms: Date.now() + 50,
  });

  return {
    assessment_id: assessmentId,
    session_id: sessionId,
    invite_url: `${baseUrl}/mvp/assessment/${inviteToken}`,
    invite_token: inviteToken,
    assignment_type: assignmentType,
    assessment_mode: assessmentMode,
    hiring_pack_id: packId && assignmentType === 'hiring_exam' ? packId : undefined,
  };
}
