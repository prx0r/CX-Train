import { NextRequest, NextResponse } from 'next/server';
import { initTables, getDb } from '@/lib/mvp/db';
import { getFullAssessment } from '@/lib/mvp/query';
import { applyAction } from '@/lib/mvp/sim/stateMachine';
import { insertSimEvent } from '@/lib/mvp/sim/eventLog';
import { getVisibleActions, getVisibleState } from '@/lib/mvp/sim/safeProjection';
import { buildTimeline } from '@/lib/mvp/sim/timeline';
import { getSessionEvents } from '@/lib/mvp/events/eventLog';
import { getCapabilitiesForType } from '@/lib/mvp/assignment-types';
import { resolveSimAction, SimResolutionError, getSnapshotFromAssessment } from '@/lib/mvp/sim/resolver';
import type { PackSnapshot } from '@/lib/mvp/sim/snapshot';

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    initTables();
    const full = getFullAssessment(params.token, true);
    if (!full || !full.session) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const assessment = full.assessment as unknown as Record<string, unknown>;

    /* Load snapshot for pack data (no fallback — error if missing) */
    let snapshot: PackSnapshot;
    try {
      snapshot = getSnapshotFromAssessment(assessment);
    } catch (err) {
      if (err instanceof SimResolutionError) {
        return NextResponse.json({ error: err.message }, { status: err.code === 'NOT_A_SIM_ASSESSMENT' ? 404 : 500 });
      }
      throw err;
    }

    /* Check capability from frozen snapshot (already derived from pack mode at creation) */
    if (!snapshot.capabilities.remoteDesktop) {
      return NextResponse.json({ error: 'Remote tool actions are not enabled for this pack' }, { status: 400 });
    }

    const body = await request.json();
    const actionId = body.action_id as string;
    const startedAtMs = body.started_at_ms || Date.now();

    if (!actionId) {
      return NextResponse.json({ error: 'action_id required' }, { status: 400 });
    }

    /* Resolve action from snapshot actions (not registry) */
    const action = snapshot.actions.find(a => a.id === actionId);
    if (!action) {
      return NextResponse.json({ error: `Action "${actionId}" not found in pack` }, { status: 400 });
    }

    const db = getDb();
    const simSession = db.prepare('SELECT id, current_state_json FROM sim_sessions WHERE session_id = ?')
      .get(full.session.id) as { id: string; current_state_json: string } | undefined;
    if (!simSession) {
      return NextResponse.json({ error: 'Sim session not found' }, { status: 404 });
    }

    const currentState = JSON.parse(simSession.current_state_json);

    /* Apply action through state machine */
    const { result, updatedState } = applyAction(currentState, action);

    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: result.result_text,
        errorCode: result.errorCode,
      }, { status: 400 });
    }

    /* Update sim session state */
    db.prepare('UPDATE sim_sessions SET current_state_json = ? WHERE id = ?').run(
      JSON.stringify(updatedState), simSession.id
    );

    /* Log action_performed event */
    insertSimEvent({
      session_id: full.session.id,
      assessment_id: full.assessment.id,
      assessment_pack_id: snapshot.pack_id,
      event_type: 'action_performed',
      actor: 'candidate',
      tool_id: action.tool,
      action_id: action.id,
      label: action.label,
      text: null,
      result_text: result.result_text,
      state_before: result.state_before,
      state_after: result.state_after,
      taxonomy_tags: result.taxonomyTags.length > 0 ? result.taxonomyTags : null,
      red_flag: result.redFlag,
      started_at_ms: startedAtMs,
    });

    /* Log observation_returned event */
    insertSimEvent({
      session_id: full.session.id,
      assessment_id: full.assessment.id,
      assessment_pack_id: snapshot.pack_id,
      event_type: 'observation_returned',
      actor: 'system',
      tool_id: action.tool,
      action_id: action.id,
      label: `${action.label} result`,
      result_text: result.result_text,
      started_at_ms: startedAtMs + 100,
    });

    /* Log red flag */
    if (result.redFlag) {
      insertSimEvent({
        session_id: full.session.id,
        assessment_id: full.assessment.id,
        assessment_pack_id: snapshot.pack_id,
        event_type: 'red_flag_triggered',
        actor: 'system',
        tool_id: action.tool,
        action_id: action.id,
        label: action.label,
        result_text: result.redFlag.message,
        state_after: result.state_after,
        red_flag: result.redFlag,
        started_at_ms: startedAtMs + 200,
      });
    }

    /* Log phase transition */
    if (result.phaseTransition) {
      insertSimEvent({
        session_id: full.session.id,
        assessment_id: full.assessment.id,
        assessment_pack_id: snapshot.pack_id,
        event_type: 'observation_returned',
        actor: 'system',
        label: `Phase: ${updatedState.phase}`,
        result_text: `Transitioned to ${updatedState.phase} phase`,
        started_at_ms: startedAtMs + 150,
      });
    }

    /* Build safe response from canonical session_events */
    const canonicalEvents = getSessionEvents(full.session.id);
    const typedEvents = canonicalEvents.map((e: any) => ({
      ...e,
      sequence: e.sequence_index,
      state_before_json: e.state_before_json || null,
      state_after_json: e.state_after_json || null,
      started_at_ms: e.started_at_ms,
    }));

    const visibleState = getVisibleState(updatedState, { actions: snapshot.actions } as any);
    const safeActions = getVisibleActions(updatedState, snapshot.actions);

    return NextResponse.json({
      ok: true,
      data: {
        event: {
          ok: result.ok,
          action_id: result.action_id,
          label: result.label,
          result_text: result.result_text,
          red_flag: result.redFlag,
        },
        visible_state: visibleState,
        safe_actions: safeActions,
        phase: updatedState.phase,
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
    console.error('[MVP] Sim action error:', err);
    return NextResponse.json({ error: 'Failed to process sim action' }, { status: 500 });
  }
}
