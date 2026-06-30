import { getDb } from '@/lib/mvp/db';

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

  const criteria = structured.evidence_extraction?.criteria as Record<string, { status: string }> | undefined;
  const score = structured.deterministic_score;
  const skillBreakdown = score?.skillBreakdown as Record<string, { score: number; maxScore: number; percent: number }> | undefined;

  if (!criteria || !skillBreakdown) return;

  /* Map analysis criteria to support workflow competencies */
  const CRITERION_COMPETENCY_MAP: Record<string, string[]> = {
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
  };

  /* Track per-competency accumulated scores */
  const compScores: Record<string, { earned: number; max: number; evidence: number; missed: number }> = {};

  /* Insert criterion results */
  const insertCriterion = db.prepare(`
    INSERT OR REPLACE INTO attempt_criterion_results
      (attempt_id, criterion_id, competency_id, status, score, max_score, explanation)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const [criterionId, criterion] of Object.entries(criteria)) {
    const skillEntry = skillBreakdown[criterionId];
    const earned = skillEntry?.score ?? (criterion.status === 'pass' ? 1 : criterion.status === 'partial' ? 0.5 : 0);
    const maxScore = skillEntry?.maxScore ?? 1;
    const status = criterion.status;
    const matchedComps = CRITERION_COMPETENCY_MAP[criterionId] || [];

    insertCriterion.run(assessmentId, criterionId, matchedComps[0] || null, status, earned, maxScore, null);

    for (const compId of matchedComps) {
      if (!compScores[compId]) compScores[compId] = { earned: 0, max: 0, evidence: 0, missed: 0 };
      compScores[compId].earned += earned;
      compScores[compId].max += maxScore;
      compScores[compId].evidence += status === 'pass' ? 1 : 0;
      compScores[compId].missed += status === 'fail' ? 1 : 0;
    }
  }

  /* Insert competency scores */
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
