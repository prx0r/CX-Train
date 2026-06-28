# CX-Train Mechanics

> Dataflows, redundancies, and fragile points. Generated 2026-06-28 from full codebase audit.

---

## 1. System Overview

```
Browser ←→ Next.js Dev Server (port 3000)
  │
  ├── /mvp/*                    — Manager dashboard pages (app/mvp/)
  ├── /mvp/assessment/[token]   — Candidate assessment page
  ├── /api/mvp/*                — 26 API route files
  │
  ├── lib/mvp/                  — ~66 source files, the core business logic
  │   ├── analysis/             — Evidence extraction, scoring, narrative
  │   ├── compliance/           — 11 frameworks + evaluator + pack-relevance
  │   ├── sim/                  — Simulation engine, pack registry, state machine
  │   ├── audio/                — Recording, VAD, diarization, turn analysis
  │   ├── voice/                — TTS (Azure + Kokoro), STT (Whisper)
  │   ├── events/               — session_events table operations
  │   ├── capabilities/         — Callum capability registry
  │   ├── callum/               — Proposals, thread memory
  │   └── contracts/            — Runtime-validated data shapes
  │
  ├── components/mvp/           — React components
  │   ├── simulator/            — ServiceDeskSimulatorShell (763 lines)
  │   ├── callum/               — CallumPanel, CallumActionCard
  │   ├── voice/                — VoiceRecorderButton, CustomerAudioPlayer
  │   └── results/              — AssessmentResults
  │
  ├── tests/                    — 11 test files, ~205 tests
  │
  └── data/                     — SQLite (callcallum.db), recordings, ONNX models
```

**Key architectural facts:**
- SQLite via `better-sqlite3` with WAL mode — single-file, single-process DB
- AI via `deepseek-v4-flash` through OpenCode Go provider
- 26 API route files, 4 packs, 11 compliance frameworks, 19 database tables
- Two parallel voice systems (MVP `lib/mvp/voice/` + legacy `lib/voice/`)
- Source count: ~1155 lines in `db.ts` alone (schema + migrations + seeding)

---

## 2. Dataflows

### 2.1 Assessment Creation Flow

```
POST /api/mvp/assessments (route.ts)
  → createMvpAssessment() [lib/mvp/assessments/create.ts]
    → initTables(), seedDefaults()
    → Validate assignmentType (hiring_exam | training_drill)
    → If training_drill:
        → resolve assessmentPackId from input or ENABLED_TRAINING_DRILL_PACKS
        → validatePackStructure(codePack)
        → buildPackSnapshot(codePack) — freeze pack into immutable JSON
    → Load active scenario from DB
    → Load active criteria from DB
    → Load manager standards
    → mergeAssessmentConfig() — merge scoring defaults with manager overrides
    → INSERT assessments row
    → INSERT sessions row
    → INSERT first message (caller greeting)
    → If training_drill: INSERT sim_sessions row + sim event
    → appendSessionEvent() — canonical event log
  → Returns { assessment_id, session_id, invite_url, invite_token }
```

**Entry points:** Manager creates from dashboard (`/mvp`) or programmatically via API.

**Key coupling:** `createMvpAssessment()` is shared between the direct API route AND Callum proposal confirmation. Both paths produce identical assessments.

---

### 2.2 Candidate Assessment Flow

```
Candidate opens /mvp/assessment/[token]
  → Page fetches GET /api/mvp/assessment/[token]
    → resolveSimAssessment() [lib/mvp/sim/resolver.ts]
      → Look up assessment by invite_token
      → Load pack_snapshot_json from assessments row
      → If no snapshot but has packId: rebuild from packRegistry (inconsistent!)
      → Load sim_sessions, messages, events from DB
      → Build SimAssessmentView with visible state and actions
    → Fallback: legacy path via getFullAssessment() for old assessments
  → ServiceDeskSimulatorShell renders

Candidate interacts:
  → VoiceRecorderButton captures audio
    → POST /api/mvp/assessment/[token]/voice/transcribe
      → transcribeAudio() via OpenRouter Whisper
    → Message shown in transcript
  → OR type message
    → POST /api/mvp/assessment/[token]/message
      → buildAiCustomerContext() — build persona prompt from pack
      → runAiTask('caller', ...) — AI generates reply
      → Return reply text

Candidate performs sim actions (remote desktop):
  → POST /api/mvp/assessment/[token]/sim/action
    → Duplicate of resolver.ts logic — re-loads snapshot, finds action
    → applyAction() — transitions sim state
    → insertSimEvent() — dual-writes to sim_events + session_events
    → Returns visible_state + safe_actions

Candidate submits ticket:
  → POST /api/mvp/assessment/[token]/ticket
    → Store ticket text in tickets table
    → If sim session: update phase to 'submitted'
    → insertSimEvent('sim_completed')
    → await runBaseCallumAnalysis(assessment.id) — BLOCKS response
    → buildCandidateAnalysis() — reshape for candidate view
    → Returns { status: 'completed', candidate_analysis }

Call ends:
  → /recording route triggered (via flushRecordingTrigger in VoiceRecorderButton)
    → saveRecording() — writeFileSync to data/recordings/
    → analyzeAudio() — VAD + silence detection
    → runDiarization() — sherpa-onnx speaker separation (best-effort)
    → buildEmotionalTrajectory() — from session_events
    → Write combined analysis to assessment_results.recording_analysis_json
```

**Fragile:** Analysis runs synchronously during ticket submission. Response blocked for 30-60s.

**Fragile:** The `candidate_analysis as any` cast in the candidate page bypasses all type safety.

**Fragile:** Two parallel code paths (sim vs legacy) in `assessment/[token]/route.ts` produce structurally different response shapes.

---

### 2.3 Analysis Pipeline (the core)

```
runBaseCallumAnalysis(assessmentId) [lib/mvp/analysis/runBaseCallumAnalysis.ts]
  │
  ├── 1. buildAssessmentContext(assessmentId) [lib/mvp/analysis/context.ts]
  │     → Load assessment + session + messages + ticket + events + criteria + scenario + standards
  │     → Build AnalysisContext object
  │     → If no assessment found: return null (skip)
  │     → If no ticket: early return (CURRENT GATE — cannot analyse without ticket)
  │     → If < 2 messages: early return
  │
  ├── 2. buildAnalysisInputHash() — check for cached result
  │     → If cached: return early
  │
  ├── 3. Step 1: AI Evidence Extraction
  │     → buildEvidenceExtractionPrompt() — builds 56-criteria prompt
  │     → runAiTask('callum', prompt, { temperature: 0, maxTokens: 16384 })
  │     → parseExtractionJson() — strip markdown fences, parse JSON
  │     → validateEvidenceGrounding() — verify quotes against transcript
  │       → If quote not found in transcript → remove quote
  │       → If all quotes removed for pass/partial → downgrade to not_observed
  │
  ├── 4. Step 2: Deterministic Scoring
  │     → buildEvidencePool() — reshape criteria + events + triage + red flags
  │     → scoreExtraction() [lib/mvp/analysis/scoring.ts]
  │       → Weight each criterion from DEFAULT_WEIGHTS
  │       → Apply fail gates (9 direct + 10 derived)
  │       → computeFinalScore() — cap by strictest gate
  │     → evaluateAllFrameworks() [lib/mvp/compliance/evaluator.ts]
  │       → For each of 11 frameworks:
  │         → getRelevantCriteria(packId, frameworkId)
  │         → Evaluate each criterion by checkType:
  │           ai_criteria | event_check | ticket_field | transcript_keyword | action_performed/not | triage_check
  │         → Apply passIf mapping, track critical failures
  │         → Compute per-framework score
  │       → Combined score = primary framework score (NOT weighted aggregate)
  │
  ├── 5. Step 3: AI Narrative Feedback
  │     → buildNarrativePrompt() — injects scores + evidence
  │     → runAiTask('callum', prompt, { temperature: 0.3 })
  │     → parseNarrativeJson()
  │     → validateNarrativeQuality()
  │     → If AI fails: buildFallbackNarrative()
  │
  └── 6. Persist Results
      → Build StructuredOutput from all components
      → INSERT assessment_results row
      → UPDATE assessments SET status = 'analysed'
      → UPDATE analysis_runs SET status = 'completed'
```

**Fragile:** Three AI calls (evidence extraction → scoring → narrative). First AI failure = no analysis.

**Fragile:** Scoring engine (`scoring.ts`) and evidence-validated scoring calculator (`scoring-calculator.ts`) are two independent engines. Only `scoring.ts` is used in production. `scoring-calculator.ts` is **orphaned** — it exists but no code imports it.

**Fragile:** Many hardcoded values (weight maps, criteria definitions, gate thresholds) must be kept in sync across 7+ files.

---

### 2.4 Manager Review Flow

```
GET /api/mvp/assessments/[id]
  → Load assessment + messages + ticket + result + scenario + criteria + feedback from DB
  → Return JSON with complianceData, categoryScores, recordingAnalysis
  → Response shape is ~50+ fields deep

Manager page renders:
  → Candidate info, status, invite link
  → Session Timing metrics
  → Transcript (messages list)
  → Evidence Timeline (events sorted chronologically)
  → Red flags triggered
  → Ticket text
  → Analysis Results:
    → Overall score + readiness label
    → Strengths / Weaknesses / Checkpoints / Evidence Quotes
    → Criteria Breakdown with skills + compliance frameworks
    → Summary grid: Strengths, Misses, Coaching Focus, Ticket Quality
    → Evidence Validation section (grounded/removed quotes)
  → Manager Feedback form

CallumPanel [sidebar]:
  → POST /api/mvp/callum { message, threadId, pageContext }
  → classifyIntent() — heuristic keyword matching (pre-LangGraph)
  → If navigation: resolveNavigation() → return targetRoute
  → If explain_assessment:
    → invokeCapability('get_assessment_review_context')
    → buildAssessmentExplanation() — heuristic summary
  → If suggest_next_training:
    → invokeCapability('get_assessment_review_context')
    → invokeCapability('list_sim_packs')
    → invokeCapability('draft_training_assignment')
    → createCallumProposal() — INSERT pending proposal
    → Return proposed_action with pendingActionId
  → CallumActionCard renders with Confirm/Reject buttons

  → Manager clicks Confirm:
    → POST /api/mvp/callum/proposals/[id]/confirm
    → confirmCallumProposal():
      1. Load proposal
      2. Check manager ownership (FORBIDDEN)
      3. Check status is 'pending' (NOT_PENDING)
      4. Check not expired (EXPIRED)
      5. Recompute source context hash, compare (STALE)
      6. Validate payload schema + shape (INVALID_PAYLOAD)
      7. Mark 'approved'
      8. createMvpAssessment() — shared assessment creation
      9. Mark 'executed'
```

---

### 2.5 Callum Proposal Lifecycle

```
                    createCallumProposal()
                            │
                            ▼
                       [pending]
                     ┌────┴────┐
                     │         │
                     │    [rejected]
                     │
                confirmCallumProposal()
                     │
               ┌─────┼─────┬──────┬──────┐
               ▼     ▼     ▼      ▼      ▼
           [approved]  [expired] [stale] [failed]
               │
          createMvpAssessment()
               │
          ┌────┴────┐
          ▼         ▼
      [executed] [failed]
```

**Statuses:** `pending` → `approved` → `executed` | `rejected` | `expired` | `stale` | `failed`

**Key fragility:** No SQLite transaction wraps the status transition. Two parallel confirm calls can both pass the `status === 'pending'` check before either writes.

---

### 2.6 Voice & Audio Flow

```
TTS (text → speech):
  POST /api/mvp/assessment/[token]/voice/tts
    → Query assessments table by invite_token (on every request!)
    → Load pack_snapshot_json for voice config
    → If Azure configured: synthesizeAzure() — SSML with mstts:express-as
    → Else OpenRouter: synthesize via Kokoro-82m
    → Return audio/mpeg blob

STT (speech → text):
  POST /api/mvp/assessment/[token]/voice/transcribe
    → Receive audio as multipart/form-data
    → transcribeAudio() via OpenRouter Whisper
    → Return { text, metadata }

Recording (full call):
  POST /api/mvp/assessment/[token]/recording
    → saveRecording() — writeFileSync to data/recordings/{token}-{id}.webm
    → analyzeAudio() — VAD: RMS threshold 0.02, 30ms windows
    → runDiarization() — sherpa-onnx (best-effort, try/catch)
    → buildEmotionalTrajectory() — from session_events
    → Write JSON to assessment_results.recording_analysis_json
```

---

## 3. Redundancies

### 3.1 Criteria Definitions — 7+ Locations, Constant Divergence Risk

| Location | What It Stores | Entries |
|---|---|---|
| `analysis/evidencePrompt.ts` | `CRITERIA_DEFINITIONS` — AI prompt criteria with descriptions | 56 |
| `analysis/scoring.ts` | `DEFAULT_WEIGHTS` — weight map for scoring | 22 |
| `analysis/runBaseCallumAnalysis.ts` | `CATEGORY_CRITERIA_MAP` — category grouping | ~50 |
| `analysis/runBaseCallumAnalysis.ts` | `CRITERION_LABELS` — display labels | ~50 |
| `results/scoring-calculator.ts` | `CRITERION_DESCRIPTIONS` — descriptions | ~50 |
| `results/scoring-calculator.ts` | `EVIDENCE_PATTERNS` — keyword patterns | ~50 |
| `results/scoring-calculator.ts` | `FUNDAMENTAL_CRITERIA` — fundamental set | ~50 |
| `compliance/frameworks/callum-baseline.ts` | Framework criteria definitions | 27 |
| 10 other framework files | Per-framework criteria | varies |

**Impact:** Adding or removing a criterion requires coordinated edits across all these files. In practice, they drift.

### 3.2 `FUNDAMENTAL_CRITERIA` — Two Completely Different Sets, Same Name

| File | Contents | Size |
|---|---|---|
| `analysis/scoring.ts` line 52 | `ticket`, `triage`, `next_steps` | 3 entries |
| `results/scoring-calculator.ts` line 194 | KT, ITIL, SERVQUAL, LEAP, SBAR etc. | ~50 entries |

**Impact:** Name collision. Any developer reading "fundamental criteria" doesn't know which set is referenced without checking imports.

### 3.3 `CriterionResult` Interface — Three Incompatible Definitions

| File | Fields |
|---|---|
| `analysis/types.ts` | `status`, `evidence`, `notes` |
| `compliance/evaluator.ts` | `status: 'pass'|'fail'|'not_assessable'|'not_applicable'` |
| `results/scoring-calculator.ts` | `id`, `label`, `description`, `status`, `weight`, `evidence`, `frameworkId`, `frameworkName`, `evidenceStatus`, `evidenceQuote` |

**Impact:** Data cannot be passed between subsystems with type safety. Conversion functions or `as any` casts are required.

### 3.4 `RUBRIC_VERSION` — Duplicate Export

Defined identically in both `analysis/types.ts` and `analysis/scoring.ts`. Imported in `runBaseCallumAnalysis.ts` from `./types`.

### 3.5 Two Voice Systems

| Capability | MVP (`lib/mvp/voice/`) | Legacy (`lib/voice/`) |
|---|---|---|
| STT | `stt.ts` — flat function | `stt.ts` — class with `STTProvider` interface |
| TTS | `tts.ts` — flat functions | `tts.ts` — class with `TTSProvider` interface |
| Session | SQLite via DB | In-memory `Map<string, VoiceSession>` |

**Impact:** Bug fixes or improvements must be applied twice. The MVP system is the active one; legacy appears frozen but still present.

### 3.6 Scoring Engines — One Active, One Orphaned

| Engine | File | Status |
|---|---|---|
| `scoreExtraction()` | `analysis/scoring.ts` | **Active** — called by analysis pipeline |
| `computeScoredAssessment()` | `results/scoring-calculator.ts` | **Orphaned** — not imported by any pipeline code |

`scoring-calculator.ts` has its own evidence validation logic (`determineEvidenceStatus`, `EVIDENCE_PATTERNS`, `CHECK_TARGET_MAP`) that duplicates what the compliance evaluator and scoring engine already do.

### 3.7 Sim Event Dual-Write

`lib/mvp/sim/eventLog.ts` inserts into **both** `sim_events` AND `session_events` tables. No transaction. If one write fails, the system is inconsistent.

### 3.8 `getNested()` — Duplicated Function

Implemented identically in:
- `lib/mvp/sim/stateMachine.ts`
- `lib/mvp/sim/scoring.ts`

### 3.9 Pack Data Duplication

Each pack file (4 packs) contains:
- `getInitialState()` — copied from `packConfig.ts`
- `rubric`, `redFlags`, `idealTicket`, `scoringCriteria`, `diagnosticChecklist` — duplicated from `scoringDefaults` within the same file

### 3.10 API Response Type Definitions — Duplicated Across Components

The `AnalysisResult`, `CandidateAnalysisResult`, `StructuredOutput`, and local type interfaces in:
- `ServiceDeskSimulatorShell.tsx`
- `AssessmentResults.tsx`
- `app/mvp/assessments/[id]/page.tsx`

...all describe overlapping data with slightly different field names and shapes.

### 3.11 UI Components — Overlapping

- `TicketSidePanel.tsx` and `TicketMetadataPanel.tsx` render nearly identical ticket metadata. `TicketSidePanel` may be unused (dead code).
- Criteria breakdown rendering is duplicated in `app/mvp/assessments/[id]/page.tsx` (lines 476-602) and `AssessmentResults.tsx` (~80 lines).

### 3.12 Analysis Loading SQL — Duplicated Verbatin

The ~25-line block that loads analysis results from the database is copy-pasted into both branches (sim and legacy) of `app/api/mvp/assessment/[token]/route.ts`.

---

## 4. Fragile Points

### 4.1 Critical — Race Condition in Proposal Confirmation

**File:** `lib/mvp/callum/proposals.ts`

`confirmCallumProposal()` reads proposal status, checks it's `pending`, then writes `approved`. No SQLite transaction or compare-and-set:

```typescript
// Current (race-prone):
const proposal = getCallumProposal(id);  // read
if (proposal.status !== 'pending') return;  // check
markProposalStatus(id, 'approved');  // write — another call may have raced past the check
```

Two parallel confirm calls can both pass the status check and both execute.

### 4.2 Critical — Analysis Blocks Ticket Submission

**File:** `app/api/mvp/assessment/[token]/ticket/route.ts` line 97

```typescript
const analysisResult = await runBaseCallumAnalysis(assessment.id);
```

The candidate's browser waits 30-60s for AI analysis to complete before the ticket submission response is returned. No async/background queue.

### 4.3 Critical — Pack Snapshot Inconsistency

**File:** `lib/mvp/sim/resolver.ts` ~line 85

If `pack_snapshot_json` is null (old assessment) but `packId` exists, the system rebuilds the snapshot from the **current** pack registry. This means:
- Some assessments have frozen snapshots (immutable)
- Others have "live" snapshots that change if the pack definition is updated
- Inconsistent behavior with no warning

### 4.4 Critical — Type Erosion via `as any`

Ubiquitous across API routes, especially:
- `assessment/[token]/route.ts`: `full.assessment as any`, `result as any`
- `message/route.ts`: `assessment as any`, `as unknown as SimPack` (pack snapshot cast to SimPack — field name mismatches: `openingLine` vs `opening_line`)
- `sim/action/route.ts`: `as any` on pack type
- `runBaseCallumAnalysis.ts`: heavy `as any` usage

The `as unknown as SimPack` cast in `message/route.ts` is the worst — it silently drops fields because `PackSnapshot` uses snake_case while `SimPack` uses camelCase.

### 4.5 Critical — 5 Frameworks That Never Score

**File:** `lib/mvp/compliance/pack-relevance.ts`

SERVQUAL, SBAR, LEAP/HEAT, ITIL Incident Mgmt, ITIL Service Desk have no entries in `PACK_COMPLIANCE_RELEVANCE`. They exist in `DEFAULT_FRAMEWORKS`, consume AI extraction space, but always return `not_applicable` for all 4 packs. A 10-minute fix to add their IDs would make 5 frameworks actually useful.

### 4.6 High — No Network Timeouts on External API Calls

Every `fetch()` call across:
- `lib/mvp/voice/tts.ts` (Azure + OpenRouter)
- `lib/mvp/voice/stt.ts` (OpenRouter)
- `lib/ai/provider.ts` (OpenCode Go/deepseek)

...lacks `AbortSignal`/timeout. If an external service hangs, the serverless function hangs until platform timeout (typically 30-60s on Vercel, up to 900s on some hosts). No retry logic either.

### 4.7 High — Synchronous File I/O in Server Context

**File:** `lib/mvp/audio/recorder.ts`

Uses `writeFileSync`, `readdirSync`, `statSync`, `unlinkSync` exclusively. Blocks the event loop during recording upload, analysis, and retrieval. For a 50MB recording analyzed with VAD + diarization, this blocks all other requests.

### 4.8 High — In-Memory Audio Copies

The recording route (`recording/route.ts`) and transcribe route (`transcribe/route.ts`) load complete audio files into memory multiple times:
- `file.arrayBuffer()` → `Buffer.from()` → base64 (for STT)
- For 50MB files: ~150MB temporary allocations per request

### 4.9 High — `process.env` Mutation at Runtime

**File:** `app/api/mvp/assessment/[token]/voice/tts/route.ts` line 78

```typescript
process.env.VOICE_TTS_VOICE = process.env.AZURE_TTS_VOICE;
```

Mutating `process.env` at runtime affects all subsequent requests in the same process. Causes non-deterministic behavior if concurrent requests have different env expectations.

### 4.10 High — No Input Validation on API Route Params

- `params.id` passed directly to database layer in analyse route (SQL injection prevented by parameterized queries, but no explicit validation)
- `duration_ms` from form data not sanitized (could be negative, NaN, or absurdly large)
- No bounds checking on TTS `intensity` (0-5) — value 6 or -1 passes through

### 4.11 High — `JSON.parse(JSON.stringify(obj))` Deep Clone

Used in `stateMachine.ts` (`deepClone()`) and `snapshot.ts` (`buildPackSnapshot()`). Loses functions, `undefined` values, Dates, Maps, Sets, RegExps, and circular references. Particularly dangerous because `SimDerivedGate.condition` and `SimCmdCommand.output` function form are non-serializable.

### 4.12 High — Phase Transition Side Effects Hardcoded to Action IDs

**File:** `lib/mvp/sim/stateMachine.ts` lines 119-124

```typescript
if (action.id === 'remote_active') {
  setNested(current, 'remote.connected', true);
}
if (action.id === 'remote_disconnect' || action.id === 'call_active') {
  setNested(current, 'remote.connected', false);
}
```

These side effects are outside the `effects` map and coupled to specific action IDs. A pack with differently-named actions for remote connect/disconnect would silently not trigger these side effects.

### 4.13 High — Analysis Context Double-Fetch

**File:** `lib/mvp/analysis/runBaseCallumAnalysis.ts` lines 56-58

`getManagerStandards()` is called a second time even though `buildAssessmentContext()` on line 40 already loaded it. Unnecessary DB read that could produce stale data if standards changed between calls.

### 4.14 Medium — Silent JSON Parse Failures

Multiple locations swallow JSON parse errors:
- `mergeConfig.ts` — `JSON.parse(managerStandardsOverrides)` in silent `catch {}`
- `tts/route.ts` — `JSON.parse(packSnapshotJson)` in silent `catch`
- `analysis/context.ts` — multiple `catch { /* ignore */ }` blocks for standards/criteria/scenario JSON

Errors are invisible — data silently falls back to defaults.

### 4.15 Medium — Two Parallel Code Paths (Sim vs Legacy)

Three API routes have separate sim and legacy paths that produce structurally different response shapes:
- `assessment/[token]/route.ts` — GET assessment
- `message/route.ts` — POST message
- `ticket/route.ts` — POST ticket

The legacy paths exist for assessments created before the sim engine was added. They use `getFullAssessment()` and scenario-based AI customers.

### 4.16 Medium — Dual-Write Without Transaction

**File:** `lib/mvp/sim/eventLog.ts`

Writes to both `sim_events` AND `session_events` tables without a transaction. If the first write succeeds and the second fails, events are in an inconsistent state.

### 4.17 Medium — `session_events` Sequence Index Race Condition

**File:** `lib/mvp/events/eventLog.ts` lines 5-11

`getNextSequenceIndex()` reads `MAX(sequence_index)` then inserts with that value + 1. Two concurrent calls can get the same max value and insert duplicate sequence indices.

### 4.18 Medium — Pack Factories Called Every Time

**File:** `lib/mvp/sim/packRegistry.ts`

`getPackById()` calls the factory function every time — no caching. The full pack object is reconstructed from scratch on every call. `listPacks()` calls ALL factories just to get titles.

### 4.19 Medium — Sherpa-Onnx Model Paths Relative to CWD

**File:** `lib/mvp/audio/diarizer.ts`

```typescript
MODELS_DIR = path.resolve(process.cwd(), 'data', 'models');
```

If the server is started from a different working directory, models are not found. Diarization silently returns null (graceful degradation, but with no observability).

### 4.20 Medium — `voice/types.ts` and `recording/route.ts` Disagree on Max Audio Size

| Location | Limit |
|---|---|
| `voice/types.ts` line 19 | 8MB |
| `recording/route.ts` line 9 | 50MB |

### 4.21 Medium — Legacy Voice Session In-Memory Map

**File:** `lib/voice/session.ts`

Module-level `Map<string, VoiceSession>`. In serverless environments, each cold start has an empty map. In multi-instance deployments, sessions are not shared. Memory grows unbounded with no eviction or TTL.

### 4.22 Medium — UI: Empty Catch Blocks on Critical Fetches

**File:** `components/mvp/simulator/ServiceDeskSimulatorShell.tsx`

- `loadSim()` catch is empty (`catch {}`) — network errors silently ignored
- Taxonomy fetch `catch (() => {})` — silently falls back to empty/undefined taxonomy

### 4.23 Medium — UI: No Network Timeout on Any Fetch

The `CallumPanel`, `CallumActionCard`, and `ServiceDeskSimulatorShell` have no timeout on any API call. If the server hangs:
- Callum: "Thinking..." forever
- Simulator: polling continues, actions fail silently
- Manager page: `load()` result never arrives

### 4.24 Medium — Manager Page: `JSON.parse` Unprotected

**File:** `app/mvp/assessments/[id]/page.tsx`

`JSON.parse(apiData.result.strengths_json)` (and similar) are not try/caught. If `strengths_json` is an invalid JSON string, the entire page crashes.

### 4.25 Medium — Simulator: `document.querySelector('[data-call-start]')`

The simulator uses a DOM query to find call start time. If the element with `data-call-start` doesn't exist (e.g., component restructuring), `parseInt(null)` returns `NaN`, breaking timing calculations.

### 4.26 Low — `parseExtractionJson` and `parseNarrativeJson` Inconsistent Fence Stripping

`parseExtractionJson` strips both opening and closing markdown fences. `parseNarrativeJson` only strips the opening fence.

### 4.27 Low — SSML Builder Duplicated

`buildAzureSsml()` function exists but `synthesizeAzure()` builds SSML inline instead of calling it.

### 4.28 Low — `resolveAzureStyle()` Has Dead Fallback Logic

Declares `STYLE_FALLBACKS` chain but `resolveAzureStyle` never walks it — returns the style directly.

### 4.29 Low — Pipeline Prompts Redefined Per-Prompt

`analysis/prompts.ts` contains `PROMPT_VERSION = 'base-callum-v1'` and `PROMPT_SUFFIX` (an old JSON schema) that are entirely unused by the current pipeline. Dead code.

---

## 5. Schema Coupling Map

Fields that, if renamed, require updates across multiple files:

| Field/Column | Files Using It |
|---|---|
| `assessments.pack_snapshot_json` | resolver.ts, message/route.ts, tts/route.ts, sim/action/route.ts |
| `assessments.assessment_pack_id` | resolver.ts, eventLog.ts, ticket/route.ts, message/route.ts, context.ts |
| `sim_sessions.current_state_json` | resolver.ts, message/route.ts, ticket/route.ts, sim/action/route.ts |
| `session_events.payload_json` | emotionalState.ts, turns.ts, eventLog.ts (append/parse), timeline.ts |
| `assessment_results.recording_analysis_json` | recording/route.ts (write), assessment/[id]/route.ts (read) |
| `pack_snapshot_json` fields (snake_case) | snapshot.ts (build), resolver.ts (read), aiCustomer.ts (read as camelCase `as any`) |

---

## 6. Build Order Dependencies (What Actually Blocks What)

```
Evidence quality (Thread 1)
  → Slider scoring (Thread 5)
    → Manager calibration LoRA (Thread 6)
      → Model distillation Qwen (Thread 7)

Evidence quality (Thread 1)
  → Focus drills (Thread 13)

Pack relevance mapping (Thread 3)
  → New packs (Thread 4)

Voice/audio (Thread 8)
  → Unified candidate shell (Thread 9)

Callum proposal confirmation
  → Route-level tests
  → Atomic transactions
  → Real manager auth
  → LangGraph wrapper (last)
```

---

## 7. Quick Win Fixes (Hours, Not Days)

1. **Add 5 framework IDs to `pack-relevance.ts`** — ~10 min, makes 5 frameworks actually score
2. **Add `AbortSignal.timeout(30000)` to all `fetch()` calls** — ~30 min, prevents hanging requests
3. **Replace synchronous `writeFileSync` with `fs.promises.writeFile` in recorder.ts** — ~15 min
4. **Remove duplicate `getNested()`** — import from one location
5. **Add SQLite transaction to `confirmCallumProposal()`** — ~20 min, closes race condition
6. **Remove `process.env` mutation in TTS route** — ~5 min
7. **Add try/catch around `JSON.parse` in manager page** — ~10 min
8. **Remove `analysis/prompts.ts` dead code** — ~5 min
9. **Add empty catch logging in `mergeConfig.ts`** — ~5 min (silent failures become visible)
10. **Centralize max audio size constant** — ~5 min
