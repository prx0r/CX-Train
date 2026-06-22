# CX-Train project audit

Audit date: 2026-06-22  
Audited revision: `f09eb4b` (`main`)

## Executive status

CX-Train is a feature-rich working prototype of an internal MSP technician training hub. It has a deployed UI, Supabase-backed data model, GPT Action endpoints, deterministic scoring, pathway progression, taxonomy management, dashboards, demo data, and a newly added AI feedback/monitoring subsystem.

It is not production-ready. The main blockers are authorization weaknesses, a destructive non-transactional taxonomy import, vulnerable dependencies, incomplete automated test coverage, and documentation/schema drift. The sensible next phase is stabilization and security hardening before adding more product features.

## What is implemented

- Next.js 14 App Router application with Supabase authentication and Postgres storage.
- Admin and trainee dashboards, session history/detail, trainee analytics, bots, pathways, prompts, and documents.
- GPT Action APIs for session submission, trainee progress, prompt retrieval, uploads, taxonomy lookup, and taxonomy change proposals.
- Server-side deterministic rubric scoring and SLA priority evaluation.
- Per-user pathway stages, boss-battle state, level points, and promotion APIs.
- Taxonomy JSON/Excel source material, database tables, import/editor UI, proposals, and audit records.
- Demo mode and realistic seeded demo users/sessions.
- AI provider integration, feedback analysis, training-plan generation, prompt monitoring, and associated database migration.
- Vercel deployment and Supabase setup documentation.

## Current stage

The commit history shows three broad phases:

1. Core platform and dashboards (`6820151` through `2bf2411`).
2. Deterministic scoring, levels, and taxonomy tooling (`a120310`).
3. AI analysis, monitoring, and progression integration (`82f2ba3` through `f09eb4b`).

The latest phase landed a large amount of backend code but has not yet had a full stabilization pass. Product breadth is ahead of operational rigor.

## Release blockers

### P0: demo cookie grants admin identity

`lib/auth.ts` treats `demo_admin=1` as sufficient proof of identity and returns the seeded demo administrator. Because the cookie is client-controlled and unsigned, a visitor can forge it. Middleware repeats the same trust decision.

Required fix: disable demo mode by default in production, gate it with explicit environment configuration, and issue a signed server-side demo session with restricted read-only permissions. Do not map demo mode to a real admin authorization path.

### P0: vulnerable framework version

The project pins Next.js `14.2.0`. `npm audit` reports one critical vulnerability and multiple high-severity advisories, including middleware authorization bypass. A non-major fix is available at `14.2.35`, although the complete dependency upgrade should be tested as one focused change.

Required fix: upgrade Next.js and aligned packages, regenerate the lockfile, rerun the full checks, and review all remaining production dependency advisories.

### P1: forced promotion is not admin-authorized

`POST /api/levels/promote` accepts `force: true` after validating only a bot API key. That bypasses progression requirements and does not prove that the caller is an administrator.

Required fix: separate automated bot promotion from manual override. Require `requireAdmin()` for forced promotion and derive the promoting administrator from the authenticated session rather than request input.

### P1: taxonomy replacement can destroy live data

The import endpoint deletes the complete taxonomy and then inserts replacement rows in chunks. Any insertion error leaves an empty or partial taxonomy.

Required fix: validate the entire import first and replace data in a single database transaction/RPC, preserving the previous version for rollback.

### P1: uploaded spreadsheet parser has unresolved advisories

The directly exposed `xlsx` dependency is reported vulnerable and npm has no registry fix for the pinned package line. This matters because an admin upload endpoint parses user-supplied workbooks.

Required fix: replace it with a maintained parser or tightly constrain accepted files, size, processing time, and execution isolation after a risk review.

## Quality and maintainability findings

- `npx tsc --noEmit` passes.
- `npm run build` fails during webpack compilation without emitting a useful diagnostic in this environment. This must be reproduced in CI/Vercel logs and resolved before release.
- `npm run lint` is not CI-ready because no ESLint configuration is committed; it opens an interactive setup prompt.
- `scripts/run-tests.sh` requires live environment variables (`BOT_API_KEY` first) and is therefore an integration harness, not a self-contained unit test suite.
- `npm audit` reports 15 vulnerabilities: 1 critical, 11 high, and 3 moderate.
- Progress updates use a read/compute/upsert sequence, so concurrent session submissions can lose increments. Move the update into a transactional database function.
- The submitted `passed` flag and the server-computed `pathwayPass` can disagree. Progression uses the computed value, while totals and points use the submitted value. Establish one authoritative pass result.
- Full-name identity matching still creates stub users and remains collision-prone despite newer `training_code` columns. Complete the migration to a stable identifier.
- `SOURCE_OF_TRUTH.md` says Clerk is the identity source, but the current implementation uses Supabase Auth and retains the column name `clerk_id`. Documentation and naming have drifted.
- `supabase/schema.sql` and timestamped migrations overlap. New environments and upgraded environments need one tested, canonical migration path.
- Admin API error handling is inconsistent: authentication exceptions may become generic 500 responses instead of 401/403 responses.
- CORS and rate limiting need an explicit policy for public GPT Action endpoints.

## Recommended next work, in order

1. Remove the demo admin authorization bypass and protect forced promotion.
2. Upgrade Next.js/dependencies and establish a non-interactive lint configuration.
3. Add CI for clean install, type-check, lint, unit tests, and production build.
4. Make session/progress updates and taxonomy replacement transactional.
5. Resolve identity around `training_code`; stop creating ambiguous users from names alone.
6. Add unit tests for scoring, SLA mapping, progression, and authorization, then integration tests for core APIs.
7. Reconcile schema migrations and update the source-of-truth/setup documents.
8. Only then continue AI monitoring UI and additional training features.

## Suggested parallel workstreams

- Security: demo mode, API authorization, CORS/rate limiting, dependency upgrades.
- Data integrity: transactional progress and taxonomy import, canonical migrations, identity migration.
- Test/build: CI, ESLint configuration, build diagnosis, deterministic unit tests.
- Product validation: verify dashboards and GPT contracts against real Supabase data, then update documentation.

Each stream should use a separate branch and avoid changing shared schema files concurrently without coordination.
