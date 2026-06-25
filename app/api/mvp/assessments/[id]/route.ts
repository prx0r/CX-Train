import { NextRequest, NextResponse } from 'next/server';
import { initTables, getDb } from '@/lib/mvp/db';
import { getFullAssessment, getAssessmentPack } from '@/lib/mvp/query';
import { buildTimeline } from '@/lib/mvp/sim/timeline';
import { getOutlookWorkOfflinePack } from '@/lib/mvp/sim/packConfig';
import { getSessionEvents } from '@/lib/mvp/events/eventLog';
import { buildEvidenceTimeline, calculateTimingMetrics } from '@/lib/mvp/events/timeline';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    initTables();
    const full = getFullAssessment(params.id);
    if (!full) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const assessmentMode = (full.assessment as any).assessment_mode || 'chat_call';
    const result: any = { ...full, assessment_mode: assessmentMode };

    if (full.session) {
      const sessionEvents = getSessionEvents(full.session.id);
      result.evidenceTimeline = buildEvidenceTimeline(sessionEvents);
      result.timingMetrics = calculateTimingMetrics(sessionEvents);
      result.sessionEventCount = sessionEvents.length;
    }

    if (assessmentMode === 'dashboard_sim' && full.session) {
      const db = getDb();
      const rawEvents: any[] = db.prepare(
        'SELECT * FROM sim_events WHERE session_id = ? ORDER BY sequence_index ASC'
      ).all(full.session.id) as any[];

      const simSession = db.prepare('SELECT * FROM sim_sessions WHERE session_id = ?').get(full.session.id) as any;

      if (simSession) {
        result.simSession = {
          id: simSession.id,
          current_state: simSession.current_state_json ? JSON.parse(simSession.current_state_json) : null,
          final_state: simSession.final_state_json ? JSON.parse(simSession.final_state_json) : null,
          completed_at: simSession.completed_at,
          event_count: rawEvents.length,
        };

        const packId = (full.assessment as any).assessment_pack_id;
        const pack = packId ? getAssessmentPack(packId) : null;
        if (pack && pack.sim_config_json) {
          const config = JSON.parse(pack.sim_config_json);
          result.simConfig = { tools: config.tools };
          result.simRedFlagActions = (config.actions || []).filter((a: any) => a.red_flag).map((a: any) => ({ id: a.id, label: a.label, red_flag: a.red_flag }));
        }

        result.simTimeline = buildTimeline(rawEvents as any).map(t => ({
          sequence: t.sequence,
          actor: t.actor,
          label: t.label,
          result_text: t.result_text,
          formatted_time: t.formatted_time,
          is_red_flag: t.is_red_flag,
        }));
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[MVP] Get assessment detail error:', err);
    return NextResponse.json({ error: 'Failed to get assessment detail' }, { status: 500 });
  }
}
