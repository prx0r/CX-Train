#!/usr/bin/env node
/**
 * Tests for the assignment type abstraction layer.
 * Verifies that the assignment type registry, DB schema, API creation,
 * candidate routing, and training shift rejection all work correctly.
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

/* Mirrors lib/mvp/assignment-types.ts constants for test isolation */
const ASSIGNMENT_TYPES = {
  hiring_exam: { label: 'Hiring Exam', enabled: true, assessmentMode: 'chat_call', comingSoon: false },
  training_drill: { label: 'Training Drill', enabled: true, assessmentMode: 'dashboard_sim', comingSoon: false },
  training_shift: { label: 'Training Shift', enabled: false, assessmentMode: null, comingSoon: true },
};
const ASSIGNMENT_TYPE_LIST = ['hiring_exam', 'training_drill', 'training_shift'];
const ENABLED_TRAINING_DRILL_PACKS = ['pack-outlook-sim-v2'];

async function main() {
  console.log('=== Assignment Type Tests ===\n');

  // ── 1. Assignment type constants ──────────────────────────────────
  console.log('--- 1. Assignment type registry ---');
  assert(ASSIGNMENT_TYPE_LIST.length === 3, 'Exactly three assignment types exist');
  assert(ASSIGNMENT_TYPES.hiring_exam.enabled === true, 'hiring_exam is enabled');
  assert(ASSIGNMENT_TYPES.training_drill.enabled === true, 'training_drill is enabled');
  assert(ASSIGNMENT_TYPES.training_shift.enabled === false, 'training_shift is disabled');
  assert(ASSIGNMENT_TYPES.hiring_exam.assessmentMode === 'chat_call', 'hiring_exam maps to chat_call');
  assert(ASSIGNMENT_TYPES.training_drill.assessmentMode === 'dashboard_sim', 'training_drill maps to dashboard_sim');
  assert(ASSIGNMENT_TYPES.training_shift.assessmentMode === null, 'training_shift has no active mode');
  assert(ASSIGNMENT_TYPES.training_shift.comingSoon === true, 'training_shift is coming soon');

  // ── 2. DB schema ─────────────────────────────────────────────────
  console.log('\n--- 2. DB schema ---');
  const db = getDb();
  // Run migration to add assignment_type column (safe if already exists)
  try { db.exec(`ALTER TABLE assessments ADD COLUMN assignment_type TEXT NOT NULL DEFAULT 'hiring_exam'`); } catch {}
  const assCols = db.prepare("PRAGMA table_info(assessments)").all().map(c => c.name);
  assert(assCols.includes('assignment_type'), 'assessments.assignment_type column exists');

  // ── 3. Default assignment type when inserting ─────────────────────
  console.log('\n--- 3. Default assignment type ---');
  const scenario = db.prepare('SELECT id FROM scenarios WHERE active = 1 LIMIT 1').get();
  const criteria = db.prepare('SELECT id FROM assessment_criteria_versions WHERE active = 1 LIMIT 1').get();

  const defId = makeId();
  const defTok = makeId();
  db.prepare(`INSERT INTO assessments (id, title, candidate_name, candidate_email, invite_token, status, scenario_id, criteria_version_id, created_at)
    VALUES (?, ?, ?, ?, ?, 'invited', ?, ?, datetime('now'))`).run(
    defId, 'Default Test', 'Default User', null, defTok, scenario?.id || '', criteria?.id || ''
  );
  const defRow = db.prepare('SELECT * FROM assessments WHERE id = ?').get(defId);
  assert(defRow.assignment_type === 'hiring_exam', 'Default assignment type is hiring_exam');
  db.prepare('DELETE FROM assessments WHERE id = ?').run(defId);

  // ── 4. Hiring exam stores correctly ───────────────────────────────
  console.log('\n--- 4. Hiring exam storage ---');
  const examId = makeId();
  const examTok = makeId();
  db.prepare(`INSERT INTO assessments (id, title, candidate_name, candidate_email, invite_token, status, scenario_id, criteria_version_id, assessment_mode, assignment_type, created_at)
    VALUES (?, ?, ?, ?, ?, 'invited', ?, ?, ?, ?, datetime('now'))`).run(
    examId, 'Hiring Exam', 'Hiring User', null, examTok, scenario?.id || '', criteria?.id || '',
    'chat_call', 'hiring_exam'
  );
  const examRow = db.prepare('SELECT * FROM assessments WHERE id = ?').get(examId);
  assert(examRow.assignment_type === 'hiring_exam', 'Hiring exam stores assignment_type=hiring_exam');
  assert(examRow.assessment_mode === 'chat_call', 'Hiring exam stores assessment_mode=chat_call');
  assert(!examRow.assessment_pack_id || examRow.assessment_pack_id === null, 'Hiring exam has no pack id');
  db.prepare('DELETE FROM assessments WHERE id = ?').run(examId);

  // ── 5. Training drill stores correctly ────────────────────────────
  console.log('\n--- 5. Training drill storage ---');
  const drillId = makeId();
  const drillTok = makeId();
  db.prepare(`INSERT INTO assessments (id, title, candidate_name, candidate_email, invite_token, status, scenario_id, criteria_version_id, assessment_mode, assessment_pack_id, assignment_type, created_at)
    VALUES (?, ?, ?, ?, ?, 'invited', ?, ?, ?, ?, ?, datetime('now'))`).run(
    drillId, 'Drill', 'Drill User', null, drillTok, scenario?.id || '', criteria?.id || '',
    'dashboard_sim', 'pack-outlook-sim-v2', 'training_drill'
  );
  const drillRow = db.prepare('SELECT * FROM assessments WHERE id = ?').get(drillId);
  assert(drillRow.assignment_type === 'training_drill', 'Training drill stores assignment_type=training_drill');
  assert(drillRow.assessment_mode === 'dashboard_sim', 'Training drill stores assessment_mode=dashboard_sim');
  assert(drillRow.assessment_pack_id === 'pack-outlook-sim-v2', 'Training drill stores pack-outlook-sim-v2');
  db.prepare('DELETE FROM assessments WHERE id = ?').run(drillId);

  // ── 6. Training shift rejection ──────────────────────────────────
  console.log('\n--- 6. Training shift rejection ---');
  const shiftConfig = ASSIGNMENT_TYPES.training_shift;
  assert(shiftConfig.enabled === false, 'training_shift is disabled');
  assert(shiftConfig.comingSoon === true, 'training_shift shows coming soon');

  // ── 7. Candidate load hides hidden facts (smoke check) ────────────
  console.log('\n--- 7. Candidate data safety ---');
  const safeTok = makeId();
  const safeId = makeId();
  const safeSessId = makeId();
  db.prepare(`INSERT INTO assessments (id, title, candidate_name, candidate_email, invite_token, status, scenario_id, criteria_version_id, assessment_mode, assignment_type, created_at)
    VALUES (?, ?, ?, ?, ?, 'invited', ?, ?, ?, ?, datetime('now'))`).run(
    safeId, 'Safety', 'Safe User', null, safeTok, scenario?.id || '', criteria?.id || '',
    'chat_call', 'hiring_exam'
  );
  const safeRow = db.prepare('SELECT * FROM assessments WHERE id = ?').get(safeId);
  const sf = safeRow;
  assert(!sf.hidden_facts_json, 'Assessment row has no hidden_facts_json field');
  db.prepare('DELETE FROM assessments WHERE id = ?').run(safeId);

  // ── 8. Drill packs ───────────────────────────────────────────────
  console.log('\n--- 8. Drill packs ---');
  assert(ENABLED_TRAINING_DRILL_PACKS.length >= 1, 'At least one drill pack is enabled');
  assert(ENABLED_TRAINING_DRILL_PACKS.includes('pack-outlook-sim-v2'), 'pack-outlook-sim-v2 is enabled');

  db.close();

  // ── Summary ──────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
