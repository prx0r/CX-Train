import { getDb } from '../db';

/**
 * Map analysis criteria to support workflow competencies.
 * This is the source of truth — the competency mapping test imports this.
 * criterion_id → competency_id[] (many-to-many)
 */
export const CRITERION_COMPETENCY_MAP: Record<string, string[]> = {
  identity_check: ['customer-empathy'],
  company_check: ['active-listening'],
  issue_clarification: ['active-listening', 'call-control'],
  started_when: ['scope-discovery', 'evidence-gathering'],
  impact: ['impact-discovery'],
  urgency: ['priority-triage'],
  scope: ['scope-discovery'],
  technical_discovery: ['evidence-gathering', 'hypothesis-testing'],
  error_or_status_capture: ['evidence-gathering'],
  recent_changes: ['evidence-gathering', 'hypothesis-testing'],
  next_steps: ['next-step-setting'],
  customer_tone: ['customer-empathy'],
  professional_conduct: ['call-control'],
  customer_communication: ['plain-english', 'active-listening'],
  ticket_user_company: ['ticket-documentation'],
  ticket_issue_summary: ['ticket-documentation'],
  ticket_impact: ['ticket-documentation', 'impact-discovery'],
  ticket_urgency: ['ticket-documentation', 'priority-triage'],
  ticket_checks_attempted: ['ticket-documentation'],
  ticket_next_step: ['ticket-documentation', 'next-step-setting'],
  escalation_judgement: ['escalation-quality'],
  safety: ['escalation-quality'],
  performed_triage: ['scope-discovery', 'impact-discovery'],
  submitted_ticket: ['ticket-documentation'],
  /* Red-flag criteria — mapped to escalation-quality since they involve judgement calls */
  unsafe_security_behaviour: ['escalation-quality'],
  severe_customer_abuse: ['escalation-quality', 'customer-empathy'],
  refusal_to_help: ['escalation-quality'],
  hallucinated_fix: ['escalation-quality', 'hypothesis-testing'],
  unsafe_advice: ['escalation-quality'],
  invented_fix_without_evidence: ['escalation-quality', 'evidence-gathering'],
  no_troubleshooting: ['escalation-quality', 'hypothesis-testing'],
};

/**
 * After analysis completes, explode the structured result into
 * attempt_competency_scores, attempt_criterion_results, and
 * attempt_criterion_competencies.
 *
 * Normalized scoring is derived data — this function uses delete-and-rebuild
 * for the attempt so it is fully idempotent and safe to rerun.
 * Called from the ticket submission route after runBaseCallumAnalysis().
 *
 * This makes every call queryable by competency, criterion, and trend.
 */
export function normalizeAnalysisScores(assessmentId: string, analysisResult: any): void {
  const db = getDb();

  const structured = analysisResult?.structured;
  if (!structured) return;

  const rawCriteria = structured.evidence_extraction?.criteria as Record<string, { status: string; evidence?: string[]; notes?: string }> | undefined;
  const score = structured.deterministic_score;
  const skillBreakdown = score?.skillBreakdown as Record<string, { score: number; maxScore: number; percent: number }> | undefined;

  if (!rawCriteria || !skillBreakdown) return;

  /* Delete existing derived rows for this attempt (idempotent rebuild) */
  db.prepare('DELETE FROM attempt_criterion_competencies WHERE attempt_id = ?').run(assessmentId);
  db.prepare('DELETE FROM attempt_competency_scores WHERE attempt_id = ?').run(assessmentId);
  db.prepare('DELETE FROM attempt_criterion_results WHERE attempt_id = ?').run(assessmentId);

  /* Track per-competency accumulated scores */
  const compScores: Record<string, { earned: number; max: number; evidence: number; missed: number }> = {};

  /* Insert criterion result (one row per criterion, stores primary competency + evidence) */
  const insertCriterion = db.prepare(`
    INSERT INTO attempt_criterion_results
      (attempt_id, criterion_id, competency_id, status, score, max_score,
       evidence_event_ids_json, evidence_message_ids_json, evidence_quotes_json, explanation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  /* Insert bridge table rows (one row per criterion × competency mapping) */
  const insertBridge = db.prepare(`
    INSERT INTO attempt_criterion_competencies
      (attempt_id, criterion_id, competency_id)
    VALUES (?, ?, ?)
  `);

  /* Load messages and events for evidence ID resolution */
  const sessionRow = db.prepare(
    'SELECT id FROM sessions WHERE assessment_id = ? ORDER BY started_at DESC LIMIT 1'
  ).get(assessmentId) as { id: string } | undefined;
  const allMessages = sessionRow
    ? db.prepare('SELECT id, content FROM messages WHERE session_id = ?').all(sessionRow.id) as Array<{ id: string; content: string }>
    : [];
  const allEvents = sessionRow
    ? db.prepare('SELECT id, text, label, result_text FROM session_events WHERE session_id = ?').all(sessionRow.id) as Array<{ id: string; text: string | null; label: string | null; result_text: string | null }>
    : [];

  function resolveEvidenceIds(quotes: string[]): { messageIds: string[]; eventIds: string[] } {
    const messageIds: string[] = [];
    const eventIds: string[] = [];
    for (const q of quotes) {
      const qLower = q.toLowerCase().trim();
      if (!qLower) continue;
      for (const m of allMessages) {
        if (m.content.toLowerCase().includes(qLower) || qLower.includes(m.content.toLowerCase().trim())) {
          if (!messageIds.includes(m.id)) messageIds.push(m.id);
        }
      }
      for (const e of allEvents) {
        const eText = [e.text, e.label, e.result_text].filter(Boolean).join(' ').toLowerCase();
        if (eText.includes(qLower)) {
          if (!eventIds.includes(e.id)) eventIds.push(e.id);
        }
      }
    }
    return { messageIds, eventIds };
  }

  for (const [criterionId, criterion] of Object.entries(rawCriteria)) {
    const skillEntry = skillBreakdown[criterionId];
    const earned = skillEntry?.score ?? (criterion.status === 'pass' ? 1 : criterion.status === 'partial' ? 0.5 : 0);
    const maxScore = skillEntry?.maxScore ?? 1;
    const status = criterion.status;
    const matchedComps = CRITERION_COMPETENCY_MAP[criterionId] || [];

    /* Extract evidence from AI output */
    const evidenceQuotes = criterion.evidence || [];
    const explanation = criterion.notes || (evidenceQuotes.length > 0 ? evidenceQuotes[0] : null);
    const evidenceQuotesJson = evidenceQuotes.length > 0 ? JSON.stringify(evidenceQuotes) : null;

    /* Resolve evidence quotes to actual message/event IDs */
    const { messageIds, eventIds } = resolveEvidenceIds(evidenceQuotes);
    const evidenceMessageIdsJson = messageIds.length > 0 ? JSON.stringify(messageIds) : null;
    const evidenceEventIdsJson = eventIds.length > 0 ? JSON.stringify(eventIds) : null;

    /* Insert one row per criterion with primary competency and evidence */
    insertCriterion.run(
      assessmentId, criterionId, matchedComps[0] || null,
      status, earned, maxScore,
      evidenceEventIdsJson,
      evidenceMessageIdsJson,
      evidenceQuotesJson,
      explanation
    );

    /* Insert bridge rows for ALL competency mappings (many-to-many) */
    for (const compId of matchedComps) {
      insertBridge.run(assessmentId, criterionId, compId);

      if (!compScores[compId]) compScores[compId] = { earned: 0, max: 0, evidence: 0, missed: 0 };
      compScores[compId].earned += earned;
      compScores[compId].max += maxScore;
      compScores[compId].evidence += status === 'pass' ? 1 : 0;
      compScores[compId].missed += status === 'fail' ? 1 : 0;
    }
  }

  /* Insert competency scores (aggregated, one per attempt × competency) */
  const insertCompScore = db.prepare(`
    INSERT INTO attempt_competency_scores
      (attempt_id, competency_id, raw_score, normalized_score, max_score, evidence_count, missed_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();

  for (const [compId, data] of Object.entries(compScores)) {
    const normalized = data.max > 0 ? Math.round((data.earned / data.max) * 100) : 0;
    insertCompScore.run(assessmentId, compId, data.earned, normalized, data.max, data.evidence, data.missed);
  }

  /* Update candidate aggregate stats for profile trends */
  const userId = db.prepare(
    'SELECT candidate_user_id FROM assessments WHERE id = ?'
  ).get(assessmentId) as { candidate_user_id: string | null } | undefined;

  if (userId?.candidate_user_id) {
    const upsertStats = db.prepare(`
      INSERT INTO candidate_competency_stats
        (user_id, competency_id, attempts_count, best_score, average_score, latest_score, last_attempt_at)
      VALUES (?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT(user_id, competency_id) DO UPDATE SET
        attempts_count = attempts_count + 1,
        best_score = MAX(best_score, excluded.best_score),
        average_score = (average_score * attempts_count + excluded.average_score) / (attempts_count + 1),
        latest_score = excluded.latest_score,
        last_attempt_at = excluded.last_attempt_at
    `);

    for (const [compId, data] of Object.entries(compScores)) {
      const normalized = data.max > 0 ? Math.round((data.earned / data.max) * 100) : 0;
      upsertStats.run(userId.candidate_user_id, compId, normalized, normalized, normalized, now);
    }
  }
}
