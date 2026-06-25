import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { scoreExtraction, DEFAULT_WEIGHTS } from '../lib/mvp/analysis/scoring';

interface GoldFixture {
  name: string;
  scenario_id: string;
  criteria_version: string;
  taxonomy_item_id?: string;
  expected_classification?: { type: string; sub_type: string; item: string };
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

const ALL_WEIGHT_KEYS = Object.keys(DEFAULT_WEIGHTS);

function buildCriteria(fx: GoldFixture): { criteria: Record<string, { status: string }>; redFlags: Array<{ type: string; severity?: string; evidence?: string }> } {
  const criteria: Record<string, { status: string }> = {};
  for (const k of ALL_WEIGHT_KEYS) criteria[k] = { status: 'not_observed' };

  if (fx.expected.must_pass) for (const k of fx.expected.must_pass) if (criteria[k]) criteria[k] = { status: 'pass' };
  if (fx.expected.must_fail) for (const k of fx.expected.must_fail) if (criteria[k]) criteria[k] = { status: 'fail' };

  const redFlags: Array<{ type: string; severity?: string; evidence?: string }> = [];
  if (fx.expected.must_trigger_red_flags) {
    for (const rf of fx.expected.must_trigger_red_flags) {
      redFlags.push({ type: rf, severity: 'high', evidence: 'fixture expectation' });
    }
  }
  return { criteria, redFlags };
}

const FIXTURES_DIR = join(process.cwd(), 'tests', 'fixtures', 'analysis-engine');

function loadGoldFixtures(): GoldFixture[] {
  const files = readdirSync(FIXTURES_DIR).filter(f => f.startsWith('gold-') && f.endsWith('.json')).sort();
  return files.map(f => JSON.parse(readFileSync(join(FIXTURES_DIR, f), 'utf-8')));
}

const fixtures = loadGoldFixtures();

describe('Gold fixtures — taxonomy-linked', () => {
  it(`loaded ${fixtures.length} gold fixtures`, () => {
    assert.ok(fixtures.length >= 5, `Expected at least 5 gold fixtures, got ${fixtures.length}`);
  });

  for (const fx of fixtures) {
    it(`${fx.name} has taxonomy_item_id`, () => {
      assert.ok(fx.taxonomy_item_id, `${fx.name} must have taxonomy_item_id`);
    });

    it(`${fx.name} has expected_classification`, () => {
      assert.ok(fx.expected_classification, `${fx.name} must have expected_classification`);
      assert.ok(fx.expected_classification?.type, 'classification type');
      assert.ok(fx.expected_classification?.sub_type, 'classification sub_type');
      assert.ok(fx.expected_classification?.item, 'classification item');
    });

    it(`${fx.name} score within expected range`, () => {
      const { criteria, redFlags } = buildCriteria(fx);
      const r = scoreExtraction({ criteria, redFlags });
      if (fx.expected.score_min !== undefined) {
        assert.ok(r.score >= fx.expected.score_min,
          `${fx.name}: score ${r.score} < min ${fx.expected.score_min}`);
      }
      if (fx.expected.score_max !== undefined) {
        assert.ok(r.score <= fx.expected.score_max,
          `${fx.name}: score ${r.score} > max ${fx.expected.score_max}`);
      }
    });

    it(`${fx.name} readiness matches expected`, () => {
      if (!fx.expected.readiness_label) return;
      const { criteria, redFlags } = buildCriteria(fx);
      const r = scoreExtraction({ criteria, redFlags });
      assert.equal(r.rating, fx.expected.readiness_label,
        `${fx.name}: readiness ${r.rating} !== expected ${fx.expected.readiness_label}`);
    });

    it(`${fx.name} triggers correct gates`, () => {
      if (!fx.expected.must_trigger_red_flags || fx.expected.must_trigger_red_flags.length === 0) return;
      const { criteria, redFlags } = buildCriteria(fx);
      const r = scoreExtraction({ criteria, redFlags });
      const triggered = r.gateHits.map(g => g.id);
      for (const gate of fx.expected.must_trigger_red_flags) {
        assert.ok(triggered.includes(gate),
          `${fx.name}: expected gate "${gate}" not triggered. Gates: [${triggered.join(',')}]`);
      }
    });

    it(`${fx.name} does not trigger forbidden gates`, () => {
      if (!fx.expected.must_not_trigger_red_flags || fx.expected.must_not_trigger_red_flags.length === 0) return;
      const { criteria, redFlags } = buildCriteria(fx);
      const r = scoreExtraction({ criteria, redFlags });
      const triggered = r.gateHits.map(g => g.id);
      for (const gate of fx.expected.must_not_trigger_red_flags) {
        assert.ok(!triggered.includes(gate),
          `${fx.name}: gate "${gate}" should NOT be triggered`);
      }
    });
  }
});
