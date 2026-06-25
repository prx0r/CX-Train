import { getDb } from '../db';
import { SessionEvent, SessionEventType, SessionActor } from './types';
import { InputSource, VoiceMetadata } from '../voice/types';

export function getNextSequenceIndex(sessionId: string): number {
  const db = getDb();
  const row = db.prepare(
    'SELECT COALESCE(MAX(sequence_index), -1) as max_seq FROM session_events WHERE session_id = ?'
  ).get(sessionId) as { max_seq: number };
  return row.max_seq + 1;
}

export function appendSessionEvent(params: {
  assessment_id: string;
  session_id: string;
  event_type: SessionEventType;
  actor: SessionActor;
  text?: string | null;
  tool_id?: string | null;
  action_id?: string | null;
  label?: string | null;
  result_text?: string | null;
  state_before?: Record<string, unknown> | null;
  state_after?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
  started_at_ms?: number | null;
  ended_at_ms?: number | null;
  duration_ms?: number | null;
  input_source?: InputSource;
  audio_metadata?: VoiceMetadata | null;
}): string {
  const db = getDb();
  const id = 'evt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const seq = getNextSequenceIndex(params.session_id);

  const payload = params.payload || {};
  if (params.input_source) payload.input_source = params.input_source;
  if (params.audio_metadata) payload.audio_metadata = params.audio_metadata;

  db.prepare(`INSERT INTO session_events
    (id, assessment_id, session_id, sequence_index, event_type, actor, text, tool_id, action_id, label, result_text, state_before_json, state_after_json, payload_json, input_source, audio_metadata_json, started_at_ms, ended_at_ms, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id,
    params.assessment_id,
    params.session_id,
    seq,
    params.event_type,
    params.actor,
    params.text || null,
    params.tool_id || null,
    params.action_id || null,
    params.label || null,
    params.result_text || null,
    params.state_before ? JSON.stringify(params.state_before) : null,
    params.state_after ? JSON.stringify(params.state_after) : null,
    Object.keys(payload).length > 0 ? JSON.stringify(payload) : null,
    params.input_source || 'text',
    params.audio_metadata ? JSON.stringify(params.audio_metadata) : null,
    params.started_at_ms ?? null,
    params.ended_at_ms ?? null,
    params.duration_ms ?? null,
  );

  return id;
}

export function getSessionEvents(sessionId: string): SessionEvent[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM session_events WHERE session_id = ? ORDER BY sequence_index ASC'
  ).all(sessionId) as any[];

  return rows.map(r => ({
    id: r.id,
    assessment_id: r.assessment_id,
    session_id: r.session_id,
    sequence_index: r.sequence_index,
    event_type: r.event_type as SessionEventType,
    actor: r.actor as SessionActor,
    text: r.text,
    tool_id: r.tool_id,
    action_id: r.action_id,
    label: r.label,
    result_text: r.result_text,
    state_before_json: r.state_before_json ? JSON.parse(r.state_before_json) : null,
    state_after_json: r.state_after_json ? JSON.parse(r.state_after_json) : null,
    payload_json: r.payload_json ? JSON.parse(r.payload_json) : null,
    started_at_ms: r.started_at_ms,
    ended_at_ms: r.ended_at_ms,
    duration_ms: r.duration_ms,
    created_at: r.created_at,
  }));
}

export function getSessionEventCount(sessionId: string): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as c FROM session_events WHERE session_id = ?').get(sessionId) as { c: number };
  return row.c;
}
