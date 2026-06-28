import { getDb } from '../db';
import { getFullAssessment } from '../query';
import { getSessionEvents } from '../events/eventLog';
import { getPackById, listPacks } from '../sim/packRegistry';
import {
  MANAGER_ASSESSMENT_CONTEXT_SCHEMA_VERSION,
  type ManagerAssessmentContext,
} from '../contracts/assessment';

function parseJson(value: string | null | undefined): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function summarizePack(packId: string | null | undefined): ManagerAssessmentContext['pack'] {
  if (!packId) return null;
  try {
    const pack = getPackById(packId);
    return {
      id: pack.id,
      title: pack.title,
      version: pack.version,
      managerSummary: `${pack.title}: ${pack.description}`,
    };
  } catch {
    return {
      id: packId,
      title: packId,
      managerSummary: 'Pack metadata unavailable',
    };
  }
}

export function getManagerAssessmentContext(
  _managerProfileId: string,
  assessmentId: string,
): ManagerAssessmentContext | null {
  const full = getFullAssessment(assessmentId);
  if (!full) return null;

  const assessmentRow = full.assessment as any;
  const resultRow = full.result as any;
  const assignmentType = assessmentRow.assignment_type
    || (assessmentRow.assessment_mode === 'dashboard_sim' ? 'training_drill' : 'hiring_exam');
  const assessmentMode = assessmentRow.assessment_mode || 'chat_call';

  const events = full.session ? getSessionEvents(full.session.id) : [];
  const structured = parseJson(resultRow?.raw_model_json);
  const compliance = parseJson((resultRow as any)?.compliance_json);
  const categoryScores = parseJson((resultRow as any)?.category_scores_json);
  const recordingAnalysis = parseJson((resultRow as any)?.recording_analysis_json);

  const dataGaps: string[] = [];
  if (!full.result) dataGaps.push('No analysis result is available yet');
  if (!full.ticket) dataGaps.push('No submitted ticket is available');
  if (events.length === 0) dataGaps.push('No session events were captured');
  if (!(resultRow as any)?.recording_path) dataGaps.push('No call recording is available');

  return {
    schemaVersion: MANAGER_ASSESSMENT_CONTEXT_SCHEMA_VERSION,
    assessment: {
      id: full.assessment.id,
      title: full.assessment.title,
      candidateName: full.assessment.candidate_name,
      status: full.assessment.status,
      assignmentType,
      assessmentMode,
      assessmentPackId: assessmentRow.assessment_pack_id || null,
    },
    result: resultRow ? {
      overallScore: resultRow.overall_score ?? null,
      readinessLabel: resultRow.readiness_label ?? null,
      summary: resultRow.summary ?? null,
      structured,
      compliance,
      categoryScores,
    } : null,
    transcript: full.messages.map(m => ({
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
    })),
    ticket: full.ticket ? {
      text: full.ticket.candidate_ticket_text,
      createdAt: full.ticket.created_at,
    } : null,
    events: events.map(e => ({
      sequenceIndex: e.sequence_index,
      eventType: e.event_type,
      actor: e.actor,
      label: e.label,
      text: e.text,
      actionId: e.action_id,
      resultText: e.result_text,
    })),
    recording: {
      hasRecording: !!(resultRow as any)?.recording_path,
      analysis: recordingAnalysis,
    },
    standards: parseJson(assessmentRow.standards_snapshot_json),
    pack: summarizePack(assessmentRow.assessment_pack_id),
    dataGaps,
  };
}

export function getManagerPackSummaries(_managerProfileId: string): Array<{ id: string; title: string }> {
  return listPacks();
}

export function getManagerStandardsContext(managerProfileId: string): unknown {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM manager_standards
    WHERE manager_profile_id = ? OR manager_profile_id IS NULL
    ORDER BY updated_at DESC LIMIT 1
  `).get(managerProfileId) as any;

  if (!row) return null;

  return {
    id: row.id,
    requiredTicketFields: parseJson(row.required_ticket_fields_json) || [],
    callRequirements: row.call_requirements,
    escalationRequirements: row.escalation_requirements,
    tonePreferences: parseJson(row.tone_preferences_json),
    updatedAt: row.updated_at,
  };
}
