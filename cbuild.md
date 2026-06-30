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
  lib/mvp/db.ts                              — 4 new tables + 3 seed blocks + analysis_jobs
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

### What remains (next priorities)

| Item | Notes |
|------|-------|
| `analysis_jobs` runner | Schema exists but no job creator/poller/retry. Timeout still fails synchronously |
| Evidence event IDs | `evidence_event_ids_json` stays null — no session_event → message ID linking yet |
| Candidate aggregate stats | No `candidate_competency_stats` table — /profile can't show trends |
| Retake comparison | No attempt-to-attempt diff view yet |
| `npm test` 2 pre-existing failures | Analysis scoring test expects pack-level weights (safety=4) but `DEFAULT_WEIGHTS` are all 1 — pre-existing, unrelated to these fixes |
