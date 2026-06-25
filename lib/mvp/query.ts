import { getDb } from './db';

export interface ManagerStandardsRow {
  id: string;
  org_id: string;
  manager_id: string;
  required_ticket_fields_json: string;
  call_requirements: string | null;
  escalation_requirements: string | null;
  tone_preferences_json: string | null;
  good_ticket_example: string | null;
  bad_ticket_example: string | null;
  good_customer_update_example: string | null;
  good_internal_note_example: string | null;
  good_escalation_note_example: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssessmentPackRow {
  id: string;
  title: string;
  scenario_type: string;
  role_level: string;
  difficulty: string;
  version: string;
  customer_persona: string | null;
  hidden_facts_json: string;
  expected_behaviours_json: string;
  required_ticket_fields_json: string;
  red_flags_json: string;
  rubric_json: string;
  caller_behaviour_prompt: string;
  initial_message: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface AssessmentRow {
  id: string;
  title: string;
  candidate_name: string;
  candidate_email: string | null;
  invite_token: string;
  status: string;
  scenario_id: string | null;
  criteria_version_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface SessionRow {
  id: string;
  assessment_id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
}

export interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface TicketRow {
  id: string;
  session_id: string;
  candidate_ticket_text: string;
  created_at: string;
}

export interface AssessmentResultRow {
  id: string;
  assessment_id: string;
  session_id: string;
  criteria_version_id: string | null;
  raw_model_json: string | null;
  overall_score: number | null;
  readiness_label: string;
  summary: string | null;
  strengths_json: string | null;
  weaknesses_json: string | null;
  checkpoint_json: string | null;
  ticket_score: number | null;
  created_at: string;
}

export interface ScenarioRow {
  id: string;
  title: string;
  industry: string | null;
  difficulty: string | null;
  caller_persona: string | null;
  hidden_facts_json: string;
  caller_behaviour_prompt: string;
  initial_message: string;
  ideal_ticket_hints: string | null;
  active: number;
  created_at: string;
}

export interface CriteriaRow {
  id: string;
  name: string;
  version: number;
  criteria_json: string;
  prompt_text: string;
  created_at: string;
  active: number;
}

export function makeId(): string {
  return 'mvp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

export function getActiveCriteria(): CriteriaRow | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM assessment_criteria_versions WHERE active = 1 ORDER BY version DESC LIMIT 1').get() as CriteriaRow | undefined;
  return row || null;
}

export function getActiveScenario(): ScenarioRow | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM scenarios WHERE active = 1 LIMIT 1').get() as ScenarioRow | undefined;
  return row || null;
}

export function getManagerStandards(orgId = 'org-default', managerId = 'manager-default'): ManagerStandardsRow | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM manager_standards WHERE org_id = ? AND manager_id = ? ORDER BY updated_at DESC LIMIT 1').get(orgId, managerId) as ManagerStandardsRow | undefined;
  return row || null;
}

export function upsertManagerStandards(standards: Partial<ManagerStandardsRow> & { id: string }): void {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM manager_standards WHERE id = ?').get(standards.id);
  if (existing) {
    db.prepare(`UPDATE manager_standards SET
      required_ticket_fields_json = ?, call_requirements = ?, escalation_requirements = ?,
      tone_preferences_json = ?, good_ticket_example = ?, bad_ticket_example = ?,
      good_customer_update_example = ?, good_internal_note_example = ?, good_escalation_note_example = ?,
      updated_at = datetime('now')
      WHERE id = ?`).run(
      standards.required_ticket_fields_json || '[]',
      standards.call_requirements || null,
      standards.escalation_requirements || null,
      standards.tone_preferences_json || null,
      standards.good_ticket_example || null,
      standards.bad_ticket_example || null,
      standards.good_customer_update_example || null,
      standards.good_internal_note_example || null,
      standards.good_escalation_note_example || null,
      standards.id
    );
  } else {
    db.prepare(`INSERT INTO manager_standards (id, org_id, manager_id, required_ticket_fields_json, call_requirements, escalation_requirements, tone_preferences_json, good_ticket_example, bad_ticket_example, good_customer_update_example, good_internal_note_example, good_escalation_note_example, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`).run(
      standards.id,
      standards.org_id || 'org-default',
      standards.manager_id || 'manager-default',
      standards.required_ticket_fields_json || '[]',
      standards.call_requirements || null,
      standards.escalation_requirements || null,
      standards.tone_preferences_json || null,
      standards.good_ticket_example || null,
      standards.bad_ticket_example || null,
      standards.good_customer_update_example || null,
      standards.good_internal_note_example || null,
      standards.good_escalation_note_example || null
    );
  }
}

export function getActiveAssessmentPack(): AssessmentPackRow | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM assessment_packs WHERE is_active = 1 LIMIT 1').get() as AssessmentPackRow | undefined;
  return row || null;
}

export function getAssessmentPack(id: string): AssessmentPackRow | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM assessment_packs WHERE id = ?').get(id) as AssessmentPackRow | undefined;
  return row || null;
}

export function getAllAssessmentPacks(): AssessmentPackRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM assessment_packs ORDER BY created_at DESC').all() as AssessmentPackRow[];
}

export function getAssessmentByToken(token: string): AssessmentRow | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM assessments WHERE invite_token = ?').get(token) as AssessmentRow | undefined;
  return row || null;
}

export function getAssessment(id: string): AssessmentRow | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM assessments WHERE id = ?').get(id) as AssessmentRow | undefined;
  return row || null;
}

export function getAllAssessments(): AssessmentRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM assessments ORDER BY created_at DESC').all() as AssessmentRow[];
}

export function getSession(id: string): SessionRow | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined) || null;
}

export function getSessionByAssessment(assessmentId: string): SessionRow | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM sessions WHERE assessment_id = ? ORDER BY started_at DESC LIMIT 1').get(assessmentId) as SessionRow | undefined) || null;
}

export function getMessages(sessionId: string): MessageRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC').all(sessionId) as MessageRow[];
}

export function getTicket(sessionId: string): TicketRow | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM tickets WHERE session_id = ? ORDER BY created_at DESC LIMIT 1').get(sessionId) as TicketRow | undefined) || null;
}

export function getResult(assessmentId: string): AssessmentResultRow | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM assessment_results WHERE assessment_id = ? ORDER BY created_at DESC LIMIT 1').get(assessmentId) as AssessmentResultRow | undefined) || null;
}

export function getFeedback(assessmentId: string): ManagerFeedbackRow | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM manager_feedback WHERE assessment_id = ? ORDER BY created_at DESC LIMIT 1').get(assessmentId) as ManagerFeedbackRow | undefined) || null;
}

export interface ManagerFeedbackRow {
  id: string;
  assessment_id: string;
  result_id: string | null;
  manager_label: string;
  manager_score: number | null;
  notes: string | null;
  created_at: string;
}

export interface FullAssessmentView {
  assessment: AssessmentRow;
  session: SessionRow | null;
  messages: MessageRow[];
  ticket: TicketRow | null;
  result: AssessmentResultRow | null;
  feedback: ManagerFeedbackRow | null;
  scenario: ScenarioRow | null;
  criteria: CriteriaRow | null;
}

export function getFullAssessment(assessmentIdOrToken: string, isToken = false): FullAssessmentView | null {
  const assessment = isToken ? getAssessmentByToken(assessmentIdOrToken) : getAssessment(assessmentIdOrToken);
  if (!assessment) return null;

  const session = getSessionByAssessment(assessment.id);
  const messages = session ? getMessages(session.id) : [];
  const ticket = session ? getTicket(session.id) : null;
  const result = getResult(assessment.id);
  const feedback = getFeedback(assessment.id);
  const scenario = assessment.scenario_id
    ? (getDb().prepare('SELECT * FROM scenarios WHERE id = ?').get(assessment.scenario_id) as ScenarioRow | undefined || null)
    : null;
  const criteria = assessment.criteria_version_id
    ? (getDb().prepare('SELECT * FROM assessment_criteria_versions WHERE id = ?').get(assessment.criteria_version_id) as CriteriaRow | undefined || null)
    : null;

  return { assessment, session, messages, ticket, result, feedback, scenario, criteria };
}
