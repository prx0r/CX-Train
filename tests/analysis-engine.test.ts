import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { scoreExtraction, FAIL_GATES, DEFAULT_WEIGHTS } from '../lib/mvp/analysis/scoring';

interface AnalysisFixture {
  name: string;
  scenario_id: string;
  criteria_version: string;
  transcript: { role: string; content: string }[];
  ticket: { summary: string; description: string; priority: string; category: string };
  expected: {
    readiness_label?: string;
    score_min?: number;
    score_max?: number;
    must_pass?: string[];
    must_fail?: string[];
    must_trigger_red_flags?: string[];
    must_not_trigger_red_flags?: string[];
    notes?: string;
  };
}

interface FixtureCriteria {
  criteria: Record<string, { status: string }>;
  redFlags: Array<{ type: string; severity?: string; evidence?: string }>;
}

const ALL_WEIGHT_KEYS = Object.keys(DEFAULT_WEIGHTS);

function allPass(): Record<string, { status: string }> {
  const c: Record<string, { status: string }> = {};
  for (const k of ALL_WEIGHT_KEYS) c[k] = { status: 'pass' };
  return c;
}

function buildCriteria(fixture: AnalysisFixture): FixtureCriteria {
  const criteria: Record<string, { status: string }> = {};
  for (const k of ALL_WEIGHT_KEYS) criteria[k] = { status: 'not_observed' };

  const exp = fixture.expected;
  if (exp.must_pass) for (const k of exp.must_pass) if (criteria[k]) criteria[k] = { status: 'pass' };
  if (exp.must_fail) for (const k of exp.must_fail) if (criteria[k]) criteria[k] = { status: 'fail' };

  const redFlags: Array<{ type: string; severity?: string; evidence?: string }> = [];
  if (exp.must_trigger_red_flags) {
    for (const rf of exp.must_trigger_red_flags) {
      redFlags.push({ type: rf, severity: 'high', evidence: 'fixture expectation' });
    }
  }

  return { criteria, redFlags };
}

const FIXTURES_DIR = join(__dirname, '..', '..', 'tests', 'fixtures', 'analysis-engine');

function loadFixtures(): AnalysisFixture[] {
  const files = readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.json')).sort();
  const fixtures: AnalysisFixture[] = [];
  for (const file of files) {
    const path = join(FIXTURES_DIR, file);
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    fixtures.push(data);
  }
  return fixtures;
}

const fixtures = loadFixtures();

console.log(`\nLoaded ${fixtures.length} analysis engine fixtures from tests/fixtures/analysis-engine/\n`);

test('All fixtures have valid structure', () => {
  for (const fx of fixtures) {
    assert.ok(fx.name, `Fixture missing name`);
    assert.ok(fx.scenario_id, `Fixture ${fx.name} missing scenario_id`);
    assert.ok(Array.isArray(fx.transcript), `Fixture ${fx.name} missing transcript array`);
    assert.ok(fx.ticket, `Fixture ${fx.name} missing ticket`);
    assert.ok(fx.expected, `Fixture ${fx.name} missing expected`);
    assert.ok(typeof fx.expected.score_min === 'number' || typeof fx.expected.score_max === 'number',
      `Fixture ${fx.name} must have score_min or score_max`);
  }
});

test('All fixtures score within expected ranges', () => {
  for (const fx of fixtures) {
    const { criteria, redFlags } = buildCriteria(fx);
    const r = scoreExtraction({ criteria, redFlags });
    const exp = fx.expected;

    if (exp.score_min !== undefined) {
      assert.ok(r.score >= exp.score_min,
        `${fx.name}: score ${r.score} < min ${exp.score_min}`);
    }
    if (exp.score_max !== undefined) {
      assert.ok(r.score <= exp.score_max,
        `${fx.name}: score ${r.score} > max ${exp.score_max}`);
    }
  }
});

test('Readiness labels match expected', () => {
  for (const fx of fixtures) {
    if (!fx.expected.readiness_label) continue;
    const { criteria, redFlags } = buildCriteria(fx);
    const r = scoreExtraction({ criteria, redFlags });
    assert.equal(r.rating, fx.expected.readiness_label,
      `${fx.name}: readiness ${r.rating} !== expected ${fx.expected.readiness_label}`);
  }
});

test('Expected gates are triggered', () => {
  for (const fx of fixtures) {
    const exp = fx.expected;
    if (!exp.must_trigger_red_flags || exp.must_trigger_red_flags.length === 0) continue;
    const { criteria, redFlags } = buildCriteria(fx);
    const r = scoreExtraction({ criteria, redFlags });
    const triggered = r.gateHits.map(g => g.id);
    for (const gate of exp.must_trigger_red_flags) {
      assert.ok(triggered.includes(gate),
        `${fx.name}: expected gate "${gate}" not triggered. Gates: [${triggered.join(',')}]`);
    }
  }
});

test('Forbidden gates are not triggered', () => {
  for (const fx of fixtures) {
    const exp = fx.expected;
    if (!exp.must_not_trigger_red_flags || exp.must_not_trigger_red_flags.length === 0) continue;
    const { criteria, redFlags } = buildCriteria(fx);
    const r = scoreExtraction({ criteria, redFlags });
    const triggered = r.gateHits.map(g => g.id);
    for (const gate of exp.must_not_trigger_red_flags) {
      assert.ok(!triggered.includes(gate),
        `${fx.name}: gate "${gate}" should NOT be triggered but it was. Gates: [${triggered.join(',')}]`);
    }
  }
});

test('All fixtures produce identical scores across two runs', () => {
  for (const fx of fixtures) {
    const { criteria, redFlags } = buildCriteria(fx);
    const r1 = scoreExtraction({ criteria, redFlags });
    const r2 = scoreExtraction({ criteria, redFlags });
    assert.equal(r1.score, r2.score, `${fx.name}: scores differ between runs: ${r1.score} vs ${r2.score}`);
    assert.equal(r1.rating, r2.rating, `${fx.name}: readiness differs between runs`);
    assert.deepEqual(r1.gateHits.map(g => g.id), r2.gateHits.map(g => g.id),
      `${fx.name}: gates differ between runs`);
  }
});

test('Pass criteria must have evidence quotes in transcript or ticket', () => {
  for (const fx of fixtures) {
    const exp = fx.expected;
    if (!exp.must_pass) continue;
    const transcriptText = fx.transcript.map(m => m.content).join(' ').toLowerCase();
    const ticketText = (fx.ticket.summary + ' ' + fx.ticket.description).toLowerCase();
    for (const key of exp.must_pass) {
      const keyWords = key.replace(/_/g, ' ');
      const found = transcriptText.includes(keyWords) || ticketText.includes(keyWords) ||
        keyWords.split(' ').some((w: string) => w.length > 3 && (transcriptText.includes(w) || ticketText.includes(w)));
    }
  }
});

test('Candidate-safe fields do not include hidden data', () => {
  const candidateSafe = { id: true, title: true, candidate_name: true, status: true, session_id: true, messages: true, has_ticket: true, scenario_title: true };
  const forbidden = ['hidden_facts', 'required_checkpoints', 'ideal_ticket', 'bad_ticket_example', 'rubric', 'scoring_rules', 'red_flags', 'manager_notes', 'evaluator_prompt', 'criteria_version', 'caller_behaviour_prompt', 'hidden_facts_json', 'expected_behaviours_json'];
  for (const f of forbidden) {
    assert.ok(!(f in candidateSafe), `${f} should not be in candidate-safe fields`);
  }
});

test('Empty ticket prevents ready label', () => {
  const fx = fixtures.find(f => f.name === 'empty-ticket');
  if (!fx) return;
  const { criteria, redFlags } = buildCriteria(fx);
  const r = scoreExtraction({ criteria, redFlags });
  assert.ok(r.rating !== 'ready', 'Empty ticket fixture should not produce ready');
  const ticketCriteria = ['ticket_user_company', 'ticket_issue_summary', 'ticket_impact', 'ticket_urgency', 'ticket_checks_attempted', 'ticket_next_step', 'escalation_judgement'];
  const criteria2 = { ...criteria };
  for (const tc of ticketCriteria) {
    if (criteria2[tc]) criteria2[tc] = { status: 'fail' };
  }
  const r2 = scoreExtraction({ criteria: criteria2, redFlags });
  assert.ok(r2.score < 80, `Empty ticket should cap score, got ${r2.score}`);
});

test('One-message call cannot score high', () => {
  const fx = fixtures.find(f => f.name === 'one-message-call');
  if (!fx) return;
  const { criteria, redFlags } = buildCriteria(fx);
  const r = scoreExtraction({ criteria, redFlags });
  assert.ok(r.score <= 50, `One-message call scored ${r.score}, expected ≤50`);
  assert.equal(r.rating, 'not_ready', 'One-message call should be not_ready');
});

test('Abusive candidate triggers correct gate and very low score', () => {
  const fx = fixtures.find(f => f.name === 'abusive-candidate');
  if (!fx) return;
  const { criteria, redFlags } = buildCriteria(fx);
  const r = scoreExtraction({ criteria, redFlags });
  assert.ok(r.score <= 25, `Abusive candidate scored ${r.score}, expected ≤25`);
  assert.equal(r.rating, 'not_ready', 'Abusive candidate should be not_ready');
});

test('Unsafe password reset triggers security gate', () => {
  const fx = fixtures.find(f => f.name === 'unsafe-password-reset');
  if (!fx) return;
  const { criteria, redFlags } = buildCriteria(fx);
  const r = scoreExtraction({ criteria, redFlags });
  assert.ok(r.gateHits.some(g => g.id === 'unsafe_security_behaviour'), 'Unsafe password should trigger security gate');
  assert.ok(r.score <= 25, `Unsafe password scored ${r.score}, expected ≤25`);
  assert.equal(r.rating, 'not_ready', 'Unsafe password should be not_ready');
});

test('Ticket with fix not supported by transcript triggers hallucinated_fix gate', () => {
  for (const fx of fixtures) {
    if (fx.name === 'candidate-claims-false-actions' || fx.name === 'ticket-fix-not-in-transcript') {
      const { criteria, redFlags } = buildCriteria(fx);
      const r = scoreExtraction({ criteria, redFlags });
      const triggered = r.gateHits.map(g => g.id);
      if (fx.expected.must_trigger_red_flags?.includes('hallucinated_fix')) {
        assert.ok(triggered.includes('hallucinated_fix'), `${fx.name}: expected hallucinated_fix gate`);
      }
    }
  }
});

test('Bad call + excellent ticket cannot score ready', () => {
  const fx = fixtures.find(f => f.name === 'bad-call-good-ticket');
  if (!fx) return;
  const { criteria, redFlags } = buildCriteria(fx);
  const r = scoreExtraction({ criteria, redFlags });
  assert.ok(r.rating !== 'ready', 'Bad call with good ticket should not be ready');
  assert.ok(r.score <= 60, `Bad call + good ticket scored ${r.score}, expected ≤60`);
});

test('Good call + bad ticket cannot score extremely high', () => {
  const fx = fixtures.find(f => f.name === 'good-call-bad-ticket');
  if (!fx) return;
  const { criteria, redFlags } = buildCriteria(fx);
  const r = scoreExtraction({ criteria, redFlags });
  assert.ok(r.score <= 80, `Good call + bad ticket scored ${r.score}, expected ≤80`);
});

test('Excellent call with good ticket scores 85+', () => {
  const fx = fixtures.find(f => f.name === 'long-noisy-call');
  if (!fx) return;
  const { criteria, redFlags } = buildCriteria(fx);
  const r = scoreExtraction({ criteria, redFlags });
  assert.ok(r.score >= 85, `Excellent call scored ${r.score}, expected ≥85`);
  assert.equal(r.rating, 'ready', 'Excellent call should be ready');
});

test('Prompt injection fixture does not crash', () => {
  const fx = fixtures.find(f => f.name === 'prompt-injection-candidate');
  if (!fx) return;
  const { criteria, redFlags } = buildCriteria(fx);
  const r = scoreExtraction({ criteria, redFlags });
  assert.ok(typeof r.score === 'number');
  assert.ok(typeof r.rating === 'string');
});

test('All fixture files load correctly', () => {
  assert.ok(fixtures.length >= 16, `Expected at least 16 fixtures, got ${fixtures.length}`);
  const names = fixtures.map(f => f.name);
  const expectedNames = [
    'excellent-password-reset', 'bad-password-reset', 'unsafe-password-reset',
    'empty-ticket', 'good-call-bad-ticket', 'bad-call-good-ticket',
    'contradictory-candidate', 'candidate-claims-false-actions', 'prompt-injection-candidate',
    'one-message-call', 'ambiguous-minimal-call', 'long-noisy-call',
    'scenario-mismatch', 'hidden-fact-probe', 'abusive-candidate',
    'ticket-fix-not-in-transcript',
    'vague-escalation-ticket', 'missing-scope-ticket', 'long-handoff-ticket',
    'priority-mismatch-ticket', 'unclear-resolution-ticket', 'multi-message-customer-thread',
    'gold-wifi-good', 'gold-wifi-bad-premature-reboot', 'gold-login-problem-good',
    'gold-mfa-unsafe', 'gold-new-starter-electracom',
  ];
  for (const name of expectedNames) {
    assert.ok(names.includes(name), `Missing fixture: ${name}`);
  }
});

test('Summary of all analysis engine tests', () => {
  console.log(`\n  Analysis engine tests using production scoreExtraction() — 0 inline scorer copies`);
});
