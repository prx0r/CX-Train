#!/usr/bin/env node
/**
 * Evidence Quality Assessment
 *
 * Runs the real AI extraction pipeline against fixture transcripts and measures:
 * - Quote coverage (% of criteria with grounded verbatim quotes)
 * - Downgrade rate (criteria downgraded because quotes were ungrounded)
 * - Per-criterion quote presence
 *
 * Usage: node scripts/test-evidence-quality.mjs [--fixture <name>]
 *        --fixture optional: run only one named fixture
 *        Default: runs a representative subset (6 fixtures)
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
dotenv.config({ path: join(ROOT, '.env.local') });

// ── Import TS source via tsx or direct JIT compile ──
// We'll use dynamic import of the TypeScript files through the test infrastructure
// But for simplicity, let's load what we need

let extractionPromptModule, validationModule, aiProviderModule;

async function loadModules() {
  // Use tsx to load TypeScript modules
  extractionPromptModule = await import(/* @vite-ignore */ '../lib/mvp/analysis/evidencePrompt.ts');
  validationModule = await import(/* @vite-ignore */ '../lib/mvp/analysis/validation.ts');
  aiProviderModule = await import(/* @vite-ignore */ '../lib/ai/provider.ts');
}

// ── Fixture loading ──
const FIXTURES_DIR = join(ROOT, 'tests', 'fixtures', 'analysis-engine');

function loadFixture(name) {
  const path = join(FIXTURES_DIR, `${name}.json`);
  if (!existsSync(path)) {
    console.error(`Fixture not found: ${name}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function listFixtures() {
  return readdirSync(FIXTURES_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
    .sort();
}

// ── Build minimal AnalysisContext from fixture ──
function buildContextFromFixture(fixture, allCriteria) {
  const transcriptText = fixture.transcript
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const ticketText = fixture.ticket
    ? `${fixture.ticket.summary}\n${fixture.ticket.description}`
    : null;

  // Build manager_standards
  const managerStandards = {
    id: 'standards-default-v1',
    required_ticket_fields: ['user', 'company', 'impact', 'urgency', 'checks_attempted', 'next_step'],
    call_requirements: 'First-line support: verify identity, clarify issue, perform discovery, set next steps',
    escalation_requirements: 'Escalate if unable to resolve within scope',
  };

  // Build active_criteria from the criteria definitions themselves
  const activeCriteria = {};
  for (const c of allCriteria) {
    activeCriteria[c.key] = {
      key: c.key,
      label: c.label,
      weight: 1,
      category: c.key.startsWith('ticket_') ? 'ticket_quality'
        : c.key.startsWith('kt_') ? 'diagnosis'
        : c.key.startsWith('comptia_') ? 'diagnosis'
        : c.key.startsWith('servqual_') ? 'call_control'
        : c.key.startsWith('sbar_') ? 'communication'
        : c.key.startsWith('leap_') ? 'call_control'
        : c.key.startsWith('sd_') ? 'call_control'
        : c.key.startsWith('itil_') ? 'diagnosis'
        : 'fundamentals',
    };
  }

  return {
    org_id: 'org-default',
    manager_id: 'manager-default',
    assessment_id: 'test-assessment-001',
    session_id: 'test-session-001',
    assessment_pack_id: null,
    assignment_type: 'hiring_exam',
    transcript_messages: fixture.transcript.map(m => ({ role: m.role, content: m.content })),
    transcript_text: transcriptText,
    submitted_ticket: ticketText,
    manager_standards: managerStandards,
    active_criteria: activeCriteria,
    active_scenario: {
      id: fixture.scenario_id || 'test-scenario-001',
      title: 'Test Scenario',
      caller_persona: 'End user with technical issue',
      hidden_facts: {},
    },
    evidence_timeline: [],
    timing_metrics: null,
    timeline_summary: '',
  };
}

// ── Quote coverage measurement ──
function measureEvidenceQuality(fixtureName, extraction, groundingResult) {
  const criteria = extraction.criteria || {};
  const total = Object.keys(criteria).length;
  let withQuotes = 0;
  let passWithQuotes = 0;
  let totalPass = 0;
  let downgraded = 0;
  let notObserved = 0;
  let perCriterion = [];

  for (const [key, c] of Object.entries(criteria)) {
    const criterion = c;
    const evidence = Array.isArray(criterion.evidence) ? criterion.evidence : [];
    const hasQuote = evidence.length > 0 && evidence.some(q => typeof q === 'string' && q.trim().length > 0);
    const status = criterion.status || 'unknown';

    if (hasQuote) withQuotes++;
    if (status === 'pass' || status === 'partial') {
      totalPass++;
      if (hasQuote) passWithQuotes++;
    }
    if (status === 'not_observed') notObserved++;

    perCriterion.push({
      key,
      status,
      quoteCount: evidence.filter(q => typeof q === 'string' && q.trim().length > 0).length,
      evidence: evidence.slice(0, 2),
      notes: (criterion.notes || '').slice(0, 120),
    });
  }

  // Count downgrades from grounding warnings
  const groundingWarnings = groundingResult?.warnings || [];
  downgraded = groundingWarnings.filter(w => w.includes('downgraded')).length;

  return {
    fixture: fixtureName,
    totalCriteria: total,
    criteriaWithQuotes: withQuotes,
    criteriaWithoutQuotes: total - withQuotes,
    quoteCoveragePct: total > 0 ? Math.round((withQuotes / total) * 100) : 0,
    passCriteria: totalPass,
    passWithQuotes: passWithQuotes,
    passQuoteCoveragePct: totalPass > 0 ? Math.round((passWithQuotes / totalPass) * 100) : 0,
    notObserved,
    downgraded,
    groundingWarnings: groundingWarnings.length,
    perCriterion,
  };
}

// ── Report ──
function printReport(results) {
  console.log('\n═══ EVIDENCE QUALITY REPORT ═══\n');

  const totalCriteria = results.reduce((s, r) => s + r.totalCriteria, 0);
  const totalWithQuotes = results.reduce((s, r) => s + r.criteriaWithQuotes, 0);
  const totalPass = results.reduce((s, r) => s + r.passCriteria, 0);
  const totalPassQuotes = results.reduce((s, r) => s + r.passWithQuotes, 0);
  const totalDowngraded = results.reduce((s, r) => s + r.downgraded, 0);
  const totalNotObserved = results.reduce((s, r) => s + r.notObserved, 0);

  console.log(`Fixtures analyzed: ${results.length}`);
  console.log(`Total criteria evaluated: ${totalCriteria}`);
  console.log(`Criteria with grounded quotes: ${totalWithQuotes}/${totalCriteria} (${Math.round(totalWithQuotes/totalCriteria*100)}%)`);
  console.log(`Pass criteria with quotes: ${totalPassQuotes}/${totalPass} (${Math.round(totalPassQuotes/totalPass*100)}%)`);
  console.log(`Criteria downgraded (quote ungrounded): ${totalDowngraded}`);
  console.log(`Criteria marked not_observed: ${totalNotObserved}`);
  console.log('');

  console.log('─── Per-fixture results ───');
  for (const r of results) {
    const bar = '█'.repeat(Math.floor(r.quoteCoveragePct / 5)) + '░'.repeat(20 - Math.floor(r.quoteCoveragePct / 5));
    let flag = '';
    if (r.downgraded > 0) flag += ` ⚠ ${r.downgraded} downgraded`;
    if (r.passQuoteCoveragePct < 70 && r.passCriteria > 3) flag += ' 🔴 LOW PASS QUOTE COVERAGE';
    console.log(`  ${r.fixture.padEnd(30)} ${String(r.quoteCoveragePct).padStart(3)}% ${bar}${flag}`);
  }

  console.log('');

  // Low-coverage criteria across all fixtures
  const criteriaMap = {};
  for (const r of results) {
    for (const c of r.perCriterion) {
      if (!criteriaMap[c.key]) criteriaMap[c.key] = { total: 0, withQuotes: 0, statuses: {} };
      criteriaMap[c.key].total++;
      if (c.quoteCount > 0) criteriaMap[c.key].withQuotes++;
      criteriaMap[c.key].statuses[c.status] = (criteriaMap[c.key].statuses[c.status] || 0) + 1;
    }
  }

  console.log('─── Per-criterion quote coverage (across all fixtures) ───');
  const sorted = Object.entries(criteriaMap)
    .map(([key, v]) => ({ key, pct: Math.round((v.withQuotes / v.total) * 100), ...v }))
    .sort((a, b) => a.pct - b.pct);

  for (const c of sorted) {
    if (c.pct < 50) {
      console.log(`  ${c.key.padEnd(35)} ${String(c.pct).padStart(3)}% (${c.withQuotes}/${c.total}) — LOW`);
    }
  }
  for (const c of sorted) {
    if (c.pct >= 50 && c.pct < 100) {
      console.log(`  ${c.key.padEnd(35)} ${String(c.pct).padStart(3)}% (${c.withQuotes}/${c.total})`);
    }
  }
  for (const c of sorted) {
    if (c.pct === 100) {
      console.log(`  ${c.key.padEnd(35)} ${String(c.pct).padStart(3)}% (${c.withQuotes}/${c.total})`);
    }
  }

  // Summary verdict
  console.log('\n─── Verdict ───');
  const overallQuotePct = Math.round(totalWithQuotes / totalCriteria * 100);
  if (overallQuotePct >= 80) {
    console.log('✅ PASS: Quote coverage meets target (>=80%)');
  } else if (overallQuotePct >= 60) {
    console.log('⚠️  ACCEPTABLE: Quote coverage is adequate but below target (target 80%)');
  } else {
    console.log(`❌ FAIL: Quote coverage is ${overallQuotePct}%, below target 80%`);
  }
  if (totalDowngraded > 0) {
    console.log(`⚠️  ${totalDowngraded} criteria were downgraded due to ungrounded quotes — this inflates not_observed counts`);
  }
}

// ── Main ──
async function main() {
  const args = process.argv.slice(2);
  const specificFixture = args.find(a => a.startsWith('--fixture='))?.split('=')[1];
  const skipAi = args.includes('--skip-ai'); // Use mock provider

  let fixtureNames;
  if (specificFixture) {
    fixtureNames = [specificFixture];
  } else {
    // Representative subset: a mix of good/bad/different scenarios
    fixtureNames = [
      'excellent-password-reset',
      'bad-password-reset',
      'gold-wifi-good',
      'gold-wifi-bad-premature-reboot',
      'good-call-bad-ticket',
      'bad-call-good-ticket',
      'ambiguous-minimal-call',
      'long-noisy-call',
    ];
  }

  // Set mock provider if requested
  if (skipAi) {
    process.env.AI_PROVIDER = 'mock';
  }

  console.log(`Loading ${fixtureNames.length} fixtures...\n`);
  const fixtures = fixtureNames.map(name => loadFixture(name));

  // Load modules
  console.log('Loading analysis modules...');
  // Use dynamic import with tsx via node --loader
  // For now, let's use the compiled test output if available, or run tsx directly
  const { buildEvidenceExtractionPrompt } = await import(
    /* @vite-ignore */ join(ROOT, 'lib/mvp/analysis/evidencePrompt.ts')
  );
  const { runAiTask } = await import(
    /* @vite-ignore */ join(ROOT, 'lib/ai/provider.ts')
  );
  const { validateEvidenceGrounding, parseExtractionJson } = await import(
    /* @vite-ignore */ join(ROOT, 'lib/mvp/analysis/validation.ts')
  );
  const { CRITERIA_DEFINITIONS } = await import(
    /* @vite-ignore */ join(ROOT, 'lib/mvp/analysis/evidencePrompt.ts')
  );

  const allCriteria = CRITERIA_DEFINITIONS;
  console.log(`Loaded ${allCriteria.length} criteria definitions\n`);

  const results = [];

  for (let i = 0; i < fixtures.length; i++) {
    const fixture = fixtures[i];
    console.log(`[${i + 1}/${fixtures.length}] Analyzing "${fixture.name}"...`);

    const context = buildContextFromFixture(fixture, allCriteria);
    const prompts = buildEvidenceExtractionPrompt(context);

    // Call AI
    const aiResult = await runAiTask('evaluator', {
      messages: [
        { role: 'system', content: prompts.system },
        { role: 'user', content: prompts.user },
      ],
      responseFormat: 'json_object',
      temperature: 0,
      maxTokens: 16384,
    });

    if (!aiResult.success) {
      console.error(`  AI extraction failed for "${fixture.name}": ${aiResult.error}`);
      results.push({
        fixture: fixture.name,
        totalCriteria: 0,
        criteriaWithQuotes: 0,
        criteriaWithoutQuotes: 0,
        quoteCoveragePct: 0,
        passCriteria: 0,
        passWithQuotes: 0,
        passQuoteCoveragePct: 0,
        notObserved: 0,
        downgraded: 0,
        groundingWarnings: 0,
        perCriterion: [],
        error: aiResult.error,
      });
      continue;
    }

    // Parse
    const parsed = parseExtractionJson(aiResult.content);
    if (parsed.error || !parsed.data) {
      console.error(`  Parse failed for "${fixture.name}": ${parsed.error}`);
      continue;
    }

    // Ground
    const sourceText = [
      context.transcript_text,
      context.submitted_ticket || '',
    ].join('\n');
    const grounded = validateEvidenceGrounding(parsed.data, {
      transcriptText: context.transcript_text,
      ticketText: context.submitted_ticket,
    });

    // Measure
    const quality = measureEvidenceQuality(fixture.name, grounded.data, grounded);
    results.push(quality);

    console.log(`  Quote coverage: ${quality.quoteCoveragePct}% (${quality.criteriaWithQuotes}/${quality.totalCriteria})`);
    if (quality.downgraded > 0) console.log(`  Downgraded: ${quality.downgraded}`);
    console.log('');
  }

  printReport(results);

  const avgQuoteCoverage = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.quoteCoveragePct, 0) / results.length)
    : 0;

  console.log(`\n=== Done. Average quote coverage: ${avgQuoteCoverage}% ===`);

  // Exit with code based on quality
  // Target: >= 80% quote coverage
  if (avgQuoteCoverage >= 80) {
    process.exit(0);
  } else {
    console.log('\n⚠️  Evidence quality below target. Need improvements.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
