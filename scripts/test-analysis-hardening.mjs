#!/usr/bin/env node
// Analysis Hardening Test Script — Checkpoint D
// Tests fail gates, score caps, readiness overrides without AI calls.
// Run: node scripts/test-analysis-hardening.mjs

// Inline scoring engine (matches lib/mvp/analysis/scoring.ts logic)
const STATUS_SCORES = { pass: 1, partial: 0.5, fail: 0, not_observed: 0, not_applicable: -1 };

const DEFAULT_WEIGHTS = {
  professional_conduct: 4, customer_communication: 3,
  identity_check: 1, company_check: 1, issue_clarification: 2, started_when: 1,
  impact: 3, urgency: 3, scope: 2, technical_discovery: 2,
  error_or_status_capture: 1, recent_changes: 1, next_steps: 3, customer_tone: 2,
  ticket_user_company: 1, ticket_issue_summary: 2, ticket_impact: 2, ticket_urgency: 2,
  ticket_checks_attempted: 2, ticket_next_step: 2, escalation_judgement: 2, safety: 4,
};

const THRESHOLDS = { ready_min: 80, needs_supervision_min: 60 };

const FAIL_GATES = [
  { id: 'severe_customer_abuse', label: 'Severe customer conduct failure', severity: 'critical', scoreCap: 10, overrideReadiness: 'not_ready', redFlagType: 'severe_customer_abuse' },
  { id: 'unsafe_security_behaviour', label: 'Unsafe security behaviour', severity: 'critical', scoreCap: 25, overrideReadiness: 'not_ready', redFlagType: 'unsafe_security_behaviour' },
  { id: 'refusal_to_help', label: 'Refusal to help or abandonment', severity: 'critical', scoreCap: 20, overrideReadiness: 'not_ready', redFlagType: 'refusal_to_help' },
  { id: 'hallucinated_fix', label: 'Invented fix without evidence', severity: 'major', scoreCap: 50, overrideReadiness: 'needs_supervision', redFlagType: 'hallucinated_fix' },
  { id: 'no_troubleshooting', label: 'No meaningful troubleshooting', severity: 'major', scoreCap: 40, overrideReadiness: 'not_ready', redFlagType: 'no_troubleshooting' },
  { id: 'invented_fix_without_evidence', label: 'Invented fix without evidence', severity: 'major', scoreCap: 50, overrideReadiness: 'needs_supervision', redFlagType: 'invented_fix_without_evidence' },
  { id: 'critical_urgency_missed', label: 'Critical urgency not captured', severity: 'major', scoreCap: 70, overrideReadiness: 'needs_supervision', redFlagType: 'critical_urgency_missed' },
];

function detectFailGates(redFlags) {
  const hits = [];
  const seen = new Set();
  for (const flag of redFlags) {
    const gate = FAIL_GATES.find(g => g.redFlagType === flag.type);
    if (!gate || seen.has(gate.id)) continue;
    seen.add(gate.id);
    hits.push({
      id: gate.id, label: gate.label, severity: gate.severity, scoreCap: gate.scoreCap,
      evidence: flag.evidence ? [{ source: 'analysis', quote: flag.evidence }] : [{ source: 'analysis', note: `Red flag: ${flag.type}` }],
      rationale: flag.evidence ? `${gate.label}: ${flag.evidence}` : gate.label,
    });
  }
  return hits;
}

function computeFinalScore(rawScore, gateHits) {
  if (gateHits.length === 0) {
    let r = rawScore >= THRESHOLDS.ready_min ? 'ready' : rawScore >= THRESHOLDS.needs_supervision_min ? 'needs_supervision' : 'not_ready';
    return { score: rawScore, readiness: r };
  }
  const criticalGates = gateHits.filter(g => g.severity === 'critical');
  const majorGates = gateHits.filter(g => g.severity === 'major');
  const strictestCap = Math.min(...gateHits.map(g => g.scoreCap));
  const finalScore = Math.min(rawScore, strictestCap);
  let readiness;
  if (criticalGates.length > 0) {
    readiness = 'not_ready';
  } else if (majorGates.length > 0) {
    const strictestMajor = majorGates.reduce((a, b) => a.scoreCap < b.scoreCap ? a : b);
    readiness = strictestMajor.overrideReadiness || 'needs_supervision';
    if (readiness === 'needs_supervision' && finalScore < THRESHOLDS.needs_supervision_min) readiness = 'not_ready';
  } else {
    readiness = finalScore >= THRESHOLDS.ready_min ? 'ready' : finalScore >= THRESHOLDS.needs_supervision_min ? 'needs_supervision' : 'not_ready';
  }
  return { score: finalScore, readiness };
}

function scoreExtraction({ criteria, redFlags = [] }) {
  let earnedScore = 0, maxPossibleScore = 0;
  const failedRequiredChecks = [], skillBreakdown = {};
  for (const [key, criterion] of Object.entries(criteria)) {
    const weight = DEFAULT_WEIGHTS[key] || 1;
    const status = (criterion.status || 'not_observed').toLowerCase();
    const ss = STATUS_SCORES[status] ?? 0;
    if (ss === -1) continue;
    earnedScore += weight * ss;
    maxPossibleScore += weight;
    skillBreakdown[key] = { score: weight * ss, maxScore: weight, percent: Math.round((weight * ss / weight) * 100) };
    if (status === 'fail') failedRequiredChecks.push(key);
  }
  const rawScore = maxPossibleScore > 0 ? Math.round((earnedScore / maxPossibleScore) * 100) : 0;
  const gateHits = detectFailGates(redFlags);
  const { score: finalScore, readiness } = computeFinalScore(rawScore, gateHits);
  return { score: finalScore, rawScoreBeforeCaps: rawScore, rating: readiness, gateHits, failedRequiredChecks };
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
    expectScoreMin: 65, expectScoreMax: 90, expectReadiness: 'ready',
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
    const result = scoreExtraction({ criteria: fx.criteria, redFlags: fx.redFlags });
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
  const r1 = scoreExtraction({ criteria: fx.criteria, redFlags: fx.redFlags });
  const r2 = scoreExtraction({ criteria: fx.criteria, redFlags: fx.redFlags });
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
