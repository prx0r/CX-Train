export type WorkspaceMode = 'hiring' | 'training_assignment' | 'training_shift';

export type TemplateId =
  | 'hiring_basic'
  | 'hiring_with_triage'
  | 'hiring_with_remote'
  | 'hiring_full'
  | 'training_drill_standard'
  | 'training_shift_standard';

export type DifficultyLevel = 'basic' | 'intermediate' | 'advanced' | 'expert';

export type WorkspaceElementId =
  | 'call_conversation'
  | 'ticket_note'
  | 'ticket_queue'
  | 'sla_display'
  | 'priority_controls'
  | 'taxonomy_triage'
  | 'internal_live_split'
  | 'remote_desktop'
  | 'handover'
  | 'retry_attempt'
  | 'feedback_during';

export type NoteStyle = 'single_support_note' | 'internal_and_customer_notes' | 'full_service_desk';

export type LayoutType = 'simple_call' | 'guided_ticket' | 'shift_console';

export interface AssessmentScope {
  enabledCategories: string[];
  disabledCategories: string[];
}

export interface WorkspaceElement {
  id: WorkspaceElementId;
  label: string;
  criteriaCategory: string;
  defaultEnabled: boolean;
}

export interface ModeConfig {
  mode: WorkspaceMode;
  label: string;
  description: string;
  elements: WorkspaceElementId[];
  noteStyle: NoteStyle;
  layout: LayoutType;
  scoringScope: AssessmentScope;
}

export interface Template extends ModeConfig {
  templateId: TemplateId;
  difficulty: DifficultyLevel;
  skillsTested: string[];
}
