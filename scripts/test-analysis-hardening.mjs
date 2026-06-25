#!/usr/bin/env node
// Analysis Hardening Test Script — Checkpoint D
// Tests fail gates, score caps, readiness overrides without AI calls.
// Run: node scripts/test-analysis-hardening.mjs

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

function scoreOne(criteria, redFlags) {
  const result = scoreExtraction({ criteria: criteria || {}, redFlags: redFlags || [] });
  return {
    score: result.score,
    rawScoreBeforeCaps: result.rawScoreBeforeCaps,
    rating: result.rating,
    gateHits: result.gateHits,
    failedRequiredChecks: result.failedRequiredChecks,
  };
}

// Fixtures
const FIXTURES = [
  {
    name: 'severe_abuse',
    desc: 'Candidate tells customer to fuck off',
    criteria: (() => {
      const c = {}; for (const k of Object.keys(DEFAULT_WEIGHTS)) c[k] = { status: 'fail', severity: 'high', evidence: [], notes: '' };
      c.identity_check = { status: 'pass', severity: 'low', evidence: ['Name?'], notes: '' };
      c.company_check = { status: 'pass', severity: 'low', evidence: ['Company?'], notes: '' };
      c.issue_clarification = { status: 'pass', severity: 'low', evidence: ['Issue?'], notes: '' };
      c.impact = { status: 'pass', severity: 'medium', evidence: ['Blocked?'], notes: '' };
      c.urgency = { status: 'pass', severity: 'medium', evidence: ['Deadline?'], notes: '' };
      c.scope = { status: 'pass', severity: 'low', evidence: ['Just you?'], notes: '' };
      c.customer_tone = { status: 'fail', severity: 'critical', evidence: [], notes: 'Swore at customer' };
      c.professional_conduct = { status: 'fail', severity: 'critical', evidence: ['fuck off'], notes: '' };
      c.safety = { status: 'pass', severity: 'low', evidence: [], notes: '' };
      return c;
    })(),
    redFlags: [{ type: 'severe_customer_abuse', severity: 'critical', evidence: 'Candidate told customer to fuck off' }],
    expectScoreMax: 10, expectScoreMin: 0, expectReadiness: 'not_ready',
  },
  {
    name: 'unsafe_security',
    desc: 'Candidate asks customer for password',
    criteria: (() => {
      const c = {}; for (const k of Object.keys(DEFAULT_WEIGHTS)) c[k] = { status: 'pass', severity: 'low', evidence: [], notes: '' };
      c.safety = { status: 'fail', severity: 'critical', evidence: ['Give me your password'], notes: '' };
      c.escalation_judgement = { status: 'fail', severity: 'high', evidence: [], notes: '' };
      c.ticket_checks_attempted = { status: 'partial', severity: 'low', evidence: [], notes: '' };
      return c;
    })(),
    redFlags: [{ type: 'unsafe_security_behaviour', severity: 'critical', evidence: 'Candidate asked for password' }],
    expectScoreMax: 25, expectScoreMin: 0, expectReadiness: 'not_ready',
  },
  {
    name: 'no_troubleshooting',
    desc: 'No meaningful troubleshooting',
    criteria: (() => {
      const c = {}; for (const k of Object.keys(DEFAULT_WEIGHTS)) c[k] = { status: 'fail', severity: 'high', evidence: [], notes: '' };
      c.customer_tone = { status: 'pass', severity: 'low', evidence: ['Hello'], notes: '' };
      c.professional_conduct = { status: 'pass', severity: 'low', evidence: [], notes: '' };
      c.customer_communication = { status: 'partial', severity: 'medium', evidence: [], notes: '' };
      c.safety = { status: 'pass', severity: 'low', evidence: [], notes: '' };
      return c;
    })(),
    redFlags: [{ type: 'no_troubleshooting', severity: 'high', evidence: 'No meaningful troubleshooting' }],
    expectScoreMax: 40, expectScoreMin: 0, expectReadiness: 'not_ready',
  },
  {
    name: 'good_imperfect',
    desc: 'Good but missed urgency',
    criteria: (() => {
      const c = {}; for (const k of Object.keys(DEFAULT_WEIGHTS)) c[k] = { status: 'pass', severity: 'low', evidence: ['Did it'], notes: '' };
      c.urgency = { status: 'fail', severity: 'high', evidence: [], notes: '' };
      c.recent_changes = { status: 'fail', severity: 'medium', evidence: [], notes: '' };
      c.ticket_urgency = { status: 'fail', severity: 'high', evidence: [], notes: '' };
      return c;
    })(),
    redFlags: [],
    expectScoreMin: 65, expectScoreMax: 90, expectReadiness: 'needs_supervision',
  },
  {
    name: 'perfect_call',
    desc: 'All checks pass',
    criteria: (() => {
      const c = {}; for (const k of Object.keys(DEFAULT_WEIGHTS)) c[k] = { status: 'pass', severity: 'low', evidence: ['Done'], notes: '' };
      return c;
    })(),
    redFlags: [],
    expectScoreMin: 85, expectScoreMax: 100, expectReadiness: 'ready',
  },
  {
    name: 'hallucinated_fix',
    desc: 'Candidate claims fix without evidence',
    criteria: (() => {
      const c = {}; for (const k of Object.keys(DEFAULT_WEIGHTS)) c[k] = { status: 'fail', severity: 'high', evidence: [], notes: '' };
      c.identity_check = { status: 'pass', severity: 'low', evidence: ['Name?'], notes: '' };
      c.company_check = { status: 'pass', severity: 'low', evidence: ['Company?'], notes: '' };
      c.issue_clarification = { status: 'partial', severity: 'medium', evidence: ['Issue'], notes: '' };
      c.impact = { status: 'pass', severity: 'medium', evidence: ['Blocked?'], notes: '' };
      c.next_steps = { status: 'pass', severity: 'low', evidence: ['I fixed it'], notes: '' };
      c.customer_tone = { status: 'pass', severity: 'low', evidence: [], notes: '' };
      c.professional_conduct = { status: 'pass', severity: 'low', evidence: [], notes: '' };
      c.customer_communication = { status: 'pass', severity: 'low', evidence: [], notes: '' };
      c.safety = { status: 'partial', severity: 'medium', evidence: [], notes: '' };
      c.ticket_user_company = { status: 'pass', severity: 'low', evidence: [], notes: '' };
      c.ticket_issue_summary = { status: 'pass', severity: 'low', evidence: [], notes: '' };
      c.ticket_next_step = { status: 'pass', severity: 'low', evidence: ['Resolved'], notes: '' };
      return c;
    })(),
    redFlags: [{ type: 'hallucinated_fix', severity: 'high', evidence: 'Claimed fix without evidence' }],
    expectScoreMax: 50, expectScoreMin: 0, expectReadiness: 'not_ready',
  },
];

// ====== Run Tests ======
let passed = 0, failed = 0;

function assert(cond, msg) { if (!cond) throw new Error(msg); }

console.log('=== Analysis Hardening Tests (Checkpoint D) ===\n');
console.log(`Rubric version: callcallum-base-v0.4-analysis-hardening`);
console.log(`Fail gates: ${FAIL_GATES.length} defined\n`);

for (const fx of FIXTURES) {
  console.log(`Fixture: ${fx.name}`);
  console.log(`  ${fx.desc}`);
  try {
    const result = scoreOne(fx.criteria, fx.redFlags);
    const scoreOk = result.score >= fx.expectScoreMin && result.score <= fx.expectScoreMax;
    const readinessOk = result.rating === fx.expectReadiness;
    const passedCheck = scoreOk && readinessOk;

    console.log(`  Score: ${result.score} (raw: ${result.rawScoreBeforeCaps}) [expected ${fx.expectScoreMin}-${fx.expectScoreMax}] ${scoreOk ? '✓' : '✗'}`);
    console.log(`  Readiness: ${result.rating} [expected ${fx.expectReadiness}] ${readinessOk ? '✓' : '✗'}`);
    console.log(`  Gate hits: ${result.gateHits.length} ${result.gateHits.map(g => `[${g.id}=${g.severity} cap=${g.scoreCap}]`).join(', ')}`);
    if (result.gateHits.length > 0) {
      for (const g of result.gateHits) {
        console.log(`    ${g.id}: ${g.label} (cap: ${g.scoreCap}, severity: ${g.severity})`);
      }
    }

    if (!scoreOk) throw new Error(`Score ${result.score} outside expected range [${fx.expectScoreMin}-${fx.expectScoreMax}]`);
    if (!readinessOk) throw new Error(`Readiness ${result.rating} != ${fx.expectReadiness}`);

    console.log(`  RESULT: PASS\n`);
    passed++;
  } catch (e) {
    console.log(`  RESULT: FAIL — ${e.message}\n`);
    failed++;
  }
}

// Deterministic reproducibility test
console.log('--- Deterministic Reproducibility ---');
try {
  const fx = FIXTURES[0];
  const r1 = scoreOne(fx.criteria, fx.redFlags);
  const r2 = scoreOne(fx.criteria, fx.redFlags);
  if (r1.score !== r2.score) throw new Error(`Score changed between runs: ${r1.score} vs ${r2.score}`);
  if (r1.rating !== r2.rating) throw new Error(`Rating changed between runs: ${r1.rating} vs ${r2.rating}`);
  if (r1.gateHits.length !== r2.gateHits.length) throw new Error(`Gate count changed`);
  console.log(`  Same fixture produces same score: ${r1.score} (PASS)`);
  passed++;
} catch (e) {
  console.log(`  FAIL: ${e.message}`);
  failed++;
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
