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
 * attempt_competency_scores and attempt_criterion_results.
 *
 * This makes every call queryable by competency, criterion, and trend.
 * Called from the ticket submission route after runBaseCallumAnalysis().
 */
export function normalizeAnalysisScores(assessmentId: string, analysisResult: any): void {
  const db = getDb();

  const structured = analysisResult?.structured;
  if (!structured) return;

  const rawCriteria = structured.evidence_extraction?.criteria as Record<string, { status: string; evidence?: string[]; notes?: string }> | undefined;
  const score = structured.deterministic_score;
  const skillBreakdown = score?.skillBreakdown as Record<string, { score: number; maxScore: number; percent: number }> | undefined;

  if (!rawCriteria || !skillBreakdown) return;

  /* Track per-competency accumulated scores */
  const compScores: Record<string, { earned: number; max: number; evidence: number; missed: number }> = {};

  /* Insert criterion result (one row per criterion, stores primary competency + evidence) */
  const insertCriterion = db.prepare(`
    INSERT OR REPLACE INTO attempt_criterion_results
      (attempt_id, criterion_id, competency_id, status, score, max_score,
       evidence_event_ids_json, evidence_message_ids_json, explanation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  /* Insert bridge table rows (one row per criterion × competency mapping) */
  const insertBridge = db.prepare(`
    INSERT OR IGNORE INTO attempt_criterion_competencies
      (attempt_id, criterion_id, competency_id)
    VALUES (?, ?, ?)
  `);

  for (const [criterionId, criterion] of Object.entries(rawCriteria)) {
    const skillEntry = skillBreakdown[criterionId];
    const earned = skillEntry?.score ?? (criterion.status === 'pass' ? 1 : criterion.status === 'partial' ? 0.5 : 0);
    const maxScore = skillEntry?.maxScore ?? 1;
    const status = criterion.status;
    const matchedComps = CRITERION_COMPETENCY_MAP[criterionId] || [];

    /* Extract evidence from AI output */
    const evidenceQuotes = criterion.evidence || [];
    const explanation = criterion.notes || (evidenceQuotes.length > 0 ? evidenceQuotes[0] : null);
    const evidenceMessageIds = evidenceQuotes.length > 0 ? JSON.stringify(evidenceQuotes) : null;

    /* Insert one row per criterion with primary competency and evidence */
    insertCriterion.run(
      assessmentId, criterionId, matchedComps[0] || null,
      status, earned, maxScore,
      null, evidenceMessageIds, explanation
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
    INSERT OR REPLACE INTO attempt_competency_scores
      (attempt_id, competency_id, raw_score, normalized_score, max_score, evidence_count, missed_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const [compId, data] of Object.entries(compScores)) {
    const normalized = data.max > 0 ? Math.round((data.earned / data.max) * 100) : 0;
    insertCompScore.run(assessmentId, compId, data.earned, normalized, data.max, data.evidence, data.missed);
  }
}
