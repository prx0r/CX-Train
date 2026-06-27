/**
 * Pipeline Testing Harness
 *
 * Runs multiple analysis pipelines against test transcripts and compares results.
 *
 * Usage:
 *   npx tsx scripts/run-pipeline-tests.ts                    # Run all pipelines × all transcripts
 *   npx tsx scripts/run-pipeline-tests.ts --pipeline A       # Run only Pipeline A
 *   npx tsx scripts/run-pipeline-tests.ts --transcript T1    # Run all on gold-mfa-unsafe only
 *   npx tsx scripts/run-pipeline-tests.ts --compare          # Show comparison table
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { pipelineA } from './pipelines/pipeline-a';
import { pipelineB } from './pipelines/pipeline-b';
import { pipelineC } from './pipelines/pipeline-c';

/* ── Types ── */

export interface AnalysisFixture {
  name: string;
  scenario_id: string;
  criteria_version: string;
  taxonomy_item_id?: string;
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

export interface PipelineResult {
  pipelineId: string;
  pipelineName: string;
  score: number;
  rawScore: number;
  readiness: string;
  verdict: string;
  redFlags: Array<{ type: string; severity: string; evidence: string }>;
  triggeredDealbreakers: string[];
  criterionCount: {
    total: number;
    pass: number;
    fail: number;
    notApplicable: number;
  };
  aiCalls: number;
  estimatedTokens: number;
  validation: {
    groundedQuotes: number;
    ungroundedQuotes: number;
    warnings: string[];
  };
}

export interface AnalysisPipeline {
  name: string;
  id: string;
  run(fixture: AnalysisFixture): Promise<PipelineResult>;
}

/* ── Fixture Loading ── */

const FIXTURES_DIR = join(__dirname, '..', 'tests', 'fixtures', 'analysis-engine');

const TRICKY_FIXTURES = [
  'gold-mfa-unsafe.json',             // T1 — excellent safe candidate
  'tricky-perfect-but-abusive.json',  // T2 — perfect tech, abusive conduct
  'tricky-pii-over-phone.json',       // T3 — polite but leaks PII
  'tricky-passive-aggressive.json',   // T4 — subtle micro-aggressions, no swearing
  'tricky-ambiguous-pii.json',        // T5 — asks DOB for ID check, obfuscates email, doesn't read password
];

function loadFixture(filename: string): AnalysisFixture | null {
  const path = join(FIXTURES_DIR, filename);
  try {
    const data = readFileSync(path, 'utf-8');
    return JSON.parse(data);
  } catch {
    console.error(`  ✗ Failed to load ${filename}`);
    return null;
  }
}

function loadAllFixtures(): AnalysisFixture[] {
  return TRICKY_FIXTURES
    .map(f => loadFixture(f))
    .filter((f): f is AnalysisFixture => f !== null);
}

/* ── Scoring Helpers ── */

function scoreCorrectness(result: PipelineResult, fixture: AnalysisFixture): { correct: boolean; details: string[] } {
  const details: string[] = [];
  const exp = fixture.expected;
  let correct = true;

  if (exp.score_min !== undefined && result.score < exp.score_min) {
    details.push(`Score ${result.score} below minimum ${exp.score_min}`);
    correct = false;
  }
  if (exp.score_max !== undefined && result.score > exp.score_max) {
    details.push(`Score ${result.score} above maximum ${exp.score_max}`);
    correct = false;
  }

  if (exp.readiness_label && result.readiness !== exp.readiness_label) {
    details.push(`Readiness "${result.readiness}" ≠ expected "${exp.readiness_label}"`);
    correct = false;
  }

  if (exp.must_trigger_red_flags) {
    const triggered = result.triggeredDealbreakers;
    for (const flag of exp.must_trigger_red_flags) {
      if (!triggered.includes(flag)) {
        details.push(`Expected red flag "${flag}" not triggered`);
        correct = false;
      }
    }
  }

  if (exp.must_not_trigger_red_flags) {
    const triggered = result.triggeredDealbreakers;
    for (const flag of exp.must_not_trigger_red_flags) {
      if (triggered.includes(flag)) {
        details.push(`Forbidden red flag "${flag}" was triggered`);
        correct = false;
      }
    }
  }

  return { correct, details };
}

/* ── Display ── */

function printSeparator(char = '─', len = 72) {
  console.log(char.repeat(len));
}

function printResult(fixture: AnalysisFixture, result: PipelineResult) {
  const { correct, details } = scoreCorrectness(result, fixture);
  const statusIcon = correct ? '✓' : '✗';
  const statusColor = correct ? '\x1b[32m' : '\x1b[31m';

  console.log(`\n${statusColor}${statusIcon}\x1b[0m ${fixture.name}`);
  printSeparator('─');
  console.log(`  Pipeline:     ${result.pipelineName}`);
  console.log(`  Score:        ${result.score}/${result.rawScore} (final/raw)`);
  console.log(`  Readiness:    ${result.readiness}`);
  console.log(`  Verdict:      ${result.verdict}`);
  console.log(`  AI calls:     ${result.aiCalls}`);
  console.log(`  Criteria:     ${result.criterionCount.pass}P / ${result.criterionCount.fail}F / ${result.criterionCount.notApplicable}N/A (of ${result.criterionCount.total})`);
  console.log(`  Red flags:    ${result.redFlags.map(r => r.type).join(', ') || 'none'}`);

  if (details.length > 0) {
    console.log(`  \x1b[33mIssues:\x1b[0m`);
    for (const d of details) {
      console.log(`    ⚠ ${d}`);
    }
  }

  console.log(`  Notes:        ${fixture.expected.notes || 'none'}`);
}

function printComparisonTable(allResults: Map<string, Map<string, PipelineResult>>) {
  const pipelines = Array.from(allResults.values()).reduce((acc, m) => {
    for (const [id] of m) if (!acc.includes(id)) acc.push(id);
    return acc;
  }, [] as string[]);

  const fixtureNames = Array.from(allResults.keys());

  console.log(`\n${'='.repeat(72)}`);
  console.log(`  COMPARISON TABLE`);
  console.log(`${'='.repeat(72)}`);

  const header = `  ${'Transcript'.padEnd(35)}${pipelines.map(p => p.padEnd(18)).join('')}`;
  console.log(`\n${header}`);
  printSeparator('─');

  for (const fName of fixtureNames) {
    const row = [`  ${fName.padEnd(35)}`];
    const pipeResults = allResults.get(fName)!;
    for (const pId of pipelines) {
      const r = pipeResults.get(pId);
      if (r) {
        const { correct } = scoreCorrectness(r, loadFixture(TRICKY_FIXTURES.find(f => f.includes(fName))!)!);
        row.push(`${correct ? '✓' : '✗'} ${String(r.score).padEnd(4)}/${r.readiness.padEnd(16)}`);
      } else {
        row.push(`${'—'.padEnd(18)}`);
      }
    }
    console.log(row.join(''));
  }

  // Cost comparison
  console.log(`\n  Cost Comparison (per 100K assessments):`);
  for (const pId of pipelines) {
    const r = Array.from(allResults.values()).find(m => m.has(pId))?.get(pId);
    if (r) {
      const estCost = r.aiCalls * 0.0012 * 100000;
      console.log(`  ${pId.padEnd(20)} ${r.aiCalls} AI calls → ~$${estCost.toFixed(0)}`);
    }
  }
}

/* ── Main ── */

async function main() {
  const args = process.argv.slice(2);
  const filterPipeline = args.includes('--pipeline') ? args[args.indexOf('--pipeline') + 1] : null;
  const filterTranscript = args.includes('--transcript') ? args[args.indexOf('--transcript') + 1] : null;
  const showCompare = args.includes('--compare');

  /* Register pipelines */
  const pipelines: AnalysisPipeline[] = [
    pipelineA,
    pipelineB,
    pipelineC,
  ];

  /* Load fixtures */
  const fixtures = loadAllFixtures();
  console.log(`\nLoaded ${fixtures.length} test transcripts\n`);

  /* Run */
  const allResults = new Map<string, Map<string, PipelineResult>>();

  for (const fixture of fixtures) {
    if (filterTranscript && !fixture.name.includes(filterTranscript)) continue;

    const fixtureResults = new Map<string, PipelineResult>();

    for (const pipeline of pipelines) {
      if (filterPipeline && pipeline.id !== `pipeline-${filterPipeline.toLowerCase()}`) continue;

      try {
        const result = await pipeline.run(fixture);
        fixtureResults.set(pipeline.id, result);
        printResult(fixture, result);
      } catch (err) {
        console.error(`\n✗ ${fixture.name} — ${pipeline.name} crashed:`);
        console.error(`  ${err}`);
      }
    }

    allResults.set(fixture.name, fixtureResults);
  }

  if (showCompare) {
    printComparisonTable(allResults);
  }

  /* Summary */
  printSeparator('=');
  console.log(`\n  Done. ${fixtures.length} transcripts × ${pipelines.filter(p => !filterPipeline || p.id === `pipeline-${filterPipeline.toLowerCase()}`).length} pipelines\n`);
}

main().catch(console.error);
