# Gamified Call Training Platform

## Reference model: HackerRank / LeetCode for support calls

| Feature | LeetCode | Our equivalent |
|---------|----------|----------------|
| Problems by difficulty | Easy / Medium / Hard | Scenarios by level (basic → expert) |
| Skill categories | Arrays, Strings, Trees, DP | Call Control, Technical, Communication, Professionalism |
| Daily challenge | One problem per day | "Call of the Day" — one random scenario |
| Contests | Weekly / Biweekly | Monthly call-off leaderboard |
| Streaks | Daily login + problem streak | Daily practice streak |
| XP / Points | Per submission, based on performance | Per call, based on analysis score |
| Levels | Global rank plus percentile | Skill level per category (1–5) |
| Badges | Contest wins, streaks, milestones | First call, perfect score, 7-day streak, etc. |
| Public profile | Stats, ranking, badges | /u/:username with featured calls, stats, badges |
| Company pages | Filter by company | Manager can view candidate's shared profile |
| Study plans | Curated problem sets | Scenario progression paths by level |
| Discussion forums | Per-problem discussions | Per-scenario tips (future) |

---

## What we already have (from previous builds)

- **4 hiring packs**: Outlook Basic, VPN Triage, Printer Down, Phishing Report — enough to launch
- **Assessment engine**: AI customer, ticket submission, deterministic scoring, narrative feedback
- **Voice + analysis pipeline**: Recording, STT, TTS, acoustic metrics, emotional trajectory
- **Candidate accounts**: Better Auth + SQLite, session management
- **Profile pages**: `/profile` dashboard, `/profile/attempts`, `/profile/featured`, `/profile/settings`
- **Public profiles**: `/u/:username` with featured attempts and manager CTA
- **Analysis report**: `/mvp/analysis/:assessmentId` with scores, transcript, audio, metrics
- **Auto-link**: Existing assessments link to user by email match on signup

---

## Data model additions

### New tables

```sql
-- Skill definitions (the 4 analysis dimensions)
CREATE TABLE skills (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,           -- e.g. "call_control", "technical"
  label       TEXT NOT NULL,           -- e.g. "Call Control"
  description TEXT,
  icon        TEXT,                    -- emoji or SVG ref
  max_level   INTEGER NOT NULL DEFAULT 5
);

-- Per-user skill progression
CREATE TABLE user_skills (
  user_id     TEXT NOT NULL REFERENCES user(id),
  skill_id    TEXT NOT NULL REFERENCES skills(id),
  level       INTEGER NOT NULL DEFAULT 1,
  xp          INTEGER NOT NULL DEFAULT 0,
  xp_to_next  INTEGER NOT NULL DEFAULT 100,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, skill_id)
);

-- XP history (immutable ledger)
CREATE TABLE xp_events (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id),
  attempt_id  TEXT REFERENCES assessments(id),
  skill_id    TEXT REFERENCES skills(id),
  amount      INTEGER NOT NULL,
  reason      TEXT NOT NULL,           -- 'call_completed', 'streak_bonus', 'perfect_score', etc.
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- User streaks
CREATE TABLE user_streaks (
  user_id          TEXT PRIMARY KEY REFERENCES user(id),
  current_streak   INTEGER NOT NULL DEFAULT 0,
  longest_streak   INTEGER NOT NULL DEFAULT 0,
  last_activity    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Badge definitions
CREATE TABLE badges (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  description      TEXT,
  icon             TEXT,               -- emoji or SVG ref
  requirement_type TEXT NOT NULL,       -- 'first_call' | 'perfect_score' | 'streak_7' | 'streak_30' | 'level_5_skill' | 'calls_10' | 'calls_50' | etc.
  requirement_value INTEGER            -- e.g. 7 for streak_7, 10 for calls_10
);

-- Earned badges
CREATE TABLE user_badges (
  user_id    TEXT NOT NULL REFERENCES user(id),
  badge_id   TEXT NOT NULL REFERENCES badges(id),
  earned_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, badge_id)
);
```

### New columns on existing tables

```sql
-- Track attempts per scenario for retry counts
ALTER TABLE assessments ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;

-- Store skill-level XP breakdown with the analysis result
ALTER TABLE assessment_results ADD COLUMN skill_xp_json TEXT;
  -- {"call_control": {"score": 7, "max": 10, "xp_earned": 35},
  --  "technical": {"score": 5, "max": 10, "xp_earned": 25},
  --  ...}
```

### Computed/stats tables (can be views or refreshed periodically)

```sql
-- Aggregate stats per user for leaderboards
CREATE TABLE user_stats (
  user_id          TEXT PRIMARY KEY REFERENCES user(id),
  total_calls      INTEGER NOT NULL DEFAULT 0,
  completed_calls  INTEGER NOT NULL DEFAULT 0,
  avg_score        REAL,
  best_score       INTEGER,
  total_xp         INTEGER NOT NULL DEFAULT 0,
  skill_count      INTEGER NOT NULL DEFAULT 0,  -- number of skills at level 2+
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## Where transcripts and recordings live

| Data | Location | Format | Access |
|------|----------|--------|--------|
| Call transcript | `messages` table per session | Rows with role + content + timestamp | Via assessment detail API |
| Canonical events | `session_events` table | Enriched timeline with timing + metadata | Via assessment detail API |
| Raw audio | `data/recordings/{token}-{id}.webm` | WebM (opus) | GET .../recording |
| MP3 playback | `data/recordings/{token}-{id}.mp3` | MP3 (64kbps) | GET .../recording?format=mp3 |
| Acoustic analysis | `assessment_results.recording_analysis_json` | JSON with talk ratio, silence, RMS, diarization | Via assessment detail API |
| OpenSMILE features | Same JSON | 88 eGeMAPS features | Via assessment detail API |
| Emotional trajectory | Same JSON | Emotional state changes | Via assessment detail API |

This is already correct. No changes needed. The candidate profile page at `/profile` pulls from `assessments` (joined with `assessment_results`, `assessment_packs`) to show attempts with scores and recording status.

---

## XP and levelling system

### XP per call

Base XP is the analysis score (0–100). Bonuses:

| Condition | Bonus XP |
|-----------|----------|
| Score >= 80 | +20 (perfect score bonus) |
| First call of the day | +10 (daily bonus) |
| Streak >= 3 | +5 |
| Streak >= 7 | +15 |
| Streak >= 30 | +50 |
| Improvement over last attempt on same scenario | +10 |
| No red flags triggered | +10 |
| All mandatory checkpoints passed | +15 |

### Skill levelling

Each of the 4 dimensions (technical, communication, callControl, professionalism) is a skill with 5 levels.

- Level 1: 0 XP (starting)
- Level 2: 100 XP
- Level 3: 300 XP
- Level 4: 600 XP
- Level 5: 1000 XP

XP per skill earned per call = `dimension_score * 5` (e.g. technical score 7/10 → 35 XP toward technical skill).

### Streaks

Tracked by calendar day. If a candidate completes any attempt on consecutive calendar days, streak increments. If a day is missed, streak resets to 0. Longest streak is tracked separately.

### Badges

| Badge | Requirement | Icon |
|-------|-------------|------|
| First Call | Complete first attempt | 🎯 |
| Perfect Score | Score 100 on a call | ⭐ |
| On a Roll | 3-day streak | 🔥 |
| Weekly Warrior | 7-day streak | 💪 |
| Iron Will | 30-day streak | 🏆 |
| Call Control Expert | Level 5 in call_control | 🎙️ |
| Technical Expert | Level 5 in technical | 🔧 |
| Communication Pro | Level 5 in communication | 💬 |
| Professional | Level 5 in professionalism | 👔 |
| All-Rounder | All 4 skills at level 3+ | 🏅 |
| Ten Calls | 10 completed attempts | 📞 |
| Fifty Calls | 50 completed attempts | 📞📞 |
| Improvement | Improve score on same scenario by 20+ points | 📈 |

---

## Leaderboards

| Board | Period | Sort |
|-------|--------|------|
| Weekly | Last 7 days | XP earned |
| Monthly | Current calendar month | XP earned |
| All-Time | All time | Total XP |
| Skill | All time | Per-skill XP |
| Streak | All time | Current streak length |

Leaderboards are computed from `xp_events` and `user_stats`. Not real-time — refresh every 5 minutes via a cron or on-demand.

---

## Priority build order

### Sprint A — XP and levelling (current sprint)

1. Create `skills`, `user_skills`, `xp_events`, `user_streaks`, `badges`, `user_badges` tables + migration
2. After analysis completes, compute XP and update user_skills, user_streaks, xp_events
3. Show XP earned on the analysis report page
4. Show skill levels on the profile page
5. Award "First Call" badge on first completed attempt

### Sprint B — Streaks and daily challenges

6. Track daily streaks, show on profile
7. "Call of the Day" — highlight one random scenario on `/practice`
8. Streak badges (3, 7, 30 days)
9. Daily login bonus XP

### Sprint C — Leaderboards

10. `user_stats` table, compute after each attempt
11. Weekly / monthly / all-time leaderboards on `/leaderboard`
12. Skill-specific leaderboards
13. Anonymous mode (candidate chooses a display handle)

### Sprint D — Retry loop and progression

14. Retry button on analysis report → new practice attempt with same pack
15. Track `retry_count` per user per pack
16. Show improvement graph on profile ("Score over time")
17. Recommended next scenario based on weakest skill
18. "Ready to share?" checklist on profile

### Sprint E — Public profile polish

19. Evidence cards with scenario, score, verdict, strengths/improvements, transcript excerpt
20. Badges display on `/u/:username`
21. Skill levels visible on public profile
22. "Invite to challenge" CTA for managers

---

## What we have now vs what we need

### Ready now
- Candidate accounts + auth
- Scenario library (`/practice`)
- Call flow + analysis end-to-end
- Analysis report with scores, transcript, audio
- Profile dashboard with attempt list
- Featured attempts + public profile skeleton
- 4 hiring scenarios

### Need to build (this sprint)
- XP and skill tracking
- Streaks
- Badges (table + first badge)
- Retry button on analysis report
- Skill display on profile

### Build next sprint
- Daily challenge
- Leaderboards
- Improvement graphs
- Public profile evidence cards
