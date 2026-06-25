import { getDb } from '../db';
import { SimEvent, SimEventType } from './types';

export function insertSimEvent(params: {
  session_id: string;
  assessment_id: string;
  assessment_pack_id: string | null;
  event_type: SimEventType;
  actor: string;
  tool_id?: string | null;
  action_id?: string | null;
  label?: string | null;
  result_text?: string | null;
  state_before?: Record<string, unknown> | null;
  state_after?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
  timestamp_ms?: number | null;
}): string {
  const db = getDb();
  const id = 'sev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

  const maxSeq = db.prepare(
    'SELECT COALESCE(MAX(sequence_index), -1) as max_seq FROM sim_events WHERE session_id = ?'
  ).get(params.session_id) as { max_seq: number };

  const seqIndex = maxSeq.max_seq + 1;

  db.prepare(`INSERT INTO sim_events
    (id, session_id, assessment_id, assessment_pack_id, sequence_index, event_type, actor, tool_id, action_id, label, result_text, state_before_json, state_after_json, payload_json, timestamp_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id,
    params.session_id,
    params.assessment_id,
    params.assessment_pack_id,
    seqIndex,
    params.event_type,
    params.actor,
    params.tool_id || null,
    params.action_id || null,
    params.label || null,
    params.result_text || null,
    params.state_before ? JSON.stringify(params.state_before) : null,
    params.state_after ? JSON.stringify(params.state_after) : null,
    params.payload ? JSON.stringify(params.payload) : null,
    params.timestamp_ms || null,
  );

  return id;
}

export function getSimEvents(sessionId: string): SimEvent[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM sim_events WHERE session_id = ? ORDER BY sequence_index ASC'
  ).all(sessionId) as any[];

  return rows.map(r => ({
    id: r.id,
    session_id: r.session_id,
    assessment_id: r.assessment_id,
    assessment_pack_id: r.assessment_pack_id,
    sequence_index: r.sequence_index,
    event_type: r.event_type as SimEventType,
    actor: r.actor,
    tool_id: r.tool_id,
    action_id: r.action_id,
    label: r.label,
    result_text: r.result_text,
    state_before_json: r.state_before_json ? JSON.parse(r.state_before_json) : null,
    state_after_json: r.state_after_json ? JSON.parse(r.state_after_json) : null,
    payload_json: r.payload_json ? JSON.parse(r.payload_json) : null,
    timestamp_ms: r.timestamp_ms,
    created_at: r.created_at,
  }));
}

export function getSimEventCount(sessionId: string): number {
  const db = getDb();
  const result = db.prepare('SELECT COUNT(*) as c FROM sim_events WHERE session_id = ?').get(sessionId) as { c: number };
  return result.c;
}
