export type AssessmentMode = 'chat_call' | 'dashboard_sim' | 'voice_dashboard_sim';

export type SimToolId =
  | 'customer_chat'
  | 'ticket'
  | 'outlook'
  | 'browser'
  | 'cmd'
  | 'notes';

export type SimEventType =
  | 'sim_started'
  | 'tool_opened'
  | 'action_performed'
  | 'observation_returned'
  | 'customer_message'
  | 'candidate_message'
  | 'note_updated'
  | 'sim_completed'
  | 'red_flag_triggered';

export interface SimActionConfig {
  id: string;
  tool: SimToolId;
  label: string;
  result: string;
  requires_state?: Record<string, unknown>;
  state_patch?: Record<string, unknown>;
  visible_state_patch?: Record<string, unknown>;
  score_tags?: string[];
  red_flag?: string;
}

export interface SimPackConfig {
  tools: SimToolId[];
  actions: SimActionConfig[];
}

export interface SimEvent {
  id: string;
  session_id: string;
  assessment_id: string;
  assessment_pack_id: string | null;
  sequence_index: number;
  event_type: SimEventType;
  actor: string;
  tool_id: string | null;
  action_id: string | null;
  label: string | null;
  result_text: string | null;
  state_before_json: Record<string, unknown> | null;
  state_after_json: Record<string, unknown> | null;
  payload_json: Record<string, unknown> | null;
  timestamp_ms: number | null;
  created_at: string;
}

export interface SimActionResult {
  action_id: string;
  label: string;
  result_text: string;
  state_before: Record<string, unknown>;
  state_after: Record<string, unknown>;
  visible_state: Record<string, unknown>;
  red_flag?: string;
}

export interface VisibleSimState {
  tools: SimToolId[];
  safe_actions: { id: string; tool: SimToolId; label: string }[];
  visible_state: Record<string, unknown>;
  timeline: { action_id: string; label: string; result_text: string; timestamp_ms: number | null; red_flag?: string }[];
}

export interface SimScoringResult {
  actionCriteria: Record<string, 'pass' | 'partial' | 'fail'>;
  redFlags: string[];
  scoreDelta: number;
  timelineSummary: string[];
  technicalPath: string[];
}
