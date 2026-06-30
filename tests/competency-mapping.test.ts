import { describe, it } from 'node:test';
import assert from 'node:assert';

/**
 * This test ensures every analysis criterion has at least one competency mapping.
 * If a new criterion is added to the scoring engine without a competency mapping,
 * this test fails — preventing silent gaps in the behavioural dataset.
 *
 * The mapping is imported from lib/mvp/analysis/normalize-scores.ts (source of truth).
 * It maps criterion_id → competency_id[] (many-to-many).
 */

import { CRITERION_COMPETENCY_MAP } from '../lib/mvp/analysis/normalize-scores';

/* Mirror of CATEGORY_CRITERIA_MAP from criteriaRegistry.ts — keep in sync */
const CATEGORY_CRITERIA_MAP: Record<string, string[]> = {
  fundamentals: ['submitted_ticket', 'performed_triage', 'next_steps'],
  call_control: ['identity_check', 'company_check', 'customer_tone', 'professional_conduct', 'customer_communication'],
  diagnosis: ['issue_clarification', 'started_when', 'impact', 'urgency', 'scope', 'technical_discovery', 'error_or_status_capture', 'recent_changes'],
  resolution: ['safety', 'escalation_judgement'],
  ticket_quality: ['ticket_user_company', 'ticket_issue_summary', 'ticket_impact', 'ticket_urgency', 'ticket_checks_attempted', 'ticket_next_step'],
  professionalism: ['unsafe_security_behaviour', 'severe_customer_abuse', 'refusal_to_help', 'hallucinated_fix', 'unsafe_advice', 'invented_fix_without_evidence', 'no_troubleshooting'],
};

describe('Competency mapping coverage', () => {
  /* Collect every criterion from every category */
  const allCriteria = new Set<string>();
  for (const criteria of Object.values(CATEGORY_CRITERIA_MAP)) {
    for (const c of criteria) allCriteria.add(c);
  }

  for (const criterionId of allCriteria) {
    it(`${criterionId} maps to at least one competency`, () => {
      const mappings = CRITERION_COMPETENCY_MAP[criterionId];
      assert.ok(mappings, `Criterion "${criterionId}" has no entry in CRITERION_COMPETENCY_MAP`);
      assert.ok(Array.isArray(mappings) && mappings.length > 0,
        `Criterion "${criterionId}" has an empty competency array`);
      assert.ok(mappings.every(m => typeof m === 'string' && m.length > 0),
        `Criterion "${criterionId}" has invalid competency IDs: ${JSON.stringify(mappings)}`);
    });
  }

  it('every mapped competency ID is a non-empty string', () => {
    for (const [criterionId, comps] of Object.entries(CRITERION_COMPETENCY_MAP)) {
      for (const comp of comps) {
        assert.ok(typeof comp === 'string' && comp.length > 0,
          `Criterion "${criterionId}" has invalid competency ID: "${comp}"`);
      }
    }
  });
});
