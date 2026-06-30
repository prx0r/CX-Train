# Candidate Frontend — Build Notes

## Product direction

Candidate training platform first → candidates share proof with hiring managers → managers onboard through challenges/assessments once there is usage evidence.

This is stronger than cold-selling managers a hiring tool with no usage proof.

### Current product loop

```
/practice → pick scenario → sign up → complete simulated call
→ submit ticket → get AI analysis report → retry to improve
→ feature best attempt → share /u/username with hiring manager
→ manager clicks "Create a Challenge"
```

The repo already has four hiring packs (Outlook, VPN, Printer, Suspicious Email) — enough for a candidate practice MVP.

---

## Auth: Better Auth + SQLite

Replaced Supabase auth with Better Auth running on the same `better-sqlite3` database as the rest of the app (`data/callcallum.db`). No external auth service.

### Auth methods available
- Email + password
- Google OAuth (needs credentials configured)
- GitHub OAuth (needs credentials configured)
- Username sign-in
- Dev login button on `/sign-in` (auto-creates session, works on any tunnel URL)

### Auth files
| File | Purpose |
|------|---------|
| `lib/auth.ts` | Better Auth instance — SQLite, OAuth, username plugin, auto-create profile on signup, auto-link assessments by email |
| `lib/auth-client.ts` | Client-side auth client |
| `app/api/auth/[...all]/route.ts` | Auth API handler |
| `app/sign-in/page.tsx` | Sign-in with Google, GitHub, email, dev login |
| `app/sign-up/page.tsx` | Create account |
| `middleware.ts` | Session cookie check — public routes bypass auth |

### Env vars
```
BETTER_AUTH_SECRET=         # openssl rand -base64 32
GOOGLE_CLIENT_ID=           # for Google OAuth
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

---

## Routes

### Public (no auth required)
| Route | Description |
|-------|-------------|
| `/` | Landing page — candidate-first CTA |
| `/sign-in` | Sign in |
| `/sign-up` | Create account |
| `/practice` | Scenario library — browse packs, start practice calls |
| `/u/:username` | Public shareable candidate profile |
| `/assessment/:token` | Token-based invite flow (unchanged) |

### Candidate (auth required)
| Route | Description |
|-------|-------------|
| `/profile` | Dashboard — stats, attempts, progress |
| `/profile/attempts` | Full attempt history |
| `/profile/featured` | Manage featured calls for public profile |
| `/profile/settings` | Display name, username, bio, privacy toggles |

### Manager (existing)
| Route | Description |
|-------|-------------|
| `/mvp` | Manager dashboard |
| `/mvp/assessments` | Assessment list and review |
| `/mvp/assessment/:token` | Candidate workspace (call UI) |
| `/mvp/analysis/:assessmentId` | Analysis report |

---

## Database

### New tables (in existing SQLite `data/callcallum.db`)

**`user`** — Better Auth user table (auto-created). Columns: id, name, email, emailVerified, image, username, displayUsername, bio, createdAt, updatedAt.

**`candidate_profiles`** — user_id (PK), is_public, show_attempts/recordings/transcripts/feedback/ticket_notes, bio, created_at, updated_at.

**`featured_attempts`** — id (PK), candidate_user_id (FK), assessment_id (FK), visibility (public/share_link/private), show_audio/transcript/feedback/ticket_note, sort_order, created_at.

### New columns on `assessments`
- `candidate_user_id TEXT` — links attempt to user (nullable for backward compat)
- `attempt_mode TEXT NOT NULL DEFAULT 'invited'` — `invited` | `practice` | `challenge`

When a user signs up with an email matching existing `assessments.candidate_email`, those assessments are auto-linked via `databaseHooks` in `lib/auth.ts`.

The existing `assessments` table IS the attempts table. No separate attempts table needed.

---

## API routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/candidate/profile` | GET/PUT | Profile read/update |
| `/api/candidate/attempts` | GET | List attempts (requires userId) |
| `/api/candidate/featured` | GET/POST/PATCH | Featured attempt CRUD |

---

## Key design decisions

1. **No separate attempts table** — `assessments` IS the attempts table, with `candidate_user_id` and `attempt_mode`.
2. **Better Auth owns `user` table** — created in the same SQLite DB alongside app tables.
3. **Default everything private** — profiles start private, opt-in to share.
4. **Same call UI** — `/mvp/assessment/:token` unchanged. Practice attempts just link to user.
5. **Style matches manager dash** — dark sidebar, Saira Condensed font, light content area.
6. **Logo is SVG `currentColor`** — adapts to any background. File at `components/shared/Logo.tsx`.

---

## Priority queue — next sprint

### 1. Candidate-first landing page
Update `/` to message: "Practice real MSP support calls. Get scored. Share your best call with hiring managers."
Primary CTA: "Start Practising" → `/practice`. Secondary: "I'm a Hiring Manager" → `/mvp`.

### 2. Retry loop from analysis report
The `mvp/analysis/:assessmentId` page needs:
- "Retry same scenario" button → creates new practice attempt with same pack
- "Try easier/harder scenario" → link to `/practice`
- "Feature this attempt" → toggle featured status
- "Back to practice library"

### 3. Profile progress page
Beyond total/completed/avg, show: best score, improvement over attempts, weakest skill, recommended next scenario, retry count.

### 4. API ownership checks
`/api/candidate/*` routes need server-side verification: current session user ID must match requested userId. The middleware protects routes but doesn't do object-level auth.

### 5. Public profile evidence cards
Each featured attempt on `/u/:username` should show: scenario name, score, verdict, short strengths/improvements, transcript excerpt, ticket note excerpt, recording (if opted in), "Invite to challenge" CTA.

### 6. Supersede dual.md
`dual.md` was the plan. `candidate.md` is the implementation. Add header: "Superseded by candidate.md as of candidate auth implementation."

---

## Known gaps

- **API ownership**: Candidate routes accept userId from query/body but don't verify against session — fixed in next sprint item #4.
- **Chunk load errors**: Stale `.next` cache after rebuilds — clear with `rm -rf .next && npm run dev`.
- **Google/GitHub OAuth**: Needs credentials configured and tunnel URL registered in OAuth provider.
- **No email sending**: Magic link and email verification not yet configured.
- **Tunnel URL changes each restart**: update OAuth redirect URIs if using social login.

---

## Running

```bash
npm run dev           # dev server on :3000
npm test              # 248 tests pass
```

### Cloudflare tunnel

```bash
# Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install/
npm run dev
cloudflared tunnel --url http://localhost:3000
# → https://random-words.trycloudflare.com
```

The dev login button on `/sign-in` works on any tunnel URL without config.

---

## Logo

SVG "CC" mark in Saira Condensed at `components/shared/Logo.tsx`. Uses `currentColor` — white on dark, dark on light. Original `cclogo.png` at `/cclogo.png`.
