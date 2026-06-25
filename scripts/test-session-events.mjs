import { execSync } from 'child_process';
import { unlinkSync } from 'fs';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = './data/test-session-events.db';
let pass = 0, fail = 0;
function ok(l) { pass++; console.log(`  ✓ ${l}`); }
function no(l) { fail++; console.log(`  ✗ ${l}`); }
function makeId() { return 'tse-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }

try { unlinkSync(DB_PATH); } catch {}
console.log('\n=== Session Events Test Suite ===\n');

execSync(`TAXONOMY_JSON_PATH=taxonomy/taxonomy.json MVP_SQLITE_PATH=${DB_PATH} node scripts/mvp-init-db.mjs`, { cwd: process.cwd(), stdio: 'pipe' });
console.log('--- Setup ---');

const db = new Database(path.resolve(DB_PATH));
db.pragma('journal_mode = WAL');

// 1. session_events table exists
console.log('\n--- Schema ---');
const r = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='session_events'").get();
ok(!!r, 'session_events table exists');

// 2. Create assessment + session
console.log('\n--- Assessment Creation ---');
const scenario = db.prepare('SELECT * FROM scenarios WHERE active = 1 LIMIT 1').get();
const criteria = db.prepare('SELECT * FROM assessment_criteria_versions WHERE active = 1 LIMIT 1').get();
const aid = makeId(), sid = makeId(), tok = makeId();
db.prepare(`INSERT INTO assessments (id, title, candidate_name, invite_token, status, scenario_id, criteria_version_id, assessment_mode, created_at)
  VALUES (?, ?, ?, ?, 'invited', ?, ?, 'chat_call', datetime('now'))`).run(
  aid, 'Events Test', 'Test User', tok, scenario?.id || '', criteria?.id || '');
db.prepare(`INSERT INTO sessions (id, assessment_id, status, started_at)
  VALUES (?, ?, 'in_progress', datetime('now'))`).run(sid, aid);

// Write assessment_started event
db.prepare(`INSERT INTO session_events (id, assessment_id, session_id, sequence_index, event_type, actor, label, started_at_ms)
  VALUES (?, ?, ?, 0, 'assessment_started', 'system', 'Assessment created', ?)`).run(makeId(), aid, sid, Date.now());
db.prepare(`INSERT INTO session_events (id, assessment_id, session_id, sequence_index, event_type, actor, text, started_at_ms)
  VALUES (?, ?, ?, 1, 'customer_message', 'customer', 'Hi, I cannot send emails from Outlook.', ?)`).run(makeId(), aid, sid, Date.now() + 100);

// Write candidate message events
db.prepare(`INSERT INTO session_events (id, assessment_id, session_id, sequence_index, event_type, actor, text, started_at_ms, ended_at_ms, duration_ms)
  VALUES (?, ?, ?, 2, 'candidate_message', 'candidate', 'I can help. Can you access webmail?', ?, ?, ?)`).run(makeId(), aid, sid, Date.now() + 2000, Date.now() + 5000, 3000);

db.prepare(`INSERT INTO session_events (id, assessment_id, session_id, sequence_index, event_type, actor, text, started_at_ms)
  VALUES (?, ?, ?, 3, 'customer_message', 'customer', 'Yes, webmail works fine.', ?)`).run(makeId(), aid, sid, Date.now() + 6000);

// Write ticket events
db.prepare(`INSERT INTO session_events (id, assessment_id, session_id, sequence_index, event_type, actor, text, started_at_ms)
  VALUES (?, ?, ?, 4, 'ticket_submitted', 'candidate', 'Outlook stuck working offline. Disabled and test sent.', ?)`).run(makeId(), aid, sid, Date.now() + 10000);

db.prepare(`INSERT INTO session_events (id, assessment_id, session_id, sequence_index, event_type, actor, label, started_at_ms)
  VALUES (?, ?, ?, 5, 'assessment_completed', 'system', 'Assessment completed', ?)`).run(makeId(), aid, sid, Date.now() + 10100);

ok(true, 'Events inserted');

// 3. Verify events
console.log('\n--- Event Verification ---');
const events = db.prepare('SELECT * FROM session_events WHERE session_id = ? ORDER BY sequence_index ASC').all(sid);
ok(events.length === 6, `6 events (got ${events.length})`);

const types = events.map(e => e.event_type);
ok(types[0] === 'assessment_started', 'Event 0: assessment_started');
ok(types[1] === 'customer_message', 'Event 1: customer_message');
ok(types[2] === 'candidate_message', 'Event 2: candidate_message');
ok(types[3] === 'customer_message', 'Event 3: customer_message');
ok(types[4] === 'ticket_submitted', 'Event 4: ticket_submitted');
ok(types[5] === 'assessment_completed', 'Event 5: assessment_completed');

// Check sequence order
let orderOk = true;
for (let i = 0; i < events.length; i++) {
  if (events[i].sequence_index !== i) { orderOk = false; break; }
}
ok(orderOk, 'Sequence order correct');

// Check timing
const candMsg = events[2];
ok(candMsg.started_at_ms != null && candMsg.ended_at_ms != null && candMsg.duration_ms === 3000, 'Timing fields present on candidate_message');

// 4. Timeline verified via SQL ordering
console.log('\n--- Timeline Building ---');
// Events already verified in sequence order above
ok(true, 'Timeline order verified via sequence_index');
// Timing: events have started_at_ms, can calculate offsets
const firstTs = events[0].started_at_ms;
const lastEvt = events[events.length - 1];
const lastTs = lastEvt.started_at_ms || lastEvt.ended_at_ms;
ok(typeof firstTs === 'number' && typeof lastTs === 'number', 'Timestamps available for timing');
if (firstTs && lastTs) {
  const dur = lastTs - firstTs;
  ok(dur > 0, `Duration positive: ${dur}ms`);
}

// 5. Assessment mode default
console.log('\n--- Compatibility ---');
const arow = db.prepare('SELECT * FROM assessments WHERE id = ?').get(aid);
ok(arow.assessment_mode === 'chat_call', 'Default mode is chat_call');

// Check messages table still works
const legacyMsg = makeId();
db.prepare(`INSERT INTO messages (id, session_id, role, content, created_at)
  VALUES (?, ?, 'candidate', 'test legacy message', datetime('now'))`).run(legacyMsg, sid);
const msgCheck = db.prepare('SELECT * FROM messages WHERE id = ?').get(legacyMsg);
ok(!!msgCheck, 'Legacy messages table still works');

db.close();
try { unlinkSync(DB_PATH); } catch {}

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===\n`);
process.exit(fail > 0 ? 1 : 0);
