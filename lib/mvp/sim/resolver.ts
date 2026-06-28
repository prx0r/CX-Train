import { getDb } from '@/lib/mvp/db';
import { getFullAssessment } from '@/lib/mvp/query';
import type { AssessmentRow, SessionRow, MessageRow, TicketRow } from '@/lib/mvp/query';
import { getSessionEvents } from '@/lib/mvp/events/eventLog';
import { SimState, SimAction, VisibleAction, VisibleSimState, SimPhase, SimTimelineEntry } from './types';
import { PackSnapshot, validateSnapshot, buildPackSnapshot } from './snapshot';
import { getPackById } from './packRegistry';
import { getVisibleActions, getVisibleState } from './safeProjection';
import { buildTimeline } from './timeline';
import { ScoringConfig } from './scoring';
import type { SimulatorCapabilities } from '@/lib/mvp/assignment-types';
import { resolveModeConfigSnapshot, workspaceModeForAssignmentType } from '@/lib/mvp/workspace/modeConfig';
import type { ModeConfig, WorkspaceMode } from '@/lib/mvp/workspace/types';

export type SimErrorCode = 'NOT_A_SIM_ASSESSMENT' | 'PACK_SNAPSHOT_MISSING' | 'PACK_SNAPSHOT_CORRUPT' | 'PACK_ID_UNKNOWN' | 'SESSION_NOT_FOUND';

export class SimResolutionError extends Error {
  constructor(
    public code: SimErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'SimResolutionError';
  }
}

export interface SimAssessmentView {
  assessment: {
    id: string;
    title: string;
    candidate_name: string;
    status: string;
    assignment_type: string;
    created_at: string;
  };
  assignment_runtime: {
    shell: string;
    mode: WorkspaceMode;
    mode_label: string;
    capabilities: SimulatorCapabilities;
    mode_config: ModeConfig;
  };
  ticket: {
    id: string;
    title: string;
    requester_name: string;
    company: string;
    department: string;
    severity: string;
    status: string;
    description: string;
  };
  call: {
    status: string;
    caller_name: string;
    caller_company: string;
  };
  session_id: string | null;
  messages: Array<{ role: string; content: string }>;
  pack_title?: string;
  sim?: {
    tools: string[];
    safe_actions: VisibleAction[];
    visible_state: VisibleSimState;
    phase: string;
    timeline: SimTimelineEntry[];
  };
  analysis?: any;
  candidate_analysis?: any;
}

export interface SimSessionView {
  tools: string[];
  safe_actions: VisibleAction[];
  visible_state: VisibleSimState;
  phase: string;
  timeline: SimTimelineEntry[];
}

export interface ResolvedSimAction {
  packId: string;
  snapshot: PackSnapshot;
  currentState: SimState;
  action: SimAction;
  sessionId: string;
  simSessionId: string;
}

function loadSnapshot(packSnapshotRaw: string | null | undefined, packId: string | null | undefined): PackSnapshot {
  if (!packSnapshotRaw) {
    if (packId) {
      const pack = getPackById(packId);
      const snapshot = buildPackSnapshot(pack);
      return snapshot;
    }
    throw new SimResolutionError('PACK_SNAPSHOT_MISSING', 'Assessment has no pack_snapshot_json and no pack_id to fall back to');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(packSnapshotRaw);
  } catch {
    throw new SimResolutionError('PACK_SNAPSHOT_CORRUPT', 'pack_snapshot_json is not valid JSON');
  }

  const result = validateSnapshot(parsed);
  if (!result.valid) {
    throw new SimResolutionError(
      'PACK_SNAPSHOT_CORRUPT',
      `pack_snapshot_json validation failed: ${result.errors.map(e => e.field).join(', ')}`
    );
  }

  return parsed as PackSnapshot;
}

export function resolveSimAssessment(token: string): SimAssessmentView {
  const db = getDb();

  const assessment = db.prepare(`
    SELECT * FROM assessments 
    WHERE invite_token = ?
      AND (invite_revoked = 0 OR invite_revoked IS NULL)
      AND (invite_expires_at IS NULL OR invite_expires_at > datetime('now'))
  `).get(token) as Record<string, unknown> | undefined;

  if (!assessment) {
    throw new SimResolutionError('NOT_A_SIM_ASSESSMENT', 'Assessment not found');
  }

  const assignmentType = (assessment.assignment_type as string) || '';
  /* Hiring exams use assessment_pack_id for customer persona but are not sim assessments */
  if (!assessment.assessment_pack_id || assignmentType === 'hiring_exam') {
    throw new SimResolutionError('NOT_A_SIM_ASSESSMENT', 'Assessment has no sim pack — not a sim assessment');
  }
  const packId = assessment.assessment_pack_id as string;

  const snapshot = loadSnapshot(assessment.pack_snapshot_json as string | null | undefined, packId);

  const session = db.prepare(`
    SELECT * FROM sessions WHERE assessment_id = ? ORDER BY started_at DESC LIMIT 1
  `).get(assessment.id as string) as Record<string, unknown> | undefined;

  const messages = session
    ? (db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC').all(session.id as string) as Array<Record<string, unknown>>)
    : [];

  const modeConfig = resolveModeConfigSnapshot(assignmentType, assessment.mode_config_json as string | null | undefined);
  const modeLabel = assignmentType === 'hiring_exam' ? 'Hiring Exam'
    : assignmentType === 'training_drill' ? 'Training Drill'
    : 'Assessment';

  const ticketData = {
    id: 'INC-' + ((assessment.id as string)?.slice(-6).toUpperCase() || '000000'),
    title: snapshot.customer.subject || 'Support Request',
    requester_name: snapshot.customer.name,
    company: snapshot.customer.company,
    department: snapshot.customer.role,
    severity: snapshot.severity === 'P1' ? 'critical' : snapshot.severity === 'P2' ? 'high' : snapshot.severity === 'P3' ? 'medium' : 'low',
    status: assessment.status === 'invited' ? 'Open' : (assessment.status as string),
    description: snapshot.customer.opening_line,
  };

  const view: SimAssessmentView = {
    assessment: {
      id: assessment.id as string,
      title: assessment.title as string,
      candidate_name: assessment.candidate_name as string,
      status: assessment.status as string,
      assignment_type: assignmentType,
      created_at: assessment.created_at as string,
    },
    assignment_runtime: {
      shell: 'service_desk',
      mode: workspaceModeForAssignmentType(assignmentType),
      mode_label: modeLabel,
      capabilities: snapshot.capabilities,
      mode_config: modeConfig,
    },
    ticket: ticketData,
    call: {
      status: 'not_started',
      caller_name: snapshot.customer.name,
      caller_company: snapshot.customer.company,
    },
    session_id: session?.id as string | null || null,
    messages: messages.map(m => ({ role: m.role as string, content: m.content as string })),
    pack_title: snapshot.pack_title,
  };

  if (snapshot.capabilities.remoteDesktop && session) {
    const simSession = db.prepare('SELECT current_state_json FROM sim_sessions WHERE session_id = ?')
      .get(session.id as string) as { current_state_json: string } | undefined;

    const currentState: SimState = simSession
      ? JSON.parse(simSession.current_state_json)
      : snapshot.initial_state;

    const canonicalEvents = getSessionEvents(session.id as string);
    const typedEvents = canonicalEvents.map((e: any) => ({
      ...e,
      sequence: e.sequence_index,
      state_before_json: e.state_before_json || null,
      state_after_json: e.state_after_json || null,
      started_at_ms: e.started_at_ms,
    }));

    view.sim = {
      tools: snapshot.capabilities.tools,
      safe_actions: getVisibleActions(currentState, snapshot.actions),
      visible_state: getVisibleState(currentState, { actions: snapshot.actions } as any),
      phase: currentState.phase,
      timeline: buildTimeline(typedEvents as any).map(t => ({
        sequence: t.sequence,
        event_type: t.event_type,
        actor: t.actor,
        formatted_time: t.formatted_time,
        label: t.label,
        result_text: t.result_text,
        is_red_flag: t.is_red_flag,
        started_at_ms: t.started_at_ms,
      })),
    };
  }

  return view;
}

export function resolveSimSession(
  assessmentId: string,
  sessionId: string,
  snapshot: PackSnapshot
): SimSessionView {
  const db = getDb();

  const simSession = db.prepare('SELECT current_state_json FROM sim_sessions WHERE session_id = ?')
    .get(sessionId) as { current_state_json: string } | undefined;

  const currentState = simSession
    ? JSON.parse(simSession.current_state_json) as SimState
    : snapshot.initial_state;

  const canonicalEvents = getSessionEvents(sessionId);
  const typedEvents = canonicalEvents.map((e: any) => ({
    ...e,
    sequence: e.sequence_index,
    state_before_json: e.state_before_json || null,
    state_after_json: e.state_after_json || null,
    started_at_ms: e.started_at_ms,
  }));

  return {
    tools: snapshot.capabilities.tools,
    safe_actions: getVisibleActions(currentState, snapshot.actions),
    visible_state: getVisibleState(currentState, { actions: snapshot.actions } as any),
    phase: currentState.phase,
    timeline: buildTimeline(typedEvents as any).map(t => ({
      sequence: t.sequence,
      event_type: t.event_type,
      actor: t.actor,
      formatted_time: t.formatted_time,
      label: t.label,
      result_text: t.result_text,
      is_red_flag: t.is_red_flag,
      started_at_ms: t.started_at_ms,
    })),
  };
}

export function resolveSimAction(
  assessmentId: string,
  sessionId: string,
  actionId: string,
  snapshot: PackSnapshot
): ResolvedSimAction {
  const db = getDb();

  const action = snapshot.actions.find(a => a.id === actionId);
  if (!action) {
    throw new SimResolutionError('PACK_SNAPSHOT_CORRUPT', `Action "${actionId}" not found in pack snapshot`);
  }

  const simSession = db.prepare('SELECT id, current_state_json FROM sim_sessions WHERE session_id = ?')
    .get(sessionId) as { id: string; current_state_json: string } | undefined;

  if (!simSession) {
    throw new SimResolutionError('SESSION_NOT_FOUND', 'Sim session not found');
  }

  const currentState = JSON.parse(simSession.current_state_json) as SimState;

  return {
    packId: snapshot.pack_id,
    snapshot,
    currentState,
    action,
    sessionId,
    simSessionId: simSession.id,
  };
}

export function getSnapshotFromAssessment(assessment: Record<string, unknown>): PackSnapshot {
  return loadSnapshot(
    assessment.pack_snapshot_json as string | null | undefined,
    assessment.assessment_pack_id as string | null | undefined
  );
}
