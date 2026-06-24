# Evaluation layer handoff

Updated: 2026-06-24

## What was built

A transcript evaluation and labelling layer for CallCallum. After a candidate submits a simulated support-call transcript and ticket, the system now:

1. Stores the raw transcript immutably.
2. Parses it into speaker turns.
3. Calls an AI evaluator to extract structured checkpoint evidence and labels.
4. Calculates deterministic scores from the scenario rubric (weighted checkpoints + risk penalties + skill bonuses).
5. Stores evidence, labels, scores, and evaluator metadata.
6. Makes labels searchable for future analytics/training.

## Files created

### Migration
- `supabase/migrations/20260625000000_callcallum_evaluation_layer.sql`
  - 6 new tables: `assessment_call_transcripts`, `assessment_call_turns`, `assessment_call_evaluations`, `assessment_evidence`, `assessment_labels`, `label_taxonomy`
  - Adds `rubric jsonb` column to `scenarios` table
  - Seeds rubric JSON for 3 First Calls scenarios (Password, Outlook, Printer) with weighted checkpoints
  - Seeds label taxonomy with 38 labels across 4 types: skill (11), risk (14), scenario (15), data_quality (7), outcome (8)
  - RLS policies for manager reads and service_role writes

### Types
- `lib/evaluation/types.ts` — re-exports from `lib/types.ts`
- `lib/types.ts` — added: `CallTurn`, `TranscriptSource`, `EvaluationStatus`, `CheckpointEvidence`, `SkillLabel`, `RiskLabel`, `EvaluationOutput`, `LabelType`, `LabelSource`, `AssessmentTranscript`, `AssessmentEvaluation`, `RubricItem`, `DisclosureRules`

### Evaluation service
- `lib/evaluation/prompts.ts` — `EVALUATOR_SYSTEM_PROMPT` string for the LLM evaluator
- `lib/evaluation/evaluator.ts` — `evaluateTranscript()` function:
  - Calls OpenAI `gpt-4o-mini` with `response_format: json_object` when `OPENAI_API_KEY` is set
  - Falls back to a mock evaluator (heuristic-based) when no API key
  - `validateEvaluationOutput()` — validates the LLM JSON output against the expected schema
  - Returns `EvaluationResult` with validated output, raw JSON, model metadata, and validation errors
- `lib/evaluation/scenarios.ts` — `SCENARIO_RUBRICS` map with weighted checkpoint definitions per scenario; `getRubric()` helper to select DB rubric or fall back to static
- `lib/evaluation/scoring.ts` — `calculateWeightedScore()`:
  - Computes call score from weighted checkpoints (observed = full weight, partially_observed = half weight, missed = 0)
  - Applies risk penalties from `RISK_PENALTY_MAP` (e.g. `gave_wrong_advice` = -25, `missed_scope_check` = -10)
  - Applies skill bonuses from `BONUS_MAP` (e.g. `professional_opening` = +3, `summarised_issue` = +3)
  - Combined score: 75% call + 25% ticket
  - Readiness label from score + critical misses
  - `scoreTicketWithPatterns()` — regex-based ticket scoring (same as original `scoreTicket`)

### API routes
- `app/api/gpt/first-calls/[token]/submit/route.ts` — **rewritten**
  - Path A (backward compatible): if `checkpoint_results` present, uses original GPT scoring path
  - Path B (new): calls evaluator, stores transcript/turns/evaluation/evidence/labels, calculates weighted score, stores all in DB
  - `completeAssessmentPack()` helper to finalize assessment after 3 calls
- `app/api/assessments/[id]/report/route.ts` — manager report endpoint
  - Assembles: assessment metadata, candidate info, call-level rubric + evidence + scores + labels + ticket score + manager reviews
  - Aggregated risk and skill labels across all calls
  - Auth: requires admin + manager tenant
- `app/api/labels/route.ts` — label search/filter API
  - Filters by: `type` (comma-separated), `key`, `source`, `session_id`, `scenario`, `readiness`, `manager_reviewed`
  - Pagination with `limit`/`offset`
  - Returns label count for pagination

### Candidate-safe serialization
- `lib/assessment-data.ts` — `safeScenario()` strips `hidden_facts`, `required_checkpoints`, `ideal_ticket`, `common_mistakes`, `rubric` from scenario objects returned to candidates

### Config
- `.eslintrc.json` — `{ "extends": "next/core-web-vitals" }` (non-interactive lint)
- `tsconfig.json` — added `"target": "es2017"`

### Migration runner
- `scripts/run-assessment-migration.mjs` — includes new migration, verifies 12 tables now

## Files modified

| File | Change |
|---|---|
| `lib/types.ts` | Added 15+ new types for evaluation layer |
| `lib/assessment-data.ts` | Added `safeScenario()` |
| `app/api/gpt/first-calls/[token]/submit/route.ts` | Two-path submission (GPT compat + AI evaluator) |
| `scripts/run-assessment-migration.mjs` | Include new migration, verify 12 tables |
| `tsconfig.json` | Set `target: es2017` |
| `package.json` | Test command includes evaluation files |
| `package-lock.json` | Updated via npm install |

## Tests

### New file: `tests/evaluation-scoring.test.ts` (16 tests)

| Test | What it verifies |
|---|---|
| `validateEvaluationOutput accepts valid JSON` | Full evaluation JSON parses correctly, all fields extracted |
| `validateEvaluationOutput rejects missing call_summary` | Required field validation |
| `validateEvaluationOutput rejects invalid status` | Enum validation for status field |
| `validateEvaluationOutput handles empty arrays` | Edge case: no evidence/labels |
| `weighted scoring: all checkpoints observed = perfect score` | 100% observed = 100 call score |
| `weighted scoring: missing half reduces proportionally` | Weighted sum reflects partial credit |
| `weighted scoring: risk penalties reduce score` | -10 for missed_impact, -25 for wrong_advice |
| `weighted scoring: skill bonuses increase score` | +3 for professional_opening, +3 for summarised_issue |
| `weighted scoring: unsafe risk produces not_ready` | `gave_wrong_advice` → `not_ready` regardless of score |
| `weighted scoring: low score produces not_ready` | Score < 60 → `not_ready` |
| `partially_observed gets half weight` | `partially_observed` = 50% of checkpoint weight |
| `scoreTicketWithPatterns scores good ticket highly` | Complete ticket ≥ 80 |
| `scoreTicketWithPatterns penalises weak ticket` | Incomplete ticket < 50 |
| `scoreTicketWithPatterns flags invented fix` | invented fix = `no_invention: false` |
| `getRubric returns rubric from DB or falls back to static` | DB rubric preferred, static fallback works |
| `getRubric returns empty for unknown scenario` | Unknown title returns `[]` |

### Existing tests still pass (8 tests)
Original `tests/assessment-scoring.test.ts` all pass unchanged.

## Verification results

```
npm run lint     ✅ (5 pre-existing img warnings, no errors)
npx tsc --noEmit ✅ (after next build generates .next/types)
npm test         ✅ 24/24 pass
npm run build    ✅ 36 routes, includes /api/assessments/[id]/report and /api/labels
```

## How the evaluator works

1. Candidate submits transcript + ticket via GPT Action to `POST /api/gpt/first-calls/[token]/submit`
2. Route validates auth, session, and input length
3. If `checkpoint_results` present → Path A (legacy GPT scoring)
4. Otherwise → Path B:
   a. `evaluateTranscript()` called with scenario, hidden facts, rubric, transcript turns, ticket
   b. If `OPENAI_API_KEY` set → calls `gpt-4o-mini` with structured prompt and `response_format: json_object`
   c. If no API key → mock evaluator uses heuristic (searches transcript for checkpoint keywords)
   d. Output validated against schema via `validateEvaluationOutput()`
   e. `calculateWeightedScore()` computes final score from rubric weights + penalties + bonuses
   f. Transcript stored in `assessment_call_transcripts`
   g. Turns stored in `assessment_call_turns`
   h. Evaluation (with raw AI JSON) stored in `assessment_call_evaluations`
   i. Evidence stored in `assessment_evidence`
   j. Labels (skill, risk, scenario, data_quality, outcome) stored in `assessment_labels`
5. Session updated with score, readiness label, feedback text
6. After 3rd call, assessment pack marked `completed`

## Known remaining issues

- **No `OPENAI_API_KEY` in env** → evaluator uses mock (heuristic keyword matching, not real LLM). Set `OPENAI_API_KEY` to enable GPT-4o-mini evaluation.
- **Migration not applied** — needs `DATABASE_URL` set and `npm run migrate:assessment` run
- **Clerk/Supabase auth drift** — `clerk_id` field still in `users` table and webhook handler; auth middleware already uses Supabase Auth. Dead code but harmless for now.
- **Next.js 14.2.0** — CVE-2025-29927 (middleware bypass). Bump to 14.2.25 when ready.
- **xlsx dependency** — used in taxonomy import routes. Replace with CSV-only parsing or sandbox if security is a concern.
- **Demo admin bypass** — `lib/supabase/proxy.ts:51` guards with `NODE_ENV !== 'production'` but should be removed before launch.

## What to do next

1. Apply the migration: `npm run migrate:assessment` (needs `DATABASE_URL`)
2. Set `OPENAI_API_KEY` — real LLM evaluation will replace mock
3. Bump Next.js to 14.2.25 for the CVE fix
4. Replace `xlsx` with `csv-parse` or `papaparse` for taxonomy imports
5. Build a manager-facing report UI that consumes `GET /api/assessments/[id]/report`
6. Build a candidate-facing voice UI (browser mic → STT → transcript → submit → evaluation → ticket → report) — this is the real product, Custom GPT is just the prototype harness
7. Add CI pipeline: `npm install && npm run build && npm test`
8. Clean up public repo: remove old docs, `.docx`, audit files, temp files
