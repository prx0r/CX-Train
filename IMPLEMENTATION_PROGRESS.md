# CX-Train MVP implementation progress

Updated: 2026-06-24

## Objective

Validate the core CallCallum product loop quickly using the native web app, OpenRouter free models, and a local SQLite database.

The Supabase production path is paused for this pass. The goal is local product validation, not production architecture.

## Completed (OpenRouter MVP)

- Created `lib/ai/provider.ts` -- OpenAI-compatible provider layer with task-based model routing, strong error handling (missing key, 401, 429, invalid JSON, no choices), and `parseJsonResponse` helper.
- Created `scripts/test-openrouter.mjs` -- standalone smoke test that verifies the API key and free model reachability.
- Added `test:openrouter` npm script.
- Updated `lib/assessment-ai.ts` -- `extractAssessmentEvidence` now calls `runAiTask('evaluator', ...)` instead of `callChutesAI`.
- Updated `app/api/assessment/[token]/respond/route.ts` -- caller simulation now calls `runAiTask('caller', ...)` instead of `callChutesAI`.
- Updated `lib/ai/index.ts` -- exports new provider functions.
- Updated `.env.example` -- OpenRouter vars as primary, Chutes/Clerk as legacy/optional.
- Updated `README.md`, `SETUP.md`, `LAUNCH_CHECKLIST.md`, `DEMO_SCRIPT.md` -- OpenRouter is primary path.
- Removed stale Chutes references from docs.
- `npm test` passes (40/40).
- `npm run build` exits 0.
- `node scripts/test-openrouter.mjs` passes -- OpenRouter free models are reachable.

## Completed (SQLite local MVP flow)

- Added local SQLite MVP mode using `better-sqlite3`.
- Added `MVP_DB_PROVIDER=sqlite` and `MVP_SQLITE_PATH=./data/callcallum.db` env path.
- Added `scripts/mvp-init-db.mjs` and `scripts/mvp-reset-db.mjs`.
- Added SQLite schema for assessments, sessions, messages, tickets, assessment results, manager feedback, criteria versions, and scenarios.
- Seeded `MSP First-Line Call Readiness v1` criteria version.
- Seeded one scenario: `Outlook not sending before meeting`.
- Added manager dashboard at `/mvp`.
- Added candidate page at `/mvp/assessment/[token]`.
- Added manager detail page at `/mvp/assessments/[id]`.
- Added `/api/mvp` routes for create assessment, candidate chat, end call, ticket submission, analysis, and manager feedback.
- Added `scripts/test-mvp-flow.mjs` and `npm run test:mvp-flow`.
- Validated bad-vs-good candidate comparison through local API flow:
  - Bad candidate: `not_ready`, score 20.
  - Good candidate: `ready`, score 88.

## Remaining validation

- Run a full browser manual test from `/mvp` with incognito candidate links.
- Keep checking hidden facts do not appear in candidate network responses.
- Tune caller/evaluator prompts if OpenRouter free model quality is inconsistent.

## Known issues

- `npx tsc --noEmit` fails with pre-existing stale `.next/types/` errors (not a regression).
- Supabase production flow is intentionally paused for this pass.
- SQLite MVP mode has no production auth, no tenancy, and no durable production deployment model.
