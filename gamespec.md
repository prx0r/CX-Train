# GameSpec — LeetCode for IT Support Calls

## Product vision

LeetCode/HackerRank for IT support desk hiring. Candidates practice realistic support calls, get scored on a skill taxonomy, track improvement over time, share evidence with hiring managers, and compete on leaderboards. Managers use the candidate evidence pool to find and verify ready-to-hire talent.

### Feature mapping

| LeetCode / HackerRank | CallCallum equivalent |
|----------------------|----------------------|
| Problem | Support-call scenario pack |
| Tags (array, string, tree) | Skills (Outlook, AD, M365, urgency, escalation, ticketing) |
| Submission | Attempt |
| Code execution result | Call/ticket analysis result |
| Test cases | Hidden facts + expected diagnostic path |
| Runtime/memory metrics | Call duration, time-to-impact, missed facts, ticket quality |
| Leaderboard | Best score per scenario/skill/difficulty |
| Company questions | Skills found in live MSP job postings |
| Profile | Public candidate evidence page |
| Contest | Weekly support-call challenge |

---

## Architecture principles

### Three-layer data model

```
┌──────────────────────────────────────────────┐
│ Product / Gamification Layer                 │
│ XP, badges, streaks, leaderboard rows,        │
│ featured attempts, public settings, challenges │
│ Recomputable, user-facing                     │
├──────────────────────────────────────────────┤
│ Derived Scoring / Analytics Layer             │
│ Scores, skill scores, criterion results,       │
│ percentiles, benchmarks, trends               │
│ Recalculable when rubrics change              │
├──────────────────────────────────────────────┤
│ Immutable Raw Attempt Layer                   │
│ Transcripts, events, audio, ticket,           │
│ pack version, timestamps, actions             │
│ Never overwritten — source of truth           │
└──────────────────────────────────────────────┘
```

1. **Immutable raw layer** — Never overwrite. Stores user, pack version, transcript, audio path, events, ticket notes, actions, timestamps, result. Enables re-scoring old attempts when rubrics improve.
2. **Derived scoring layer** — Recalculable. Overall score, category scores, skill scores, missed criteria, pass/fail gates, time-to-discovery, transcript metrics, ticket quality, coaching summary, benchmark percentile.
3. **Product/gamification layer** — What users see. XP, badges, streaks, leaderboard rows, featured attempts, public profile settings, challenge history, skill path progress.

### Big design rules

- **Versioned** — old attempts stay fair when packs/rubrics change
- **Evented** — every meaningful action is analyzable later
- **Skill-tagged** — everything maps to a skill taxonomy for progress, leaderboards, job matching

---

## Sim-pack controlled modes

Every scenario pack declares its mode. The system renders the appropriate UI based on the pack, not the other way around.

### Modes a pack can declare

| Mode | Description | UI surface | Assessment mode |
|------|-------------|------------|-----------------|
| `call_only` | Voice/text call with AI customer, no tools | Call panel + ticket form | `chat_call` |
| `call_plus_remote` | Call + remote desktop tools (Outlook, browser, CMD) | Full simulator shell | `dashboard_sim` |
| `ticket_only` | No call, just triage a ticket | Ticket panel only | `chat_call` |
| `voicemail_plus_ticket` | Voicemail message, then ticket | Voicemail player + ticket form | `chat_call` |

The pack's `mode` field (already in `SimPack` and `SimPackDraft`) drives the `assessment_mode` and the workspace renderer. The current mapping in `create.ts` of `training_drill → dashboard_sim` and `hiring_exam → chat_call` is a simplification — the pack should declare this directly.

### Existing pack modes

| Pack | Current mode |
|------|-------------|
| Hiring packs (all 4) | `call_only` (via `templateId`) |
| Outlook Work Offline | `call_plus_remote` |
| Password Reset | `call_only` |
| New Starter Triage | `call_only` |
| Shared Mailbox | `call_only` |

### What this enables

- A manager can create a "voice-only assessment" by picking a `call_only` pack
- A manager can create a "full sim assessment" by picking a `call_plus_remote` pack
- The candidate UI adapts automatically — no separate code path
- Future modes (`voicemail_plus_ticket`) work with no architectural changes

### Implementation

In `createMvpAssessment()`, the pack's mode determines `assessment_mode`:

```ts
const assessmentMode = pack.mode === 'call_plus_remote' ? 'dashboard_sim' : 'chat_call';
```

The frontend (`SimulationWorkspace`) already switches between `<HiringWorkspace>` and `<ServiceDeskSimulatorShell>` based on mode. No major refactor needed — just make the mode selection pack-driven instead of assignment-type-driven.

---

## Manager pathway tracks

Pathway tracks are ordered sequences of scenarios that managers create for candidates. This replaces the single-invite-token flow with a structured progression.

### The problem this solves

Current flow: manager creates one assessment → sends invite link → candidate takes one call → done.

Problem: no multi-call progression, no progress tracking across scenarios, no way for managers to define a curriculum.

### Pathway flow

```
Manager creates pathway
  → Names it ("Helpdesk Apprentice Track")
  → Adds 3-6 scenarios in order (Outlook Basic → VPN → Printer)
  → Sets passing thresholds per scenario
  → Shares invite link or email

Candidate opens link
  → Sees pathway overview ("6 scenarios, ~45 minutes")
  → Starts scenario 1
  → Completes call → gets score → passes or fails
  → If score >= threshold: unlocks scenario 2
  → If score < threshold: can retry (manager-configurable)
  → After final scenario: completion summary
  → Results visible to candidate + manager

Manager views
  → All candidates on this pathway
  → Each candidate's current step + scores
  → Pass/fail per scenario
  → Overall pathway score
  → Exportable report
```

### Data model

```sql
-- A pathway track created by a manager
CREATE TABLE pathway_tracks (
  id              TEXT PRIMARY KEY,
  manager_id      TEXT NOT NULL,       -- references user id with manager role
  title           TEXT NOT NULL,
  description     TEXT,
  difficulty      TEXT,
  max_retries     INTEGER NOT NULL DEFAULT 2,  -- per-scenario retry limit
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ordered scenarios within a track
CREATE TABLE pathway_scenarios (
  id              TEXT PRIMARY KEY,
  track_id        TEXT NOT NULL REFERENCES pathway_tracks(id) ON DELETE CASCADE,
  pack_id         TEXT NOT NULL,       -- assessment_pack_id or hiring pack id
  sequence_order  INTEGER NOT NULL,
  pass_threshold  REAL NOT NULL DEFAULT 60,  -- minimum score to pass
  required        INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Candidate enrollment in a track
CREATE TABLE pathway_enrollments (
  id              TEXT PRIMARY KEY,
  track_id        TEXT NOT NULL REFERENCES pathway_tracks(id),
  candidate_id    TEXT NOT NULL REFERENCES user(id),
  status          TEXT NOT NULL DEFAULT 'invited',
    -- invited | active | completed | withdrawn
  current_step    INTEGER NOT NULL DEFAULT 0,    -- 0-indexed, next scenario to attempt
  invited_at      TEXT,
  started_at      TEXT,
  completed_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Link attempts to pathway
ALTER TABLE assessments ADD COLUMN pathway_enrollment_id TEXT;
ALTER TABLE assessments ADD COLUMN pathway_scenario_id TEXT;
```

### How it works with existing attempts

Existing `assessments` table IS the attempt table. Pathway attempts get:

```
attempt_mode = 'pathway'
pathway_enrollment_id → tracks enrollment progress
pathway_scenario_id   → links to the specific scenario in the track
```

The analysis pipeline is unchanged. After analysis completes, the pathway enrollments are updated:
- If score >= pass_threshold: `current_step += 1`, if last scenario: status = `completed`
- If score < pass_threshold: increment retry count, if exceeded: scenario marked failed

### Manager views

**Pathway detail page** (`/manager/pathways/:id`):
- Scenario list with pass thresholds
- Enrolled candidates table: name, current step, scores per completed scenario, status
- Invite more candidates (by email or username)

**Candidate progress page** (`/manager/candidates/:id/pathways`):
- All pathways this candidate is enrolled in
- Per-pathway: progress bar, scores, completion status

### Candidate views

**Pathway landing** (`/pathway/:enrollmentId`):
- Pathway title and description
- Scenario list with: completed (score), current (active), locked (grey)
- Overall progress

**After completing a scenario**: candidate sees their score and whether they passed. If passed, next scenario unlocks. If failed and retries remain, they can retry.

### When to build

Build this after Sprint 2 (retry + progress loop) but before Sprint 4 (ranked leaderboards). Pathways are the manager-facing counterpart to the candidate practice loop.

The data model is additive — no existing tables change. Existing single-invite assessments continue to work unchanged.

A canonical skill graph turns raw attempts into meaningful analytics.

### `skills` table

```sql
CREATE TABLE skills (
  id             TEXT PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  category       TEXT NOT NULL,        -- technical | process | communication
  parent_skill_id TEXT REFERENCES skills(id),
  description    TEXT,
  aliases_json   TEXT,                 -- ["outlook", "exchange", "email client"]
  vendor         TEXT,                 -- microsoft, cisco, etc.
  tool           TEXT,                 -- outlook, teams, ninjaone
  difficulty_band TEXT,               -- beginner | intermediate | advanced
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Initial skill tree

```
technical/
├── microsoft-365
│   ├── outlook-desktop
│   ├── exchange-online
│   ├── teams
│   └── sharepoint-online
├── active-directory
│   ├── password-reset
│   ├── account-lockout
│   ├── group-membership
│   └── mfa
├── endpoint-management
│   ├── intune
│   ├── windows-10-11
│   └── software-installation
├── networking
│   ├── vpn
│   └── wifi-troubleshooting
├── printer-troubleshooting
└── security
    ├── phishing-identification
    └── suspicious-activity

process/
├── impact-discovery
├── scope-discovery
├── urgency-triage
├── escalation-judgement
├── ticket-documentation
├── next-step-setting
└── fix-verification

communication/
├── empathy
├── call-control
├── plain-english
├── de-escalation
├── confidence
└── active-listening
```

### `pack_skills` — map packs to skills

```sql
CREATE TABLE pack_skills (
  pack_version_id TEXT NOT NULL,
  skill_id        TEXT NOT NULL REFERENCES skills(id),
  weight          REAL NOT NULL DEFAULT 1.0,
  required_level  INTEGER,            -- skill level needed to attempt this pack
  is_primary      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (pack_version_id, skill_id)
);
```

This enables: skill-level scoring, skill paths, leaderboards per skill, recommendations ("you're weak in active-directory, try these packs"), and job-posting mapping.

---

## Data model — all tables

### Attempt layer (immutable)

```sql
-- Versioned scenario packs
ALTER TABLE assessment_packs ADD COLUMN slug TEXT;
ALTER TABLE assessment_packs ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1;
ALTER TABLE assessment_packs ADD COLUMN is_ranked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE assessment_packs ADD COLUMN estimated_minutes INTEGER;

CREATE TABLE scenario_pack_versions (
  id            TEXT PRIMARY KEY,
  pack_id       TEXT NOT NULL REFERENCES assessment_packs(id),
  version_number INTEGER NOT NULL,
  customer_persona_json    TEXT NOT NULL,
  hidden_facts_json        TEXT NOT NULL,
  initial_message          TEXT NOT NULL,
  caller_behaviour_prompt  TEXT NOT NULL,
  expected_behaviours_json TEXT NOT NULL,
  diagnostic_path_json     TEXT,
  required_ticket_fields_json TEXT NOT NULL,
  red_flags_json           TEXT NOT NULL,
  rubric_json              TEXT NOT NULL,
  scoring_config_json      TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Extended assessment fields for ranked/gamified mode
ALTER TABLE assessments ADD COLUMN ranked_eligible INTEGER NOT NULL DEFAULT 0;
ALTER TABLE assessments ADD COLUMN disqualified_reason TEXT;
ALTER TABLE assessments ADD COLUMN privacy_level TEXT NOT NULL DEFAULT 'private';
ALTER TABLE assessments ADD COLUMN input_mode TEXT NOT NULL DEFAULT 'text';
  -- text | voice | mixed

-- Enriched messages for transcript analysis
ALTER TABLE messages ADD COLUMN sequence_index INTEGER;
ALTER TABLE messages ADD COLUMN source TEXT;
ALTER TABLE messages ADD COLUMN audio_start_ms INTEGER;
ALTER TABLE messages ADD COLUMN audio_end_ms INTEGER;
ALTER TABLE messages ADD COLUMN tokens_count INTEGER;

-- Canonical attempt events (extends session_events)
CREATE TABLE attempt_events (
  id              TEXT PRIMARY KEY,
  attempt_id      TEXT NOT NULL REFERENCES assessments(id),
  session_id      TEXT REFERENCES sessions(id),
  sequence_index  INTEGER NOT NULL,
  event_type      TEXT NOT NULL,
    -- message | tool_action | ticket_edit | triage_change | note_edit | submit
  actor           TEXT NOT NULL,
    -- candidate | caller | system
  text            TEXT,
  tool_id         TEXT,
  action_id       TEXT,
  label           TEXT,
  skill_id        TEXT REFERENCES skills(id),
  criterion_id    TEXT,
  state_before_json TEXT,
  state_after_json  TEXT,
  payload_json    TEXT,
  started_at_ms   INTEGER,
  ended_at_ms     INTEGER,
  duration_ms     INTEGER,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Scoring layer (derived, recalculable)

```sql
-- Normalized skill scores per attempt
CREATE TABLE attempt_skill_scores (
  attempt_id       TEXT NOT NULL REFERENCES assessments(id),
  skill_id         TEXT NOT NULL REFERENCES skills(id),
  raw_score        REAL NOT NULL,
  normalized_score REAL NOT NULL,
  max_score        REAL NOT NULL,
  evidence_count   INTEGER NOT NULL DEFAULT 0,
  missed_count     INTEGER NOT NULL DEFAULT 0,
  percentile       REAL,
  PRIMARY KEY (attempt_id, skill_id)
);

-- Normalized criterion results per attempt
CREATE TABLE attempt_criterion_results (
  attempt_id    TEXT NOT NULL REFERENCES assessments(id),
  criterion_id  TEXT NOT NULL,
  skill_id      TEXT REFERENCES skills(id),
  status        TEXT NOT NULL,
    -- pass | partial | fail | not_applicable
  score         REAL NOT NULL,
  max_score     REAL NOT NULL,
  evidence_event_ids_json  TEXT,
  evidence_message_ids_json TEXT,
  explanation   TEXT,
  PRIMARY KEY (attempt_id, criterion_id)
);

-- Ticket quality scores
CREATE TABLE ticket_field_scores (
  attempt_id       TEXT NOT NULL REFERENCES assessments(id),
  field_name       TEXT NOT NULL,
  expected_value   TEXT,
  submitted_value  TEXT,
  score            REAL NOT NULL,
  status           TEXT NOT NULL,
  explanation      TEXT,
  PRIMARY KEY (attempt_id, field_name)
);
```

### Gamification layer (product-facing)

```sql
-- Skill progression per user
CREATE TABLE user_skills (
  user_id    TEXT NOT NULL REFERENCES user(id),
  skill_id   TEXT NOT NULL REFERENCES skills(id),
  level      INTEGER NOT NULL DEFAULT 1,
  xp         INTEGER NOT NULL DEFAULT 0,
  xp_to_next INTEGER NOT NULL DEFAULT 100,
  best_score REAL,
  attempts_count INTEGER NOT NULL DEFAULT 0,
  trend_7d   REAL,                    -- avg score change last 7 days
  trend_30d  REAL,                    -- avg score change last 30 days
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, skill_id)
);

-- XP ledger (append-only, never mutated)
CREATE TABLE xp_events (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES user(id),
  attempt_id TEXT REFERENCES assessments(id),
  skill_id   TEXT REFERENCES skills(id),
  amount     INTEGER NOT NULL CHECK(amount > 0),
  reason     TEXT NOT NULL,
    -- completed_attempt | improved_score | first_pass | streak_bonus
    -- | perfect_score | daily_bonus | skill_mastery
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Streaks
CREATE TABLE user_streaks (
  user_id         TEXT PRIMARY KEY REFERENCES user(id),
  current_streak  INTEGER NOT NULL DEFAULT 0,
  longest_streak  INTEGER NOT NULL DEFAULT 0,
  last_activity   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE daily_activity (
  user_id            TEXT NOT NULL REFERENCES user(id),
  date               TEXT NOT NULL,
  attempts_completed INTEGER NOT NULL DEFAULT 0,
  xp_earned          INTEGER NOT NULL DEFAULT 0,
  streak_count       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

-- Badges
CREATE TABLE badges (
  id               TEXT PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  description      TEXT,
  icon             TEXT,
  criteria_json    TEXT NOT NULL
    -- {"type": "streak", "value": 7} | {"type": "skill_level", "skill": "call-control", "level": 5}
    -- | {"type": "first_call"} | {"type": "perfect_score"}
    -- | {"type": "calls_completed", "value": 10}
);

CREATE TABLE user_badges (
  user_id    TEXT NOT NULL REFERENCES user(id),
  badge_id   TEXT NOT NULL REFERENCES badges(id),
  awarded_at TEXT NOT NULL DEFAULT (datetime('now')),
  source_attempt_id TEXT REFERENCES assessments(id),
  PRIMARY KEY (user_id, badge_id)
);
```

### Leaderboard entries (materialized)

```sql
CREATE TABLE leaderboard_entries (
  id               TEXT PRIMARY KEY,
  leaderboard_scope TEXT NOT NULL,
    -- pack | skill | weekly_challenge | global
  scope_id         TEXT,              -- pack_id, skill_id, challenge_id
  difficulty       TEXT,
  input_mode       TEXT,
  candidate_user_id TEXT NOT NULL REFERENCES user(id),
  attempt_id       TEXT NOT NULL REFERENCES assessments(id),
  score            REAL NOT NULL,
  duration_ms      INTEGER,
  tie_breaker_score REAL,
  rank_snapshot    INTEGER,
  achieved_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_lb_scope ON leaderboard_entries(leaderboard_scope, scope_id, score DESC);
```

Rules: one best ranked entry per user per scope. Practice attempts don't count. Retakes can improve the user's best. Tie-breakers: score → fewer critical misses → shorter duration → earlier achieved.

### Aggregate stats

```sql
CREATE TABLE user_stats (
  user_id         TEXT PRIMARY KEY REFERENCES user(id),
  total_calls     INTEGER NOT NULL DEFAULT 0,
  completed_calls INTEGER NOT NULL DEFAULT 0,
  avg_score       REAL,
  best_score      INTEGER,
  total_xp        INTEGER NOT NULL DEFAULT 0,
  total_duration_ms INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## Where data lives

| Data | MVP location | Production location |
|------|-------------|-------------------|
| Auth + profiles | SQLite `user`, `candidate_profiles` | SQLite/Postgres |
| Packs + skills | SQLite `assessment_packs`, `skills` | SQLite/Postgres |
| Attempts | SQLite `assessments` | Postgres |
| Transcripts | SQLite `messages` | Postgres |
| Events | SQLite `session_events`, `attempt_events` | Postgres |
| Skills/scores | SQLite `attempt_skill_scores`, `attempt_criterion_results` | Postgres |
| Gamification | SQLite `xp_events`, `user_streaks`, `badges` | Postgres |
| Leaderboards | SQLite `leaderboard_entries` | Postgres or Redis sorted sets |
| Raw audio | `data/recordings/{id}.webm` | Cloudflare R2 / S3 |
| MP3 playback | `data/recordings/{id}.mp3` | Cloudflare R2 + signed URLs |
| Diarization JSON | `data/recordings/{id}.json` (future) | R2 |
| TTS cache | `data/tts-cache/` | R2 or discardable |

**Do not put audio blobs in SQLite/Postgres.** Store paths/URLs/hashes.

---

## Attempt lifecycle

```
1. Candidate starts practice
   → Assessment created with attempt_mode='practice'
   → ranked_eligible=false by default

2. Candidate completes call + submits ticket
   → POST /api/mvp/assessment/{token}/ticket
   → Status → 'submitted'

3. Analysis pipeline runs
   → runBaseCallumAnalysis()
   → Stores raw_model_json, overall_score, readiness_label
   → Status → 'completed'

4. Post-analysis processing (new)
   → Explode into attempt_skill_scores
   → Explode into attempt_criterion_results
   → Compute XP, update user_skills
   → Update user_streaks (daily)
   → Check + award badges
   → Update user_stats aggregates
   → If ranked_eligible: upsert leaderboard_entries
   → All non-fatal: log errors but don't fail the response
```

---

## XP and levelling

### XP per call

Base XP = analysis score (0–100). Bonuses:

| Condition | Bonus XP |
|-----------|----------|
| Score >= 80 | +20 |
| First call of the day | +10 |
| Streak >= 3 | +5 |
| Streak >= 7 | +15 |
| Streak >= 30 | +50 |
| Improved over last attempt on same pack | +10 |
| No red flags | +10 |
| All mandatory checkpoints passed | +15 |

XP per skill = `dimension_score * 5` (e.g. technical 7/10 → 35 XP toward technical skill).

### Skill levels

| Level | XP required |
|-------|------------|
| 1 | 0 (start) |
| 2 | 100 |
| 3 | 300 |
| 4 | 600 |
| 5 | 1,000 |

Skill levels gate scenario access:

| Avg skill level | Unlocks |
|----------------|---------|
| 1 | Basic scenarios (Outlook Basic) |
| 2 | Intermediate (VPN Triage) |
| 3 | Advanced (Printer Down) |
| 4 | Expert (Phishing, custom) |
| 5 | "Manager Challenge" ready flag |

### Streaks

Calendar-day based. Completing any attempt on consecutive days increments. Missed day resets to 0. Longest streak tracked separately.

Streaks unlock visibility, not just icons:

| Streak | Unlocks |
|--------|---------|
| 3 days | "Trending" marker on profile |
| 7 days | Profile marked "Active — recent practice" |
| 14 days | Access to next difficulty tier |
| 30 days | Priority visibility in manager search |
| 60 days | Early access to new scenarios |

### Badges

| Badge | Requirement |
|-------|------------|
| First Call | Complete first attempt |
| Perfect Score | Score 100 |
| On a Roll | 3-day streak |
| Weekly Warrior | 7-day streak |
| Iron Will | 30-day streak |
| Skill Expert (per skill) | Level 5 in any skill |
| All-Rounder | All skills at level 3+ |
| Ten Calls | 10 completed |
| Fifty Calls | 50 completed |
| Improvement | +20 points on same scenario |

---

## Leaderboard design

### Scopes

| Board | Period | Sort |
|-------|--------|------|
| Weekly | Last 7 days | XP earned |
| Monthly | Current month | XP earned |
| All-Time | All time | Total XP |
| Per-skill | All time | Skill XP |
| Streak | All time | Streak length |
| Pack-specific | All time | Best score on pack |

### Materialization

Leaderboards are **materialized**, not computed live. Refresh every 5 minutes via cron or after each ranked attempt.

Only `ranked_eligible = true` attempts count. Practice attempts are excluded.

Display as percentile ("Top 15%") rather than raw rank to avoid discouragement.

### Tie-breaking

1. Higher score wins
2. Fewer critical misses
3. Shorter call duration
4. Earlier submission

---

## Job posting integration (future, design for it now)

### The moat

The real moat is not audio quality. It's a **support-call behaviour dataset**.

"Across 1,284 apprentice-level Outlook attempts, 71% of candidates failed to ask whether webmail worked, but candidates who did ask scored 18 points higher."

### Data model

```sql
CREATE TABLE job_postings (
  id               TEXT PRIMARY KEY,
  source           TEXT,              -- linkedin, indeed, direct
  source_url       TEXT,
  company_name     TEXT,
  title            TEXT,
  location         TEXT,
  remote_type      TEXT,
  seniority        TEXT,
  raw_text         TEXT,
  normalized_text_hash TEXT,
  posted_at        TEXT,
  collected_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE job_posting_skills (
  job_posting_id TEXT NOT NULL REFERENCES job_postings(id),
  skill_id       TEXT NOT NULL REFERENCES skills(id),
  mention_text   TEXT,
  confidence     REAL,
  skill_type     TEXT,                -- hard | soft | tool | process | certification
  importance     TEXT,                -- required | preferred | mentioned
  PRIMARY KEY (job_posting_id, skill_id)
);
```

### Workflow

1. User pastes or uploads a job posting
2. LLM extracts hard skills, tools, soft skills, duties
3. Normalized into skill taxonomy
4. Detects common clusters across postings
5. Generates practice paths: "This role mentions AD, M365, MFA, ticketing — here are 6 calls to practise"

### Analytics facts

```sql
CREATE TABLE analytics_facts (
  id          TEXT PRIMARY KEY,
  fact_type   TEXT NOT NULL,
    -- criterion_failure_rate | skill_gap | hidden_fact_miss_rate | manager_preference
  entity_type TEXT NOT NULL,
    -- pack | skill | role | manager | global
  entity_id   TEXT,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  sample_size INTEGER NOT NULL,
  filters_json TEXT,
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Examples:
- `criterion_failure_rate` / pack / outlook-not-sending / `missed_webmail_check_rate` / 0.71 / n=842
- `skill_gap` / skill / active-directory / `average_beginner_score` / 48 / n=391

Computed nightly or on-demand. These become marketing, product intelligence, and manager-facing proof.

---

## Analytics queries to design for

### Candidate insight
- What is this candidate good/bad at?
- Are they improving?
- Are they ready for a real helpdesk call?
- Can they write a ticket?
- Do they ask before guessing?

### Pack insight
- Which scenario is too easy/hard?
- Where do candidates fail?
- Which hidden fact is most often missed?
- Does the pack distinguish strong vs weak candidates?

### Skill insight
- Which skills are most demanded in jobs?
- Which skills are candidates weakest at?
- Which skills predict manager approval?
- Which packs should we build next?

### Manager insight
- What do managers actually care about?
- Which criteria do managers override?
- Which candidate scores correlate with manager interest?
- Which public profiles get challenge invites?

### Market insight
- What skills appear in MSP job ads?
- Which tools cluster together?
- What should an apprentice learn first?

---

## What we have now vs what to build

### Ready now
- Candidate auth + profiles
- Scenario library with 4 packs
- Call flow + analysis end-to-end
- Analysis report with scores, transcript, audio, metrics
- Profile dashboard with attempt list
- Featured attempts + public profile skeleton
- Token-based invite flow (unchanged)

### Sprint 1 — Normalize skills and results
1. Create `skills` table + seed initial skill tree
2. Create `pack_skills` table, map existing packs to skills
3. Create `attempt_skill_scores`, `attempt_criterion_results` tables
4. After analysis, explode results into normalized tables
5. Show skill breakdown on analysis report
6. Show skill levels on `/profile`

### Sprint 2 — Retry + progress loop
7. Retry button on analysis report → new practice attempt with same pack
8. Track improvement on profile ("Attempt 1: 42 → Attempt 2: 61 → Attempt 3: 78")
9. "Biggest improvement" and "Still weak" highlights
10. Recommended next scenario based on weakest skill

### Sprint 3 — Gamification (XP, streaks, badges)
11. XP computation in post-analysis pipeline
12. `user_skills` level progression
13. Streak tracking
14. First set of badges (First Call, Perfect Score, Streak badges)
15. Show XP/badges/streaks on profile and public profile
16. Streaks unlock content tiers

### Sprint 4 — Ranked mode + leaderboards
17. `ranked_eligible` flag — only ranked attempts count
18. `leaderboard_entries` materialized table
19. Weekly/monthly/all-time leaderboard page
20. Per-skill leaderboards
21. Percentile display ("Top 15%")

### Sprint 5 — Job posting integration + analytics
22. Job posting paste/upload UI
23. LLM skill extraction
24. Skill-to-pack recommendation
25. `analytics_facts` computation
26. Manager-facing candidate comparison

---

## Critical constraints

- **SQLite is the bottleneck**: Single-writer, no concurrent writes. Mitigate by pre-aggregating into `user_stats`. Plan for Postgres/Turso migration.
- **Audio storage**: ~500GB at 1,000 users × 50 calls. Delete WebM after MP3 conversion. Cleanup script for abandoned recordings. Plan R2 migration.
- **No background jobs**: Everything runs inline. For MVP, XP/badge operations take milliseconds. For scale, add a job queue.
- **API ownership**: All candidate endpoints must verify session user === target user. Recording endpoints need ownership check when `candidate_user_id` is set.
- **XP/badge integrity**: `xp_events` is append-only, never mutated. Badge checks are server-authoritative.
