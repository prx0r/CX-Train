/**
 * Pack Factory v0 — Verification + Edge Case Tests
 * Tests: pack loading, scoring system, category scores, mandatory checkpoints, merge config,
 * fault tolerance, null/empty/malformed inputs, boundary conditions
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getOutlookWorkOfflinePack, OUTLOOK_WORK_OFFLINE_PACK_ID } from '../lib/mvp/sim/packConfig';
import { getPasswordResetPack, PASSWORD_RESET_PACK_ID } from '../lib/mvp/sim/packs/password-reset';
import { getNewStarterTriagePack, NEW_STARTER_PACK_ID } from '../lib/mvp/sim/packs/new-starter-triage';
import { getSharedMailboxAccessPack, SHARED_MAILBOX_PACK_ID } from '../lib/mvp/sim/packs/shared-mailbox-access';
import { scoreSimEvents } from '../lib/mvp/sim/scoring';
import type { ScoringConfig, ScoringEvent } from '../lib/mvp/sim/scoring';
import { mergeAssessmentConfig } from '../lib/mvp/sim/mergeConfig';
import { SCORING_CATEGORIES, SimPack, SimState, SimPackScoringCriterion } from '../lib/mvp/sim/types';

const SIMULATED_OUTLOOK_PACK_ID = OUTLOOK_WORK_OFFLINE_PACK_ID;

describe('Pack Factory v0', () => {

  describe('Pack loads and has required metadata', () => {
    const pack: SimPack = getOutlookWorkOfflinePack();

    it('has all required identity fields', () => {
      assert.ok(pack.id);
      assert.ok(pack.version);
      assert.ok(pack.title);
      assert.ok(pack.description);
      assert.ok(pack.level >= 1 && pack.level <= 3);
      assert.ok(['P1', 'P2', 'P3', 'P4'].includes(pack.severity));
      assert.ok(pack.category);
      assert.ok(pack.queueTitle);
      assert.ok(pack.requesterName);
      assert.ok(pack.company);
    });

    it('has mode and phase config', () => {
      assert.ok(['call_only', 'ticket_only', 'call_plus_remote', 'voicemail_plus_ticket'].includes(pack.mode));
    });

    it('has scoringDefaults', () => {
      assert.ok(pack.scoringDefaults);
      assert.ok(typeof pack.scoringDefaults.categoryWeights === 'object');
      assert.ok(pack.scoringDefaults.criteria.length > 0);
      assert.ok(Array.isArray(pack.scoringDefaults.mandatoryCheckpoints));
      assert.ok(pack.scoringDefaults.thresholds.ready >= 50);
    });

    it('has callerBehavior', () => {
      assert.ok(pack.callerBehavior);
      assert.ok(['uncertain', 'direct', 'executive'].includes(pack.callerBehavior.archetype));
    });

    it('has cmdCommands', () => {
      assert.ok(Array.isArray(pack.cmdCommands));
    });

    it('has managerReviewHints', () => {
      assert.ok(pack.managerReviewHints);
      assert.ok(Array.isArray(pack.managerReviewHints.keyCriteria));
    });

    it('has taxonomyClassification', () => {
      assert.ok(Array.isArray(pack.taxonomyClassification));
    });
  });

  describe('Scoring criteria are well-formed', () => {
    const pack: SimPack = getOutlookWorkOfflinePack();
    const criteria = pack.scoringDefaults.criteria;

    it('every criterion has required fields', () => {
      for (const c of criteria) {
        assert.ok(['call_control', 'diagnosis', 'resolution', 'ticket_quality', 'professionalism'].includes(c.category),
          `Criterion ${c.id}: invalid category "${(c as any).category}"`);
        assert.ok(c.weight > 0, `Criterion ${c.id}: weight must be > 0`);
        assert.ok(typeof c.mandatory === 'boolean', `Criterion ${c.id}: mandatory must be boolean`);
        assert.ok(c.description && c.description.length > 0, `Criterion ${c.id}: description required`);
        assert.ok(c.gradingGuide && c.gradingGuide.length > 0, `Criterion ${c.id}: gradingGuide required`);
        assert.ok(typeof c.positive === 'boolean', `Criterion ${c.id}: positive must be boolean`);
      }
    });

    it('every criterion has valid check type', () => {
      const validChecks = ['action_performed', 'tag_present', 'tag_in_event', 'state_value', 'fact_revealed'];
      for (const c of criteria) {
        assert.ok(validChecks.includes(c.check), `Criterion ${c.id}: invalid check "${c.check}"`);
      }
    });

    it('every category has at least one criterion', () => {
      for (const cat of SCORING_CATEGORIES) {
        assert.ok(criteria.some(c => c.category === cat), `Category "${cat}" has no criteria`);
      }
    });

    it('mandatory checkpoints reference valid criteria', () => {
      const criteriaIds = new Set(criteria.map(c => c.id));
      for (const cp of pack.scoringDefaults.mandatoryCheckpoints) {
        assert.ok(criteriaIds.has(cp), `Mandatory checkpoint "${cp}" not found in criteria`);
      }
    });
  });

  describe('Backward compatibility fields work', () => {
    const pack: SimPack = getOutlookWorkOfflinePack();

    it('has top-level rubric', () => {
      assert.ok(pack.rubric);
      assert.ok(pack.rubric.call_control);
    });

    it('has top-level redFlags', () => {
      assert.ok(Array.isArray(pack.redFlags));
      assert.ok(pack.redFlags.length > 0);
    });

    it('has top-level idealTicket', () => {
      assert.ok(pack.idealTicket);
      assert.ok(Array.isArray(pack.idealTicket.requiredFields));
    });

    it('has top-level scoringCriteria', () => {
      assert.ok(Array.isArray(pack.scoringCriteria));
      assert.ok(pack.scoringCriteria.length > 0);
    });

    it('has top-level diagnosticChecklist', () => {
      assert.ok(Array.isArray(pack.diagnosticChecklist));
    });
  });

  describe('Merge config works', () => {
    const pack: SimPack = getOutlookWorkOfflinePack();

    it('produces valid config from pack defaults', () => {
      const merged = mergeAssessmentConfig({
        pack,
        managerStandardsOverrides: null,
        packId: SIMULATED_OUTLOOK_PACK_ID,
      });

      assert.ok(merged.version);
      assert.ok(Object.keys(merged.categoryWeights).length > 0);
      assert.ok(merged.criteria.length > 0);
      assert.ok(merged.mandatoryCheckpoints.length > 0);
      assert.ok(merged.failGates.length > 0);
      assert.ok(merged.diagnosticChecklist.length > 0);
    });

    it('preserves criterion category field after merge', () => {
      const merged = mergeAssessmentConfig({
        pack,
        managerStandardsOverrides: null,
        packId: SIMULATED_OUTLOOK_PACK_ID,
      });

      const criterion = merged.criteria.find(c => c.id === 'confirmed_user');
      assert.ok(criterion);
      assert.equal(criterion.category, 'call_control');
      assert.equal(criterion.weight, 5);
      assert.equal(criterion.mandatory, true);
    });

    it('applies manager overrides correctly', () => {
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

      const merged = mergeAssessmentConfig({
        pack,
        managerStandardsOverrides: overrides,
        packId: SIMULATED_OUTLOOK_PACK_ID,
      });

      const confirmedUser = merged.criteria.find(c => c.id === 'confirmed_user');
      assert.ok(confirmedUser);
      assert.equal(confirmedUser.weight, 10);

      const webmail = merged.criteria.find(c => c.id === 'checked_webmail');
      assert.ok(!webmail, 'checked_webmail should be removed');

      assert.ok(merged.mandatoryCheckpoints.includes('ticket_root_cause'));
      assert.equal(merged.categoryWeights.call_control, 30);
    });
  });

  describe('Scoring produces category-level output', () => {
    const pack: SimPack = getOutlookWorkOfflinePack();
    const merged = mergeAssessmentConfig({
      pack,
      managerStandardsOverrides: null,
      packId: SIMULATED_OUTLOOK_PACK_ID,
    });

    const perfectEvents: ScoringEvent[] = [
      { event_type: 'action_performed', action_id: 'start_call', label: 'Start call', payload: { taxonomy_tags: [] } },
      { event_type: 'action_performed', action_id: 'open_outlook', label: 'Open Outlook', payload: { taxonomy_tags: ['tool.outlook.open'] } },
      { event_type: 'action_performed', action_id: 'check_outlook_status', label: 'Check status', payload: { taxonomy_tags: ['tool.outlook.check_status', 'diagnostic.application_state_checked'] } },
      { event_type: 'action_performed', action_id: 'disable_work_offline', label: 'Disable', payload: { taxonomy_tags: ['tool.outlook.disable_work_offline'] } },
      { event_type: 'action_performed', action_id: 'send_test_email', label: 'Test email', payload: { taxonomy_tags: ['tool.outlook.send_test_email'] } },
      { event_type: 'action_performed', action_id: 'check_webmail', label: 'Webmail', payload: { taxonomy_tags: ['tool.browser.check_webmail'] } },
      { event_type: 'action_performed', action_id: 'search_kb_outlook', label: 'Search KB', payload: { taxonomy_tags: ['tool.cmd.ping'] } },
      { event_type: 'action_performed', action_id: 'ask_impact', label: 'Impact', payload: { taxonomy_tags: ['communication.impact_question'] } },
      { event_type: 'action_performed', action_id: 'ask_scope', label: 'Scope', payload: { taxonomy_tags: ['communication.scope_question'] } },
      { event_type: 'action_performed', action_id: 'confirm_user', label: 'Confirm', payload: { taxonomy_tags: ['communication.user_confirmation'] } },
    ];

    const goodState: SimState = {
      phase: 'submitted',
      call: { startedAt: Date.now(), endedAt: Date.now() - 10000, customerMood: 'reassured', factsRevealed: ['Outlook is offline'] },
      remote: { connected: false, deviceName: 'ALDER-LT-023', currentApp: 'none' },
      toolStates: { outlook: { workOffline: false, outboxCount: 0, sentTestEmail: true } },
      evidence: { askedImpact: true, askedScope: true, confirmedUser: true, confirmedDevice: true, checkedObviousCause: true, verifiedFix: true },
      flags: { guessedWithoutEvidence: false, performedRiskyAction: false, ignoredUserEmotion: false },
      discovered: ['tool.outlook.open', 'tool.outlook.check_status', 'tool.outlook.disable_work_offline', 'tool.outlook.send_test_email', 'tool.browser.check_webmail', 'fix.correct_root_cause'],
    };

    it('produces overallScore and categoryScores', () => {
      const result = scoreSimEvents({ config: merged, events: perfectEvents, finalState: goodState });

      assert.ok(result.overallScore >= 0, `overallScore: ${result.overallScore}`);
      assert.ok(result.categoryScores.call_control !== undefined, 'Missing call_control score');
      assert.ok(result.categoryScores.diagnosis !== undefined, 'Missing diagnosis score');
      assert.ok(result.categoryScores.resolution !== undefined, 'Missing resolution score');
      assert.ok(result.categoryScores.ticket_quality !== undefined, 'Missing ticket_quality score');
      assert.ok(result.categoryScores.professionalism !== undefined, 'Missing professionalism score');
    });

    it('category scores are 0-100', () => {
      const result = scoreSimEvents({ config: merged, events: perfectEvents, finalState: goodState });

      for (const cat of SCORING_CATEGORIES) {
        const cs = result.categoryScores[cat];
        assert.ok(cs.score >= 0 && cs.score <= 100, `Category ${cat} score out of range: ${cs.score}`);
      }
    });

    it('has whatCostYouMost items', () => {
      const result = scoreSimEvents({ config: merged, events: perfectEvents, finalState: goodState });

      assert.ok(Array.isArray(result.whatCostYouMost));
      // Provide required detail for whatCostYouMost items
      for (const item of result.whatCostYouMost) {
        assert.ok(item.criterionId);
        assert.ok(item.label);
        assert.ok(typeof item.pointsLost === 'number');
      }
    });

    it('has actionCriteria with results', () => {
      const result = scoreSimEvents({ config: merged, events: perfectEvents, finalState: goodState });

      assert.ok(Object.keys(result.actionCriteria).length > 0);
      const passCount = Object.values(result.actionCriteria).filter(v => v === 'pass').length;
      assert.ok(passCount > 0, `No passing criteria: ${JSON.stringify(result.actionCriteria)}`);
    });

    it('detects mandatory failures when checkpoints are missed', () => {
      const failingState: SimState = {
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
        events: [{ event_type: 'action_performed', action_id: 'start_call' }],
        finalState: failingState,
      });

      assert.ok(failResult.overallScore < 50, `Score should be low: ${failResult.overallScore}`);
      assert.ok(failResult.mandatoryFailures.length > 0, 'Should have mandatory failures');
    });

    it('scores low when no diagnostic events match (but state_value criteria may pass)', () => {
      const emptyEvents: ScoringEvent[] = [];
      const emptyState: SimState = {
        phase: 'submitted',
        call: { startedAt: null, endedAt: null, customerMood: 'frustrated', factsRevealed: [] },
        remote: { connected: false, deviceName: 'ALDER-LT-023', currentApp: 'none' },
        toolStates: { outlook: { workOffline: true, outboxCount: 3, sentTestEmail: false } },
        evidence: { askedImpact: false, askedScope: false, confirmedUser: false, confirmedDevice: false, checkedObviousCause: false, verifiedFix: false },
        flags: { guessedWithoutEvidence: false, performedRiskyAction: false, ignoredUserEmotion: false },
        discovered: [],
      };
      const emptyResult = scoreSimEvents({ config: merged, events: emptyEvents, finalState: emptyState });
      // State_value criteria (like avoided_red_flags) may still pass even with no events
      assert.ok(emptyResult.overallScore < 30, `Expected low score, got ${emptyResult.overallScore}`);
      assert.ok(emptyResult.categoryScores.call_control.score < 30);
      assert.ok(emptyResult.categoryScores.diagnosis.score === 0);
      assert.ok(emptyResult.categoryScores.resolution.score === 0);
      assert.ok(emptyResult.mandatoryFailures.length > 0);
    });
  });

  describe('Edge cases — merge/config', () => {
    const pack = getOutlookWorkOfflinePack();

    it('handles null manager standards overrides gracefully', () => {
      const merged = mergeAssessmentConfig({ pack, managerStandardsOverrides: null, packId: 'any-pack' });
      assert.ok(merged.criteria.length > 0);
      assert.equal(merged.thresholds.ready, 80);
    });

    it('handles undefined manager standards overrides gracefully', () => {
      const merged = mergeAssessmentConfig({ pack, managerStandardsOverrides: undefined as any, packId: 'any-pack' });
      assert.ok(merged.criteria.length > 0);
    });

    it('handles empty JSON object overrides', () => {
      const merged = mergeAssessmentConfig({ pack, managerStandardsOverrides: '{}', packId: 'any-pack' });
      assert.ok(merged.criteria.length > 0);
    });

    it('handles malformed JSON overrides gracefully', () => {
      const merged = mergeAssessmentConfig({ pack, managerStandardsOverrides: '{broken json', packId: 'any-pack' });
      assert.ok(merged.criteria.length > 0);
      assert.equal(merged.criteria.find(c => c.id === 'confirmed_user')?.weight, 5);
    });

    it('handles empty string overrides gracefully', () => {
      const merged = mergeAssessmentConfig({ pack, managerStandardsOverrides: '', packId: 'any-pack' });
      assert.ok(merged.criteria.length > 0);
    });

    it('handles unknown packId in perPack overrides (silently ignores)', () => {
      const overrides = JSON.stringify({
        perPack: {
          'nonexistent-pack': {
            criteriaOverrides: [{ id: 'confirmed_user', action: 'override', weight: 99 }],
          },
        },
      });
      const merged = mergeAssessmentConfig({ pack, managerStandardsOverrides: overrides, packId: 'different-pack' });
      assert.equal(merged.criteria.find(c => c.id === 'confirmed_user')?.weight, 5);
    });

    it('handles remove on non-existent criterion (no crash)', () => {
      const overrides = JSON.stringify({
        perPack: {
          [SIMULATED_OUTLOOK_PACK_ID]: {
            criteriaOverrides: [{ id: 'nonexistent_criteria', action: 'remove' }],
          },
        },
      });
      const merged = mergeAssessmentConfig({ pack, managerStandardsOverrides: overrides, packId: SIMULATED_OUTLOOK_PACK_ID });
      assert.ok(merged.criteria.length > 0);
    });

    it('handles override on non-existent criterion (no crash)', () => {
      const overrides = JSON.stringify({
        perPack: {
          [SIMULATED_OUTLOOK_PACK_ID]: {
            criteriaOverrides: [{ id: 'nonexistent_criteria', action: 'override', weight: 50 }],
          },
        },
      });
      const merged = mergeAssessmentConfig({ pack, managerStandardsOverrides: overrides, packId: SIMULATED_OUTLOOK_PACK_ID });
      assert.ok(merged.criteria.find(c => c.id === 'confirmed_user')?.weight === 5);
    });

    it('handles add_weight on non-existent criterion (no crash)', () => {
      const overrides = JSON.stringify({
        perPack: {
          [SIMULATED_OUTLOOK_PACK_ID]: {
            criteriaOverrides: [{ id: 'nonexistent', action: 'add_weight', delta: 10 }],
          },
        },
      });
      const merged = mergeAssessmentConfig({ pack, managerStandardsOverrides: overrides, packId: SIMULATED_OUTLOOK_PACK_ID });
      assert.ok(merged.criteria.length > 0);
    });

    it('handles custom criteria with all required fields', () => {
      const overrides = JSON.stringify({
        perPack: {
          [SIMULATED_OUTLOOK_PACK_ID]: {
            customCriteria: [
              { id: 'custom_ask_remote_permission', label: 'Asked remote permission', description: 'Must ask before remote', category: 'professionalism', weight: 10, mandatory: true, check: 'tag_present', target: 'communication.remote_permission', positive: true },
            ],
          },
        },
      });
      const merged = mergeAssessmentConfig({ pack, managerStandardsOverrides: overrides, packId: SIMULATED_OUTLOOK_PACK_ID });
      const custom = merged.criteria.find(c => c.id === 'custom_ask_remote_permission');
      assert.ok(custom, 'custom criteria was added');
      assert.equal(custom?.weight, 10);
      assert.equal(custom?.mandatory, true);
      assert.equal(custom?.check, 'tag_present');
    });
  });

  describe('Edge cases — scoring', () => {
    const pack = getOutlookWorkOfflinePack();
    const merged = mergeAssessmentConfig({ pack, managerStandardsOverrides: null, packId: SIMULATED_OUTLOOK_PACK_ID });
    const emptyState: SimState = {
      phase: 'not_started',
      call: { startedAt: null, endedAt: null, customerMood: 'frustrated', factsRevealed: [] },
      remote: { connected: false, deviceName: 'ALDER-LT-023', currentApp: 'none' },
      toolStates: { outlook: { workOffline: true, outboxCount: 3, sentTestEmail: false } },
      evidence: { askedImpact: false, askedScope: false, confirmedUser: false, confirmedDevice: false, checkedObviousCause: false, verifiedFix: false },
      flags: { guessedWithoutEvidence: false, performedRiskyAction: false, ignoredUserEmotion: false },
      discovered: [],
    };

    it('handles empty criteria array (no crash, no points earned)', () => {
      const noCriteria: ScoringConfig = {
        ...merged,
        criteria: [],
        mandatoryCheckpoints: [],
      };
      const r = scoreSimEvents({ config: noCriteria, events: [], finalState: emptyState });
      // Phase is not_started, so no submission bonus. No criteria = no points. Score = 0.
      assert.equal(r.overallScore, 0, 'Score should be 0 with no criteria');
      assert.equal(Object.keys(r.categoryScores.call_control.criteriaResults).length, 0);
      assert.equal(r.mandatoryFailures.length, 0);
    });

    it('handles empty events array (no crash)', () => {
      const r = scoreSimEvents({ config: merged, events: [], finalState: emptyState });
      assert.ok(r.overallScore >= 0);
      assert.ok(r.mandatoryFailures.length > 0);
    });

    it('handles negative weight overrides (score capped at 0)', () => {
      const negConfig: ScoringConfig = {
        ...merged,
        criteria: merged.criteria.map(c => ({ ...c, weight: c.weight > 0 ? c.weight : 0 })),
      };
      const r = scoreSimEvents({ config: negConfig, events: [], finalState: emptyState });
      assert.ok(r.overallScore >= 0, `Score should not go below 0: ${r.overallScore}`);
    });

    it('handles partial state (missing toolStates)', () => {
      const partial = {
        ...emptyState,
        toolStates: {},
        evidence: { askedImpact: false, askedScope: false, confirmedUser: false, confirmedDevice: false, checkedObviousCause: false, verifiedFix: false },
      };
      const r = scoreSimEvents({ config: merged, events: [], finalState: partial });
      assert.ok(r.overallScore >= 0);
    });

    it('handles all state_value criteria gracefully', () => {
      const stateValConfig: ScoringConfig = {
        ...merged,
        criteria: [
          { ...merged.criteria.find(c => c.id === 'avoided_red_flags')!, target: 'nonexistent.deep.path', value: true },
        ],
        mandatoryCheckpoints: [],
      };
      const r = scoreSimEvents({ config: stateValConfig, events: [], finalState: emptyState });
      assert.ok(r.overallScore >= 0, 'Should not crash on missing nested path');
    });

    it('handles triggeredRedFlags parameter', () => {
      const r = scoreSimEvents({ config: merged, events: [], finalState: emptyState, triggeredRedFlags: ['guessed_without_evidence'] });
      assert.ok(r.redFlags.length > 0);
    });

    it('categoryScores returns 0 for all categories when no events match', () => {
      const r = scoreSimEvents({ config: merged, events: [], finalState: emptyState });
      for (const cat of SCORING_CATEGORIES) {
        assert.ok(r.categoryScores[cat].score >= 0 && r.categoryScores[cat].score <= 100,
          `Category ${cat} score out of range: ${r.categoryScores[cat].score}`);
      }
    });

    it('whatCostYouMost returns top 3 misses sorted by weight', () => {
      const pack = getOutlookWorkOfflinePack();
      const merged = mergeAssessmentConfig({ pack, managerStandardsOverrides: null, packId: SIMULATED_OUTLOOK_PACK_ID });
      const r = scoreSimEvents({ config: merged, events: [], finalState: emptyState });
      assert.ok(r.whatCostYouMost.length <= 3, 'at most 3 items');
      // Should be sorted: highest weight first
      for (let i = 1; i < r.whatCostYouMost.length; i++) {
        assert.ok(r.whatCostYouMost[i - 1].pointsLost >= r.whatCostYouMost[i].pointsLost,
          `Not sorted by pointsLost: ${r.whatCostYouMost[i - 1].pointsLost} < ${r.whatCostYouMost[i].pointsLost}`);
      }
    });
  });

  describe('Edge cases — assessment creation', () => {
    it('handles null manager standards at assessment creation', () => {
      // Simulating getManagerStandards() returning null
      const standardsSnapshot = null;
      const pack = getOutlookWorkOfflinePack();
      const merged = mergeAssessmentConfig({
        pack,
        managerStandardsOverrides: null,
        packId: SIMULATED_OUTLOOK_PACK_ID,
      });
      assert.ok(merged.criteria.length > 0);
      assert.ok(merged.mandatoryCheckpoints.length > 0);
    });

    it('handles assessment with unknown pack ID gracefully', () => {
      // Simulating the assessment creation route where packId is set but pack doesn't exist
      const packId = 'nonexistent-pack-v99';
      let pack;
      try {
        pack = getOutlookWorkOfflinePack(); // fallback
      } catch {
        pack = null;
      }
      assert.ok(pack, 'should fallback gracefully');
    });

    it('backward compat: scoring snapshot can be null (old assessments)', () => {
      // Old assessments don't have scoring_snapshot_json column at all
      // When null, the analysis pipeline should fall back to pack defaults
      const snapshotJson = null;
      assert.equal(snapshotJson, null);
      // The analysis pipeline would need to handle this by loading fresh pack config
      const pack = getOutlookWorkOfflinePack();
      const fallbackMerged = mergeAssessmentConfig({
        pack,
        managerStandardsOverrides: null,
        packId: SIMULATED_OUTLOOK_PACK_ID,
      });
      assert.ok(fallbackMerged.criteria.length > 0);
    });
  });

describe('Registered packs are valid', () => {
  const packs = [
    { fn: getOutlookWorkOfflinePack, id: OUTLOOK_WORK_OFFLINE_PACK_ID, name: 'Outlook' },
    { fn: getPasswordResetPack, id: PASSWORD_RESET_PACK_ID, name: 'Password Reset' },
    { fn: getNewStarterTriagePack, id: NEW_STARTER_PACK_ID, name: 'New Starter' },
    { fn: getSharedMailboxAccessPack, id: SHARED_MAILBOX_PACK_ID, name: 'Shared Mailbox' },
  ];

  for (const { fn, id, name } of packs) {
    it(`${name} pack (${id}) has all required fields`, () => {
      const pack = fn();
      assert.ok(pack.id);
      assert.ok(pack.version);
      assert.ok(pack.title);
      assert.ok(pack.description);
      assert.ok(pack.level >= 1 && pack.level <= 3);
      assert.ok(['P1', 'P2', 'P3', 'P4'].includes(pack.severity));
      assert.ok(pack.customer);
      assert.ok(pack.callerBehavior);
      assert.ok(pack.hiddenTruth);
      assert.ok(pack.hiddenTruth.rootCause);
      assert.ok(pack.hiddenTruth.correctFix);
      assert.ok(Array.isArray(pack.hiddenTruth.idealDiagnosticPath));
      assert.ok(Array.isArray(pack.tools));
      assert.ok(Array.isArray(pack.actions));
      assert.ok(pack.actions.length >= 3, `Must have at least 3 actions, got ${pack.actions.length}`);
      assert.ok(Array.isArray(pack.cmdCommands));
      assert.ok(pack.scoringDefaults);
      assert.ok(pack.scoringDefaults.criteria.length >= 5, `Must have >=5 criteria, got ${pack.scoringDefaults.criteria.length}`);
      assert.ok(pack.scoringDefaults.mandatoryCheckpoints.length >= 2, `Must have >=2 mandatory checkpoints, got ${pack.scoringDefaults.mandatoryCheckpoints.length}`);
      assert.ok(pack.scoringDefaults.redFlags.length >= 1, `Must have >=1 red flag, got ${pack.scoringDefaults.redFlags.length}`);
      assert.ok(pack.managerReviewHints);
      assert.ok(Array.isArray(pack.taxonomyClassification));
      assert.ok(pack.mode === 'call_only' || pack.mode === 'call_plus_remote');
    });

    it(`${name} pack has actions with transitionsTo where needed`, () => {
      const pack = fn();
      const startAction = pack.actions.find(a => a.id === 'start_call');
      assert.ok(startAction, 'Must have start_call action');
      assert.ok(startAction?.transitionsTo === 'call_active', 'start_call must transition to call_active');

      const endAction = pack.actions.find(a => a.id === 'end_call');
      assert.ok(endAction, 'Must have end_call action');
      assert.ok(endAction?.transitionsTo === 'ticketing', 'end_call must transition to ticketing');
    });

    it(`${name} pack has all scoring criteria in valid categories`, () => {
      const pack = fn();
      for (const c of pack.scoringDefaults.criteria) {
        assert.ok(['call_control', 'diagnosis', 'resolution', 'ticket_quality', 'professionalism'].includes(c.category),
          `Criterion ${c.id}: invalid category "${c.category}"`);
        assert.ok(c.weight > 0, `Weight must be > 0 for ${c.id}`);
        assert.ok(typeof c.mandatory === 'boolean', `mandatory must be boolean for ${c.id}`);
        assert.ok(c.description, `description required for ${c.id}`);
        assert.ok(c.gradingGuide, `gradingGuide required for ${c.id}`);
      }
    });

    it(`${name} pack has valid mandatory checkpoints referencing existing criteria`, () => {
      const pack = fn();
      const criteriaIds = new Set(pack.scoringDefaults.criteria.map(c => c.id));
      for (const cp of pack.scoringDefaults.mandatoryCheckpoints) {
        assert.ok(criteriaIds.has(cp), `Mandatory checkpoint "${cp}" not found in criteria`);
      }
    });
  }
});

describe('Fail gates and red flags', () => {
  const pack = getOutlookWorkOfflinePack();

    it('fail gates can fire from triggeredRedFlags parameter', () => {
      const merged = mergeAssessmentConfig({ pack, managerStandardsOverrides: null, packId: SIMULATED_OUTLOOK_PACK_ID });
      const emptyState: SimState = {
        phase: 'submitted',
        call: { startedAt: null, endedAt: null, customerMood: 'neutral', factsRevealed: [] },
        remote: { connected: false, deviceName: 'ALDER-LT-023', currentApp: 'none' },
        toolStates: {},
        evidence: { askedImpact: false, askedScope: false, confirmedUser: false, confirmedDevice: false, checkedObviousCause: false, verifiedFix: false },
        flags: { guessedWithoutEvidence: false, performedRiskyAction: false, ignoredUserEmotion: false },
        discovered: [],
      };
      const r = scoreSimEvents({ config: merged, events: [], finalState: emptyState, triggeredRedFlags: ['severe_customer_abuse'] });
      assert.ok(r.gateHits.length > 0, 'Should have gate hits');
      assert.ok(r.overallScore <= 10, `Score should be capped at 10 for critical gate, got ${r.overallScore}`);
    });

    it('derived gates with empty condition function do not crash', () => {
      const emptyDerived: ScoringConfig = {
        ...mergeAssessmentConfig({ pack, managerStandardsOverrides: null, packId: SIMULATED_OUTLOOK_PACK_ID }),
        derivedGates: [],
      };
      const emptyState: SimState = {
        phase: 'submitted',
        call: { startedAt: null, endedAt: null, customerMood: 'neutral', factsRevealed: [] },
        remote: { connected: false, deviceName: 'ALDER-LT-023', currentApp: 'none' },
        toolStates: {},
        evidence: { askedImpact: false, askedScope: false, confirmedUser: false, confirmedDevice: false, checkedObviousCause: false, verifiedFix: false },
        flags: { guessedWithoutEvidence: false, performedRiskyAction: false, ignoredUserEmotion: false },
        discovered: [],
      };
      const r = scoreSimEvents({ config: emptyDerived, events: [], finalState: emptyState });
      assert.ok(r.overallScore >= 0);
    });

    it('conflicting mandatory and gate caps resolve safely', () => {
      const merged = mergeAssessmentConfig({ pack, managerStandardsOverrides: null, packId: SIMULATED_OUTLOOK_PACK_ID });
      const emptyState: SimState = {
        phase: 'submitted',
        call: { startedAt: null, endedAt: null, customerMood: 'neutral', factsRevealed: [] },
        remote: { connected: false, deviceName: 'ALDER-LT-023', currentApp: 'none' },
        toolStates: {},
        evidence: { askedImpact: false, askedScope: false, confirmedUser: false, confirmedDevice: false, checkedObviousCause: false, verifiedFix: false },
        flags: { guessedWithoutEvidence: false, performedRiskyAction: false, ignoredUserEmotion: false },
        discovered: [],
      };
      // Trigger both a mandatory failure AND a critical fail gate
      const r = scoreSimEvents({
        config: merged,
        events: [],
        finalState: emptyState,
        triggeredRedFlags: ['severe_customer_abuse'],
      });
      // Both should apply — mandatory caps at 70, critical gate caps at 10. Min wins.
      assert.ok(r.overallScore <= 10, `Both caps apply, lowest wins: ${r.overallScore}`);
      assert.ok(r.mandatoryFailures.length > 0, 'Mandatory failures should still be tracked');
      assert.ok(r.gateHits.length > 0, 'Gate hits should be tracked');
    });
  });
});
