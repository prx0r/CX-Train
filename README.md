# CallCallum — MSP First-Call Readiness Assessment

Manager-calibrated, evidence-backed, deterministic first-call readiness assessment for MSP technicians.

## Quick Start

```bash
npm install
npm run mvp:init-db        # Create SQLite DB with seed data
npm run dev                # Start dev server
```

Open `http://localhost:3000/mvp`

No Supabase, no Clerk, no external auth required for local MVP.

## Core Product Loop

```
Manager                      Candidate                    System
─────────────────────────────────────────────────────────────────────
1. Create assessment ──────►                               Generate invite link
                                                           (high-entropy token)
                            2. Open link
                               Chat with AI caller ──────► Store transcript
                            3. Submit ticket ────────────► Store ticket
                            4. Done

5. Run analysis ─────────────────────────────────────────► AI extracts evidence
                                                          Code computes score
                                                          Generates report
6. Review + override ───────────────────────────────────► Store manager calibration
```

### Key Design Decisions

- **AI extracts evidence only.** The backend computes the authoritative score deterministically.
- **Standards are versioned and snapshotted.** Changing standards never alters past scores.
- **Analysis runs are hashed.** Same input → same cached result.
- **Three scenario packs** seeded: Outlook Not Sending, Password Reset, Printer Not Printing.
- **Manager profiles** are local (no Supabase). Default profile created on init.

## Architecture

```
Active spine:    /mvp + SQLite + local manager profiles + invite tokens + deterministic scorer
Frozen legacy:   Supabase/training-hub/GPT Actions architecture (see docs/ACTIVE_ARCHITECTURE.md)
```

### Directory Map

```
app/
├── api/mvp/                    # Active MVP API routes
├── mvp/                        # Active MVP pages
└── ...                         # Frozen legacy routes

lib/
├── mvp/                        # Active MVP logic (db, query, analysis, context)
├── ai/                         # AI provider abstraction
├── mvp/api/                    # Response helpers, error codes, route registry
├── mvp/diagnostics/            # DB diagnostics helpers
└── mvp/context/                # Shared context loader

docs/
├── ACTIVE_ARCHITECTURE.md      # What is active vs frozen
└── AGENT_RULES.md              # Rules for building on this repo
```

### Database Tables (SQLite, 13 tables)

| Table | Purpose |
|---|---|
| `assessments` | Manager-created assessment records |
| `sessions` | Per-call state |
| `messages` | Chat transcripts |
| `tickets` | Candidate-written tickets |
| `assessment_results` | Analysis scores and evidence |
| `manager_feedback` | Manager review + calibration |
| `manager_criterion_feedback` | Criterion-level overrides |
| `scenarios` | Caller scripts and hidden facts |
| `assessment_criteria_versions` | Scoring rubrics |
| `manager_standards` | Versioned manager standards |
| `assessment_packs` | Scenario packs with rubric/red-flags |
| `analysis_runs` | Analysis execution metadata (hashed) |
| `manager_profiles` | Local manager identities |

## Routes

### Active MVP Routes

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/mvp/assessments` | Create assessment + invite |
| GET | `/api/mvp/assessments` | List assessments |
| GET | `/api/mvp/assessments/[id]` | Manager assessment detail |
| POST | `/api/mvp/assessments/[id]/analyse` | Run deterministic analysis |
| POST | `/api/mvp/assessments/[id]/feedback` | Manager review |
| GET | `/api/mvp/assessment/[token]` | Candidate load |
| POST | `/api/mvp/assessment/[token]/message` | Candidate chat |
| POST | `/api/mvp/assessment/[token]/ticket` | Candidate ticket |
| GET | `/api/mvp/standards` | Get standards |
| POST | `/api/mvp/standards` | Update standards |
| GET | `/api/mvp/debug/status` | System status (dev) |
| GET | `/api/mvp/debug/assessment/[id]` | Assessment debug (dev) |

### MVP Pages

| Path | Purpose |
|---|---|
| `/mvp` | Manager dashboard |
| `/mvp/standards` | Standards editor |
| `/mvp/assessment/[token]` | Candidate chat UI |
| `/mvp/assessments` | Assessment list |
| `/mvp/assessments/[id]` | Manager review page |
| `/mvp/system` | Developer/operator status page |

## Environment

Copy `.env.example` to `.env.local`:

```env
# Required: Local MVP
NEXT_PUBLIC_APP_URL=http://localhost:3000
MVP_DB_PROVIDER=sqlite
MVP_SQLITE_PATH=./data/callcallum.db

# AI Provider (optional — mock used if missing)
AI_PROVIDER=openrouter
AI_BASE_URL=https://openrouter.ai/api/v1
AI_API_KEY=
AI_CALLER_MODEL=openrouter/free
AI_EVALUATOR_MODEL=openrouter/free

# All Supabase/Clerk/Chutes vars are legacy/frozen — not required
```

No Supabase is required for local MVP. The app runs fully on SQLite with mock AI if no API key is set.

## Tests

```bash
npm test                     # 40 unit tests (scoring, evaluation, voice session)
npm run test:mvp-flow        # 37 integration tests against SQLite
npm run build                # Production build
```

## Frozen Legacy

The following are **not part of the active MVP spine**:

- Supabase integration and migrations
- Clerk authentication
- GPT Actions / Custom GPT integration
- Taxonomy system
- Chutes AI
- Voice evaluation
- Dashboard admin/trainee pages

See `docs/ACTIVE_ARCHITECTURE.md` for details and `docs/AGENT_RULES.md` for build rules.
