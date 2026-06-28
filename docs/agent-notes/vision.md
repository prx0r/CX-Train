# CallCallum Product Vision And Implementation Plan

## Product Truth

CallCallum is a manager-assigned MSP readiness simulator.

The product is not three separate tools. It is one platform with three assignment types:

1. Hiring Exam
2. Training Drill
3. Training Shift

The manager should not be asked to choose raw modes, packs, voice settings, sim settings, tool unlocks, or scoring templates. The manager should answer one question:

What are you trying to assign?

- Hiring Exam: can this person handle a support call?
- Training Drill: can this technician handle this ticket type?
- Training Shift: can this technician handle a desk period? Coming soon.

Everything underneath can still use the same backend primitives:

- scenario and taxonomy truth
- customer call/chat
- optional simulated actions
- ticket note
- evidence timeline
- deterministic and AI analysis
- manager calibration

The key implementation rule: assignment type is the product-level abstraction. Internal modes and packs are implementation details.

## Current Repo Position

The repo already contains most of the lower-level building blocks:

- Hiring-style chat/voice call flow at `/mvp/assessment/[token]`
- candidate message route: `POST /api/mvp/assessment/[token]/message`
- ticket submission route: `POST /api/mvp/assessment/[token]/ticket`
- analysis route: `POST /api/mvp/assessments/[id]/analyse`
- manager assessment pages under `/mvp/assessments`
- dashboard sim state/action routes:
  - `GET /api/mvp/assessment/[token]/sim`
  - `POST /api/mvp/assessment/[token]/sim/action`
- service-desk shell: `components/mvp/sim/ItsmCandidateShell.tsx`
- sim pack registry and Outlook Work Offline pack under `lib/mvp/sim`
- event evidence table via `session_events`
- voice STT/TTS routes under `/api/mvp/assessment/[token]/voice`

The repo has visually explored Product 2, Training Drill. The commercial MVP should still be Product 1, Hiring Exam.

## Assignment Types

### 1. Hiring Exam

Purpose:

Should we hire, progress, or reject this person?

Candidate experience:

- opens invite link
- completes one controlled customer call
- can use voice-only or chat-only interaction
- does not see a full simulated desktop
- submits one ticket note
- finishes

Manager sees:

- overall score
- readiness label
- transcript
- candidate ticket
- red flags
- communication quality
- basic triage quality
- evidence timeline

This is the first product to sell. It matches the original requirement: basic call handling, professionalism, friendliness, qualification, expectation setting, and symptom gathering.

Technical behavior:

- `assignment_type = 'hiring_exam'`
- no dashboard sim shell
- no remote tools
- no sim action requirements
- `assessment_mode` may remain `chat_call` internally for compatibility
- messages and ticket still flow through existing MVP routes
- analysis must work from transcript plus ticket alone

### 2. Training Drill

Purpose:

Practise one skill or one ticket type for someone already hired.

Candidate experience:

- opens fake service desk
- receives one ticket/call
- may use remote tools
- talks to the customer
- submits a ticket

Example drills:

- Outlook not sending
- password reset
- account lockout
- MFA issue
- Wi-Fi scope issue
- printer not printing

Manager sees:

- whether the expected process was followed
- whether the technician explained actions
- whether the issue was resolved first call
- whether the ticket note was useful
- action timeline
- deterministic sim scoring
- communication analysis

Technical behavior:

- `assignment_type = 'training_drill'`
- uses service-desk shell
- uses one selected assessment pack
- starts with only one enabled ticket pack for now: Outlook Work Offline
- internal `assessment_mode` may remain `dashboard_sim` for compatibility
- sim state and actions are required
- analysis must use transcript, ticket, and `session_events`

### 3. Training Shift

Purpose:

Simulate being on the desk for a morning or day.

Candidate experience:

- queue of tickets
- random or scheduled calls
- multiple cases
- difficulty ramps

Manager sees:

- daily summary
- average score
- weak areas
- red flags
- ticket quality
- readiness for live calls

Do not build this yet.

Technical behavior for now:

- visible in the manager UI as Coming Soon only
- cannot create a real assignment
- no scheduling
- no random queue
- no multi-case session engine

## Data Model Direction

Add a first-class assignment type field instead of exposing internal modes as product concepts.

Recommended schema evolution:

```sql
ALTER TABLE assessments ADD COLUMN assignment_type TEXT NOT NULL DEFAULT 'hiring_exam';
```

Allowed values:

- `hiring_exam`
- `training_drill`
- `training_shift`

Keep `assessment_mode` temporarily as an internal compatibility field:

- `hiring_exam` maps to `assessment_mode = 'chat_call'`
- `training_drill` maps to `assessment_mode = 'dashboard_sim'`
- `training_shift` is not creatable yet

Do not remove `assessment_mode` immediately. Too much of the current code expects it. Instead:

1. Add `assignment_type`.
2. Update create/list/detail APIs to return it.
3. Update UI to display assignment type, not raw mode.
4. Later, demote `assessment_mode` to a derived/internal field.

## Backend Implementation Plan

### Step 1: Add Assignment Type Types

Create or extend a shared type module, likely under `lib/mvp`.

Expected TypeScript shape:

```ts
export type AssignmentType = 'hiring_exam' | 'training_drill' | 'training_shift';

export const ASSIGNMENT_TYPES = {
  hiring_exam: {
    label: 'Hiring Exam',
    description: 'Best for candidates or new starters. One controlled call and ticket.',
    enabled: true,
    assessmentMode: 'chat_call',
  },
  training_drill: {
    label: 'Training Drill',
    description: 'Best for practising one ticket type. One simulated ticket/call with optional remote tools.',
    enabled: true,
    assessmentMode: 'dashboard_sim',
  },
  training_shift: {
    label: 'Training Shift',
    description: 'Coming soon. Simulated queue across a time block.',
    enabled: false,
    assessmentMode: null,
  },
} as const;
```

The create API should validate against this list. Do not allow arbitrary strings.

### Step 2: Update SQLite Init

Update both:

- `lib/mvp/db.ts`
- `scripts/mvp-init-db.mjs`

Requirements:

- `assessments.assignment_type` exists
- default is `hiring_exam`
- existing rows continue to work
- dashboard sim rows can be backfilled from `assessment_mode = 'dashboard_sim'`

Backfill rule:

```sql
UPDATE assessments
SET assignment_type = CASE
  WHEN assessment_mode = 'dashboard_sim' THEN 'training_drill'
  ELSE 'hiring_exam'
END
WHERE assignment_type IS NULL
   OR assignment_type = '';
```

### Step 3: Update Create Assessment API

Current manager create flow should become assignment-driven.

Expected input:

```json
{
  "candidateName": "Alex Candidate",
  "candidateEmail": "alex@example.com",
  "assignmentType": "hiring_exam"
}
```

For Training Drill:

```json
{
  "candidateName": "Jamie Tech",
  "candidateEmail": "jamie@example.com",
  "assignmentType": "training_drill",
  "assessmentPackId": "pack-outlook-sim-v2"
}
```

Rules:

- if `assignmentType` is missing, default to `hiring_exam`
- if `assignmentType = training_shift`, return `400` with `TRAINING_SHIFT_NOT_AVAILABLE`
- if `assignmentType = hiring_exam`, ignore sim pack selection
- if `assignmentType = training_drill`, require an enabled pack or default to `pack-outlook-sim-v2`
- derive `assessment_mode` internally from assignment type

Expected create response:

```json
{
  "ok": true,
  "data": {
    "assessmentId": "assess-...",
    "assignmentType": "hiring_exam",
    "assessmentMode": "chat_call",
    "inviteUrl": "http://localhost:3000/mvp/assessment/...",
    "token": "..."
  }
}
```

### Step 4: Update Candidate Routing

Candidate page should route by `assignment_type`, falling back to `assessment_mode` for old rows.

Rules:

- `hiring_exam`: render simple call/chat and ticket flow
- `training_drill`: render `ItsmCandidateShell`
- `training_shift`: render a friendly unavailable/expired-style page because creation is blocked for now

Do not expose manager implementation concepts to candidates.

### Step 5: Update Manager Create UX

The manager dashboard should have one primary button:

Create Assignment

The create page should show three cards:

1. Hiring Exam
   - Best for candidates or new starters.
   - One controlled call and ticket.
   - Enabled.

2. Training Drill
   - Best for practising one ticket type.
   - One simulated ticket/call with optional remote tools.
   - Enabled.
   - For v0, only show Outlook Work Offline as the selected/default drill.

3. Training Shift
   - Coming soon.
   - Simulated queue across a time block.
   - Disabled.

After selecting Hiring Exam:

- show minimal candidate details
- create button says `Create Hiring Exam`
- no pack selector
- no mode selector

After selecting Training Drill:

- show candidate details
- show one drill selector with `Outlook Work Offline`
- create button says `Create Training Drill`

Do not show:

- raw `assessment_mode`
- raw pack JSON
- voice mode toggles
- sim type toggles
- tool unlock controls
- scoring template controls

### Step 6: Update Manager List And Detail

Assessment list rows should show:

- assignment type label
- candidate
- status
- created date
- score/readiness when available

Manager detail page should show assignment-aware labels:

- Hiring Exam report
- Training Drill report

For Hiring Exam, emphasize:

- call handling
- triage questioning
- communication
- ticket note

For Training Drill, add:

- action timeline
- expected process completion
- first-call resolution
- sim red flags

### Step 7: Keep Training Shift As Product Signal Only

Training Shift should exist only as:

- disabled card in Create Assignment
- route/API rejection if someone tries to submit it manually
- product copy in docs

Do not build:

- scheduling
- queues
- random calls
- multiple cases
- day summary

## Scoring And Analysis Direction

The same analysis pipeline can support both enabled assignment types, but it must weight evidence differently.

Hiring Exam analysis inputs:

- transcript
- ticket
- session events for timings and input source

Hiring Exam output should include:

- professionalism
- friendliness
- qualification/questioning
- symptom gathering
- expectation setting
- ticket quality
- red flags
- readiness recommendation

Training Drill analysis inputs:

- transcript
- ticket
- session events
- sim final state
- sim action taxonomy tags
- deterministic sim score

Training Drill output should include:

- followed process
- resolved or did not resolve
- verified fix
- explained actions
- avoided red flags
- ticket usefulness
- manager-ready summary

Do not let the AI invent tool actions. Tool actions must come from `session_events`, not from the transcript.

## Ticketing System Direction

Do not integrate ConnectWise yet.

The fake CallCallum ticket panel is a controlled training environment for:

- what information to collect
- how to structure the note
- how to classify or escalate
- how to explain the issue

Long-term path:

1. CallCallum fake ticket panel
2. ConnectWise-style ticket form
3. ConnectWise sandbox/API integration
4. live ticket shadowing and review

The fake ticket panel does not replace the MSP ticketing system. It trains the behavior before real-system integration.

## Required Tests

These tests are not optional. The purpose is to prevent a future agent from claiming the assignment-type abstraction exists because a card was added to the UI.

### 1. Assignment Type Unit Test

Add a test that imports the assignment type registry.

Command should be added to package scripts or included in `npm test`.

Expected assertions:

- exactly three assignment types exist
- `hiring_exam.enabled === true`
- `training_drill.enabled === true`
- `training_shift.enabled === false`
- Hiring Exam maps to `chat_call`
- Training Drill maps to `dashboard_sim`
- Training Shift has no active mode

Expected output:

```text
PASS assignment registry exposes three product assignment types
PASS hiring_exam maps to chat_call
PASS training_drill maps to dashboard_sim
PASS training_shift is disabled
```

### 2. DB Init Test

Extend `scripts/test-mvp-flow.mjs` or add a focused DB test.

Expected assertions:

- `assessments.assignment_type` column exists
- new assessment defaults to `hiring_exam`
- dashboard sim compatibility rows map to `training_drill`

Expected output:

```text
PASS assessments.assignment_type column exists
PASS default assignment type is hiring_exam
PASS dashboard_sim rows are treated as training_drill
```

### 3. Create Hiring Exam API Test

Create an assessment via API or direct route helper with:

```json
{
  "candidateName": "Hiring Test",
  "assignmentType": "hiring_exam"
}
```

Expected persisted values:

```json
{
  "assignment_type": "hiring_exam",
  "assessment_mode": "chat_call",
  "assessment_pack_id": null
}
```

Expected output:

```text
PASS create hiring exam returns assignmentType=hiring_exam
PASS create hiring exam stores assessment_mode=chat_call
PASS create hiring exam does not create sim_session
```

### 4. Create Training Drill API Test

Create an assessment with:

```json
{
  "candidateName": "Drill Test",
  "assignmentType": "training_drill",
  "assessmentPackId": "pack-outlook-sim-v2"
}
```

Expected persisted values:

```json
{
  "assignment_type": "training_drill",
  "assessment_mode": "dashboard_sim",
  "assessment_pack_id": "pack-outlook-sim-v2"
}
```

Expected output:

```text
PASS create training drill returns assignmentType=training_drill
PASS create training drill stores assessment_mode=dashboard_sim
PASS create training drill creates sim_session
PASS create training drill uses pack-outlook-sim-v2
```

### 5. Training Shift Rejection Test

Attempt to create:

```json
{
  "candidateName": "Shift Test",
  "assignmentType": "training_shift"
}
```

Expected response:

```json
{
  "ok": false,
  "error": {
    "code": "TRAINING_SHIFT_NOT_AVAILABLE"
  }
}
```

Expected output:

```text
PASS training_shift cannot be created yet
PASS training_shift returns TRAINING_SHIFT_NOT_AVAILABLE
PASS no assessment row created for training_shift
```

### 6. Candidate Rendering Test

Use created invite tokens and fetch/render the candidate entry behavior.

Expected assertions:

- Hiring Exam token does not render `ItsmCandidateShell`
- Training Drill token renders `ItsmCandidateShell`
- old `assessment_mode = dashboard_sim` rows still render Training Drill shell

Expected output:

```text
PASS hiring_exam candidate uses simple call flow
PASS training_drill candidate uses service desk shell
PASS legacy dashboard_sim assessment still opens service desk shell
```

### 7. Manager Create UX Test

Use a Playwright-style test if available. If not, add a DOM/string smoke test for the page output.

Expected visible text:

- `Create Assignment`
- `Hiring Exam`
- `Training Drill`
- `Training Shift`
- `Coming soon`

Expected absent text:

- `assessment_mode`
- `dashboard_sim`
- raw JSON pack names except a human drill label

Expected output:

```text
PASS create page shows Create Assignment
PASS create page shows three assignment cards
PASS Training Shift card is disabled/coming soon
PASS raw internal modes are not visible
```

### 8. End-To-End Hiring Exam Test

Flow:

1. create Hiring Exam
2. open candidate token
3. send candidate message
4. receive customer reply
5. submit ticket
6. run analysis

Expected output:

```text
PASS hiring exam created
PASS hiring exam message stored
PASS hiring exam customer reply stored
PASS hiring exam ticket submitted
PASS hiring exam analysis completed
PASS hiring exam report includes readiness label
```

### 9. End-To-End Training Drill Test

Flow:

1. create Training Drill
2. open candidate token
3. start call
4. perform Outlook actions
5. submit ticket
6. run analysis

Expected output:

```text
PASS training drill created
PASS sim_session created
PASS start_call action recorded
PASS outlook actions recorded in session_events
PASS final sim state shows workOffline=false
PASS training drill ticket submitted
PASS training drill analysis includes action timeline evidence
```

### 10. Debug Status Test

`GET /api/mvp/debug/status` must expose assignment-aware backend truth.

Expected route/module checks:

- active `assess` routes
- active `voice` routes
- active sim routes
- no secrets leaked
- assignment types listed if added to the status payload

Expected output:

```text
PASS debug status lists active voice module
PASS debug status lists sim routes
PASS debug status does not leak API keys
PASS debug status reports assignment type support
```

## Commands To Keep Green

At minimum:

```bash
npx tsc --noEmit
npm test
npm run test:mvp-flow
npm run test:dashboard-sim
```

If voice tests are updated to compile TypeScript correctly:

```bash
npm run test:voice
```

The current `scripts/test-voice.mjs` should not be trusted until it can import TypeScript modules reliably. Either compile the needed TS files first or convert the test to `tsx` and make `tsx` a real dev dependency.

## Definition Of Done For Assignment Type Selector v0

The milestone is done only when all of these are true:

- manager creates an assignment from three product cards
- Hiring Exam creates a simple call/ticket assessment
- Training Drill creates the Outlook Work Offline service-desk simulation
- Training Shift is visible but disabled
- no raw internal mode selector is shown to the manager
- API stores and returns `assignment_type`
- old assessments still open correctly
- manager list/detail pages show product assignment labels
- debug/status output includes the relevant routes and voice/sim modules
- tests prove creation, persistence, candidate routing, and rejection behavior

## Non-Goals For This Milestone

Do not build:

- Training Shift engine
- random or scheduled queue
- multi-case day simulation
- ConnectWise integration
- full telephony/WebRTC phone simulator
- advanced voice-mode selector
- manager scoring-template builder
- tool unlock configuration UI

These ideas are valid later. They must not distract from making the manager assignment flow understandable now.

## Implementation Principle For Future Agents

Do not add another mode unless it maps to one of the assignment types.

If a change introduces a new manager-facing choice, ask:

Does this help the manager choose between Hiring Exam, Training Drill, or Training Shift?

If not, hide it behind a sensible default or keep it internal.

The product should feel simple even if the backend is capable.
