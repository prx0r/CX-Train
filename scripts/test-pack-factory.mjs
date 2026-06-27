/**
 * Pack Factory v0 — Verification Test
 * Tests: pack loading, scoring system, category scores, mandatory checkpoints
 */
import { getOutlookWorkOfflinePack, OUTLOOK_WORK_OFFLINE_PACK_ID } from '../lib/mvp/sim/packConfig.ts';
import { scoreSimEvents } from '../lib/mvp/sim/scoring.ts';
import { mergeAssessmentConfig } from '../lib/mvp/sim/mergeConfig.ts';

const SIMULATED_OUTLOOK_PACK_ID = OUTLOOK_WORK_OFFLINE_PACK_ID;
let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function assertClose(label, actual, expected, tolerance, detail = '') {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (ok) {
    console.log(`  PASS: ${label} (${actual})`);
    passed++;
  } else {
    console.log(`  FAIL: ${label} — expected ${expected}±${tolerance}, got ${actual}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

console.log('\n=== Pack Factory v0 — Verification Tests ===\n');

// ── Test 1: Pack loads and has required fields ──
console.log('--- Test 1: Pack structure ---');
const pack = getOutlookWorkOfflinePack();
assert('Pack has id', !!pack.id, `id: ${pack.id}`);
assert('Pack has version', !!pack.version);
assert('Pack has title', !!pack.title);
assert('Pack has description', !!pack.description);
assert('Pack has level (1-3)', pack.level >= 1 && pack.level <= 3);
assert('Pack has severity (P1-P4)', ['P1','P2','P3','P4'].includes(pack.severity));
assert('Pack has category', !!pack.category);
assert('Pack has queueTitle', !!pack.queueTitle);
assert('Pack has requesterName', !!pack.requesterName);
assert('Pack has company', !!pack.company);
assert('Pack has mode', ['call_only','ticket_only','call_plus_remote','voicemail_plus_ticket'].includes(pack.mode));
assert('Pack has scoringDefaults', !!pack.scoringDefaults);
assert('Pack has callerBehavior', !!pack.callerBehavior);
assert('Pack has cmCommands', Array.isArray(pack.cmdCommands));
assert('Pack has managerReviewHints', !!pack.managerReviewHints);
assert('Pack has taxonomyClassification', Array.isArray(pack.taxonomyClassification));

// ── Test 2: scoringDefaults structure ──
console.log('\n--- Test 2: scoringDefaults structure ---');
const defaults = pack.scoringDefaults;
assert('scoringDefaults has categoryWeights', typeof defaults.categoryWeights === 'object');
assert('scoringDefaults has criteria array', Array.isArray(defaults.criteria));
assert('scoringDefaults.criteria has items', defaults.criteria.length > 0);
assert('scoringDefaults has mandatoryCheckpoints', Array.isArray(defaults.mandatoryCheckpoints));
assert('scoringDefaults has redFlags', Array.isArray(defaults.redFlags));
assert('scoringDefaults has diagnosticChecklist', Array.isArray(defaults.diagnosticChecklist));
assert('scoringDefaults has failGates', Array.isArray(defaults.failGates));
assert('scoringDefaults has thresholds', typeof defaults.thresholds === 'object');
assert('scoringDefaults.thresholds.ready >= 50', defaults.thresholds.ready >= 50);
assert('scoringDefaults.thresholds.needs_supervision >= 30', defaults.thresholds.needs_supervision >= 30);

// ── Test 3: Each criterion has required fields ──
console.log('\n--- Test 3: Criterion structure ---');
for (const c of defaults.criteria) {
  assert(`Criterion ${c.id} has category`, ['call_control','diagnosis','resolution','ticket_quality','professionalism'].includes(c.category));
  assert(`Criterion ${c.id} has weight > 0`, c.weight > 0);
  assert(`Criterion ${c.id} has check type`, ['action_performed','tag_present','tag_in_event','state_value','fact_revealed'].includes(c.check));
  assert(`Criterion ${c.id} has description`, typeof c.description === 'string' && c.description.length > 0);
  assert(`Criterion ${c.id} has gradingGuide`, typeof c.gradingGuide === 'string' && c.gradingGuide.length > 0);
  assert(`Criterion ${c.id} has has mandatory boolean`, typeof c.mandatory === 'boolean');
}

// ── Test 4: Mandatory checkpoints exist in criteria ──
console.log('\n--- Test 4: Mandatory checkpoints ---');
const criteriaIds = new Set(defaults.criteria.map(c => c.id));
for (const cp of defaults.mandatoryCheckpoints) {
  assert(`Mandatory checkpoint "${cp}" exists in criteria`, criteriaIds.has(cp), `ID: ${cp}`);
}

// ── Test 5: Merge config produces valid output ──
console.log('\n--- Test 5: Merge config ---');
const merged = mergeAssessmentConfig({
  pack,
  managerStandardsOverrides: null,
  packId: SIMULATED_OUTLOOK_PACK_ID,
});
assert('Merged config has version', !!merged.version);
assert('Merged config has categoryWeights', Object.keys(merged.categoryWeights).length > 0);
assert('Merged config has criteria', merged.criteria.length > 0);
assert('Merged config has mandatoryCheckpoints', merged.mandatoryCheckpoints.length > 0);
assert('Merged config has thresholds', merged.thresholds.ready > 0);
assert('Merged config has failGates', merged.failGates.length > 0);

// Verify criteria merged properly
const mergedCriterion = merged.criteria.find(c => c.id === 'confirmed_user');
assert('Merged criterion has category field', mergedCriterion?.category !== undefined);
assert('Merged criterion has weight', mergedCriterion?.weight === 5);
assert('Merged criterion has mandatory', mergedCriterion?.mandatory === true);

// ── Test 6: Merge with manager overrides ──
console.log('\n--- Test 6: Merge with manager overrides ---');
const overrides = JSON.stringify({
  global: {
    categoryWeights: { call_control: 30, diagnosis: 20, resolution: 20, ticket_quality: 15, professionalism: 15 },
    mandatoryCheckpoints: ['ticket_root_cause'],
  },
  perPack: {
    [SIMULATED_OUTLOOK_PACK_ID]: {
      criteriaOverrides: [
        { id: 'confirmed_user', action: 'override', weight: 10, mandatory: true },
        { id: 'checked_webmail', action: 'remove' },
      ],
    },
  },
});

const mergedWithOverrides = mergeAssessmentConfig({
  pack,
  managerStandardsOverrides: overrides,
  packId: SIMULATED_OUTLOOK_PACK_ID,
});

assert('Override: confirmed_user weight changed', mergedWithOverrides.criteria.find(c => c.id === 'confirmed_user')?.weight === 10);
assert('Override: checked_webmail removed', !mergedWithOverrides.criteria.find(c => c.id === 'checked_webmail'));
assert('Override: mandatory checkpoint added', mergedWithOverrides.mandatoryCheckpoints.includes('ticket_root_cause'));
assert('Override: category weights changed', mergedWithOverrides.categoryWeights.call_control === 30);

// ── Test 7: Scoring with events produces category scores ──
console.log('\n--- Test 7: Category scoring ---');

// Simulate a "perfect" set of events
const perfectEvents = [
  { event_type: 'action_performed', action_id: 'start_call', label: 'Start call', payload: { taxonomy_tags: [] } },
  { event_type: 'customer_message', text: 'Hi, I have an issue', label: 'Customer message' },
  { event_type: 'candidate_message', text: 'Can I confirm your name?', label: 'Candidate message' },
  { event_type: 'action_performed', action_id: 'open_outlook', label: 'Open Outlook', taxonomy_tags: ['tool.outlook.open'], payload: { taxonomy_tags: ['tool.outlook.open'] } },
  { event_type: 'action_performed', action_id: 'check_outlook_status', label: 'Check status', taxonomy_tags: ['tool.outlook.check_status'], payload: { taxonomy_tags: ['tool.outlook.check_status'] } },
  { event_type: 'action_performed', action_id: 'disable_work_offline', label: 'Disable Work Offline', taxonomy_tags: ['tool.outlook.disable_work_offline', 'fix.correct_root_cause'], payload: { taxonomy_tags: ['tool.outlook.disable_work_offline', 'fix.correct_root_cause'] } },
  { event_type: 'action_performed', action_id: 'send_test_email', label: 'Send test email', taxonomy_tags: ['tool.outlook.send_test_email', 'verification.test_email_sent'], payload: { taxonomy_tags: ['tool.outlook.send_test_email', 'verification.test_email_sent'] } },
  { event_type: 'action_performed', action_id: 'check_webmail', label: 'Check webmail', payload: { taxonomy_tags: ['tool.browser.check_webmail'] } },
  { event_type: 'action_performed', action_id: 'search_kb_outlook', label: 'Search KB', payload: { taxonomy_tags: ['tool.cmd.ping'] } },
  { event_type: 'action_performed', action_id: 'ticket_submitted', label: 'Ticket submitted', payload: {} },
  // Missing: communication.impact_question, communication.scope_question, communication.user_confirmation (but mandatory doesn't require them)
];

// Simulate partial state (flag not triggered)
const partialState = {
  phase: 'submitted',
  call: { startedAt: Date.now(), endedAt: Date.now() - 10000, customerMood: 'reassured', factsRevealed: ['Outlook is offline'] },
  remote: { connected: false, deviceName: 'ALDER-LT-023', currentApp: 'none' },
  toolStates: { outlook: { workOffline: false, outboxCount: 0, sentTestEmail: true } },
  evidence: { askedImpact: true, askedScope: false, confirmedUser: false, confirmedDevice: true, checkedObviousCause: true, verifiedFix: true },
  flags: { guessedWithoutEvidence: false, performedRiskyAction: false, ignoredUserEmotion: false },
  discovered: ['tool.outlook.open', 'tool.outlook.check_status', 'tool.outlook.disable_work_offline', 'tool.outlook.send_test_email', 'tool.browser.check_webmail', 'fix.correct_root_cause'],
};

// Add some tag events for communication
perfectEvents.push(
  {
    event_type: 'action_performed',
    action_id: 'ask_impact',
    label: 'Asked about impact',
    payload: { taxonomy_tags: ['communication.impact_question'] },
  },
  {
    event_type: 'action_performed',
    action_id: 'ask_scope',
    label: 'Asked about scope',
    payload: { taxonomy_tags: ['communication.scope_question'] },
  },
  {
    event_type: 'action_performed',
    action_id: 'confirm_user',
    label: 'Confirmed user',
    payload: { taxonomy_tags: ['communication.user_confirmation'] },
  },
);

const scoringResult = scoreSimEvents({
  config: merged,
  events: perfectEvents,
  finalState: partialState,
});

assert('Scoring produces overallScore >= 0', scoringResult.overallScore >= 0, `score: ${scoringResult.overallScore}`);
assert('Scoring produces categoryScores', typeof scoringResult.categoryScores === 'object');
assert('Scoring has call_control category score', scoringResult.categoryScores.call_control?.score !== undefined, `call_control: ${scoringResult.categoryScores.call_control?.score}`);
assert('Scoring has diagnosis category score', scoringResult.categoryScores.diagnosis?.score !== undefined, `diagnosis: ${scoringResult.categoryScores.diagnosis?.score}`);
assert('Scoring has resolution category score', scoringResult.categoryScores.resolution?.score !== undefined, `resolution: ${scoringResult.categoryScores.resolution?.score}`);
assert('Scoring has ticket_quality category score', scoringResult.categoryScores.ticket_quality?.score !== undefined, `ticket_quality: ${scoringResult.categoryScores.ticket_quality?.score}`);
assert('Scoring has professionalism category score', scoringResult.categoryScores.professionalism?.score !== undefined, `professionalism: ${scoringResult.categoryScores.professionalism?.score}`);
assert('Scoring has actionCriteria', Object.keys(scoringResult.actionCriteria).length > 0);
assert('Scoring has whatCostYouMost', Array.isArray(scoringResult.whatCostYouMost));
assert('Scoring has mandatoryFailures', Array.isArray(scoringResult.mandatoryFailures));

// ── Test 8: Mandatory checkpoint failure ──
console.log('\n--- Test 8: Mandatory checkpoint failure ---');
const failingEvents = [
  { event_type: 'action_performed', action_id: 'start_call', label: 'Start call', payload: {} },
  { event_type: 'action_performed', action_id: 'ticket_submitted', label: 'Ticket', payload: {} },
];
const failingState = {
  phase: 'submitted',
  call: { startedAt: Date.now(), endedAt: Date.now(), customerMood: 'frustrated', factsRevealed: [] },
  remote: { connected: false, deviceName: 'ALDER-LT-023', currentApp: 'none' },
  toolStates: { outlook: { workOffline: true, outboxCount: 3, sentTestEmail: false } },
  evidence: { askedImpact: false, askedScope: false, confirmedUser: false, confirmedDevice: false, checkedObviousCause: false, verifiedFix: false },
  flags: { guessedWithoutEvidence: false, performedRiskyAction: false, ignoredUserEmotion: false },
  discovered: [],
};

const failResult = scoreSimEvents({
  config: merged,
  events: failingEvents,
  finalState: failingState,
});

assert('Failing score < 50', failResult.overallScore < 50, `score: ${failResult.overallScore}`);
assert('Failing has mandatory failures', failResult.mandatoryFailures.length > 0, `failures: ${failResult.mandatoryFailures.join(', ')}`);
assert('What cost most has items', failResult.whatCostYouMost.length > 0, `items: ${failResult.whatCostYouMost.length}`);

// ── Test 9: All scoring categories produce 0-100 scores ──
console.log('\n--- Test 9: Category score ranges ---');
for (const cat of ['call_control', 'diagnosis', 'resolution', 'ticket_quality', 'professionalism']) {
  const cs = scoringResult.categoryScores[cat];
  if (cs) {
    assert(`Category ${cat} score 0-100`, cs.score >= 0 && cs.score <= 100, `score: ${cs.score}`);
  }
}

// ── Test 10: Backward compat fields work ──
console.log('\n--- Test 10: Backward compatibility ---');
assert('pack has top-level rubric', !!pack.rubric);
assert('pack has top-level redFlags', Array.isArray(pack.redFlags));
assert('pack has top-level idealTicket', !!pack.idealTicket);
assert('pack has top-level scoringCriteria', Array.isArray(pack.scoringCriteria));
assert('pack has top-level diagnosticChecklist', Array.isArray(pack.diagnosticChecklist));
assert('pack.scoringCriteria has items', pack.scoringCriteria.length > 0);
assert('pack.rubric.call_control exists', !!pack.rubric.call_control);

// ── Summary ──
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
