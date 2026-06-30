# Candidate Frontend — Build Notes

## Auth: Better Auth + SQLite

Replaced Supabase auth with Better Auth running on the same `better-sqlite3` database as the rest of the app (`data/callcallum.db`). No external auth service.

### Auth methods available
- Email + password
- Google OAuth
- GitHub OAuth
- Username sign-in (via username plugin)

### Auth files
| File | Purpose |
|------|---------|
| `lib/auth.ts` | Better Auth instance — SQLite connection, OAuth providers, username plugin, database hooks (auto-create profile on signup, link existing assessments by email) |
| `lib/auth-client.ts` | Client-side auth client — `signUp`, `signIn`, `signOut`, `useSession` |
| `app/api/auth/[...all]/route.ts` | Auth API handler (mounts Better Auth) |
| `app/sign-in/page.tsx` | Sign-in page — Google, GitHub, email/password |
| `app/sign-up/page.tsx` | Sign-up page — Google, GitHub, email |
| `middleware.ts` | Session cookie check — public routes (`/`, `/sign-in`, `/sign-up`, `/practice`, `/u/*`, `/assessment/*`, `/api/auth/*`) bypass auth |

### Env vars needed
```
BETTER_AUTH_SECRET=         # openssl rand -base64 32
BETTER_AUTH_URL=            # e.g. http://localhost:3000
GOOGLE_CLIENT_ID=           # for Google OAuth
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=           # for GitHub OAuth
GITHUB_CLIENT_SECRET=
```

### OAuth setup
For Google: create credentials at https://console.cloud.google.com/apis/credentials → OAuth 2.0 Client ID → Authorized redirect URI: `{BETTER_AUTH_URL}/api/auth/callback/google`

For GitHub: create OAuth app at https://github.com/settings/developers → Authorization callback URL: `{BETTER_AUTH_URL}/api/auth/callback/github`

## Routes

### Public (no auth required)
| Route | File | Description |
|-------|------|-------------|
| `/` | `app/page.tsx` | Landing page (existing) |
| `/sign-in` | `app/sign-in/page.tsx` | Sign in with Google, GitHub, or email |
| `/sign-up` | `app/sign-up/page.tsx` | Create account |
| `/practice` | `app/(public)/practice/page.tsx` | Scenario library — browse packs, start practice calls |
| `/u/:username` | `app/(public)/u/[username]/page.tsx` | Public shareable candidate profile (server component) |
| `/assessment/:token` | existing | Token-based invite flow (unchanged) |

### Candidate (auth required)
| Route | File | Description |
|-------|------|-------------|
| `/profile` | `app/(candidate)/profile/page.tsx` | Dashboard — stats, recent attempts, start practice |
| `/profile/attempts` | `app/(candidate)/profile/attempts/page.tsx` | Full attempt history |
| `/profile/featured` | `app/(candidate)/profile/featured/page.tsx` | Manage featured calls for public profile |
| `/profile/settings` | `app/(candidate)/profile/settings/page.tsx` | Display name, username, bio, privacy toggles |

## Candidate UX flow

```
/practice (browse scenarios)
  → "Start Call" → creates practice assessment linked to user
  → /mvp/assessment/:token (existing call UI, unchanged)
  → submit ticket → analysis runs
  → /mvp/analysis/:assessmentId (analysis report)
  → /profile (see attempt in list)

/profile
  → Stats: total calls, completed, avg score
  → Attempt list with scores, status, dates
  → Click attempt → /mvp/analysis/:assessmentId

/profile/featured
  → Toggle feature/unfeature per attempt
  → Per-call visibility: audio, transcript, feedback, ticket note
  → Visibility: public / share link only / private

/profile/settings
  → Display name, username (public slug)
  → Bio
  → Master toggles: public profile, show attempts, recordings, transcripts, feedback, ticket notes

/u/:username (public)
  → Avatar initial, display name, bio
  → Avg score, call count
  → Featured attempts with score badges
  → "Create a Challenge" CTA for hiring managers
```

## Database changes

### New tables (in existing SQLite DB)

**`candidate_profiles`**
| Column | Type | Notes |
|--------|------|-------|
| user_id | TEXT PK | References Better Auth `user.id` |
| is_public | INTEGER | Master toggle for public profile |
| show_attempts/recordings/transcripts/feedback/ticket_notes | INTEGER | Per-section visibility |
| bio | TEXT | Markdown bio |
| created_at / updated_at | TEXT | |

**`featured_attempts`**
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| candidate_user_id | TEXT FK → candidate_profiles | |
| assessment_id | TEXT FK → assessments | |
| visibility | TEXT | public / share_link / private |
| show_audio/transcript/feedback/ticket_note | INTEGER | Per-attempt visibility |
| sort_order | INTEGER | Display order |

### New columns on existing tables

**`assessments`**
- `candidate_user_id TEXT` — links attempt to user account (nullable, backward compat)
- `attempt_mode TEXT NOT NULL DEFAULT 'invited'` — `invited` | `practice` | `challenge`

### Auto-linking
When a user signs up with an email that matches existing `assessments.candidate_email`, those assessments are automatically linked via `candidate_user_id` (handled by a `databaseHooks.user.create.after` hook in `lib/auth.ts`).

## API routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/candidate/profile?userId=X` | GET | Get profile |
| `/api/candidate/profile` | PUT | Update profile fields |
| `/api/candidate/attempts?userId=X&limit=N` | GET | List attempts for user |
| `/api/candidate/featured?userId=X` | GET | List featured attempts |
| `/api/candidate/featured` | POST | Toggle attempt featured status |
| `/api/candidate/featured` | PATCH | Update per-attempt visibility settings |

## Key design decisions

1. **No separate attempts table** — the existing `assessments` table IS the attempts table. `candidate_user_id` and `attempt_mode` are additive columns.
2. **Better Auth owns the `user` table** — Better Auth creates its own `user`, `session`, `account`, `verification` tables in the same SQLite DB. Candidate profiles reference `user.id`.
3. **Default everything private** — profiles start private. Candidates must explicitly opt in to share.
4. **Same call UI** — `/mvp/assessment/:token` is unchanged. The only difference is practice attempts are linked to the user account.
5. **Style matches manager dash** — dark sidebar, Connexion CSS vars, light content area, same card/table patterns.
6. **Old Supabase auth removed** — `app/(auth)/` route group deleted. Clerk webhook still exists as dead code (not configured).

## Running

```bash
# Dev
npm run dev

# Tunnel (for OAuth testing)
cloudflared tunnel --url http://localhost:3000
# Set BETTER_AUTH_URL to the tunnel URL

# Tests
npm test   # 248 tests pass
```
