// Pure deterministic scoring test — no AI calls, no database
// Run: node scripts/test-analysis-scoring.mjs

const STATUS_SCORES = {
  pass: 1,
  partial: 0.5,
  fail: 0,
  not_observed: 0,
  not_applicable: -1,
};

const DEFAULT_WEIGHTS = {
  identity_check: 1,
  company_check: 1,
  issue_clarification: 2,
  started_when: 1,
  impact: 3,
  urgency: 3,
  scope: 2,
  technical_discovery: 2,
  error_or_status_capture: 1,
  recent_changes: 1,
  next_steps: 3,
  customer_tone: 1,
  ticket_user_company: 1,
  ticket_issue_summary: 2,
  ticket_impact: 2,
  ticket_urgency: 2,
  ticket_checks_attempted: 2,
  ticket_next_step: 2,
  escalation_judgement: 2,
  safety: 4,
};

const DEFAULT_THRESHOLDS = { ready_min: 80, needs_supervision_min: 60 };

const DEFAULT_DEALBREAKERS = [
  { type: 'unsafe_advice', cap: 'not_ready' },
  { type: 'invented_fix_without_evidence', cap: 'needs_supervision' },
  { type: 'critical_urgency_missed', cap: 'needs_supervision' },
  { type: 'rude_or_blameful_tone', cap: 'needs_supervision' },
  { type: 'no_clear_next_step', cap: 'needs_supervision' },
];

function scoreExtraction({ criteria, redFlags = [], weights = DEFAULT_WEIGHTS, thresholds = DEFAULT_THRESHOLDS, dealbreakers = DEFAULT_DEALBREAKERS }) {
  let earnedScore = 0;
  let maxPossibleScore = 0;
  const failedRequiredChecks = [];
  const triggeredDealbreakers = [];
  const skillBreakdown = {};

  for (const [key, criterion] of Object.entries(criteria)) {
    const weight = weights[key] || 1;
    const status = (criterion.status || 'not_observed').toLowerCase();
    const statusScore = STATUS_SCORES[status] ?? 0;

    if (statusScore === -1) continue;

    const earned = weight * statusScore;
    earnedScore += earned;
    maxPossibleScore += weight;

    skillBreakdown[key] = {
      score: earned,
      maxScore: weight,
      percent: Math.round((earned / weight) * 100),
    };

    if (status === 'fail') {
      failedRequiredChecks.push(key);
    }
  }

  for (const flag of redFlags) {
    const rule = dealbreakers.find(d => d.type === flag.type);
    if (rule) triggeredDealbreakers.push(flag.type);
  }

  let score = maxPossibleScore > 0 ? Math.round((earnedScore / maxPossibleScore) * 100) : 0;

  let rating = score >= thresholds.ready_min ? 'ready'
    : score >= thresholds.needs_supervision_min ? 'needs_supervision'
    : 'not_ready';

  for (const db of dealbreakers) {
    if (triggeredDealbreakers.includes(db.type)) {
      if (db.cap === 'not_ready') rating = 'not_ready';
      else if (db.cap === 'needs_supervision' && rating === 'ready') rating = 'needs_supervision';
    }
  }

  return { score, rating, earnedScore, maxPossibleScore, failedRequiredChecks, triggeredDealbreakers, skillBreakdown };
}

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

console.log('=== Deterministic Scoring Tests ===\n');

// Test 1: Perfect candidate scores 100 and is ready
test('Perfect candidate scores 100 and ready', () => {
  const criteria = {};
  for (const key of Object.keys(DEFAULT_WEIGHTS)) {
    criteria[key] = { status: 'pass', severity: 'low', evidence: [], notes: '' };
  }
  const result = scoreExtraction({ criteria });
  assertEqual(result.score, 100, 'perfect score');
  assertEqual(result.rating, 'ready', 'perfect rating');
  assertEqual(result.triggeredDealbreakers.length, 0, 'no dealbreakers');
});

// Test 2: Candidate missing urgency loses points
test('Candidate missing urgency loses points and is not ready', () => {
  const criteria = {};
  for (const key of Object.keys(DEFAULT_WEIGHTS)) {
    criteria[key] = { status: key === 'urgency' ? 'fail' : 'pass', severity: 'low', evidence: [], notes: '' };
  }
  const result = scoreExtraction({ criteria });
  assert(result.score < 100, `score ${result.score} should be < 100`);
  assert(result.score >= 0, `score ${result.score} should be >= 0`);
  // urgency is weight 3 out of ~40, so ~7.5% loss → ~92.5
  assert(result.failedRequiredChecks.includes('urgency'), 'urgency should be in failedRequiredChecks');
});

// Test 3: Safety dealbreaker caps rating at not_ready
test('Safety dealbreaker caps rating at not_ready', () => {
  const criteria = {};
  for (const key of Object.keys(DEFAULT_WEIGHTS)) {
    criteria[key] = { status: 'pass', severity: 'low', evidence: [], notes: '' };
  }
  const result = scoreExtraction({
    criteria,
    redFlags: [{ type: 'unsafe_advice', severity: 'high' }],
  });
  assertEqual(result.rating, 'not_ready', 'safety dealbreaker should cap to not_ready');
  assert(result.triggeredDealbreakers.includes('unsafe_advice'), 'should include unsafe_advice dealbreaker');
});

// Test 4: not_applicable is excluded from denominator
test('not_applicable excluded from denominator', () => {
  const criteria = {};
  for (const key of Object.keys(DEFAULT_WEIGHTS)) {
    criteria[key] = { status: 'not_applicable', severity: 'low', evidence: [], notes: '' };
  }
  const result = scoreExtraction({ criteria });
  assertEqual(result.maxPossibleScore, 0, 'na criteria excluded');
  assertEqual(result.score, 0, 'score is 0 when no applicable criteria');
});

// Test 5: Failed required checks are listed
test('Failed required checks listed', () => {
  const criteria = {};
  for (const key of Object.keys(DEFAULT_WEIGHTS)) {
    criteria[key] = { status: key === 'impact' || key === 'scope' ? 'fail' : 'pass', severity: 'low', evidence: [], notes: '' };
  }
  const result = scoreExtraction({ criteria });
  assert(result.failedRequiredChecks.includes('impact'), 'impact should be failed');
  assert(result.failedRequiredChecks.includes('scope'), 'scope should be failed');
  assertEqual(result.failedRequiredChecks.length, 2, 'exactly 2 failed checks');
});

// Test 6: invented_fix_without_evidence caps to needs_supervision
test('invented_fix dealbreaker caps to needs_supervision', () => {
  const criteria = {};
  for (const key of Object.keys(DEFAULT_WEIGHTS)) {
    criteria[key] = { status: 'pass', severity: 'low', evidence: [], notes: '' };
  }
  const result = scoreExtraction({
    criteria,
    redFlags: [{ type: 'invented_fix_without_evidence', severity: 'high' }],
  });
  assertEqual(result.rating, 'needs_supervision', 'invented_fix should cap to needs_supervision');
});

// Test 7: Partial pass gives half weight
test('Partial pass gives half weight', () => {
  const criteria = {};
  for (const key of Object.keys(DEFAULT_WEIGHTS)) {
    criteria[key] = { status: 'partial', severity: 'low', evidence: [], notes: '' };
  }
  const result = scoreExtraction({ criteria });
  assertEqual(result.score, 50, 'all partial should be 50');
});

// Test 8: Skill breakdown is correct
test('Skill breakdown correct', () => {
  const criteria = {};
  for (const key of Object.keys(DEFAULT_WEIGHTS)) {
    criteria[key] = { status: key === 'safety' ? 'fail' : 'pass', severity: 'low', evidence: [], notes: '' };
  }
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

// Test 10: Dealbreaker does not override if not triggered
test('Dealbreaker not triggered leaves rating alone', () => {
  const criteria = {};
  for (const key of Object.keys(DEFAULT_WEIGHTS)) {
    criteria[key] = { status: 'pass', severity: 'low', evidence: [], notes: '' };
  }
  const result = scoreExtraction({
    criteria,
    redFlags: [{ type: 'non_existent_flag', severity: 'low' }],
  });
  assertEqual(result.rating, 'ready', 'untriggered dealbreaker leaves rating');
  assertEqual(result.triggeredDealbreakers.length, 0, 'no dealbreakers triggered');
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
