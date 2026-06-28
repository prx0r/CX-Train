import { getDb } from '@/lib/mvp/db';
import { getFullAssessment } from '@/lib/mvp/query';
import { getManagerStandards } from '@/lib/mvp/query';
import { getActiveCriteria, getActiveScenario } from '@/lib/mvp/query';
import { getSessionEvents } from '@/lib/mvp/events/eventLog';
import { buildEvidenceTimeline, summariseTimelineForAnalysis, calculateTimingMetrics } from '@/lib/mvp/events/timeline';
import type { AnalysisContext } from './types';
import { resolveModeConfigSnapshot, workspaceModeForAssignmentType } from '@/lib/mvp/workspace/modeConfig';

export function buildAssessmentContext(assessmentId: string): AnalysisContext | null {
  const full = getFullAssessment(assessmentId);
  if (!full) return null;

  const transcriptText = full.messages.map(m =>
    `${m.role.toUpperCase()}: ${m.content}`
  ).join('\n\n');

  const ticketText = full.ticket?.candidate_ticket_text || null;
  const criteria = getActiveCriteria();
  const scenario = getActiveScenario();

  // Use snapshot if available, otherwise fall back to current standards
  let managerStandards = null;
  const standardsSnapshotRaw = (full.assessment as any).standards_snapshot_json;
  if (standardsSnapshotRaw) {
    try {
      managerStandards = JSON.parse(standardsSnapshotRaw);
    } catch { /* ignore parse error */ }
  }
  if (!managerStandards) {
    const current = getManagerStandards();
    if (current) {
      managerStandards = {
        id: current.id,
        required_ticket_fields: JSON.parse(current.required_ticket_fields_json || '[]'),
        call_requirements: current.call_requirements,
        escalation_requirements: current.escalation_requirements,
      };
    }
  }

  // Build evidence timeline from session_events + messages
  const sessionEvents = full.session ? getSessionEvents(full.session.id) : [];
  const evidenceTimeline = buildEvidenceTimeline(sessionEvents);
  const timingMetrics = calculateTimingMetrics(sessionEvents);
  const timelineSummary = summariseTimelineForAnalysis(sessionEvents);

  const assessmentRow = full.assessment as any;
  const assignmentType = assessmentRow.assignment_type || (assessmentRow.assessment_mode === 'dashboard_sim' ? 'training_drill' : 'hiring_exam');
  const modeConfig = resolveModeConfigSnapshot(assignmentType, assessmentRow.mode_config_json);

  return {
    org_id: 'org-default',
    manager_id: 'manager-default',
    evidence_timeline: evidenceTimeline,
    timing_metrics: timingMetrics,
    timeline_summary: timelineSummary,
    assessment_id: full.assessment.id,
    session_id: full.session?.id || '',
    assessment_pack_id: assessmentRow.assessment_pack_id || null,
    assignment_type: assignmentType,
    workspace_mode: workspaceModeForAssignmentType(assignmentType),
    mode_config: modeConfig,
    assessment_scope: modeConfig.scoringScope,
    transcript_messages: full.messages.map(m => ({ role: m.role, content: m.content })),
    transcript_text: transcriptText,
    submitted_ticket: ticketText,
    manager_standards: managerStandards,
    active_criteria: criteria ? JSON.parse(criteria.criteria_json) : null,
    active_scenario: scenario ? {
      id: scenario.id,
      title: scenario.title,
      caller_persona: scenario.caller_persona,
      hidden_facts: JSON.parse(scenario.hidden_facts_json),
    } : null,
  };
}
