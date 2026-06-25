export type SessionEventType =
  | 'assessment_started'
  | 'customer_message'
  | 'candidate_message'
  | 'candidate_audio_started'
  | 'candidate_audio_ended'
  | 'transcript_partial'
  | 'transcript_final'
  | 'tool_opened'
  | 'action_performed'
  | 'observation_returned'
  | 'ticket_note_updated'
  | 'ticket_submitted'
  | 'red_flag_triggered'
  | 'assessment_completed';

export type SessionActor = 'candidate' | 'customer' | 'system' | 'simulator' | 'analysis';

export interface SessionEvent {
  id: string;
  assessment_id: string;
  session_id: string;
  sequence_index: number;
  event_type: SessionEventType;
  actor: SessionActor;
  text: string | null;
  tool_id: string | null;
  action_id: string | null;
  label: string | null;
  result_text: string | null;
  state_before_json: Record<string, unknown> | null;
  state_after_json: Record<string, unknown> | null;
  payload_json: Record<string, unknown> | null;
  started_at_ms: number | null;
  ended_at_ms: number | null;
  duration_ms: number | null;
  created_at: string;
}

export interface TimingMetrics {
  total_duration_ms: number | null;
  time_to_first_candidate_response_ms: number | null;
  time_to_first_action_ms: number | null;
  time_to_first_relevant_check_ms: number | null;
  time_to_resolution_ms: number | null;
  time_to_ticket_submit_ms: number | null;
}

export interface EvidenceTimelineOptions {
  includeMessages?: boolean;
  maxEntries?: number;
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
  timestamp_ms: number | null;
  duration_ms: number | null;
}
