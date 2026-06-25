import { execSync } from 'child_process';
import { unlinkSync } from 'fs';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = './data/test-dashboard-sim.db';
const OUTLOOK_SIM_PACK_ID = 'pack-outlook-sim-v1';

let pass = 0;
let fail = 0;

function ok(label) { pass++; console.log(`  ✓ ${label}`); }
function no(label) { fail++; console.log(`  ✗ ${label}`); }

function makeId() {
  return 'tst-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

try { unlinkSync(DB_PATH); } catch {}

console.log('\n=== Dashboard Sim Test Suite ===\n');

// Init DB via existing script
console.log('--- Setup ---');
execSync(`TAXONOMY_JSON_PATH=taxonomy/taxonomy.json MVP_SQLITE_PATH=${DB_PATH} node scripts/mvp-init-db.mjs`, { cwd: process.cwd(), stdio: 'pipe' });
console.log('  DB initialised');

const db = new Database(path.resolve(DB_PATH));
db.pragma('journal_mode = WAL');

// 1. Schema
console.log('\n--- Schema ---');
for (const t of ['sim_sessions', 'sim_events']) {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='${t}'`).get();
  row ? ok(`Table ${t} exists`) : no(`Table ${t} missing`);
}

const assCols = db.prepare("PRAGMA table_info(assessments)").all().map(c => c.name);
if (assCols.includes('assessment_pack_id')) ok('assessments.assessment_pack_id column'); else no('');
if (assCols.includes('assessment_mode')) ok('assessments.assessment_mode column'); else no('');

const pcols = db.prepare("PRAGMA table_info(assessment_packs)").all().map(c => c.name);
if (pcols.includes('sim_config_json')) ok('assessment_packs.sim_config_json column'); else no('');
if (pcols.includes('sim_initial_state_json')) ok('assessment_packs.sim_initial_state_json column'); else no('');
if (pcols.includes('sim_success_conditions_json')) ok('assessment_packs.sim_success_conditions_json column'); else no('');

// 2. Pack
console.log('\n--- Pack ---');
const pack = db.prepare('SELECT * FROM assessment_packs WHERE id = ?').get(OUTLOOK_SIM_PACK_ID);
pack ? ok('Pack exists') : no('Pack missing');

const cfg = pack ? JSON.parse(pack.sim_config_json || '{}') : {};
const init = pack ? JSON.parse(pack.sim_initial_state_json || '{}') : {};
const suc = pack ? JSON.parse(pack.sim_success_conditions_json || '{}') : {};

if (cfg.tools?.length >= 4) ok('Tools array'); else no('');
if (cfg.actions?.length >= 5) ok('Actions array'); else no('');
if (init.outlook_mode === 'offline') ok('Initial state offline'); else no('');
if (suc.ticket_note_submitted === true) ok('Success condition defined'); else no('');

// 3. Create assessment
console.log('\n--- Assessment ---');
const scenario = db.prepare('SELECT * FROM scenarios WHERE active = 1 LIMIT 1').get();
const criteria = db.prepare('SELECT * FROM assessment_criteria_versions WHERE active = 1 LIMIT 1').get();
const aid = makeId(), sid = makeId(), tok = makeId();

db.prepare(`INSERT INTO assessments (id, title, candidate_name, invite_token, status, scenario_id, criteria_version_id, assessment_pack_id, assessment_mode, created_at)
  VALUES (?, ?, ?, ?, 'invited', ?, ?, ?, 'dashboard_sim', datetime('now'))`).run(
  aid, 'Dash Sim Test', 'Test User', tok,
  scenario?.id || '', criteria?.id || '', OUTLOOK_SIM_PACK_ID
);
db.prepare(`INSERT INTO sessions (id, assessment_id, status, started_at)
  VALUES (?, ?, 'in_progress', datetime('now'))`).run(sid, aid);

const ssid = makeId();
db.prepare(`INSERT INTO sim_sessions (id, session_id, assessment_id, assessment_pack_id, current_state_json, started_at)
  VALUES (?, ?, ?, ?, ?, datetime('now'))`).run(ssid, sid, aid, OUTLOOK_SIM_PACK_ID, JSON.stringify(init));

const r = db.prepare('SELECT * FROM assessments WHERE id = ?').get(aid);
if (r.assessment_mode === 'dashboard_sim') ok('Mode = dashboard_sim'); else no('');
if (r.assessment_pack_id === OUTLOOK_SIM_PACK_ID) ok('Pack ID set'); else no('');

const ss = db.prepare('SELECT * FROM sim_sessions WHERE assessment_id = ?').get(aid);
if (ss) ok('sim_session created'); else no('');

// 4. Actions
console.log('\n--- Actions ---');
let state = { ...init };
const aids = ['open_outlook', 'check_outlook_status', 'toggle_work_offline', 'send_test_email'];

for (let i = 0; i < aids.length; i++) {
  const action = cfg.actions.find(a => a.id === aids[i]);
  if (!action) { no(`Action ${aids[i]} not found`); continue; }

  let can = true;
  if (action.requires_state) {
    for (const [k, v] of Object.entries(action.requires_state)) {
      if (state[k] !== v) can = false;
    }
  }
  if (!can) { console.log(`  ! Skip ${aids[i]}`); continue; }

  const before = { ...state };
  if (action.state_patch) for (const [k, v] of Object.entries(action.state_patch)) state[k] = v;

  db.prepare(`INSERT INTO sim_events (id, session_id, assessment_id, assessment_pack_id, sequence_index, event_type, actor, tool_id, action_id, label, result_text, state_before_json, state_after_json, timestamp_ms, created_at)
    VALUES (?, ?, ?, ?, ?, 'action_performed', 'candidate', ?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(
    makeId(), sid, aid, OUTLOOK_SIM_PACK_ID, i,
    action.tool, aids[i], action.label, action.result,
    JSON.stringify(before), JSON.stringify(state), Date.now()
  );
}

if (state.outlook_mode === 'online') ok('State became online'); else no('');
if (state.outbox_count === 0) ok('Outbox cleared'); else no('');
if (state.test_email_sent === true) ok('Test email sent'); else no('');

// 5. Events
console.log('\n--- Events ---');
const ev = db.prepare('SELECT * FROM sim_events WHERE session_id = ? ORDER BY sequence_index ASC').all(sid);
if (ev.length === 4) ok(`4 events`); else no(`Got ${ev.length} events`);
const eids = ev.map(e => e.action_id);
for (let i = 0; i < aids.length; i++) {
  if (eids[i] === aids[i]) ok(`Event ${i}: ${aids[i]}`); else no(`Event ${i} mismatch: ${eids[i]}`);
}

// 6. Complete
console.log('\n--- Completion ---');
state.ticket_note_submitted = true;
db.prepare('UPDATE sim_sessions SET current_state_json = ?, completed_at = datetime(\'now\'), final_state_json = ? WHERE id = ?').run(
  JSON.stringify(state), JSON.stringify(state), ssid
);
const done = db.prepare('SELECT * FROM sim_sessions WHERE id = ?').get(ssid);
if (done.completed_at) ok('completed_at set'); else no('');
if (done.final_state_json) ok('final_state_json set'); else no('');
const fs = JSON.parse(done.final_state_json);
if (fs.ticket_note_submitted === true) ok('ticket_note_submitted in final state'); else no('');

// 7. Legacy
console.log('\n--- Legacy ---');
const lid = makeId();
db.prepare(`INSERT INTO assessments (id, title, candidate_name, invite_token, status, scenario_id, criteria_version_id, assessment_mode, created_at)
  VALUES (?, ?, ?, ?, 'invited', ?, ?, 'chat_call', datetime('now'))`).run(
  lid, 'Legacy', 'Legacy User', makeId(), scenario?.id || '', criteria?.id || ''
);
const lr = db.prepare('SELECT * FROM assessments WHERE id = ?').get(lid);
if (lr.assessment_mode === 'chat_call') ok('Legacy chat_call works'); else no('');
const ls = db.prepare('SELECT * FROM sim_sessions WHERE session_id IN (SELECT id FROM sessions WHERE assessment_id = ?)').get(lid);
if (!ls) ok('No sim_session for chat_call'); else no('');

db.close();
try { unlinkSync(DB_PATH); } catch {}

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===\n`);
process.exit(fail > 0 ? 1 : 0);
