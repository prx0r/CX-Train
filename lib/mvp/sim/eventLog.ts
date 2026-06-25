import { getDb } from '../db';
import { appendSessionEvent, getSessionEvents } from '../events/eventLog';
import { SimPackEvent, SimEventType, SimRedFlag } from './types';

export function insertSimEvent(params: {
  session_id: string;
  assessment_id: string;
  assessment_pack_id: string | null;
  event_type: SimEventType;
  actor: 'candidate' | 'customer' | 'system' | 'simulator' | 'analysis';
  tool_id?: string | null;
  action_id?: string | null;
  label?: string | null;
  text?: string | null;
  result_text?: string | null;
  state_before?: Record<string, unknown> | null;
  state_after?: Record<string, unknown> | null;
  evidence_tags?: string[] | null;
  red_flag?: SimRedFlag | null;
  started_at_ms?: number | null;
  ended_at_ms?: number | null;
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
    params.evidence_tags ? JSON.stringify(params.evidence_tags) : null,
    params.started_at_ms || null,
  );

  /* Also append to canonical session_events table */
  appendSessionEvent({
    assessment_id: params.assessment_id,
    session_id: params.session_id,
    event_type: params.event_type as any,
    actor: params.actor as any,
    text: params.text || null,
    tool_id: params.tool_id || null,
    action_id: params.action_id || null,
    label: params.label || null,
    result_text: params.result_text || null,
    state_before: params.state_before || null,
    state_after: params.state_after || null,
    payload: params.evidence_tags ? { evidence_tags: params.evidence_tags, red_flag: params.red_flag } : params.red_flag ? { red_flag: params.red_flag } : null,
    started_at_ms: params.started_at_ms ?? null,
    ended_at_ms: params.ended_at_ms ?? null,
  });

  return id;
}

export { getSessionEvents as getSimEvents };

export function getSimEventCount(sessionId: string): number {
  const db = getDb();
  const result = db.prepare('SELECT COUNT(*) as c FROM sim_events WHERE session_id = ?').get(sessionId) as { c: number };
  return result.c;
}
