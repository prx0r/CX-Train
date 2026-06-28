# CX-Train Agent Handoff

The repository is currently at commit `d6fbb3e` on `main`. It is a broad, functional prototype—not an empty scaffold—but it needs a stabilization phase before further feature work.

The product is an internal MSP technician training platform built with Next.js 14, Supabase/Postgres, Tailwind, and GPT Actions. It already contains admin and trainee dashboards, deterministic scoring, pathway progression, session tracking, taxonomy management, prompt/document editing, demo data, and a recently added AI feedback and monitoring subsystem.

## Development stage

The recent development sequence was:

1. Core dashboards and GPT session ingestion.
2. Demo mode, prompt management, and reporting.
3. Deterministic scoring, SLA evaluation, levels, and taxonomy tooling.
4. AI feedback analysis, monitoring, training plans, and promotion APIs.

The project’s breadth is ahead of its reliability. The next milestone should be **secure, testable baseline**, not more features.

## Critical pain points

- Demo authentication is unsafe. Setting the unsigned `demo_admin=1` cookie grants the seeded demo administrator identity. This is a production authorization bypass.
- Next.js is pinned to `14.2.0`. `npm audit` reports 15 vulnerabilities: 1 critical, 11 high, and 3 moderate.
- `POST /api/levels/promote` permits `force: true` using only a bot API key. It does not require an authenticated administrator.
- Taxonomy import deletes the live taxonomy before inserting its replacement. A failed insert leaves the database empty or partially populated.
- Session progress updates perform read/compute/upsert in application code. Concurrent submissions can overwrite each other.
- Two definitions of “passed” exist: the GPT-supplied `passed` value and server-calculated `pathwayPass`. Different calculations use different values.
- Users are still identified by full-name matching. Unknown names automatically create stub accounts. This is vulnerable to duplicates and incorrect attribution despite the newer `training_code` field.
- The build fails during webpack compilation in the current environment without a useful diagnostic.
- TypeScript passes, but linting is not configured non-interactively.
- The test script is primarily a live integration harness and requires API/database credentials. There is effectively no isolated unit-test safety net.
- Supabase schema setup is split between a large schema file and overlapping migrations. Fresh and upgraded database paths may behave differently.
- Documentation still describes Clerk even though authentication now uses Supabase Auth; the database retains misleading `clerk_id` naming.
- The uploaded workbook parser, `xlsx`, has unresolved security advisories and processes uploaded files.

The full audit is in `PROJECT_AUDIT.md`. Critical source locations also contain explicit TODO comments.

## Recommended execution order

### 1. Security hardening

Create a `security-hardening` branch.

- Remove direct trust in `demo_admin`.
- Disable demo mode unless an explicit environment flag is enabled.
- Give demo sessions read-only capabilities rather than real admin identity.
- Require `requireAdmin()` for forced promotions.
- Never accept `admin_id` from request input; derive it from the authenticated user.
- Review all public GPT endpoints for authorization, rate limiting, and CORS behavior.

### 2. Dependency upgrade

Create a `dependency-upgrade` branch.

- Upgrade Next.js from `14.2.0` to at least `14.2.35`.
- Align `eslint-config-next`.
- Replace or isolate `xlsx`.
- Regenerate the lockfile.
- Run `npm audit`, type-check, lint, and build.
- Avoid `npm audit fix --force`; review breaking upgrades explicitly.

### 3. CI and tests

Create a `ci-and-tests` branch.

- Commit ESLint configuration so `npm run lint` is non-interactive.
- Add unit tests for rubric scoring, SLA mapping, pass calculation, and level requirements.
- Add authorization tests for demo mode, admin APIs, bot API keys, and forced promotion.
- Add CI steps for `npm ci`, type-check, lint, unit tests, and production build.
- Keep live Supabase/GPT tests in a separate opt-in integration job.

### 4. Data integrity

Create a `data-integrity` branch.

- Move session insertion and progress mutation into a transactional Postgres function.
- Make the server-calculated result authoritative for passing and points.
- Make taxonomy replacement transactional, preferably by loading into a staging table and swapping only after validation.
- Preserve taxonomy versions or snapshots for rollback.
- Add concurrency and rollback tests.

### 5. Identity migration

Create an `identity-migration` branch.

- Make `training_code` or authenticated user ID the canonical identifier.
- Stop creating users from arbitrary full names during session submission.
- Provide an explicit onboarding/claiming workflow.
- Add an admin duplicate-resolution tool if existing production data requires it.

### 6. Schema and documentation reconciliation

- Define migrations as the canonical database evolution path.
- Test both a fresh database and an upgrade from the currently deployed revision.
- Update `SOURCE_OF_TRUTH.md`, `README.md`, and setup documentation to reflect Supabase Auth and the actual API contracts.
- Rename `clerk_id` in a controlled migration or clearly mark it as a legacy external-auth identifier.

## Immediate recommendation

The first agent should start with the demo authorization bypass and forced-promotion authorization. Those are small, bounded changes with immediate security value.

The dependency upgrade can happen concurrently, but both branches will touch authentication/build-sensitive areas, so they should be merged and retested before data-integrity work begins.
