import { ALL_SCORING_CATEGORIES, ELEMENT_TAGS } from './elementTags';
import type { Template, TemplateId, WorkspaceElementId, DifficultyLevel, WorkspaceMode } from './types';

function scopeFor(elements: WorkspaceElementId[], extraEnabledCategories: string[] = []): { enabledCategories: string[]; disabledCategories: string[] } {
  const enabled = new Set<string>(extraEnabledCategories);
  for (const elementId of elements) {
    enabled.add(ELEMENT_TAGS[elementId].criteriaCategory);
  }
  return {
    enabledCategories: [...enabled],
    disabledCategories: ALL_SCORING_CATEGORIES.filter(cat => !enabled.has(cat)),
  };
}

export const TEMPLATES: Record<TemplateId, Template> = {
  /* ── Hiring progressive templates ── */
  hiring_basic: {
    templateId: 'hiring_basic',
    mode: 'hiring',
    label: 'Hiring — Basic Call',
    description: 'Minimal: one customer call + one support note. Tests core communication and ticket writing.',
    difficulty: 'basic',
    skillsTested: ['call_control', 'diagnosis', 'ticket_quality', 'professionalism'],
    elements: ['call_conversation', 'ticket_note'],
    noteStyle: 'single_support_note',
    layout: 'simple_call',
    scoringScope: scopeFor(['call_conversation', 'ticket_note'], ['diagnosis', 'professionalism']),
  },
  hiring_with_triage: {
    templateId: 'hiring_with_triage',
    mode: 'hiring',
    label: 'Hiring — With Triage',
    description: 'Call + note + ticket triage (priority, SLA, taxonomy). Tests diagnosis and classification.',
    difficulty: 'intermediate',
    skillsTested: ['call_control', 'diagnosis', 'ticket_quality', 'professionalism', 'priority_assessment', 'ticket_classification', 'sla_awareness'],
    elements: ['call_conversation', 'ticket_note', 'priority_controls', 'taxonomy_triage', 'sla_display'],
    noteStyle: 'single_support_note',
    layout: 'simple_call',
    scoringScope: scopeFor(['call_conversation', 'ticket_note', 'priority_controls', 'taxonomy_triage', 'sla_display'], ['diagnosis', 'professionalism']),
  },
  hiring_with_remote: {
    templateId: 'hiring_with_remote',
    mode: 'hiring',
    label: 'Hiring — With Remote Tools',
    description: 'Call + note + triage + remote desktop. Tests technical troubleshooting.',
    difficulty: 'advanced',
    skillsTested: ['call_control', 'diagnosis', 'ticket_quality', 'professionalism', 'priority_assessment', 'ticket_classification', 'remote_tools'],
    elements: ['call_conversation', 'ticket_note', 'priority_controls', 'taxonomy_triage', 'sla_display', 'remote_desktop'],
    noteStyle: 'internal_and_customer_notes',
    layout: 'simple_call',
    scoringScope: scopeFor(['call_conversation', 'ticket_note', 'priority_controls', 'taxonomy_triage', 'sla_display', 'remote_desktop'], ['diagnosis', 'professionalism']),
  },
  hiring_full: {
    templateId: 'hiring_full',
    mode: 'hiring',
    label: 'Hiring — Full Assessment',
    description: 'All hiring elements + internal/live notes split + retry. Closest to a real shift experience.',
    difficulty: 'expert',
    skillsTested: ['call_control', 'diagnosis', 'ticket_quality', 'professionalism', 'priority_assessment', 'ticket_classification', 'sla_awareness', 'remote_tools', 'note_quality', 'iteration_quality'],
    elements: ['call_conversation', 'ticket_note', 'priority_controls', 'taxonomy_triage', 'sla_display', 'remote_desktop', 'internal_live_split', 'retry_attempt'],
    noteStyle: 'full_service_desk',
    layout: 'simple_call',
    scoringScope: scopeFor(['call_conversation', 'ticket_note', 'priority_controls', 'taxonomy_triage', 'sla_display', 'remote_desktop', 'internal_live_split', 'retry_attempt'], ['diagnosis', 'professionalism']),
  },

  /* ── Training templates (existing modes as templates) ── */
  training_drill_standard: {
    templateId: 'training_drill_standard',
    mode: 'training_assignment',
    label: 'Training Drill',
    description: 'Single-ticket practice with triage, notes, remote tools, and retry with feedback.',
    difficulty: 'intermediate',
    skillsTested: ['call_control', 'diagnosis', 'ticket_quality', 'professionalism', 'priority_assessment', 'ticket_classification', 'sla_awareness', 'remote_tools', 'note_quality', 'iteration_quality'],
    elements: ['call_conversation', 'ticket_note', 'sla_display', 'priority_controls', 'taxonomy_triage', 'internal_live_split', 'remote_desktop', 'retry_attempt'],
    noteStyle: 'internal_and_customer_notes',
    layout: 'guided_ticket',
    scoringScope: scopeFor(['call_conversation', 'ticket_note', 'sla_display', 'priority_controls', 'taxonomy_triage', 'internal_live_split', 'remote_desktop', 'retry_attempt'], ['diagnosis', 'professionalism']),
  },
  training_shift_standard: {
    templateId: 'training_shift_standard',
    mode: 'training_shift',
    label: 'Training Shift',
    description: 'Timed multi-ticket service desk simulation with queue, handover, and SLA tracking.',
    difficulty: 'expert',
    skillsTested: ['call_control', 'diagnosis', 'ticket_quality', 'professionalism', 'queue_management', 'priority_assessment', 'ticket_classification', 'sla_awareness', 'remote_tools', 'note_quality', 'handover_quality', 'coachability'],
    elements: ['ticket_queue', 'call_conversation', 'ticket_note', 'sla_display', 'priority_controls', 'taxonomy_triage', 'internal_live_split', 'remote_desktop', 'handover', 'feedback_during'],
    noteStyle: 'full_service_desk',
    layout: 'shift_console',
    scoringScope: scopeFor(['ticket_queue', 'call_conversation', 'ticket_note', 'sla_display', 'priority_controls', 'taxonomy_triage', 'internal_live_split', 'remote_desktop', 'handover', 'feedback_during'], ['diagnosis', 'professionalism']),
  },
};

export function getTemplate(templateId: string): Template | null {
  return TEMPLATES[templateId as TemplateId] || null;
}

export function templatesForMode(mode: WorkspaceMode): Template[] {
  return Object.values(TEMPLATES).filter(t => t.mode === mode);
}

export function templatesByDifficulty(difficulty: DifficultyLevel): Template[] {
  return Object.values(TEMPLATES).filter(t => t.difficulty === difficulty);
}

export function defaultTemplateForMode(mode: WorkspaceMode): Template {
  const modeTemplates = templatesForMode(mode);
  return modeTemplates[0] || TEMPLATES.hiring_basic;
}
