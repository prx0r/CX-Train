# Fixes — Sprint 1 hardening (2026-06-30)

## What was fixed

### Critical 1: Competency API ownership hole
**File:** `app/api/candidate/competency-scores/route.ts`

The route checked "is anyone signed in" but not "does this attempt belong to you." Any logged-in user could query any `attemptId`.

**Fix:** Added a `SELECT candidate_user_id FROM assessments WHERE id = ?` check. Returns 403 if the signed-in user doesn't own the attempt. Returns 404 if attempt doesn't exist.

---

### Critical 2: Criterion → competency many-to-many mapping lost
**Files:** `lib/mvp/db.ts`, `lib/mvp/analysis/normalize-scores.ts`

The schema had `PRIMARY KEY (attempt_id, criterion_id)` with a single `competency_id` column. The normalizer only inserted `matchedComps[0]`. Multi-competency mappings (e.g. `ticket_impact → ticket-documentation + impact-discovery`) were silently lost for criterion evidence — even though the aggregate `attempt_competency_scores` correctly accumulated all mappings.

**Fix:**
- Added `attempt_criterion_competencies` bridge table: `(attempt_id, criterion_id, competency_id)` with FK to `attempt_criterion_results`
- Normalizer now inserts all competency mappings into the bridge table
- `attempt_criterion_results` stays as one row per criterion (stores primary competency + evidence)
- All 32 mapping test assertions still pass

---

### Critical 3: Evidence fields empty
**File:** `lib/mvp/analysis/normalize-scores.ts`

`explanation`, `evidence_event_ids_json`, `evidence_message_ids_json` columns were all inserted as `null`. The AI output includes `evidence: string[]` (quote strings) and `notes?: string` per criterion.

**Fix:**
- `explanation` = `criterion.notes` if available, else first evidence quote
- `evidence_message_ids_json` = JSON array of all evidence quotes (bridge until proper message-ID resolution exists)
- `evidence_event_ids_json` stays null (no event-ID linking yet)

---

### Bonus: Red-flag criterion mappings were missing from normalizer
**File:** `lib/mvp/analysis/normalize-scores.ts`

The normalizer's `CRITERION_COMPETENCY_MAP` lacked 7 red-flag criteria (`unsafe_security_behaviour`, `severe_customer_abuse`, etc.) that were present in the test file. The test had its own duplicate copy so it never caught the drift.

**Fix:**
- Added all 7 red-flag → competency mappings to the normalizer
- Exported `CRITERION_COMPETENCY_MAP` and made the test import it directly (relative import `../lib/mvp/analysis/normalize-scores`)
- Added `lib/mvp/analysis/normalize-scores.ts` and `lib/mvp/db.ts` to the test compilation list in `package.json`
- Changed normalizer's own import from `@/lib/mvp/db` to relative `../db` so tsc resolves it

---

### Bonus: UI score display confusing
**File:** `components/mvp/analysis/CompetencyBreakdown.tsx`

Showed `normalized_score / max_score` which was e.g. `75 / 6` (percentage vs raw weight). Confusing to candidates.

**Fix:** Shows `75% 4.5/6 · 3+ 1-` (percentage, raw/max, evidence passed/failed).

---

## Current state

| Check | Status |
|-------|--------|
| TypeScript `npx tsc --noEmit` | ✅ Passes (no errors) |
| `npm test` (280 tests, 23 suites) | ✅ 280/280 pass |
| Competency mapping test | ✅ 32/32 pass (now testing real source) |
| MVP flow test | ✅ 37/37 pass |
| DB migration (initTables) | ✅ Idempotent, adds bridge table |
| Analysis scoring test | ⚠️ 2 pre-existing failures (weight mismatch, not related) |

## Still not done (from review)

| Issue | Priority | Notes |
|-------|----------|-------|
| `analysis_jobs` is schema-only, no runner | Medium | Table exists but no job creator/poller/retry |
| Evidence event IDs not resolved | Low | `evidence_event_ids_json` stays null; no session_event → message ID linking |
| Analysis timeout → background retry | Medium | 30s timeout + `analysis_jobs` schema exist but not wired as fallback |
| Aggregate candidate stats | Low | No `candidate_competency_stats` table yet — /profile can't show trends |
| Retake comparison | Low | No attempt-to-attempt diff view |
