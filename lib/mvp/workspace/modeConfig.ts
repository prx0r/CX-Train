import { ALL_SCORING_CATEGORIES, ELEMENT_TAGS } from './elementTags';
import type { ModeConfig, WorkspaceElementId, WorkspaceMode } from './types';

function scopeFor(elements: WorkspaceElementId[], extraEnabledCategories: string[] = []): ModeConfig['scoringScope'] {
  const enabled = new Set<string>(extraEnabledCategories);
  for (const elementId of elements) {
    enabled.add(ELEMENT_TAGS[elementId].criteriaCategory);
  }

  return {
    enabledCategories: [...enabled],
    disabledCategories: ALL_SCORING_CATEGORIES.filter(category => !enabled.has(category)),
  };
}

export const MODE_CONFIG: Record<WorkspaceMode, ModeConfig> = {
  hiring: {
    mode: 'hiring',
    label: 'Hiring Call',
    description: 'Quick candidate readiness assessment with one customer call and one support note.',
    elements: ['call_conversation', 'ticket_note'],
    noteStyle: 'single_support_note',
    layout: 'simple_call',
    scoringScope: scopeFor(['call_conversation', 'ticket_note'], ['diagnosis', 'professionalism']),
  },
  training_assignment: {
    mode: 'training_assignment',
    label: 'Training Drill',
    description: 'Single-ticket practice with triage, notes, remote tools, and feedback.',
    elements: [
      'call_conversation',
      'ticket_note',
      'sla_display',
      'priority_controls',
      'taxonomy_triage',
      'internal_live_split',
      'remote_desktop',
      'retry_attempt',
    ],
    noteStyle: 'internal_and_customer_notes',
    layout: 'guided_ticket',
    scoringScope: scopeFor([
      'call_conversation',
      'ticket_note',
      'sla_display',
      'priority_controls',
      'taxonomy_triage',
      'internal_live_split',
      'remote_desktop',
      'retry_attempt',
    ], ['diagnosis', 'professionalism']),
  },
  training_shift: {
    mode: 'training_shift',
    label: 'Training Shift',
    description: 'Timed multi-ticket service desk simulation.',
    elements: [
      'ticket_queue',
      'call_conversation',
      'ticket_note',
      'sla_display',
      'priority_controls',
      'taxonomy_triage',
      'internal_live_split',
      'remote_desktop',
      'handover',
      'feedback_during',
    ],
    noteStyle: 'full_service_desk',
    layout: 'shift_console',
    scoringScope: scopeFor([
      'ticket_queue',
      'call_conversation',
      'ticket_note',
      'sla_display',
      'priority_controls',
      'taxonomy_triage',
      'internal_live_split',
      'remote_desktop',
      'handover',
      'feedback_during',
    ], ['diagnosis', 'professionalism']),
  },
};

export function workspaceModeForAssignmentType(assignmentType: string | null | undefined): WorkspaceMode {
  if (assignmentType === 'training_drill') return 'training_assignment';
  if (assignmentType === 'training_shift') return 'training_shift';
  return 'hiring';
}

export function getModeConfigForAssignmentType(assignmentType: string | null | undefined): ModeConfig {
  return MODE_CONFIG[workspaceModeForAssignmentType(assignmentType)];
}

export function resolveModeConfigSnapshot(
  assignmentType: string | null | undefined,
  rawSnapshot: string | null | undefined,
): ModeConfig {
  if (rawSnapshot) {
    try {
      const parsed = JSON.parse(rawSnapshot) as ModeConfig;
      if (parsed && parsed.mode && Array.isArray(parsed.elements) && parsed.scoringScope) {
        return parsed;
      }
    } catch {
      /* Fall back to the current config for old or corrupt snapshots. */
    }
  }
  return getModeConfigForAssignmentType(assignmentType);
}

export function serializeModeConfigForAssignmentType(assignmentType: string | null | undefined): string {
  return JSON.stringify(getModeConfigForAssignmentType(assignmentType));
}
