/**
 * POST /api/mvp/test/assess
 *
 * Creates a test assessment, seeds mock events, submits a ticket,
 * and triggers the full analysis pipeline including compliance scoring.
 *
 * Body (optional):
 *   packId: string — defaults to "pack-outlook-sim-v2"
 *   ticketText: string — defaults to a realistic test ticket
 *
 * Returns:
 *   assessment_id, invite_token, invite_url,
 *   analysis results, compliance breakdown
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, initTables, seedDefaults } from '@/lib/mvp/db';
import { makeId, getActiveScenario, getActiveCriteria } from '@/lib/mvp/query';
import { getPackById } from '@/lib/mvp/sim/packRegistry';
import { ENABLED_TRAINING_DRILL_PACKS } from '@/lib/mvp/assignment-types';
import { buildPackSnapshot } from '@/lib/mvp/sim/snapshot';
import type { CombinedComplianceResult } from '@/lib/mvp/compliance/evaluator';

const DEFAULT_TICKET = `Issue: Outlook stuck in Work Offline mode — cannot send emails
Requester: Sarah Thompson, Accounts, Connexion Dental
Impact: Cannot send invoices. Client deadline is this morning.
Checks: Opened Outlook, checked connection status (Working Offline), checked webmail (works), disabled Work Offline, cleared Outbox (3 stuck emails)
Resolution: Disabled Work Offline in Outlook. Sent test email — customer confirmed receipt. Outbox cleared.
Next Steps: Customer to restart Outlook after lunch. Escalated if issue recurs.`;

export async function POST(request: NextRequest) {
  console.log('[TEST] Starting request');
  try { initTables(); console.log('[TEST] initTables OK'); } catch (e: any) { console.error('[TEST] initTables failed:', e.message); return NextResponse.json({ error: `initTables: ${e.message}` }, { status: 500 }); }
  try { seedDefaults(); console.log('[TEST] seedDefaults OK'); } catch (e: any) { console.error('[TEST] seedDefaults failed:', e.message); return NextResponse.json({ error: `seedDefaults: ${e.message}` }, { status: 500 }); }
  try {
    console.log('[TEST] Body parsing');

    const body = await request.json().catch(() => ({}));
    const packId: string = body.packId || 'pack-outlook-sim-v2';

    if (!ENABLED_TRAINING_DRILL_PACKS.includes(packId)) {
      return NextResponse.json({
        error: `Unsupported pack. Supported: ${ENABLED_TRAINING_DRILL_PACKS.join(', ')}`,
        supportedPacks: ENABLED_TRAINING_DRILL_PACKS,
      }, { status: 400 });
    }

    const pack = getPackById(packId);
    const snapshot = buildPackSnapshot(pack);
    const db = getDb();

    /* ── Create assessment ── */
    const assessmentId = makeId();
    const sessionId = makeId();
    const inviteToken = makeId();
    const firstMessage = snapshot.customer.opening_line;

    const stmts: Array<{ sql: string; params: any[] }> = [];

    stmts.push({
      sql: `INSERT INTO assessments (id, title, candidate_name, invite_token, status, assessment_pack_id, assessment_mode, assignment_type, pack_snapshot_json, created_at)
        VALUES (?, ?, ?, ?, 'invited', ?, 'dashboard_sim', 'training_drill', ?, datetime('now'))`,
      params: [assessmentId, `Test: ${pack.title}`, 'Test Candidate', inviteToken, packId, JSON.stringify(snapshot)],
    });

    stmts.push({
      sql: `INSERT INTO sessions (id, assessment_id, status, started_at) VALUES (?, ?, 'in_progress', datetime('now'))`,
      params: [sessionId, assessmentId],
    });

    stmts.push({
      sql: `INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, 'caller', ?, datetime('now'))`,
      params: [makeId(), sessionId, firstMessage],
    });

    const simSessionId = makeId();
    stmts.push({
      sql: `INSERT INTO sim_sessions (id, session_id, assessment_id, assessment_pack_id, current_state_json, started_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      params: [simSessionId, sessionId, assessmentId, packId, JSON.stringify(pack.initialState)],
    });

    /* Sim events */
    const labels = ['sim_started', 'action_performed:Claim ticket', 'action_performed:Start call',
      'action_performed:Open Outlook', 'action_performed:Check Outlook status',
      'action_performed:Disable Work Offline', 'action_performed:Send test email',
      'ticket_triage_submitted:Triage submitted', 'ticket_submitted:Ticket submitted'];
    for (const l of labels) {
      const [evt, lab] = l.includes(':') ? l.split(':') : [l, l];
      stmts.push({
        sql: `INSERT INTO sim_events (id, session_id, assessment_id, assessment_pack_id, sequence_index, event_type, actor, label, state_after_json, created_at)
          VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sequence_index), 0) + 1 FROM sim_events WHERE session_id = ?), ?, 'candidate', ?, '{}', datetime('now'))`,
        params: [makeId(), sessionId, assessmentId, packId, sessionId, evt, lab],
      });
    }

    const ticketText = body.ticketText || DEFAULT_TICKET;
    stmts.push({
      sql: `INSERT INTO tickets (id, session_id, candidate_ticket_text, created_at) VALUES (?, ?, ?, datetime('now'))`,
      params: [makeId(), sessionId, ticketText],
    });
    stmts.push({
      sql: `INSERT INTO session_events (id, assessment_id, session_id, sequence_index, event_type, actor, text, label, started_at_ms, created_at)
        VALUES (?, ?, ?, (SELECT COALESCE(MAX(sequence_index), 0) + 1 FROM session_events WHERE session_id = ?), ?, ?, ?, ?, ?, datetime('now'))`,
      params: [makeId(), assessmentId, sessionId, sessionId, 'ticket_submitted', 'candidate', ticketText, 'Ticket submitted', Date.now()],
    });

    /* Update sim session to submitted */
    const stateCopy = JSON.parse(JSON.stringify(pack.initialState));
    stateCopy.phase = 'submitted';
    stmts.push({
      sql: `UPDATE sim_sessions SET current_state_json = ?, completed_at = datetime('now'), final_state_json = ? WHERE id = ?`,
      params: [JSON.stringify(stateCopy), JSON.stringify(stateCopy), simSessionId],
    });
    stmts.push({
      sql: `UPDATE assessments SET status = ? WHERE id = ?`,
      params: ['completed', assessmentId],
    });

    /* Execute all statements with error reporting */
    for (const stmt of stmts) {
      try {
        db.prepare(stmt.sql).run(...stmt.params);
      } catch (e: any) {
        console.error('[TEST] SQL error:', stmt.sql.substring(0, 80), 'Params:', JSON.stringify(stmt.params).substring(0, 200), 'Error:', e.message);
        return NextResponse.json({ error: `SQL at step ${stmts.indexOf(stmt)}: ${e.message}` }, { status: 500 });
      }
    }

    /* ── Trigger AI analysis ── */
    let analysisResult: any = { status: 'analysis_failed', error: 'Analysis not triggered' };
    let candidateAnalysis: any = null;
    let complianceResult: CombinedComplianceResult | null = null;

    try {
      const { runBaseCallumAnalysis, buildCandidateAnalysis } = await import('@/lib/mvp/analysis/runBaseCallumAnalysis');
      analysisResult = await runBaseCallumAnalysis(assessmentId);

      if (analysisResult.status === 'analysed') {
        complianceResult = analysisResult.compliance || null;
        candidateAnalysis = buildCandidateAnalysis(analysisResult, pack);
      }
    } catch (err) {
      console.error('[Test] Analysis error:', err);
      analysisResult = { status: 'analysis_failed', error: String(err) };
    }

    /* ── Build response ── */
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'http://localhost:3000';
    const inviteUrl = `${baseUrl}/mvp/assessment/${inviteToken}`;

    return NextResponse.json({
      ok: true,
      assessment: {
        id: assessmentId,
        invite_token: inviteToken,
        invite_url: inviteUrl,
        pack_id: packId,
        pack_title: pack.title,
      },
      analysis: {
        status: analysisResult.status,
        overall_score: analysisResult.overall_score,
        readiness_label: analysisResult.readiness_label,
        summary: analysisResult.summary,
        error: analysisResult.error,
        candidate_analysis: candidateAnalysis ? {
          verdict: candidateAnalysis.verdict,
          score: candidateAnalysis.overall_score,
          verdictLine: candidateAnalysis.verdictLine,
          bonus: candidateAnalysis.bonus,
          coreEarned: candidateAnalysis.coreEarned,
          maxCore: candidateAnalysis.maxCore,
        } : null,
      },
      compliance: complianceResult ? {
        combinedScore: complianceResult.combinedScore,
        combinedVerdict: complianceResult.combinedVerdict,
        certifiedFrameworks: complianceResult.certifiedFrameworks,
        failedFrameworks: complianceResult.failedFrameworks,
        summary: complianceResult.summary,
        frameworks: complianceResult.frameworks.map((fw: any) => ({
          name: fw.frameworkName,
          score: fw.score,
          passed: fw.passed,
          summary: fw.summary,
          criticalFailures: fw.criticalFailures,
        })),
      } : null,
    });
  } catch (err) {
    console.error('[Test] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
