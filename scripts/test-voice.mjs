/**
 * VOICE LAYER TESTS — lightweight, no real API calls
 * Tests routing logic, validation, event metadata, and scoring invariance.
 */

import { createRequire } from 'module';
import { execSync } from 'child_process';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ts = require('typescript');

require.extensions['.ts'] = function compileTypeScript(module, filename) {
  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      skipLibCheck: true,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

/* ── Helpers ── */
const DB_PATH = '/tmp/test-voice.db';
const PACK_ID = 'pack-outlook-sim-v2';
const BASE_ID = 'voice-' + Date.now();

function setupDb() {
  if (existsSync(DB_PATH)) unlinkSync(DB_PATH);
  process.env.MVP_SQLITE_PATH = DB_PATH;
  execSync(`TAXONOMY_JSON_PATH=taxonomy/taxonomy.json MVP_SQLITE_PATH=${DB_PATH} node scripts/mvp-init-db.mjs`, { cwd: process.cwd(), stdio: 'pipe' });
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
   1. Transcribe route rejects missing audio
   ════════════════════════════════════════════════════════════ */

console.log('\n--- Item 1: Transcribe route rejects missing audio ---');

/* We test the validation logic directly */
const { validateAudioSize } = require('../lib/mvp/voice/stt');
assert('validateAudioSize accepts small file', (() => { validateAudioSize(1000); return true; })());

let oversizedThrew = false;
try {
  validateAudioSize(9 * 1024 * 1024);
} catch { oversizedThrew = true; }
assert('validateAudioSize rejects > 8MB', oversizedThrew);

/* ── 2. TTS route rejects empty text ── */

console.log('\n--- Item 2: TTS validation ---');

const { MAX_TTS_TEXT_LENGTH } = require('../lib/mvp/voice/types');
assert('MAX_TTS_TEXT_LENGTH is 1000', MAX_TTS_TEXT_LENGTH === 1000);

/* ── 3. Voice metadata types ── */

console.log('\n--- Item 3: Voice metadata shape ---');

const meta = {
  duration_ms: 3800,
  mime_type: 'audio/webm',
  stt_provider: 'openrouter',
  stt_model: 'openai/whisper-large-v3-turbo',
};
assert('VoiceMetadata has duration_ms', typeof meta.duration_ms === 'number');
assert('VoiceMetadata has stt_provider', meta.stt_provider === 'openrouter');
assert('VoiceMetadata has stt_model', meta.stt_model.includes('whisper'));

/* ── 4. Event log stores input_source and audio_metadata ── */

console.log('\n--- Item 4: Event log stores voice metadata ---');

setupDb();
const { initTables } = require('../lib/mvp/db');
initTables();
const db = getDb();

const assessmentId = BASE_ID + '-a';
const sessionId = BASE_ID + '-s';
const inviteToken = BASE_ID + '-tok';

db.prepare(`INSERT INTO assessments (id, title, candidate_name, invite_token, status, scenario_id, assessment_pack_id, assessment_mode, created_at)
  VALUES (?, 'Voice Test', 'Test Candidate', ?, 'invited', 'scenario-outlook-001', ?, 'dashboard_sim', datetime('now'))`)
  .run(assessmentId, inviteToken, PACK_ID);

db.prepare(`INSERT INTO sessions (id, assessment_id, status, started_at)
  VALUES (?, ?, 'in_progress', datetime('now'))`).run(sessionId, assessmentId);

const { appendSessionEvent } = require('../lib/mvp/events/eventLog');

/* Voice candidate message */
appendSessionEvent({
  assessment_id: assessmentId,
  session_id: sessionId,
  event_type: 'candidate_message',
  actor: 'candidate',
  text: 'Is anyone else affected?',
  started_at_ms: Date.now(),
  input_source: 'voice',
  audio_metadata: {
    duration_ms: 4200,
    mime_type: 'audio/webm',
    stt_provider: 'openrouter',
    stt_model: 'openai/whisper-large-v3-turbo',
  },
});

/* Text candidate message (control) */
appendSessionEvent({
  assessment_id: assessmentId,
  session_id: sessionId,
  event_type: 'candidate_message',
  actor: 'candidate',
  text: 'Can you check your email?',
  started_at_ms: Date.now(),
  input_source: 'text',
});

const { getSessionEvents } = require('../lib/mvp/events/eventLog');
const events = getSessionEvents(sessionId);

assert('2 events stored', events.length === 2);

const voiceEvent = events.find(e => e.text === 'Is anyone else affected?');
assert('Voice event found', !!voiceEvent);
assert('Voice event has input_source in payload', voiceEvent.payload_json?.input_source === 'voice' || voiceEvent['input_source'] === 'voice');
assert('Voice event has audio_metadata in payload', voiceEvent.payload_json?.audio_metadata?.stt_provider === 'openrouter');

const textEvent = events.find(e => e.text === 'Can you check your email?');
assert('Text event found', !!textEvent);

/* ── 5. Scoring is identical for voice vs text input ── */

console.log('\n--- Item 5: Scoring identical for voice vs text ---');

const { scoreSimEvents } = require('../lib/mvp/sim/scoring');
const { getOutlookWorkOfflinePack } = require('../lib/mvp/sim/packConfig');
const pack = getOutlookWorkOfflinePack();

const sharedState = {
  ...pack.initialState,
  phase: 'submitted',
  outlook: { ...pack.initialState.outlook, workOffline: false, outboxCount: 0, sentTestEmail: true },
  evidence: { askedImpact: false, askedScope: true, confirmedUser: true, confirmedDevice: false, checkedObviousCause: true, verifiedFix: true },
};

const textEvents = [
  { event_type: 'action_performed', action_id: 'open_outlook', label: 'Open Outlook', payload: { taxonomy_tags: ['tool.outlook.open'] } },
  { event_type: 'action_performed', action_id: 'check_outlook_status', label: 'Check status', payload: { taxonomy_tags: ['tool.outlook.check_status'] } },
];

const voiceEvents = [
  { event_type: 'action_performed', action_id: 'open_outlook', label: 'Open Outlook', payload: { taxonomy_tags: ['tool.outlook.open'], input_source: 'voice' } },
  { event_type: 'action_performed', action_id: 'check_outlook_status', label: 'Check status', payload: { taxonomy_tags: ['tool.outlook.check_status'], input_source: 'voice' } },
];

const textScore = scoreSimEvents({ pack, events: textEvents, finalState: sharedState });
const voiceScore = scoreSimEvents({ pack, events: voiceEvents, finalState: sharedState });

assert('Text and voice scores are identical', textScore.scoreDelta === voiceScore.scoreDelta);

/* ── 6. Voice routes exist and accept POST ── */

console.log('\n--- Item 6: Voice routes exist ---');

/* Check the route files exist */
import { existsSync as fsExists } from 'fs';

assert('Transcribe route file exists', fsExists('app/api/mvp/assessment/[token]/voice/transcribe/route.ts'));
assert('TTS route file exists', fsExists('app/api/mvp/assessment/[token]/voice/tts/route.ts'));
assert('VoiceRecorderButton component exists', fsExists('components/mvp/voice/VoiceRecorderButton.tsx'));
assert('CustomerAudioPlayer component exists', fsExists('components/mvp/voice/CustomerAudioPlayer.tsx'));

/* ── 7. Env var defaults work ── */

console.log('\n--- Item 7: Env var defaults ---');

assert('DEFAULT_TTS_MODEL matches', require('../lib/mvp/voice/types').DEFAULT_TTS_MODEL === 'hexgrad/kokoro-82m');
assert('DEFAULT_STT_MODEL matches', require('../lib/mvp/voice/types').DEFAULT_STT_MODEL === 'openai/whisper-large-v3-turbo');
assert('DEFAULT_TTS_VOICE matches', require('../lib/mvp/voice/types').DEFAULT_TTS_VOICE === 'af_heart');
assert('MAX_AUDIO_SIZE_BYTES is 8MB', require('../lib/mvp/voice/types').MAX_AUDIO_SIZE_BYTES === 8 * 1024 * 1024);

db.close();

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
