#!/usr/bin/env node
// Pure deterministic scoring test — no AI calls, no database
// Run: node scripts/test-analysis-scoring.mjs

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let scoring;
try {
  scoring = require('../.test-dist/lib/mvp/analysis/scoring.js');
} catch {
  console.error('ERROR: Production scorer not compiled. Run: npx tsc lib/mvp/analysis/scoring.ts --outDir .test-dist --module commonjs --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck');
  process.exit(1);
}
const { scoreExtraction, DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS } = scoring;

const ALL_KEYS = Object.keys(DEFAULT_WEIGHTS);

// ========== Tests ==========
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (e) {
    console.log(`  FAIL: ${name}`);
    console.log(`        ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function allPass() {
  const c = {};
  for (const k of ALL_KEYS) c[k] = { status: 'pass', severity: 'low', evidence: [], notes: '' };
  return c;
}

function allStatus(status) {
  const c = {};
  for (const k of ALL_KEYS) c[k] = { status, severity: 'low', evidence: [], notes: '' };
  return c;
}

console.log('=== Deterministic Scoring Tests ===\n');

// Test 1: Perfect candidate scores 100 and is ready
test('Perfect candidate scores 100 and ready', () => {
  const criteria = allPass();
  const result = scoreExtraction({ criteria });
  assertEqual(result.score, 100, 'perfect score');
  assertEqual(result.rating, 'ready', 'perfect rating');
  assertEqual(result.gateHits.length, 0, 'no gates');
});

// Test 2: Candidate missing urgency loses points
test('Candidate missing urgency loses points and is not ready', () => {
  const criteria = allPass();
  criteria.urgency = { status: 'fail', severity: 'low', evidence: [], notes: '' };
  const result = scoreExtraction({ criteria });
  assert(result.score < 100, `score ${result.score} should be < 100`);
  assert(result.score >= 0, `score ${result.score} should be >= 0`);
  assert(result.failedRequiredChecks.includes('urgency'), 'urgency should be in failedRequiredChecks');
});

// Test 3: Safety red flag caps rating at not_ready
test('Safety red flag caps rating at not_ready', () => {
  const criteria = allPass();
  const result = scoreExtraction({
    criteria,
    redFlags: [{ type: 'unsafe_security_behaviour', severity: 'high' }],
  });
  assertEqual(result.rating, 'not_ready', 'security red flag should cap to not_ready');
  assert(result.gateHits.some(g => g.id === 'unsafe_security_behaviour'), 'should include unsafe_security_behaviour gate');
});

// Test 4: not_applicable is excluded from denominator
test('not_applicable excluded from denominator', () => {
  const criteria = allStatus('not_applicable');
  const result = scoreExtraction({ criteria });
  assertEqual(result.maxPossibleScore, 0, 'na criteria excluded');
  assertEqual(result.score, 0, 'score is 0 when no applicable criteria');
});

// Test 5: Failed required checks are listed
test('Failed required checks listed', () => {
  const criteria = allPass();
  criteria.impact = { status: 'fail', severity: 'low', evidence: [], notes: '' };
  criteria.scope = { status: 'fail', severity: 'low', evidence: [], notes: '' };
  const result = scoreExtraction({ criteria });
  assert(result.failedRequiredChecks.includes('impact'), 'impact should be failed');
  assert(result.failedRequiredChecks.includes('scope'), 'scope should be failed');
  assertEqual(result.failedRequiredChecks.length, 2, 'exactly 2 failed checks');
});

// Test 6: hallucinated_fix caps to needs_supervision
test('hallucinated_fix caps to needs_supervision', () => {
  const criteria = allPass();
  const result = scoreExtraction({
    criteria,
    redFlags: [{ type: 'hallucinated_fix', severity: 'high' }],
  });
  assertEqual(result.rating, 'not_ready', 'hallucinated_fix cap 50 → score 50 < 60 → not_ready');
});

// Test 7: Partial pass gives half weight
test('Partial pass gives half weight', () => {
  const criteria = allStatus('partial');
  const result = scoreExtraction({ criteria });
  assertEqual(result.score, 50, 'all partial should be 50');
});

// Test 8: Skill breakdown is correct
test('Skill breakdown correct', () => {
  const criteria = allPass();
  criteria.safety = { status: 'fail', severity: 'low', evidence: [], notes: '' };
  const result = scoreExtraction({ criteria });
  assert(result.skillBreakdown.safety, 'safety in breakdown');
  assertEqual(result.skillBreakdown.safety.score, 0, 'safety earned 0');
  assertEqual(result.skillBreakdown.safety.maxScore, 4, 'safety max is 4');
  assertEqual(result.skillBreakdown.safety.percent, 0, 'safety percent is 0');
  assert(result.skillBreakdown.identity_check, 'identity_check in breakdown');
  assertEqual(result.skillBreakdown.identity_check.score, 1, 'identity_check earned 1');
  assertEqual(result.skillBreakdown.identity_check.percent, 100, 'identity_check percent 100');
});

// Test 9: Empty criteria returns score 0
test('Empty criteria returns score 0, rating not_ready', () => {
  const result = scoreExtraction({ criteria: {} });
  assertEqual(result.score, 0, 'empty criteria score 0');
  assertEqual(result.rating, 'not_ready', 'empty criteria not_ready');
});

// Test 10: Red flag not triggered leaves rating alone
test('Red flag not triggered leaves rating alone', () => {
  const criteria = allPass();
  const result = scoreExtraction({
    criteria,
    redFlags: [{ type: 'non_existent_flag', severity: 'low' }],
  });
  assertEqual(result.rating, 'ready', 'untriggered red flag leaves rating');
  assertEqual(result.gateHits.length, 0, 'no gates triggered');
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
