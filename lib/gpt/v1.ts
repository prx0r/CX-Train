/* GPT v2 operations: Bearer-gated ChatGPT surface over MVP libs.
 * Candidate token routes stay as-is (invite-gated); everything here
 * requires verifyActionsKey at the route layer. Reports split:
 * candidateReport STRIPS hidden truth/ideal/rubric; managerReport is full.
 * Mirrors v1 route logic; tests/gpt-v1.test.ts binds v1-vs-v2 equivalence
 * on manager reports so the two cannot silently diverge.
 */
import { initTables, seedDefaults, getDb, getDefaultStandardsId } from '../mvp/db';
import {
  getFullAssessment, getAssessment, getResult, makeId,
  getManagerStandards, upsertManagerStandards,
} from '../mvp/query';
import { buildTimeline } from '../mvp/sim/timeline';
import { getPackById } from '../mvp/sim/packRegistry';
import { getSessionEvents } from '../mvp/events/eventLog';
import { buildEvidenceTimeline, calculateTimingMetrics } from '../mvp/events/timeline';
import { getHiringPack } from '../mvp/sim/hiringPacks';
import { createMvpAssessment } from '../mvp/assessments/create';
import {
  confirmCallumProposal, rejectCallumProposal,
} from '../mvp/callum/proposals';
import { resolveManagerProfile } from '../mvp/callum/manager-profile';
import { triageTicket } from '../msp';
import { loadTaxonomy, generateScenarioFromTaxonomy } from '../taxonomy';
export type OpResult = { status: number; body: any };

function safeJsonParse(raw: any): any {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/* Fields a candidate must never see, stripped at any depth inside packs. */
const STRIP_KEYS = new Set([
  'hidden_truth', 'hiddenTruth', 'hidden_facts_json', 'hiddenFacts',
  'idealTicket', 'ideal_ticket', 'ideal_ticket_hints',
  'idealPath', 'ideal_path', 'ideal_diagnostic_path',
  'caller_behaviour_prompt', 'caller_behavior_prompt',
  'scoringCriteria', 'scoring_criteria', 'managerReviewHints',
  'manager_review_hints', 'rubric',
]);

const SCENARIO_SAFE_KEYS = new Set([
  'id', 'title', 'industry', 'difficulty', 'active', 'created_at',
]);

function stripDeep(value: any): any {
  if (Array.isArray(value)) return value.map(stripDeep);
  if (value && typeof value === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) {
      if (!STRIP_KEYS.has(k)) out[k] = stripDeep(v);
    }
    return out;
  }
  return value;
}

function assembleReport(id: string): { status: number; body: any } {
  initTables();
  const full: any = getFullAssessment(id);
  if (!full) return { status: 404, body: { error: 'Assessment not found' } };
  const result: any = { ...full };
  const db = getDb();
  const ar: any = full.assessment ? db.prepare(
    `SELECT compliance_json, category_scores_json, recording_analysis_json, recording_path
     FROM assessment_results WHERE assessment_id = ? ORDER BY created_at DESC LIMIT 1`
  ).get(id) : undefined;
  if (ar) {
    if (ar.compliance_json) result.complianceData = safeJsonParse(ar.compliance_json);
    if (ar.category_scores_json) result.categoryScores = safeJsonParse(ar.category_scores_json);
    if (ar.recording_analysis_json) result.recordingAnalysis = safeJsonParse(ar.recording_analysis_json);
    if (ar.recording_path) result.recordingPath = ar.recording_path;
  }
  const raw: any = full.assessment || {};
  const packSnapshot = safeJsonParse(raw.pack_snapshot_json);
  if (packSnapshot) {
    result.packSnapshot = packSnapshot;
    result.packCustomer = packSnapshot.customer || null;
  } else if (raw.assessment_pack_id) {
    const hp: any = getHiringPack(raw.assessment_pack_id);
    if (hp) {
      result.packSnapshot = { pack_id: hp.id, customer: hp.customer };
      result.packCustomer = hp.customer;
    }
  }
  if (!raw.pack_snapshot_json && raw.assessment_pack_id) {
    try {
      const pack: any = getPackById(raw.assessment_pack_id);
      if (pack) result.simTools = pack.tools;
    } catch { /* optional enrichment only */ }
  }
  if (full.session) {
    const evts = getSessionEvents(full.session.id);
    result.evidenceTimeline = buildEvidenceTimeline(evts);
    result.timingMetrics = calculateTimingMetrics(evts);
    result.sessionEventCount = evts.length;
  }
  return { status: 200, body: result };
}

export function candidateReport(id: string): OpResult {
  const r = assembleReport(id);
  if (r.status !== 200) return r;
  const clean: any = stripDeep(r.body);
  if (clean.scenario && typeof clean.scenario === 'object') {
    const safe: any = {};
    for (const k of SCENARIO_SAFE_KEYS) {
      if (clean.scenario[k] !== undefined) safe[k] = clean.scenario[k];
    }
    clean.scenario = safe;
  }
  /* Whole snapshot/rubric objects go to managers only: worked examples
     (e.g. good_ticket_example) contain scenario answers, and criteria
     reveal the grading rubric. Candidates get verdict + own work. */
  if (clean.assessment && typeof clean.assessment === 'object') {
    delete clean.assessment.standards_snapshot_json;
    delete clean.assessment.scoring_snapshot_json;
    delete clean.assessment.mode_config_json;
  }
  delete clean.criteria;
  return { status: 200, body: clean };
}

export function managerReport(id: string): OpResult {
  return assembleReport(id);
}

const VALID_LABELS = ['agree', 'too_harsh', 'too_generous', 'wrong', 'useful', 'not_useful'];

export function createAssessment(body: any, baseUrl: string): OpResult {
  initTables();
  try {
    const result: any = createMvpAssessment({
      candidateName: body.candidate_name,
      candidateEmail: body.candidate_email || null,
      candidateUserId: body.candidate_user_id || null,
      attemptMode: body.candidate_user_id ? 'practice' : (body.attempt_mode || 'invited'),
      managerProfileId: body.manager_profile_id || 'manager-default-v1',
      assignmentType: body.assignmentType || body.assignment_type || 'hiring_exam',
      assessmentPackId: body.assessmentPackId || body.assessment_pack_id || null,
      baseUrl,
    });
    return { status: 200, body: result };
  } catch (err: any) {
    if (err?.code === 'TRAINING_SHIFT_NOT_AVAILABLE') {
      return { status: 400, body: { error: 'Training Shift assignments are not yet available.' } };
    }
    return { status: 400, body: { error: err?.message || 'Failed to create assessment' } };
  }
}

export function saveFeedback(id: string, body: any): OpResult {
  initTables();
  const assessment: any = getAssessment(id);
  if (!assessment) return { status: 404, body: { error: 'Assessment not found' } };
  const managerLabel = body.manager_label || '';
  if (!VALID_LABELS.includes(managerLabel)) {
    return { status: 400, body: { error: `Invalid label. Must be one of: ${VALID_LABELS.join(', ')}` } };
  }
  const managerScore = body.manager_score != null ? body.manager_score : null;
  const result: any = getResult(assessment.id);
  const db = getDb();
  const feedbackId = makeId();
  db.prepare(`INSERT INTO manager_feedback (id, assessment_id, result_id, manager_label, manager_score, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`).run(
    feedbackId, assessment.id, result?.id || null, managerLabel, managerScore, body.notes || '');
  for (const o of body.criterion_overrides || []) {
    if (!o.criterion_id || !o.manager_status) continue;
    db.prepare(`INSERT INTO manager_criterion_feedback (id, feedback_id, criterion_id, original_status, manager_status, original_score, manager_score, manager_comment, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(
      makeId(), feedbackId, o.criterion_id, o.original_status || 'unknown',
      o.manager_status, o.original_score ?? 0, o.manager_score ?? 0, o.manager_comment || null);
  }
  if (result && managerScore != null) {
    db.prepare('UPDATE assessment_results SET overall_score = ? WHERE id = ?').run(managerScore, result.id);
  }
  db.prepare('UPDATE assessments SET status = ? WHERE id = ?').run('reviewed', assessment.id);
  return { status: 200, body: { status: 'reviewed', feedback_id: feedbackId } };
}

export function readStandards(): OpResult {
  initTables();
  seedDefaults();
  return { status: 200, body: { standards: getManagerStandards() } };
}

export function writeStandards(body: any): OpResult {
  initTables();
  seedDefaults();
  if (body.required_ticket_fields !== undefined && !Array.isArray(body.required_ticket_fields)) {
    return { status: 400, body: { error: 'required_ticket_fields must be an array' } };
  }
  upsertManagerStandards({
    id: getDefaultStandardsId(),
    org_id: 'org-default',
    manager_id: 'manager-default',
    required_ticket_fields_json: JSON.stringify(body.required_ticket_fields || []),
    call_requirements: body.call_requirements || null,
    escalation_requirements: body.escalation_requirements || null,
    tone_preferences_json: body.tone_preferences ? JSON.stringify(body.tone_preferences) : null,
    good_ticket_example: body.good_ticket_example || null,
    bad_ticket_example: body.bad_ticket_example || null,
    good_customer_update_example: body.good_customer_update_example || null,
    good_internal_note_example: body.good_internal_note_example || null,
    good_escalation_note_example: body.good_escalation_note_example || null,
  });
  return { status: 200, body: { standards: getManagerStandards(), saved: true } };
}

function proposalStatus(result: any): number {
  if (result.ok) return 200;
  return result.code === 'NOT_FOUND' ? 404
    : result.code === 'FORBIDDEN' ? 403
    : ['EXPIRED', 'STALE', 'NOT_PENDING'].includes(result.code) ? 409 : 400;
}

export function confirmProposal(id: string, body: any, baseUrl: string): OpResult {
  initTables();
  seedDefaults();
  const managerProfileId = resolveManagerProfile(body.managerProfileId || body.manager_profile_id);
  const result: any = confirmCallumProposal({ proposalId: id, managerProfileId, baseUrl });
  return { status: proposalStatus(result), body: result };
}

export function rejectProposal(id: string, body: any): OpResult {
  initTables();
  seedDefaults();
  const managerProfileId = resolveManagerProfile(body.managerProfileId || body.manager_profile_id);
  const result: any = rejectCallumProposal({ proposalId: id, managerProfileId });
  return { status: proposalStatus(result), body: result };
}

export async function triage(description: string): Promise<OpResult> {
  if (!description) return { status: 400, body: { error: 'Missing description' } };
  return { status: 200, body: await triageTicket(description) };
}

export function searchTaxonomy(q: string, limit: number): OpResult {
  initTables();
  const db = getDb();
  const pattern = `%${q || ''}%`;
  const rows = db.prepare(`
    SELECT * FROM taxonomy_items
    WHERE type LIKE ? OR sub_type LIKE ? OR item LIKE ? OR definition_scope LIKE ? OR keywords LIKE ?
    ORDER BY source_id ASC LIMIT ?`).all(
    pattern, pattern, pattern, pattern, pattern, Math.min(limit || 50, 200));
  return { status: 200, body: { results: rows, query: q, total: rows.length } };
}

export async function generateScenario(itemId: string): Promise<OpResult> {
  if (!itemId) return { status: 400, body: { error: 'Missing item_id' } };
  const file = await loadTaxonomy();
  const item = (file.items || []).find((t: any) => t.id === itemId);
  if (!item) return { status: 404, body: { error: 'Taxonomy item not found' } };
  return { status: 200, body: generateScenarioFromTaxonomy(item) };
}
