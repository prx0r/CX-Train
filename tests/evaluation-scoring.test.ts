import assert from 'node:assert/strict';
import test from 'node:test';
import { validateEvaluationOutput } from '../lib/evaluation/evaluator';
import { calculateWeightedScore, scoreTicketWithPatterns } from '../lib/evaluation/scoring';
import { getRubric, SCENARIO_RUBRICS } from '../lib/evaluation/scenarios';
import type { EvaluationOutput, RubricItem } from '../lib/types';

const OUTLOOK_RUBRIC = SCENARIO_RUBRICS['Outlook not sending'];

test('validateEvaluationOutput accepts valid JSON', () => {
  const input = {
    call_summary: 'Candidate handled an Outlook issue.',
    checkpoint_evidence: [
      { checkpoint_key: 'confirm_user', status: 'observed', evidence_quote: 'Can I take your name?', turn_index: 1, reason: 'Asked identity', confidence: 0.95 },
      { checkpoint_key: 'ask_business_impact', status: 'missed', evidence_quote: null, turn_index: null, reason: 'Not asked', confidence: 0.9 },
    ],
    skill_labels: [{ label: 'professional_opening', confidence: 0.9, evidence_quote: 'Good morning, support desk' }],
    risk_labels: [{ label: 'missed_impact_check', severity: 'high', confidence: 0.88, evidence_quote: null }],
    scenario_labels: ['outlook', 'single_user_issue'],
    data_quality_labels: ['usable_for_training'],
    coaching_notes: ['Ask about business impact.'],
  };
  const { output, errors } = validateEvaluationOutput(input);
  assert.equal(errors.length, 0);
  assert.equal(output.callSummary, 'Candidate handled an Outlook issue.');
  assert.equal(output.checkpointEvidence.length, 2);
  assert.equal(output.checkpointEvidence[0].status, 'observed');
  assert.equal(output.checkpointEvidence[0].evidenceQuote, 'Can I take your name?');
  assert.equal(output.checkpointEvidence[0].turnIndex, 1);
  assert.equal(output.skillLabels.length, 1);
  assert.equal(output.riskLabels.length, 1);
  assert.equal(output.riskLabels[0].severity, 'high');
  assert.deepEqual(output.scenarioLabels, ['outlook', 'single_user_issue']);
});

test('validateEvaluationOutput rejects missing call_summary', () => {
  const { errors } = validateEvaluationOutput({ checkpoint_evidence: [] });
  assert.ok(errors.length > 0);
  assert.ok(errors[0].includes('call_summary'));
});

test('validateEvaluationOutput rejects invalid status', () => {
  const input = {
    call_summary: 'Test',
    checkpoint_evidence: [{ checkpoint_key: 'x', status: 'invalid_status', evidence_quote: null, turn_index: null, reason: '', confidence: 0 }],
  };
  const { errors } = validateEvaluationOutput(input);
  assert.ok(errors.length > 0);
});

test('validateEvaluationOutput handles empty arrays', () => {
  const input = {
    call_summary: 'Empty test',
    checkpoint_evidence: [],
    skill_labels: [],
    risk_labels: [],
    scenario_labels: [],
    data_quality_labels: [],
    coaching_notes: [],
  };
  const { output, errors } = validateEvaluationOutput(input);
  assert.equal(errors.length, 0);
  assert.equal(output.checkpointEvidence.length, 0);
});

test('weighted scoring: all checkpoints observed = perfect score', () => {
  const rubric = OUTLOOK_RUBRIC;
  const evaluation: EvaluationOutput = {
    callSummary: 'Good call',
    checkpointEvidence: rubric.map((r) => ({
      checkpointKey: r.key,
      status: 'observed' as const,
      evidenceQuote: `Asked about ${r.label}`,
      turnIndex: 1,
      reason: 'Done',
      confidence: 0.95,
    })),
    skillLabels: [{ label: 'summarised_issue', confidence: 0.9 }],
    riskLabels: [],
    scenarioLabels: ['outlook'],
    dataQualityLabels: ['usable_for_training'],
    coachingNotes: [],
  };
  const ticketResult = scoreTicketWithPatterns('User at client cannot send email on laptop LT-204. Single user blocked before client meeting. Checked Outlook web works. Priority P2. Next step: investigate profile.');
  const result = calculateWeightedScore(rubric, evaluation, ticketResult.score);
  assert.equal(result.callScore, 100);
  assert.equal(result.finalScore, Math.round(100 * 0.75 + ticketResult.score * 0.25));
  assert.equal(result.readinessLabel, 'ready_low_risk_calls');
});

test('weighted scoring: missing half the checkpoints reduces score proportionally', () => {
  const rubric = OUTLOOK_RUBRIC;
  const observedKeys = new Set(['confirm_user', 'confirm_company', 'ask_when_started', 'ask_error_message', 'set_next_steps']);
  const evaluation: EvaluationOutput = {
    callSummary: 'Partial call',
    checkpointEvidence: rubric.map((r) => ({
      checkpointKey: r.key,
      status: observedKeys.has(r.key) ? 'observed' as const : 'missed' as const,
      evidenceQuote: observedKeys.has(r.key) ? 'Asked' : null,
      turnIndex: observedKeys.has(r.key) ? 2 : null,
      reason: observedKeys.has(r.key) ? 'Done' : 'Not asked',
      confidence: 0.9,
    })),
    skillLabels: [],
    riskLabels: [],
    scenarioLabels: ['outlook'],
    dataQualityLabels: [],
    coachingNotes: [],
  };
  const result = calculateWeightedScore(rubric, evaluation, 70);
  const totalWeight = rubric.reduce((s, r) => s + r.weight, 0);
  const passedWeight = observedKeys.size === rubric.length
    ? totalWeight
    : rubric.filter((r) => observedKeys.has(r.key)).reduce((s, r) => s + r.weight, 0);
  const expectedCallScore = Math.round((passedWeight / totalWeight) * 100);
  assert.equal(result.callScore, expectedCallScore);
});

test('weighted scoring: risk penalties reduce score', () => {
  const rubric = OUTLOOK_RUBRIC;
  const allObserved = rubric.map((r) => ({
    checkpointKey: r.key, status: 'observed' as const, evidenceQuote: 'x', turnIndex: 1, reason: 'x', confidence: 0.9,
  }));
  const evaluation: EvaluationOutput = {
    callSummary: 'Risky call',
    checkpointEvidence: allObserved,
    skillLabels: [],
    riskLabels: [
      { label: 'missed_impact_check', severity: 'high', confidence: 0.9 },
      { label: 'gave_wrong_advice', severity: 'high', confidence: 0.85 },
    ],
    scenarioLabels: ['outlook'],
    dataQualityLabels: [],
    coachingNotes: [],
  };
  const result = calculateWeightedScore(rubric, evaluation, 50);
  assert.equal(result.callScore, Math.max(0, 100 - 10 - 25)); // missed_impact=10, wrong_advice=25
});

test('weighted scoring: skill bonuses increase score', () => {
  const rubric = OUTLOOK_RUBRIC;
  const allObserved = rubric.map((r) => ({
    checkpointKey: r.key, status: 'observed' as const, evidenceQuote: 'x', turnIndex: 1, reason: 'x', confidence: 0.9,
  }));
  const evaluation: EvaluationOutput = {
    callSummary: 'Skilled call',
    checkpointEvidence: allObserved,
    skillLabels: [
      { label: 'professional_opening', confidence: 0.95, evidenceQuote: 'Good morning' },
      { label: 'summarised_issue', confidence: 0.9, evidenceQuote: 'So to summarise' },
    ],
    riskLabels: [],
    scenarioLabels: ['outlook'],
    dataQualityLabels: [],
    coachingNotes: [],
  };
  const result = calculateWeightedScore(rubric, evaluation, 80);
  assert.equal(result.callScore, Math.min(100, 100 + 3 + 3)); // pro_open=3, summarise=3
});

test('weighted scoring: unsafe risk produces not_ready', () => {
  const rubric = OUTLOOK_RUBRIC;
  const allObserved = rubric.map((r) => ({
    checkpointKey: r.key, status: 'observed' as const, evidenceQuote: 'x', turnIndex: 1, reason: 'x', confidence: 0.9,
  }));
  const evaluation: EvaluationOutput = {
    callSummary: 'Unsafe call',
    checkpointEvidence: allObserved,
    skillLabels: [],
    riskLabels: [{ label: 'gave_wrong_advice', severity: 'high', confidence: 0.99 }],
    scenarioLabels: ['outlook'],
    dataQualityLabels: [],
    coachingNotes: [],
  };
  const result = calculateWeightedScore(rubric, evaluation, 90);
  assert.equal(result.readinessLabel, 'not_ready');
});

test('weighted scoring: low score produces not_ready', () => {
  const rubric = [{ key: 'test', label: 'Test', weight: 100 }];
  const evaluation: EvaluationOutput = {
    callSummary: 'Bad call',
    checkpointEvidence: [{ checkpointKey: 'test', status: 'missed', evidenceQuote: null, turnIndex: null, reason: 'N/A', confidence: 0.9 }],
    skillLabels: [],
    riskLabels: [],
    scenarioLabels: [],
    dataQualityLabels: [],
    coachingNotes: [],
  };
  const result = calculateWeightedScore(rubric, evaluation, 20);
  assert.equal(result.finalScore, Math.round(0 * 0.75 + 20 * 0.25));
  assert.equal(result.readinessLabel, 'not_ready');
});

test('partially_observed gets half weight', () => {
  const rubric = [{ key: 'ask_scope', label: 'Scope check', weight: 20 }];
  const evaluation: EvaluationOutput = {
    callSummary: 'Partial',
    checkpointEvidence: [{ checkpointKey: 'ask_scope', status: 'partially_observed', evidenceQuote: 'Anybody else?', turnIndex: 1, reason: 'Vague', confidence: 0.7 }],
    skillLabels: [], riskLabels: [], scenarioLabels: [], dataQualityLabels: [], coachingNotes: [],
  };
  const result = calculateWeightedScore(rubric, evaluation, 50);
  assert.equal(result.callScore, 50); // 10/20
});

test('scoreTicketWithPatterns scores good ticket highly', () => {
  const result = scoreTicketWithPatterns('User at client company cannot send email on laptop LT-204. Single user blocked before a client meeting. Checked Outlook web and confirmed it works. Priority P2. Next step: investigate desktop profile and follow up.');
  assert.ok(result.score >= 80);
  assert.equal(result.checks.impact, true);
  assert.equal(result.checks.next_action, true);
});

test('scoreTicketWithPatterns penalises weak ticket', () => {
  const result = scoreTicketWithPatterns('User has an email issue on their laptop.');
  assert.equal(result.checks.impact, false);
  assert.ok(result.score < 50);
});

test('scoreTicketWithPatterns flags invented fix', () => {
  const result = scoreTicketWithPatterns('Root cause is corrupt profile. Issue resolved by rebuilding it.', 'Caller said the laptop is slow.');
  assert.equal(result.checks.no_invention, false);
});

test('getRubric returns rubric from DB or falls back to static', () => {
  const dbRubric = [{ key: 'a', label: 'A', weight: 100 }];
  const result = getRubric('Outlook not sending', dbRubric);
  assert.equal(result.length, 1);
  assert.equal(result[0].key, 'a');

  const fallback = getRubric('Outlook not sending', []);
  assert.ok(fallback.length > 10);
  assert.equal(fallback[0].key, 'confirm_user');
});

test('getRubric returns empty for unknown scenario', () => {
  const result = getRubric('Unknown scenario', []);
  assert.equal(result.length, 0);
});
