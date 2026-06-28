# Proposed Reorganization: CX-Train → Agentic Architecture

> Prepared for senior-agent review. This proposal restructures the codebase around canonical schemas,
> a LangGraph-native state shape, and domain-aligned modules. The goal is a system where adding a new
> tool/function means: define schema → add data access → register capability → wire graph node. No
> duplicated types, no ad-hoc context objects, no silent drift.

> **Review verdict:** Direction approved. Phase 1 (criterion schema consolidation) approved for
> immediate execution. Phases 2-4 (store layer, domain folders, LangGraph graph) are deferred until
> the Callum proposal confirmation loop is proven in production. This document is a migration roadmap,
> not a build ticket. See §12 for the approved order.

---

## 1. Motivation

The current codebase produces working output but has structural debt that will compound once LangGraph
is introduced:

- **Duplicate criteria definitions across 7+ files** — adding a single criterion requires touching
  `analysis/evidencePrompt.ts`, `analysis/scoring.ts`, `analysis/runBaseCallumAnalysis.ts`,
  `results/scoring-calculator.ts`, and `compliance/frameworks/*.ts`. In practice, these drift.
- **Ad-hoc context objects** — `AnalysisContext`, `ManagerAssessmentContext`, `CallumPageContext`,
  `SimAssessmentView` all overlap. LangGraph needs one unified state that all nodes read/write.
- **No single source of truth for domain concepts** — a SimPack is defined in `sim/types.ts`,
  rebuilt as `PackSnapshot` in `snapshot.ts`, passed as `as unknown as SimPack` in message routes,
  partially validated in `contracts/sim-pack-draft.ts`, and configured in `assignment-types.ts`.
- **Data access mixed with business logic** — `getManagerAssessmentContext()` queries 6 tables and
  transforms in one function. LangGraph nodes should be pure: load data in one node, transform in another.
- **Type erosion via `as any`** — 26+ `as any` casts in API routes alone. Without canonical schemas,
  the LangGraph pipeline will compound this.

---

## 2. Guiding Principle: One Schema Per Domain Concept

Every domain concept — assessment, pack, criterion, proposal, thread — has a single canonical schema
in `lib/mvp/schema/`. All consumers import from there. When a concept changes, you edit one file and
TypeScript tells you everywhere that needs updating.

Example for a criterion:

```typescript
// lib/mvp/schema/criterion.ts — the ONLY source of truth
export const CRITERION_DEFINITIONS = {
  identity_check: {
    id: 'identity_check',
    label: 'Verified user identity',
    category: 'call_control',
    weight: 1,
    description: 'Candidate confirmed user identity before proceeding.',
    frameworkIds: ['callum_baseline_v1', 'cyber_essentials_2025', 'gdpr_2018'],
    evidencePatterns: ['verify', 'confirm', 'identity', 'who am I speaking'],
    fundamentalFor: ['callum_baseline_v1'],
  },
  // ... all criteria in one file
} as const;
```

All other files import from here:
- `analysis/evidencePrompt.ts` — imports `CRITERION_DEFINITIONS` to build the AI prompt
- `analysis/scoring.ts` — imports `CRITERION_DEFINITIONS` for weights and categories
- `compliance/frameworks/` — each framework references criterion IDs (single source of truth for IDs)
- `results/scoring-calculator.ts` — if kept, imports rather than redefining
- `lib/mvp/capabilities/training.ts` — uses criterion IDs in proposal payloads

---

## 3. New Directory Structure

```
lib/mvp/
  schema/                          ← NEW: canonical schemas, one file per domain concept
    assessment.ts                  ← ManagerAssessmentContext, AssessmentRecord
    pack.ts                        ← SimPack, PackSnapshot, pack validation
    criterion.ts                   ← CRITERION_DEFINITIONS, weights, categories
    proposal.ts                    ← CallumProposal, ProposalStatus, payload schemas
    page-context.ts                ← MOVE from contracts/ (consolidate)
    capability.ts                  ← MOVE from contracts/ (consolidate)
    graph-state.ts                 ← NEW: LangGraph state type
    errors.ts                      ← Error codes, structured error shapes

  store/                           ← NEW: data access layer, one file per domain
    loadAssessment.ts              ← getFullAssessment, getManagerAssessmentContext
    loadPack.ts                    ← getPackById, listPacks, buildPackSnapshot
    saveProposal.ts                ← createCallumProposal, confirmCallumProposal
    saveResult.ts                  ← persist analysis result
    loadThread.ts                  ← getOrCreateCallumThread, appendCallumMessage
    loadStandards.ts               ← getManagerStandards, getManagerStandardsContext
    loadEvents.ts                  ← getSessionEvents, appendSessionEvent

  domains/                         ← NEW: one folder per domain, each has schema+capabilities+logic
    assessment/                    ← Assessment CRUD, review context, analysis trigger
      schema.ts                    ← domain-specific sub-types (imports from schema/)
      service.ts                   ← createAssessment, triggerAnalysis
      capabilities.ts              ← get_assessment_review_context (registered capability)
    training/                      ← Training drills, proposals, confirmation
      schema.ts
      service.ts                   ← createMvpAssessment (shared)
      capabilities.ts              ← draft_training_assignment, confirm_proposal
    framework/                     ← Compliance frameworks, evaluator, pack-relevance
      schema.ts                    ← FrameworkDefinition, CriterionResult (consolidated)
      evaluator.ts                 ← evaluateSingleFramework, evaluateAllFrameworks
      pack-relevance.ts            ← getRelevantCriteria
      index.ts                     ← DEFAULT_FRAMEWORKS
      callum-baseline.ts           ← framework definition (references schema/criterion.ts IDs)
      kepner-tregoe.ts             ← same pattern
      ...                          ← all 11 frameworks follow same pattern
    sim-pack/                      ← Simulation packs, state machine, scoring
      schema.ts                    ← SimPack, SimState, SimAction (consolidated from sim/types.ts)
      stateMachine.ts              ← applyAction, transitionPhase
      scoring.ts                   ← scoreSimEvents
      snapshot.ts                  ← buildPackSnapshot, validatePackStructure
      mergeConfig.ts               ← mergeAssessmentConfig
      resolver.ts                  ← resolveSimAssessment
      aiCustomer.ts                ← buildAiCustomerContext
      safeProjection.ts            ← getVisibleState
      packs/                       ← pack definitions (unchanged)
        index.ts
        outlook-work-offline.ts
        password-reset.ts
        new-starter-triage.ts
        shared-mailbox-access.ts
      registry.ts                  ← getPackById, listPacks

  callum/                          ← KEEP: proposals, memory, thread (already well-structured)
    proposals.ts                   ← update to import from schema/proposal.ts
    memory.ts                      ← update to import from schema/
    profile.ts                     ← manager_callum_profiles operations

  langgraph/                       ← NEW: LangGraph graph definition
    graph.ts                       ← StateGraph definition
    state.ts                       ← GraphState type (imports from schema/graph-state.ts)
    nodes/
      validatePageContext.ts       ← validate CallumPageContext
      loadContext.ts               ← load assessment from store/
      classifyIntent.ts            ← intent classification
      invokeCapability.ts          ← capability dispatch
      produceResponse.ts           ← build response from capability output
      persistThread.ts             ← save thread messages
      persistProposal.ts           ← save/confirm/reject proposal
    tools/
      registry.ts                  ← tool definitions from all domains

  analysis/                        ← KEEP: extraction, narrative (logic, not schema)
    evidencePrompt.ts              ← import criteria from schema/criterion.ts
    narrativePrompt.ts
    validation.ts
    scoring.ts                     ← import criteria from schema/criterion.ts
    runBaseCallumAnalysis.ts       ← orchestration (will be replaced by LangGraph nodes)
    context.ts                     ← REMOVE (replaced by store/loadAssessment.ts)
    types.ts                       ← REMOVE (replaced by schema/)

  compliance/                      ← MOVE into domains/framework/
  sim/                             ← MOVE into domains/sim-pack/
  events/                          ← MOVE into store/loadEvents.ts
  manager/context.ts               ← MOVE into store/loadAssessment.ts
  results/scoring-calculator.ts    ← REMOVE (orphaned, not used by pipeline)
  contracts/                       ← REMOVE (content moves to schema/ and domains/*/schema.ts)

  assignments/                     ← NEW: assignment-type config
    schema.ts                      ← AssignmentType, capabilities per type
    config.ts                      ← ENABLED_TRAINING_DRILL_PACKS, type configs

  query.ts                         ← REMOVE (replaced by store/)
  assignment-types.ts              ← MOVE into assignments/
  modules.ts                       ← KEEP (system registry)
  db.ts                            ← KEEP (init, migrations, seed — schema layer)
```

---

## 4. LangGraph State Schema

This is the single most important new file. Every graph node reads from and writes to this shape:

```typescript
// lib/mvp/schema/graph-state.ts
import type { CallumPageContext } from './page-context';
import type { ManagerAssessmentContext } from './assessment';
import type { CallumProposal } from './proposal';

export interface CallumThread {
  id: string;
  managerProfileId: string;
}

export type CallumIntent =
  | 'explain_assessment'
  | 'suggest_next_training'
  | 'confirm_proposal'
  | 'reject_proposal'
  | 'navigate'
  | 'general_question';

export interface CapabilityInvocation {
  name: string;
  input: unknown;
  result?: { ok: true; output: unknown } | { ok: false; error: string };
}

export interface GraphState {
  // Incoming
  pageContext: CallumPageContext;
  message: string;
  threadId?: string;
  managerProfileId: string;

  // Thread
  thread: CallumThread | null;

  // Intent
  intent: CallumIntent | null;

  // Navigation
  targetRoute?: string;

  // Assessment context (loaded by node)
  assessmentContext: ManagerAssessmentContext | null;

  // Capability
  activeCapability: CapabilityInvocation | null;

  // Proposal
  proposal: CallumProposal | null;
  proposalAction: 'confirm' | 'reject' | null;

  // Response
  response: {
    type: 'answer' | 'proposed_action' | 'navigation';
    message: string;
    pendingActionId?: string;
    targetRoute?: string;
    dataGaps?: string[];
  } | null;

  // Errors (accumulated, not overwritten)
  errors: string[];
}
```

**Why this shape matters:**
- Every node produces `Partial<GraphState>`. The reducer merges by field.
- Errors accumulate rather than overwrite — a failed node doesn't destroy state from previous nodes.
- Only `pageContext`, `message`, and `managerProfileId` are required at graph entry. Everything else is loaded/classified/invoked by nodes.
- The response is built last, from accumulated state, never directly by a capability handler.

---

## 5. LangGraph Node Signatures

Every node is a pure function:

```typescript
// nodes/validatePageContext.ts
import type { GraphState } from '../state';

export function validatePageContextNode(state: GraphState): Partial<GraphState> {
  const result = validateCallumPageContext(state.pageContext);
  if (!result.valid) {
    return { errors: [...state.errors, `Invalid pageContext: ${result.errors.map(e => e.message).join('; ')}`] };
  }
  return { pageContext: result.data! };
}
```

```typescript
// nodes/invokeCapability.ts
export async function invokeCapabilityNode(state: GraphState): Promise<Partial<GraphState>> {
  if (!state.intent) return { errors: [...state.errors, 'No intent to route'] };
  if (state.intent === 'navigate') return {}; // handled by separate node

  const capabilityName = INTENT_TO_CAPABILITY[state.intent];
  if (!capabilityName) return { errors: [...state.errors, `No capability for intent: ${state.intent}`] };

  const result = await invokeCapability(capabilityName, buildInput(state), {
    managerProfileId: state.managerProfileId,
    threadId: state.thread?.id,
    pageContext: state.pageContext,
  });

  return { activeCapability: { name: capabilityName, input: buildInput(state), result } };
}
```

**Why this works better than the current route.ts:**
- Each node is independently testable with a mock state.
- The graph can be visualized, traced, and checkpointed.
- Adding a new intent means adding a new node, not extending a 200-line switch statement.
- Error handling is per-node, not a single try/catch at the route boundary.

---

## 6. Tool Definition Contract

Every capability exposed to the LLM follows this exact shape:

```typescript
// lib/mvp/langgraph/tools/registry.ts
import { z } from 'zod';

export interface ToolDefinition<InputSchema extends z.ZodType> {
  name: string;
  description: string;           // Used by LLM to decide when to call
  domain: string;                // For grouping/audit
  access: 'read' | 'propose' | 'execute';
  requiresConfirmation: boolean;
  inputSchema: InputSchema;      // Zod schema → auto-generates LLM tool JSON
  outputSchema: z.ZodType;
  handler: (input: z.infer<InputSchema>, ctx: CapabilityContext) => Promise<unknown>;
}
```

Example:

```typescript
export const draftTrainingAssignmentTool: ToolDefinition<typeof inputSchema> = {
  name: 'draft_training_assignment',
  description: 'Create a pending training proposal based on the candidate assessment results. Does NOT execute — requires manager confirmation.',
  domain: 'training',
  access: 'propose',
  requiresConfirmation: false,
  inputSchema: z.object({
    assessmentId: z.string().describe('The assessment ID to base training on'),
    assessmentPackId: z.string().describe('Pack ID for the training drill'),
    rationale: z.string().optional().describe('Why this training was suggested'),
  }),
  outputSchema: z.any(),
  async handler(input, ctx) {
    const sourceContext = await loadAssessmentContext(ctx.managerProfileId, input.assessmentId);
    return createCallumProposal({ ... });
  },
};
```

**Why Zod over current ad-hoc validation:**
- Auto-generates LLM-compatible JSON schema for tool calling
- TypeScript types are inferred from the schema (no `as any`)
- Nested validation with readable error messages
- The LLM gets precise `description` strings for each field, reducing hallucinated params

---

## 7. Migration Sequence (Approved Order)

> **Important:** This is a roadmap, not a single build ticket. Only Phase 1 is approved for
> immediate execution. Phases 2-4 are deferred until the Callum proposal confirmation flow is
> proven in production. See §12 for the reasoning.

### Phase 1 — Schema consolidation [APPROVED NOW]

Low risk, high value. Criteria definitions are the most duplicated concept across the codebase
(7+ files). Consolidating them now prevents future drift without touching any product behaviour.

1. Create `lib/mvp/schema/criterion.ts` — extract all criteria definitions into one file
2. Update `analysis/evidencePrompt.ts` to import from `schema/criterion.ts`
3. Update `analysis/scoring.ts` to import from `schema/criterion.ts`
4. Update `analysis/runBaseCallumAnalysis.ts` to import from `schema/criterion.ts`
5. Remove duplicate definitions from each file
6. Verify `npm test` still passes (same criteria, same weights, same output)
7. Run scoring output comparison — confirm before/after scores match

### Phase 2 — Store layer [DEFERRED]

Wait until after:
- Callum proposal confirmation loop is complete
- At least one real proposal has been created, confirmed, and executed end-to-end
- Route-level tests exist for all Callum endpoints

1. Create `lib/mvp/store/loadAssessment.ts` — extract from `manager/context.ts`
2. Create `lib/mvp/store/loadPack.ts` — extract from `sim/packRegistry.ts`
3. Update callers to import from `store/` instead of `manager/` or `sim/`
4. Verify `npm test` still passes

### Phase 3 — Domain folders [DEFERRED]

Wait until after Phase 2 is stable for at least one week of active development.

1. Move `compliance/` → `domains/framework/`
2. Move `sim/` → `domains/sim-pack/`
3. Move `events/` → `store/loadEvents.ts`
4. Remove `contracts/` (files move to `schema/`)
5. Remove `assignment-types.ts` → `assignments/`
6. Deprecate `results/scoring-calculator.ts` (orphaned, not imported)
7. Verify `npm test` still passes

### Phase 4 — LangGraph graph [DEFERRED]

Wait until after Phases 1-3 are complete AND the product loop is proven.

1. Create `lib/mvp/schema/graph-state.ts`
2. Create `lib/mvp/langgraph/state.ts` (re-export with reducers)
3. Create individual nodes in `lib/mvp/langgraph/nodes/`
4. Create `lib/mvp/langgraph/graph.ts` — wire the StateGraph
5. Create `lib/mvp/langgraph/tools/registry.ts` — wrap capabilities as Zod-schema tools
6. Write a parallel route `app/api/mvp/callum/v2/route.ts` that uses the graph
7. Compare output with v1 route for the same inputs
8. Once stable, swap the v1 route to delegate to the graph
9. Delete the heuristic `classifyIntent()` and `buildAssessmentExplanation()` functions

---

## 8. Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Schema consolidation breaks imports across 20+ files | High | Do Phase 1 alone, run tests after every file change. TypeScript catches all broken imports at compile time. |
| Store layer duplicates existing query.ts | Medium | Tag `query.ts` as deprecated after Phase 2, remove in cleanup pass. |
| LangGraph introduces state management bugs | Medium | Keep the old `/api/mvp/callum` route as fallback. Run v1 vs v2 output comparison before switching. |
| Developers resist the new structure | Medium | The reorganization is additive (old paths still work via re-exports during transition). No one is blocked. |
| Graph state schema needs to change after initial design | Low | GraphState is a regular TypeScript type. Add fields as needed. The reducer handles partial updates. |
| Zod schemas add bundle size | Low | Zod is dev-only for API routes. Frontend never imports it. |

---

## 9. What This Enables That the Current Architecture Doesn't

| Capability | Current | After reorg |
|---|---|---|
| Add a new criterion | Edit 7+ files, hope they stay in sync | Edit `schema/criterion.ts`, TypeScript flags all consumers |
| Add a new pack | Copy-paste a pack file, add to registry, copy same criteria lists | Define pack in `domains/sim-pack/packs/`, done |
| Add a new LangGraph node | N/A (no graph yet) | Write a pure function `(state) => Partial<state>`, register in graph |
| Add a new LLM tool | Add capability, update route.ts switch, add ad-hoc validation | Define Zod schema, register tool, done |
| Change response shape | Update route.ts, update CallumPanel, update CallumActionCard | Update `GraphState.response`, TypeScript flags components |
| Audit tool usage | None (no logging) | Tool registry can wrap every invocation with telemetry |
| Run a test with mock state | Build complex mock objects per test file | Construct `GraphState` from canonical types, one pattern everywhere |

---

## 10. What Stays the Same

Not everything needs to change. These work well and should be left alone:

- **`lib/mvp/db.ts`** — init, migrations, seed. Only the table schemas belong here; domain queries move to `store/`.
- **`tests/`** — each test file stays with the module it tests (just updated imports).
- **`components/mvp/`** — UI components don't change. They consume API responses, which stay stable during the reorg.
- **`app/api/mvp/`** — route handlers stay. Only their imports change (from `manager/context` → `store/loadAssessment`).
- **`lib/mvp/callum/proposals.ts`** — well-structured, just needs schema imports.
- **`lib/mvp/langgraph/`** — all new code, no migration needed.

---

## 11. Summary

| Metric | Before | After |
|---|---|---|
| Criteria definition locations | 7+ files | 1 file (schema/criterion.ts) |
| `CriterionResult` interfaces | 3 incompatible | 1 (in schema/) |
| `FUNDAMENTAL_CRITERIA` sets | 2 with same name, different contents | 0 (replaced by fundamentalFor field on each criterion) |
| Data access location | Mixed across manager/, sim/, analysis/ | All in store/ |
| Context object types | 4+ ad-hoc | 1 GraphState |
| Tool validation | Hand-written if statements | Zod schemas inferred from type |
| `as any` casts (estimated) | 50+ | < 10 (at integration boundaries) |
| LangGraph readiness | None | Full graph with typed nodes and tools |

---

## 12. Review Verdict and Recommended Order

This proposal was reviewed against the current product state. The consensus:

**What the proposal gets right:**
- The diagnosis of duplicated criterion definitions, overlapping context objects, mixed data access/business logic, and type erosion is accurate.
- One canonical schema per domain concept is the right long-term architecture.
- The LangGraph state shape (`GraphState` with partial merges) is sensible.
- The tool contract (`name`, `description`, `domain`, `access`, `inputSchema`, `handler`) maps well to Callum's existing capability safety model.

**What the proposal gets wrong (ordering):**
- Phases 2-4 are too disruptive while Callum's basic action loop is unfinished.
- The product value right now is making Callum's pending proposals safely executable — not reorganising folders.
- Reorganising around an unproven product loop risks building abstractions that don't fit the actual workflow.

**Approved build order going forward:**

| Step | What | When |
|---|---|---|
| 1 | Finish proposal confirm/reject flow | **Now** — the product loop |
| 2 | Add tests for expired/stale/wrong-manager/double-confirm proposals | With step 1 |
| 3 | Manually verify Callum creates a real training assignment after confirmation | Gate for step 4 |
| 4 | **Phase 1 only:** Consolidate criterion schema | After step 3 passes |
| 5 | Re-run tests + compare scoring output before/after | Validate step 4 |
| 6 | Add LangGraph v2 route in parallel (not replacing v1) | After step 5, if product loop is stable |
| 7 | Compare v1 and v2 Callum outputs | Validate step 6 |
| 8 | Only then consider store/domain-folder reorg (Phases 2-3) | If step 7 passes |

**Risk statement:**

> This reorg should not become the next build task wholesale. Use it as the north star.
> The immediate product task is still making Callum's pending proposals safely executable.
> Once that works, the schema/store/LangGraph reorg will be much safer because you'll be
> reorganising around a proven product loop, not an imagined one.
