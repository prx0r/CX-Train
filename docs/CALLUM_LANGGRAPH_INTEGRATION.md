# Callum LangGraph Integration Spec

## Goal

Make Callum the manager's primary interface for the MVP system without moving scoring authority into an agent.

Callum should help managers review assessments, explain results, propose next training, draft assignments, navigate pages, and eventually operate every manager workflow through safe tool calls.

This spec depends on the broader antifragile contract design in `docs/CALLUM_ANTIFRAGILE_SYSTEM_DESIGN.md`.

## Product Boundary

Callum is the manager assistant, not the scorer.

- Deterministic scoring remains authoritative.
- Analysis evidence extraction remains separate.
- Candidate APIs must not expose hidden facts, rubrics, red flags, checkpoints, or ideal-ticket data.
- Callum may access manager-only assessment context.
- Any create/update/send action must be proposal-first and require explicit manager confirmation.

Do not route these through LangGraph in v0:

- Candidate call flow.
- Candidate hidden-fact filtering.
- Deterministic scoring.
- Analysis run hashing/cache logic.
- Existing candidate assessment engine.

## Architecture

```txt
app/api/mvp/callum/route.ts
  -> lib/mvp/callum/graph.ts
  -> lib/mvp/callum/context.ts
  -> lib/mvp/callum/tools.ts
  -> existing lib/mvp/db.ts, query.ts, analysis, compliance, results, sim packs
```

Use LangGraph JS for orchestration, but keep model calls behind the existing `lib/ai/provider.ts` gateway.

Recommended model task:

```env
AI_CALLUM_MODEL=deepseek-v4-flash
AI_BASE_URL=https://opencode.ai/zen/go/v1
AI_API_KEY=...
```

Add `callum` to the accepted task names in `runAiTask` when implementing. Do not create a second model gateway.

## Packages

```bash
npm install @langchain/langgraph @langchain/core
```

Do not add `langchain` unless a later implementation needs full LangChain model/tool wrappers. v0 can call normal TypeScript functions from graph nodes.

## Files

```txt
lib/mvp/callum/
  state.ts       # Callum state types and LangGraph state schema
  graph.ts       # graph construction and node wiring
  context.ts     # manager-only context loading
  tools.ts       # narrow product tools, no raw SQL tools
  prompts.ts     # base, intent, action, and style prompts
  schemas.ts     # request/response/action validation
  actions.ts     # pending action validation and execution adapters
  memory.ts      # thread/message persistence helpers

app/api/mvp/callum/route.ts

components/mvp/callum/
  CallumPanel.tsx
  CallumMessage.tsx
  CallumActionCard.tsx
```

Mount first on:

```txt
app/mvp/assessments/[id]/page.tsx
```

Later, make it a persistent manager shell panel across `/mvp`.

## Database

Add these tables in `initTables()` in `lib/mvp/db.ts`.

```sql
CREATE TABLE IF NOT EXISTS callum_threads (
  id TEXT PRIMARY KEY,
  manager_profile_id TEXT NOT NULL,
  assessment_id TEXT,
  page_route TEXT,
  title TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS callum_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (thread_id) REFERENCES callum_threads(id)
);

CREATE TABLE IF NOT EXISTS callum_pending_actions (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  manager_profile_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  FOREIGN KEY (thread_id) REFERENCES callum_threads(id)
);

CREATE TABLE IF NOT EXISTS manager_callum_profiles (
  id TEXT PRIMARY KEY,
  manager_profile_id TEXT NOT NULL,
  assistant_name TEXT NOT NULL DEFAULT 'Callum',
  tone TEXT NOT NULL DEFAULT 'direct',
  humour_level TEXT NOT NULL DEFAULT 'low',
  detail_level TEXT NOT NULL DEFAULT 'normal',
  feedback_style TEXT NOT NULL DEFAULT 'balanced',
  custom_instructions TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

v0 uses `callum_pending_actions` for confirmation cards. Do not use LangGraph interrupts/checkpointing yet.

## API

`POST /api/mvp/callum`

Request:

```json
{
  "threadId": "optional-existing-thread",
  "message": "Why did this candidate fail?",
  "pageContext": {
    "route": "/mvp/assessments/abc123",
    "pageType": "assessment_review",
    "assessmentId": "abc123",
    "candidateId": "optional"
  }
}
```

Responses:

```ts
type CallumResponse =
  | { type: 'answer'; threadId: string; message: string }
  | {
      type: 'proposed_action';
      threadId: string;
      pendingActionId: string;
      message: string;
      action: { type: string; payload: Record<string, unknown> };
    }
  | { type: 'navigation'; threadId: string; message: string; targetRoute: string };
```

Confirmation can initially be handled by the same route:

```json
{
  "threadId": "callum-thread-123",
  "confirmPendingActionId": "act-123"
}
```

Later this can become `app/api/mvp/callum/confirm/route.ts`.

## State

Use the current LangGraph JS state schema API, not older `channels` examples.

```ts
export type CallumIntent =
  | 'explain_assessment'
  | 'suggest_next_training'
  | 'create_hiring_assessment'
  | 'create_training_assignment'
  | 'navigate'
  | 'general_question'
  | 'unknown';

export type CallumState = {
  threadId: string;
  managerProfileId: string;
  userMessage: string;
  pageContext?: {
    route?: string;
    pageType?: string;
    assessmentId?: string;
    candidateId?: string;
  };
  callumProfile?: {
    assistantName: string;
    tone: string;
    humourLevel: string;
    detailLevel: string;
    feedbackStyle: string;
    customInstructions?: string;
  };
  intent?: CallumIntent;
  assessmentContext?: unknown;
  scenarioPackContext?: unknown;
  managerStandardsContext?: unknown;
  proposedAction?: {
    type: string;
    payload: Record<string, unknown>;
    requiresConfirmation: boolean;
  };
  finalResponse?: {
    type: 'answer' | 'proposed_action' | 'navigation';
    message: string;
    targetRoute?: string;
    pendingActionId?: string;
  };
  errors?: string[];
};
```

## Graph

```txt
START
  -> loadBaseContext
  -> classifyIntent
  -> routeByIntent
       -> explainAssessment
       -> suggestNextTraining
       -> draftHiringAssessment
       -> draftTrainingAssignment
       -> navigateDashboard
       -> answerGeneral
  -> maybeCreatePendingAction
  -> styleResponseForManager
  -> END
```

`navigateDashboard` and `answerGeneral` can skip `maybeCreatePendingAction` if implementation is simpler, but all mutation-like intents must pass through pending-action creation.

## Internal Tools

Do not expose raw SQL. Start with normal TypeScript functions:

```ts
export const callumTools = {
  getAssessmentForManager,
  getAssessmentResult,
  getAssessmentTranscript,
  getSessionEvents,
  getManagerStandards,
  getScenarioPacks,
  createPendingAction,
  getCallumThread,
  appendCallumMessage,
};
```

Later these can be wrapped as formal LangChain tools or MCP tools.

## Context Loading

`loadBaseContext` should load:

- Manager profile.
- Manager Callum profile.
- Current page context.
- Assessment context if `assessmentId` exists.
- Manager standards.
- Scenario pack summaries.
- Recent Callum thread messages.

For assessment review pages, provide:

```json
{
  "assessment": {
    "id": "...",
    "assignmentType": "hiring_exam",
    "status": "analysed",
    "scenarioTitle": "Outlook Not Sending"
  },
  "result": {
    "overallScore": 42,
    "readinessLabel": "not_ready",
    "summary": "...",
    "criteriaBreakdown": {},
    "compliance": {}
  },
  "events": [],
  "ticket": {},
  "transcript": [],
  "managerStandards": {}
}
```

Keep this loader manager-only. Never import it from candidate APIs.

## Prompts

Base prompt:

```txt
You are Callum, the embedded AI assistant inside CallCallum.

You help MSP managers create hiring assessments, assign training, review candidate attempts, and navigate the MVP dashboard.

Rules:
- Do not invent records, scores, candidates, assessments, or scenario packs.
- Use only provided context.
- The deterministic scoring engine is authoritative.
- You may explain scores, but you must not change scores.
- Any create/update/send action must be returned as a proposed action requiring manager confirmation.
- Never expose candidate-hidden scenario facts outside manager-only contexts.
- Be concise and practical.
```

Apply manager personality only in the final style node:

```txt
Manager-specific Callum style:
- Assistant name: ...
- Tone: ...
- Humour level: ...
- Detail level: ...
- Feedback style: ...
- Custom instructions: ...
```

Personality must not affect scores, criteria, evidence, or action validation.

## v0 Intents

### explain_assessment

Questions:

- "Why did they fail?"
- "What cost them points?"
- "Explain this result."

Return:

- Main reason.
- Evidence.
- Coaching focus.
- Any data gaps.

### suggest_next_training

Questions:

- "What should I assign next?"
- "Give them something to improve."
- "Make them retry something easier."

Return a pending action:

```json
{
  "type": "create_training_assignment",
  "payload": {
    "assignmentType": "training_drill",
    "assessmentPackId": "pack-outlook-sim-v2",
    "feedbackEnabled": true,
    "maxAttempts": 3
  }
}
```

### create_hiring_assessment

Return a pending action:

```json
{
  "type": "create_assessment",
  "payload": {
    "assignmentType": "hiring_exam",
    "assessmentPackId": null,
    "feedbackEnabled": false,
    "maxAttempts": 1
  }
}
```

### create_training_assignment

For v0, create a generic draft/invite proposal. Do not build a people system first.

### navigate

Return:

```json
{
  "type": "navigation",
  "targetRoute": "/mvp/assessments"
}
```

## Human Confirmation

```txt
Callum proposes action
  -> insert callum_pending_actions row
  -> frontend renders action card
  -> manager confirms
  -> backend validates payload
  -> existing assessment creation/action logic runs
  -> pending action marked confirmed/executed
```

Use SQLite pending actions in v0. Move to LangGraph interrupts/checkpointing only after the action system works.

## Tests

Add tests or scripts for:

1. Callum can explain an existing analysed assessment.
2. Callum can propose a training assignment without creating it.
3. Proposed action is stored as pending.
4. Candidate endpoint still does not leak hidden facts/rubrics/red flags.
5. Navigation returns only `targetRoute`.
6. Unknown/general questions do not mutate core MVP tables.

Acceptance:

- `npm run test:mvp-flow` passes.
- `npm test` passes if the existing suite is expected to pass.
- `/mvp/assessments/[id]` shows a Callum panel.
- "Why did they score low?" returns evidence-grounded explanation.
- "Assign them something to improve this" returns a proposed action card, not an immediate assignment.

## Not v0

- MCP.
- Voice Callum.
- Vector database.
- Multi-manager org permissions.
- Autonomous standards editing.
- Training shift generator.
- Candidate-facing Callum.
- Fine-tuning or LoRA.
- Full analytics dashboard.

The base system should make those possible, but the first slice must stay proposal-based and manager-side.
