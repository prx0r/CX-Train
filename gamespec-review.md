# GameSpec Review — Codebase Alignment Audit

## What the gamespec gets right

| Claim | Reality | Verdict |
|-------|---------|---------|
| Analysis runs synchronously after ticket submit | `app/api/mvp/assessment/[token]/ticket/route.ts` calls `runBaseCallumAnalysis()` inline | ✅ Correct |
| Per-dimension scores exist | `buildCandidateAnalysis()` produces `categoryScores` with score/max/percent per category | ✅ Correct, but stored in `category_scores_json` not normalized tables |
| `assessments` table has `candidate_user_id` and `attempt_mode` | Both columns already exist via v6 migration | ✅ Correct |
| 4 hiring packs exist | Outlook Basic, VPN Triage, Printer Down, Phishing Report | ✅ Correct |
| Recording storage at `data/recordings/` | WebM + MP3 per call, gitignored | ✅ Correct |
| Audio served via API route | `GET /api/mvp/assessment/{token}/recording?format=mp3` | ✅ Correct |
| No background job system | Everything runs inline, no job queue | ✅ Correct |
| SQLite is single-writer bottleneck | `better-sqlite3` is synchronous, single-connection | ✅ Correct |

## What the gamespec gets wrong or needs to change

### 1. Dimension names don't match the codebase

**gamespec says**: `technical`, `communication`, `callControl`, `professionalism`

**Codebase actually uses** (from `CATEGORY_CRITERIA_MAP` in `criteriaRegistry.ts`):

| Category | Label | Criteria count |
|----------|-------|---------------|
| `fundamentals` | Fundamentals | 3 |
| `diagnosis` | Diagnosis & Discovery | 8 |
| `ticket_quality` | Ticket Quality | 6 |
| `call_control` | Call Control | 5 |
| `resolution` | Resolution | 2 |
| `professionalism` | Professionalism | 6 (all red-flag dealbreakers) |

**Fix**: The gamespec's skill taxonomy should use these 6 actual categories, not the 4 proposed ones. The codebase already ships per-category scores, they're just not stored in normalized tables. The category IDs (`call_control`, `diagnosis`, `ticket_quality`, `resolution`, `professionalism`, `fundamentals`) should be the initial `skills` table seed.

### 2. Category scores already exist — they just need to be normalized

`buildCandidateAnalysis()` already computes `categoryScores` with per-category breakdowns. The existing `assessment_results.category_scores_json` column stores this data as JSON.

**What's missing**: The gamespec's `attempt_skill_scores`, `attempt_criterion_results`, and `ticket_field_scores` tables don't exist yet. These are the normalized forms of data that already exists in:
- `assessment_results.category_scores_json` (category scores)
- `assessment_results.raw_model_json` → `deterministic_score.skillBreakdown` (per-criterion scores)
- The ticket text in `tickets.candidate_ticket_text`

**Sprint 1 should not be "add scoring tables"** — it should be "explode existing scores into normalized tables" and "ensure every analysis writes to category_scores_json".

### 3. Hiring packs are too minimal for the full pack schema

The gamespec defines `scenario_pack_versions` with fields like `expected_behaviours_json`, `diagnostic_path_json`, `red_flags_json`, `rubric_json`. But hiring packs (`HiringPack` type) only have:
- `customer` (name, company, role, temperament, openingLine, issue)
- `hiddenFacts`
- No rubric, no expected behaviours, no scoring config

**Full sim packs** (in `assessment_packs` table) have the richer schema. The assessment creation flow already handles this:
- `hiring_exam` → uses `HiringPack` → stores minimal `pack_snapshot_json`
- `training_drill` → uses `SimPack` from registry → stores full `pack_snapshot_json`

**Fix**: The `scenario_pack_versions` schema should be additive, not replace what exists. Hiring packs stay lightweight. Only training_drill packs get the full versioned schema. The `pack_snapshot_json` column already handles immutability.

### 4. No skills/categories table exists — categories are code-defined

`CATEGORY_CRITERIA_MAP` and `CRITERION_LABELS` are hardcoded in `criteriaRegistry.ts`. There's no `skills` or `categories` table in the DB.

**This is fine for MVP**. The skill taxonomy can be seeded from the existing category map. The gamespec's `skills` table should map to these existing categories initially, then extend with the full skill tree later.

### 5. `session_events` already captures most event data

The gamespec defines `attempt_events` as a new table. But `session_events` already stores: session_id, sequence_index, event_type, actor, text, tool_id, action_id, label, state_before/after, payload, started_at_ms, ended_at_ms, duration_ms.

**Fix**: Don't create `attempt_events` as a separate table. `session_events` already IS the canonical event log. Just add `attempt_id`, `skill_id`, and `criterion_id` columns to it via migration. The `input_source` and `audio_metadata_json` columns already exist.

### 6. `assessments` needs a few more columns

The gamespec wants these on `assessments`:
- `ranked_eligible` ✅ does not exist yet
- `disqualified_reason` ✅ does not exist yet
- `privacy_level` ✅ does not exist yet
- `input_mode` ✅ does not exist yet

These are additive migrations. Quick to add.

### 7. `messages` already has adequate structure

The gamespec's `messages` extensions (sequence_index, source, audio_start_ms, audio_end_ms) are nice-to-haves. The existing `messages` table has: id, session_id, role, content, created_at. The sequence is implicit from `created_at` order.

For MVP, skip the messages enrichment. The canonical transcript is already queryable. Focus effort on the scoring normalization.

### 8. TTL/cache cleanup is missing

`data/tts-cache/` is not in `.gitignore`. No cleanup mechanism exists for either recordings or TTS cache. The gamespec identifies this but the build plan doesn't include it as a concrete step.

## Implementation plan adjustments

### Sprint 1 should be: Normalize existing scores into skill tables

Not "create new scoring tables" — the scores already exist in JSON columns. The work is:

1. Create `skills` table seeded from `CATEGORY_CRITERIA_MAP` categories
2. Create `attempt_skill_scores` table
3. Create `attempt_criterion_results` table
4. Create `ticket_field_scores` table
5. Add `ranked_eligible`, `disqualified_reason`, `privacy_level`, `input_mode` columns to `assessments`
6. Add `attempt_id` + `skill_id` + `criterion_id` columns to `session_events`
7. Build a post-analysis hook that reads `category_scores_json` and `raw_model_json` and inserts into the normalized tables
8. Wire this hook into the ticket submission route after `runBaseCallumAnalysis()` completes

### Sprint 2 is solid: Retry + progress loop

The retry button requires:
- A new API endpoint or adding to the existing assessment creation route to handle `attempt_mode='practice'` with `retry_count` tracking
- Frontend button on the analysis report page
- Profile progress display

### Sprint 3 needs dimension alignment

The XP system, streak tracking, and badges depend on the skill taxonomy. Until Sprint 1 normalizes the categories into DB tables, the XP system can't compute per-skill XP correctly.

**Change**: Sprint 3 depends on Sprint 1. Can't build gamification until skills are normalized.

### Sprint 4 leaderboard design is correct

Materialized `leaderboard_entries` table, percentile display, ranked-eligible flag. SQLite can handle this for MVP if `user_stats` is updated after each attempt and leaderboards are computed from the materialized table (not scanned from `xp_events`).

### Sprint 5 job posting integration is future-proof

The data model is correct. Don't build this until Sprints 1-3 are stable.

## Security gaps that need fixing

These are from `gamified-review.md` and confirmed by the audit:

| Endpoint | Issue | Fix priority |
|----------|-------|-------------|
| `GET /api/mvp/assessments/{id}` | No session check for practice attempts | High |
| `POST /api/mvp/assessments/{id}/analyse` | No session check | High |
| `GET /api/mvp/assessment/{token}/recording` | Token-based, accessible with any invite link | High |
| `POST /api/mvp/assessment/{token}/recording` | Token-based | High |
| `GET /api/candidate/attempts` | ✅ Already fixed | — |
| `GET/PUT /api/candidate/profile` | ✅ Already fixed | — |
| `GET/POST/PATCH /api/candidate/featured` | ✅ Already fixed | — |

The post-analysis hook must be server-authoritative. XP/badge events are an append-only ledger — never expose an endpoint that lets clients claim XP or badges.

## Audio storage reality check

| Concern | Status |
|---------|--------|
| WebM deleted after MP3 conversion | Not implemented — both files kept |
| Cleanup for abandoned recordings | Not implemented |
| TTL on old recordings | Not implemented |
| `data/tts-cache/` in `.gitignore` | Not present — needs adding |
| CDN / object storage | Not implemented — served through Next.js |
| ffmpeg CPU overhead per upload | Runs inline, blocks response |

**Add to Sprint 0**: Delete WebM after MP3 conversion. Add `data/tts-cache/` to `.gitignore`. Add a cleanup note to the build plan.

## Summary: Is the gamespec implementation plan good?

**Yes, with these adjustments:**

1. Align skill taxonomy with existing 6 categories (not the proposed 4)
2. Sprint 1 = normalize existing scores into DB tables, don't build new scoring
3. Don't create `attempt_events` — extend `session_events` with 3 new columns
4. Don't build gamification until skill tables exist (Sprint 3 depends on Sprint 1)
5. Add security fixes to Sprint 0 (before any user-facing features)
6. Add audio cleanup (delete WebM, gitignore TTS cache) to Sprint 0
7. The hiring pack ↔ full sim pack split is already handled — don't force `scenario_pack_versions` on hiring packs
8. `messages` enrichment is nice-to-have, not required for MVP

The gamespec's architectural direction (3-layer model, versioned packs, evented attempts, skill-tagged scoring, materialized leaderboards) is sound. The data model is good. The build order just needs small realignments with what the codebase already ships.
