# CX-Train OpenRouter MVP implementation progress

Updated: 2026-06-24

## Objective

Replace Chutes AI with OpenRouter free models as the primary AI provider. Keep the existing deterministic scoring, candidate flow, and manager report infrastructure.

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

## Remaining validation

- Run live end-to-end acceptance test with Supabase, OpenRouter, and a real candidate flow.
- Verify evidence extraction returns valid JSON from OpenRouter free models.
- Verify the caller stays in character and hidden facts stay hidden.

## Known issues

- `npx tsc --noEmit` fails with pre-existing stale `.next/types/` errors (not a regression).
- No Supabase credentials in local environment -- cannot run end-to-end flow locally.
