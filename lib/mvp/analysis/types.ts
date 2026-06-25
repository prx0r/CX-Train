export type AnalysisType = 'base_callum' | 'callum_for_you' | 'manager_profile_refresh';
export type AnalysisStatus = 'pending' | 'running' | 'complete' | 'failed';
export type CriterionStatus = 'pass' | 'partial' | 'fail' | 'not_applicable' | 'not_observed';
export type ReadinessLabel = 'ready' | 'needs_supervision' | 'not_ready';
export type GateSeverity = 'warning' | 'major' | 'critical';

export const RUBRIC_VERSION = 'callcallum-base-v0.4-analysis-hardening';

export interface AnalysisRunRecord {
  id: string;
  org_id: string;
  manager_id: string;
  session_id: string;
  assessment_id: string | null;
  assessment_pack_id: string | null;
  analysis_type: AnalysisType;
  prompt_version: string;
  rubric_version: string;
  model_provider: string;
  model: string;
  temperature: number;
  input_hash: string;
  status: AnalysisStatus;
  result_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CriterionResult {
  status: CriterionStatus;
  evidence: string[];
  notes?: string;
}

export interface RedFlag {
  type: string;
  severity?: string;
  evidence: string;
}

export interface TicketAssessment {
  status: CriterionStatus;
  missing_fields: string[];
  evidence: string;
}

export interface AnalysisCriteriaOutput {
  [key: string]: CriterionResult;
}

export interface EvidenceExtraction {
  criteria: AnalysisCriteriaOutput;
  missed_questions: string[];
  red_flags: RedFlag[];
  ticket_assessment: TicketAssessment;
}

export interface EvidenceItem {
  source: 'transcript' | 'ticket' | 'analysis';
  quote?: string;
  messageId?: string;
  note?: string;
}

export interface FailGateHit {
  id: string;
  label: string;
  severity: GateSeverity;
  scoreCap: number;
  overrideReadiness?: ReadinessLabel;
  evidence: EvidenceItem[];
  rationale: string;
}

export interface RubricCheckResult {
  id: string;
  label: string;
  status: CriterionStatus;
  score: number;
  maxScore: number;
  evidence: EvidenceItem[];
  rationale: string;
}

export interface DeterministicAnalysisResult {
  score: number;
  rawScoreBeforeCaps: number;
  readiness: ReadinessLabel;
  gateHits: FailGateHit[];
  checks: RubricCheckResult[];
  strengths: string[];
  weaknesses: string[];
  managerSummary: string;
  rubricVersion: string;
  promptVersion?: string;
}

export interface ManagerStandardFit {
  status: 'pass' | 'partial' | 'fail';
  notes: string[];
}

export interface NarrativeFeedback {
  summary: string;
  strengths: string[];
  improvements: string[];
  most_costly_miss: string;
  ticket_feedback: string;
  better_phrasing_examples: string[];
  manager_standard_fit: ManagerStandardFit;
  coaching_focus: string[];
}

export interface DeterministicScore {
  score: number;
  rawScoreBeforeCaps: number;
  rating: ReadinessLabel;
  earnedScore: number;
  maxPossibleScore: number;
  failedRequiredChecks: string[];
  triggeredDealbreakers: string[];
  gateHits: FailGateHit[];
  skillBreakdown: Record<string, { score: number; maxScore: number; percent: number }>;
}

export interface StructuredOutput {
  schema_version: string;
  evidence_extraction: EvidenceExtraction;
  deterministic_score: DeterministicScore;
  narrative: NarrativeFeedback;
}

export interface AnalysisContext {
  org_id: string;
  manager_id: string;
  assessment_id: string;
  session_id: string;
  assessment_pack_id: string | null;
  transcript_messages: { role: string; content: string }[];
  transcript_text: string;
  submitted_ticket: string | null;
  manager_standards: Record<string, unknown> | null;
  active_criteria: Record<string, unknown> | null;
  active_scenario: Record<string, unknown> | null;
}
