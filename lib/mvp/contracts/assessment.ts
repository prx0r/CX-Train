export const MANAGER_ASSESSMENT_CONTEXT_SCHEMA_VERSION = 'manager-assessment-context-v1';

export interface ManagerAssessmentContext {
  schemaVersion: typeof MANAGER_ASSESSMENT_CONTEXT_SCHEMA_VERSION;
  assessment: {
    id: string;
    title: string;
    candidateName: string;
    status: string;
    assignmentType: string;
    assessmentMode: string;
    assessmentPackId?: string | null;
  };
  result?: {
    overallScore?: number | null;
    readinessLabel?: string | null;
    summary?: string | null;
    structured?: unknown;
    compliance?: unknown;
    categoryScores?: unknown;
  } | null;
  transcript: Array<{
    role: string;
    content: string;
    createdAt?: string;
  }>;
  ticket?: {
    text: string;
    createdAt?: string;
  } | null;
  events: Array<{
    sequenceIndex: number;
    eventType: string;
    actor: string;
    label?: string | null;
    text?: string | null;
    actionId?: string | null;
    resultText?: string | null;
  }>;
  recording?: {
    hasRecording: boolean;
    analysis?: unknown;
  };
  standards?: unknown;
  pack?: {
    id: string;
    title: string;
    version?: string;
    managerSummary: string;
  } | null;
  dataGaps: string[];
}
