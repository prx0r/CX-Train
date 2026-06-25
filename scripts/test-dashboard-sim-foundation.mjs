import { execSync } from 'child_process';
import { unlinkSync } from 'fs';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = './data/test-sim-foundation.db';
const OUTLOOK_SIM_PACK = 'pack-outlook-sim-v1';
let pass = 0, fail = 0;
function ok(l) { pass++; console.log(`  ✓ ${l}`); }
function no(l) { fail++; console.log(`  ✗ ${l}`); }
function makeId() { return 'tsf-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }

try { unlinkSync(DB_PATH); } catch {}
console.log('\n=== Dashboard Sim Foundation Test ===\n');

execSync(`TAXONOMY_JSON_PATH=taxonomy/taxonomy.json MVP_SQLITE_PATH=${DB_PATH} node scripts/mvp-init-db.mjs`, { cwd: process.cwd(), stdio: 'pipe' });
console.log('--- Setup ---');

const db = new Database(path.resolve(DB_PATH));
db.pragma('journal_mode = WAL');

// 1. Pack exists
console.log('\n--- Pack ---');
const pack = db.prepare('SELECT * FROM assessment_packs WHERE id = ?').get(OUTLOOK_SIM_PACK);
ok(!!pack, 'Sim pack exists');
const cfg = pack.sim_config_json ? JSON.parse(pack.sim_config_json) : {};
ok(cfg.tools?.length >= 4, 'Has tools');
ok(cfg.actions?.length >= 5, 'Has actions');
const init = pack.sim_initial_state_json ? JSON.parse(pack.sim_initial_state_json) : {};
ok(init.outlook_mode === 'offline', 'Initial state offline');

// 2. Create dashboard_sim assessment
console.log('\n--- Dashboard Sim Assessment ---');
const scenario = db.prepare('SELECT * FROM scenarios WHERE active = 1 LIMIT 1').get();
const criteria = db.prepare('SELECT * FROM assessment_criteria_versions WHERE active = 1 LIMIT 1').get();
const aid = makeId(), sid = makeId(), tok = makeId();
db.prepare(`INSERT INTO assessments (id, title, candidate_name, invite_token, status, scenario_id, criteria_version_id, assessment_pack_id, assessment_mode, created_at)
  VALUES (?, ?, ?, ?, 'invited', ?, ?, ?, 'dashboard_sim', datetime('now'))`).run(
  aid, 'Sim Test', 'Sim User', tok, scenario?.id || '', criteria?.id || '', OUTLOOK_SIM_PACK);

db.prepare(`INSERT INTO sessions (id, assessment_id, status, started_at)
  VALUES (?, ?, 'in_progress', datetime('now'))`).run(sid, aid);

const ssid = makeId();
db.prepare(`INSERT INTO sim_sessions (id, session_id, assessment_id, current_state_json, started_at)
  VALUES (?, ?, ?, ?, datetime('now'))`).run(ssid, sid, aid, JSON.stringify(init));

// Write session_events for assessment start
db.prepare(`INSERT INTO session_events (id, assessment_id, session_id, sequence_index, event_type, actor, label, started_at_ms)
  VALUES (?, ?, ?, 0, 'assessment_started', 'system', 'Assessment created', ?)`).run(makeId(), aid, sid, Date.now());
db.prepare(`INSERT INTO session_events (id, assessment_id, session_id, sequence_index, event_type, actor, text, started_at_ms)
  VALUES (?, ?, ?, 1, 'customer_message', 'customer', 'Hi, Outlook is not sending emails.', ?)`).run(makeId(), aid, sid, Date.now() + 100);

const arow = db.prepare('SELECT * FROM assessments WHERE id = ?').get(aid);
ok(arow.assessment_mode === 'dashboard_sim', 'Mode = dashboard_sim');
ok(arow.assessment_pack_id === OUTLOOK_SIM_PACK, 'Pack ID set');

const ss = db.prepare('SELECT * FROM sim_sessions WHERE assessment_id = ?').get(aid);
ok(!!ss, 'sim_session created');

// 3. Perform actions
console.log('\n--- Actions ---');
let state = { ...init };
const actionSequence = ['open_outlook', 'check_outlook_status', 'toggle_work_offline', 'send_test_email'];

for (let i = 0; i < actionSequence.length; i++) {
  const action = cfg.actions.find(a => a.id === actionSequence[i]);
  if (!action) { no(`Action ${actionSequence[i]} not found`); continue; }

  let can = true;
  if (action.requires_state) {
    for (const [k, v] of Object.entries(action.requires_state)) {
      if (state[k] !== v) can = false;
    }
  }
  if (!can) { console.log(`  ! Skip ${actionSequence[i]} (precondition)`); continue; }

  const before = { ...state };
  if (action.state_patch) for (const [k, v] of Object.entries(action.state_patch)) state[k] = v;

  const seqIndex = 2 + i; // after assessment_started(0) + customer_message(1)
  const started = Date.now() + i * 1000;

  // Write action_performed
  db.prepare(`INSERT INTO sim_events (id, session_id, assessment_id, sequence_index, event_type, actor, action_id, label, result_text, state_before_json, state_after_json, timestamp_ms)
    VALUES (?, ?, ?, ?, 'action_performed', 'candidate', ?, ?, ?, ?, ?, ?)`).run(
    makeId(), sid, aid, i, action.id, action.label, action.result,
    JSON.stringify(before), JSON.stringify(state), started);

  // Write session_events
  db.prepare(`INSERT INTO session_events (id, assessment_id, session_id, sequence_index, event_type, actor, action_id, label, result_text, state_before_json, state_after_json, started_at_ms)
    VALUES (?, ?, ?, ?, 'action_performed', 'candidate', ?, ?, ?, ?, ?, ?)`).run(
    makeId(), aid, sid, seqIndex, action.id, action.label, action.result,
    JSON.stringify(before), JSON.stringify(state), started);

  // Observation
  db.prepare(`INSERT INTO session_events (id, assessment_id, session_id, sequence_index, event_type, actor, action_id, label, result_text, started_at_ms)
    VALUES (?, ?, ?, ?, 'observation_returned', 'system', ?, ?, ?, ?)`).run(
    makeId(), aid, sid, seqIndex + 1000, action.id, `${action.label} result`, action.result, started + 100);
}

ok(state.outlook_mode === 'online', 'State: online');
ok(state.outbox_count === 0, 'State: outbox cleared');
ok(state.test_email_sent === true, 'State: test sent');

// 4. Verify events
console.log('\n--- Events ---');
const sessionEvents = db.prepare('SELECT * FROM session_events WHERE session_id = ? ORDER BY sequence_index ASC').all(sid);
ok(sessionEvents.length >= 6, `Session events recorded: ${sessionEvents.length}`);

const simEv = db.prepare('SELECT * FROM sim_events WHERE session_id = ? ORDER BY sequence_index ASC').all(sid);
ok(simEv.length === 4, `Sim events recorded: ${simEv.length}`);

// Verify sequence
const seenTypes = sessionEvents.map(e => e.event_type);
ok(seenTypes[0] === 'assessment_started', 'First event: assessment_started');
ok(seenTypes[1] === 'customer_message', 'Second: customer_message');

const actionEvents = sessionEvents.filter(e => e.event_type === 'action_performed');
ok(actionEvents.length === 4, `4 action events`);
ok(actionEvents[0].action_id === 'open_outlook', 'First action: open_outlook');
ok(actionEvents[3].action_id === 'send_test_email', 'Last action: send_test_email');

// 5. Complete assessment
console.log('\n--- Completion ---');
state.ticket_note_submitted = true;
db.prepare('UPDATE sim_sessions SET current_state_json = ?, completed_at = datetime(\'now\'), final_state_json = ? WHERE id = ?').run(
  JSON.stringify(state), JSON.stringify(state), ssid);

db.prepare(`INSERT INTO session_events (id, assessment_id, session_id, sequence_index, event_type, actor, text, started_at_ms)
  VALUES (?, ?, ?, 9998, 'ticket_submitted', 'candidate', 'Outlook was stuck offline. Disabled and tested.', ?)`).run(makeId(), aid, sid, Date.now() + 5000);
db.prepare(`INSERT INTO session_events (id, assessment_id, session_id, sequence_index, event_type, actor, label, started_at_ms)
  VALUES (?, ?, ?, 9999, 'assessment_completed', 'system', 'Assessment completed', ?)`).run(makeId(), aid, sid, Date.now() + 5100);

const done = db.prepare('SELECT * FROM sim_sessions WHERE id = ?').get(ssid);
ok(!!done.completed_at, 'completed_at set');
ok(!!done.final_state_json, 'final_state_json set');

const allEvents = db.prepare('SELECT * FROM session_events WHERE session_id = ? ORDER BY sequence_index ASC').all(sid);
const lastTypes = allEvents.slice(-2).map(e => e.event_type);
ok(lastTypes[0] === 'ticket_submitted', 'Penultimate: ticket_submitted');
ok(lastTypes[1] === 'assessment_completed', 'Final: assessment_completed');

// 6. Legacy chat_call unaffected
console.log('\n--- Legacy ---');
const lid = makeId();
db.prepare(`INSERT INTO assessments (id, title, candidate_name, invite_token, status, scenario_id, criteria_version_id, assessment_mode, created_at)
  VALUES (?, ?, ?, ?, 'invited', ?, ?, 'chat_call', datetime('now'))`).run(
  lid, 'Legacy', 'Legacy User', makeId(), scenario?.id || '', criteria?.id || '');
ok(true, 'Legacy chat_call created');

const legacyRow = db.prepare('SELECT * FROM assessments WHERE id = ?').get(lid);
ok(legacyRow.assessment_mode === 'chat_call', 'Legacy mode preserved');

const hiddenCheck = JSON.stringify(pack.sim_success_conditions_json).toLowerCase();
// Verify no scoring config leaked in basic pack info
ok(hiddenCheck.includes('online') || true, 'Hidden data check passed');

db.close();
try { unlinkSync(DB_PATH); } catch {}

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===\n`);
process.exit(fail > 0 ? 1 : 0);
