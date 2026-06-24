# CX-Train — CallCallum MVP

MSP technician call-readiness assessment platform. Managers create assessment links, candidates complete simulated support calls through the web app, and the system generates AI-powered reports with evidence-based scoring.

## Foundational Layer

The architecture has three tiers that build on each other:

### 1. Data Layer — SQLite (local) → Supabase (production)

```
┌──────────────────────────────────────────────────┐
│  assessment_criteria_versions  — scoring rubrics │
│  scenarios                     — caller scripts  │
│  assessments                   — manager-created │
│  sessions                      — per-call state  │
│  messages                      — chat transcript │
│  tickets                       — candidate write │
│  assessment_results            — AI evaluation   │
│  manager_feedback              — human override  │
└──────────────────────────────────────────────────┘
```

Local SQLite (`better-sqlite3`) for zero-config development. The schema maps directly to Supabase tables for production.

### 2. AI Layer — OpenRouter free models

```
┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│  AI_CALLER   │    │  AI_EVALUATOR   │    │  AI_TICKET   │
│  model       │    │  model          │    │  model       │
│              │    │                  │    │              │
│  openrouter  │    │  openrouter     │    │  openrouter  │
│  /free       │    │  /free          │    │  /free       │
└──────┬───────┘    └────────┬────────┘    └──────┬───────┘
       │                     │                    │
       ▼                     ▼                    ▼
  Plays caller          Scores transcript    Assesses ticket
  Sarah Thompson        against 14           quality, captures
  (frustrated           checkpoints          error, hostname,
  accountant)                                 scope, impact
```

Three task-specific models, each with its own system prompt. Fallback chain retries with `AI_FALLBACK_MODEL` on 429 rate limits.

### 3. Application Layer — Next.js 14 App Router

```
app/
├── api/mvp/
│   ├── assessments           POST (create) + GET (list)
│   ├── assessment/[token]    GET (load candidate view)
│   ├── assessment/[token]/message   POST (chat with AI)
│   ├── assessment/[token]/end       POST (end call)
│   ├── assessment/[token]/ticket    POST (submit ticket)
│   ├── assessments/[id]      GET (manager detail)
│   ├── assessments/[id]/analyse     POST (run AI eval)
│   └── assessments/[id]/feedback    POST (manager review)
│
├── mvp/
│   ├── page.tsx              Manager dashboard
│   ├── assessment/[token]    Candidate chat UI
│   └── assessments/[id]      Manager detail + analysis
│
lib/
├── mvp/
│   ├── db.ts                 SQLite init + seed
│   └── query.ts              All database queries
└── ai/
    └── provider.ts           OpenRouter API + retry logic
```

## How It Works

### Full Product Loop

```
Manager                Candidate               System
─────────────────────────────────────────────────────────
  1. Create                          
     assessment ──────────────────────►  Generates invite
     Copy link                           link, stores in
                                         SQLite, seeds
     ┌─────────────────────┐             initial message
     │ Invite link sent    │
     │ to candidate        │
     └─────────┬───────────┘
               │
               ▼
                            2. Open link
                               Chat with caller ──────►  AI plays "Sarah
                               (Sarah Thompson              Thompson"
                               from Alder & Co)             frustated
                                                             accountant
                            3. End call
                               Write ticket ──────────►  Stored in DB
                            4. Done
               │
               ▼
  5. Open detail                            
     Click "Run Analysis" ──────────────►  Sends transcript
                                           + ticket to AI
                                           evaluator model
                                           Returns JSON:
                                           score, readiness,
                                           checkpoints,
                                           strengths, etc.

  6. Review score
     Add feedback ──────────────────────►  Stored in
     (agree/too_harsh/                     manager_feedback
      wrong/useful/etc.)
     Optionally override score
```

### Routes

| Path | Who | What |
|---|---|---|
| `/mvp` | Manager | Dashboard — create assessments, list all, copy invite links |
| `/mvp/assessment/:token` | Candidate | Chat UI — talk to AI caller, end call, submit ticket |
| `/mvp/assessments/:id` | Manager | Detail view — transcript, ticket, AI analysis, manager feedback |

### Scoring Model

14 checkpoints across 3 categories:

**Critical** (auto-fail): invented fix, unsafe advice
**Core** (high weight): confirmed user, asked scope, asked impact
**Supporting** (standard weight): captured hostname, clarified issue, asked deadline, asked error message, asked recent changes, set next steps, clear language, empathy

Readiness labels:
- **Ready** (80+): good first-line technician
- **Needs supervision** (60-79): margin for coaching
- **Not ready** (<60 or unsafe advice): needs more training

## Quick Start

```bash
npm install
npm run mvp:reset-db      # Creates SQLite DB with seed data
npm run test:openrouter    # Verify AI API key works
npm run test:mvp-flow      # 37 automated flow tests
npm run dev                # Start dev server
```

Open `http://localhost:3000/mvp`

### Environment Variables

Copy `.env.example` to `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000     # Used for invite links

MVP_DB_PROVIDER=sqlite
MVP_SQLITE_PATH=./data/callcallum.db

AI_PROVIDER=openrouter
AI_BASE_URL=https://openrouter.ai/api/v1
AI_API_KEY=sk-or-v1-...                       # From openrouter.ai/keys
AI_CALLER_MODEL=openrouter/free
AI_EVALUATOR_MODEL=openrouter/free
AI_TICKET_MODEL=openrouter/free
AI_REPORT_MODEL=openrouter/free
```

### Running Tests

```bash
npm run test:openrouter    # Verifies API key + free model access
npm run test:mvp-flow      # 37 integration tests (DB, create, chat, score, feedback)
npm run mvp:reset-db       # Reset to clean seed state
```

## Future Expansion Points

- **Auth**: Wire Supabase Auth or Clerk for manager sign-in — routes already scoped in middleware
- **Multi-scenario**: Manager selects from multiple caller scenarios when creating assessment
- **Multi-tenant**: Organizations, teams, role-based access
- **Voice**: STT/TTS for spoken candidate responses instead of chat
- **Custom GPT**: External GPTs can POST session results via API
- **Billing**: Track usage per assessment, per AI call
- **Analytics**: Aggregate scores across candidates, scenarios, time
- **LMS**: Training pathways, staged difficulty, boss-battle scenarios
