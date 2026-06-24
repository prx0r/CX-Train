# CallCallum assessment workflow progress

Updated: 2026-06-24

## Objective

Implement the focused workflow described in `/home/box/Documents/ccspec`:

`assessment pack -> candidate invite -> simulated calls -> ticket writing -> evidence-based report -> manager decision`

## Starting state

- Repository: `/root/CX-Train`, branch `main`, base commit `d6fbb3e`.
- The working tree already contained an unfinished assessment implementation. Those changes have been preserved and reviewed.
- Existing partial work included the assessment migration, core types, data/scoring helpers, create/detail APIs, invite lookup, and start-session API.
- The partial implementation passed `npx tsc --noEmit` before further changes.

## Completed

- Read the full `ccspec` requirements document.
- Inspected the Next.js App Router structure, Supabase helpers/schema, authentication, session ingestion, dashboard navigation, scoring, and existing partial assessment work.
- Added candidate call submission API with transcript storage, structured checkpoint evidence extraction, and deterministic call scoring.
- Added required ticket submission API with deterministic ticket scoring, combined readiness score, completion detection, and final recommendation.
- Added tenant-scoped manager review API with score override, required override reason, notes, and final readiness.
- Added client components for manager assessment creation, manager review, and the public candidate call/ticket workflow.
- Candidate flow includes a warning not to enter passwords, secrets, or real client-confidential information.
- Added manager assessment list, creation, detail, and evidence report pages.
- Added the public `/assessment/[token]` candidate page.
- Made Assessments the primary manager navigation item and removed secondary product-bloat links from the main admin navigation.
- Updated public product copy to focus on MSP call readiness.
- Disabled cookie-based demo administrator access in production.
- Added tenant-scoped assessment-session RLS and legacy-compatible full transcript storage.
- Fixed middleware so candidate invite and candidate API routes are public while manager routes remain authenticated.
- Replaced the transcript-paste placeholder with a server-mediated AI caller. Hidden scenario facts remain server-side and are revealed only when the candidate asks appropriate questions.
- Added executable unit tests for checkpoint scoring, critical misses, ticket quality, combined scoring, and readiness mapping.
- Removed client-supplied checkpoint fallback so candidates cannot forge call evidence when AI evaluation is unavailable.
- Added duplicate-session protection for concurrent start requests and deterministic invented-fix detection for tickets.

## In progress

- No implementation work remains in the current scope.

## Remaining validation

- Apply the new Supabase migration in the target environment.
- Run live API acceptance tests with configured Supabase and Chutes credentials.

## Validation notes

- `npx tsc --noEmit`: passed after the final manager and candidate workflow changes.
- `npm test`: passed all assessment-scoring assertions using Node's test runner.
- `git diff --check`: passed.
- `npm run build`: generated server artifacts for the new assessment pages and APIs, but exited before producing `.next/BUILD_ID`. This is not recorded as a successful production build; `AGENT_HANDOFF.md` documents the same pre-existing webpack/build instability on the base repository.
- Installing an additional TypeScript test runner stalled even with approved network access, so tests use the repository's existing TypeScript compiler and Node's built-in test runner instead.
- `npm audit --omit=dev`: registry request failed with `EAI_AGAIN`; audit must be retried when registry connectivity is available.

## Security review

- Manager assessment reads and writes are scoped to the authenticated manager's tenant.
- Candidate access requires a 256-bit invite token and does not require or create a user account.
- Hidden scenario facts are stripped from candidate-facing responses and used only by server-side caller/evaluation prompts.
- Candidates cannot submit their own checkpoint score as a fallback.
- Demo-cookie administrator access is disabled in production in both auth and middleware.
- Existing `/api/session` was not changed, preserving the legacy Custom GPT contract.

## Delivery

- Implementation commit `3a9dbae` was pushed to `origin/main` on 2026-06-24.

## Validation and demo hardening — 2026-06-24

- Confirmed the production build failure exited inside webpack before `.next/BUILD_ID`.
- Disabled the separate webpack worker temporarily to expose the hidden diagnostic.
- Root cause: `next/font/google` attempted to download Outfit from Google Fonts during the build and failed with `EAI_AGAIN`.
- Removed the build-time network dependency and switched to a local system-font stack.
- Restored the standard Next.js webpack worker configuration.
- `npm run build`: now exits 0 and creates `.next/BUILD_ID` with all assessment pages and APIs in the route manifest.
- `npm test`: passes.
- `npx tsc --noEmit`: passes.
- Added `npm run migrate:assessment`, which applies the assessment migration transactionally and verifies tables, session columns, and seeded scenarios.
- Migration execution was attempted and correctly stopped because no `DATABASE_URL` is configured locally. No Supabase credentials are present in the repository or `/home/box/Documents/safe`.
- Added `DEMO_SCRIPT.md`, `LAUNCH_CHECKLIST.md`, and `ASSESSMENT_ACCEPTANCE_TESTS.md`.
- Live database, Chutes, and end-to-end acceptance validation remain blocked until staging credentials are supplied.
