# SimPack v1 — Architecture, Engine & Expansion Plan

> Written 2026-06-27. Consolidates all architectural decisions from the Pack Factory v0 planning session.

---

## 0. Core Philosophy

A SimPack is the **single source of truth** for a scenario. It contains everything — who the caller is, how they act, what the issue is, what tools exist, how to score it, what a good ticket looks like. The engines (voice, sim, ticketing, analysis) are runtimes that read from the pack. They do not own scenario logic.

```
SimPack (all content)
  ├──→ Voice Engine: "be this person, act this way"
  ├──→ Sim Engine: "run this state machine, log events"
  ├──→ Ticketing UI: "show this ticket info"
  ├──→ Analysis: "grade against these criteria"
  └──→ Manager Review: "show these 5 category scores"
```

---

## 1. Three-Layer Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   TRAINING SHIFT                            │
│   Queue orchestrator: assigns packs, tracks shift           │
│   progression, unlocks, end-of-shift summary                │
├──────────────────────────────────────────────────────────┤
│                   ASSESSMENT CONTAINER                       │
│   Lifecycle: create → invite → call → remote →             │
│   ticket → analysis → review → calibrate                   │
│   Has frozen snapshot of: pack_id + scoring config +       │
│   difficulty config + manager standards                    │
├────────────────────┬─────────────────────────────────────┤
│  AI CALL ENGINE    │      SIM ENGINE                       │
│  (the caller)      │   (the tools/state machine)          │
│                    │                                        │
│  Reads pack for:   │   Actions + state transitions          │
│  - customer        │   ToolState management                 │
│  - temperament     │   Safe projection                      │
│  - hidden truth    │   Event logging (dual: sim_events +    │
│  - behavior rules  │     session_events)                    │
│  - facts to reveal │                                        │
├────────────────────┴─────────────────────────────────────┤
│                    SIM PACKS                                │
│   Pure scenario data (see §3 for full schema)              │
│   Immutable, versioned, registry-based                     │
│   One file per pack in lib/mvp/sim/packs/                  │
├──────────────────────────────────────────────────────────┤
│                  DIFFICULTY PROFILE                         │
│   archetypeWeights | intensityRange | curveballFreq        │
│   redFlagTolerance | mandatoryCheckpoints |                │
│   aiHelpfulness | scoringStrictness | remoteEnabled        │
│   mode (hiring_exam / training_drill / training_shift)    │
│   manager can override per-assessment                      │
└──────────────────────────────────────────────────────────┘
```

### Why three layers?

- **Engine layer** — swap the voice engine from prompt-based to fine-tuned model without touching packs
- **Pack layer** — add 50 packs without touching any engine code
- **Difficulty layer** — the same pack works for hiring (strict, intensity 2-3), training (lenient, intensity 1-2), and shifts (variable, adaptive)

---

## 2. The Seam: SimPack vs Voice Engine

### SimPack owns (all content):

| Field | Purpose |
|---|---|
| `customer` | Name, company, role, temperament |
| `callerBehavior` | Archetype hints, intensity range, how they react to pressure, what frustrates them, what reassures them, curveball triggers |
| `hiddenTruth` | Root cause, correct fix, ideal diagnostic path, facts revealed by state changes |
| `initialState` | Starting tool states, evidence state, flags |
| `tools` | Available tool IDs |
| `actions` | What each tool does, effects, observations, taxonomy tags, red flags |
| `phases` | Which phases exist (call_only, call_plus_remote, ticket_only, voicemail_plus_ticket) |
| `scoringCriteria` | All criteria with category mapping, weights, check type |
| `rubric` | Category definitions (see §4) |
| `redFlags` | Red flag definitions with severities |
| `idealTicket` | Summary, required fields, must-mention, must-not-invent |
| `diagnosticChecklist` | Steps with criteria references |
| `taxonomyClassification` | Tags for this pack |

### Voice Engine owns (runtime behavior):

- Interpreting pack's `callerBehavior` into natural conversation
- State machine for call flow (Opening → Minimal Disclosure → Active → End)
- Checkpoint tracking (universal MSP skills: get hostname, ask impact, etc.)
- Curveball injection at configured frequency
- Teacher mode
- Post-call feedback report generation
- System prompt construction (reads pack data generically — no pack-specific branches)

The engine is pack-agnostic. It never imports a pack. It receives `pack: SimPack` + `state: SimState` and behaves accordingly.

### Current aiCustomer.ts

Currently at `lib/mvp/sim/aiCustomer.ts`. It:
- Builds a system prompt from pack + state (good pattern)
- Has Outlook-specific hardcoded branches (bad — must fix)
- Has no archetype/intensity/curveball system (must add)

Move to `lib/mvp/voice/engine.ts` and generalize.

---

## 3. SimPack Full Schema

```typescript
interface SimPack {
  id: string;
  version: string;
  title: string;
  description: string;
  level: number;                        // 1, 2, or 3
  severity: 'P1' | 'P2' | 'P3' | 'P4';
  category: string;                     // 'identity', 'connectivity', 'email', 'printing', etc.
  queueTitle: string;                   // What the trainee sees in the queue
  requesterName: string;
  company: string;
  department?: string;
  location?: string;
  contactInfo?: string;

  // Phase configuration
  mode: 'call_only' | 'ticket_only' | 'call_plus_remote' | 'voicemail_plus_ticket';
  phases: SimPhase[];                   // Which phases this pack supports

  // Caller
  customer: SimCustomer;                // Name, company, role, temperament
  callerBehavior: SimCallerBehavior;    // How they act (see §3.1)

  // Scenario
  initialState: SimState;
  hiddenTruth: SimHiddenTruth;          // root cause, correct fix, facts, ideal path
  tools: SimToolId[];
  actions: SimAction[];

  // Scoring
  rubric: SimRubric;                    // Categories with weights
  scoringCriteria: SimPackScoringCriterion[];
  diagnosticChecklist: SimPackDiagnosticStep[];
  redFlags: SimRedFlag[];
  idealTicket: SimIdealTicket;
  taxonomyClassification: string[];     // Tags for this pack

  // Manager review hints
  managerReviewHints: {
    keyCriteria: string[];              // Which criteria matter most
    commonMistakes: string[];
    whatGoodLooksLike: string;
    calibrationNotes: string;
  };
}
```

### 3.1 CallerBehavior

```typescript
interface SimCallerBehavior {
  archetype: 'uncertain' | 'direct' | 'executive';
  intensity: 1 | 2 | 3;               // Default intensity (manager can override)
  intensityRange?: [1, 2] | [2, 3];   // If mode uses variable intensity
  
  // How they respond
  frustrationTriggers: string[];       // e.g. ["too many yes/no questions", "being rushed"]
  reassuranceTriggers: string[];       // e.g. ["clear next steps", "empathy"]
  
  // Revelation behavior
  revealsOnPrompt: boolean;            // Does overshare when asked?
  revealsUnpromptedAt?: number;        // Intensity threshold for unprompted reveals
  
  // Curveball preferences
  curveballProbability: number;        // 0-1
  preferredCurveballs: string[];       // IDs from curveball library their personality fits
  
  // Dialogue style
  verbosity: 'terse' | 'normal' | 'verbose';
  technicalLevel: 'non_technical' | 'somewhat_technical' | 'technical';
  
  // Mood tracking
  initialMood: CustomerMood;
  moodImprovesOn: string[];           // What trainee actions improve mood
  moodWorsensOn: string[];             // What trainee actions worsen mood
}
```

---

## 4. Scoring: 5 Categories × 10

Instead of a single opaque score, every assessment produces scores in 5 categories, each rated 0-10:

| # | Category | What It Measures | Example Criteria |
|---|----------|-----------------|------------------|
| 1 | **Call Control & Communication** | Opening, identity check, tone, empathy, expectation setting | `confirmed_user`, `communication.empathy`, `asked_scope` |
| 2 | **Diagnosis & Investigation** | Root cause, scope, impact, tools used correctly | `checked_status`, `opened_outlook`, `diagnostic.connectivity_verified` |
| 3 | **Resolution & Fix** | Correct fix applied, verification | `disabled_wfo`, `verified_fix`, `fix.correct_root_cause` |
| 4 | **Ticket Quality** | Summary, root cause, impact, next steps | `ticket.root_cause_present`, `ticket.impact_noted`, `ticket.next_step_set` |
| 5 | **Professionalism & Safety** | Red flags avoided, escalation judgment | `avoided_red_flags`, no destructive actions, safe MFA handling |

### Pack defines the mapping

```typescript
SimPackScoringCriterion {
  id: string;
  label: string;
  category: 'call_control' | 'diagnosis' | 'resolution' | 'ticket_quality' | 'professionalism';
  weight: number;                      // Score points (0-100 total across all)
  check: 'action_performed' | 'tag_present' | 'tag_in_event' | 'state_value';
  target: string;
  value?: unknown;
  positive?: boolean;
}
```

The deterministic scorer (`scoreSimEvents`) produces:
```typescript
interface SimScoringResult {
  overallScore: number;                // 0-100 (weighted sum)
  categories: {                        // Each 0-10
    call_control: number;
    diagnosis: number;
    resolution: number;
    ticket_quality: number;
    professionalism: number;
  };
  categoryBreakdown: Record<string, {
    earned: number;
    maxPossible: number;
    criteriaResults: Record<string, 'pass' | 'partial' | 'fail'>;
  }>;
  actionCriteria: Record<string, 'pass' | 'partial' | 'fail'>;
  redFlags: string[];
  timelineSummary: string[];
  technicalPath: string[];
}
```

### Why 5 × 10?

- One number is useless ("57/100 — what does that mean?")
- 5 numbers are immediately actionable ("strong call control, weak diagnosis — focus on root cause investigation")
- Maps cleanly onto existing analysis categories
- Easy to track improvement across shifts
- Manager calibration per-category is natural ("I'd rate diagnosis higher — they did check webmail")

---

## 5. How Difficulty Differentiates Across Modes

Each mode uses a `DifficultyProfile` that can be overridden per-assessment:

```
                    HIRING EXAM    TRAINING DRILL   TRAINING SHIFT
                    ───────────    ──────────────   ──────────────
Intensity range     2-3            1-2              1-3 (varies)
Curveballs          high           low/none          medium
Red flag tolerance  zero           warn + coaching   moderate
Checkpoints         all mandatory  core only         all mandatory
AI helpfulness      minimal        cooperative       realistic
Scoring strictness  strict         lenient           standard
Remote tools        no             yes               yes
Time pressure       real           relaxed           simulated
Pass threshold      80%            60%               70%
```

A manager creating an assessment picks:
1. Mode (inherits profile defaults)
2. Pack (from registry)
3. Optional overrides (e.g., "this trainee is weak on diagnosis — make it intensity 2 and require all diagnostic checkpoints")

The merge at creation time produces a frozen `difficulty_snapshot_json` on the assessment alongside `standards_snapshot_json`.

---

## 6. The Assessment Container (Augmented by Manager)

The pack is pure scenario. The **assessment** is the container that holds the manager's expectations for that specific trainee on that specific scenario. The merge happens once, at assessment creation time:

```
SimPack (scenario defaults)          Manager picks + configures
├── customer                          ├── difficulty profile (mode: training_drill)
├── actions                           ├── scoring overrides (optional)
├── hiddenTruth                       ├── custom checkpoints (optional)
├── scoringCriteria (defaults)        └── picks pack
         │                                    
         └──→ merge at create ──→ frozen in assessment.snapshot
                                       ↑
                              scoreSimEvents() reads from snapshot
                              voice engine reads from snapshot
                              AI analysis reads from snapshot
                              manager review reads from snapshot
```

The assessment stores:
```
assessments {
  id, token, manager_id,
  pack_id,
  snapshot: {                          // Frozen at creation
    scoringCriteria, rubric, redFlags, idealTicket,
    difficultyProfile, callerBehaviorOverrides,
    managerStandards,
    customCheckpoints
  },
  categories_scores: {                 // 5 × 10 scores
    call_control: 7,
    diagnosis: 4,
    resolution: 8,
    ticket_quality: 6,
    professionalism: 9
  },
  overall_score,
  status, created_at, completed_at
}
```

---

## 7. What the Manager Can Customise vs What's the Callum Moat

| MANAGER CAN CHANGE | CALLUM OWNS (moat) |
|---|---|
| Pack selection per assessment | Ideal diagnostic path weights |
| Difficulty profile (easy/medium/hard) | Checkpoint criticality ranking |
| Red flag add/remove/reweight | Curveball content library |
| Scoring criteria weights | Score-to-readiness mapping |
| Custom checkpoints | Teacher mode curriculum |
| Pass/fail thresholds | Calibration feedback loop |
| Assessment mode (hiring/drill/shift) | Evidence extraction prompt chain |
| Number of tickets per shift | Feedback narrative generation |
| Time pressure on/off | Archetype behavioral definitions |
| Intensity override | 5-category scoring algorithm |

The moat is in the **evaluation intelligence** — the deterministic scoring algorithm, the AI analysis prompt chain, the calibration feedback loop, the teacher mode curriculum. A competitor can copy the pack format. They cannot copy the 400+ lines of hardened scoring logic, the evidence extraction chain, and the calibration system that improves over time.

---

## 8. Pack Factory v0 — 10 Packs

### Level 1 — No Remote (Call Only or Ticket Only)

1. **password_reset_account_lockout_l1**
   Tests identity/security handling, impact, expectation setting.
   Red flag: asks for password or MFA code.

2. **new_starter_triage_l1**
   Tests taxonomy classification and qualification.
   Edge case: classification depends on requester/client type.

3. **shared_mailbox_access_l1**
   Tests access request process, authorization checking.
   Red flag: grants access without verifying authorization.

### Level 2 — Remote Introduced

4. **outlook_work_offline_l2**
   Existing pack. Tests remote action explanation, checking status, fixing Work Offline, sending test email, ticket note.

5. **vpn_disconnected_l2**
   Tests whether candidate checks internet, VPN client status, credentials/MFA safely, error message, recent changes.
   Red flag: tells user to bypass MFA or reinstall before basic checks.

6. **wifi_personal_device_l2**
   Tests scope: company device vs personal device, office vs home, one user vs multiple users, business impact.
   Red flag: reboots router or escalates before checking scope.

7. **printer_not_printing_l2**
   Tests printer queue check, spooler service, driver status, physical connection.
   Red flag: reinstalls driver before checking spooler.

### Level 3 — Escalation Judgement

8. **possible_network_outage_l3**
   Tests multi-user scope check, diagnostic isolation, escalation timing.
   Red flag: escalates as outage without checking single-user causes first.

9. **suspected_phishing_l3**
   Tests security awareness, proper reporting process, user reassurance.
   Red flag: clicks link or tells user it's "probably fine."

10. **slow_laptop_after_install_l3**
    Tests recent change investigation, resource monitoring, startup program check.
    Red flag: factory resets without diagnostic evidence.

### Pack creation checklist

Each pack file must define:
- [ ] `PACK_ID` and `getPack()` factory
- [ ] All SimPack fields (see §3)
- [ ] CallerBehavior that fits the scenario
- [ ] 5-15 actions with proper state effects, observations, taxonomy tags
- [ ] 2-4 red flags that test manager-specified safety rules
- [ ] Scoring criteria mapped to the 5 categories
- [ ] Diagnostic checklist
- [ ] Ideal ticket expectations
- [ ] Hidden truth with facts-reveal-after map
- [ ] Registry registration in `packRegistry.ts`

---

## 9. Training Shift v0 (Spec Only — Build After Pack Factory Passes)

### Core Loop

```
Start shift
→ get 3 assigned tickets
→ complete ticket 1
→ auto-review (5 categories × 10)
→ complete ticket 2
→ auto-review
→ complete ticket 3
→ auto-review
→ end-of-shift summary
```

### End-of-shift summary aggregates:
- Completed tickets
- Average score per category across tickets
- Red flags triggered
- Weakest criteria (for recommended next level)
- First-call resolution rate
- Ticket quality average
- Recommended next level

### What Training Shift is NOT yet:
- No random incoming calls
- No real-time scheduling
- No multiple simultaneous tickets
- No calendar invites
- No manager shift planning
- No complex gamification

### Database shape

```sql
CREATE TABLE training_shifts (
  id TEXT PRIMARY KEY,
  trainee_id TEXT NOT NULL,
  manager_id TEXT NOT NULL DEFAULT 'manager-default',
  status TEXT NOT NULL DEFAULT 'in_progress',  -- in_progress | completed
  assigned_pack_ids TEXT NOT NULL,              -- JSON array of 3 pack IDs
  completed_pack_ids TEXT NOT NULL DEFAULT '[]',
  current_index INTEGER NOT NULL DEFAULT 0,
  average_category_scores TEXT,                 -- JSON: 5 × 10 averages
  red_flag_count INTEGER DEFAULT 0,
  recommended_next_level INTEGER,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  summary_json TEXT
);
```

Training Shift is just a queue wrapper around the existing assessment/ticket/sim/scoring engine. The same packs, the same state machine, the same scoring, the same analysis — just sequenced and aggregated.

---

## 10. Why This Architecture Is Ideal for Expansion

### Adding a new pack
One file in `packs/` + one line in registry. Zero engine changes. Zero UI changes. Zero scoring changes. The pack works in all modes (hiring, training, shift) automatically.

### Adding a new mode
One `DifficultyProfile` config entry. All existing packs work immediately.

### Manager custom pack from UI
Form → generates SimPack JSON → registers it. The engine doesn't care where the pack came from.

### Adaptive difficulty
After 5 assessments, system detects "always scores 8+ on intensity 1" → auto-promotes to intensity 2. Pure config change.

### Skill-based routing
Training shift detects "misses diagnosis on 3/3 packs" → next shift includes packs heavy on diagnosis practice. The shift layer just filters the pack pool.

### Real call extraction
Take real MSP transcript → `pack = extractPack(transcript)` → test it. The engine is generic enough to simulate any scenario that fits the schema.

### Multi-player assessments
One Assessment, three sessions (caller, remote, ticket writer). Each uses the same pack with different difficulty profiles. The same scoring engine evaluates each role independently.

### White-label for other MSPs
Packs, difficulty profiles, and manager standards are all data. A different MSP gets different customer names, different custom checkpoints, different severity defaults. The engine + moat logic ships as-is.

### AI model swap
The voice engine is an abstraction. Swap prompt-based → fine-tuned model → real voice without touching packs. The engine interface doesn't change.

---

## 11. Directory Structure (Final)

```
lib/mvp/
├── sim/
│   ├── types.ts                   # Core types (SimPack, SimState, etc.)
│   ├── packRegistry.ts            # Registry mapping pack IDs → factories
│   ├── stateMachine.ts            # Generic state machine
│   ├── scoring.ts                 # Generic scoring (reads pack.scoringCriteria)
│   ├── safeProjection.ts          # Filters hidden state from UI
│   ├── eventLog.ts                # sim_events DB writes
│   ├── timeline.ts                # Timeline builder
│   └── packs/
│       ├── index.ts               # Re-export all pack IDs + factories
│       ├── outlook-work-offline.ts
│       ├── password-reset.ts
│       ├── new-starter-triage.ts
│       ├── shared-mailbox-access.ts
│       ├── vpn-disconnected.ts
│       ├── wifi-personal-device.ts
│       ├── printer-not-printing.ts
│       ├── network-outage.ts
│       ├── suspected-phishing.ts
│       └── slow-laptop-after-install.ts
├── voice/
│   ├── engine.ts                  # CallEngine class
│   ├── archetypes.ts              # Archetype behavioral definitions
│   ├── checkpoints.ts             # Universal MSP checkpoint tracking
│   ├── curveballs.ts              # Friction injection library
│   ├── prompts.ts                 # System prompt builder
│   ├── feedback.ts                # Post-call report generator
│   ├── teacher.ts                 # Teacher mode handler
│   └── types.ts                   # DifficultyProfile, CallerState
├── analysis/
│   ├── scoring.ts                 # AI analysis scoring (the moat)
│   ├── context.ts                 # Build analysis context from assessment
│   ├── evidencePrompt.ts          # Evidence extraction prompt
│   ├── narrativePrompt.ts         # Narrative generation prompt
│   ├── validation.ts              # Output validation
│   ├── hash.ts                    # Input hashing for caching
│   ├── runBaseCallumAnalysis.ts   # Full analysis pipeline
│   └── types.ts                   # Analysis types
└── merge/
    └── mergeAssessmentConfig.ts   # Merge pack + difficulty + manager overrides
```

---

## 12. Key Files to Create/Modify

### New files:
- `lib/mvp/voice/engine.ts` — CallEngine class, read pack data, drive conversation
- `lib/mvp/voice/archetypes.ts` — Behavioral definitions
- `lib/mvp/voice/checkpoints.ts` — Universal checkpoint tracker
- `lib/mvp/voice/curveballs.ts` — Curveball injection logic
- `lib/mvp/voice/prompts.ts` — System prompt builder (generic, no pack branches)
- `lib/mvp/voice/feedback.ts` — Post-call feedback report
- `lib/mvp/voice/teacher.ts` — Teacher mode logic
- `lib/mvp/voice/types.ts` — DifficultyProfile, CallerState, VoiceEvent types
- `lib/mvp/merge/mergeAssessmentConfig.ts` — Merge function
- `lib/mvp/sim/packs/index.ts` — Re-export all packs
- `lib/mvp/sim/packs/password-reset.ts`
- `lib/mvp/sim/packs/new-starter-triage.ts`
- `lib/mvp/sim/packs/shared-mailbox-access.ts`
- `lib/mvp/sim/packs/vpn-disconnected.ts`
- `lib/mvp/sim/packs/wifi-personal-device.ts`
- `lib/mvp/sim/packs/printer-not-printing.ts`
- `lib/mvp/sim/packs/network-outage.ts`
- `lib/mvp/sim/packs/suspected-phishing.ts`
- `lib/mvp/sim/packs/slow-laptop-after-install.ts`
- `scripts/test-pack-factory.mjs`
- `docs/training-shift-v0-spec.md`

### Modify:
- `lib/mvp/sim/types.ts` — Add callerBehavior, category to scoring criteria, level/severity/queueTitle/requesterName fields to SimPack
- `lib/mvp/sim/packRegistry.ts` — Register new packs
- `lib/mvp/sim/packConfig.ts` — Move Outlook pack to packs/ dir, keep as backward compat or remove
- `lib/mvp/sim/scoring.ts` — Add category-level scoring output
- `lib/mvp/sim/aiCustomer.ts` — Move to voice/engine.ts, generalize

---

## 13. Implementation Sequence

### Phase 1: Foundation
1. Extend `SimPack` type with new fields (callerBehavior, category mapping, metadata)
2. Create `lib/mvp/merge/mergeAssessmentConfig.ts`
3. Create `lib/mvp/voice/types.ts` (DifficultyProfile)
4. Add difficulty profiles for each mode to `assignment-types.ts`
5. Wire merge into assessment creation route
6. Wire merged snapshot into scoring + analysis pipelines

### Phase 2: Voice Engine
1. Move aiCustomer.ts → voice/engine.ts, generalize
2. Create archetypes.ts, checkpoints.ts, curveballs.ts
3. Create prompts.ts (no pack-specific branches)
4. Create feedback.ts, teacher.ts
5. Refactor CmdApp, PrinterApp, VpnApp to be state-driven

### Phase 3: Pack Factory
1. Create `packs/` directory structure
2. Move existing Outlook pack into `packs/outlook-work-offline.ts`
3. Build 5 packs minimum (password reset, new starter, Outlook, VPN, WiFi)
4. Register all in packRegistry.ts
5. Write `scripts/test-pack-factory.mjs`
6. Write `docs/test-pack-factory-v0.md`

### Phase 4: Scoring Upgrade
1. Add 5-category output to `scoreSimEvents()`
2. Map all existing scoring criteria to categories
3. Store categories on assessment result
4. Surface in manager review UI

### Phase 5: Training Shift v0 (spec only until packs pass)
1. Write `docs/training-shift-v0-spec.md`
2. Build `training_shifts` table
3. Build shift start/completion API
4. Build end-of-shift aggregator
5. Build queue UI
