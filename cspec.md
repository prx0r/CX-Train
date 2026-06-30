# CSpec — CallCallum Codebase Specification

## Current implementation status

### Already exists (MVP substrate)
- `assessments` — core attempt table with `candidate_user_id`, `attempt_mode`, `pack_snapshot_json`
- `sessions` — per-attempt chat sessions
- `messages` — transcript rows with role + content
- `tickets` — candidate ticket submissions
- `assessment_results` — analysis output: scores, labels, raw_model_json, recording path
- `assessment_packs` — pack definitions with rubric, sim config, snapshots
- `analysis_runs` — execution tracking per analysis
- `session_events` — canonical event log (messages, tool actions, edits)
- `sim_events` — simulation-specific events
- `candidate_profiles` — public profile toggles, bio
- `featured_attempts` — candidate-curated public attempts
- Pack-modes rendering — assessment_mode derived from pack.mode
- 4 hiring packs — Outlook, VPN, Printer, Phishing

### Next to implement (Sprint 1 — competency normalization)
- `competencies` — 14 workflow competencies (call-control, impact-discovery, etc.)
- `context_tags` — 10 scenario context tags (email, vpn, account-access, etc.)
- `pack_competencies` — maps packs to competencies
- `pack_context_tags` — maps packs to context tags
- `attempt_competency_scores` — per-attempt per-competency scores
- `attempt_criterion_results` — per-attempt per-criterion evidence
- `normalizeAnalysisScores()` — post-analysis hook to populate the above
- Competency mapping CI test — every criterion maps to ≥1 competency

### Future (Sprint 2+)
- XP/streaks/badges
- Leaderboards (materialized, ranked mode)
- Retry/progress loop on profile
- Manager pathway tracks
- Job posting → skill path matching
- Callum LangGraph manager assistant
- Analysis background jobs (`analysis_jobs` table)
- Audio lifecycle (delete WebM after MP3, R2 migration)

---

## System philosophy

CallCallum is a **gamified support-call simulator** where candidates practise live IT support workflows: speaking to customers, gathering evidence, writing tickets, triaging priority, and escalating clearly. Scenarios lean Microsoft 365 (the dominant MSP environment) but are described with vendor-neutral competency tags.

The platform scores **support workflow competence**, not tool mastery. No fake Intune certifications. The moat is a **behavioural dataset** — knowing what candidates actually do under call pressure, not what vendor tools they claim to know.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        ROUTE GROUPS                              │
│  (public)/       (candidate)/      (manager)/       /mvp/        │
│  /practice       /profile          /manager/*       /assessment/ │
│  /u/:user        /settings         /challenges      /analysis/   │
│  /sign-in        /attempts         /candidates                   │
│  /sign-up        /featured                                       │
├──────────────────────────────────────────────────────────────────┤
│                      SHARED ENGINE                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │Sim Packs │→ │AI Cust. │→ │Analysis  │→ │Competency Scores │ │
│  │(lib/mvp/ │  │(lib/mvp/ │  │(lib/mvp/ │  │(normalize-scores)│ │
│  │ sim/)    │  │ sim/)    │  │analysis/)│  │                  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
│                                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ Callum   │  │ Events   │  │ Audio    │  │ Voice STT/TTS    │ │
│  │ LangGraph│  │(session_ │  │(record/  │  │(lib/voice/)      │ │
│  │(future)  │  │ events)  │  │ analyze) │  │                  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
├──────────────────────────────────────────────────────────────────┤
│                         DATA LAYER                               │
│  SQLite (→ Postgres)           Object Storage (→ R2)             │
│  assessments  sessions         recordings/*.webm                 │
│  messages     tickets          recordings/*.mp3                  │
│  events       results          tts-cache/*                       │
│  competencies context_tags                                        │
│  pack_comp    pack_context                                        │
│  attempt_comp_scores  attempt_criterion_results                   │
│  leaderboards  streaks  badges  xp_events                        │
│  profiles  featured  settings                                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## Layer responsibilities

### Sim packs (`lib/mvp/sim/`)

**What**: Scenario definitions. Each pack defines customer persona, hidden facts, diagnostic path, scoring criteria, mode (call_only, call_plus_remote, etc.), and AI customer behaviour prompt.

**Why**: This is the content layer. Packs are the "problems" in the LeetCode analogy. They are authored in code (TypeScript) with validation. Immutable snapshots (`pack_snapshot_json`) are stored on each attempt so old attempts remain scorable when packs change.

**Connections**: Packs feed the AI customer with persona context. Packs declare their mode which drives the UI renderer. Packs are mapped to competencies and context tags via `pack_competencies` and `pack_context_tags`.

**Modularity**: Adding a new pack means: define it in `lib/mvp/sim/packs/`, register in `packRegistry.ts`, seed `pack_competencies` + `pack_context_tags`. No other code changes needed.

### AI customer (`lib/mvp/sim/aiCustomer.ts`)

**What**: LLM prompt that roleplays the customer. Uses the pack's persona, hidden facts, and behaviour rules.

**Why**: Replaces hardcoded decision trees with an LLM that responds naturally. The prompt restricts the LLM from revealing hidden facts or suggesting the fix.

**Connections**: Reads from the current pack snapshot. Writes to `messages` and `session_events`.

### Analysis pipeline (`lib/mvp/analysis/`)

**What**: Three-stage pipeline: AI evidence extraction → deterministic scoring → AI narrative feedback. Produces `StructuredOutput` with criteria statuses, scores, red flags, strengths, improvements, coaching.

**Why**: The scoring is deterministic (binary per criterion) so it's fair and auditable. The AI layers add nuance without affecting the score.

**Connections**: Reads pack scoring config. Writes to `assessment_results`. Post-analysis hook (`normalize-scores.ts`) explodes results into `attempt_competency_scores` + `attempt_criterion_results`.

### Competency system (`competencies` + `attempt_competency_scores`)

**What**: 14 support workflow competencies (call-control, customer-empathy, impact-discovery, etc.) scored per attempt. Context tags describe the scenario's technical dressing.

**Why**: Separates "what the candidate did" (call handling behaviours) from "what the scenario was about" (Outlook, VPN, etc.). This prevents overclaiming tool expertise and makes the data more honest and portable.

**Modularity**: New competencies are a DB insert. New context tags are a DB insert. The `CRITERION_COMPETENCY_MAP` in `normalize-scores.ts` maps analysis criteria to competencies — this is the only file that needs updating when adding a new competency.

### Event log (`session_events`)

**What**: Immutable append-only log of every meaningful action during an attempt: messages, tool actions, ticket edits, note updates, submits.

**Why**: This is the raw behavioural data. Every future analytic query (hidden fact elicitation rate, diagnostic path analysis, communication patterns) reads from here.

**Connections**: Written to by the assessment flow, sim actions, voice pipeline. Read by the analysis pipeline (for evidence), the timeline builder, and future analytics jobs.

### Callum LangGraph (`lib/mvp/callum/`) — future

**What**: LLM state machine for the AI assistant that helps managers customize assessments, create challenges, and review candidates.

**Why**: Managers need natural-language interaction, not form builders. The LangGraph state machine handles multi-turn conversations, proposal generation, and structured action execution.

**Connections**: Reads from (never writes to): packs, competencies, analysis results. Writes to: `callum_threads`, `callum_messages`, `callum_proposals`, and (via structured actions) `pathway_tracks`.

**Modularity rule**: Callum is a reader of all core systems. It never duplicates pack definitions, competency data, or analysis logic. It adds conversation state and proposal generation on top.

---

## Pain points and mechanisms

### Pain point 1: SQLite write contention

**Problem**: Single `better-sqlite3` connection. Ticket submission triggers ~10 writes (message, ticket, status update, analysis result, competency scores, criterion results, XP, streak, badge check, user stats). All sequential on one connection.

**Mechanism**: Pre-aggregate into `user_stats` so leaderboard reads are O(1). Batch post-analysis writes in a `WAL` transaction. Post-analysis hooks are wrapped in try/catch so a failure doesn't lose the analysis result itself.

**Justification**: SQLite is the right choice for MVP because zero infrastructure, zero latency, trivial backup. The write volume at MVP scale (<100 concurrent users, <500 writes/second) is well within SQLite's capability in WAL mode. The pre-aggregation is permanent — even after Postgres migration, `user_stats` avoids expensive GROUP BY queries.

**Moat link**: The `user_stats` table becomes the foundation for leaderboards, percentile rankings, and manager search — all moat features.

### Pain point 2: Audio storage without CDN

**Problem**: WebM + MP3 per call on local disk. Served through Next.js. No cleanup.

**Mechanism**: Delete WebM after MP3 conversion (frees ~60% space). Weekly cron deletes recordings >90 days old. Production path: upload to Cloudflare R2 on completion, serve via signed URLs, never store on application server.

**Justification**: Local disk is fine for first 100 users. The cleanup script prevents unbounded growth. R2 costs ~$0.015/GB/month — storing 500GB of candidate recordings costs ~$7.50/month.

**Moat link**: Recordings are the strongest hiring signal. A manager can hear the actual call. That's the proof the product sells.

### Pain point 3: Analysis pipeline timeout

**Problem**: `runBaseCallumAnalysis()` calls external LLM API synchronously. If the LLM is slow (5-30s), the user waits.

**Mechanism**: 30s timeout wrapper. On timeout, return `status: 'analysis_pending'` and queue a background retry via an `analysis_jobs` table:

```sql
CREATE TABLE analysis_jobs (
  id              TEXT PRIMARY KEY,
  assessment_id   TEXT NOT NULL REFERENCES assessments(id),
  session_id      TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
    -- pending | running | completed | failed
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 3,
  last_error      TEXT,
  run_after       TEXT,              -- for retry backoff
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

A simple polling endpoint (`GET /api/mvp/analysis/{id}/status`) lets the analysis report page check progress. A periodic worker (cron or serverless function) picks up pending jobs and retries.

**Justification**: Synchronous analysis is simpler and gives immediate feedback (the best UX). Background fallback only triggers on timeout or error. The `analysis_jobs` table is minimal — it doesn't duplicate the analysis itself, just tracks execution state.

### Pain point 4: Competency → criterion mapping drift

**Problem**: `CRITERION_COMPETENCY_MAP` in `normalize-scores.ts` is hardcoded. If analysis criteria change in `criteriaRegistry.ts`, mappings go out of sync silently. Each criterion may map to multiple competencies (asked_scope → scope_discovery + evidence_collection), so a one-to-one mapping is too flat.

**Mechanism**: The map is `criterion_id → competency_id[]` (many-to-many). Example:

```
asked_scope → [scope_discovery, evidence_collection]
set_next_steps → [call_control, next_step_setting]
wrote_usable_ticket → [ticket_documentation, escalation_quality]
```

A unit test (`tests/competency-mapping.test.ts`) asserts every key in `CATEGORY_CRITERIA_MAP` appears as a key in `CRITERION_COMPETENCY_MAP`. Fails CI if a criterion has no competency mapping. The multi-competency mapping is already implemented in `normalize-scores.ts`.

**Justification**: Prevents silent data loss. If a new criterion is added to the analysis engine, the test fails until someone maps it to a competency. This is cheap insurance — a 20-line test protects a 50-line mapping.

**Moat link**: The competency mappings are what make the behavioural data queryable. A drift in mappings creates silent gaps in the dataset. The test prevents that.

### Pain point 5: Pack → competency mapping is manual

**Problem**: `pack_competencies` must be seeded manually per pack. Adding a new pack requires editing the migration script.

**Mechanism**: `suggestCompetenciesForPack(pack)` function analyzes the pack's criteria, hidden facts, description, and context tags to auto-suggest competency mappings. The suggestion is stored in a JSON column; the pack author confirms or adjusts.

**Justification**: Auto-suggestion reduces friction. The pack author (us, or future community contributors) sees "Suggested competencies: call-control, impact-discovery, evidence-gathering" and can adjust before confirming. This is faster than editing SQL and less error-prone.

### Pain point 6: Manager customization scope

**Problem**: Managers will want to customize scenarios. Unrestricted customization breaks the sim pack system. Overly restricted customization makes the product feel rigid.

**Mechanism**: Explicit boundary on what managers can customize vs what is authored in code.

| Managers CAN customize | Managers CANNOT customize |
|------------------------|--------------------------|
| Pathway track order and pass thresholds | Pack customer persona |
| Which packs to include in a track | Hidden facts or diagnostic path |
| Candidate messaging (invite text, track description) | Analysis criteria or scoring rubric |
| Competency weights for scoring | AI customer behaviour prompt |
| Candidate review notes and calibration | Pack mode (call_only vs dashboard_sim) |
| Custom challenge branding | The analysis pipeline itself |

**Justification**: Pack authoring (persona, facts, scoring) requires deep knowledge of support workflows and the analysis engine. Exposing those knobs to managers creates support burden and inconsistent scoring. Managers get control over the *selection and weighting* of scenarios, not the scenarios themselves.

**Moat link**: Consistent scoring across all candidates is what makes benchmarking possible. If managers could change rubrics per-candidate, the percentile data became meaningless. The moat depends on comparable data.

### Pain point 7: Callum LangGraph integration without duplication

**Problem**: The LangGraph system could easily grow its own copy of pack definitions, competency logic, or analysis pipelines, creating drift.

**Mechanism**: Callum is a **read-only consumer** of everything in `lib/mvp/sim/`, `lib/mvp/analysis/`, and the `competencies` table. It accesses these through the same query functions (`getPackById`, `getAssessment`) that the rest of the app uses. Its only writes are to `callum_threads`, `callum_messages`, `callum_proposals`, and structured actions (creating `pathway_tracks` via the existing creation flow).

**Justification**: Read-only access guarantees no duplication. If Callum can write to packs, it can create invalid states. If Callum bypasses the analysis pipeline, scores become inconsistent. The rule is: Callum proposes, the core system executes.

---

## The moat: behavioural dataset

### What makes this defensible

```
"Across 1,284 apprentice-level Outlook scenarios, 71% of candidates failed to ask
whether webmail worked. Candidates who asked scored 18 points higher on average."
```

No competitor can answer that question without:
1. A large corpus of real candidate attempts
2. Normalized competency scores per attempt
3. Session events tracking exactly what candidates did
4. Manager calibration data showing what matters
5. Pack-specific failure rate data

### Which tables create the moat

| Table | Data | Moat value |
|-------|------|------------|
| `session_events` | Every action timestamped | Know what candidates actually do, not just what they score |
| `attempt_competency_scores` | Normalized scores per competency | Benchmark candidates against skill distributions |
| `attempt_criterion_results` | Per-criterion pass/fail with evidence | "71% missed webmail check" queries |
| `pack_competencies` | Which competencies each pack tests | Recommend packs based on skill gaps |
| `analytics_facts` (future) | Pre-computed failure rates, gaps | Marketing data, product intelligence |
| `job_posting_skills` (future) | Market demand per skill | Generate practice paths from real job ads |

### How the moat grows

- More candidates → larger skill distributions → better percentiles
- More pack types → more context tags → finer-grained recommendations
- More manager calibration → know what actually predicts hiring decisions
- More job postings → market-driven practice paths

### What prevents competitors from copying

- The dataset is **behavioural**, not declarative. It's not "I know Active Directory" — it's "here's how this candidate actually handled an identity-access scenario under call pressure."
- Behavioural data requires a live simulation environment with real candidates. Writing a blog post about call handling doesn't produce it.
- Manager calibration data (what scores correlate with "would hire") is proprietary and accumulates over time.

---

## How to add new features without duplication

### Adding a new scenario pack

1. Create pack in `lib/mvp/sim/packs/`
2. Register in `lib/mvp/sim/packRegistry.ts`
3. Add to `ENABLED_TRAINING_DRILL_PACKS` if it's a drill pack
4. Seed `pack_competencies` and `pack_context_tags` in the migration
5. Add a test fixture in `tests/fixtures/`

**Files touched**: 4 (pack file, registry, pack list, migration). No changes to analysis, rendering, or auth.

### Adding a new competency

1. INSERT into `competencies` table
2. Add entry in `CRITERION_COMPETENCY_MAP` in `normalize-scores.ts`
3. Add mapping to relevant packs in `pack_competencies`

**Files touched**: 2 (migration, normalize-scores.ts). Zero UI changes needed — the profile page renders any competency dynamically.

### Adding a new context tag

1. INSERT into `context_tags` table
2. Tag relevant packs in `pack_context_tags`

**Files touched**: 1 (migration). Context tags are display-only metadata.

### Adding a new analysis criterion

1. Define criterion in `criteriaRegistry.ts`
2. Add to `CATEGORY_CRITERIA_MAP`
3. Add to `CRITERION_COMPETENCY_MAP` in `normalize-scores.ts`
4. Update `CRITERIA_LABELS` if needed
5. Add competency mapping test assertion

**Files touched**: 3 (criteria registry, normalize-scores, tests). The analysis pipeline auto-picks up new criteria.

### Adding a new route group

1. Create directory under `app/(new-group)/`
2. Add layout with auth/unauth logic
3. Add pages
4. If API needed, add under `app/api/`

**Files touched**: New directory. No existing routes change.

### Adding a new gamification feature (e.g. daily challenge)

1. Define the feature's data in a new table or extend existing
2. Add detection logic in the post-analysis hook
3. Add display component
4. Add API endpoint if needed

**Files touched**: Depends on scope. The post-analysis hook is the extension point for all gamification.

---

## Sync with sim packs, assessments, and analysis

### The data flow (one complete attempt)

```
1. Assessment created
   ├── assessments row (candidate_user_id, attempt_mode, pack_id)
   ├── sessions row
   ├── first message in messages
   └── pack_snapshot_json frozen

2. Candidate takes call
   ├── messages added
   ├── session_events appended
   └── (optional) audio recording uploaded → MP3 converted

3. Ticket submitted
   ├── ticket saved to tickets
   ├── status → completed
   └── analysis triggered

4. Analysis runs
   ├── runBaseCallumAnalysis()
   ├── StructuredOutput stored in assessment_results.raw_model_json
   ├── overall_score, readiness_label in assessment_results
   └── assessments.status → analysed

5. Post-analysis normalization (new)
   ├── attempt_competency_scores inserted
   ├── attempt_criterion_results inserted
   └── (future) XP, streaks, badges updated

6. User views report
   ├── Fetches GET /api/mvp/assessments/{id}
   ├── Includes results, recording, competencies
   └── Renders full analysis report
```

### The sync contract

| Component | Reads from | Writes to | Sync mechanism |
|-----------|-----------|-----------|----------------|
| Sim packs | Pack code + DB packs | `pack_snapshot_json` | Frozen at assessment creation |
| AI customer | Pack snapshot | `messages`, `session_events` | Inline during call |
| Analysis pipeline | Messages, events, pack | `assessment_results` | Synchronous after ticket |
| Competency normalizer | `assessment_results.raw_model_json` | `attempt_competency_scores`, `attempt_criterion_results` | Hook after analysis |
| Event log | All components | `session_events` | Each component writes its own events |
| Audio pipeline | MediaRecorder (browser) | `data/recordings/`, `assessment_results.recording_path` | Upload + convert + analyze |
| Callum LangGraph | Packs, competencies, results | `callum_threads`, `callum_messages`, `callum_proposals` | Read-only on core systems, writes only to Callum tables |

### What keeps them in sync

**versioned pack snapshots** (`pack_snapshot_json`): The assessment remembers exactly what pack version was used. If the pack changes later, old attempts still have their original snapshot. This means re-scoring old attempts is always possible.

**immutable events** (`session_events`): Written once, never updated. If the analysis pipeline is improved, old events can be re-analyzed.

**recomputable scores** (`attempt_competency_scores`): Derived from the raw analysis JSON. If the competency mapping changes, these can be recalculated by re-running `normalizeScores()` on old analysis results.

**no shared mutable state**: Each component owns its tables. The sync is one-directional: pack → assessment → events → analysis → competency scores. No circular dependencies.

---

## Modularity principles

### 1. Domain directories

Each domain of the application lives in its own directory with its own types, logic, and tests:

```
lib/mvp/sim/          → pack types, registry, validation, AI customer
lib/mvp/analysis/     → scoring engine, prompts, normalizers, types
lib/mvp/audio/        → recording, diarization, analysis
lib/mvp/callum/       → LangGraph state machine, proposals, threads
lib/mvp/events/       → event logging, timeline builder
lib/voice/            → STT/TTS providers, voice loop
lib/candidate/        → candidate profile logic
```

### 2. API routes are thin wrappers

```typescript
// GOOD
export async function GET(req) {
  const result = getAssessment(id);
  return NextResponse.json(result);
}

// BAD
export async function GET(req) {
  // business logic, DB queries, scoring, auth checks all inline
}
```

### 3. Components are presentational

Components never fetch data directly (no `useEffect` + `fetch` in reusable components). Data fetching lives in pages or hooks. Components accept props and render.

### 4. Types stay close to their domain

`SimPack` type is in `lib/mvp/sim/types.ts`. Competency types stay with `normalize-scores.ts`. Event types stay with `eventLog.ts`. No mega-types file.

### 5. The post-analysis hook is the extension point

All gamification (XP, streaks, badges), leaderboard updates, and analytics processing hook into the post-analysis pipeline in `normalizeAnalysisScores()`. Adding a new feature means adding a function call in this hook, not scattering logic across the codebase.

---

## Testing philosophy

| Layer | What to test | How |
|-------|-------------|-----|
| Packs | Validation, registry, mode | Unit tests with fixtures |
| Scoring | Criteria, weights, thresholds, fail gates | Unit tests with known inputs |
| Analysis pipeline | Evidence extraction, narrative | Integration tests with fixture transcripts |
| Competency mapping | Every criterion has ≥1 competency | Unit test (CI gate) |
| Auth | Sign-up, sign-in, session | E2E via API calls |
| Recording | Upload, convert, serve | Integration test with test audio file |
| UI | Render states, navigation | Manual (automated E2E later) |

---

## Dependency graph

```
pack definitions (lib/mvp/sim/)
  ├── AI customer (lib/mvp/sim/aiCustomer.ts)
  │     └── writes to messages, session_events
  ├── Assessment creation (lib/mvp/assessments/create.ts)
  │     └── pack_snapshot_json frozen
  ├── Workspace renderer (components/mvp/workspace/)
  │     └── reads pack.mode to pick UI
  └── Analysis scoring config
        └── read by scoring engine

analysis pipeline (lib/mvp/analysis/)
  ├── reads from messages, session_events, tickets
  ├── writes to assessment_results
  └── triggers normalizeAnalysisScores()
        ├── writes attempt_competency_scores
        ├── writes attempt_criterion_results
        └── (future) XP, streaks, badges

candidate profile (app/(candidate)/)
  ├── reads from assessments, attempt_competency_scores
  ├── reads from candidate_profiles, featured_attempts
  └── writes to featured_attempts, candidate_profiles

Callum LangGraph (lib/mvp/callum/) — future
  ├── reads from packs, competencies, assessments
  └── writes to callum_threads, callum_messages, callum_proposals
```

No circular dependencies. The dependency direction is always: pack → assessment → analysis → competencies → profile/gamification.
