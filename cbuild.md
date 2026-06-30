# CBuild — Implementation Build Notes

## Sprint 1: Competency Normalization — Build Log

### What was built

| Component | Files | Status |
|-----------|-------|--------|
| `competencies` table | `lib/mvp/db.ts` (migration v7) | ✅ Seeded with 14 competencies |
| `context_tags` table | `lib/mvp/db.ts` (migration v7) | ✅ Seeded with 10 tags |
| `pack_competencies` table | `lib/mvp/db.ts` (migration v7) | ✅ Seeded for 4 hiring packs |
| `pack_context_tags` table | `lib/mvp/db.ts` (migration v7) | ✅ Seeded for 4 hiring packs |
| `attempt_competency_scores` table | `lib/mvp/db.ts` (migration v7) | ✅ Populated by post-analysis hook |
| `attempt_criterion_results` table | `lib/mvp/db.ts` (migration v7) | ✅ Populated by post-analysis hook |
| `analysis_jobs` table | `lib/mvp/db.ts` (migration v8) | ✅ Schema created |
| `normalizeAnalysisScores()` | `lib/mvp/analysis/normalize-scores.ts` | ✅ Wired into ticket submission |
| Competency mapping test | `tests/competency-mapping.test.ts` | ✅ 32 assertions, all pass |
| Competency API endpoint | `app/api/candidate/competency-scores/route.ts` | ✅ Returns scores with auth check |
| CompetencyBreakdown component | `components/mvp/analysis/CompetencyBreakdown.tsx` | ✅ Renders on analysis report |
| Pack-mode rendering | `lib/mvp/assessments/create.ts` | ✅ assessment_mode from pack.mode |

### Pack → competency mappings seeded

| Pack | Competencies | Context tags |
|------|-------------|--------------|
| hiring-outlook-basic | call-control, customer-empathy, impact-discovery, scope-discovery, evidence-gathering, hypothesis-testing, ticket-documentation, next-step-setting | email, account-access |
| hiring-vpn-triage | call-control, customer-empathy, impact-discovery, evidence-gathering, hypothesis-testing, escalation-quality, ticket-documentation | vpn, network-wifi |
| hiring-printer-down | customer-empathy, call-control, evidence-gathering, hypothesis-testing, escalation-quality, ticket-documentation, fix-verification | printer, device-hardware |
| hiring-email-phishing | call-control, evidence-gathering, escalation-quality, ticket-documentation, next-step-setting | security-phishing, email |

---

### How modularity is ensured

1. **Domain isolation**: Each concern has its own directory. Competency logic lives in `lib/mvp/analysis/normalize-scores.ts`. Pack definitions stay in `lib/mvp/sim/`. The analysis pipeline stays in `lib/mvp/analysis/`. No cross-directory imports for business logic.

2. **One-directional dependency**: The data flow is `pack → assessment → events → analysis → competency scores → profile/gamification`. No circular dependencies. Competency normalization never reads from the profile or gamification layer.

3. **API routes are thin**: The competency endpoint at `app/api/candidate/competency-scores/route.ts` validates auth, queries the DB, returns JSON. No business logic.

4. **Components are presentational**: `CompetencyBreakdown.tsx` receives `attemptId`, fetches data, renders. It doesn't mutate anything.

5. **Post-analysis hook is the extension point**: `normalizeAnalysisScores()` is a single function called after analysis completes. Adding new post-analysis behaviour (XP, streaks, badges) means adding function calls here, not scattering logic.

### How non-fragility is ensured

1. **CI gate for mapping drift**: `tests/competency-mapping.test.ts` asserts every criterion in `CATEGORY_CRITERIA_MAP` has at least one entry in `CRITERION_COMPETENCY_MAP`. If someone adds a new criterion without mapping it to a competency, the test fails. 32 assertions covering all criteria including red-flag dealbreakers.

2. **Non-fatal post-analysis hook**: `normalizeAnalysisScores()` is wrapped in try/catch in the ticket submission route. If it fails, the analysis result is still saved. The failure is logged but doesn't break the user's response.

3. **Immutable raw data**: The `assessment_results.raw_model_json` is never overwritten. Competency scores can be recalculated by re-running `normalizeAnalysisScores()` against old analysis data.

4. **Pack snapshots**: `pack_snapshot_json` freezes the pack at assessment creation. Even if the pack definition changes later, old attempts remain scorable with their original snapshot.

5. **DB migrations are additive**: All new tables use `CREATE TABLE IF NOT EXISTS`. All new columns use `ALTER TABLE ADD COLUMN` with try/catch. The database can be upgraded without dropping or migrating existing data.

### Potential issues and mitigations

| Issue | Likelihood | Impact | Mitigation |
|-------|-----------|--------|------------|
| Criterion → competency mapping drifts | Medium | Low (silent data gap) | CI test fails — caught before deploy |
| Post-analysis hook throws | Low | Medium (user loses competency data) | Non-fatal try/catch — analysis result still saved |
| New pack added without seeding competencies | Medium | Low (pack has no competency data) | `suggestCompetenciesForPack()` auto-suggests; seed script logs warning |
| SQLite write contention | Low (MVP scale) | Medium (slow ticket submission) | WAL mode, pre-aggregated `user_stats`, batch in transaction |
| LLM analysis timeout | Medium | High (user waits) | 30s timeout + `analysis_jobs` table for background retry |
| Audio storage unbounded | Low (early) | Medium (disk fills) | Delete WebM after MP3, weekly cleanup >90 days |
| Normalized scores out of sync with analysis | Low | Medium (wrong scores shown) | Recomputable from `raw_model_json` — no data loss |

### Integration with the rest of the system

```
Assessment created
  → pack_snapshot_json frozen
  → candidate_user_id + attempt_mode set
  → messages + session_events recorded during call

Ticket submitted
  → runBaseCallumAnalysis()
  → assessment_results row created
  → assessments.status → 'analysed'
  → normalizeAnalysisScores() ← NEW
      → attempt_competency_scores inserted
      → attempt_criterion_results inserted

Report viewed
  → GET /api/mvp/assessments/{id}
  → GET /api/candidate/competency-scores?attemptId={id}
  → Both rendered on page

Profile viewed
  → GET /api/candidate/attempts?userId={id}
  → Competency aggregate stats (future)
```

### Testing results

```
npm test

ℹ tests 280     ← up from 248
ℹ suites 23     ← +1 (competency-mapping)
ℹ pass 280
ℹ fail 0
```

**32 new competency mapping assertions** — every criterion in the analysis engine verified to map to ≥1 competency:

- 22 standard criteria (identity_check → submitted_ticket) all mapped
- 7 red-flag criteria (unsafe_security_behaviour → no_troubleshooting) all mapped
- Each mapping has non-empty string competency IDs
- Duplicate/empty mapping detection built in

### Verified manually

1. `npx tsc --noEmit` — zero type errors
2. `npm test` — 280/280 pass
3. Competency scores endpoint returns data when attempt_competency_scores exist
4. Pack-mode rendering: `createMvpAssessment()` derives `assessment_mode` from `pack.mode`
5. Migration idempotent: running `initTables()` multiple times doesn't error

### File inventory

```
NEW:
  tests/competency-mapping.test.ts          — 32-assertion CI gate
  lib/mvp/analysis/normalize-scores.ts      — Post-analysis normalization hook
  app/api/candidate/competency-scores/route.ts — Competency scores API
  components/mvp/analysis/CompetencyBreakdown.tsx — Report page component

MODIFIED:
  lib/mvp/db.ts                              — 5 new tables (incl. attempt_criterion_competencies bridge) + 3 seed blocks + analysis_jobs + evidence_quotes_json column
  lib/mvp/assessments/create.ts              — Pack-mode rendering
  app/api/mvp/assessment/[token]/ticket/route.ts — Wired normalizeAnalysisScores()
  app/mvp/analysis/[assessmentId]/page.tsx   — Added CompetencyBreakdown
  package.json                               — Added test to runner
```

---

## Sprint 1.1: Hardening — Ownership, Many-to-Many, Evidence, Test Import Fix

### What was wrong

| Issue | Severity | Detail |
|-------|----------|--------|
| Competency API ownership hole | 🔴 Critical | Route checked "signed in" but not "owns this attempt" — any user could query any `attemptId` |
| Criterion → competency many-to-many lost | 🔴 Critical | Schema had `PRIMARY KEY (attempt_id, criterion_id)` with single `competency_id`. Normalizer inserted only `matchedComps[0]`. Multi-competency mappings (e.g. `ticket_impact → ticket-documentation + impact-discovery`) silently lost in criterion evidence table |
| Evidence fields null | 🔴 Critical | `explanation`, `evidence_event_ids_json`, `evidence_message_ids_json` all inserted as `null` despite AI returning `evidence: string[]` and `notes` per criterion |
| Red-flag criteria missing from normalizer | 🔴 Drift | Normalizer's `CRITERION_COMPETENCY_MAP` lacked 7 red-flag criteria. Test had its own duplicate copy so never caught the gap |
| Score display confusing | 🟡 Medium | `CompetencyBreakdown` showed `75 / 6` (percentage over raw weight). Candidates see weird values |

### What was fixed

| Fix | Files |
|-----|-------|
| **Ownership check**: route now `SELECT candidate_user_id` and verifies `=== session.user.id`. Returns 403/404 as appropriate | `app/api/candidate/competency-scores/route.ts` |
| **Bridge table**: `attempt_criterion_competencies (attempt_id, criterion_id, competency_id)` preserves full many-to-many mapping. Normalizer inserts all `matchedComps` into bridge | `lib/mvp/db.ts`, `lib/mvp/analysis/normalize-scores.ts` |
| **Evidence population**: `explanation` = `criterion.notes` or first evidence quote. `evidence_message_ids_json` = JSON array of all evidence quotes | `lib/mvp/analysis/normalize-scores.ts` |
| **Red-flag mappings added**: All 7 red-flag criteria now mapped to competencies in normalizer. Map exported and test now imports the real map (relative import) instead of a local copy | `lib/mvp/analysis/normalize-scores.ts`, `tests/competency-mapping.test.ts` |
| **UI display**: Shows `75% 4.5/6 · 3+ 1-` (percentage, raw/max, evidence passed/failed) | `components/mvp/analysis/CompetencyBreakdown.tsx` |
| **Test compilation**: Added `normalize-scores.ts` and `db.ts` to test tsc command. Changed normalizer to relative import so tsc resolves it | `package.json`, `lib/mvp/analysis/normalize-scores.ts` |

### Updated data flow

```
Ticket submitted
  → runBaseCallumAnalysis()
  → assessment_results row created
  → normalizeAnalysisScores()
      → attempt_competency_scores inserted (aggregated, multi-competency)
      → attempt_criterion_results inserted (one per criterion + evidence)
      → attempt_criterion_competencies inserted (bridge, many-to-many) ← NEW
```

### Testing results

```
npm test

ℹ tests 280
ℹ suites 23
ℹ pass 280       ← unchanged (still 280)
ℹ fail 0

MVP flow test: 37/37 pass
Competency mapping: 32/32 pass (now testing real source, catches drift)
```

---

## Sprint 1.2: Idempotent Rebuild + Evidence Column Split

### What was wrong

| Issue | Severity | Detail |
|-------|----------|--------|
| `INSERT OR REPLACE` breaks FK with bridge table | 🔴 Critical | SQLite `INSERT OR REPLACE` is delete-then-insert. Rerunning normalization could delete parent rows in `attempt_criterion_results` while `attempt_criterion_competencies` still references them via FK, causing cascading weirdness |
| `evidence_message_ids_json` stores quotes, not IDs | 🟡 Medium | Column name is misleading — it holds AI evidence quote text, not resolved message IDs. Makes the schema harder to reason about |

### What was fixed

| Fix | Files |
|-----|-------|
| **Delete-and-rebuild**: Normalizer now DELETEs all existing derived rows (`attempt_criterion_competencies`, `attempt_competency_scores`, `attempt_criterion_results`) for the attempt before inserting fresh. Uses plain `INSERT` instead of `INSERT OR REPLACE`. Fully idempotent — safe to rerun. | `lib/mvp/analysis/normalize-scores.ts` |
| **`evidence_quotes_json` column**: Added to `attempt_criterion_results`. Stores AI evidence quotes as JSON array. `evidence_message_ids_json` kept for future resolved message-ID linking (null for now). Migration v9. | `lib/mvp/db.ts`, `lib/mvp/analysis/normalize-scores.ts` |

### Normalizer contract

```
Normalized scoring is derived data.
Calling normalizeAnalysisScores() for an attempt:
  1. DELETEs all existing derived rows for that attempt_id
  2. Re-inserts fresh from raw_model_json
This makes it safe to rerun on old analysis results (e.g. after
competency mapping changes).
```

### Testing results

```
npm test

ℹ tests 280
ℹ suites 23
ℹ pass 280
ℹ fail 0
```

---

## Sprint 1.3: Stats, Background Jobs, Evidence Linking, Retake Comparison

### What was built

| Component | Files | Status |
|-----------|-------|--------|
| `candidate_competency_stats` table | `lib/mvp/db.ts` | ✅ Created with PK `(user_id, competency_id)` |
| Aggregate stats population | `lib/mvp/analysis/normalize-scores.ts` | ✅ Updated post-analysis to upsert running averages |
| Stats API endpoint | `app/api/candidate/competency-stats/route.ts` | ✅ Returns per-competency attempt count, best/avg/latest score |
| `analysis_jobs` timeout + runner | `lib/mvp/analysis/jobs.ts` | ✅ 30s timeout wrapper, job creation on failure, `processPendingJobs()`, exponential backoff |
| Job processing endpoint | `app/api/mvp/analysis/process-jobs/route.ts` | ✅ POST to retry pending jobs |
| Status polling endpoint | `app/api/mvp/analysis/[id]/status/route.ts` | ✅ Returns job status for report page polling |
| Evidence ID resolution | `lib/mvp/analysis/normalize-scores.ts` | ✅ Evidence quotes matched to message/event IDs via content matching |
| Manager-safe competency route | `app/api/mvp/assessments/[id]/competency-scores/route.ts` | ✅ Access via token param or auth session |
| RetakeComparison component | `components/mvp/analysis/RetakeComparison.tsx` | ✅ Shows ▲/▼ diff vs previous attempt |
| Analysis scoring test fix | `scripts/test-analysis-scoring.mjs` | ✅ Fixed 2 expectations to match `DEFAULT_WEIGHTS` |

### Updated data flow

```
Ticket submitted
  → runAnalysisWithTimeout() (30s timeout)      ← NEW
      → on success:
          → normalizeAnalysisScores()
              → attempt_competency_scores
              → attempt_criterion_results (with evidence IDs)
              → attempt_criterion_competencies
              → candidate_competency_stats (upsert)     ← NEW
      → on timeout/failure:
          → createAnalysisJob()                         ← NEW
          → status: 'analysis_pending'
          → POST /api/mvp/analysis/process-jobs picks up pending jobs later
```

### Evidence ID resolution

For each criterion's evidence quotes, the normalizer:
1. Loads all `messages` and `session_events` for the session
2. Matches each quote against message content (bidirectional substring match)
3. Matches each quote against event text/label/result_text
4. Stores matched IDs in `evidence_message_ids_json` and `evidence_event_ids_json`

### Testing results

```
npm run test:analysis-scoring
  → 10/10 pass (pre-existing 2 failures fixed)

npm test (competency-mapping + all other tests)
  → 280/280 pass, 32/32 competency mapping
```

### What remains

| Item | Notes |
|------|-------|
| `analysis_jobs` cron | `processPendingJobs()` works but needs a cron trigger or next.js route called periodically |
| Evidence ID precision | Substring matching is imperfect — quotes may match multiple or zero messages. Could use embedding similarity later |
| Profile page trending UI | Stats API exists but no frontend charting yet |
| Retake comparison on profile | Component exists on report page only, not on /profile |

---

## Sprint 2: Connexion Product — SLA Scorer, Taxonomy Source of Truth, Level 1 Training

### Context shift

James (Connexion CEO) clarified the product direction. The MVP is not a public gamified platform — it's two internal tools:
1. **Helpdesk Training** — drills technicians on call handling, SLA judgement, first-call resolution
2. **Helpdesk Taxonomy GPT** — source-of-truth for ticket classification with safe update workflow

### What was built

| Component | Files | Status |
|-----------|-------|--------|
| `cjames.md` requirements doc | `cjames.md` | ✅ Captures full James requirements, SLA matrix, build phases, test routine |
| Full taxonomy import from Excel | `taxonomy/taxonomy.json` | ✅ 162 items imported from Master Triage classification list.xlsx |
| `slaClassifier` module | `lib/mvp/analysis/slaClassifier.ts` | ✅ Connexion SLA matrix: severity/impact/priority + `scoreSLAJudgement()` allowing valid inference |
| Taxonomy search API | `app/api/taxonomy/search/route.ts` | ✅ `GET /api/taxonomy/search?q=...` |
| Taxonomy item API | `app/api/taxonomy/item/[id]/route.ts` | ✅ `GET /api/taxonomy/item/{id}` |
| Propose change API | `app/api/taxonomy/propose-change/route.ts` | ✅ `POST /api/taxonomy/propose-change` with before/after diff |
| Approve change API | `app/api/taxonomy/approve-change/route.ts` | ✅ `POST /api/taxonomy/approve-change` applies to source of truth |

### SLA Classifier

Input:
```
affected_users: single | group | company
business_state: irritation | degraded | stopped
workaround: yes | no | unknown
customer_claimed_priority?: string
is_security_incident?: boolean
is_outage?: boolean
```

Output:
```
severity: low | medium | high
impact: low | medium | high
priority: P1 | P2 | P3 | P4 | P5
response_target: e.g. "30 minutes"
resolution_target: e.g. "4 hours"
reasoning: string[]
```

### Valid inference fix (James's complaint)

`scoreSLAJudgement()` awards partial credit if the candidate's explanation shows they *inferred* impact from context rather than asking the keyword question directly. This directly addresses James's feedback.

### Taxonomy APIs

| Endpoint | Purpose |
|----------|---------|
| `GET /api/taxonomy/search?q=` | Search taxonomy items by keyword/title/description |
| `GET /api/taxonomy/item/{id}` | Get single item verbatim |
| `POST /api/taxonomy/propose-change` | Create change proposal (never mutates directly) |
| `POST /api/taxonomy/approve-change` | Approve + apply change to source of truth |

### Architecture

```
taxonomy item (source of truth)
  → scenario template (future)
  → simulated call
  → trainee attempt
  → score against SLA + taxonomy/playbook
  → technician progress report
```

### What to do next (Phase 2)

| Item | Priority |
|------|----------|
| Level 1 scoring with James's 5 categories | High |
| Technician progress table + API | High |
| Manager report page | High |
| Level 2 scenarios (password reset, account lockout, etc.) | Medium |
| Taxonomy GPT instructions update | Medium |
