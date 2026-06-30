# Gamified Platform — Critical Review

## Where implementation will hurt

### 1. SQLite is the bottleneck

Everything lives in one `better-sqlite3` file (`data/callcallum.db`). Auth tables (`user`, `session`, `account`, `verification`) from Better Auth, all assessment data, all candidate profiles, and now all XP/skills/streaks/badges/leaderboard data.

**Problems**:
- `better-sqlite3` is single-connection, synchronous. Only one write at a time. With concurrent users submitting calls and earning XP simultaneously, writes queue up.
- Leaderboard queries (`SELECT SUM(xp) FROM xp_events GROUP BY user_id ORDER BY SUM(xp) DESC`) scan the entire xp_events table — expensive as it grows.
- WAL mode helps reads during writes, but does not fix the single-writer bottleneck.

**Mitigations**:
- Keep leaderboard computation in a periodic background task (every 5 min), not inline with the HTTP response.
- Pre-aggregate into `user_stats` after each attempt so leaderboards read one row per user.
- Accept SQLite limits for MVP. Plan for Postgres or Turso migration if traffic grows.

### 2. XP computation must be synchronous and server-authoritative

XP is computed from the analysis result. The analysis pipeline (`runBaseCallumAnalysis`) already runs synchronously after ticket submission. Adding XP calculation there is natural:

```
submit ticket → runBaseCallumAnalysis → store result → compute XP → update user_skills → update streaks → check badges → respond
```

**Risk**: If any step fails (e.g. badge insert throws), the whole request fails and the user sees an error. Need defensive wrappers around each post-analysis step — non-fatal failures should log but not break the response.

**Badge checking is O(n) per attempt**: Every completed call must check all badge requirements against current state. This is fast for 10 badges, but needs to be designed as a series of simple queries, not a loop over all users.

### 3. Audio file storage has no lifecycle management

**Current state**:
```
data/recordings/{token}-{id}.webm   ← 1-5MB per call
data/recordings/{token}-{id}.mp3    ← 0.5-2MB per call
TTS cache: data/tts-cache/          ← grows unbounded
```

**Scaling**:

| Users | Calls/user | Total recordings | Storage |
|-------|-----------|-----------------|---------|
| 10 | 5 | 100 | ~500MB |
| 100 | 20 | 4,000 | ~20GB |
| 1,000 | 50 | 100,000 | ~500GB |

**Problems**:
- No cleanup for incomplete/abandoned calls (recorder started but no analysis completed)
- No TTL on old recordings
- No CDN — all audio served directly from the Next.js server via the recording API route
- ffmpeg conversion runs on every upload — CPU-bound and slows the response
- The `GET /recording` route reads the file into memory and streams it — not designed for concurrent serving

**Short-term fixes**:
- Delete the WebM after MP3 conversion (keep only MP3 for playback, saves ~60% space)
- Add a cleanup script that deletes recordings older than 90 days
- Serve MP3 files via nginx/X-Accel-Redirect instead of streaming through Node

**Production fix**: Move to Cloudflare R2 or S3 with signed URLs. The recording API route uploads to R2, returns a signed playback URL. No local file storage.

### 4. No background job system

Everything runs inline in the HTTP response. XP updates, streak checks, badge awards, leaderboard recomputation — all must complete before the user sees the response.

**For MVP this is fine** — these are fast SQLite operations (milliseconds).
**At scale** — need a job queue (Bull, RabbitMQ, or just a PostgreSQL LISTEN/NOTIFY) to offload post-analysis processing.

### 5. Recording access is token-based, not user-owned

The `GET /api/mvp/assessment/{token}/recording` endpoint uses the invite token, not the authenticated user. If candidate A shares their invite link, anyone with that link can access the recording.

**Fix**: Add session verification. If the assessment has a `candidate_user_id`, verify the authenticated user matches. Token-only access should still work for the old manager-invite flow (where candidates have no account).

---

## Security concerns

### Endpoints that need ownership checks

| Endpoint | Current state | Fix |
|----------|---------------|-----|
| `GET /api/mvp/assessments/{id}` | No auth check | If `candidate_user_id` is set, verify session user matches |
| `POST /api/mvp/assessments/{id}/analyse` | No auth check | Same |
| `GET /api/mvp/assessment/{token}/recording` | Token-based | If `candidate_user_id` set, verify session matches; else allow token |
| `POST /api/mvp/assessment/{token}/recording` | Token-based | Same |
| `GET /api/candidate/attempts` | ✅ Fixed | Session check added |
| `GET/PUT /api/candidate/profile` | ✅ Fixed | Session check added |
| `GET/POST/PATCH /api/candidate/featured` | ✅ Fixed | Session check added |

### XP/badge integrity

XP events are a financial ledger — append-only, never mutated or deleted (except for admin corrections). The `xp_events` table should have a CHECK constraint that `amount > 0` and `reason` is from a known enum list.

Badge checks must be server-authoritative. A badge is earned when the server detects the requirement is met during the post-analysis phase. No client can request a badge.

### Public profile data leakage

The public profile at `/u/:username` checks `candidate_profiles.is_public` before returning any data. Each field check (`show_attempts`, `show_recordings`, etc.) must be enforced at the API level, not trusted from the client.

The current server component implementation (`app/(public)/u/[username]/page.tsx`) already does this correctly via `getPublicProfile()`.

---

## Incentive structure — what do they actually get?

### The problem with badges and streaks

If badges and streaks don't lead to anything real, they're vanity metrics. Users ignore them after the first few days. LeetCode badges matter because they correlate with interview performance. Our badges need to correlate with something employers value.

### What candidates actually want

1. **A job** — The primary motivation. Everything else is secondary.
2. **Proof of skill** — "I can handle support calls" is hard to prove on a resume. A verified profile with actual call recordings and scores is proof.
3. **Improvement visibility** — "I started at 45 and now score 85" is more impressive to a manager than a static score.
4. **Manager attention** — Being noticed by hiring managers without applying through traditional channels.

### What managers actually want

1. **Readiness evidence** — "Can this person handle a real call on day one?"
2. **Comparison** — "How does this candidate compare to others?"
3. **Skill gaps** — "They're good at technical but weak at communication"
4. **Consistency** — "One good call or a trend?"

### Incentive alignment

| Feature | Candidate value | Manager value |
|---------|----------------|---------------|
| Score per call | "I'm improving" | "They scored 85 on a real scenario" |
| Skill levels | "I'm expert in call control" | "They're level 4/5 in 3 of 4 skills" |
| Streaks | "I'm consistent" | "They practised daily for 30 days" |
| Improvement graph | "Look how far I've come" | "Trend is up — they learn" |
| Badges | "I earned this" | Low value (vanity) |
| Leaderboards | "I'm top 10%" | "They're in the top percentile" |
| Featured attempts | Curated best work | "Here's their best call" |
| Call recordings | Proof of real skill | Can evaluate actual call handling |

### What actually drives hiring

The strongest signal to a manager is not a badge count. It's:

1. **Score trajectory**: "Started 45 → now 85 over 12 calls" → proves learnability
2. **Skill breakdown**: "Technical: 9/10, Communication: 6/10" → targeted hiring
3. **Call recording**: Hear the actual call → proves it's not gaming the system
4. **Consistency**: "Last 5 calls all scored 80+ → reliable
5. **Peer comparison**: "Top 15% of candidates" → competitive signal

### Redesigned incentive loop

```
Practice → Score improves → Skill levels go up
  → Profile looks better → Share with manager
  → Manager hears recording → Sees trajectory
  → Compares to other candidates → Invites for assessment
  → Job offer
```

The gamification reinforces this loop. Streaks keep candidates coming back. Badges are milestones. But the core product is **skill evidence that hiring managers trust**.

### What streaks unlock (not just vanity)

Streaks should unlock **real access**, not just icons:

| Streak | Unlocks |
|--------|---------|
| 3 days | "Trending" badge on profile |
| 7 days | Profile marked "Active — recent practice" |
| 14 days | Access to harder scenarios (if gated) |
| 30 days | "Consistent" badge + priority in manager search |
| 60 days | "Dedicated" badge + early access to new scenarios |

Similarly, skill levels should unlock scenario difficulty:

| Avg skill level | Unlocks |
|----------------|---------|
| 1 | Basic scenarios (Outlook Basic) |
| 2 | Intermediate (VPN Triage) |
| 3 | Advanced (Printer Down) |
| 4 | Expert (Phishing, custom) |
| 5 | "Manager Challenge" ready — flagged as interview-ready |

This gives candidates a reason to level up beyond vanity: **new content and manager visibility**.

---

## Summary of what to change in the build plan

| Item | Change |
|------|--------|
| Streak bonuses | Unlock content/visibility, not just XP |
| Skill levels | Gate harder scenarios by skill level |
| Leaderboards | Show percentile, not just rank ("Top 15%") |
| Recording storage | Add cleanup script, plan for R2 migration |
| XP integrity | Append-only ledger, server-authoritative |
| API ownership | Audit remaining unprotected endpoints |
| Post-analysis pipeline | Wrap each step in try/catch so one failure doesn't lose the analysis |
| SQLite limits | Pre-aggregate into user_stats, plan for Postgres/Turso |
