# Build Plan — CallCallum MVP to Platform

## Current state

### What's built and working
- Better Auth + SQLite (email/password, Google/GitHub OAuth ready)
- Candidate sign-in/sign-up, profile dashboard, settings, public profile
- Scenario library (`/practice`) with 4 packs
- Call flow with AI customer → ticket → analysis end-to-end
- Analysis report with scores, transcript, audio player, acoustic metrics
- Featured attempts, public profile with manager CTA
- Pack-mode-driven rendering (assessment_mode from pack.mode)
- Skills → competencies reframe + context tags
- 14 competencies seeded, 10 context tags seeded
- Post-analysis normalization into `attempt_competency_scores` + `attempt_criterion_results`
- 248 tests, all passing

### Privately 365-leaning context tags

Publicly vendor-neutral, but the scenario packs lean Microsoft 365 because it's the dominant MSP environment. The 10 context tags map to:

| Tag | 365 flavour | Typical pack |
|-----|-------------|-------------|
| account-access | Azure AD / Entra ID password sync, MFA prompt | Password reset pack |
| email | Exchange Online, Outlook desktop, webmail | Outlook not sending pack |
| printer | Universal Print, network printer queue | Printer down pack |
| vpn | Always On VPN, tunnel disconnect | VPN triage pack |
| app-software | M365 Apps, Teams, OneDrive sync | App issue pack |
| network-wifi | Wi-Fi profile, LAN connectivity | Network pack |
| device-hardware | Windows device, peripheral, slow PC | Hardware pack |
| security-phishing | Defender, phishing report, suspicious login | Phishing pack |
| file-access | SharePoint, OneDrive, shared drive | File access pack |
| new-starter | Entra ID account, M365 license, device setup | New starter pack |

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Route Groups                             │
│  (public)/    (candidate)/    (manager)/     /mvp/          │
│  /practice    /profile        /manager/*     /assessment/   │
│  /u/:user     /settings       /challenges    /analysis/     │
│  /sign-in     /attempts       /candidates                  │
│  /sign-up     /featured                                     │
├─────────────────────────────────────────────────────────────┤
│                    Shared Engine                             │
│  Sim packs → AI customer → Call → Ticket → Analysis         │
│  Competencies · Context tags · Event log · Scoring          │
├─────────────────────────────────────────────────────────────┤
│                    Data Layer (SQLite → Postgres)            │
│  attempts  events  transcripts  audio  results  skills      │
│  leaderboards  streaks  badges  profiles  settings          │
└─────────────────────────────────────────────────────────────┘
```

---

## Wire-up: Sim packs → Competencies → Context tags

### Current pack mapping

Every existing pack needs `pack_competencies` and `pack_context_tags` entries. This is a one-time seed.

```
hiring-outlook-basic
  competencies: call-control, impact-discovery, scope-discovery,
                evidence-gathering, ticket-documentation, next-step-setting
  context_tags: email, account-access

hiring-vpn-triage
  competencies: call-control, impact-discovery, evidence-gathering,
                hypothesis-testing, escalation-quality, ticket-documentation
  context_tags: vpn, network-wifi

hiring-printer-down
  competencies: customer-empathy, call-control, evidence-gathering,
                hypothesis-testing, escalation-quality, ticket-documentation
  context_tags: printer, device-hardware

hiring-email-phishing
  competencies: call-control, evidence-gathering, escalation-quality,
                ticket-documentation, next-step-setting
  context_tags: security-phishing, email
```

### How the mapping is used

1. **Candidate dashboard** — "Your weakest skill is impact-discovery. Try the Outlook scenario."
2. **Analysis report** — "Competency breakdown: Call Control 82%, Impact Discovery 60%..."
3. **Leaderboards** — Per-competency ranking: "Top 10% in Evidence Gathering"
4. **Job posting matching** — Paste a job ad → extract required competencies → recommend packs
5. **Manager challenge creation** — "Create a challenge focusing on Escalation Quality"

### Where the mapping lives

`lib/mvp/analysis/normalize-scores.ts` already maps criteria → competencies via `CRITERION_COMPETENCY_MAP`. The `pack_competencies` table stores the pack → competency mapping. A seed script should populate it for existing packs.

---

## Callum LangGraph integration (future)

The Callum LangGraph system (`lib/mvp/langgraph/`) is a state machine for the AI assistant that helps managers customize assessments. Currently it handles:

- Conversation memory (`lib/mvp/callum/memory.ts`)
- Proposals (`lib/mvp/callum/proposals.ts`)
- Manager profile (`lib/mvp/callum/manager-profile.ts`)

### How it connects

```
Manager says: "Create a challenge focusing on escalation quality"
  → Callum interprets intent
  → Maps to competency: escalation-quality
  → Finds packs with escalation-quality as primary competency
  → Proposes: "I'd recommend the Phishing pack — it tests escalation quality best"
  → Manager confirms
  → Callum creates pathway_track with selected packs
```

### Avoiding duplication

The LangGraph system must NOT duplicate:
- Pack definitions (already in `lib/mvp/sim/`)
- Competency definitions (already in `competencies` table)
- Analysis pipeline (already in `lib/mvp/analysis/`)
- Event logging (already in `session_events`)

It should ONLY add:
- Conversation state machines
- Proposal generation (for packs, challenges, criteria overrides)
- Manager-Callum interaction threads
- Natural language → structured action translation

Add these to `lib/mvp/callum/` — that directory already exists and already houses `memory.ts`, `proposals.ts`, `manager-profile.ts`. Keep all LangGraph logic there.

---

## Potential pain points

### 1. SQLite write contention

**Problem**: Single `better-sqlite3` connection. Every ticket submission triggers: message insert → ticket insert → analysis run → competency score inserts → criterion result inserts → XP update → streak update → badge check. All on one connection.

**Mitigation**: Pre-aggregate `user_stats` (updated after each attempt) so leaderboard reads are O(1) per user. XP/badge writes are fast single-row inserts. If contention becomes measurable, batch post-analysis writes in a transaction.

**Monitor**: Track p99 latency of ticket submission endpoint. If >3s at <50 concurrent users, start planning Postgres migration.

### 2. Audio storage without CDN

**Problem**: Every call generates a WebM + MP3 stored on local disk. Served through Next.js. No CDN. No cleanup.

**Mitigation**: Delete WebM after MP3 conversion (saves ~60% space). Add a weekly cleanup script for recordings >90 days old. For production, move to Cloudflare R2 with signed URLs.

**Breakpoint**: At ~500GB total recordings, local disk becomes impractical. That's roughly 100 users × 50 calls each.

### 3. Analysis pipeline timeout

**Problem**: `runBaseCallumAnalysis()` calls an external LLM API. It runs synchronously in the ticket submission request. If the LLM is slow or errors, the user waits.

**Mitigation**: Add a 30s timeout wrapper around the LLM call. If it times out, return "analysis pending" status and run asynchronously in the background. For now, the synchronous model is fine for MVP.

### 4. Competency → criterion mapping drift

**Problem**: `CRITERION_COMPETENCY_MAP` in `normalize-scores.ts` is hardcoded. If criteria change in `criteriaRegistry.ts`, the mapping goes out of sync.

**Mitigation**: Add a unit test that validates every criterion in `CATEGORY_CRITERIA_MAP` has at least one competency mapping. Run in CI.

### 5. Pack → competency mapping is manual

**Problem**: `pack_competencies` must be seeded manually for each pack. Adding a new pack requires updating the seed data.

**Mitigation**: Create a `suggestCompetenciesForPack(pack)` function that analyzes the pack's criteria, hidden facts, and description to auto-suggest competency mappings. Store suggestions in a JSON column; let the pack author confirm.

### 6. Manager challenge customization scope

**Problem**: Managers will want to customize scenarios (change the customer name, the issue, the hidden facts). If we expose too many knobs, the sim pack system becomes fragile.

**Rule**: Managers can customize:
- Pathway track order and pass thresholds
- Which packs to include
- Candidate messaging (invite email, track description)
- Competency weights for scoring

They cannot customize:
- The pack's customer persona, hidden facts, or diagnostic path
- The analysis criteria or scoring rubric
- The AI customer behaviour prompt

Custom packs belong in the pack authoring workflow (Callum proposes, manager approves), not in a form builder.

---

## Testing strategy

### Unit tests (existing + new)

| Test file | Coverage |
|-----------|----------|
| `tests/assessment-scoring.test.ts` | Scoring engine, criteria, thresholds |
| `tests/pack-factory.test.ts` | Pack validation, registry, fail gates |
| `tests/voice-session.test.ts` | Voice session CRUD, STT/TTS mocks |
| `tests/analysis-engine.test.ts` | Analysis pipeline |
| `tests/audio-analysis.test.ts` | Audio analysis pipeline |
| `tests/callum-contracts.test.ts` | Contract validation |
| `tests/competency-mapping.test.ts` | **NEW**: Every criterion maps to ≥1 competency |

### Integration tests

| Scenario | What it validates |
|----------|------------------|
| Sign up → practice → submit ticket → see analysis | Full candidate loop |
| Create assessment → invite → complete → review | Manager invite flow |
| Record call → hear playback on report | Audio pipeline |
| Profile shows attempts after completion | Data persistence |
| Public profile shows featured attempts | Visibility controls |
| Normalize scores after analysis → query competency tables | Post-analysis hook |

### Manual test flow

```
1. Open /sign-in → click Dev Login
2. Lands on /profile → sees empty dashboard
3. Click "Start Practice" → /practice
4. Pick any scenario → click "Start Call"
5. Complete call → submit ticket
6. Redirected to /mvp/analysis/:id
7. See: scenario info, audio player, assessment overview, competency breakdown, transcript
8. Go back to /profile → attempt appears in list
9. Click attempt → sees same analysis report
10. Go to /profile/featured → feature the attempt
11. Visit /u/devuser → sees featured attempt
```

---

## Codebase organization rules

### Directory structure

```
app/
  (public)/                    # Public routes (no auth)
    practice/
    u/[username]/
  (candidate)/                 # Auth-required candidate routes
    profile/
  (manager)/                   # Auth-required manager routes (future)
    manager/
  api/
    auth/                      # Better Auth handler
    candidate/                 # Candidate profile/attempts/featured
    mvp/                       # Existing MVP API (assessment, voice, etc.)
  mvp/                         # Existing MVP pages (unchanged)
  sign-in/                     # Auth pages
  sign-up/

components/
  shared/                      # Reusable: Logo, ScoreBadge, etc.
  mvp/                         # MVP-specific components
    analysis/                  # Analysis report components
    results/                   # Assessment results display
    voice/                     # Voice recording/playback
    workspace/                 # Simulation workspace
    itsm/                      # Manager ITSM sidebar
    callum/                    # Callum AI assistant UI

lib/
  auth.ts                      # Better Auth instance
  auth-client.ts               # Better Auth client
  mvp/
    analysis/                  # Scoring engine, prompts, normalizers
    audio/                     # Recording, diarization, analysis
    sim/                       # Pack definitions, registry, AI customer
    callum/                    # LangGraph state machine, proposals
    db.ts                      # SQLite connection + schema + migrations
    query.ts                   # Database queries
    events/                    # Event logging
    candidate/                 # Candidate profile queries (future → lib/candidate/)
  voice/                       # STT/TTS providers
  candidate/                   # Candidate profile logic

data/
  recordings/                  # Audio files (gitignored)
  tts-cache/                   # TTS cache (gitignored)
  callcallum.db                # SQLite database (gitignored)

tests/                         # All test files
```

### Duplication prevention rules

1. **One source of truth per concept**: Packs live in `lib/mvp/sim/`. Competencies live in the DB. Events live in `session_events`. Don't mirror these in other directories.

2. **API routes are thin**: They validate input, call a lib function, return JSON. Business logic never lives in route handlers.

3. **Components are presentational**: They receive props, render UI. Data fetching happens in pages or hooks.

4. **Types stay close to their domain**: `SimPack` type in `lib/mvp/sim/types.ts`. Competency types in `lib/mvp/analysis/normalize-scores.ts`. Don't centralize all types in one file.

5. **Callum LangGraph is isolated**: All LLM state machine logic in `lib/mvp/callum/`. It reads from (but never writes directly to) the sim pack and competency systems. It writes proposals, threads, and manager settings.

---

## Next concrete actions

### Immediate (this session)
- [x] Competency + context tag tables created
- [x] Post-analysis normalization hook wired in
- [x] Pack-mode rendering fixed
- [ ] Seed `pack_competencies` and `pack_context_tags` for all 4 hiring packs
- [ ] Show competency breakdown on analysis report page
- [ ] Show competency levels on profile page

### Sprint 2 — Retry + progress
- [ ] Retry button on analysis report → new practice attempt with same pack
- [ ] Track improvement on profile ("Attempt 1: 42 → Attempt 2: 61")
- [ ] Recommended next scenario based on weakest competency

### Sprint 3 — Gamification light
- [ ] XP computation in post-analysis hook
- [ ] Streak tracking (calendar-day based)
- [ ] First badge (First Call, Perfect Score)

### Sprint 4 — Ranked mode
- [ ] `ranked_eligible` flag on attempts
- [ ] Materialized leaderboard entries
- [ ] Weekly challenge leaderboard

### Future — Manager customization via Callum
- [ ] Callum proposes packs based on competency focus
- [ ] Manager confirms → pathway track created
- [ ] Callum suggests competency weight adjustments
- [ ] Manager reviews candidate results via Callum thread
