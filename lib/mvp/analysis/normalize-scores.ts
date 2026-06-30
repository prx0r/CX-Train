import { getDb } from '@/lib/mvp/db';

/**
 * After analysis completes, explode the structured result into
 * attempt_skill_scores and attempt_criterion_results.
 *
 * This is what makes every call queryable by skill, criterion, and trend.
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

  /* Map analysis criteria to skill IDs using the criteria-to-skill mapping */
  const CRITERION_SKILL_MAP: Record<string, string[]> = {
    identity_check: ['empathy'],
    company_check: ['active-listening'],
    issue_clarification: ['active-listening', 'call-control'],
    started_when: ['scope-discovery'],
    impact: ['impact-discovery'],
    urgency: ['urgency-triage'],
    scope: ['scope-discovery'],
    technical_discovery: ['outlook-desktop', 'active-directory', 'm365'],
    error_or_status_capture: ['outlook-desktop', 'exchange-online'],
    recent_changes: ['active-directory', 'm365'],
    next_steps: ['next-steps'],
    customer_tone: ['empathy', 'de-escalation'],
    professional_conduct: ['call-control'],
    customer_communication: ['plain-english', 'active-listening'],
    ticket_user_company: ['ticket-documentation'],
    ticket_issue_summary: ['ticket-documentation'],
    ticket_impact: ['ticket-documentation', 'impact-discovery'],
    ticket_urgency: ['ticket-documentation', 'urgency-triage'],
    ticket_checks_attempted: ['ticket-documentation'],
    ticket_next_step: ['ticket-documentation', 'next-steps'],
    escalation_judgement: ['escalation-judgement'],
    safety: ['security-awareness'],
    performed_triage: ['scope-discovery', 'impact-discovery'],
    submitted_ticket: ['ticket-documentation'],
  };

  /* Track per-skill accumulated scores */
  const skillScores: Record<string, { earned: number; max: number; evidence: number; missed: number }> = {};

  /* Insert criterion results */
  const insertCriterion = db.prepare(`
    INSERT OR REPLACE INTO attempt_criterion_results
      (attempt_id, criterion_id, skill_id, status, score, max_score, explanation)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const [criterionId, criterion] of Object.entries(criteria)) {
    const skillEntry = skillBreakdown[criterionId];
    const earned = skillEntry?.score ?? (criterion.status === 'pass' ? 1 : criterion.status === 'partial' ? 0.5 : 0);
    const maxScore = skillEntry?.maxScore ?? 1;
    const status = criterion.status;
    const matchedSkills = CRITERION_SKILL_MAP[criterionId] || [];

    insertCriterion.run(assessmentId, criterionId, matchedSkills[0] || null, status, earned, maxScore, null);

    /* Accumulate into skill scores */
    for (const skillId of matchedSkills) {
      if (!skillScores[skillId]) skillScores[skillId] = { earned: 0, max: 0, evidence: 0, missed: 0 };
      skillScores[skillId].earned += earned;
      skillScores[skillId].max += maxScore;
      skillScores[skillId].evidence += status === 'pass' ? 1 : 0;
      skillScores[skillId].missed += status === 'fail' ? 1 : 0;
    }
  }

  /* Insert skill scores */
  const insertSkillScore = db.prepare(`
    INSERT OR REPLACE INTO attempt_skill_scores
      (attempt_id, skill_id, raw_score, normalized_score, max_score, evidence_count, missed_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const [skillId, data] of Object.entries(skillScores)) {
    const normalized = data.max > 0 ? Math.round((data.earned / data.max) * 100) : 0;
    insertSkillScore.run(assessmentId, skillId, data.earned, normalized, data.max, data.evidence, data.missed);
  }
}
