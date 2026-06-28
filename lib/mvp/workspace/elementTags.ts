import type { WorkspaceElement, WorkspaceElementId } from './types';

export const ELEMENT_TAGS: Record<WorkspaceElementId, WorkspaceElement> = {
  call_conversation: {
    id: 'call_conversation',
    label: 'Call conversation',
    criteriaCategory: 'call_control',
    defaultEnabled: true,
  },
  ticket_note: {
    id: 'ticket_note',
    label: 'Support note',
    criteriaCategory: 'ticket_quality',
    defaultEnabled: true,
  },
  ticket_queue: {
    id: 'ticket_queue',
    label: 'Ticket queue',
    criteriaCategory: 'queue_management',
    defaultEnabled: false,
  },
  sla_display: {
    id: 'sla_display',
    label: 'SLA display',
    criteriaCategory: 'sla_awareness',
    defaultEnabled: false,
  },
  priority_controls: {
    id: 'priority_controls',
    label: 'Priority controls',
    criteriaCategory: 'priority_assessment',
    defaultEnabled: false,
  },
  taxonomy_triage: {
    id: 'taxonomy_triage',
    label: 'Ticket taxonomy',
    criteriaCategory: 'ticket_classification',
    defaultEnabled: false,
  },
  internal_live_split: {
    id: 'internal_live_split',
    label: 'Internal and live notes',
    criteriaCategory: 'note_quality',
    defaultEnabled: false,
  },
  remote_desktop: {
    id: 'remote_desktop',
    label: 'Remote desktop',
    criteriaCategory: 'remote_tools',
    defaultEnabled: false,
  },
  handover: {
    id: 'handover',
    label: 'Handover',
    criteriaCategory: 'handover_quality',
    defaultEnabled: false,
  },
  retry_attempt: {
    id: 'retry_attempt',
    label: 'Retry attempt',
    criteriaCategory: 'iteration_quality',
    defaultEnabled: false,
  },
  feedback_during: {
    id: 'feedback_during',
    label: 'In-session feedback',
    criteriaCategory: 'coachability',
    defaultEnabled: false,
  },
};

export const ALL_SCORING_CATEGORIES = [
  ...new Set(Object.values(ELEMENT_TAGS).map(element => element.criteriaCategory)),
];
