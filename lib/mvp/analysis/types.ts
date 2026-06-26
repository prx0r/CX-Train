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
  evidence_validation?: {
    grounded: boolean;
    warnings: string[];
    details?: Array<{
      severity: 'info' | 'warning' | 'critical';
      source: 'transcript' | 'ticket' | 'analysis';
      code: string;
      criterion?: string;
      message: string;
    }>;
  };
  narrative_validation?: {
    passed: boolean;
    warnings: string[];
  };
  evidence_extraction: EvidenceExtraction;
  deterministic_score: DeterministicScore;
  narrative: NarrativeFeedback;
}

export interface TaxonomyClassificationMatch {
  taxonomy_item_id: string | null;
  expected_type: string;
  expected_sub_type: string;
  expected_item: string;
  predicted_type: string;
  predicted_sub_type: string;
  predicted_item: string;
  correct: 'yes' | 'partial' | 'no';
  missed_playbook_questions: string[];
  escalation_guidance_followed: 'yes' | 'partial' | 'no';
}

export interface EvidenceTimelineEntry {
  sequence_index: number;
  event_type: string;
  actor: string;
  formatted_time: string;
  text: string | null;
  label: string | null;
  result_text: string | null;
  is_red_flag: boolean;
}

export interface TimingMetrics {
  total_duration_ms: number | null;
  time_to_first_candidate_response_ms: number | null;
  time_to_first_action_ms: number | null;
  time_to_first_relevant_check_ms: number | null;
  time_to_resolution_ms: number | null;
  time_to_ticket_submit_ms: number | null;
}

export interface AnalysisContext {
  org_id: string;
  manager_id: string;
  assessment_id: string;
  session_id: string;
  assessment_pack_id: string | null;
  assignment_type?: string;
  transcript_messages: { role: string; content: string }[];
  transcript_text: string;
  submitted_ticket: string | null;
  manager_standards: Record<string, unknown> | null;
  active_criteria: Record<string, unknown> | null;
  active_scenario: Record<string, unknown> | null;
  evidence_timeline?: EvidenceTimelineEntry[];
  timing_metrics?: TimingMetrics;
  timeline_summary?: string;
}
