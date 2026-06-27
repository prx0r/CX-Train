import { NextRequest, NextResponse } from 'next/server';
import { initTables, getDb } from '@/lib/mvp/db';
import { getFullAssessment, getAssessmentPack } from '@/lib/mvp/query';
import { buildTimeline } from '@/lib/mvp/sim/timeline';
import { getPackById } from '@/lib/mvp/sim/packRegistry';
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

    /* Multi-framework compliance + category scores from assessment_results */
    if (full.assessment) {
      const db = getDb();
      const ar = db.prepare(`
        SELECT compliance_json, category_scores_json, recording_analysis_json, recording_path
        FROM assessment_results WHERE assessment_id = ? ORDER BY created_at DESC LIMIT 1
      `).get(params.id) as { compliance_json?: string; category_scores_json?: string; recording_analysis_json?: string; recording_path?: string } | undefined;
      if (ar) {
        if (ar.compliance_json) result.complianceData = JSON.parse(ar.compliance_json);
        if (ar.category_scores_json) result.categoryScores = JSON.parse(ar.category_scores_json);
        if (ar.recording_analysis_json) result.recordingAnalysis = JSON.parse(ar.recording_analysis_json);
        if (ar.recording_path) result.recordingPath = ar.recording_path;
      }
    }

    /* Canonical event stream from session_events */
    if (full.session) {
      const sessionEvents = getSessionEvents(full.session.id);
      result.evidenceTimeline = buildEvidenceTimeline(sessionEvents);
      result.timingMetrics = calculateTimingMetrics(sessionEvents);
      result.sessionEventCount = sessionEvents.length;
    }

    if (assessmentMode === 'dashboard_sim' && full.session) {
      const db = getDb();
      const packId = (full.assessment as any).assessment_pack_id || 'pack-outlook-sim-v2';

      const simSession = db.prepare('SELECT * FROM sim_sessions WHERE session_id = ?').get(full.session.id) as any;

      if (simSession) {
        result.simSession = {
          id: simSession.id,
          current_state: simSession.current_state_json ? JSON.parse(simSession.current_state_json) : null,
          final_state: simSession.final_state_json ? JSON.parse(simSession.final_state_json) : null,
          completed_at: simSession.completed_at,
        };

        try {
          const pack = getPackById(packId);
          result.simConfig = { tools: pack.tools };
          result.simRedFlagActions = pack.actions.filter(a => a.redFlag).map(a => ({
            id: a.id,
            label: a.label,
            redFlag: a.redFlag,
          }));
        } catch {
          /* Fall back to DB pack if code pack not found */
          const pack = packId ? getAssessmentPack(packId) : null;
          if (pack && pack.sim_config_json) {
            const config = JSON.parse(pack.sim_config_json);
            result.simConfig = { tools: config.tools };
            result.simRedFlagActions = (config.actions || []).filter((a: any) => a.red_flag).map((a: any) => ({ id: a.id, label: a.label, red_flag: a.red_flag }));
          }
        }

        /* Timeline from canonical session_events */
        const canonicalEvents = getSessionEvents(full.session.id);
        const typedEvents = canonicalEvents.map((e: any) => ({
          ...e,
          sequence: e.sequence_index,
          started_at_ms: e.started_at_ms,
        }));
        result.simTimeline = buildTimeline(typedEvents as any).map(t => ({
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
