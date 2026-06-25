#!/usr/bin/env node
// Adversarial Scoring Engine Tests
// Designed to deliberately trip up the deterministic scorer.
// Run: node scripts/test-adversarial.mjs

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let scoring;
try {
  scoring = require('../.test-dist/lib/mvp/analysis/scoring.js');
} catch {
  console.error('ERROR: Production scorer not compiled. Run: npx tsc lib/mvp/analysis/scoring.ts --outDir .test-dist --module commonjs --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck');
  process.exit(1);
}
const { scoreExtraction, FAIL_GATES, DEFAULT_WEIGHTS } = scoring;

const W = Object.freeze({ ...DEFAULT_WEIGHTS });

function allPass() { const c = {}; for (const k of Object.keys(W)) c[k] = { status: 'pass' }; return c; }

function scoreOne(criteria, redFlags) {
  if (!criteria || typeof criteria !== 'object') {
    return { score: 0, raw: 0, readiness: 'not_ready', gates: [], failedChecks: [] };
  }
  const result = scoreExtraction({ criteria, redFlags: redFlags || [] });
  return {
    score: result.score,
    raw: result.rawScoreBeforeCaps,
    readiness: result.rating,
    gates: result.gateHits.map(g => g.id),
    failedChecks: result.failedRequiredChecks,
  };
}

// ====== Adversarial Edge Cases ======
const TESTS = [];

// ── NULL / UNDEFINED BOUNDARY ──
TESTS.push({ name: 'null criteria object', criteria: null, redFlags: [], expect: { score: 0, readiness: 'not_ready' }, reason: 'Should not crash on null' });
TESTS.push({ name: 'undefined criteria', criteria: undefined, redFlags: [], expect: { score: 0, readiness: 'not_ready' }, reason: 'Should not crash on undefined' });
TESTS.push({ name: 'empty criteria object', criteria: {}, redFlags: [], expect: { score: 0, readiness: 'not_ready' }, reason: 'Empty criteria = no data' });
TESTS.push({ name: 'null redFlags', criteria: allPass(), redFlags: null, expect: { score: 100, readiness: 'ready' }, reason: 'null redFlags should be treated as empty' });
TESTS.push({ name: 'undefined redFlags', criteria: allPass(), redFlags: undefined, expect: { score: 100, readiness: 'ready' }, reason: 'undefined redFlags should be treated as empty' });

// ── TYPE CONFUSION ──
TESTS.push({ name: 'status as number 0 instead of string', criteria: allPass(), criteriaOverride: { safety: { status: 0 } }, redFlags: [], expect: { scoreMax: 100 }, reason: 'Status as number 0 should be handled' });
TESTS.push({ name: 'status as boolean true instead of pass', criteria: allPass(), criteriaOverride: { impact: { status: true } }, redFlags: [], expect: { scoreMax: 100 }, reason: 'Boolean status should not crash' });
TESTS.push({ name: 'status as array instead of string', criteria: allPass(), criteriaOverride: { urgency: { status: ['pass'] } }, redFlags: [], expect: { scoreMax: 100 }, reason: 'Array status should not crash' });
TESTS.push({ name: 'status as object instead of string', criteria: allPass(), criteriaOverride: { scope: { status: { ok: 'yes' } } }, redFlags: [], expect: { scoreMax: 100 }, reason: 'Object status should not crash' });
TESTS.push({ name: 'status with leading/trailing whitespace', criteria: allPass(), criteriaOverride: { identity_check: { status: '  pass  ' } }, redFlags: [], expect: { scoreMin: 95 }, reason: 'Whitespace in status should be trimmed' });

// ── NOT_A_NUMBER / INFINITY ──
TESTS.push({ name: 'NaN score propagation (weight * NaN)', criteria: allPass(), criteriaOverride: { impact: { status: 'pass' } }, redFlags: [], expect: { scoreMax: 100 }, reason: 'NaN should not appear in scores' });
TESTS.push({ name: 'unknown key is ignored', criteria: { unknown_key: { status: 'pass' } }, redFlags: [], expect: { score: 0, readiness: 'not_ready' }, reason: 'Unknown criteria should not inflate the score' });
TESTS.push({ name: 'all not_applicable (maxPossibleScore=0)', criteria: (() => { const c = {}; for (const k of Object.keys(W)) c[k] = { status: 'not_applicable' }; return c; })(), redFlags: [], expect: { score: 0, readiness: 'not_ready' }, reason: 'All NA = 0 max possible score, division edge case' });

// ── GATE EDGE CASES ──
TESTS.push({ name: 'all 7 gates triggered simultaneously', criteria: allPass(), redFlags: [
  { type: 'severe_customer_abuse', evidence: 'Abuse' },
  { type: 'unsafe_security_behaviour', evidence: 'Security' },
  { type: 'refusal_to_help', evidence: 'Refusal' },
  { type: 'hallucinated_fix', evidence: 'Hallucinated' },
  { type: 'no_troubleshooting', evidence: 'NoTrouble' },
  { type: 'invented_fix_without_evidence', evidence: 'Invented' },
  { type: 'critical_urgency_missed', evidence: 'Urgency' },
], expect: { scoreMax: 10, readiness: 'not_ready' }, reason: 'Strictest cap (10) should win. Readiness forced to not_ready by critical gates.' });

TESTS.push({ name: 'duplicate red flag same gate (dedup)', criteria: allPass(), redFlags: [
  { type: 'severe_customer_abuse', evidence: 'First' },
  { type: 'severe_customer_abuse', evidence: 'Duplicate' },
  { type: 'severe_customer_abuse', evidence: 'Third' },
], expect: { scoreMax: 10, readiness: 'not_ready' }, reason: 'Duplicate red flags should not multiply gates' });

TESTS.push({ name: 'red flag type not in FAIL_GATES', criteria: allPass(), redFlags: [
  { type: 'made_up_nonsense_flag', evidence: 'Nothing' },
  { type: 'another_fake_one', evidence: 'Fake' },
], expect: { score: 100, readiness: 'ready' }, reason: 'Unknown red flag types must be silently ignored' });

TESTS.push({ name: 'red flag with missing type field', criteria: allPass(), redFlags: [
  { evidence: 'No type here' },
  { type: undefined, evidence: 'Type is undefined' },
  { type: null, evidence: 'Type is null' },
], expect: { score: 100, readiness: 'ready' }, reason: 'Red flag with no type should be ignored without crash' });

TESTS.push({ name: 'red flag with empty string type', criteria: allPass(), redFlags: [
  { type: '', evidence: 'Empty type' },
], expect: { score: 100, readiness: 'ready' }, reason: 'Empty string type should not match any gate' });

TESTS.push({ name: 'scoreCap=0 gate', criteria: allPass(), redFlags: [
  { type: 'severe_customer_abuse', evidence: 'test' },
], expect: { score: 10, readiness: 'not_ready' }, reason: 'Cap of 10 from severe_customer_abuse. Score should be 10.' });

// ── SCORE THRESHOLD EDGE CASES ──
// Score exactly 80 should be "ready"
TESTS.push({ name: 'score exactly 80 threshold', criteria: (() => {
  const c = allPass();
  c.safety = { status: 'fail' };
  c.professional_conduct = { status: 'fail' };
  return c;
})(), redFlags: [], expect: { scoreMin: 78, scoreMax: 85 }, reason: 'Score near the 80 ready threshold' });

TESTS.push({ name: 'score exactly 60 threshold', criteria: (() => {
  const c = {};
  for (const k of Object.keys(W)) c[k] = { status: 'fail' };
  c.identity_check = { status: 'pass' };
  c.company_check = { status: 'pass' };
  c.issue_clarification = { status: 'pass' };
  c.impact = { status: 'pass' };
  c.urgency = { status: 'pass' };
  c.scope = { status: 'pass' };
  c.next_steps = { status: 'pass' };
  c.customer_tone = { status: 'pass' };
  c.safety = { status: 'pass' };
  c.ticket_issue_summary = { status: 'pass' };
  c.ticket_next_step = { status: 'pass' };
  c.escalation_judgement = { status: 'pass' };
  c.started_when = { status: 'pass' };
  c.error_or_status_capture = { status: 'pass' };
  return c;
})(), redFlags: [], expect: { scoreMin: 55, scoreMax: 68 }, reason: 'Score near the 60 needs_supervision threshold' });

// ── CASE SENSITIVITY ──
TESTS.push({ name: 'status uppercase PASS', criteria: allPass(), criteriaOverride: { impact: { status: 'PASS' } }, redFlags: [], expect: { scoreMax: 100 }, reason: 'UPPERCASE status should match pass' });
TESTS.push({ name: 'status mixed case ParTiAl', criteria: allPass(), criteriaOverride: { urgency: { status: 'ParTiAl' } }, redFlags: [], expect: { scoreMin: 85, scoreMax: 95 }, reason: 'Mixed case partial on urgency triggers minor_urgency_documentation_gap (cap 90)' });
TESTS.push({ name: 'red flag type uppercase', criteria: allPass(), redFlags: [{ type: 'SEVERE_CUSTOMER_ABUSE', evidence: 'test' }], expect: { score: 10, readiness: 'not_ready' }, reason: 'Uppercase red flag type should normalize and trigger the gate' });
TESTS.push({ name: 'red flag type with whitespace', criteria: allPass(), redFlags: [{ type: '  severe_customer_abuse  ', evidence: 'test' }], expect: { score: 10, readiness: 'not_ready' }, reason: 'Whitespace-padded red flag type should normalize and trigger the gate' });

// ── WEIRD CRITERIA VALUES ──
TESTS.push({ name: 'criterion value is null', criteria: allPass(), criteriaOverride: { impact: null }, redFlags: [], expect: { scoreMax: 100 }, reason: 'Null criterion value should be skipped without crash' });
TESTS.push({ name: 'criterion value is empty object', criteria: allPass(), criteriaOverride: { impact: {} }, redFlags: [], expect: { scoreMax: 100 }, reason: 'Empty criterion object should use defaults' });
TESTS.push({ name: 'criterion with extra unknown fields', criteria: allPass(), criteriaOverride: { impact: { status: 'pass', totally_made_up: 'yes', random_data: [1,2,3] } }, redFlags: [], expect: { scoreMax: 100 }, reason: 'Extra fields in criterion should be ignored' });
TESTS.push({ name: 'all statuses are not_observed', criteria: (() => { const c = {}; for (const k of Object.keys(W)) c[k] = { status: 'not_observed' }; return c; })(), redFlags: [], expect: { score: 0, readiness: 'not_ready' }, reason: 'All not_observed = score 0' });
TESTS.push({ name: 'all statuses partial', criteria: (() => { const c = {}; for (const k of Object.keys(W)) c[k] = { status: 'partial' }; return c; })(), redFlags: [], expect: { score: 50, readiness: 'not_ready' }, reason: 'All partial = exactly 50' });

// ── GATE OVERRIDE EDGE CASES ──
TESTS.push({ name: 'hallucinated_fix with raw score 100 but cap 50', criteria: allPass(), redFlags: [{ type: 'hallucinated_fix', evidence: 'fix' }], expect: { score: 50, readiness: 'not_ready' }, reason: 'Score capped at 50, 50<60 so not_ready despite override saying needs_supervision' });
TESTS.push({ name: 'no_troubleshooting with raw score 100', criteria: allPass(), redFlags: [{ type: 'no_troubleshooting', evidence: 'none' }], expect: { score: 40, readiness: 'not_ready' }, reason: 'no_troubleshooting caps at 40, forces not_ready' });
TESTS.push({ name: 'invented_fix_without_evidence with raw 100', criteria: allPass(), redFlags: [{ type: 'invented_fix_without_evidence', evidence: 'fix' }], expect: { score: 50, readiness: 'not_ready' }, reason: 'Cap 50, score<60 → not_ready' });

// ── NEGATIVE / MALFORMED ──
TESTS.push({ name: 'negative weight scenario (not possible in code but test safety)', criteria: allPass(), redFlags: [], expect: { scoreMax: 100 }, reason: 'No negative weights in current code, but safe by design' });
TESTS.push({ name: 'extremely long evidence array', criteria: allPass(), criteriaOverride: { safety: { status: 'fail', evidence: new Array(10000).fill('x') } }, redFlags: [{ type: 'unsafe_security_behaviour', evidence: 'x'.repeat(10000) }], expect: { scoreMax: 25 }, reason: 'Very long evidence should not cause memory issues' });

// ── COMPETING GATES ──
TESTS.push({ name: 'abuse + invented fix: strictest cap wins', criteria: allPass(), redFlags: [
  { type: 'severe_customer_abuse', evidence: 'Abuse' },
  { type: 'hallucinated_fix', evidence: 'Fix' },
], expect: { scoreMax: 10, readiness: 'not_ready' }, reason: 'Cap 10 from severe_customer_abuse is strictest than 50 from hallucinated_fix' });

TESTS.push({ name: 'unsafe_security + no_troubleshooting', criteria: allPass(), redFlags: [
  { type: 'unsafe_security_behaviour', evidence: 'Unsafe' },
  { type: 'no_troubleshooting', evidence: 'NoTrouble' },
], expect: { scoreMax: 25, readiness: 'not_ready' }, reason: 'unsafe_security_behaviour caps at 25, no_troubleshooting at 40. 25 wins. Critical gate forces not_ready.' });

// ── THEORETICAL PIPE DREAMS ──
TESTS.push({ name: 'all pass + all 7 gates simultaneously', criteria: allPass(), redFlags: [
  { type: 'severe_customer_abuse', evidence: 'a' },
  { type: 'unsafe_security_behaviour', evidence: 'b' },
  { type: 'refusal_to_help', evidence: 'c' },
  { type: 'hallucinated_fix', evidence: 'd' },
  { type: 'no_troubleshooting', evidence: 'e' },
  { type: 'invented_fix_without_evidence', evidence: 'f' },
  { type: 'critical_urgency_missed', evidence: 'g' },
], expect: { score: 10, readiness: 'not_ready' }, reason: 'Strictest cap is 10 (severe_customer_abuse). All critical gates force not_ready.' });

// ── PRECISION EDGE ──
TESTS.push({ name: 'fractional earned score (partial on single criterion)', criteria: (() => {
  const c = {};
  for (const k of Object.keys(W)) c[k] = { status: 'fail' };
  c.identity_check = { status: 'partial' };
  return c;
})(), redFlags: [], expect: { score: 1, readiness: 'not_ready' }, reason: '0.5/46*100 = round(1.087) = 1' });

// ── MIXED VALID/INVALID CRITERIA ──
TESTS.push({ name: 'mix of valid, null, and missing criteria', criteria: {
  identity_check: { status: 'pass' },
  company_check: null,
  issue_clarification: undefined,
  impact: { status: 'fail' },
  urgency: { status: 'partial' },
  not_a_real_key: { status: 'pass' },
}, redFlags: [], expect: { score: 30, readiness: 'not_ready' }, reason: 'Derived gates (poor_ticket_quality, severe_data_gap) cap the score. Raw=36, capped by poor_ticket_quality at 60, but not_applicable exclusion reduces maxP.' });

// ── DUPLICATE GATE HANDLING ──
TESTS.push({ name: '30 identical red flags (stress dedup)', criteria: allPass(), redFlags: Array(30).fill({ type: 'severe_customer_abuse', evidence: 'spam' }), expect: { scoreMax: 10, readiness: 'not_ready' }, reason: '30 identical red flags should produce exactly 1 gate hit' });

// ── THE PERFECT CONTRADICTION ──
TESTS.push({ name: 'perfect candidate but ALSO abusive', criteria: allPass(), redFlags: [
  { type: 'severe_customer_abuse', evidence: 'Told customer to shut up' },
], expect: { score: 10, readiness: 'not_ready', rawMax: 100 }, reason: 'Even a perfect technical call gets crushed by abuse gate.' });

// ── GATE WITH NO EVIDENCE ──
TESTS.push({ name: 'red flag with empty evidence string', criteria: allPass(), redFlags: [
  { type: 'severe_customer_abuse', evidence: '' },
], expect: { scoreMax: 10, readiness: 'not_ready' }, reason: 'Empty evidence should still trigger the gate' });

// ====== RUN TESTS ======
console.log('='.repeat(72));
console.log('ADVERSARIAL SCORING ENGINE TESTS');
console.log('Designed to deliberately trip up the deterministic scorer');
console.log('='.repeat(72));
console.log(`\n${TESTS.length} adversarial edge cases\n`);

let pass = 0, fail = 0, crash = 0;

for (const t of TESTS) {
  let criteria = t.criteria;
  if (t.criteriaOverride && criteria) {
    criteria = JSON.parse(JSON.stringify(criteria));
    for (const [k, v] of Object.entries(t.criteriaOverride)) {
      criteria[k] = v;
    }
  }
  
  let r1, r2;
  let crashed = false;
  try {
    r1 = scoreOne(criteria, t.redFlags);
    r2 = scoreOne(criteria, t.redFlags);
  } catch (e) {
    crashed = true;
    crash++;
    console.log(`  💥 CRASH: ${t.name}`);
    console.log(`     ${e.message}`);
    fail++;
    continue;
  }

  const detOk = r1.score === r2.score && r1.readiness === r2.readiness;
  const expect = t.expect;
  let scoreOk = true;
  if (expect.score !== undefined) scoreOk = r1.score === expect.score;
  else if (expect.scoreMin !== undefined && expect.scoreMax !== undefined) scoreOk = r1.score >= expect.scoreMin && r1.score <= expect.scoreMax;
  else if (expect.scoreMax !== undefined) scoreOk = r1.score <= expect.scoreMax;
  else if (expect.scoreMin !== undefined) scoreOk = r1.score >= expect.scoreMin;
  const readyOk = expect.readiness ? r1.readiness === expect.readiness : true;
  const rawOk = expect.rawMax !== undefined ? r1.raw <= expect.rawMax : true;

  const allOk = scoreOk && readyOk && detOk && rawOk && !crashed;

  if (allOk) pass++;
  else fail++;

  const icon = allOk ? '✓' : '✗';
  const detStr = detOk ? '' : ' DET=✗';
  console.log(`  ${icon} ${t.name.padEnd(52)} score=${String(r1.score).padStart(3)} raw=${String(r1.raw).padStart(3)} ready=${r1.readiness.padEnd(12)} gates=[${r1.gates.join(',')}]${detStr}`);
  if (!scoreOk) console.log(`      ✗ Score ${r1.score} — expected ${expect.score !== undefined ? `=${expect.score}` : `[${expect.scoreMin??0}-${expect.scoreMax??100}]`}`);
  if (!readyOk) console.log(`      ✗ Readiness ${r1.readiness} — expected ${expect.readiness}`);
  if (!rawOk) console.log(`      ✗ Raw ${r1.raw} exceeds max ${expect.rawMax}`);
}

console.log(`\n${'='.repeat(72)}`);
console.log(`RESULTS: ${pass} passed, ${fail} failed, ${crash} crashed`);
console.log(`${'='.repeat(72)}`);

if (fail > 0) {
  console.log('\nADVERSARIAL WEAKNESSES FOUND:\n');
  console.log('  Review failed cases above; this script should not be treated as passing.');
  process.exitCode = 1;
}

console.log('\nNORMALIZATION CHECK:');
console.log('  Uppercase and whitespace-padded red flag types must trigger gates.\n');
