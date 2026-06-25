import assert from 'node:assert/strict';
import test from 'node:test';
import { scoreExtraction } from '../lib/mvp/analysis/scoring';
import { validateEvidenceGrounding } from '../lib/mvp/analysis/validation';

function allPassCriteria(): Record<string, { status: string; evidence: string[] }> {
  const keys = [
    'professional_conduct', 'customer_communication',
    'identity_check', 'company_check', 'issue_clarification', 'started_when',
    'impact', 'urgency', 'scope', 'technical_discovery',
    'error_or_status_capture', 'recent_changes', 'next_steps', 'customer_tone',
    'ticket_user_company', 'ticket_issue_summary', 'ticket_impact', 'ticket_urgency',
    'ticket_checks_attempted', 'ticket_next_step', 'escalation_judgement', 'safety',
  ];
  return Object.fromEntries(keys.map(key => [key, { status: 'pass', evidence: ['grounded quote'] }]));
}

test('real scorer normalizes red flag types before gate matching', () => {
  const result = scoreExtraction({
    criteria: allPassCriteria(),
    redFlags: [{ type: '  SEVERE_CUSTOMER_ABUSE  ', evidence: 'grounded quote' }],
  });

  assert.equal(result.score, 10);
  assert.equal(result.rating, 'not_ready');
  assert.deepEqual(result.triggeredDealbreakers, ['severe_customer_abuse']);
});

test('real scorer handles null inputs and ignores unknown criteria', () => {
  const empty = scoreExtraction({ criteria: null, redFlags: null });
  assert.equal(empty.score, 0);
  assert.equal(empty.rating, 'not_ready');

  const unknownOnly = scoreExtraction({
    criteria: { made_up_criterion: { status: 'pass' } },
    redFlags: [],
  });
  assert.equal(unknownOnly.score, 0);
  assert.equal(unknownOnly.rating, 'not_ready');
});

test('evidence grounding removes unsupported quotes and downgrades unsupported passes', () => {
  const extraction = {
    criteria: {
      identity_check: {
        status: 'pass',
        severity: 'low',
        evidence: ['Can I take your name?', 'I rebuilt the Outlook profile'],
        notes: '',
      },
      impact: {
        status: 'pass',
        severity: 'medium',
        evidence: ['Customer is blocked from sending a board report'],
        notes: '',
      },
    },
    red_flags: [],
    missed_questions: [],
    ticket_assessment: { status: 'pass', missing_fields: [], evidence: 'Ticket says registry was fixed' },
  };

  const { data, warnings } = validateEvidenceGrounding(extraction, {
    transcriptText: 'Caller: I cannot send email. Candidate: Can I take your name?',
    ticketText: 'User cannot send email.',
  });

  assert.deepEqual(data.criteria.identity_check.evidence, ['Can I take your name?']);
  assert.equal(data.criteria.impact.status, 'not_observed');
  assert.equal(data.criteria.impact.evidence.length, 0);
  assert.equal(data.ticket_assessment.evidence, '');
  assert.ok(warnings.some(w => w.includes('identity_check')));
  assert.ok(warnings.some(w => w.includes('impact')));
});
