export type AssignmentType = 'hiring_exam' | 'training_drill' | 'training_shift';

export interface AssignmentTypeConfig {
  label: string;
  description: string;
  enabled: boolean;
  assessmentMode: string | null;
  comingSoon?: boolean;
}

export const ASSIGNMENT_TYPES: Record<AssignmentType, AssignmentTypeConfig> = {
  hiring_exam: {
    label: 'Hiring Exam',
    description: 'Best for candidates or new starters. One controlled call and ticket.',
    enabled: true,
    assessmentMode: 'chat_call',
  },
  training_drill: {
    label: 'Training Drill',
    description: 'Best for practising one ticket type. One simulated ticket/call with optional remote tools.',
    enabled: true,
    assessmentMode: 'dashboard_sim',
  },
  training_shift: {
    label: 'Training Shift',
    description: 'Coming soon. Simulated queue across a time block.',
    enabled: false,
    assessmentMode: null,
    comingSoon: true,
  },
};

export const ASSIGNMENT_TYPE_LIST: AssignmentType[] = ['hiring_exam', 'training_drill', 'training_shift'];

export const ENABLED_TRAINING_DRILL_PACKS = ['pack-outlook-sim-v2'];

export function getAssignmentTypeConfig(t: string): AssignmentTypeConfig | null {
  return ASSIGNMENT_TYPES[t as AssignmentType] || null;
}

export function assignmentTypeToAssessmentMode(t: string): string {
  const config = getAssignmentTypeConfig(t);
  return config?.assessmentMode || 'chat_call';
}

export function isAssignmentTypeValid(t: string): t is AssignmentType {
  return t in ASSIGNMENT_TYPES;
}

export function getEnabledAssignmentTypes(): AssignmentType[] {
  return ASSIGNMENT_TYPE_LIST.filter(t => ASSIGNMENT_TYPES[t].enabled);
}
