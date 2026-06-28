# Changes: Unified SimulationWorkspace with Mode-Based Feature Flags

## 1. Problem Summary

The current architecture has a single `ServiceDeskSimulatorShell` that assumes every assessment needs the full ITIL service desk cockpit. This breaks the hiring exam flow:

- Candidates see a ticket queue, claim buttons, triage panels, priority/SLA fields, taxonomy selectors, remote desktop tooling — none of which they should need to navigate for a 5-minute readiness check
- The three assignment types (`hiring_exam`, `training_drill`, `training_shift`) are crammed into conditionals, not designed as distinct experiences
- No clear product ladder: hiring/training/shift should feel like progression, not the same thing with different labels

## 2. Is This Actually Feasible? (Reality Check)

**Short answer: Yes, and it's simpler than the current code.**

The current `ServiceDeskSimulatorShell.tsx` (790 lines) already has conditional branches for `hiring_exam` vs `training_drill` — they're just ad-hoc `if (capabilities.remoteDesktop)` checks scattered everywhere. A mode config centralises these into one declaration.

**What makes it easy:**
- The shared engine (AI caller, transcript store, event log, analysis pipeline, scoring, results) is already decoupled from the UI shell. No changes needed there.
- The UI elements (CallBar, TicketNotesPanel, TicketTriagePanel, etc.) are already separate components. They just need `variant` or visibility props.
- The refactor is mechanical: move conditionals into a config object, not rewrite logic.

**What makes it non-trivial:**
- The hiring screen layout is fundamentally different from the current two-column ticket detail view. It's not just hiding panels — it's a single-column conversation-first layout. This means `SimulationWorkspace` needs distinct layout section components per mode, not just show/hide toggles.
- `ServiceDeskSimulatorShell` needs to be broken into extractable sections (the refactor is ~400 lines of moving code around).
- The submit/analysis/results flow needs to work the same regardless of which layout rendered it. This is already the case.

**Verdict:** Moderate refactor (1-2 days), low risk. The risk is in the hiring layout being new code, not in breaking the training flows.

---

## 2b. Deep-Dive Risk Assessment (from code review)

### What we audited

We read every file that touches the assessment flow: 791-line shell, 13 API routes, 572-line analysis pipeline, 529-line scoring engine, 260-line validation, 277-line compliance evaluator, 515-line results calculator, 150-line emotional trajectory, all child components.

### What we found — concrete risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **`ServiceDeskSimulatorShell` orchestrates 9 API endpoints** — any change to which endpoints it calls or when could break the flow | **High** | The new `SimulationWorkspace` calls the same endpoints. The only difference is which endpoints are triggered from which layout sections. Remove endpoints (not change them) — safe. |
| **23 state variables tightly coupled** — the shell manages call status, phase, ticket view, sim data, triage, notes, recording, TTS, mood — all interleaved | **High** | Mode config doesn't change state management. It only changes which UI sections render. The state transitions (call idle→active→ended etc.) are identical across modes. The state machine is untouched. |
| **`submitTicket()` synchronously triggers `runBaseCallumAnalysis()`** — the ticket route calls the full AI analysis pipeline inline. If we change the request body schema (e.g. add `mode`), we must not break the existing body parsing | **Low** | Add `mode` as optional field with default `'training_assignment'`. Backward compatible. |
| **`scoreExtraction()` already accepts optional overrides** (`weights`, `thresholds`) — adding a `scoringScope` filter follows the exact same pattern. The `CATEGORY_CRITERIA_MAP` in `runBaseCallumAnalysis.ts` already groups criteria by category | **Low** | Pure additive change. The scoring engine is deterministic with no side effects. |
| **`WorkArea` component is imported but never rendered** — dead import, no risk | **None** | Remove during refactor. |
| **Sim scoring (`sim/scoring.ts`) is entirely separate from analysis scoring** — the pack-based sim mode has its own `ScoringConfig`, `SimPackScoringCriterion[]`, `SimFailGateMap[]` | **Medium** | Mode config only feeds into `runBaseCallumAnalysis()` (the main scoring pipeline). The sim scoring already has its own per-pack config. If we want mode-conditional sim scoring, that's a separate change. |
| **`evaluateAllFrameworks()` already accepts `packId`** for scope filtering — compliance frameworks can be scoped per pack. No change needed for mode | **None** | Already works. |
| **`CustomerMood` has TWO definitions** — `sim/types.ts` says `'neutral'|'frustrated'|'reassured'`, `voice/tts.ts` says `'neutral'|'friendly'|'confused'|'rushed'|'frustrated'|'angry'|'anxious'|'panicked'|'sad'|'relieved'|'passive_aggressive'`. The TTS route silently casts via `body.mood || 'neutral'` | **Medium** | Pre-existing issue. Mode config doesn't touch this. But worth noting the sim mood→TTS mood mapping is fragile. |
| **Assessment API route (`GET /assessment/[token]`) returns `assignment_type`** — the frontend uses this to determine capabilities. Adding `mode` is a non-breaking additive field | **Low** | Just add `mode` to the response. Existing frontend ignores unknown fields. |
| **Recording route stores analysis in `assessment_results` but never surfaces it** — `audio_analysis_json` and `diarization_json` columns exist but are not returned by `buildCandidateAnalysis()` | **Low** | Add these fields to the `CandidateAnalysisResult` type and the output builder. Existing callers don't break — they just get new fields. |
| **Callum proposals schema (`callum_proposals` table)** uses `payload_json` for arbitrary config. Adding a `customLevelConfig` field to proposals is just a new payload shape | **Low** | The proposal system already stores arbitrary JSON payloads. No schema migration needed. |

### What we verified will NOT break

- **The AI caller (message route)** is pure server-side. Mode config only affects the frontend shell.
- **The event log (`appendSessionEvent`)** writes events identically regardless of mode.
- **The recording pipeline (analyze, diarize, store)** is fire-and-forget. Mode doesn't touch it.
- **Manager review routes** are independent of mode config.
- **The scenario/pack system** is unchanged. Mode config only determines which UI sections display.
- **DB schema** — no migrations needed. Existing assessments in `in_progress` state will load fine.
- **Existing assessments in the database** — their `assignment_type` column already determines the mode.

**Verdict from code audit:** Low risk. The refactor is mechanical (moving conditionals into a config object), not logical (no new state machine, no new data flows, no new API routes). The only genuinely new code is the hiring layout components (~300 lines).

---

## 3. Architecture: One Engine, Tagged Elements, Callum-Composable Levels

### Core insight: UI flags ARE assessment scope flags

Every UI element maps to a criteria category that gets scored. If the element is hidden, the related criteria should be excluded from scoring. This creates a direct link:

| UI Element | Flag | Criteria Category | When hidden |
|-----------|------|------------------|-------------|
| Ticket queue | `showQueue` | `queue_management` | Not scored — no tickets to manage |
| SLA display | `showSla` | `sla_awareness` | Not scored — no SLA context |
| Priority controls | `showPriorityControls` | `priority_assessment` | Not scored — no priority to set |
| Taxonomy triage | `showTaxonomy` | `ticket_classification` | Not scored — no taxonomy to use |
| Internal/live notes split | `showInternalLiveSplit` | `note_quality` | Only single note scored |
| Remote desktop | `showRemoteDesktop` | `remote_tools` | Not scored — no tools available |
| Handover | `showHandover` | `handover_quality` | Not scored — no handover needed |
| Multi-ticket queue | `showQueue` | `queue_prioritisation` | Not scored — single ticket only |

This means `MODE_CONFIG` should also carry a `scoringScope` that tells the analysis engine which criteria categories to enable:

```typescript
interface ModeConfig {
  // UI controls
  showQueue: boolean;
  showSla: boolean;
  showPriorityControls: boolean;
  showTaxonomy: boolean;
  showInternalLiveSplit: boolean;
  showRemoteDesktop: boolean;
  showFeedbackDuringAttempt: boolean;
  showRetryAfterAttempt: boolean;
  showHandover?: boolean;
  noteStyle: NoteStyle;
  layout: LayoutType;

  // Assessment scope — what gets scored
  scoringScope: {
    enabledCategories: string[];     // e.g. ['call_control', 'diagnosis', 'ticket_quality']
    disabledCategories: string[];    // e.g. ['queue_management', 'handover', 'remote_tools']
    // derived automatically from the UI flags, but can be overridden
  };
}
```

### Tagged elements — Callum agent can compose custom levels

Each element is tagged with an ID that the Callum agent (callumintegration.md) can reference to build custom assessment levels:

```typescript
const ELEMENT_TAGS = {
  ticket_queue:         { id: 'ticket_queue',         criteriaCategory: 'queue_management',      defaultEnabled: false },
  sla_display:          { id: 'sla_display',          criteriaCategory: 'sla_awareness',         defaultEnabled: false },
  priority_controls:    { id: 'priority_controls',    criteriaCategory: 'priority_assessment',   defaultEnabled: false },
  taxonomy_triage:      { id: 'taxonomy_triage',      criteriaCategory: 'ticket_classification', defaultEnabled: false },
  internal_live_split:  { id: 'internal_live_split',  criteriaCategory: 'note_quality',          defaultEnabled: false },
  remote_desktop:       { id: 'remote_desktop',       criteriaCategory: 'remote_tools',          defaultEnabled: false },
  handover:             { id: 'handover',             criteriaCategory: 'handover_quality',      defaultEnabled: false },
  call_conversation:    { id: 'call_conversation',    criteriaCategory: 'call_control',          defaultEnabled: true },
  ticket_note:          { id: 'ticket_note',          criteriaCategory: 'ticket_quality',        defaultEnabled: true },
  retry_attempt:        { id: 'retry_attempt',        criteriaCategory: 'iteration_quality',     defaultEnabled: false },
  feedback_during:      { id: 'feedback_during',      criteriaCategory: 'coachability',          defaultEnabled: false },
};
```

The Callum agent can then generate custom configurations:

```
Callum: "Create a 'Senior Technician Review' level with queue, SLA, taxonomy, and handover."
```

Which produces:
```typescript
{
  id: 'senior_review',
  label: 'Senior Technician Review',
  elements: ['ticket_queue', 'sla_display', 'taxonomy_triage', 'handover', 'call_conversation', 'ticket_note'],
  // scoringScope derived automatically from element → criteriaCategory mapping
}
```

### Three built-in levels + custom

The three presets become:

```typescript
const MODE_CONFIG = {
  hiring: {
    elements: ['call_conversation', 'ticket_note'],
    noteStyle: 'single_support_note',
    layout: 'simple_call',
    scoringScope: {
      enabledCategories: ['call_control', 'diagnosis', 'ticket_quality', 'professionalism'],
      disabledCategories: ['queue_management', 'sla_awareness', 'priority_assessment',
        'ticket_classification', 'remote_tools', 'handover_quality', 'iteration_quality', 'coachability'],
    }
  },

  training_assignment: {
    elements: ['call_conversation', 'ticket_note', 'sla_display', 'priority_controls',
      'taxonomy_triage', 'internal_live_split', 'remote_desktop', 'retry_attempt'],
    noteStyle: 'internal_and_customer_notes',
    layout: 'guided_ticket',
    scoringScope: {
      disabledCategories: ['queue_management', 'handover_quality', 'coachability'],
    }
  },

  training_shift: {
    elements: ['ticket_queue', 'call_conversation', 'ticket_note', 'sla_display',
      'priority_controls', 'taxonomy_triage', 'internal_live_split', 'remote_desktop',
      'handover', 'feedback_during'],
    noteStyle: 'full_service_desk',
    layout: 'shift_console',
    scoringScope: {
      enabledCategories: ['queue_management', 'handover_quality', 'coachability'], // all
    }
  }
};
```

The `scoringScope` feeds directly into the analysis engine: before scoring, filter out criteria whose `category` is in `disabledCategories`. This connects the candidate's UI experience to what they're evaluated on.

---

## 4. Hiring Mode: The Stripped-Back Screen

### What stays shared (same engine, same schema):

| Layer | Component |
|-------|-----------|
| Simulation engine | Scenario runner, state machine, action dispatch |
| AI caller | Conversation generation, mood/emotion tracking |
| Transcript store | Message log, turn tracking |
| Event log | Session events, timeline, evidence tags |
| Ticket note editor | Composer (renders differently per mode) |
| Submit flow | Ticket submission → analysis pipeline |
| Analysis engine | Evidence extraction → scoring → narrative |
| Results view | Candidate-facing results + manager review |
| Manager review | Feedback, calibration, overrides |
| Callum assistant | Proposals, capabilities, contracts |

### What changes per mode (visible shell):

| Element | Hiring | Training Assignment | Training Shift |
|---------|--------|-------------------|----------------|
| Ticket queue | Hidden | Hidden | Full queue |
| Claim workflow | Auto-claimed | Manual | Manual |
| SLA display | Hidden | Visible | Visible |
| Priority controls | Hidden | Visible | Visible |
| Taxonomy triage | Hidden | Visible | Visible |
| Notes split | Single note | Internal + customer | Full service desk |
| Remote desktop | Hidden | Available | Available |
| Handover | Hidden | Hidden | Available |
| Retry | Hidden | Allowed | Hidden |
| Step guidance | Shown | Hidden | Hidden |

### UI naming (don't call it the same thing):

| Internal mode | Manager-facing label |
|---------------|---------------------|
| `hiring` | **Hiring Call** — Quick candidate readiness assessment |
| `training_assignment` | **Training Drill** — Single-ticket practice with feedback |
| `training_shift` | **Training Shift** — Timed multi-ticket simulation |

This creates a clean **product ladder**:

> **Hiring Call** → Can they handle one customer?
> **Training Drill** → Can they handle one ticket properly?  
> **Training Shift** → Can they handle the desk?

---

## 5. Hiring Layout Detail

```
┌──────────────────────────────────────────────────────┐
│  Connexion PSA · Hiring Call                         │
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │  Call Status: Connected to Sarah from Northvale  ││
│  │  Dental  [End Call]                              ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  Customer: Sarah Thompson                            │
│  Company:  Northvale Dental                          │
│  Issue:    "I can't send emails."                    │
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │  Conversation                                     ││
│  │  Sarah: Hi, I'm having trouble with my Outlook —  ││
│  │  it's not sending emails. I need this urgently.   ││
│  │                                                   ││
│  │  [You speak here — voice or type]                 ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │  Your support note                                ││
│  │  [ What happened? What did you check?              ││
│  │    What was the outcome? ]                        ││
│  │                                                   ││
│  │  [Submit for review]                              ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  Optional sidebar (collapsible):                     │
│  Assessment Checklist:                               │
│  ☐ Handle the customer professionally                │
│  ☐ Ask questions to understand the issue             │
│  ☐ Troubleshoot                                      │
│  ☐ Leave a clear note                                │
└──────────────────────────────────────────────────────┘
```

Key differences from current `ServiceDeskSimulatorShell`:
- No ticket queue at all — single-assessment, single-screen
- Call connects automatically — no "answer call" button needed
- No claim workflow — auto-claimed
- No triage/SLA/taxonomy panels
- Single notes area — not split internal/live
- No remote desktop tooling
- Collapsible assessment checklist sidebar (replaces the help guide concept)
- Voice + text input both available
- Submit button at bottom of notes

### How the hiring call flow works:

1. Candidate opens link → sees the customer card + conversation area
2. Customer's opening message is already displayed (pre-seeded)
3. Candidate speaks or types responses — AI customer replies
4. "End Call" button ends the conversation phase
5. Notes area opens — candidate writes support note
6. "Submit for review" fires the analysis pipeline
7. Results displayed inline with the design-a layout

---

## 6. Training Assignment Mode

Similar to the current `ServiceDeskSimulatorShell` for `training_drill` but without the queue:

1. Candidate opens link → sees the ticket detail (metadata + triage + notes + conversation)
2. Answer call → talk to customer
3. Use tools (remote desktop, outlook, browser, cmd) as needed
4. Write internal notes + customer-facing notes
5. Set priority, SLA, taxonomy tags
6. Submit ticket → analysis → results with retry option

The difference from the current code is it's now a mode flag instead of a separate code path. The `showQueue: false` just hides the service board list.

---

## 7. Training Shift Mode

Full queue-based console:
1. Candidate opens link → sees a service board with several tickets
2. Claim one, handle call, use tools, write notes
3. SLA timers ticking
4. Submit → results → next ticket
5. Handover option for incomplete tickets
6. End of shift → summary report

---

## 8. Results Redesign (Same Across All Modes)

All three modes get the same results component (based on design-a layout):

```
┌──────────────────────────────────────────────────────┐
│  RESULTS for Sarah Thompson                          │
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │  SCORE: 72/100          BADGE: Needs Supervision ││
│  │  Evidence quality: 85% · 22 criteria · 5 fw      ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  ┌─────────────────────┬────────────────────────────┐│
│  │ ✅ Strengths        │ ✗ Biggest Misses           ││
│  │ • Identity check ✓  │ • No impact question       ││
│  │ • Issue clarified   │ • Missing scope check      ││
│  ├─────────────────────┼────────────────────────────┤│
│  │ 🎯 Coaching Focus   │ 🎫 Ticket Quality          ││
│  │ • Coach on scope    │ • Impact: missing          ││
│  │ • Coach on urgency  │ • Next step: present       ││
│  └─────────────────────┴────────────────────────────┘│
│                                                      │
│  🔊 Audio Analysis                                   │
│  ┌──────────────────────────────────────────────────┐│
│  │ Duration: 4m 32s · Talk: 62/38 · Silence: 8s    ││
│  │ De-escalation: 85/100 ✓                          ││
│  │ Timeline: ███░░░░███░░█░░████                    ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  🧰 Skills Assessment (expandable)                    │
│  📋 Compliance Standards (expandable)                 │
└──────────────────────────────────────────────────────┘
```

---

## 8. Active Elements in Assessment Output

The mode config determines which elements are visible during the assessment. This information should be recorded so the manager/assessor knows what the candidate was working with.

### Where to surface it

| Surface | How | Why |
|---------|-----|-----|
| **API response** | `GET /assessment/[token]` returns `mode_config: { elements: [...] }` | The frontend knows what was shown |
| **Assessment database row** | Add `mode_config_json` column to `assessments` table, storing the elements array | Permanent record |
| **Transcript view** | In the candidate-facing results, show a badge row: `Active: Call · Note · SLA` | Candidate sees what was assessed |
| **Manager review page** | Same badge row, with tooltip: "Queue disabled — not scored" | Manager understands score scope |
| **Analysis pipeline output** | `AnalysisContext` gets `assessmentScope: { enabledElements, disabledCategories }` | Scoring engine uses it to filter criteria |
| **Evidence timeline** | Tag each `session_event` with the active elements at that time | Audit trail of what was visible |

### Example: results page badge row

```
┌──────────────────────────────────────────────────────────────┐
│  Assessment: Hiring Call                                      │
│  Active elements:                                             │
│  ✅ Call conversation    ✅ Support note                      │
│  ⬜ SLA awareness       ⬜ Ticket taxonomy                    │
│  ⬜ Priority assessment ⬜ Remote tools                       │
│  ⬜ Queue management    ⬜ Handover                           │
│  (Disabled elements were not scored)                          │
└──────────────────────────────────────────────────────────────┘
```

### Data flow

```
assessment created → mode_config_json stored on assessments table
         ↓
GET /assessment/[token] returns mode_config in response
         ↓
Frontend renders SimulationWorkspace from mode_config
         ↓
ticket POST contains mode in body
         ↓
runBaseCallumAnalysis stores mode_config in analysis output
         ↓
Results page displays active elements badge row
```

### What this enables

- **Assessor clarity:** "Why is the queue score zero? Because queue was disabled — the candidate only had one ticket."
- **Apples-to-apples comparison:** Filter results by mode to compare candidates who took the same level.
- **Callum agent transparency:** When Callum generates a custom level, the element list is visible in the results so everyone knows what was active.

---

## 9. Extending the Mode Pattern Across the Codebase

The `workspace/modeConfig.ts` + `elementTags.ts` pattern can apply beyond the assessment shell. Several other parts of the product are currently a single implementation with ad-hoc conditionals.

### 9a. Results view (already partially mode-aware)

The `AssessmentResults` component currently has a `reviewMode` toggle but no mode-based layout variation. The design-a results page (`app/mvp/results/design-a/page.tsx`) has a richer layout that could become the default for training assignments, while hiring gets a simpler results card.

```
ResultsWorkspace mode="hiring"   → Single score + verdict + checklist recap
ResultsWorkspace mode="training" → Full design-a layout with frameworks, evidence, audio
ResultsWorkspace mode="shift"    → Same as training + shift summary (tickets handled, SLA compliance)
```

### 9b. Manager dashboard (`/mvp` page)

The current dashboard (`app/mvp/page.tsx`) shows all assignment types in one queue. A mode-aware dashboard could:

```
DashboardWorkspace mode="hiring"   → Only hiring calls, simple status (pending/reviewed)
DashboardWorkspace mode="training" → All assignment types with filters
DashboardWorkspace mode="shift"    → Shift schedule view + real-time queue
```

### 9c. Standards / settings pages

Manager standards (`manager_standards` table) has monolithic JSON blobs. Mode-aware standards would let managers configure per-level:

```
ManagerStandards mode="hiring"   → Required fields: call_control, ticket_quality
ManagerStandards mode="training" → Required fields: all + sla_awareness, taxonomy
ManagerStandards mode="shift"    → Required fields: all + handover, queue_management
```

### 9d. Callum assistant capabilities

The Callum agent (`lib/mvp/callum/`) can expose mode config as a capability:

```
Callum capability: "assessment_levels"
  └─ levels: ["hiring", "training_assignment", "training_shift", "custom"]
  └─ custom: compose from ELEMENT_TAGS
  └─ scoring: auto-derived from element → criteriaCategory mapping
```

This lets Callum generate proposals like:

> "I recommend a **Training Assignment** with **SLA display**, **Priority controls**, and **Taxonomy triage** enabled, but **Queue** and **Handover** disabled. The candidate will be scored on call control, diagnosis, ticket quality, and professionalism — but NOT on queue management or handover."

### 9e. Shared workspace primitives

The mode pattern suggests a small library of reusable workspace primitives:

| Primitive | Purpose | Used by |
|-----------|---------|---------|
| `workspace/modeConfig.ts` | Define modes, elements, scoring scope | Assessment shell, results, dashboard |
| `workspace/elementTags.ts` | Tag registry with criteria mapping | Callum agent, scoring filter |
| `workspace/SimulationWorkspace.tsx` | Assessment shell | Assessment page |
| `workspace/ResultsWorkspace.tsx` | Results display | Results page |
| `workspace/DashboardWorkspace.tsx` | Manager dashboard | Dashboard page |

### Primitives over monolithic components

The underlying principle: instead of one giant component with conditionals, extract workspaces that each own a domain (assess, results, dashboard) and accept a `mode` prop. The mode config centralises "what to show" and "what to score" in one place.

This is how the rest of the codebase should be organised:

```
lib/mvp/workspace/          ← Shared workspace primitives
  modeConfig.ts               Mode definitions + element registry
  elementTags.ts              Tag → criteriaCategory mapping
  types.ts                    WorkspaceMode, ModeConfig, AssessmentScope

components/mvp/workspace/    ← Workspace components
  SimulationWorkspace.tsx      Assessment shell (hiring / training / shift)
  ResultsWorkspace.tsx         Results display (simple / design-a / shift-summary)
  DashboardWorkspace.tsx       Manager dashboard (simple / full / shift)

app/mvp/                     ← Next.js pages (thin wrappers)
  page.tsx                     → DashboardWorkspace mode={...}
  assessment/[token]/page.tsx  → SimulationWorkspace mode={...}
  results/[id]/page.tsx        → ResultsWorkspace mode={...}
```

Each page is a thin wrapper. The workspace components own the mode logic. The config is the single source of truth for what's visible and what's scored.

---

## 10. How the Scoring Scope Flows Through

```
MODE_CONFIG.hiring.scoringScope
         │
         ▼
  SimulationWorkspace passes `mode` to
  submitTicket API call
         │
         ▼
  POST /api/mvp/assessment/{token}/ticket
  body: { mode: 'hiring', ticket: '...' }
         │
         ▼
  Ticket route reads mode from body,
  passes `scoringScope` to analysis pipeline
         │
         ▼
  runBaseCallumAnalysis() receives
  { enabledCategories, disabledCategories }
         │
         ▼
  Before scoring: filter out criteria
  whose category is in disabledCategories.
  Remove associated fail gates.
         │
         ▼
  Score is computed only on relevant criteria.
  Same engine, adaptive scope.
```

The scoring engine already has category-based grouping (`call_control`, `diagnosis`, `resolution`, `ticket_quality`, `professionalism` in `lib/mvp/analysis/scoring.ts`). We add:
- `queue_management` — ticket queue handling
- `sla_awareness` — SLA-sensitive behaviour
- `priority_assessment` — priority setting
- `ticket_classification` — taxonomy use
- `note_quality` — internal vs customer note discipline
- `remote_tools` — remote desktop proficiency
- `handover_quality` — handover completeness
- `iteration_quality` — learning from retry
- `coachability` — acting on in-session feedback

These new categories only apply when their UI element is enabled. The existing scoring engine doesn't change — it just receives a smaller criteria set.

---

## 11. Implementation Plan

### Step 1: Define Tag Registry + Mode Config

| File | Action |
|------|--------|
| `lib/mvp/workspace/elementTags.ts` | **CREATE** — ELEMENT_TAGS registry, criteria category definitions |
| `lib/mvp/workspace/modeConfig.ts` | **CREATE** — MODE_CONFIG with elements array + derived scoringScope |
| `lib/mvp/workspace/types.ts` | **CREATE** — WorkspaceMode, ModeConfig, AssessmentScope types |

### Step 2: SimulationWorkspace Shell

| File | Action |
|------|--------|
| `components/mvp/workspace/SimulationWorkspace.tsx` | **CREATE** — Reads mode config, renders layout sections |
| `app/mvp/assessment/[token]/page.tsx` | **MODIFY** — Render `<SimulationWorkspace mode={...} />` |
| `app/api/mvp/assessment/[token]/route.ts` | **MODIFY** — Return `mode` field in API, persist `mode_config_json` on DB |
| `components/mvp/simulator/ServiceDeskSimulatorShell.tsx` | **REFACTOR** — Extract reusable sections, remove from routing |

### Step 3: Hiring Layout Components

| Component | Action |
|-----------|--------|
| `CustomerInfoCard` | **NEW** — Minimal card for hiring mode |
| `ConversationArea` | **NEW** — Full-width transcript for hiring |
| `SupportNoteEditor` | **NEW** — Single textarea composer |
| `AssessmentChecklist` | **NEW** — Collapsible 4-point sidebar |

### Step 4: Refactor Shared Components

| Component | Refactor |
|-----------|----------|
| `TicketNotesPanel` | Accept `variant` prop |
| `TicketMetadataPanel` | Accept visibility props |
| `TicketTriagePanel` | Conditional render from flag |
| `WorkArea` | Conditional layout sections (or remove, it's unused) |

### Step 5: Wire Scoring Scope into Analysis

| File | Action |
|------|--------|
| `lib/mvp/analysis/scoring.ts` | Accept `scoringScope` filter parameter (already has optional weights/thresholds — add `scope`) |
| `lib/mvp/analysis/runBaseCallumAnalysis.ts` | Pass scoringScope from assessment mode, add `mode_config_json` to analysis output |
| `app/api/mvp/assessment/[token]/ticket/route.ts` | Accept `mode` in request body, forward to analysis |
| `lib/mvp/analysis/types.ts` | Add `AssessmentScope`, `ActiveElements` types |

### Step 6: Active Elements in Results

| File | Action |
|------|--------|
| `lib/mvp/analysis/runBaseCallumAnalysis.ts` | Include `activeElements` in `buildCandidateAnalysis()` output |
| `components/mvp/results/ActiveElementsBadge.tsx` | **CREATE** — Badge row showing which elements were active |
| `components/mvp/results/DesignResults.tsx` | Render ActiveElementsBadge in results header |
| `components/mvp/query.ts` | Add `mode_config_json` to `FullAssessmentView` |

### Step 7: Audio Analysis in Results

| File | Action |
|------|--------|
| `lib/mvp/analysis/types.ts` | Add `AudioAnalysisResult` type |
| `lib/mvp/analysis/runBaseCallumAnalysis.ts` | Include audio metrics in output |
| `lib/mvp/audio/analyzer.ts` | Add `computeAudioGrade()` helper |
| `components/mvp/results/AudioAnalysisCard.tsx` | **CREATE** — Visual audio card |
| `components/mvp/results/DesignResults.tsx` | Render AudioAnalysisCard |

### Step 8: Scenario Pack for Hiring

| File | Action |
|------|--------|
| `lib/mvp/sim/packs/hiring-exam-standard.ts` | **CREATE** — Domain-agnostic scenario |
| `lib/mvp/sim/packRegistry.ts` | Register pack |
| `scripts/mvp-init-db.mjs` | Seed for hiring_exam |
| `lib/mvp/assignment-types.ts` | Wire to standard pack |

### Step 9: Callum Agent Integration

| File | Action |
|------|--------|
| `lib/mvp/callum/proposals.ts` | Add `customLevelConfig` to proposal payload schema |
| `lib/mvp/callum/capability.ts` | **CREATE** — Expose element tags as composable capabilities |
| `docs/callumintegration.md` | Document element tag registry for agent |

### Step 10: Workspace Primitives for Results + Dashboard

| File | Action |
|------|--------|
| `components/mvp/workspace/ResultsWorkspace.tsx` | **CREATE** — Mode-aware results component |
| `components/mvp/workspace/DashboardWorkspace.tsx` | **CREATE** — Mode-aware dashboard component |
| `app/mvp/results/page.tsx` | **MODIFY** — Use ResultsWorkspace instead of AssessmentResults |
| `app/mvp/page.tsx` | **MODIFY** — Use DashboardWorkspace instead of inline dashboard |

---

## 12. Files to Create

| File | Purpose |
|------|---------|
| `lib/mvp/workspace/elementTags.ts` | ELEMENT_TAGS registry with criteria category mapping |
| `lib/mvp/workspace/types.ts` | WorkspaceMode, ModeConfig, AssessmentScope types |
| `lib/mvp/workspace/modeConfig.ts` | MODE_CONFIG with elements + derived scoringScope |
| `components/mvp/workspace/SimulationWorkspace.tsx` | Unified mode-driven simulation shell |
| `components/mvp/workspace/ResultsWorkspace.tsx` | Mode-aware results component |
| `components/mvp/workspace/DashboardWorkspace.tsx` | Mode-aware dashboard component |
| `components/mvp/workspace/CustomerInfoCard.tsx` | Minimal customer info card for hiring |
| `components/mvp/workspace/SupportNoteEditor.tsx` | Single-textarea note composer for hiring |
| `components/mvp/workspace/AssessmentChecklist.tsx` | Collapsible 4-point checklist sidebar |
| `components/mvp/workspace/ConversationArea.tsx` | Full-width conversation display for hiring |
| `components/mvp/results/DesignResults.tsx` | Client-side design-a results component |
| `components/mvp/results/ActiveElementsBadge.tsx` | Badge row showing active assessment elements |
| `components/mvp/results/AudioAnalysisCard.tsx` | Audio metrics with silence timeline |
| `lib/mvp/callum/capability.ts` | Callum agent capability: compose custom levels from element tags |
| `lib/mvp/sim/packs/hiring-exam-standard.ts` | Domain-agnostic hiring scenario pack |

## 13. Files to Modify

| File | Change |
|------|--------|
| `app/mvp/assessment/[token]/page.tsx` | Render `<SimulationWorkspace mode={...} />` |
| `app/api/mvp/assessment/[token]/route.ts` | Return `mode` + `mode_config` in API response, persist `mode_config_json` |
| `app/api/mvp/assessment/[token]/ticket/route.ts` | Accept `mode` in body, pass to analysis |
| `components/mvp/simulator/TicketNotesPanel.tsx` | Accept `variant` prop (single/split/full) |
| `components/mvp/simulator/TicketMetadataPanel.tsx` | Accept `showSla`, `showPriority` |
| `components/mvp/simulator/TicketTriagePanel.tsx` | Conditionally render based on `showTaxonomy` |
| `components/mvp/simulator/ServiceDeskSimulatorShell.tsx` | Extract reusable sections, deprecate |
| `lib/mvp/analysis/types.ts` | Add AudioAnalysisResult, AssessmentScope, ActiveElements types |
| `lib/mvp/analysis/scoring.ts` | Accept `scoringScope` filter for enabled criteria categories |
| `lib/mvp/analysis/runBaseCallumAnalysis.ts` | Pass scoringScope, include active elements + audio in output |
| `lib/mvp/audio/analyzer.ts` | Add `computeAudioGrade()` helper |
| `lib/mvp/query.ts` | Add `mode_config_json` to `FullAssessmentView` |
| `lib/mvp/sim/packRegistry.ts` | Register hiring pack |
| `lib/mvp/assignment-types.ts` | Wire hiring_exam to standard pack |
| `lib/mvp/callum/proposals.ts` | Add customLevelConfig to proposal payload schema |
| `scripts/mvp-init-db.mjs` | Seed hiring pack as default |
| `docs/callumintegration.md` | Document element tag registry |
| `components/mvp/results/AssessmentResults.tsx` | Replace default view with DesignResults |

## 14. Existing Assets Already in Place (reused as-is)

| Asset | Location | Status |
|-------|----------|--------|
| Audio analyzer | `lib/mvp/audio/analyzer.ts` | Working |
| Speaker diarizer | `lib/mvp/audio/diarizer.ts` | Working (when models present) |
| Turn tracking | `lib/mvp/audio/turns.ts` | Working |
| Emotional trajectory | `lib/mvp/analysis/emotionalState.ts` | Working |
| Recording API | `app/api/mvp/assessment/[token]/recording/route.ts` | Working |
| Evidence extraction | `lib/mvp/analysis/evidencePrompt.ts` | Working |
| Deterministic scoring | `lib/mvp/analysis/scoring.ts` | Working |
| Multi-framework evaluation | `lib/mvp/compliance/evaluator.ts` | Working |
| CallBar | `components/mvp/simulator/CallBar.tsx` | Working |
| VoiceRecorderButton | `components/mvp/voice/VoiceRecorderButton.tsx` | Working |
| CustomerAudioPlayer | `components/mvp/voice/CustomerAudioPlayer.tsx` | Working |
| Caller AI (message route) | `app/api/mvp/assessment/[token]/message/route.ts` | Working |
| Submit flow | `components/mvp/simulator/ServiceDeskSimulatorShell.tsx:submitTicket` | Extract into shared hook |
| Analysis pipeline | `lib/mvp/analysis/runBaseCallumAnalysis.ts` | Working |
| Manager review | Manager feedback routes | Working |
| Callum assistant | `lib/mvp/callum/` | Working |

---

## 15. Refactor Activity Log

### 2026-06-28 — Candidate response foundation

- Started with the low-risk route/contract cleanup before changing the simulator UI.
- Confirmed the worktree already contains unrelated modified Callum/simulator files and untracked route/test artifacts; these are being left intact.
- Target for this pass: remove duplicated candidate-analysis loading from `app/api/mvp/assessment/[token]/route.ts` and introduce a typed helper that later workspace code can reuse.
- Added `lib/mvp/candidate/analysis.ts` to centralize latest result loading, safe JSON parsing, and candidate-safe analysis construction.
- Refactored `app/api/mvp/assessment/[token]/route.ts` so both legacy and sim response branches reuse the same analysis helper.
- Verification: `npx tsc --noEmit` passed.
- Verification: `npm test` passed, 12 test files, 0 failed.
- Added `components/mvp/simulator/useTicketNotes.ts` and moved note tab/draft/internal/live note state out of `ServiceDeskSimulatorShell`.
- Rewired `ServiceDeskSimulatorShell` to use the notes hook while preserving the existing note-posted session events and submit payload.
- Verification: `npx tsc --noEmit` passed after the notes extraction.
- Verification: `npm test` passed after the notes extraction, 12 test files, 0 failed.
- Added `components/mvp/simulator/useTicketSubmission.ts` to own uncertainties, analysis state, review mode, and the `/ticket` submit call.
- Rewired `ServiceDeskSimulatorShell` to use the submission hook while preserving existing submit payload fields and inline results behavior.
- Verification: `npx tsc --noEmit` passed after the submission extraction.
- Verification: `npm test` passed after the submission extraction, 12 test files, 0 failed.
- Added workspace mode primitives in `lib/mvp/workspace/`: `types.ts`, `elementTags.ts`, and `modeConfig.ts`.
- Added additive `assessments.mode_config_json` migration and updated assessment creation to store a frozen mode config snapshot.
- Candidate assessment loading now returns mode metadata through `assignment_runtime.mode` and `assignment_runtime.mode_config`, deriving it for old rows and reading the snapshot for new rows.
- Added a contract test proving assessment creation stores the hiring mode snapshot.
- Verification: `npx tsc --noEmit` passed after mode config wiring.
- Verification: `npm test` passed after mode config wiring, 12 test files, 0 failed.
- Added `components/mvp/workspace/SimulationWorkspace.tsx` as a compatibility wrapper around the existing simulator shell.
- Updated `app/mvp/assessment/[token]/page.tsx` to render through `SimulationWorkspace` and pass mode metadata, without changing current UI behavior.
- Verification: `npx tsc --noEmit` passed after introducing the workspace wrapper.
- Verification: `npm test` passed after introducing the workspace wrapper, 12 test files, 0 failed.
- Added passive workspace fields to `AnalysisContext`: `workspace_mode`, `mode_config`, and `assessment_scope`.
- Populated those fields in `buildAssessmentContext()` from the stored mode snapshot, falling back to current mode config for old rows.
- Scoring and prompts do not consume `assessment_scope` yet; this is plumbing only, so scoring behavior is unchanged.
- Verification: `npx tsc --noEmit` passed after analysis-context mode plumbing.
- Verification: first `npm test` attempt failed because the test command compiles `lib/mvp/analysis/types.ts` directly without the `@/` path alias; changed the new type-only import to a relative path.
- Verification: `npx tsc --noEmit` passed after the import fix.
- Verification: `npm test` passed after the import fix, 12 test files, 0 failed.
- Added `lib/mvp/analysis/criteriaRegistry.ts` to centralize category-to-criterion mappings and display labels that were embedded in `runBaseCallumAnalysis.ts`.
- Updated `runBaseCallumAnalysis.ts` to import category maps and labels from the registry, preserving behavior while giving future scoring-scope work one shared source.
- Verification: `npx tsc --noEmit` passed after the criteria registry extraction.
- Verification: `npm test` passed after the criteria registry extraction, 12 test files, 0 failed.
