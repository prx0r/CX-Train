import { NextRequest, NextResponse } from 'next/server';
import { initTables, getDb } from '@/lib/mvp/db';
import { getFullAssessment } from '@/lib/mvp/query';
import { getPackById } from '@/lib/mvp/sim/packRegistry';
import { getVisibleActions, getVisibleState } from '@/lib/mvp/sim/safeProjection';
import { buildTimeline } from '@/lib/mvp/sim/timeline';
import { getSessionEvents } from '@/lib/mvp/events/eventLog';

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    initTables();
    const full = getFullAssessment(params.token, true);
    if (!full || !full.session) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const packId = (full.assessment as any).assessment_pack_id || 'pack-outlook-sim-v2';
    const pack = getPackById(packId);

    const db = getDb();
    const simSession = db.prepare('SELECT current_state_json FROM sim_sessions WHERE session_id = ?').get(full.session.id) as any;
    const currentState = simSession
      ? JSON.parse(simSession.current_state_json)
      : pack.initialState;

    /* Read canonical event stream from session_events */
    const canonicalEvents = getSessionEvents(full.session.id);
    const typedEvents = canonicalEvents.map((e: any) => ({
      ...e,
      sequence: e.sequence_index,
      state_before_json: e.state_before_json || null,
      state_after_json: e.state_after_json || null,
      started_at_ms: e.started_at_ms,
    }));

    const visibleState = getVisibleState(currentState, pack);
    const safeActions = getVisibleActions(currentState, pack.actions);

    return NextResponse.json({
      ok: true,
      data: {
        tools: pack.tools,
        safe_actions: safeActions,
        visible_state: visibleState,
        phase: currentState.phase,
        timeline: buildTimeline(typedEvents as any).map(t => ({
          sequence: t.sequence,
          event_type: t.event_type,
          actor: t.actor,
          formatted_time: t.formatted_time,
          label: t.label,
          result_text: t.result_text,
          is_red_flag: t.is_red_flag,
        })),
      },
    });
  } catch (err) {
    console.error('[MVP] Get sim error:', err);
    return NextResponse.json({ error: 'Failed to get sim state' }, { status: 500 });
  }
}
