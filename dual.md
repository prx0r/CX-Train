# Dual — Candidate Frontend Architecture

## Why not a separate repo

A separate repo/site now creates annoying duplication:

- auth duplicated
- attempts duplicated
- scenario packs duplicated
- analysis duplicated
- audio storage duplicated
- types duplicated
- permissions duplicated

Instead: **same Next.js app, route groups, shared engine.**

```
callcallum.com
├── /                  → landing page (who we are)
├── /practice          → candidate: scenario library, take calls
├── /profile           → candidate: private dashboard
├── /u/:username       → candidate: public shareable profile
├── /manager           → manager: dashboard, assessments, challenges
└── /assessment/:token → existing: unauthenticated invite flow
```

---

## Current state of the codebase (audit findings)

### Auth
- **Supabase is live** — email/password + magic link (OTP) via `supabase.auth.signInWithPassword()` and `supabase.auth.signInWithOtp()`
- **Clerk is dead code** — webhook exists at `app/api/webhooks/clerk/route.ts` but `CLERK_SECRET_KEY` is not set anywhere. The Clerk tables in `.env.example` are commented out
- Middleware (`middleware.ts`) uses Supabase SSR proxy — `/mvp`, `/api/mvp`, `/assessment`, `/voice` are all **public routes** with no auth
- `lib/auth.ts` → `getCurrentUser()` queries the Supabase user, then does a legacy lookup against `clerk_id` column

### Candidate data model
- **No candidate accounts exist.** Assessments store `candidate_name` + `candidate_email` as strings on the `assessments` table
- **No users table in SQLite** — the active MVP schema has no `users`, `candidate_profiles`, or any user identity
- **No username, bio, avatar, public profile, settings page** anywhere in the codebase
- Supabase has a legacy `users` table with `clerk_id`, `name`, `email`, `role` — but this is not connected to the MVP SQLite flow

### Database
- **SQLite** (`data/callcallum.db`) is the primary active database — all MVP assessments, sessions, messages, tickets, results
- **Supabase PostgreSQL** is a legacy parallel schema — trainee/bot/pathway system, not connected to the MVP flow
- Assessment attempts are keyed by `invite_token`, not by user ID

### Routes
- `app/mvp/` — the existing manager dashboard and candidate workspace (unauthenticated, token-based)
- `app/mvp/assessments/[id]/` — assessment detail/review (manager view)
- `app/mvp/analysis/[assessmentId]/` — candidate analysis report (created in ordio build)
- `app/mvp/assessment/[token]/` — candidate workspace (token-based, no login)
- `app/(dashboard)/` — legacy trainee/admin dashboard (Supabase auth required)
- `app/(auth)/` — Supabase sign-in/sign-up pages
- `app/assessment/[token]/` — legacy candidate assessment page

### What's already solid
- Scenario engine (sim packs + hiring packs)
- AI caller (prompted from pack persona)
- Call recording + MP3 conversion
- Acoustic analysis
- Analysis pipeline (evidence extraction → scoring → narrative)
- Assessment results display
- Supabase auth (email/password + magic link)

### What's missing (candidate side)
- Candidate auth tied to attempts
- User accounts table in SQLite
- Username/profile creation
- Scenario library page
- Attempt history
- Retry mechanism
- Featured/public attempts
- Shareable profile page
- Progress tracking

---

## Route plan

```
app/
├── page.tsx                          // Landing page (public)
├── layout.tsx                        // Root layout
├── globals.css                       // Shared styles

├── (public)/                         // Public pages, no auth
│   ├── layout.tsx
│   ├── practice/page.tsx             // Scenario library (auth optional)
│   └── u/[username]/page.tsx         // Shareable candidate profile

├── (candidate)/                      // Authenticated candidate pages
│   ├── layout.tsx                    // Candidate nav shell
│   ├── profile/page.tsx              // Private dashboard
│   ├── profile/attempts/page.tsx     // Attempt history
│   ├── profile/featured/page.tsx     // Featured calls management
│   └── profile/settings/page.tsx     // Username, display name, visibility

├── (manager)/                        // Manager pages (existing + new)
│   ├── layout.tsx
│   ├── manager/dashboard/page.tsx    // = existing app/mvp/page.tsx
│   ├── manager/assessments/page.tsx  // = existing app/mvp/assessments/
│   ├── manager/challenges/page.tsx   // New: challenge management
│   └── manager/candidates/page.tsx   // New: candidate directory

├── assessment/[token]/               // EXISTING: unauthenticated invite flow
├── voice/[token]/                    // EXISTING: voice room

├── mvp/                              // EXISTING to be migrated into (manager)/
├── mvp/assessment/[token]/           // EXISTING candidate workspace
├── mvp/analysis/[assessmentId]/      // EXISTING analysis report page
└── mvp/assessments/[id]/             // EXISTING assessment detail

└── api/                              // Shared API routes
    ├── mvp/                          // EXISTING MVP API
    ├── auth/                         // EXISTING auth
    ├── candidate/                    // NEW: candidate profile, featured, etc.
    └── webhooks/                     // EXISTING
```

**Migration note:** Rather than immediately moving existing `/mvp/` routes, the new `(candidate)/` and `(manager)/` route groups are additive. Existing `/mvp/` routes continue to work unchanged. Over time, `/mvp/manager/` content moves into `(manager)/manager/` and `/mvp/assessment/[token]` stays as the canonical candidate workspace.

---

## Data model additions

### New SQLite tables

```sql
-- Candidate user accounts (supplements Supabase auth)
CREATE TABLE candidate_users (
  id            TEXT PRIMARY KEY,
  auth_id       TEXT NOT NULL UNIQUE,    -- Supabase auth user ID
  email         TEXT NOT NULL,
  username      TEXT UNIQUE,             -- public slug, nullable until set
  display_name  TEXT,
  bio           TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Candidate profile visibility settings
CREATE TABLE candidate_profiles (
  user_id            TEXT PRIMARY KEY,
  is_public          INTEGER NOT NULL DEFAULT 0,  -- master toggle
  show_attempts      INTEGER NOT NULL DEFAULT 0,  -- show attempt list
  show_recordings    INTEGER NOT NULL DEFAULT 0,
  show_transcripts   INTEGER NOT NULL DEFAULT 0,
  show_feedback      INTEGER NOT NULL DEFAULT 0,
  show_ticket_notes  INTEGER NOT NULL DEFAULT 0,
  show_badges        INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES candidate_users(id)
);

-- Link attempts to candidate accounts
-- New column on existing `assessments` table via migration:
-- ALTER TABLE assessments ADD COLUMN candidate_user_id TEXT;
-- ALTER TABLE assessments ADD COLUMN attempt_mode  TEXT NOT NULL DEFAULT 'invited';
--   attempt_mode: 'invited' | 'practice' | 'challenge'

-- Featured attempts (candidate-curated public display)
CREATE TABLE featured_attempts (
  id                TEXT PRIMARY KEY,
  candidate_user_id TEXT NOT NULL,
  assessment_id     TEXT NOT NULL,
  visibility        TEXT NOT NULL DEFAULT 'public',  -- public | private | share_link
  show_audio        INTEGER NOT NULL DEFAULT 1,
  show_transcript   INTEGER NOT NULL DEFAULT 1,
  show_feedback     INTEGER NOT NULL DEFAULT 1,
  show_ticket_note  INTEGER NOT NULL DEFAULT 1,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (candidate_user_id) REFERENCES candidate_users(id),
  FOREIGN KEY (assessment_id) REFERENCES assessments(id)
);

-- Practice mode: self-initiated attempts (no manager invite)
-- Uses the same `assessments` table but with attempt_mode='practice'
-- and candidate_user_id set directly (no invite_token needed)
```

### Key design decisions

**Why no separate `attempts` table?** The existing `assessments` table IS the attempts table. A "practice attempt" is just an assessment with `attempt_mode='practice'` and a `candidate_user_id`. The existing `sessions`, `messages`, `tickets`, `assessment_results` chain remains identical. No schema duplication.

**Why `candidate_user_id` on assessments instead of a join table?** Every attempt already has a `candidate_name` string. Adding a nullable FK to `candidate_users` links it to an account when the candidate is signed in. Old token-based attempts remain valid with `candidate_user_id=NULL`.

**Why `featured_attempts` instead of a flag on assessments?** A separate table allows per-attempt visibility settings (show audio but hide transcript, etc.) without bloating the assessments row. It also lets the candidate curate a subset of attempts for their public profile.

---

## Auth strategy — Better Auth + SQLite (replace Supabase)

**Do not use Supabase for auth.** Use [Better Auth](https://www.better-auth.com) directly with the same `better-sqlite3` database the app already uses. Supabase auth adds an external dependency with no benefit for this use case — all data already lives in SQLite.

### Why Better Auth over Supabase

| Concern | Supabase Auth | Better Auth + SQLite |
|---------|---------------|---------------------|
| Database | Separate PostgreSQL instance | Same `better-sqlite3` as app data |
| Setup | Need Supabase project, API keys, RLS policies | `npm install better-auth`, one config file |
| Cost | Free tier, then monthly | Zero (SQLite is a file) |
| Magic link | Built-in | Plugin, uses your own email sender |
| OAuth | Supported | Supported (Google, GitHub, etc.) |
| Username | Not built-in | Plugin |
| Session mgmt | Built-in | Built-in |
| MCP support | No | Yes — `https://mcp.better-auth.com/mcp` |
| AI-assisted docs | No | Yes — `llms.txt`, skills for coding assistants |
| Data locality | Remote | Local file, full control |
| Migration | Locked into Supabase | Portable SQLite |

### Better Auth setup

```ts
// lib/auth.ts
import { betterAuth } from "better-auth";
import Database from "better-sqlite3";

export const auth = betterAuth({
  database: new Database("./data/callcallum.db"),
  emailAndPassword: { enabled: true },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // send email with nodemailer/resend/…
      },
    }),
    username(),
  ],
});
```

### Auth tables

Better Auth creates 4 tables in the existing SQLite database:

- `user` — id, name, email, emailVerified, image, createdAt, updatedAt (+ username, displayUsername from username plugin)
- `session` — id, userId, token, expiresAt, ipAddress, userAgent, createdAt, updatedAt
- `account` — id, userId, accountId, providerId, accessToken, refreshToken, scope, password (hashed), createdAt, updatedAt
- `verification` — id, identifier, value, expiresAt, createdAt

These live alongside `assessments`, `sessions`, `messages`, etc. in the same SQLite file. No external service needed.

### Auth surface

| Surface | Auth required | Mechanism |
|---------|---------------|-----------|
| `/` landing page | No | Public |
| `/practice` scenario library | Optional (browse without login, must login to attempt) | Better Auth session |
| `/assessment/:token` invite flow | No | Token-based (existing, unchanged) |
| `/profile` private dashboard | Yes | Better Auth session |
| `/u/:username` public profile | No | Public |
| `/manager/*` manager dashboard | Yes | Better Auth session (role check) |

### What to remove

1. **Supabase auth client** — `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/proxy.ts`
2. **Supabase auth pages** — `app/(auth)/sign-in/`, `app/(auth)/sign-up/`
3. **Clerk webhook** — `app/api/webhooks/clerk/`
4. **Legacy `lib/auth.ts`** — replace with Better Auth instance
5. **Supabase schema** — `supabase/schema.sql` is legacy, can archive
6. **`@supabase/ssr`, `@supabase/supabase-js`** — remove from dependencies

### What stays

- `lib/mvp/db.ts` — the SQLite connection stays, Better Auth shares it
- `middleware.ts` — swap Supabase proxy for Better Auth session check
- All existing API routes — assessments, recording, analysis unchanged

### Useful MCP tools for this project

| Tool | URL | Purpose |
|------|-----|---------|
| Better Auth MCP | `https://mcp.better-auth.com/mcp` | Auth setup, config, debugging |
| Better Auth llms.txt | `https://www.better-auth.com/llms.txt` | Complete API reference for AI assistants |
| Supabase MCP | (exists but not needed) | Would be needed if keeping Supabase |

---

## Candidate flow (end-to-end)

```
[Landing page]
  → "I'm a candidate" → /practice

[Scenario library — /practice]
  → Browse hiring packs + training packs
  → Each shows: title, difficulty, customer, description
  → Click "Start Practice" → requires auth
    → If not signed in → redirect to /sign-in
    → If signed in → create practice assessment → /mvp/assessment/:token

[Take call — /mvp/assessment/:token]  (EXISTING, unchanged)
  → Chat with AI customer
  → Submit ticket
  → Analysis runs
  → Redirect to analysis report

[Analysis report — /mvp/analysis/:id]  (NEW from ordio build)
  → Scores, strengths, improvements
  → Audio player
  → Acoustic metrics
  → Transcript
  → "Back to profile" link

[Candidate profile — /profile]
  → My attempts list (all attempts, sorted by date)
  → Each attempt: scenario, score, date, audio, transcript, feedback
  → Feature/unfeature toggle per attempt
  → Progress: attempts over time, scores trend
  → Settings: username, display name, bio, visibility toggles
  → Share profile link: /u/{username}

[Public profile — /u/:username]
  → Only shows what candidate opted into
  → Featured attempts with audio/transcript/feedback
  → Stats summary
  → "Hire me" CTA → contact info or external link
  → For managers: "Invite this candidate" → create challenge
```

---

## What to build and in what order

### Phase 1 — Candidate identity (week 1)

1. **SQLite migration**: Add `candidate_users`, `candidate_profiles`, `featured_attempts` tables, add `candidate_user_id` + `attempt_mode` columns to `assessments`
2. **`lib/candidate/auth.ts`**: `getOrCreateCandidateUser(authId, email)` — creates user row on first profile visit, links by email
3. **`app/(candidate)/` route group**: Layout shell with nav (Profile / Attempts / Settings / Sign out)
4. **`app/(candidate)/profile/settings/page.tsx`**: Username, display name, bio form
5. **`app/(candidate)/profile/page.tsx`**: Private dashboard — my attempts list, basic stats
6. **API routes**: `GET/PUT /api/candidate/profile`, `GET /api/candidate/attempts`, `POST /api/candidate/featured`

### Phase 2 — Scenario library + self-service practice (week 2)

7. **`app/(public)/practice/page.tsx`**: Scenario library — list all hiring packs + training packs with difficulty, customer, description
8. **"Start Practice" flow**: Creates a practice assessment (mode=`practice`) linked to `candidate_user_id`, redirects to `/mvp/assessment/:token`
9. **Auto-link invited attempts**: On sign-in, match `candidate_email` against `assessments.candidate_email` and link to candidate account
10. **Retry mechanism**: "Retry" button on analysis report → creates new practice assessment with same pack

### Phase 3 — Featured calls + public profile (week 3)

11. **`app/(candidate)/profile/featured/page.tsx`**: Manage featured attempts — pick which to show, toggle visibility per field
12. **`app/(public)/u/[username]/page.tsx`**: Public shareable profile — featured attempts, stats, CTA
13. **`/api/candidate/share`**: Generate share link, validate username uniqueness
14. **Default everything private** — candidate must explicitly opt in per attempt

### Phase 4 — Manager challenges + candidate directory (week 4)

15. **`app/(manager)/manager/challenges/page.tsx`**: Create challenge — pick scenario, invite candidate by email/username
16. **`challenge_submissions` table**: Link attempts to manager challenges
17. **`app/(manager)/manager/candidates/page.tsx`**: Candidate directory — browse candidates who've shared profiles
18. **CTA on `/u/:username`**: "Invite for assessment" → manager creates challenge

---

## What stays unchanged

Do not touch:

- `lib/mvp/sim/` — pack definitions, registry, AI customer, resolver
- `lib/mvp/analysis/` — scoring engine, prompts, pipeline
- `lib/mvp/audio/` — recording, analysis, diarization
- `lib/voice/` — STT/TTS providers
- `app/mvp/assessment/[token]/` — candidate workspace (the actual call UI)
- `app/api/mvp/assessment/[token]/` — assessment API endpoints
- `app/api/mvp/assessments/` — assessment CRUD
- Existing `assessments` table schema (only additive migrations)

---

## Key risks and mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing token-based invite flow | Additive only: `candidate_user_id` is nullable, old rows keep working |
| Username collisions | Unique constraint + availability check endpoint |
| Supabase auth vs SQLite user sync drift | `getOrCreateCandidateUser` is idempotent — called on every profile visit |
| Performance — many attempts per user | Index on `assessments.candidate_user_id` + pagination |
| Public profile exposes sensitive data | Default all private. Candidate explicitly opts in per attempt per field |
| Route group confusion | Keep existing `/mvp/` routes untouched during transition. New routes under `(candidate)/` and `(manager)/` don't conflict |

---

## Summary

Build the candidate frontend now. Same codebase, same backend, same database, same scenario engine. Route groups keep surfaces separate. Auth uses existing Supabase magic link. Candidate accounts are additive — no existing flows break.

The key object is the attempt. One `assessments` table with a `mode` column. The UI decides who can see what.
