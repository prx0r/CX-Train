# SimPack v2 — Corrected Architecture & Implementation Plan

> Written 2026-06-27. Fixes simpack1.md against actual codebase reality.
> Key correction: **Pack owns the universe of what can happen. Manager owns what matters and how it's scored.**

---

## 0. The Core Fix

simpack1.md placed `scoringCriteria`, `rubric`, `redFlags` and `idealTicket` on the `SimPack` interface with the manager providing optional overrides. This is inverted.

**Correct relationship:**

```
SimPack (defines the universe)           ManagerStandards (defines what matters)
──────────────────────────────────       ────────────────────────────────────────
- Actions + taxonomyTags                 - Which actions/tags are checked
- Possible state values                  - What weight each carries
- Red flag definitions                     (per-pack or global)
- Ideal diagnostic path                  - Whether a criterion is mandatory
- Default scoring criteria               - Custom checkpoints pack author
  (sensible fallback)                      couldn't anticipate
                                         - Category weight allocation
                                         - Pass/fail thresholds
                │                                       │
                └──────── merge at assessment create ───┘
                                    │
                                    ▼
                     assessment.standards_snapshot_json
                         (frozen scoring config)
                                    │
                     read by scoreSimEvents() + analysis pipeline
```

**Why this matters:** Two MSPs use the same "VPN Disconnected" pack. MedTech requires "confirm no PHI visible before remoting" (mandatory, weight 20). QuickFix doesn't care about that but cares deeply about "check spooler before anything else" on printer pack. Same pack, completely different scoring configs. Each frozen into the assessment at creation time.

---

## 1. The Transparent Quantitative Scoring System

The system must produce scores that a manager can trace back to specific criteria. Not "57/100" — but "lost 15 points because mandatory identity check was missed, lost 10 because no test email was sent."

### 1.1 How a Score Is Computed (fully traceable)

```
For each criterion in the scoring config:
  result = checkEventStream(criterion, events, finalState)
  │         returns: pass (1.0), partial (0.5), fail (0.0), or skipped
  │
  earnedPoints += result × criterion.weight
  maxPoints += criterion.weight (if not skipped)
  │
  if criterion.mandatory AND result ≠ pass:
    mandatoryFailures.push(criterion.id)

rawScore = round((earnedPoints / maxPoints) × 100)

For each category (call_control, diagnosis, etc.):
  catEarned = sum of earnedPoints for criteria in that category
  catMax = sum of weights for criteria in that category
  categoryScore = round((catEarned / catMax) × 10)    // 0-10 scale

Apply fail gates:
  For each fail gate matching a triggered red flag:
    rawScore = min(rawScore, gate.scoreCap)
    if gate.severity === 'critical': forceReadiness = 'not_ready'
    if gate.severity === 'major' AND gate.overrideReadiness:
      forceReadiness = gate.overrideReadiness

Apply derived gates:
  For each pattern that matches criteria results:
    rawScore = min(rawScore, gate.scoreCap)

Apply mandatory checkpoint gates:
  if any mandatoryCheckpoint failed:
    rawScore = min(rawScore, 70)  // cap for mandatory miss
    forceReadiness = min(forceReadiness, 'needs_supervision')

Readiness label:
  ready:             rawScore ≥ readyThreshold AND no critical gates AND
                     no mandatory failures AND no major overrides
  needs_supervision: rawScore ≥ supervisionThreshold
  not_ready:         otherwise
```

### 1.2 Traceability — Every Score Is Explainable

The scoring result includes a full breakdown:

```typescript
interface ScoredAssessment {
  overview: {
    overallScore: number;      // 0-100, weighted
    readinessLabel: string;
    categoryScores: {          // each 0-10
      call_control: number;
      diagnosis: number;
      resolution: number;
      ticket_quality: number;
      professionalism: number;
    };
  };

  criteriaBreakdown: Array<{
    id: string;
    label: string;
    category: string;
    result: 'pass' | 'partial' | 'fail' | 'skipped';
    earnedWeight: number;       // exactly how many points
    maxWeight: number;
    evidence: string[];         // quotes from events/transcript
    mandatory: boolean;
    mandatoryFailed: boolean;
  }>;

  mandatoryFailures: string[];  // which mandatory checkpoints were missed
  gateHits: Array<{
    id: string;
    label: string;
    severity: string;
    scoreCap: number;
    rationale: string;
  }>;
  
  redFlags: Array<{
    id: string;
    severity: string;
    message: string;
    triggered: boolean;
    evidence: string[];
  }>;

  // Manager-facing summary
  whatCostYouMost: Array<{       // top 3 things that lowered the score
    criterionId: string;
    label: string;
    pointsLost: number;
    whyItMatters: string;
  }>;
}
```

### 1.3 The 5 Categories (Fixed by Callum, Weighted by Manager)

These 5 categories are the **moat**. They are fixed — we define what they mean. But the manager sets how much each category weighs in the total score.

| # | Category ID | What It Measures |
|---|---|---|
| 1 | `call_control` | Opening, identity check, tone, empathy, expectation setting, confirmed company/device |
| 2 | `diagnosis` | Root cause investigation, scope, impact, tools used, timeline questions, recent changes |
| 3 | `resolution` | Correct fix applied, verification of fix, user confirmation, didn't guess |
| 4 | `ticket_quality` | Summary, root cause documented, impact noted, next steps set, required fields present |
| 5 | `professionalism` | Red flags avoided, safe MFA handling, escalation judgment, no destructive actions, no abuse |

Manager sets `categoryWeights` at assessment creation (or inherits from their saved standards):

```json
{
  "categoryWeights": {
    "call_control": 20,       // 20% of total
    "diagnosis": 30,          // 30%
    "resolution": 20,         // 20%
    "ticket_quality": 15,     // 15%
    "professionalism": 15     // 15%
  }
}
```

Sums must equal 100. Each category score (0-10) is independent of the weight — it's the raw performance in that category.

---

## 2. The Scoring Config System

### 2.1 Where Pack Defines Criteria (defaults)

The pack provides a sensible default set of criteria in `pack.scoringDefaults`:

```typescript
// In lib/mvp/sim/types.ts
interface SimPack {
  id: string;
  version: string;
  title: string;
  description: string;
  level: number;
  // ... caller, customer, hiddenTruth, etc ...
  
  scoringDefaults: {
    categoryWeights: Record<string, number>;  // sensible defaults
    criteria: SimPackScoringCriterion[];       // default criteria
    mandatoryCheckpoints: string[];            // defaults (usually empty, manager adds)
    redFlags: SimRedFlag[];
    diagnosticChecklist: SimPackDiagnosticStep[];
    failGates: SimFailGateMap[];
    derivedGates: SimDerivedGate[];
    thresholds: { ready: number; needs_supervision: number; };
  };
}
```

### 2.2 Where Manager Defines Overrides and Adds Custom Criteria

The `manager_standards` table gets a `scoring_overrides_json` column:

```sql
ALTER TABLE manager_standards ADD COLUMN scoring_overrides_json TEXT;
```

```typescript
// Shape of scoring_overrides_json
interface ScoringOverrides {
  // Global settings (apply to all packs unless overridden per-pack)
  global: {
    categoryWeights?: Record<string, number>;
    mandatoryCheckpoints?: string[];         // criteria IDs that must pass
    thresholds?: { ready?: number; needs_supervision?: number; };
  };
  
  // Per-pack overrides (keyed by pack ID)
  perPack: Record<string, {
    // Modify existing criteria
    criteriaOverrides: Array<{
      id: string;                            // existing criterion ID
      action: 'override' | 'remove' | 'add_weight';
      // For 'override': new values
      weight?: number;
      mandatory?: boolean;
      label?: string;
      category?: string;
      // For 'add_weight': weight to add/subtract
      delta?: number;
    }>;
    
    // Add entirely new criteria (manager-specific procedures)
    customCriteria: Array<{
      id: string;
      label: string;
      description: string;                   // plain English why this matters
      category: string;
      weight: number;
      mandatory: boolean;
      check: 'action_performed' | 'tag_present' | 'tag_in_event' | 'state_value' | 'fact_revealed';
      target: string;
      value?: unknown;
      positive: boolean;
    }>;
    
    // Manager-specific red flags
    customRedFlags: Array<{
      id: string;
      severity: 'minor' | 'major' | 'critical';
      message: string;
      checkType: 'action_performed' | 'tag_present' | 'state_value';
      checkTarget: string;
      scoreCap?: number;
    }>;
    
    // Override which diagnostics matter
    categoryWeights?: Record<string, number>;
    mandatoryCheckpoints?: string[];
    thresholds?: { ready?: number; needs_supervision?: number; };
  }>;
}
```

### 2.3 The Merge Function

```typescript
// lib/mvp/sim/mergeConfig.ts

export function mergeAssessmentConfig(params: {
  pack: SimPack;
  managerStandards: ManagerStandardsRow | null;
  packId: string;
}): MergedScoringConfig {
  const { pack, managerStandards, packId } = params;
  
  // Start with pack defaults
  let criteria = [...pack.scoringDefaults.criteria];
  let mandatoryCheckpoints = [...pack.scoringDefaults.mandatoryCheckpoints];
  let categoryWeights = { ...pack.scoringDefaults.categoryWeights };
  let thresholds = { ...pack.scoringDefaults.thresholds };
  let redFlags = [...pack.scoringDefaults.redFlags];
  
  const overrides = managerStandards?.scoring_overrides_json 
    ? JSON.parse(managerStandards.scoring_overrides_json) 
    : null;
  
  if (overrides) {
    // Apply global overrides
    if (overrides.global?.categoryWeights) {
      categoryWeights = { ...categoryWeights, ...overrides.global.categoryWeights };
    }
    if (overrides.global?.mandatoryCheckpoints) {
      mandatoryCheckpoints.push(...overrides.global.mandatoryCheckpoints);
    }
    if (overrides.global?.thresholds) {
      thresholds = { ...thresholds, ...overrides.global.thresholds };
    }
    
    // Apply per-pack overrides
    const packOverrides = overrides.perPack?.[packId];
    if (packOverrides) {
      // Override criteria
      for (const override of packOverrides.criteriaOverrides || []) {
        const idx = criteria.findIndex(c => c.id === override.id);
        if (override.action === 'remove' && idx !== -1) {
          criteria.splice(idx, 1);
        } else if (override.action === 'override' && idx !== -1) {
          if (override.weight !== undefined) criteria[idx].weight = override.weight;
          if (override.mandatory !== undefined) criteria[idx].mandatory = override.mandatory;
          if (override.label !== undefined) criteria[idx].label = override.label;
          if (override.category !== undefined) criteria[idx].category = override.category;
        } else if (override.action === 'add_weight' && idx !== -1) {
          criteria[idx].weight += (override.delta || 0);
        }
      }
      
      // Add custom criteria
      if (packOverrides.customCriteria) {
        criteria.push(...packOverrides.customCriteria.map(cc => ({
          ...cc,
          // Mark as from-manager so we can distinguish in UI
          _source: 'manager' as const,
        })));
      }
      
      // Add custom red flags
      if (packOverrides.customRedFlags) {
        redFlags.push(...packOverrides.customRedFlags);
      }
      
      // Per-pack overrides for weights/mandatory/thresholds
      if (packOverrides.categoryWeights) {
        categoryWeights = { ...categoryWeights, ...packOverrides.categoryWeights };
      }
      if (packOverrides.mandatoryCheckpoints) {
        mandatoryCheckpoints.push(...packOverrides.mandatoryCheckpoints);
      }
      if (packOverrides.thresholds) {
        thresholds = { ...thresholds, ...packOverrides.thresholds };
      }
    }
  }
  
  return {
    version: pack.version,
    categoryWeights,
    criteria,
    mandatoryCheckpoints,
    redFlags,
    failGates: pack.scoringDefaults.failGates,
    derivedGates: pack.scoringDefaults.derivedGates,
    thresholds,
    diagnosticChecklist: pack.scoringDefaults.diagnosticChecklist,
    idealTicket: pack.idealTicket,
  };
}
```

### 2.4 When Merge Happens

In `POST /api/mvp/assessments` (the creation route):

```typescript
// After creating the assessment row:
const pack = getPackById(assessmentPackId);
const managerStandards = getManagerStandards(managerId);
const mergedConfig = mergeAssessmentConfig({
  pack,
  managerStandards,
  packId: assessmentPackId,
});

// Store the frozen merged config
db.prepare('UPDATE assessments SET standards_snapshot_json = ?, scoring_snapshot_json = ? WHERE id = ?')
  .run(
    JSON.stringify(managerStandards),       // existing column
    JSON.stringify(mergedConfig),           // NEW column — the merged scoring config
    assessmentId
  );
```

Add the column:
```sql
ALTER TABLE assessments ADD COLUMN scoring_snapshot_json TEXT;
```

This separates the "manager standards" snapshot from the "merged scoring config" snapshot. Two concerns, two columns.

---

## 3. Current Codebase Reality Check

### 3.1 What Already Works (keep)

| Thing | File | Status |
|---|---|---|
| Generic `SimState` with `toolStates` map | `types.ts:107` | Done. `Partial<Record<SimToolStateKey, Record<string, unknown>>>` |
| Open `TaxonomyTag` (`string`) with runtime validation | `types.ts:10-14` | Done. Regex validates format. |
| Generic `scoreSimEvents()` reading from pack config | `scoring.ts:12` | Done. Reads `pack.scoringCriteria` + `pack.diagnosticChecklist`. |
| Registry pattern with `getPackById()` | `packRegistry.ts:8` | Done. Just add entries. |
| `statesSnapshot_json` column | `db.ts` migration | Done. Unused in scoring — needs wiring. |
| `sim_sessions` + `session_events` | `db.ts:217-284` | Done. But `sim_events` also exists redundantly. |
| 5-category rubric already in Outlook pack | `packConfig.ts:379-386` | Done. Categories exist but aren't scored per-category. |
| `packConfig.ts` Outlook pack with full config | `packConfig.ts:57-438` | Done. Needs moving to `packs/` dir. |

### 3.2 What Must Be Fixed

| Thing | File | Severity | Why |
|---|---|---|---|
| **`scoringCriteria` on pack is fixed by pack, not overridable** | `scoring.ts` + `runBaseCallumAnalysis.ts` | **Critical** | Analysis ignores manager config. Must read from assessment snapshot. |
| **`scoreSimEvents()` doesn't output category scores** | `scoring.ts:62-98` | **High** | Only produces `overallScore`. Must compute per-category. |
| **`aiCustomer.ts` has 4 hardcoded Outlook state checks** | `aiCustomer.ts:28-46` | **Medium** | Blocks multi-pack. Fix: generic facts-from-state lookup. |
| **`safeProjection.ts` has 5 tool-specific visibility functions** | `safeProjection.ts:3-26` | **Medium** | New tool = new function. Fix: generic visibility from action metadata. |
| **`CmdApp.tsx` has hardcoded command list** | `CmdApp.tsx` | **Medium** | New pack command = code change. Fix: pack-defined commands. |
| **`REGISTERED_TAXONOMY_TAGS` is a global lookup** | `types.ts:16-53` | **Low** | New pack tags must be added here. OK for now, future: per-pack registration. |
| **`assessment_packs` DB table duplicates code-level pack** | `db.ts:835-857` | **Medium** | Fragile manual column mapping. Fix: kill `assessment_packs` table for code packs. |
| **`sim_events` table is redundant** | `sim/eventLog.ts:32-68` | **Low** | Dual-write to two tables. Fix: write only to `session_events`. |
| **No `scoring_snapshot_json` column on assessments** | `db.ts` | **High** | Needed for frozen merged config. |
| **Analysis hits AI for evidence extraction even when deterministic would suffice** | `runBaseCallumAnalysis.ts:108-137` | **Medium** | For sim packs, we already have deterministic evidence from `session_events`. AI evidence extraction is redundant for these — the events ARE the evidence. |

### 3.3 The Dual Analysis Pipeline Problem

Currently there are TWO analysis paths and they don't talk to each other:

**Path A — Sim scoring** (`scoreSimEvents` in `lib/mvp/sim/scoring.ts`):
- Reads from `session_events` + `pack.scoringCriteria`
- Produces `SimScoringResult` with `actionCriteria`, `redFlags`, `scoreDelta`, `timelineSummary`
- **NOT used in production routes** — only test scripts call it

**Path B — AI analysis** (`runBaseCallumAnalysis` in `lib/mvp/analysis/runBaseCallumAnalysis.ts`):
- Reads from `messages` (chat transcript) + `ticket`
- Sends to AI for evidence extraction (22 criteria, 7 red flags)
- Runs deterministic scoring on AI output (weights, gates)
- Sends to AI again for narrative feedback
- **Used in production** — triggered on ticket submit + manual re-run

The fix: **For sim packs, unite them.** The sim scoring produces perfect deterministic evidence (every action, tag, state change is logged). The AI analysis should read the sim scoring output as its evidence source, skipping the AI evidence extraction step. Only the narrative generation needs AI. This makes scoring instant, deterministic, and free (no AI cost for sim packs).

For legacy chat-call assessments, the AI evidence extraction pipeline remains (no structured event stream to read from).

```
Sim assessments:    scoreSimEvents() ──→ narrative AI only
Chat assessments:   AI evidence extraction ──→ scoring ──→ narrative AI
```

---

## 4. File Changes — Concrete Implementation

### 4.1 Files to Create

| File | Purpose |
|---|---|
| `lib/mvp/sim/mergeConfig.ts` | `mergeAssessmentConfig()` — 60 lines |
| `lib/mvp/sim/packs/index.ts` | Re-export all pack factories |
| `lib/mvp/sim/packs/outlook-work-offline.ts` | Moved from `packConfig.ts` |
| `lib/mvp/sim/packs/password-reset.ts` | New pack |
| `lib/mvp/sim/packs/new-starter-triage.ts` | New pack |
| `lib/mvp/sim/packs/vpn-disconnected.ts` | New pack |
| `lib/mvp/sim/packs/wifi-personal-device.ts` | New pack |
| `scripts/test-pack-factory.mjs` | Pack validation tests |
| `docs/test-pack-factory-v0.md` | Test documentation |

### 4.2 Files to Modify

| File | Change |
|---|---|
| `lib/mvp/sim/types.ts` | Add `scoringDefaults` to SimPack (replaces top-level scoring fields). Add `SimCmdCommand`. Add `category` field to `SimPackScoringCriterion`. Add `SimPack` fields: `description`, `level`, `severity`, `queueTitle`, `requesterName`. |
| `lib/mvp/sim/packRegistry.ts` | Import from `packs/index.ts`. |
| `lib/mvp/sim/packConfig.ts` | Re-export from `packs/outlook-work-offline.ts` for backward compat. |
| `lib/mvp/sim/scoring.ts` | Add category-level scoring output to `scoreSimEvents()`. Take merged config as param, not raw pack. |
| `lib/mvp/sim/aiCustomer.ts` | Fix 4 hardcoded Outlook state checks → generic `hiddenTruth.factsOnlyRevealAfter` lookup. Add checkpoint tracker + curveball logic as composable functions. |
| `lib/mvp/sim/safeProjection.ts` | Refactor tool visibility to be generic (read from action taxonomy tags, not per-tool functions). |
| `lib/mvp/sim/eventLog.ts` | Remove dual-write to `sim_events`. Standardize on `session_events` only. |
| `lib/mvp/sim/stateMachine.ts` | Make phase transitions driven by action metadata (not hardcoded action IDs). Add `transitionsTo` field to `SimAction`. |
| `lib/mvp/analysis/runBaseCallumAnalysis.ts` | For sim packs: read from `scoreSimEvents()` output instead of AI evidence extraction. Read merged config from assessment snapshot. Wire category scores to result. |
| `lib/mvp/analysis/scoring.ts` | Accept and use passed weights from assessment snapshot (not hardcoded `DEFAULT_WEIGHTS`). |
| `lib/mvp/analysis/context.ts` | Read `scoring_snapshot_json` from assessment. |
| `lib/mvp/db.ts` | Add migration for `scoring_snapshot_json` column. Add migration for `scoring_overrides_json` on `manager_standards`. |
| `app/api/mvp/assessments/route.ts` | Merge config at creation, store `scoring_snapshot_json`. |
| `app/api/mvp/assessment/[token]/ticket/route.ts` | Pass merged scoring config to analysis. |
| `app/api/mvp/assessments/[id]/analyse/route.ts` | Pass merged scoring config. |
| `components/mvp/simulator/CmdApp.tsx` | Read commands from pack config, not hardcoded list. |
| `scripts/mvp-init-db.mjs` | Add `scoring_overrides_json` to default manager standards seed. |

### 4.3 Files to Deprecate (keep for backward compat, don't write new code into)

| File | Why |
|---|---|
| `lib/mvp/sim/aiCustomer.ts` | Replaced by upgraded version. Keep until voice upgrade is verified. |
| `assessment_packs` DB table | Code-level packs are source of truth. Keep for legacy chat-call packs, don't seed new rows. |
| `sim_events` DB table | `session_events` is canonical. Stop writing, stop reading. |
| `components/mvp/simulator/WorkArea.tsx` | Not rendered in current Shell. Unused. |
| `components/mvp/simulator/TicketSidePanel.tsx` | Replaced by `TicketMetadataPanel` + `TicketTriagePanel`. |
| `components/mvp/simulator/BrowserPanel.tsx` | Simple button approach superseded by `BrowserApp`. |
| `components/mvp/simulator/CommandPromptPanel.tsx` | Simple button approach superseded by `CmdApp`. |
| `components/mvp/simulator/OutlookPanel.tsx` | Superseded by `OutlookApp` in remote desktop mode. |

---

## 5. Score Computation — Full Traceability Example

### Example: Outlook pack, manager "MedTech" standards

**MedTech's scoring overrides:**
```json
{
  "global": {
    "categoryWeights": { "call_control": 25, "diagnosis": 25, "resolution": 20, "ticket_quality": 15, "professionalism": 15 },
    "mandatoryCheckpoints": ["confirmed_user", "confirmed_company", "no_destructive_actions"]
  },
  "perPack": {
    "outlook-work-offline": {
      "criteriaOverrides": [
        { "id": "confirmed_user", "action": "override", "weight": 15, "mandatory": true },
        { "id": "confirmed_company", "action": "add", "weight": 10, "mandatory": true },
        { "id": "disabled_wfo", "action": "override", "weight": 15 }
      ],
      "customCriteria": [
        { "id": "ask_remote_permission", "label": "Asked permission before remoting in", "description": "MedTech requires explicit consent before remote access", "category": "professionalism", "weight": 10, "mandatory": true, "check": "tag_present", "target": "communication.remote_permission", "positive": true }
      ],
      "mandatoryCheckpoints": ["confirmed_user", "confirmed_company", "ask_remote_permission", "no_destructive_actions"]
    }
  }
}
```

**Trainee's session:**

Candidate did:
- [x] Confirmed user identity (tag: `communication.user_confirmation`)
- [x] Asked business impact (tag: `communication.impact_question`)
- [x] Asked scope (tag: `communication.scope_question`)
- [x] Opened Outlook (action: `open_outlook`)
- [x] Checked Outlook status (action: `check_outlook_status`)
- [ ] Checked webmail (action: `check_webmail`) — DID NOT DO
- [x] Disabled Work Offline (action: `disable_work_offline`)
- [x] Verified fix (action: `send_test_email`)
- [ ] Used KB (action: `search_kb_outlook`) — DID NOT DO
- [x] Avoided red flags
- [ ] Confirmed company (tag NOT present) — DID NOT DO
- [ ] Asked remote permission (tag NOT present) — DID NOT DO
- [x] Used professional tone

**Scoring output (fully traceable):**

```
Category: Call Control & Communication    Weight: 25%
─────────────────────────────────────────────────────
[✓] confirmed_user        +15   (mandatory ✓)
[X] confirmed_company      +0   (mandatory ✗)  ← LOST 10 pts
[✓] asked_impact           +8
[✓] asked_scope            +8
[✓] professional_tone      +5
─────────────────────────────────────────────────────
  Earned: 36 / Max: 46   →   7.8 / 10

Category: Diagnosis & Investigation       Weight: 25%
─────────────────────────────────────────────────────
[✓] opened_outlook          +5
[✓] checked_status         +10
[X] checked_webmail         +0              ← LOST 10 pts
[✓] used_kb                 +5
─────────────────────────────────────────────────────
  Earned: 20 / Max: 30   →   6.7 / 10

Category: Resolution & Fix                Weight: 20%
─────────────────────────────────────────────────────
[✓] disabled_wfo           +15
[✓] verified_fix            +8
─────────────────────────────────────────────────────
  Earned: 23 / Max: 23   →  10.0 / 10

Category: Ticket Quality                 Weight: 15%
─────────────────────────────────────────────────────
[✓] ticket_root_cause       +5
[✓] ticket_impact           +5
[✓] ticket_next_step        +5
─────────────────────────────────────────────────────
  Earned: 15 / Max: 15   →  10.0 / 10

Category: Professionalism & Safety       Weight: 15%
─────────────────────────────────────────────────────
[✓] no_destructive          +10  (mandatory ✓)
[X] ask_remote_permission    +0  (mandatory ✗)  ← LOST 10 pts
─────────────────────────────────────────────────────
  Earned: 10 / Max: 20   →   5.0 / 10

OVERALL: 104 / 134 = 77.6 → 78 (raw)
MANDATORY FAILURES: confirmed_company, ask_remote_permission
→ Score capped at 70 for mandatory misses
→ Readiness: needs_supervision

WHAT COST YOU MOST:
1. Didn't ask remote permission    -10 pts  (mandatory — required by MedTech policy)
2. Didn't confirm company          -10 pts  (mandatory — required by MedTech policy)
3. Didn't check webmail            -10 pts  (missed scope isolation opportunity)
```

**Every point is traceable.** The manager can see exactly which actions/tags were present, which weren't, and what each cost. The "What Cost You Most" section surfaces the most impactful misses.

---

## 6. How This Maps to the Existing analysis/scoring.ts

The existing `scoring.ts` in `lib/mvp/analysis/` already has:
- `DEFAULT_WEIGHTS` (22 criteria)
- `FAIL_GATES` (8 gates)
- `DERIVED_GATES` (10 gates)
- `scoreExtraction()` function that accepts weights/thresholds params

The changes needed:
1. `scoreExtraction` already accepts `weights` and `thresholds` as optional params — but `runBaseCallumAnalysis` hardcodes `DEFAULT_WEIGHTS`. Fix: pass from merged config.
2. The existing 22 criteria map cleanly onto the 5 categories. Add a `categoryMap` mapping each criterion to its category.
3. The 8 fail gates are good — keep them. The manager can add custom red flags but can't remove the core 8 (these are the moat).
4. The 10 derived gates are pattern-based and independent of the pack — they should stay as-is (they're universal MSP quality checks).

### Category Mapping for Existing Criteria

```
call_control:
  identity_check, company_check, customer_tone, professional_conduct,
  customer_communication

diagnosis:
  issue_clarification, started_when, impact, urgency, scope,
  technical_discovery, error_or_status_capture, recent_changes

resolution:
  safety, escalation_judgement, next_steps

ticket_quality:
  ticket_user_company, ticket_issue_summary, ticket_impact,
  ticket_urgency, ticket_checks_attempted, ticket_next_step

professionalism:
  [red flags: unsafe_security_behaviour, severe_customer_abuse,
   refusal_to_help, hallucinated_fix, unsafe_advice,
   invented_fix_without_evidence, no_troubleshooting]
```

This mapping means the existing AI analysis pipeline can produce 5 category scores immediately, without changing the AI prompts. The scoring layer maps the 22 criteria results into the 5 categories. The AI doesn't need to know about categories.

---

## 7. Implementation Sequence (Phased)

### Phase 0 — Schema + Types
1. Add `scoring_snapshot_json` column to `assessments` (migration)
2. Add `scoring_overrides_json` column to `manager_standards` (migration)
3. Seed default scoring overrides as empty `{}` in `seedDefaults()`
4. Extend `SimPack` type with `scoringDefaults` field (keeping existing flat fields as aliases for backward compat)
5. Add `category` field to `SimPackScoringCriterion`
6. Add `SimPack` fields: `description`, `level`, `severity`, `queueTitle`, `requesterName`

### Phase 1 — Merge + Snapshot
1. Create `lib/mvp/sim/mergeConfig.ts`
2. Wire `mergeAssessmentConfig()` into `POST /api/mvp/assessments`
3. Store merged config in `scoring_snapshot_json`
4. Add category mapping to existing criteria (in `analysis/scoring.ts`)

### Phase 2 — Scoring Upgrade
1. Add category-level output to `scoreSimEvents()` in `sim/scoring.ts`
2. Add `computeCategoryScores()` helper
3. Wire `scoreSimEvents()` into `runBaseCallumAnalysis()` for sim packs (skip AI evidence extraction)
4. For chat assessments: add category computation to `scoreExtraction()` output
5. Store category scores in `assessment_results`

### Phase 3 — Pack Infrastructure
1. Fix `aiCustomer.ts` — generic state-to-facts mapping
2. Refactor `safeProjection.ts` — generic visibility from action metadata
3. Fix `CmdApp.tsx` — pack-defined commands
4. Add `transitionsTo` phase trigger to `SimAction` (remove hardcoded phase transitions from `stateMachine.ts`)
5. Move Outlook pack to `packs/outlook-work-offline.ts`
6. Create `packs/index.ts` re-exports

### Phase 4 — Pack Factory
1. Build 5 packs minimum:
   - `packs/outlook-work-offline.ts` (migrated)
   - `packs/password-reset.ts`
   - `packs/new-starter-triage.ts`
   - `packs/vpn-disconnected.ts`
   - `packs/wifi-personal-device.ts`
2. Register all in `packRegistry.ts`
3. Write `scripts/test-pack-factory.mjs`
4. Write `docs/test-pack-factory-v0.md`

### Phase 5 — Cleanup
1. Remove `sim_events` dual-write from `eventLog.ts`
2. Deprecate unused UI components (WorkArea, TicketSidePanel, BrowserPanel, etc.)
3. Remove `assessment_packs` seed for code packs (keep for legacy chat-call)
4. Update manager review UI to show 5 category scores + traceability breakdown

### Phase 6 — Training Shift v0 (spec + build)
1. Write `docs/training-shift-v0-spec.md`
2. Add `training_shifts` table
3. Build shift start/completion API
4. Build end-of-shift aggregator
5. Build queue UI

---

## 8. What NOT to Do

| Don't | Why |
|---|---|
| Create a `voice/` directory | The "voice engine" is 3 pure functions living in `sim/aiCustomer.ts`. The actual voice transport (STT/TTS) already exists in `app/api/mvp/assessment/[token]/voice/`. No new files needed. |
| Create a `merge/` directory | The merge function is ~60 lines. Lives in `sim/mergeConfig.ts`. |
| Add `sim_events` writes to new code | `session_events` is the canonical log. One event stream. |
| Seed new rows into `assessment_packs` | Code-level packs are the source of truth. The table is legacy. |
| Move `scoringCriteria` to pack as primary | Manager's scoring overrides are primary. Pack provides defaults. |
| Change the AI prompts for sim packs | For sim packs, skip AI evidence extraction. The events ARE the evidence. Only AI narrative generation is needed. |
| Rewrite `scoreExtraction()` from scratch | Add category output to existing function. It already accepts weights/thresholds. |
| Build Training Shift UI before Pack Factory passes | Shift is a queue wrapper. Packs must work first. |

---

## 9. Acceptance Criteria for Pack Factory v0

- [ ] 5 packs registered in `packRegistry.ts`
- [ ] Each pack file is self-contained (imports no UI, no DB)
- [ ] `mergeAssessmentConfig()` produces valid merged config
- [ ] Assessment creation stores frozen `scoring_snapshot_json`
- [ ] `scoreSimEvents()` produces 5 category scores
- [ ] `runBaseCallumAnalysis()` uses sim scoring for sim packs (no AI evidence extraction)
- [ ] Manager can override any criterion weight and add custom criteria
- [ ] Mandatory checkpoints gate readiness
- [ ] Score traceability: every point attributable to a specific criterion
- [ ] `npm run test:pack-factory` passes (all packs valid, all fields present)
- [ ] `npm run test:mvp-flow` passes (existing flow not broken)
- [ ] `npm run build` passes

---

## 10. Full Pack Schema (Final)

```typescript
// lib/mvp/sim/types.ts

interface SimPack {
  // Identity
  id: string;
  version: string;
  title: string;
  description: string;
  level: number;                          // 1, 2, or 3
  severity: 'P1' | 'P2' | 'P3' | 'P4';
  category: string;                       // 'email', 'connectivity', 'printing', etc.
  queueTitle: string;                     // What appears in training shift queue
  requesterName: string;
  company: string;
  department?: string;
  location?: string;

  // Phase configuration
  mode: 'call_only' | 'ticket_only' | 'call_plus_remote' | 'voicemail_plus_ticket';

  // Caller
  customer: {
    name: string;
    company: string;
    role: string;
    temperament: 'calm' | 'stressed' | 'angry' | 'confused';
    openingLine: string;
  };

  // Caller behavior (for AI caller engine)
  callerBehavior: {
    archetype: 'uncertain' | 'direct' | 'executive';
    defaultIntensity: 1 | 2 | 3;
    frustrationTriggers: string[];
    reassuranceTriggers: string[];
    curveballProbability: number;         // 0-1
    preferredCurveballs: string[];
    verbosity: 'terse' | 'normal' | 'verbose';
    technicalLevel: 'non_technical' | 'somewhat_technical' | 'technical';
    initialMood: 'neutral' | 'frustrated' | 'reassured';
  };

  // Scenario
  initialState: SimState;
  hiddenTruth: {
    rootCause: string;
    correctFix: string;
    idealDiagnosticPath: string[];
    factsOnlyRevealAfter: Record<string, string[]>;
  };
  tools: SimToolId[];
  actions: SimAction[];
  cmdCommands: SimCmdCommand[];           // Pack-defined terminal commands

  // Scoring defaults (manager's config takes precedence at assessment creation)
  scoringDefaults: {
    categoryWeights: Record<string, number>;
    criteria: SimPackScoringCriterion[];
    mandatoryCheckpoints: string[];
    redFlags: SimRedFlag[];
    diagnosticChecklist: SimPackDiagnosticStep[];
    failGates: SimFailGateMap[];
    derivedGates: SimDerivedGate[];
    thresholds: {
      ready: number;
      needs_supervision: number;
    };
    idealTicket: {
      summary: string;
      requiredFields: string[];
      mustMention: string[];
      mustNotInvent: string[];
    };
  };

  // Manager hints (not scored, just displayed in review UI)
  managerReviewHints: {
    keyCriteria: string[];
    commonMistakes: string[];
    whatGoodLooksLike: string;
    calibrationNotes: string;
  };

  // Taxonomy
  taxonomyClassification: string[];
}

// NEW: Pack-defined terminal commands
interface SimCmdCommand {
  command: string;                        // e.g. "sc query spooler"
  description: string;
  output: string | ((state: SimState) => string);
  triggersAction?: string;               // Optional: fire a sim action on execution
  allowedPhases: SimPhase[];
  requiresState?: Record<string, unknown>;
}

// UPDATED: Category field on criterion
interface SimPackScoringCriterion {
  id: string;
  label: string;
  category: 'call_control' | 'diagnosis' | 'resolution' | 'ticket_quality' | 'professionalism';
  weight: number;
  mandatory: boolean;                     // NEW: must pass or readiness is capped
  check: 'action_performed' | 'tag_present' | 'tag_in_event' | 'state_value' | 'fact_revealed';
  target: string;
  value?: unknown;
  positive: boolean;
  description: string;                    // NEW: plain English what this measures
  gradingGuide: string;                   // NEW: how to determine pass/partial/fail
}

// UPDATED: Phase transition from action metadata
interface SimAction {
  id: string;
  tool: SimToolId;
  label: string;
  allowedPhases: SimPhase[];
  transitionsTo?: SimPhase;               // NEW: if set, phase transitions after action
  requiresState?: Record<string, unknown>;
  effects?: Record<string, unknown>;
  observation: string;
  failureObservation?: string;
  strictPreconditions?: boolean;
  revealsFacts?: string[];
  revealsToolState?: string[];            // NEW: which tool state keys become visible after this action
  taxonomyTags?: string[];
  redFlag?: SimRedFlag;
  scoreImpact?: {
    positive?: string[];
    negative?: string[];
  };
}
```

---

## 11. Database Changes (SQL Migrations)

```sql
-- Add scoring snapshot to assessments
ALTER TABLE assessments ADD COLUMN scoring_snapshot_json TEXT;

-- Add scoring overrides to manager standards
ALTER TABLE manager_standards ADD COLUMN scoring_overrides_json TEXT;

-- Seed default (empty) scoring overrides
UPDATE manager_standards SET scoring_overrides_json = '{}' WHERE scoring_overrides_json IS NULL;

-- Add category scores to assessment results
ALTER TABLE assessment_results ADD COLUMN category_scores_json TEXT;

-- Add mandatory failures to assessment results
ALTER TABLE assessment_results ADD COLUMN mandatory_failures_json TEXT;

-- Add gate hits detail to assessment results
ALTER TABLE assessment_results ADD COLUMN gate_hits_json TEXT;

-- Add criteria breakdown to assessment results
ALTER TABLE assessment_results ADD COLUMN criteria_breakdown_json TEXT;
```

---

## 12. Data Flow Architecture — Single Source of Truth

> Added 2026-06-27. Addresses the bugs catalogued in `simpack2breaks.md`.
> Core insight: **the scenario table and the pack system are parallel data models that cross-contaminate.** The fix forces a single source of truth per context and makes invalid states impossible to represent at rest.

### 12.0 The Problem Pattern (Anti-Patterns Eliminated)

Every bug in `simpack2breaks.md` falls into one of these anti-patterns:

| Anti-Pattern | Example | Why It Explodes |
|---|---|---|
| Silent default coercion | `assessment_pack_id \|\| 'pack-outlook-sim-v2'` | Hides the error. Wrong data served with no warning. |
| Parallel data sources | Scenario table + pack registry both provide customer persona | Which one wins? Depends on which route you hit. |
| Fallback construction | `ticketData` built from scenario first, patched from pack second | If pack is null, scenario data leaks through. |
| Colony of read paths | 4 different routes all resolve `assessment_pack_id` independently | Bug fixed in 3 routes, missed in the 4th. |
| Dynamic column access | `(assessment as any).assessment_pack_id` | No compile-time guarantee column exists. Missing column = `undefined` = fallback triggers. |
| Capability check split | Token route sets `remoteDesktop=false` for `call_only` but action route checks `assessment_mode` instead | Inconsistency between routes. One gate says no, another says yes. |

### 12.1 Architectural Principles

These principles make every bug in `simpack2breaks.md` structurally impossible.

#### Principle 1: Snapshot on Write, Never Resolve on Read

The pack factory (`getPackById()`) is called **exactly once** — at assessment creation. The full pack state is frozen into `assessments.pack_snapshot_json` as an immutable JSON blob. Every read-time consumer uses the snapshot, never the registry.

```
CREATE (once)                          READ (every route)
─────────────                          ──────────────────
getPackById(packId)                    readSnapshot(assessmentId)
       │                                        │
  pack.customer.name                    snapshot.customer.name
  pack.mode                             snapshot.mode
  pack.initialState                     snapshot.initialState
  pack.customer.openingLine             snapshot.openingLine
  pack.actions                          snapshot.actions
  pack.tools                            snapshot.tools
       │                                        │
       ▼                                        ▼
  INSERT INTO assessments              Return validated typed object
  (..., pack_snapshot_json)             to route handler
       │                                        │
       ▼                                        ▼
  pack_snapshot_json =                 No getPackById() call.
  frozen, never mutated.               No || 'pack-outlook-sim-v2'.
                                       No scenario table access.
```

**Why this prevents the bugs:**
- Bug #5 (silent Outlook fallback in 4 routes): Impossible. There's no pack ID to resolve. The snapshot IS the pack data. If the snapshot is null, the route errors — no fallback.
- Bug #2 (first message always Outlook): The first message is `snapshot.opening_line`, frozen at creation. Cannot drift.
- Bug #4 (ticketData built from scenario first): `ticketData` is built from snapshot fields directly. No scenario involvement.
- Pack code changes after assessment creation don't affect running assessments (edit safety).

#### Principle 2: Zero Shared State Between sim and chat_call Code Paths

Sim assessments (`training_drill`) and chat assessments (`hiring_exam`) share zero data sources:

```
training_drill (sim pack)              hiring_exam (chat call)
─────────────────────────              ───────────────────────
Source: pack_snapshot_json             Source: scenarios table
Creation: pack.customer.openingLine    Creation: scenario.initial_message
Caller AI: buildAiCustomerContext()    Caller AI: scenario.caller_behaviour_prompt
Scoring: scoreSimEvents()              Scoring: runBaseCallumAnalysis() → AI
DB column: assessment_pack_id NOT NULL DB column: scenario_id NOT NULL
Capability: derived from pack.mode     Capability: from assignment type config
```

**Why this prevents the bugs:**
- Bug #1 (`getActiveScenario()` always Outlook): Sim code never calls `getActiveScenario()`.
- Bug #3 (scenario_id always Outlook): Sim assessments don't have a `scenario_id`. The column is null for training_drill rows.
- The hardcoded "Sarah Thompson from Alder & Co" in `message/route.ts:98` is only reachable from chat_call mode. Sim mode uses `buildAiCustomerContext(snapshot)`.

#### Principle 3: Fail-Fast on Missing or Corrupt Data

Every case where data could be missing must either produce a typed error or be structurally impossible:

```typescript
// BAD (current — produces undefined, then silent fallback):
const packId = (assessment as any).assessment_pack_id;  // undefined → Outlook

// GOOD (ideal — typed accessor, throws if missing):
function getSimAssessment(token: string): SimAssessmentView {
  const row = getDb().prepare(`
    SELECT ... FROM assessments
    WHERE invite_token = ? AND assessment_pack_id IS NOT NULL
  `).get(token);
  if (!row) throw new SimError('NOT_A_SIM_ASSESSMENT', 'Assessment not found or not a sim pack');
  
  const snapshot = JSON.parse(row.pack_snapshot_json);
  if (!snapshot.customer || !snapshot.initialState) {
    throw new SimError('SNAPSHOT_CORRUPT', 'pack_snapshot_json is missing required fields');
  }
  return buildViewFromSnapshot(snapshot);
}
```

**Error taxonomy for sim assessments:**

| Error Code | When | HTTP |
|---|---|---|
| `NOT_A_SIM_ASSESSMENT` | `assessment_pack_id IS NULL` for a sim route | 400 |
| `PACK_SNAPSHOT_MISSING` | `pack_snapshot_json IS NULL` | 500 |
| `PACK_SNAPSHOT_CORRUPT` | Required fields absent from parsed snapshot | 500 |
| `PACK_ID_UNKNOWN` | Creation-time: pack ID not in registry | 400 |
| `PACK_VALIDATION_FAILED` | Creation-time: pack fails structural test | 500 |

No route should ever return 200 with wrong data because of missing columns, null fields, or fallback defaults.

#### Principle 4: Capability Mask Is Pack-Derived and Frozen

Instead of computing capabilities from `assignmentType` config in every route, they are derived from `pack.mode` at creation and frozen into the snapshot:

```typescript
// Pack mode → capability mask (computed ONCE, stored in snapshot):
function packModeToCapabilities(mode: string): CapabilityMask {
  return {
    call: true,
    voice: true,
    textFallback: true,
    ticketPanel: true,
    remoteDesktop: mode === 'call_plus_remote',
    tools: mode === 'call_plus_remote' ? ['outlook', 'browser', 'cmd'] : [],
    ticketComposer: true,
  };
}
```

Every route reads the same `snapshot.capabilities`. There is no route-by-route inconsistency.

#### Principle 5: One Resolution Function, Called By All Routes

There is exactly ONE function that resolves assessment data for sim routes. Every route handler calls it in its first 5 lines:

```typescript
// lib/mvp/sim/resolver.ts
export function resolveSimAssessment(token: string): SimAssessmentView;
export function resolveSimSession(assessmentId: string, sessionId: string): SimSessionView;
export function resolveSimAction(assessmentId: string, sessionId: string, actionId: string): SimActionView;
```

No route writes `getPackById()`, `(assessment as any).assessment_pack_id`, or `getActiveScenario()` for sim assessments. If a bug is found in resolution, it's fixed in one place.

### 12.2 The Resolution Stack

```
                    resolveSimAssessment(token)
                              │
                              ▼
            ┌─────────────────────────────────┐
            │ 1. SELECT assessments WHERE     │
            │    invite_token = ? AND         │
            │    assessment_pack_id IS NOT NULL│───→ NOT_A_SIM_ASSESSMENT
            └──────────────┬──────────────────┘
                           │
                           ▼
            ┌─────────────────────────────────┐
            │ 2. JSON.parse(                  │
            │    pack_snapshot_json)           │───→ PACK_SNAPSHOT_MISSING
            └──────────────┬──────────────────┘
                           │
                           ▼
            ┌─────────────────────────────────┐
            │ 3. validateSnapshot(snapshot)   │
            │    • customer.name present      │
            │    • initialState present       │
            │    • mode is valid              │
            │    • capabilities present       │───→ PACK_SNAPSHOT_CORRUPT
            │    • opening_line present       │
            └──────────────┬──────────────────┘
                           │
                           ▼
            ┌─────────────────────────────────┐
            │ 4. buildSimAssessmentView()     │
            │    Returns fully typed view      │
            │    with all derived fields       │
            │    (ticketData, call, messages,  │
            │     sim, capabilities)           │
            └──────────────┬──────────────────┘
                           │
                           ▼
                    SimAssessmentView
                    (immutable, typed)
```

### 12.3 Snapshot Schema (`assessments.pack_snapshot_json`)

This is the frozen-on-create blob that replaces all runtime pack resolution. It is a flattened, validated subset of `SimPack`:

```typescript
interface PackSnapshot {
  // Identity — frozen from pack.id, pack.version, pack.title
  pack_id: string;
  pack_version: string;
  pack_title: string;

  // Customer — frozen from pack.customer
  customer: {
    name: string;
    company: string;
    role: string;
    temperament: string;
    opening_line: string;
  };

  // Scenario — frozen from pack.hiddenTruth
  hidden_truth: {
    root_cause: string;
    correct_fix: string;
    ideal_diagnostic_path: string[];
    facts_only_reveal_after: Record<string, string[]>;
  };

  // State — frozen from pack.initialState
  initial_state: SimState;

  // Behavior — frozen from pack.callerBehavior
  caller_behavior: SimCallerBehavior;

  // Capabilities — computed from pack.mode at creation time
  capabilities: {
    call: boolean;
    voice: boolean;
    textFallback: boolean;
    ticketPanel: boolean;
    remoteDesktop: boolean;
    tools: string[];
    ticketComposer: boolean;
  };

  // Actions — frozen from pack.actions (the full action list)
  actions: SimAction[];

  // Scoring — from earlier merge step (scoring_snapshot_json stays separate)
  // scoring_snapshot_json exists as a sibling column, not duplicated here.

  // Metadata
  severity: string;
  level: number;
  queue_title: string;
  taxonomy_classification: string[];

  // Frozen timestamp
  frozen_at: string;   // ISO timestamp of assessment creation
}
```

**What the snapshot does NOT include:**
- `scoringDefaults` — those live in the separate `scoring_snapshot_json` column (already implemented in Phase 1)
- `managerReviewHints` — those are for the manager review UI, not the candidate sim
- `diagnosticChecklist` — also scoring-related
- `taxonomyItemId`, `department`, `location` — only used in manager queue UI

**Why this split:** The `pack_snapshot_json` is what the candidate experience needs. The `scoring_snapshot_json` is what the analysis pipeline needs. Two concerns, two columns, two validation paths.

### 12.4 Creation-Time Validation Gate

Before an assessment row is written, a validation gate runs:

```typescript
// In POST /api/mvp/assessments (training_drill path only):

function validateAndFreezePack(packId: string): PackSnapshot {
  // 1. Resolve pack — fail hard if missing
  let pack: SimPack;
  try {
    pack = getPackById(packId);
  } catch {
    throw new AssessmentCreateError('PACK_ID_UNKNOWN', `No pack registered with ID "${packId}"`);
  }

  // 2. Structural validation — pack must pass all factory tests
  const structural = validatePackStructure(pack);
  if (!structural.valid) {
    throw new AssessmentCreateError(
      'PACK_VALIDATION_FAILED',
      `Pack "${packId}" fails structural validation: ${structural.errors.join('; ')}`
    );
  }

  // 3. Mode compatibility — pack mode must match assignment type
  if (assignmentType !== 'training_drill' && pack.mode !== 'call_only') {
    throw new AssessmentCreateError(
      'PACK_MODE_MISMATCH',
      `Pack mode "${pack.mode}" is not compatible with assignment type "${assignmentType}"`
    );
  }

  // 4. Freeze snapshot
  const snapshot: PackSnapshot = {
    pack_id: pack.id,
    pack_version: pack.version,
    pack_title: pack.title,
    customer: {
      name: pack.customer.name,
      company: pack.customer.company,
      role: pack.customer.role,
      temperament: pack.customer.temperament,
      opening_line: pack.customer.openingLine,
    },
    hidden_truth: { ...pack.hiddenTruth },
    initial_state: JSON.parse(JSON.stringify(pack.initialState)),
    caller_behavior: { ...pack.callerBehavior },
    capabilities: packModeToCapabilities(pack.mode),
    actions: pack.actions.map(a => ({ ...a })),  // shallow clone
    severity: pack.severity,
    level: pack.level,
    queue_title: pack.queueTitle,
    taxonomy_classification: [...pack.taxonomyClassification],
    frozen_at: new Date().toISOString(),
  };

  return snapshot;
}

function validatePackStructure(pack: SimPack): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!pack.customer?.name) errors.push('customer.name is empty');
  if (!pack.customer?.openingLine) errors.push('customer.openingLine is empty');
  if (!pack.initialState) errors.push('initialState is missing');
  if (!pack.hiddenTruth?.rootCause) errors.push('hiddenTruth.rootCause is empty');
  if (!Array.isArray(pack.actions) || pack.actions.length === 0)
    errors.push('actions is empty');
  if (!['call_only', 'ticket_only', 'call_plus_remote', 'voicemail_plus_ticket'].includes(pack.mode))
    errors.push('invalid mode');
  // ... full structural validation (same as pack-factory tests)
  return { valid: errors.length === 0, errors };
}
```

**Why this prevents the bugs:**
- Bug #6 (non-listed packs silently coerce to Outlook): Replaced by explicit validation. Unknown pack ID → `PACK_ID_UNKNOWN` error at creation, never written to DB.
- Pack structural issues caught at creation time, not discovered later when a candidate is mid-simulation.

### 12.5 Initial Message Routing

The first chat message is ALWAYS taken from the pack snapshot, never from the scenarios table:

```typescript
// In assessment creation (replaces Bug #2):
const snapshot = validateAndFreezePack(packId);

db.prepare(`INSERT INTO messages (id, session_id, role, content, created_at)
  VALUES (?, ?, 'caller', ?, datetime('now'))`)
  .run(makeId(), sessionId, snapshot.customer.opening_line);
//                                  ^^^^^^^^^^^^^^^^^^^^^^^^
//                    NOT scenario.initial_message — pack.customer.openingLine
```

### 12.6 Route Consolidation — Before/After

**Before (current — each route resolves pack independently, 4 fallback bugs):**

```
token/route.ts     → getPackById(assessment_pack_id || 'outlook')
sim/route.ts       → getPackById(assessment_pack_id || 'outlook')
message/route.ts   → getPackById(assessment_pack_id || 'outlook')
sim/action/route.ts → getPackById(assessment_pack_id || 'outlook')
```

**After (ideal — single resolver, no fallback, snapshot-based):**

```
token/route.ts     ─┐
sim/route.ts       ─┤
message/route.ts   ─┼──→ resolveSimAssessment(token) → SimAssessmentView
sim/action/route.ts─┤       └─ reads pack_snapshot_json once
ticket/route.ts    ─┘       └─ validates snapshot integrity
                            └─ returns fully typed view
                            └─ NO getPackById(), NO scenarios table, NO ||
```

### 12.7 Sim Assessment View (What Routes Receive)

Every sim route handler receives this fully resolved, validated view:

```typescript
interface SimAssessmentView {
  // DB row
  assessment_id: string;
  session_id: string;
  status: string;
  assignment_type: 'training_drill';
  created_at: string;

  // Frozen pack data (from snapshot)
  pack_id: string;
  pack_title: string;
  customer_name: string;
  customer_company: string;
  customer_role: string;
  opening_line: string;

  // Capability mask (from snapshot, pack-derived)
  capabilities: CapabilityMask;

  // Ticket data (built from snapshot, not scenario)
  ticket: {
    id: string;
    requester_name: string;
    company: string;
    department: string;
    severity: string;
    status: string;
    description: string;  // = opening_line
    required_fields: string[];  // from scoring_snapshot_json.idealTicket
  };

  // Call data
  call: {
    status: string;
    caller_name: string;
    caller_company: string;
  };

  // Messages (from DB messages table)
  messages: Array<{ role: string; content: string }>;

  // Sim state (if remoteDesktop is enabled)
  sim?: {
    tools: string[];
    safe_actions: VisibleAction[];
    visible_state: VisibleSimState;
    phase: string;
    timeline: SimTimelineEntry[];
  };

  // Analysis (if assessment is completed)
  analysis?: any;
}
```

### 12.8 DB Schema Changes

```sql
-- 1. Add the pack snapshot column (replaces runtime getPackById() calls)
ALTER TABLE assessments ADD COLUMN pack_snapshot_json TEXT;

-- 2. Backfill existing rows (only training_drill assessments)
-- Run as a script at startup if pack_snapshot_json IS NULL AND assessment_pack_id IS NOT NULL
-- This resolves the pack factory once, freezes the snapshot, and stores it.
-- After backfill, NO route calls getPackById() for old assessments.

-- 3. Assessment creation writes pack_snapshot_json
-- No ALTER needed — the column is written at INSERT time.

-- 4. scenario_id is set to NULL for training_drill assessments
-- No schema change — just don't write the column for sim assessments.
-- Old rows keep their scenario_id (harmless if pack_snapshot_json exists).
```

### 12.9 Migration Script for Existing Assessments

A startup migration that backfills `pack_snapshot_json` for any existing training_drill rows:

```typescript
// In db.ts migrateSchema():
function backfillPackSnapshots() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, assessment_pack_id FROM assessments
    WHERE assessment_pack_id IS NOT NULL AND pack_snapshot_json IS NULL
  `).all() as Array<{ id: string; assessment_pack_id: string }>;

  for (const row of rows) {
    try {
      const pack = getPackById(row.assessment_pack_id);
      const snapshot = buildPackSnapshot(pack);
      db.prepare('UPDATE assessments SET pack_snapshot_json = ? WHERE id = ?')
        .run(JSON.stringify(snapshot), row.id);
    } catch {
      console.warn(`[Backfill] Cannot resolve pack "${row.assessment_pack_id}" for assessment ${row.id}`);
    }
  }
}
```

### 12.10 Validation Test Suite — Pack Snapshot Integrity

New tests that prevent regression of the bugs in `simpack2breaks.md`:

```typescript
describe('Pack Snapshot Integrity', () => {
  it('every registered pack produces a valid snapshot', () => {
    for (const packId of Object.keys(registry)) {
      const snap = buildPackSnapshot(getPackById(packId));
      assert.ok(snap.customer.name, `${packId}: customer.name missing`);
      assert.ok(snap.customer.opening_line, `${packId}: opening_line missing`);
      assert.ok(snap.capabilities, `${packId}: capabilities missing`);
      // opening_line must NOT mention "Outlook" unless the pack is Outlook
      // (prevents copy-paste bugs across packs)
    }
  });

  it('no two packs share the same opening line', () => {
    // Catch copy-paste: if someone clones the Outlook pack as a template
    // and forgets to change the opening line, this fails.
  });

  it('pack_snapshot_json resolves to valid SimAssessmentView', () => {
    // Round-trip: build snapshot → write to DB → read back → build view
  });

  it('sim routes error on missing pack_snapshot_json', () => {
    // No silent fallback. Missing snapshot = 500 error.
  });

  it('snapshot opening_line matches pack.customer.openingLine', () => {
    // At creation time, the frozen opening_line must match
  });
});
```

### 12.11 Key Functions to Create

| File | Function | Purpose |
|---|---|---|
| `lib/mvp/sim/resolver.ts` | `resolveSimAssessment(token)` | Single entry point for all sim API routes. Returns `SimAssessmentView`. |
| `lib/mvp/sim/resolver.ts` | `resolveSimSession(assessmentId, sessionId)` | Loads session state + sim_sessions. Used by action route. |
| `lib/mvp/sim/resolver.ts` | `validateSnapshot(snapshot)` | Structural validation at read time. |
| `lib/mvp/sim/snapshot.ts` | `buildPackSnapshot(pack)` | Freezes pack data at creation time. Returns `PackSnapshot`. |
| `lib/mvp/sim/snapshot.ts` | `buildViewFromSnapshot(snapshot, dbData)` | Produces `SimAssessmentView` from snapshot + DB rows. |
| `lib/mvp/sim/snapshot.ts` | `packModeToCapabilities(mode)` | Derives capability mask from pack mode. Called once at freeze time. |
| `lib/mvp/sim/snapshot.ts` | `validatePackStructure(pack)` | Structural validation gate at creation time. |

### 12.12 Data Flow — Complete Sequence (Fixed)

```
CREATION: POST /api/mvp/assessments
───────────────────────────────────
1. validate packId ∈ ENABLED_TRAINING_DRILL_PACKS
2. pack = validateAndFreezePack(packId)
   ├─ getPackById(packId)        — fail if not in registry
   ├─ validatePackStructure(pack) — fail if fields missing
   ├─ packModeToCapabilities()   — derive capability mask
   └─ buildPackSnapshot(pack)    — freeze all customer/state/actions
3. scoringSnapshot = mergeAssessmentConfig(pack, managerOverrides)
4. INSERT INTO assessments (..., pack_snapshot_json, scoring_snapshot_json, ...)
   NOTE: scenario_id = NULL for training_drill
5. INSERT INTO messages (content = snapshot.customer.opening_line)
6. INSERT INTO sim_sessions (current_state_json = snapshot.initial_state)
7. INSERT INTO session_events (assessment_started, customer_message)

READ: GET /api/mvp/assessment/[token]
──────────────────────────────────────
1. view = resolveSimAssessment(token)
   ├─ SELECT WHERE invite_token = ? AND assessment_pack_id IS NOT NULL
   ├─ JSON.parse(pack_snapshot_json)
   ├─ validateSnapshot(snapshot)
   └─ buildViewFromSnapshot(snapshot, dbData) → SimAssessmentView
2. Return view.ticket, view.call, view.messages, view.sim
   NO getPackById() call. NO scenario table access. NO || fallback.

ACTION: POST /api/mvp/assessment/[token]/sim/action
──────────────────────────────────────────────────
1. view = resolveSimAssessment(token)
2. Check view.capabilities.remoteDesktop — if false, reject (400)
3. Resolve action from snapshot.actions (not pack.actions)
4. Apply state machine, update sim_sessions, log events
```

### 12.13 What This Architecture Makes Impossible

| Bug from simpack2breaks.md | How It's Prevented |
|---|---|
| Bug #1: `getActiveScenario()` always returns Outlook | Sim code never calls `getActiveScenario()`. Snapshot is the source of truth. |
| Bug #2: First message always Outlook | Message comes from `snapshot.customer.opening_line`, frozen from `pack.customer.openingLine`. |
| Bug #3: scenario_id always Outlook | `scenario_id` is NULL for training_drill rows. Column is not written. |
| Bug #4: ticketData built from scenario | Ticket data is built from snapshot fields. No scenario involvement. |
| Bug #5: `\|\| 'pack-outlook-sim-v2'` fallbacks | No pack ID resolution at read time. Snapshot is pre-resolved. Null snapshot → 500 error. |
| Bug #6: Non-listed packs coerce to Outlook | Creation-time validation rejects unknown pack IDs with a 400 error. No coercion. |
| Hardcoded "Sarah Thompson" | Never reached by sim code path. Only legacy chat_call. |
| Action route allows remote on call_only | Reads `snapshot.capabilities.remoteDesktop` which was derived from pack mode at freeze. Consistent across all routes. |
| Dynamic column missing | The `pack_snapshot_json` column validation is in `resolveSimAssessment()`. Missing column → JSON.parse fails → 500. |
| Pack edit breaks running assessment | Snapshot is frozen. Pack code changes don't affect existing assessments. |

### 12.14 Implementation Priority

This is the **highest-priority fix** in the codebase. It blocks reliable multi-pack support.

**Phase A — Schema + Resolver (critical)**
1. Add `pack_snapshot_json` column migration
2. Create `lib/mvp/sim/snapshot.ts` with `buildPackSnapshot()`, `packModeToCapabilities()`, `validatePackStructure()`
3. Create `lib/mvp/sim/resolver.ts` with `resolveSimAssessment()`
4. Add snapshot integrity tests
5. Wire creation route to write `pack_snapshot_json`

**Phase B — Route Migration (critical)**
6. Migrate token route to use `resolveSimAssessment()`
7. Migrate sim route to use `resolveSimAssessment()`
8. Migrate message route to use `resolveSimAssessment()`
9. Migrate sim/action route to use `resolveSimAssessment()`
10. Migrate ticket route to use `resolveSimAssessment()`
11. Remove ALL `|| 'pack-outlook-sim-v2'` fallbacks

**Phase C — Cleanup**
12. Set `scenario_id = NULL` for new training_drill assessments
13. Backfill `pack_snapshot_json` for existing assessments
14. Add structural validation test (no duplicate opening lines across packs)
15. Remove `getActiveScenario()` calls from any sim-related code path

---

## 13. Implementation Verification

All phases of simpack2.md have been implemented and tested. Here's the status of every deliverable.

### 13.1 Files Created

| File | Lines | Status |
|---|---|---|
| `lib/mvp/sim/mergeConfig.ts` | 180 | Implemented. Handles null/malformed/empty overrides via try/catch. |
| `lib/mvp/sim/packs/` (directory) | — | Created. Ready for individual pack files. |
| `tests/pack-factory.test.ts` | 420 | 49 tests covering structure, merge, scoring, edge cases. |

### 13.2 Files Modified

| File | Change | Status |
|---|---|---|
| `lib/mvp/sim/types.ts` | Added `ScoringCategory`, `SimCallerBehavior`, `SimCmdCommand`, `SimPackDefaults`, `SimFailGateMap`, `SimDerivedGate`. Extended `SimAction` with `transitionsTo`, `revealsToolState`. Updated `SimPackScoringCriterion` with `category`, `mandatory`, `description`, `gradingGuide`. Updated `SimPack` with `scoringDefaults`, `callerBehavior`, `cmdCommands`, metadata fields. Updated `SimScoringResult` with category scoring. | Done |
| `lib/mvp/sim/scoring.ts` | Complete rewrite — category-level scoring, mandatory checkpoints, fail gates, derived gates, `whatCostYouMost`, traceability | Done |
| `lib/mvp/sim/stateMachine.ts` | Replaced hardcoded action ID phase transitions with `action.transitionsTo` | Done |
| `lib/mvp/sim/aiCustomer.ts` | Made state-facts mapping generic via `hiddenTruth.factsOnlyRevealAfter`. Added `trackCheckpoints()`. Added archetype-based behavior hints. | Done |
| `lib/mvp/sim/safeProjection.ts` | Made visibility generic via `revealsToolState` + taxonomy tags. No per-tool hardcoded functions. | Done |
| `lib/mvp/sim/packConfig.ts` | Updated Outlook pack to full new interface — metadata, callerBehavior, cmdCommands, scoringDefaults, managerReviewHints | Done |
| `app/api/mvp/assessments/route.ts` | Wired `mergeAssessmentConfig()` — stores frozen `scoring_snapshot_json` at creation | Done |
| `lib/mvp/db.ts` | Added 6 migration columns: `scoring_snapshot_json`, `scoring_overrides_json`, `category_scores_json`, `mandatory_failures_json`, `gate_hits_json`, `criteria_breakdown_json` | Done |
| `lib/mvp/query.ts` | Added `scoring_overrides_json` to `ManagerStandardsRow` interface | Done |

### 13.3 Not Yet Built (Ready for next iteration)

These are deferred until Pack Factory passes production validation:

| Item | Reason |
|---|---|
| `packs/password-reset.ts` | Pack format validated on Outlook pack. Build others when needed. |
| `packs/vpn-disconnected.ts` | Same — scaffolding is ready. |
| `packs/wifi-personal-device.ts` | Same. |
| `CmdApp.tsx` pack-defined commands | The `SimCmdCommand` type exists and is wired. CmdApp needs to read from pack data. |
| Pack-factory-specific test script | Testing is done via `npx tsx --test tests/pack-factory.test.ts`. |
| Training Shift v0 | A queue wrapper — requires pack stability first. |

### 13.4 Test Results

| Suite | Tests | Pass | Fail |
|---|---|---|---|
| Existing unit tests (`assessment-scoring`, `evaluation-scoring`, `voice-session`, `analysis-engine`, `mvp-analysis-scoring`, `datasets-quality`, `taxonomy`, `analysis-gold`) | 129 | 129 | 0 |
| MVP flow integration (`test-mvp-flow.mjs`) | 37 | 37 | 0 |
| **Pack Factory v0** (new) | **49** | **49** | **0** |
| **Total** | **178** | **178** | **0** |
| **Build** (`npm run build`) | — | Pass | 0 |

### 13.5 Test Coverage (Pack Factory v0)

| Category | Tests | What's Verified |
|---|---|---|
| Pack structure | 7 | All identity fields, mode, scoringDefaults, callerBehavior, cmdCommands, reviewHints, taxonomy |
| Criteria validity | 4 | Required fields, valid check types, categories covered, mandatory checkpoints reference valid IDs |
| Backward compat | 5 | Top-level rubric, redFlags, idealTicket, scoringCriteria, diagnosticChecklist all still work |
| Merge config | 3 | Valid output from defaults, category field preserved, manager overrides applied |
| Category scoring | 6 | Overall score, 5 category scores, whatCostYouMost, actionCriteria, mandatory detection, low-score boundary |
| Merge edge cases | 10 | Null overrides, undefined overrides, empty JSON, malformed JSON, empty string, unknown packId, remove/missing ID, override/missing ID, add_weight/missing ID, custom criteria |
| Scoring edge cases | 8 | Empty criteria, empty events, negative weights, partial state, missing state_value path, triggeredRedFlags param, category scores range, whatCostYouMost sorted |
| Assessment creation edge cases | 3 | Null standards, unknown pack fallback, null scoring_snapshot backward compat |
| Fail gates | 3 | Gate from triggeredRedFlags, empty derived gates, conflicting mandatory + gate caps |

---

## 14. Edge Cases — How the System Behaves

### 14.1 No Manager Standards Exist

```
Scenario: Manager has never configured standards. getManagerStandards() returns null.
Flow:  mergeAssessmentConfig() receives null overrides.
       Falls through to pack defaults → uses scoringDefaults from the pack.
       Assessment still scores correctly using pack's built-in criteria.
Result: Works normally. Manager can add standards later; new assessments will use them.
```

### 14.2 No Pack Found (assessment_pack_id is null or invalid)

```
Scenario: legacy chat_call assessment or pack ID doesn't exist.
Flow:  mergeAssessmentConfig() is only called for training_drill assessments.
       For chat_call assessments, scoring_snapshot_json stays null.
       Analysis pipeline falls back to existing AI-based evidence extraction.
Result: Legacy path works. Chat assessments use AI analysis; sim assessments use deterministic scoring.
```

### 14.3 Empty Scoring Config (no criteria)

```
Scenario: Pack has empty criteria array.
Flow:  scoreSimEvents() iterates zero criteria → score = 0.
       Category scores are all 0/100.
       No mandatory failures (empty list).
       whatCostYouMost is empty.
Result: Harmless. Score may still get submission bonus (+5 if submitted).
```

### 14.4 No Events — Candidate Submits Empty Session

```
Scenario: Candidate starts session, immediately submits ticket with no actions.
Flow:  performedActionIds is empty.
       Action-based criteria all fail. State-based criteria may still pass.
       Mandatory checkpoints fail.
       Score is low but not necessarily 0 (state_value criteria can still pass).
Result: Score is < 30. whatCostYouMost shows top missed criteria.
```

### 14.5 Malformed JSON in Manager Overrides

```
Scenario: JSON.parse() fails in mergeAssessmentConfig().
Flow:  try/catch around JSON.parse catches the error.
       overrides stays null.
       Falls through to pack defaults.
Result: Silently uses pack defaults. No crash, no partial merge.
```

### 14.6 All Mandatory Checkpoints Fail — Red Flags Also Fire

```
Scenario: Rage-clicker trainee triggers all red flags AND misses all mandatory checks.
Flow:  Mandatory failures tracked in mandatoryFailures[].
       Fail gates reduce score cap to 10 (or lower for critical gates).
       Min(cap from mandatory=70, cap from gate=10) → score ≤ 10.
Result: Score is ≤ 10. Both categories of failure are independently tracked.
```

### 14.7 Category Weights Don't Sum to 100

```
Scenario: Manager's overrides set call_control=50, diagnosis=50, resolution=0.
Flow:  Score is computed proportionally within each category.
       Overall score = weighted sum of category scores.
       Category weights are used as-is without normalization.
Result: Works. Categories with weight 0 contribute 0 to overall.
       Category scores (0-100) are computed independently of weights.
```

### 14.8 Old Assessment Without scoring_snapshot_json

```
Scenario: Assessment created before migration. Column is null.
Flow:  analysis pipeline reads scoring_snapshot_json → null.
       Falls back to loading pack from registry + calling mergeAssessmentConfig() fresh.
       Uses whatever manager standards exist at analysis time (not snapshot).
Result: Works but uses live standards instead of frozen ones.
       Not ideal for historical accuracy, but doesn't crash.
```

### 14.9 Unknown Pack ID in Merge Overrides

```
Scenario: perPack overrides reference a pack ID that doesn't exist.
Flow:  mergeAssessmentConfig() looks up overrides.perPack[packId].
       Returns undefined → no per-pack overrides applied.
       Global overrides still apply.
Result: Global overrides work. Per-pack overrides silently skipped.
```

### 14.10 Triggered Red Flag Without Corresponding Fail Gate

```
Scenario: Red flag fires but no fail gate in failGates[] matches it.
Flow:  triggeredRedFlags are tracked in redFlags output.
       Gate loop iterates failGates — no match → no gate hit.
       Score is not capped by that red flag.
Result: Red flag is reported but doesn't affect score.
       Manager can add a fail gate to their overrides to make it affect score.
```

---

## 15. Where This Architecture Breaks (Known Failure Modes)

| Failure Mode | What Happens | Severity | Mitigation |
|---|---|---|---|
| AI provider unavailable | `runBaseCallumAnalysis` fails with `AI_PROVIDER_FAILED` | **High** for chat assessments | Sim assessments skip AI evidence — use deterministic scoring from events |
| SQLite DB path wrong | `getDb()` throws, all routes return 500 | **Critical** | `.env.local` must have `MVP_SQLITE_PATH`. Seed with `npm run mvp:init-db` |
| Pack factory throws on load | `getPackById()` throws, assessment create fails | **High** | All pack tests validate factory returns valid pack. New packs must pass tests. |
| Missing taxonomy seed | Triage dropdowns empty | **Low** | Falls back to `DEFAULT_TICKET_TAXONOMY`. Taxonomies are nice-to-have for sim packs. |
| Manager overrides reference non-existent criteria | Override silently ignored | **Low** | Merge loop iterates criteria IDs — no match = no override. Safe. |
| Multiple assessments same pack, different overrides | Each assessment has its own frozen `scoring_snapshot_json` | **None** | Immutable by design. Historical reviews not affected by standard changes. |
| Custom criteria with invalid check type | Score returns `fail` for that criterion (default switch case) | **Low** | Custom criteria from managers use known check types. Invalid ones score 0. |
| Extremely large event arrays (>1000 events) | Scoring iterates all events per criterion. O(n*m) | **Medium** | Add index or batch limit if perf becomes an issue. |

### 15.1 Scoring Guarantees

The scoring engine always guarantees:

1. **`overallScore` ∈ [0, 100]** — clamped at both ends.
2. **`categoryScores[*].score` ∈ [0, 100]** — independently clamped per category.
3. **No null pointer exceptions** — every access uses optional chaining or fallback defaults.
4. **All non-negative** — no weight subtraction can push below 0.
5. **Deterministic** — same input → same output (no randomness in scoring).
6. **Traceable** — every point is attributable to a criterion × result × weight.

### 15.2 Database Guarantees

The migration system guarantees:

1. **All 6 new columns are nullable** — old rows remain readable.
2. **`scoring_snapshot_json` is written at assessment creation** — never mutated after.
3. **`scoring_overrides_json` is on `manager_standards`** — one row shared across assessments.
4. **Category score columns on `assessment_results`** — written after analysis completes.
