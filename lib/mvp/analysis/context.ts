import { getDb } from '@/lib/mvp/db';
import { getFullAssessment } from '@/lib/mvp/query';
import { getManagerStandards } from '@/lib/mvp/query';
import { getActiveCriteria, getActiveScenario } from '@/lib/mvp/query';
import type { AnalysisContext } from './types';

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

  return {
    org_id: 'org-default',
    manager_id: 'manager-default',
    assessment_id: full.assessment.id,
    session_id: full.session?.id || '',
    assessment_pack_id: null,
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
