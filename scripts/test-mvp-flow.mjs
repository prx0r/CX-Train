#!/usr/bin/env node
/**
 * End-to-end test of the SQLite MVP flow without a browser.
 * Tests DB operations directly.
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });
dotenv.config();

import { getDb, makeId } from './mvp-helpers.mjs';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label}`);
    failed++;
  }
}

async function main() {
  console.log('=== SQLite MVP Flow Test ===\n');

  // ── Test 1: DB init ──────────────────────────────────────────────
  console.log('--- Test 1: DB tables exist ---');
  const db = getDb();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name);
  const expectedTables = ['assessment_criteria_versions', 'assessment_results', 'assessments', 'manager_feedback', 'messages', 'scenarios', 'sessions', 'tickets'];
  for (const t of expectedTables) {
    assert(tables.includes(t), `Table "${t}" exists`);
  }

  // ── Test 2: Seed data ────────────────────────────────────────────
  console.log('\n--- Test 2: Seed data ---');
  const criteria = db.prepare('SELECT * FROM assessment_criteria_versions WHERE id = ?').get('criteria-msp-v1');
  assert(!!criteria, 'Default criteria version exists');
  assert(criteria.name === 'MSP First-Line Call Readiness v1', 'Criteria name correct');
  assert(criteria.active === 1, 'Criteria is active');

  const scenario = db.prepare('SELECT * FROM scenarios WHERE id = ?').get('scenario-outlook-001');
  assert(!!scenario, 'Default scenario exists');
  assert(scenario.title === 'Outlook not sending before meeting', 'Scenario title correct');
  const facts = JSON.parse(scenario.hidden_facts_json);
  assert(facts.hostname === 'ALDER-LT-023', 'Hidden facts have hostname');
  assert(facts.workaround === 'Outlook web works', 'Hidden facts have web workaround');

  // ── Test 3: Create assessment ────────────────────────────────────
  console.log('\n--- Test 3: Create assessment ---');
  const assessmentId = makeId();
  const sessionId = makeId();
  const inviteToken = makeId();
  const now = new Date().toISOString();

  db.prepare(`INSERT INTO assessments (id, title, candidate_name, candidate_email, invite_token, status, scenario_id, criteria_version_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    assessmentId, 'MVP Test Assessment', 'Test Candidate', 'test@example.com', inviteToken,
    'invited', 'scenario-outlook-001', 'criteria-msp-v1', now
  );
  assert(true, 'Assessment inserted');

  const created = db.prepare('SELECT * FROM assessments WHERE id = ?').get(assessmentId);
  assert(created.status === 'invited', 'Assessment status is invited');
  assert(created.invite_token === inviteToken, 'Invite token matches');

  // ── Test 4: Create session ──────────────────────────────────────
  console.log('\n--- Test 4: Create session ---');
  db.prepare(`INSERT INTO sessions (id, assessment_id, status, started_at)
    VALUES (?, ?, ?, ?)`).run(sessionId, assessmentId, 'in_progress', now);
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  assert(session.status === 'in_progress', 'Session status is in_progress');
  assert(session.assessment_id === assessmentId, 'Session linked to assessment');

  // ── Test 5: Store messages ───────────────────────────────────────
  console.log('\n--- Test 5: Store messages ---');
  const msg1Id = makeId();
  const msg2Id = makeId();
  db.prepare(`INSERT INTO messages (id, session_id, role, content, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))`).run(msg1Id, sessionId, 'caller', scenario.initial_message);
  db.prepare(`INSERT INTO messages (id, session_id, role, content, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))`).run(msg2Id, sessionId, 'candidate', 'Can you tell me what exactly happens when you try to send?');
  
  const messages = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at').all(sessionId);
  assert(messages.length === 2, 'Two messages stored');
  assert(messages[0].role === 'caller', 'First message is from caller');
  assert(messages[1].role === 'candidate', 'Second message is from candidate');

  // ── Test 6: Submit ticket ────────────────────────────────────────
  console.log('\n--- Test 6: Submit ticket ---');
  const ticketId = makeId();
  const ticketText = 'User Sarah Thompson at Alder & Co cannot send emails from Outlook. Getting a Send/Receive error. Password was changed yesterday.';
  db.prepare(`INSERT INTO tickets (id, session_id, candidate_ticket_text, created_at)
    VALUES (?, ?, ?, datetime('now'))`).run(ticketId, sessionId, ticketText);
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  assert(ticket.candidate_ticket_text === ticketText, 'Ticket stored with correct text');
  assert(ticket.session_id === sessionId, 'Ticket linked to session');

  // ── Test 7: Complete assessment ──────────────────────────────────
  console.log('\n--- Test 7: Complete assessment ---');
  db.prepare('UPDATE assessments SET status = ?, completed_at = datetime(\'now\') WHERE id = ?').run('completed', assessmentId);
  db.prepare('UPDATE sessions SET status = ?, ended_at = datetime(\'now\') WHERE id = ?').run('completed', sessionId);
  const updatedAssessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(assessmentId);
  assert(updatedAssessment.status === 'completed', 'Assessment marked completed');
  const updatedSession = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  assert(updatedSession.status === 'completed', 'Session marked completed');

  // ── Test 8: Store analysis result ────────────────────────────────
  console.log('\n--- Test 8: Store analysis result ---');
  const resultId = makeId();
  const analysisJson = JSON.stringify({
    overall_score: 72,
    readiness_label: 'needs_supervision',
    summary: 'Candidate asked scope and impact but missed hostname and deadline.',
    strengths: ['Asked about error message', 'Showed empathy'],
    weaknesses: ['Did not capture hostname', 'Did not ask about deadline'],
    checkpoints: {
      confirmed_user: true, confirmed_company: true, captured_device_or_hostname: false,
      clarified_issue: true, asked_scope: true, asked_impact: true, asked_deadline_or_urgency: false,
      asked_error_message: true, asked_recent_changes: false, set_next_steps: false,
      used_clear_language: true, showed_empathy: true, invented_fix: false, unsafe_advice: false,
    },
    evidence_quotes: ['Candidate asked "Is it just you or others?"', 'Candidate asked "What error are you seeing?"'],
    ticket_score: 65,
    ticket_feedback: 'Ticket captured user, company, and error but missed hostname and next steps.',
  });
  db.prepare(`INSERT INTO assessment_results (id, assessment_id, session_id, criteria_version_id, raw_model_json, overall_score, readiness_label, summary, strengths_json, weaknesses_json, checkpoint_json, ticket_score, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(
    resultId, assessmentId, sessionId, 'criteria-msp-v1', analysisJson, 72,
    'needs_supervision', 'Candidate asked scope and impact but missed hostname and deadline.',
    JSON.stringify(['Asked about error message', 'Showed empathy']),
    JSON.stringify(['Did not capture hostname', 'Did not ask about deadline']),
    '{}', 65
  );
  const result = db.prepare('SELECT * FROM assessment_results WHERE id = ?').get(resultId);
  assert(result.overall_score === 72, 'Result score stored');
  assert(result.readiness_label === 'needs_supervision', 'Readiness label stored');

  db.prepare('UPDATE assessments SET status = ? WHERE id = ?').run('analysed', assessmentId);
  const analysed = db.prepare('SELECT * FROM assessments WHERE id = ?').get(assessmentId);
  assert(analysed.status === 'analysed', 'Assessment marked analysed');

  // ── Test 9: Manager feedback ─────────────────────────────────────
  console.log('\n--- Test 9: Manager feedback ---');
  const feedbackId = makeId();
  db.prepare(`INSERT INTO manager_feedback (id, assessment_id, result_id, manager_label, manager_score, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`).run(
    feedbackId, assessmentId, resultId, 'too_harsh', 78,
    'Candidate was better than the model gave credit for. They established scope.'
  );
  const feedback = db.prepare('SELECT * FROM manager_feedback WHERE id = ?').get(feedbackId);
  assert(feedback.manager_label === 'too_harsh', 'Manager label stored');
  assert(feedback.manager_score === 78, 'Manager score stored');

  db.prepare('UPDATE assessments SET status = ? WHERE id = ?').run('reviewed', assessmentId);
  const reviewed = db.prepare('SELECT * FROM assessments WHERE id = ?').get(assessmentId);
  assert(reviewed.status === 'reviewed', 'Assessment marked reviewed');

  // ── Test 10: Join queries ────────────────────────────────────────
  console.log('\n--- Test 10: Join queries ---');
  const fullAssessment = db.prepare(`
    SELECT a.*, s.status as session_status, r.overall_score, r.readiness_label, f.manager_label
    FROM assessments a
    LEFT JOIN sessions s ON s.assessment_id = a.id
    LEFT JOIN assessment_results r ON r.assessment_id = a.id
    LEFT JOIN manager_feedback f ON f.assessment_id = a.id
    WHERE a.id = ?
  `).get(assessmentId);
  assert(fullAssessment.session_status === 'completed', 'Join returns session status');
  assert(fullAssessment.overall_score === 72, 'Join returns result score');
  assert(fullAssessment.manager_label === 'too_harsh', 'Join returns feedback');

  // ── Cleanup ──────────────────────────────────────────────────────
  console.log('\n--- Cleanup ---');
  db.prepare('DELETE FROM manager_feedback WHERE assessment_id = ?').run(assessmentId);
  db.prepare('DELETE FROM assessment_results WHERE assessment_id = ?').run(assessmentId);
  db.prepare('DELETE FROM tickets WHERE session_id IN (SELECT id FROM sessions WHERE assessment_id = ?)').run(assessmentId);
  db.prepare('DELETE FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE assessment_id = ?)').run(assessmentId);
  db.prepare('DELETE FROM sessions WHERE assessment_id = ?').run(assessmentId);
  db.prepare('DELETE FROM assessments WHERE id = ?').run(assessmentId);
  assert(true, 'Cleanup completed');
  db.close();

  // ── Summary ──────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
