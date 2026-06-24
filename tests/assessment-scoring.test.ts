import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateCheckpointScore, combineCallAndTicketScore, getReadinessLabel, scoreTicket } from '../lib/assessment-scoring';

test('passes impact, scope and device checkpoints when evidence is present', () => {
  const required = { capture_device_or_hostname:true, ask_business_impact:true, ask_scope_one_or_many:true };
  assert.deepEqual(calculateCheckpointScore(required, {
    capture_device_or_hostname:{passed:true,evidence:'Asked for hostname'},
    ask_business_impact:{passed:true,evidence:'Asked what work was blocked'},
    ask_scope_one_or_many:{passed:true,evidence:'Asked whether others were affected'},
  }), { score:100, missed:[], criticalMisses:[] });
});

test('records missing impact as a critical miss', () => {
  const result = calculateCheckpointScore({ ask_business_impact:true, ask_scope_one_or_many:true }, { ask_business_impact:false, ask_scope_one_or_many:true });
  assert.equal(result.score, 50); assert.deepEqual(result.criticalMisses, ['ask_business_impact']);
});

test('scores a complete MSP ticket highly', () => {
  const result = scoreTicket('User at client company cannot send email on laptop LT-204. Single user blocked before a client meeting. Checked Outlook web and confirmed it works. Priority P2. Next step: investigate desktop profile and follow up.', 'Caller confirmed LT-204 and Outlook web works.');
  assert.ok(result.score >= 80); assert.equal(result.checks.impact, true); assert.equal(result.checks.next_action, true);
});

test('penalises tickets that omit impact and next action', () => {
  const result = scoreTicket('User has an email issue on their laptop. Error shown when sending.');
  assert.equal(result.checks.impact, false); assert.equal(result.checks.next_action, false); assert.ok(result.score < 60);
});

test('flags an invented fix that is unsupported by the transcript', () => {
  const result = scoreTicket('User laptop issue. Root cause is a corrupt Windows profile. Issue resolved by rebuilding it. Next step is monitor.', 'Caller said the laptop is slow. Candidate asked when it started.');
  assert.equal(result.checks.no_invention, false);
});

test('maps readiness labels by mode, score and critical misses', () => {
  assert.equal(getReadinessLabel(90, 'hiring', []), 'strong_hire');
  assert.equal(getReadinessLabel(78, 'hiring', []), 'possible_hire');
  assert.equal(getReadinessLabel(60, 'onboarding', []), 'triage_only');
  assert.equal(getReadinessLabel(92, 'hiring', ['no_invented_fix']), 'not_recommended');
});

test('weights call quality at 75% and ticket quality at 25%', () => {
  assert.equal(combineCallAndTicketScore(80, 60), 75);
});
