# Automate — Post-Submission Auto-Analysis & Retake Flow

> Written 2026-06-26

## Vision

After a candidate submits their assessment (ticket), the system should:
1. Auto-trigger the analysis pipeline
2. Display a score + walkthrough of correct/incorrect actions
3. Allow the candidate to retake the call from scratch
4. Allow managers to review, tweak standards, and interact with an AI assistant

This turns a one-shot assessment into a **learning loop**: candidate works → gets scored → sees what they missed → retries.

---

## Current State Audit

### What Already Exists

| Component | File | Status |
|---|---|---|
| Deterministic sim scoring | `lib/mvp/sim/scoring.ts` | Works for Outlook pack. Generic now (pack-driven via `scoringCriteria`). Scores sim actions against expected diagnostic path |
| AI analysis pipeline | `lib/mvp/analysis/runBaseCallumAnalysis.ts` | 3-stage: AI evidence extraction → deterministic score → AI narrative. Triggered by `POST /api/mvp/assessments/[id]/analyse` |
| Analysis scoring | `lib/mvp/analysis/scoring.ts` | Weighted criteria, fail gates, readiness labels. Manager standards influence thresholds |
| Manager review UI | `app/mvp/assessments/[id]/page.tsx` | Shows score, evidence, red flags, narrative |
| Candidate event logging | `app/api/mvp/assessment/[token]/event/route.ts` | Logs all triage, notes, actions to `session_events` |
| Ticket submission | `app/api/mvp/assessment/[token]/ticket/route.ts` | Writes ticket, completes sim session, logs event |
| Sim scoring (in-session) | `lib/mvp/sim/scoring.ts` | Generates `SimScoringResult` with actionCriteria, scoreDelta, technicalPath |

### What's Missing

- **Auto-trigger**: Analysis runs on-demand via manager endpoint only. No post-subscription auto-trigger.
- **Candidate-facing score**: No UI for candidate to see their score, walkthrough, or correct path.
- **Retake flow**: No way to reset an assessment for retry.
- **Learning walkthrough**: No per-step comparison of what the candidate did vs the ideal path.
- **Manager AI assistant**: No chat interface for managers to query assessment data or tweak standards.

---

## Implementation Plan

### Phase 1: Auto-Analysis on Submission

**Goal:** When a candidate submits their ticket, the analysis runs automatically and the result is stored.

#### Step 1.1 — Trigger analysis after ticket submission

In `app/api/mvp/assessment/[token]/ticket/route.ts`, after the ticket is written:

```ts
// After successful ticket submission
const { runBaseCallumAnalysis } = await import('@/lib/mvp/analysis/runBaseCallumAnalysis');
const analysisResult = await runBaseCallumAnalysis(assessment.id);
```

This runs the full 3-stage analysis pipeline synchronously or in the background. For UX, run it synchronously (the assessment submission already waits for DB writes; the analysis adds 2-5s of LLM calls).

#### Step 1.2 — Return analysis with submission response

The ticket submission response should include the analysis result:

```json
{
  "status": "completed",
  "message": "Ticket submitted",
  "analysis": {
    "overall_score": 72,
    "readiness_label": "needs_supervision",
    "summary": "Candidate identified the issue but missed...",
    "criteria_breakdown": { ... },
    "red_flags": [...],
    "technical_path": [...]
  }
}
```

#### Step 1.3 — Update candidate API to return analysis

`GET /api/mvp/assessment/[token]` should return analysis results when available, so the candidate can see scores on reload.

### Phase 2: Candidate-Facing Results Page

**Goal:** Instead of the simple "Assessment Complete" screen, show a results walkthrough.

#### Step 2.1 — Results view component

Create `components/mvp/results/AssessmentResults.tsx`:

```
┌──────────────────────────────────────────────────────────────┐
│  Assessment Complete           Score: 72/100                 │
│  Rating: Needs Supervision                                    │
│                                                              │
│  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────────┐     │
│  │ Call │ Diag │ Fix  │ Verf │ Tick │ Prof │ Safety   │     │
│  │  60% │  80% │ 100% │  50% │  70% │ 100% │  PASS ✓  │     │
│  └──────┴──────┴──────┴──────┴──────┴──────┴──────────┘     │
│                                                              │
│  What you did right:                                         │
│  ✓ Checked Outlook connection status                         │
│  ✓ Disabled Work Offline (correct fix)                       │
│                                                              │
│  What you missed:                                            │
│  ✗ Did not check webmail to isolate scope                    │
│  ✗ Did not verify the fix with customer                      │
│                                                              │
│  Red flags triggered:                                        │
│  ⚠ Attempted destructive fix before basic checks             │
│                                                              │
│  [Retake Assessment]  [Return to Dashboard]                  │
└──────────────────────────────────────────────────────────────┘
```

The data comes from `SimScoringResult` (from `scoreSimEvents`) merged with the AI analysis narrative (from `runBaseCallumAnalysis`).

#### Step 2.2 — Replace completion screen

Replace the current simple completion screen in `ServiceDeskSimulatorShell.tsx` with the results view. Show a toast "Assessment submitted, analyzing..." while the analysis runs, then render results.

### Phase 3: Retake Flow

**Goal:** Let the candidate retake the assessment from scratch, generating a new attempt.

#### Step 3.1 — Clone assessment for retake

When the candidate clicks "Retake Assessment":

1. Create a new assessment with the same `assignment_type` and `assessment_pack_id`
2. Copy the manager `standards_snapshot_json` from the original
3. Generate a new invite token
4. Redirect the candidate to the new token URL

This gives a fresh sim session, fresh events, and fresh scoring.

Implementation in `POST /api/mvp/assessments` — add a `cloneFrom` parameter:

```json
{
  "cloneFrom": "mvp-mqupqd6o-hqq3zm",
  "assignmentType": "training_drill",
  "assessmentPackId": "pack-outlook-sim-v2"
}
```

The clone endpoint:
1. Loads the original assessment
2. Creates a new assessment with same type/pack/standards
3. Creates a new sim session with fresh initial state
4. Returns the new invite URL

#### Step 3.2 — Show retake option

The results view shows "Retake Assessment" button that calls the clone API and navigates to the new URL.

### Phase 4: Learning Walkthrough

**Goal:** Show the candidate the ideal diagnostic path vs what they did, step by step.

#### Step 4.1 — Pack-defined walkthrough

Each `SimPack` already has:
- `hiddenTruth.idealDiagnosticPath` — the ordered list of expected steps
- `diagnosticChecklist` — the ✓/✗ criteria

For the walkthrough, iterate the `diagnosticChecklist` and show each step with pass/fail status and the expected observation text.

#### Step 4.2 — Walkthrough component

Create `components/mvp/results/StepWalkthrough.tsx`:

```
Step 1: Open Outlook                                  ✓ Done
Step 2: Check Outbox for stuck messages               ✓ Done
Step 3: Check Outlook status / connection             ✓ Done
Step 4: Notice Work Offline is enabled                ✓ Done
Step 5: Disable Work Offline                          ✓ Done
Step 6: Send test email or confirm Outbox clears      ✗ Missed
Step 7: Verify with customer that email sent          ✗ Missed
```

For missed steps, show the expected observation text so the candidate learns what they should have done.

### Phase 5: Manager AI Assistant

**Goal:** Let managers review assessments, adjust standards, and query an AI assistant.

#### Step 5.1 — Manager chat panel

Add to `app/mvp/assessments/[id]/page.tsx`:

A collapsible "AI Assistant" panel at the bottom of the manager assessment detail page. The assistant:
- Has access to the assessment context (transcript, events, score, rubric)
- Can answer questions like "Why did they fail this criterion?" or "What should the coaching focus be?"
- Can suggest standard changes: "Based on this assessment, should I tighten the escalation requirements?"
- Stores chat history per-assessment

#### Step 5.2 — Chat API endpoint

`POST /api/mvp/assessments/[id]/chat`

- Accepts a user message + assessment context
- Calls an LLM with the assessment data as system context
- Returns the assistant response
- Logs the interaction

#### Step 5.3 — Standards editing from chat

The AI assistant can suggest standard changes. A button "Apply to standards" next to suggestions that updates the manager's `manager_standards` via `POST /api/mvp/standards`.

### Phase 6: Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  CANDIDATE FLOW                                              │
│                                                              │
│  Open assessment → Work ticket → Submit → Auto-analyze       │
│                                            ↓                 │
│                                      Show results             │
│                                      + walkthrough            │
│                                            ↓                 │
│                                  [Retake] or [Done]          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  MANAGER FLOW                                                │
│                                                              │
│  Dashboard → Select assessment → Review score + evidence     │
│                                            ↓                 │
│                              [AI Assistant panel]             │
│                              "Why did they miss this step?"   │
│                              "Suggest standard changes"       │
│                                            ↓                 │
│                              Apply updated standards          │
└─────────────────────────────────────────────────────────────┘
```

### Phase 7: Data Flow

```
POST /api/mvp/assessment/[token]/ticket
  ↓
store ticket in DB
  ↓
runBaseCallumAnalysis(assessmentId)
  ├── buildAssessmentContext()
  │     ├── transcript, ticket, events, timeline
  │     ├── sim final state (if training_drill)
  │     └── manager standards snapshot
  ├── Stage 1: AI evidence extraction (LLM)
  ├── Stage 2: Deterministic scoring (scoreSimEvents)
  ├── Stage 3: AI narrative feedback (LLM)
  └── store in assessment_results + analysis_runs
  ↓
return { status, score, summary, technicalPath, ... }
  ↓
candidate sees results + walkthrough
  ↓
[Retake] → clone assessment → new token → fresh start
```

### Implementation Order

| Phase | What | Priority |
|---|---|---|
| 1 | Auto-trigger analysis on ticket submission | High |
| 2 | Candidate-facing results page | High |
| 3 | Retake flow (clone + reset) | Medium |
| 4 | Learning walkthrough (ideal path vs actual) | Medium |
| 5 | Manager AI assistant | Low |
| 6 | Manager standards-from-chat | Low |

---

## Guardrails

1. **Do not block submission on analysis.** The analysis should run after the response is sent, or at worst add 2-3s to the submission time. Show a "Analyzing..." state to the user.
2. **Sim scoring must remain deterministic.** The pack-driven `scoreSimEvents()` is pure code. The AI is only used for evidence extraction and narrative. Never let the AI invent scores.
3. **Retake creates a new assessment, never modifies existing.** Original assessment data is immutable for audit/review purposes.
4. **Manager AI assistant is read-only by default.** Suggestions to change standards must require explicit manager confirmation.
5. **Taxonomy drives the walkthrough, not hardcoded text.** The `diagnosticChecklist` from each pack defines the steps shown in the walkthrough.
6. **session_events remains canonical.** All retake assessments start with fresh `session_events` and `sim_events`.
7. **Candidate never sees hidden truth.** The walkthrough shows what they should have done (from `hiddenTruth.idealDiagnosticPath`), not the root cause or correct fix directly if that would leak answers. Use generic coaching language.

---

## Implementation Progress — Session 2026-06-26

### Phase 1: Auto-Analysis on Submission — COMPLETE

**Files changed:**

| File | Change |
|---|---|
| `app/api/mvp/assessment/[token]/ticket/route.ts` | Calls `runBaseCallumAnalysis(assessmentId)` after ticket stored. Catches analysis errors gracefully. Returns `analysis` + `candidate_analysis` in response |
| `lib/mvp/analysis/runBaseCallumAnalysis.ts` | Added `buildCandidateAnalysis()` — extracts safe candidate-facing results from raw analysis data (scores, strengths, improvements, diagnostic checklist, narrative). Added `CandidateAnalysisResult` interface |
| `app/api/mvp/assessment/[token]/route.ts` | GET route now includes `candidate_analysis` when assessment is completed/analysed, so results survive page refresh |

**Flow:**
```
POST /api/mvp/assessment/[token]/ticket
  → store ticket + events + sim completion
  → runBaseCallumAnalysis(assessmentId)
    → buildAssessmentContext (transcript, ticket, events, timeline, sim state)
    → Stage 1: AI evidence extraction (deepseek-v4-flash via opencode.ai, temperature 0)
    → Stage 2: Deterministic scoring (fail gates, readiness label)
    → Stage 3: AI narrative feedback (temperature 0.3)
    → store in assessment_results + analysis_runs
  → buildCandidateAnalysis (cleaned for candidate display)
  → return { status, analysis, candidate_analysis }
```

### Phase 2: Candidate-Facing Results Page — COMPLETE (redesigned 2026-06-26)

**Files created/changed:**

| File | Change |
|---|---|
| `components/mvp/results/AssessmentResults.tsx` | **Redesigned.** Two-column layout. Left: "What cost you the most points" (failures sorted first), "What to do differently", "Coaching focus". Right: "What went well", compact all-criteria grid, ticket feedback. ConnectWise-style dense UI. |
| `app/mvp/results/page.tsx` | **NEW.** Standalone prototype page at `/mvp/results` with realistic mock data. Enables rapid iteration on the results view without running through the full assessment flow. |

**Layout:**

```
┌──────────────────────────────────────────────────────────────┐
│  Connexion PSA | Training Drill | Assessment Results [Retake]│
├──────────────────────────────────────────────────────────────┤
│  42  │ Not Ready │ Summary text...                          │
├─────────────────────────────┬────────────────────────────────┤
│ What cost you the most pts  │ What went well                 │
│ ✗ Asked about impact        │ ✓ Identified Outlook           │
│ ✗ Verified fix w/ customer  │ ✓ Disabled Work Offline       │
│ ✗ Asked about scope         │                                │
│                             │ All criteria                   │
│ What to do differently      │ ✓ Confirmed user   ✓ Tone      │
│ → Did not ask impact...     │ ✓ Safety           ✓ Conduct  │
│ → Did not verify fix...     │                                │
│                             │ Ticket notes                   │
│ Coaching focus              │ ...feedback text...            │
│ ● Always ask about impact   │                                │
└─────────────────────────────┴────────────────────────────────┘
```

**Key design decisions:**
- Failures shown before passes — the candidate sees what they missed first
- "What cost you the most" — priorities the most impactful misses
- Compact score bar with inline summary — no giant centered card
- All-criteria two-column grid for passes — dense and skimmable
- Standalone `/mvp/results` prototype for rapid iteration

### Verification

- `/mvp/results` loads with mock data at `http://localhost:3000/mvp/results`
- Real post-submission flow uses the same `AssessmentResults` component
- Mock data editable in `app/mvp/results/page.tsx`

### Remaining Phases

| Phase | What | Status |
|---|---|---|
| 1 | Auto-trigger analysis on ticket submission | **DONE** |
| 2 | Candidate-facing results page | **DONE** (redesigned) |
| 3 | Retake flow (clone assessment + fresh start) | Next |
| 4 | Learning walkthrough (pack diagnosticChecklist vs actual) | Next |
| 5 | Manager AI assistant | Later |
| 6 | Manager standards-from-chat | Later |

### Known Limitation

The analysis pipeline's evidence extraction AI currently evaluates the transcript (voice messages) for communication criteria. If the candidate takes correct sim actions but never speaks (no voice messages), the score will be low because communication criteria are not met from the transcript alone. The timeline is included in the prompt context, but the AI criteria extraction is primarily transcript-driven. This will naturally improve when candidates use voice interaction (which is the intended production flow).
