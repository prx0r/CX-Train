import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import fs from 'fs';

interface FailureMode {
  id: string;
  label: string;
  definition: string;
  operational_consequence: string;
  evidence_patterns: string[];
  coaching_action: string;
  severity: string;
  category: string;
}

interface FailureModeBank {
  _meta: { total_modes: number };
  failure_modes: FailureMode[];
}

function loadJson<T>(path: string): T {
  return JSON.parse(fs.readFileSync(path, 'utf-8'));
}

describe('Derived failure mode bank', () => {
  const bank: FailureModeBank = loadJson<FailureModeBank>('data/derived/failure-mode-bank.seed.json');

  it('has at least one failure mode', () => {
    assert.ok(bank.failure_modes.length > 0);
  });

  it('each failure mode has id, label, definition, operational_consequence, coaching_action', () => {
    for (const fm of bank.failure_modes) {
      assert.ok(fm.id, `Missing id`);
      assert.ok(fm.label, `Missing label in ${fm.id}`);
      assert.ok(fm.definition, `Missing definition in ${fm.id}`);
      assert.ok(fm.operational_consequence, `Missing operational_consequence in ${fm.id}`);
      assert.ok(fm.coaching_action, `Missing coaching_action in ${fm.id}`);
    }
  });

  it('each failure mode has evidence_patterns array', () => {
    for (const fm of bank.failure_modes) {
      assert.ok(Array.isArray(fm.evidence_patterns), `Missing evidence_patterns in ${fm.id}`);
      assert.ok(fm.evidence_patterns.length > 0, `Empty evidence_patterns in ${fm.id}`);
    }
  });

  it('each failure mode has valid severity', () => {
    const valid = ['critical', 'major', 'minor'];
    for (const fm of bank.failure_modes) {
      assert.ok(valid.includes(fm.severity), `Invalid severity ${fm.severity} in ${fm.id}`);
    }
  });

  it('each failure mode has valid category', () => {
    const valid = ['discovery', 'ticket', 'communication', 'process', 'technical'];
    for (const fm of bank.failure_modes) {
      assert.ok(valid.includes(fm.category), `Invalid category ${fm.category} in ${fm.id}`);
    }
  });

  it('metadata matches total_modes', () => {
    assert.equal(bank._meta.total_modes, bank.failure_modes.length);
  });
});

describe('Derived ticket quality examples', () => {
  const bank = loadJson<{ _meta: { total_examples: number }; examples: Array<{ id: string; category: string; quality_flags: string[]; quality_score: number }> }>('data/derived/ticket-quality-examples.seed.json');

  it('has at least one example', () => {
    assert.ok(bank.examples.length > 0);
  });

  it('each example has id, category, quality_score in range, quality_flags array', () => {
    const sensitivePatterns = [/ssn/i, /credit.?card/i];
    for (const ex of bank.examples) {
      assert.ok(ex.id, 'Missing id');
      assert.ok(ex.category, `Missing category in ${ex.id}`);
      assert.ok(ex.quality_score >= 0 && ex.quality_score <= 100, `Invalid score ${ex.quality_score} in ${ex.id}`);
      assert.ok(Array.isArray(ex.quality_flags), `Missing quality_flags in ${ex.id}`);
      const str = JSON.stringify(ex);
      for (const pattern of sensitivePatterns) {
        assert.ok(!pattern.test(str), `Possible personal data in ${ex.id}: matches ${pattern}`);
      }
    }
  });
});

describe('Derived utterance examples', () => {
  const bank = loadJson<{ _meta: { total_examples: number }; examples: Array<{ id: string; role: string; message: string; context: string; quality_tags: string[] }> }>('data/derived/support-utterance-examples.seed.json');

  it('has at least one example', () => {
    assert.ok(bank.examples.length > 0);
  });

  it('each example has id, valid role, message, context, quality_tags', () => {
    const valid = ['customer', 'agent'];
    for (const ex of bank.examples) {
      assert.ok(ex.id, 'Missing id');
      assert.ok(valid.includes(ex.role), `Invalid role ${ex.role} in ${ex.id}`);
      assert.ok(ex.message, `Missing message in ${ex.id}`);
      assert.ok(ex.context, `Missing context in ${ex.id}`);
      assert.ok(Array.isArray(ex.quality_tags), `Missing quality_tags in ${ex.id}`);
    }
  });
});

describe('Derived manager-scored examples', () => {
  const bank = loadJson<any>('data/derived/manager-scored-ticket-examples.seed.json');

  it('has at least one example', () => {
    assert.ok(bank.examples.length > 0);
  });

  it('has warning that scores are not CallCallum readiness', () => {
    assert.ok(bank._meta.warning, 'Missing warning in _meta');
    assert.ok(bank._meta.warning.includes('not'), 'Warning must indicate scores are not CallCallum readiness');
  });

  it('each example has source and callcallum_interpretation', () => {
    for (const ex of bank.examples) {
      assert.ok(ex.source, 'Missing source');
      assert.ok(ex.callcallum_interpretation, 'Missing callcallum_interpretation');
      assert.ok(Array.isArray(ex.callcallum_interpretation.possible_quality_signals));
      assert.ok(Array.isArray(ex.callcallum_interpretation.limitations));
    }
  });
});

describe('New analysis-engine fixtures', () => {
  const fixtureNames = [
    'vague-escalation-ticket',
    'missing-scope-ticket',
    'long-handoff-ticket',
    'priority-mismatch-ticket',
    'unclear-resolution-ticket',
    'multi-message-customer-thread',
  ];

  for (const name of fixtureNames) {
    it(`${name} has valid structure`, () => {
      const fixture = loadJson<any>(`tests/fixtures/analysis-engine/${name}.json`);
      assert.ok(fixture.name, 'Missing name');
      assert.ok(fixture.scenario_id, 'Missing scenario_id');
      assert.ok(fixture.criteria_version, 'Missing criteria_version');
      assert.ok(Array.isArray(fixture.transcript), 'Missing transcript array');
      assert.ok(fixture.transcript.length > 0, 'Empty transcript');
      assert.ok(fixture.ticket, 'Missing ticket');
      assert.ok(fixture.expected, 'Missing expected');
      assert.ok(fixture.expected.readiness_label, 'Missing expected.readiness_label');
      assert.ok(typeof fixture.expected.score_min === 'number', 'Missing score_min');
      assert.ok(typeof fixture.expected.score_max === 'number', 'Missing score_max');
      assert.ok(fixture.expected.score_min <= fixture.expected.score_max,
        `score_min (${fixture.expected.score_min}) > score_max (${fixture.expected.score_max})`);
      assert.ok(Array.isArray(fixture.expected.must_pass), 'Missing must_pass');
      assert.ok(Array.isArray(fixture.expected.must_fail), 'Missing must_fail');
    });
  }
});

describe('External datasets not required for tests', () => {
  it('profiles exist but do not require actual data', () => {
    const profile = loadJson<any>('data/derived/dataset-profile.json');
    assert.ok(profile.profiles, 'Missing profiles');
    assert.ok(profile.generated_at, 'Missing generated_at');
  });
});
