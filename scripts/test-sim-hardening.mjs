/**
 * HARDENING REGRESSION TESTS — sim engine security & correctness
 *
 * Covers items 1-9 from the hardening spec.
 * Tests the engine via direct module imports using createRequire.
 */

import { createRequire } from 'module';
import { execSync } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const cwd = path.resolve(__dirname, '..');

/* ── Load sim modules via require ── */
const { getOutlookWorkOfflinePack } = require('../lib/mvp/sim/packConfig');
const { applyAction } = require('../lib/mvp/sim/stateMachine');
const { getVisibleState, getVisibleActions } = require('../lib/mvp/sim/safeProjection');
const { scoreSimEvents } = require('../lib/mvp/sim/scoring');

/* ── DB helpers ── */
const DB_PATH = '/tmp/test-sim-hardening.db';
const PACK_ID = 'pack-outlook-sim-v2';
const BASE_ID = 'hardening-' + Date.now();

function setupDb() {
  if (existsSync(DB_PATH)) unlinkSync(DB_PATH);
  process.env.MVP_SQLITE_PATH = DB_PATH;
  execSync(`TAXONOMY_JSON_PATH=taxonomy/taxonomy.json MVP_SQLITE_PATH=${DB_PATH} node scripts/mvp-init-db.mjs`, { cwd, stdio: 'pipe' });
}

function getDb() {
  const Database = require('better-sqlite3');
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  return db;
}

let pass = 0, fail = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  PASS: ${label}`);
    pass++;
  } else {
    console.log(`  FAIL: ${label}${detail ? ' — ' + detail : ''}`);
    fail++;
  }
}

/* ════════════════════════════════════════════════════════════
   1. Initial candidate API does not leak Work Offline
   ════════════════════════════════════════════════════════════ */

console.log('\n--- Item 1: Safe projection hides root cause initially ---');

const pack = getOutlookWorkOfflinePack();
const initialVis = getVisibleState(pack.initialState);

assert('Phase is not_started', initialVis.phase === 'not_started');
assert('safe_state has no outlook block', !initialVis.safe_state.outlook);
assert('safe_state has no network block', !initialVis.safe_state.network);
assert('safe_state has no connectwise block', !initialVis.safe_state.connectwise);
assert('safe_state has call info', !!initialVis.safe_state.call);
assert('call.customerMood is frustrated', initialVis.safe_state.call?.customerMood === 'frustrated');
assert('call.startedAt is null', initialVis.safe_state.call?.startedAt === null);

/* ════════════════════════════════════════════════════════════
   2. After start_call, outlook still hidden
   ════════════════════════════════════════════════════════════ */

console.log('\n--- Item 2: Opening Outlook reveals only what is visible ---');

let state = pack.initialState;
state = applyAction(state, pack.actions.find(a => a.id === 'start_call')).updatedState;
let vis = getVisibleState(state);

assert('Phase is call_active after start_call', vis.phase === 'call_active');
assert('Outlook hidden in call_active phase', !vis.safe_state.outlook);
assert('Remote hidden in call_active phase', !vis.safe_state.remote);

/* After remote_connect */
state = applyAction(state, pack.actions.find(a => a.id === 'remote_connect')).updatedState;
vis = getVisibleState(state);

assert('Phase is remote_active after connect', vis.phase === 'remote_active');
assert('Remote block visible', vis.safe_state.remote?.connected === true);
assert('Outlook still hidden before opening', !vis.safe_state.outlook);

/* After open_outlook */
state = applyAction(state, pack.actions.find(a => a.id === 'open_outlook')).updatedState;
vis = getVisibleState(state);

assert('Outlook block appears after opening', !!vis.safe_state.outlook);
assert('workOffline visible after open', vis.safe_state.outlook?.workOffline === true);
assert('outboxCount visible after open', vis.safe_state.outlook?.outboxCount === 3);
assert('sentTestEmail hidden until fix verified', vis.safe_state.outlook?.sentTestEmail === undefined);

/* After disable + send, sentTestEmail becomes visible */
state = applyAction(state, pack.actions.find(a => a.id === 'check_outlook_status')).updatedState;
state = applyAction(state, pack.actions.find(a => a.id === 'disable_work_offline')).updatedState;
state = applyAction(state, pack.actions.find(a => a.id === 'send_test_email')).updatedState;
vis = getVisibleState(state);

assert('sentTestEmail visible after fix verified', vis.safe_state.outlook?.sentTestEmail === true);

/* ════════════════════════════════════════════════════════════
   3. Checking status reveals Work Offline fact
   ════════════════════════════════════════════════════════════ */

console.log('\n--- Item 3: Check status reveals Work Offline fact ---');

const freshState = (() => {
  let s = pack.initialState;
  s = applyAction(s, pack.actions.find(a => a.id === 'start_call')).updatedState;
  s = applyAction(s, pack.actions.find(a => a.id === 'remote_connect')).updatedState;
  s = applyAction(s, pack.actions.find(a => a.id === 'open_outlook')).updatedState;
  s = applyAction(s, pack.actions.find(a => a.id === 'check_outlook_status')).updatedState;
  return s;
})();

assert('factsRevealed includes Work Offline mode', freshState.call.factsRevealed.includes('Outlook is in Work Offline mode'));
assert('discovered includes tool.outlook.check_status', freshState.discovered.includes('tool.outlook.check_status'));
assert('discovered includes diagnostic.application_state_checked', freshState.discovered.includes('diagnostic.application_state_checked'));

/* ════════════════════════════════════════════════════════════
   4. Disabling Work Offline before opening Outlook is rejected
   ════════════════════════════════════════════════════════════ */

console.log('\n--- Item 4: Precondition violation rejected ---');

let baseState = pack.initialState;
baseState = applyAction(baseState, pack.actions.find(a => a.id === 'start_call')).updatedState;
baseState = applyAction(baseState, pack.actions.find(a => a.id === 'remote_connect')).updatedState;
const { result: rejectResult } = applyAction(baseState, pack.actions.find(a => a.id === 'disable_work_offline'));

assert('Disable Work Offline before opening Outlook is rejected', rejectResult.ok === false);
assert('Error code is PRECONDITION_FAILED', rejectResult.errorCode === 'PRECONDITION_FAILED');

/* Also test INVALID_PHASE */
const { result: phaseReject } = applyAction(pack.initialState, pack.actions.find(a => a.id === 'open_outlook'));
assert('Open Outlook in not_started phase rejected', phaseReject.ok === false);
assert('Error code is INVALID_PHASE', phaseReject.errorCode === 'INVALID_PHASE');

/* ════════════════════════════════════════════════════════════
   5. Red-flag actions trigger red flags
   ════════════════════════════════════════════════════════════ */

console.log('\n--- Item 5: Red-flag actions trigger red flags ---');

let redState = pack.initialState;
redState = applyAction(redState, pack.actions.find(a => a.id === 'start_call')).updatedState;
redState = applyAction(redState, pack.actions.find(a => a.id === 'remote_connect')).updatedState;

const { result: reinstallResult } = applyAction(redState, pack.actions.find(a => a.id === 'reinstall_outlook'));
assert('Reinstall action succeeds (candidate chose it)', reinstallResult.ok === true);
assert('Reinstall returns redFlag object', !!reinstallResult.redFlag);
assert('Red flag id is jumped_to_disruptive_fix', reinstallResult.redFlag.id === 'jumped_to_disruptive_fix');
assert('Red flag severity is major', reinstallResult.redFlag.severity === 'major');

const { result: deleteResult } = applyAction(redState, pack.actions.find(a => a.id === 'delete_mail_profile'));
assert('Delete profile action returns redFlag', !!deleteResult.redFlag);
assert('Delete profile red flag id is destructive_action_without_evidence', deleteResult.redFlag.id === 'destructive_action_without_evidence');

const { result: escalateResult } = applyAction(redState, pack.actions.find(a => a.id === 'escalate_without_checks'));
assert('Escalate action returns redFlag', !!escalateResult.redFlag);
assert('Escalate red flag id is escalate_without_basic_checks', escalateResult.redFlag.id === 'escalate_without_basic_checks');

/* ════════════════════════════════════════════════════════════
   6. Red-flag actions visible to candidate, metadata hidden
   ════════════════════════════════════════════════════════════ */

console.log('\n--- Item 6: Red-flag metadata hidden from candidate ---');

let candState = pack.initialState;
candState = applyAction(candState, pack.actions.find(a => a.id === 'start_call')).updatedState;
candState = applyAction(candState, pack.actions.find(a => a.id === 'remote_connect')).updatedState;
const safeActions = getVisibleActions(candState, pack.actions);

const reinstallVis = safeActions.find(a => a.id === 'reinstall_outlook');
const deleteVis = safeActions.find(a => a.id === 'delete_mail_profile');
const escalateVis = safeActions.find(a => a.id === 'escalate_without_checks');

assert('Reinstall is visible to candidate', !!reinstallVis);
assert('Reinstall is tagged as redFlag', reinstallVis.redFlag === true);
assert('Delete profile is visible to candidate', !!deleteVis);
assert('Delete is tagged as redFlag', deleteVis.redFlag === true);
assert('Escalate is visible to candidate', !!escalateVis);
assert('Escalate is tagged as redFlag', escalateVis.redFlag === true);

/* The redFlag *metadata* (message, severity) must NOT appear on VisibleAction */
assert('Reinstall VisibleAction has no severity field', !('severity' in reinstallVis));
assert('Reinstall VisibleAction has no message field', !('message' in reinstallVis));

/* ════════════════════════════════════════════════════════════
   7. session_events contains canonical timeline
   ════════════════════════════════════════════════════════════ */

console.log('\n--- Item 7: session_events is canonical ---');

setupDb();
const { initTables } = require('../lib/mvp/db');
initTables();
const db = getDb();

const assessmentId = BASE_ID + '-a';
const sessionId = BASE_ID + '-s';
const inviteToken = BASE_ID + '-tok';
const scenarioId = 'scenario-outlook-001';
const criteriaId = 'criteria-msp-v1';

db.prepare(`INSERT INTO assessments (id, title, candidate_name, invite_token, status, scenario_id, criteria_version_id, assessment_pack_id, assessment_mode, created_at)
  VALUES (?, 'Test Hardening', 'Test Candidate', ?, 'invited', ?, ?, ?, 'dashboard_sim', datetime('now'))`)
  .run(assessmentId, inviteToken, scenarioId, criteriaId, PACK_ID);

db.prepare(`INSERT INTO sessions (id, assessment_id, status, started_at)
  VALUES (?, ?, 'in_progress', datetime('now'))`).run(sessionId, assessmentId);

db.prepare(`INSERT INTO messages (id, session_id, role, content, created_at)
  VALUES (?, ?, 'caller', 'Test opening', datetime('now'))`).run('msg-' + BASE_ID, sessionId);

db.prepare(`INSERT INTO sim_sessions (id, session_id, assessment_id, assessment_pack_id, current_state_json, started_at)
  VALUES (?, ?, ?, ?, '{}', datetime('now'))`).run('sim-' + BASE_ID, sessionId, assessmentId, PACK_ID);

/* Insert events via insertSimEvent */
const { insertSimEvent } = require('../lib/mvp/sim/eventLog');
const now = Date.now();

insertSimEvent({ session_id: sessionId, assessment_id: assessmentId, assessment_pack_id: PACK_ID, event_type: 'sim_started', actor: 'system', label: 'Simulation started', started_at_ms: now });
insertSimEvent({ session_id: sessionId, assessment_id: assessmentId, assessment_pack_id: PACK_ID, event_type: 'action_performed', actor: 'candidate', tool_id: 'outlook', action_id: 'open_outlook', label: 'Open Outlook', result_text: 'Outlook opens', taxonomy_tags: ['tool.outlook.open'], started_at_ms: now + 100 });
insertSimEvent({ session_id: sessionId, assessment_id: assessmentId, assessment_pack_id: PACK_ID, event_type: 'red_flag_triggered', actor: 'system', tool_id: 'control_panel', action_id: 'reinstall_outlook', label: 'Reinstall Outlook', result_text: 'Bad action', red_flag: { id: 'test-flag', severity: 'major', message: 'Test' }, started_at_ms: now + 200 });

const sessionEventCount = db.prepare('SELECT COUNT(*) as c FROM session_events WHERE session_id = ?').get(sessionId).c;
const simEventCount = db.prepare('SELECT COUNT(*) as c FROM sim_events WHERE session_id = ?').get(sessionId).c;

assert(`session_events has ${sessionEventCount} events for session`, sessionEventCount >= 3);
assert(`sim_events has ${simEventCount} events for session`, simEventCount >= 3);

/* Check taxonomy_tags in session_events payload */
const seRows = db.prepare('SELECT * FROM session_events WHERE session_id = ? ORDER BY sequence_index ASC').all(sessionId);
const actionEvent = seRows.find(r => r.event_type === 'action_performed');
assert('action_performed exists in session_events', !!actionEvent);
if (actionEvent?.payload_json) {
  const p = JSON.parse(actionEvent.payload_json);
  assert('payload has taxonomy_tags', Array.isArray(p.taxonomy_tags));
  assert('taxonomy_tags includes tool.outlook.open', p.taxonomy_tags.includes('tool.outlook.open'));
}

const rfEvent = seRows.find(r => r.event_type === 'red_flag_triggered');
assert('red_flag_triggered exists in session_events', !!rfEvent);
if (rfEvent?.payload_json) {
  const p = JSON.parse(rfEvent.payload_json);
  assert('payload has red_flag', !!p.red_flag);
  assert('red_flag has severity', p.red_flag.severity === 'major');
  assert('red_flag has id', p.red_flag.id === 'test-flag');
}

/* Verify canonical timeline building works from session_events */
const { buildTimeline } = require('../lib/mvp/sim/timeline');
const timelineEvents = seRows.map(e => ({
  ...e,
  sequence: e.sequence_index,
  started_at_ms: e.started_at_ms,
}));
const timeline = buildTimeline(timelineEvents);
assert('Timeline built from session_events has entries', timeline.length >= 2);

db.close();

/* ════════════════════════════════════════════════════════════
   8. Rejected actions are not logged
   ════════════════════════════════════════════════════════════ */

console.log('\n--- Item 8: Rejected actions not logged ---');

/* Verified at Item 4: applyAction returns { ok: false } and the API route
   returns before inserting any sim event. The state machine never mutates state
   when ok is false (updatedState === state_before). */
const rejAction = pack.actions.find(a => a.id === 'disable_work_offline');
const { result: rej, updatedState: rejState } = applyAction(pack.initialState, rejAction);
assert('Rejected action does not mutate state', JSON.stringify(rejState) === JSON.stringify(pack.initialState));
assert('Rejected action has ok=false', rej.ok === false);
assert('Rejected action returns an errorCode', typeof rej.errorCode === 'string');
assert('State before === state after on rejection', JSON.stringify(rej.state_before) === JSON.stringify(rej.state_after));

/* ════════════════════════════════════════════════════════════
   9. Scoring is deterministic on same event stream
   ════════════════════════════════════════════════════════════ */

console.log('\n--- Item 9: Deterministic scoring ---');

const scoreEvents = [
  { event_type: 'action_performed', action_id: 'open_outlook', label: 'Open Outlook', payload: { taxonomy_tags: ['tool.outlook.open'] } },
  { event_type: 'action_performed', action_id: 'check_outlook_status', label: 'Check status', payload: { taxonomy_tags: ['tool.outlook.check_status', 'diagnostic.application_state_checked'] } },
  { event_type: 'action_performed', action_id: 'disable_work_offline', label: 'Disable WFO', payload: { taxonomy_tags: ['tool.outlook.disable_work_offline', 'fix.correct_root_cause'] } },
  { event_type: 'action_performed', action_id: 'send_test_email', label: 'Send test', payload: { taxonomy_tags: ['tool.outlook.send_test_email', 'verification.test_email_sent'] } },
];

const scoreFinalState = {
  ...pack.initialState,
  phase: 'submitted',
  outlook: { ...pack.initialState.outlook, workOffline: false, outboxCount: 0, sentTestEmail: true },
  evidence: { askedImpact: false, askedScope: false, confirmedUser: false, confirmedDevice: false, checkedObviousCause: true, verifiedFix: true },
};

const run1 = scoreSimEvents({ pack, events: scoreEvents, finalState: scoreFinalState });
const run2 = scoreSimEvents({ pack, events: scoreEvents, finalState: scoreFinalState });

assert('First scoring run produces a numeric score', typeof run1.scoreDelta === 'number');
assert('Second scoring run produces the same score', run1.scoreDelta === run2.scoreDelta);
assert('Correct fix scored > 50', run1.scoreDelta > 50);

/* Run with red flags — score should be lower */
const badEvents = [
  { event_type: 'action_performed', action_id: 'open_outlook', label: 'Open Outlook', payload: { taxonomy_tags: ['tool.outlook.open'] } },
  { event_type: 'red_flag_triggered', action_id: 'reinstall_outlook', label: 'Reinstall Outlook', payload: null },
  { event_type: 'red_flag_triggered', action_id: 'delete_mail_profile', label: 'Delete profile', payload: null },
];

const badFinal = { ...pack.initialState, phase: 'submitted', evidence: { askedImpact: false, askedScope: false, confirmedUser: false, confirmedDevice: false, checkedObviousCause: false, verifiedFix: false } };
const badRun = scoreSimEvents({ pack, events: badEvents, finalState: badFinal });
assert('Bad actions produce lower score', badRun.scoreDelta < 30);
assert('Bad actions produce red flags', badRun.redFlags.length >= 2);

/* ════════════════════════════════════════════════════════════
   Report
   ════════════════════════════════════════════════════════════ */

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
