# Plan 1 - Analysis Engine Hardening and Trust Plan

## Purpose

This plan exists because the current analysis engine can look healthier than it is. Some tests exercise inline scorer copies instead of production code, some scripts report serious calibration failures while still exiting successfully, and live AI extraction determinism is not proven by pure deterministic scorer tests.

The goal is to make the CallCallum MVP analysis pipeline manager-trustworthy:

1. Evidence used for scoring must be grounded in the submitted transcript or ticket.
2. Deterministic scoring must be tested through the production scorer, not duplicated inline logic.
3. Calibration failures must fail CI/test commands instead of being buried in console output.
4. The difference between "deterministic scorer" and "deterministic full AI pipeline" must stay explicit.
5. Any future agent must leave executable proof, not claims.

## Non-Negotiable Rules

- Do not build new analysis features in frozen legacy areas listed in `docs/attention.md`.
- Active analysis work belongs under:
  - `lib/mvp/analysis/`
  - `app/api/mvp/`
  - `app/mvp/`
  - `lib/ai/provider.ts`
- Do not add another inline copy of the scorer in tests or scripts.
- If a script reports failed scenarios, it must exit with a nonzero status.
- If a test claims to verify scoring, it must import the real scorer from `lib/mvp/analysis/scoring.ts`, or the test name must clearly say it is a fixture simulator.
- Do not claim "deterministic analysis engine" unless the exact scope is stated:
  - Pure scorer determinism is local code determinism.
  - Full pipeline determinism includes AI extraction, provider behavior, prompts, model versions, retries, and stored outputs.
- Every implementation step must include a command that proves it.

## Current Baseline

Known good after the first hardening pass:

- `npm test` passes.
- `npx tsc --noEmit` passes.
- `npm run test:analysis-scoring` passes.
- `npm run test:analysis-hardening` passes.
- `npm run test:mvp-flow` passes.
- `node scripts/test-adversarial.mjs` passes.
- `npm run lint` passes with existing warnings only.
- `npm run build` passes with existing warnings only.

Known not-good:

- `node scripts/test-50-transcripts.mjs` fails 17 of 50 scenarios.
- The 50-transcript failures are calibration/readiness problems, not nondeterministic pure-code behavior.
- Weak tickets, invented ticket details, wrong priority, and subtle discovery misses are under-penalized.
- Live AI extraction determinism is still unproven.

## Anti-Cheat Verification Contract

Before marking any work complete, run and paste/summarize the result of:

```bash
npm test
npx tsc --noEmit
npm run test:analysis-scoring
npm run test:analysis-hardening
npm run test:mvp-flow
node scripts/test-adversarial.mjs
node scripts/test-50-transcripts.mjs
npm run lint
npm run build
git status --short
```

Rules for interpreting those commands:

- `node scripts/test-50-transcripts.mjs` is allowed to fail only when the task explicitly says the remaining calibration failures are expected and documented.
- If `node scripts/test-50-transcripts.mjs` fails, record the exact number of failed scenarios and the categories.
- If `npm run lint` reports warnings, identify whether they are pre-existing and unrelated.
- If `npm run build` reports warnings, identify whether they are pre-existing and unrelated.
- Do not call a step done if the relevant command was not run.

## Phase 1 - Done in Current Hardening Pass

### 1. Evidence Grounding Validator

Implemented:

- Added `validateEvidenceGrounding()` in `lib/mvp/analysis/validation.ts`.
- Checks criterion evidence against transcript plus ticket source text.
- Removes ungrounded criterion evidence.
- Downgrades `pass` and `partial` criteria to `not_observed` when no evidence quote remains.
- Removes ungrounded ticket assessment evidence.
- Warns on ungrounded red flag evidence.

Acceptance evidence:

- `tests/mvp-analysis-scoring.test.ts` includes a grounding test with one supported quote and multiple unsupported claims.

### 2. Pipeline Wiring

Implemented:

- `runBaseCallumAnalysis()` now validates evidence after AI extraction parsing and before scoring.
- Scoring and narrative prompts use the grounded extraction.
- Structured output now includes `evidence_validation` warnings.

Acceptance evidence:

- `npm test`
- `npx tsc --noEmit`
- `npm run build`

### 3. Real Scorer Hardening

Implemented:

- `scoreExtraction()` now handles null/undefined criteria safely.
- `detectFailGates()` now handles null/undefined red flags safely.
- Red flag matching normalizes type with lowercase and trim.
- Unknown criteria are ignored instead of receiving default score weight.

Acceptance evidence:

- `tests/mvp-analysis-scoring.test.ts` imports `scoreExtraction()` from production code.
- `node scripts/test-adversarial.mjs` asserts uppercase and whitespace-padded red flag types trigger gates.

### 4. Script Honesty

Implemented:

- `scripts/test-adversarial.mjs` no longer validates the old red-flag bypass behavior.
- `scripts/test-50-transcripts.mjs` exits nonzero when scenarios fail.

Acceptance evidence:

- `node scripts/test-adversarial.mjs` passes.
- `node scripts/test-50-transcripts.mjs` currently fails with 17/50 scenario failures, which is the correct honest state.

## Phase 2 - Calibration Fixes

Goal: reduce the 50-transcript simulator failures without gaming the fixtures.

### Problem Summary

The scorer over-rewards candidates who cover many checklist items while missing manager-important details. Current failure clusters:

- Weak or one-line tickets score too high.
- Ticket claims unsupported actions without enough penalty.
- Wrong priority does not force supervision.
- Missing scope, recent changes, error details, workaround checks, and device identifiers barely affect readiness.
- Ending without next steps can still be `ready`.

### Implementation Direction

Add deterministic quality gates, not just weight tweaks.

Candidate gates to add:

- `poor_ticket_quality`
  - Trigger when ticket core documentation criteria are mostly failed.
  - Suggested cap: 60.
  - Suggested readiness: `needs_supervision`.
- `unsupported_ticket_claims`
  - Trigger when ticket claims a fix/action not found in transcript.
  - Suggested cap: 70 or 60 depending severity.
  - Suggested readiness: `needs_supervision`.
- `missing_next_steps`
  - Trigger when `next_steps` fails in an otherwise high-scoring call.
  - Suggested cap: 80.
  - Suggested readiness: `needs_supervision`.
- `critical_discovery_gap`
  - Trigger when scenario-critical discovery criteria fail, such as scope, urgency, error capture, recent changes, or workaround check.
  - Suggested cap: 85, or lower when multiple are missed.
  - Suggested readiness: `needs_supervision`.
- `wrong_ticket_priority`
  - Trigger when ticket urgency/priority conflicts with transcript urgency.
  - Suggested cap: 80.
  - Suggested readiness: `needs_supervision`.

Where to implement:

- Prefer deterministic code in `lib/mvp/analysis/scoring.ts`.
- If inputs needed are not available in scoring, add normalized extraction fields in `lib/mvp/analysis/validation.ts` or the extraction prompt.
- Avoid adding hidden fixture-specific conditionals.

Required tests:

- Add production scorer tests for each new gate.
- Add at least one integration-style fixture that demonstrates the gate in structured extraction form.
- Update `scripts/test-50-transcripts.mjs` only after production scorer behavior changes.

Exit criteria:

- `node scripts/test-50-transcripts.mjs` should pass at least 45/50 without making clearly bad candidates pass.
- Any remaining failures must be listed with an explicit reason.

## Phase 3 - Replace Inline Scorer Drift

Goal: eliminate duplicate scorer implementations where practical.

### Work Items

1. Convert `scripts/test-analysis-scoring.mjs` to either:
   - import compiled production scorer output, or
   - be replaced by a TypeScript/Node test included in `npm test`.
2. Convert `scripts/test-analysis-hardening.mjs` to exercise production scorer logic.
3. Convert `tests/analysis-engine.test.ts` away from a full inline scorer copy.
4. Keep fixture-building helpers, but do not duplicate `FAIL_GATES`, weights, or readiness logic.

Acceptance criteria:

- `rg -n "function scoreOne|function scoreExtraction|const W =|const DEFAULT_WEIGHTS =" scripts tests` has no unapproved production scorer clone.
- Any remaining inline code has a comment explaining why it is not production scoring logic.

## Phase 4 - Full Pipeline Determinism Audit

Goal: prove or disprove determinism of the actual AI-backed analysis pipeline.

### Work Items

1. Add a deterministic fixture runner that can run `runBaseCallumAnalysis()` twice against identical stored assessment data.
2. Store and compare:
   - input hash
   - prompt version
   - rubric version
   - model provider
   - model name
   - raw extraction JSON
   - grounded extraction JSON
   - deterministic score block
   - narrative block
3. Run with the mock provider first.
4. If real provider credentials exist, run with real provider and mark results as provider-dependent.

Acceptance criteria:

- Mock provider full pipeline produces byte-stable deterministic score and grounded extraction.
- Real provider test must not be described as deterministic unless raw extraction is stable across repeated runs.

## Phase 5 - Evidence Grounding V2

Goal: make grounding useful without being brittle.

Current grounding is intentionally conservative. It requires direct text support and uses a high word-overlap fallback for longer quotes.

Improve with:

- Message-level source attribution.
- Separate transcript and ticket grounding results.
- Better handling for paraphrases versus exact quotes.
- Warning severity:
  - `removed_quote`
  - `downgraded_status`
  - `ungrounded_red_flag`
  - `ticket_evidence_removed`
- Storage of grounding warnings in `analysis_runs` metadata if schema supports it, or in `assessment_results.raw_model_json` as currently done.

Required tests:

- Exact candidate quote passes.
- Exact caller quote passes.
- Ticket-only quote passes for ticket criteria.
- Paraphrase without quote does not pass as exact evidence.
- Unsupported ticket fix is removed or flagged.

## Phase 6 - CI/Test Command Cleanup

Goal: make the default test command harder to misunderstand.

Recommended package scripts:

```json
{
  "test": "npm run test:unit && npm run test:scripts",
  "test:unit": "tsc ... && node --test ...",
  "test:scripts": "npm run test:analysis-scoring && npm run test:analysis-hardening && node scripts/test-adversarial.mjs",
  "test:calibration": "node scripts/test-50-transcripts.mjs"
}
```

`test:calibration` is now available as a named script and passes 50/50 after Phase 2. Keep it separate from `npm test` until the remaining inline scorer drift is removed.

## Final Completion Criteria

This plan is complete only when:

- Evidence grounding is active before scoring.
- Production scorer tests cover red-flag normalization, null inputs, unknown criteria, and grounding behavior.
- Inline scorer clones are removed or explicitly quarantined.
- Calibration failures are either fixed or intentionally documented as failing.
- Full pipeline determinism has been separately tested with mock provider.
- All verification commands in the Anti-Cheat Verification Contract have been run and reported.

## Current Status

Phase 1 is implemented.

Phase 2 is implemented:

- Added deterministic derived gates for poor ticket quality, severe data gaps, missing next steps, critical discovery gaps, missed scope, ticket priority mismatch, device/environment gaps, and minor polish/documentation caps.
- Added `unsupported_ticket_claims` as an explicit fail gate for tickets that claim actions not supported by the transcript.
- Updated `scripts/test-50-transcripts.mjs`; it now passes 50/50 with 50/50 deterministic repeat checks.
- Added production scorer tests for the new gates in `tests/mvp-analysis-scoring.test.ts`.
- Added `test:adversarial` and `test:calibration` package scripts.

Phase 4 is partially implemented:

- Added explicit `AI_PROVIDER=mock` support in `lib/ai/provider.ts`.
- Added a deterministic mock-provider test that does not require external API credentials.
- Full `runBaseCallumAnalysis()` replay through temporary SQLite remains open because the current CommonJS test harness does not resolve the app's `@/` aliases at runtime.

Phase 5 is partially implemented:

- Evidence grounding now returns structured warning details with severity, source, code, and criterion fields.
- Added manager-facing narrative quality validation before storing output. Thin summaries, missing ticket feedback, malformed arrays, missing manager-standard notes, and absent coaching focus are repaired with auditable warnings.
- Added tests for structured grounding warnings and narrative repair.

Phase 6 is partially implemented:

- Added `test:quality` to run the practical quality suite in one command.
- `test:calibration` now passes 50/50 but remains separate from `npm test` until inline scorer drift is removed.

Phase 3 remains open. The highest-risk inline scorer drift has been reduced, but `scripts/test-analysis-scoring.mjs`, `scripts/test-analysis-hardening.mjs`, `scripts/test-adversarial.mjs`, `scripts/test-50-transcripts.mjs`, and `tests/analysis-engine.test.ts` still contain local scorer copies or fixture simulators. Remove or quarantine those before treating the test suite as fully authoritative.
