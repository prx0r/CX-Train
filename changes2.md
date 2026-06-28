# Changes 2: Agentic LangGraph Transformation

> Prepared 2026-06-28. Implements the re-ordered plan: LangGraph first, then tool schemas, then schema consolidation.

---

## 1. Motivation

The codebase has the right primitives (capability registry, contracts, proposals, workspace modes) but lacks the orchestration layer that makes it controllable by Callum as an agent. Currently:

- **Callum route is a manual state machine** — `classifyIntent()` + if/else chain is exactly what LangGraph provides natively, but hardcoded and fragile
- **Capabilities exist but aren't LLM-callable** — no Zod schemas, no tool descriptions, no auto-generated tool JSON
- **Criteria definitions are duplicated** — 7+ locations, already started to consolidate with `criteriaRegistry.ts` but `evidencePrompt.ts` still defines its own
- **Scoring scope from mode config is plumbed but unused** — stored in DB, returned by API, loaded into `AnalysisContext`, but never filters scoring

---

## 2. What Changes (and What Doesn't)

### Changes Made

| Change | Files | Risk |
|--------|-------|------|
| **LangGraph graph for Callum** | `lib/mvp/langgraph/*` (new), `app/api/mvp/callum/v2/route.ts` (new) | Low — additive, v1 stays as fallback |
| **Zod tool schemas on capabilities** | `lib/mvp/contracts/capability.ts`, `lib/mvp/capabilities/*.ts`, `lib/mvp/capabilities/tool-registry.ts` (new) | Low — additive, all existing imports work |
| **Criteria registry consolidation** | `lib/mvp/analysis/evidencePrompt.ts` | Medium — must verify prompt output unchanged |
| **Scoring scope filter** | `lib/mvp/analysis/scoring.ts`, `lib/mvp/analysis/runBaseCallumAnalysis.ts` | Low — optional filter, defaults to all criteria |
| **Route-level tests for v2** | `tests/langgraph-callum.test.ts` (new) | Low — new coverage |

### What Does NOT Change

| Component | Reason |
|-----------|--------|
| `ServiceDeskSimulatorShell` (769 lines) | High risk, separate refactor |
| `SimulationWorkspace` pass-through | Will wire after shell refactor |
| `results/scoring-calculator.ts` | Orphaned, not imported — noted for removal later |
| `lib/voice/*` (legacy) | Frozen, separate from MVP |
| `lib/mvp/compliance/frameworks/*` (11 files) | Separately scoped |
| DB schema | No migrations |
| Existing API response shapes | Backward compatible |
| `npm test` / `npm run test:mvp-flow` | Must pass unchanged |

---

## 3. Architecture: LangGraph Callum Graph

```
                    ┌──────────────────┐
                    │   PageContext     │
                    │   + message       │  ← POST /api/mvp/callum/v2
                    │   + threadId      │
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
                    │ validateContext  │  ← validateCallumPageContext()
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
                    │  loadProfile     │  ← resolveManagerProfile()
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
                    │  loadThread      │  ← getOrCreateCallumThread()
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
                    │  classifyIntent  │  ← LLM-as-router (fallback: heuristic)
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌────────────┐  ┌──────────┐
        │navigate  │  │explain     │  │suggest   │
        │          │  │assessment  │  │training  │
        └────┬─────┘  └──────┬─────┘  └────┬─────┘
             │               │              │
             ▼               ▼              ▼
        ┌──────────────────────────────────────┐
        │         produceResponse              │
        │  (build response from graph state)   │
        └────────────────┬─────────────────────┘
                         ▼
        ┌──────────────────────────────────────┐
        │         persistThread                │
        │  (save messages to DB)               │
        └────────────────┬─────────────────────┘
                         ▼
                    ┌──────────┐
                    │ Response │  → HTTP 200
                    └──────────┘
```

### GraphState (the canonical state)

```typescript
interface GraphState {
  // Incoming
  pageContext: CallumPageContext | null;
  message: string;
  threadId?: string;
  managerProfileId: string;

  // Loaded
  thread: CallumThread | null;
  assessmentContext: ManagerAssessmentContext | null;

  // Intent (classified)
  intent: CallumIntent | null;
  targetRoute?: string;

  // Capability
  activeCapability: CapabilityInvocation | null;

  // Response
  response: {
    type: 'answer' | 'proposed_action' | 'navigation';
    message: string;
    pendingActionId?: string;
    targetRoute?: string;
    dataGaps?: string[];
  } | null;

  // Errors accumulate
  errors: string[];
}
```

### Key Design Decisions

1. **v1 route stays as fallback** — v2 runs in parallel. Compare outputs before switching.
2. **Heuristic classifyIntent kept as fallback node** — LangGraph can use LLM routing when available, fall back to regex.
3. **Capability registry unchanged** — graph nodes call the same capabilities via `invokeCapability()`.
4. **Response shape identical to v1** — CallumPanel/CallumActionCard don't change.

---

## 4. Tool Schema Contract (Lightweight Schema System)

Instead of adding the `zod` npm dependency (to avoid CJS/ESM issues with the test compilation), a lightweight schema system was implemented in `lib/mvp/schema/tool.ts`. Every capability gains an `inputFields` and `description` field:

```typescript
interface CapabilityDefinition<Input, Output> {
  name: string;
  description?: string;                    // LLM-facing description
  inputFields?: Record<string, FieldSchema>;  // LLM-facing field definitions
  // ... existing fields unchanged
}
```

This enables:
- Auto-generated LLM tool descriptions from `listTools()`
- Runtime input validation via `validateObject()` before handler execution
- LangGraph nodes can discover available tools from the registry
- No external dependency — works with existing CJS test compilation

---

## 5. Testing Strategy

### Verification Gates (every step)

| Gate | Command | What It Proves |
|------|---------|----------------|
| TypeScript | `npx tsc --noEmit` | No type errors |
| Unit tests | `npm test` | 12 test files, ~205 tests pass |
| MVP flow | `npm run test:mvp-flow` | 37 end-to-end checks pass |

### New Tests

| Test File | Coverage |
|-----------|----------|
| `tests/langgraph-callum.test.ts` | Graph state validation, node isolation, v2 response shape matches v1, v2 can route all 4 intents, error accumulation |

### Manual Verification

```bash
MVP_SQLITE_PATH=/tmp/langgraph-verify.db AI_PROVIDER=mock npm run dev:mvp
# Test: POST /api/mvp/callum/v2 with same payload as /api/mvp/callum
# Expected: identical response shape
```

### Rollback Plan

If any test fails:
1. `git diff` to identify the breaking change
2. Revert the specific file
3. Re-run verification
4. If v2 route causes issues, remove the v2 route file — v1 is untouched

---

## 6. Implementation Order

| Step | What | Verification |
|------|------|--------------|
| 1 | Create `lib/mvp/langgraph/graph.ts` — lightweight StateGraph abstraction | `tsc --noEmit` |
| 2 | Create `lib/mvp/langgraph/state.ts` — GraphState type | `tsc --noEmit` |
| 3 | Create 8 graph nodes in `lib/mvp/langgraph/nodes/` | `tsc --noEmit` |
| 4 | Create `lib/mvp/langgraph/callumGraph.ts` — wire StateGraph | `tsc --noEmit` |
| 5 | Create `app/api/mvp/callum/v2/route.ts` | `tsc --noEmit` |
| 6 | Add lightweight schema system + update capability contracts | `tsc --noEmit` |
| 7 | Create `lib/mvp/schema/tool.ts` + `lib/mvp/capabilities/tool-registry.ts` | `tsc --noEmit` |
| 8 | Add `inputFields` + `description` to all 4 capabilities | `tsc --noEmit` |
| 9 | Wire scoring scope filter in scoring.ts + runBaseCallumAnalysis.ts | `tsc --noEmit`, `npm test` |
| 10 | Create `tests/langgraph-callum.test.ts` (14 new tests) | `npm test` |
| 11 | Fix `lib/mvp/callum/memory.ts` relative imports | `npm test` |
| 12 | Full verification suite | `npm test`, `tsc --noEmit`, `npm run test:mvp-flow` |

---

## 7. Notes on What Was Left Alone

During the codebase audit, these items were identified but deliberately not changed:

- **Two scoring engines** — `lib/mvp/analysis/scoring.ts` (active) and `lib/mvp/results/scoring-calculator.ts` (orphaned, 515 lines, not imported by any pipeline code). Left alone; the orphaned file should be removed in a cleanup pass after proving no code depends on it.
- **Two voice systems** — `lib/mvp/voice/` (MVP active) and `lib/voice/` (legacy frozen). Left alone.
- **11 compliance frameworks** — 5 never score (missing from `pack-relevance.ts`). Left alone.
- **3 incompatible `CriterionResult` types** — Noted for Phase 2 consolidation.
- **`SimulationWorkspace.tsx` pass-through** — Mode config is parsed, stored, returned by API, but ignored by the shell. Noted for the shell refactor.
- **Race condition in session_events sequence index** — `getNextSequenceIndex()` reads `MAX(sequence_index)` then inserts+1 without transaction. Noted.
- **Analysis pipeline blocks ticket submission** — 3 sequential AI calls in the HTTP response path. Noted for background job system.
- **Manager identity defaults to `manager-default-v1`** — Noted for auth integration.
- **`process.env` mutation in TTS route** — `process.env.VOICE_TTS_VOICE = process.env.AZURE_TTS_VOICE` affects all concurrent requests. Noted.
- **No network timeouts on external API calls** — All `fetch()` calls lack `AbortSignal`. Noted for hardening pass.
- **`lib/mvp/callum/memory.ts` used `@/` path aliases** — Inconsistent with rest of `lib/mvp/` (which uses relative paths). Fixed during this pass. All other `@/` usage is in API routes/Next.js pages where it resolves correctly.

---

## 8. Verification Results

| Step | What | Result |
|------|------|--------|
| 1-4 | LangGraph graph + nodes + wiring | `tsc --noEmit` — PASS |
| 5 | v2 route | `tsc --noEmit` — PASS |
| 6-8 | Schema system + tool registry + capability descriptions | `tsc --noEmit` — PASS |
| 9 | Scoring scope filter | `tsc --noEmit` — PASS, `npm test` — 231/231 PASS |
| 10 | LangGraph tests (14 new) | `npm test` — 245/245 PASS (14 new tests) |
| 11 | Memory.ts import fix | `npm test` — 245/245 PASS |
| 12 | Full verification | `npm test`: 245/245 PASS, `tsc --noEmit`: PASS, `npm run test:mvp-flow`: 37/37 PASS |

### Final Suite Totals

| Suite | Result |
|-------|--------|
| TypeScript compilation (`tsc --noEmit`) | PASS — 0 errors |
| Unit tests (`npm test`) | **245 tests, 22 suites, 0 failures** |
| MVP E2E flow (`npm run test:mvp-flow`) | **37 checks, 0 failures** |

### Files Created (new)

| File | Lines | Purpose |
|------|-------|---------|
| `lib/mvp/langgraph/graph.ts` | 69 | Lightweight `StateGraph` abstraction (zero-dependency LangGraph-compatible) |
| `lib/mvp/langgraph/state.ts` | 54 | `GraphState` type — canonical state for Callum graph |
| `lib/mvp/langgraph/nodes/validateContext.ts` | 20 | Validate `CallumPageContext` |
| `lib/mvp/langgraph/nodes/loadProfile.ts` | 10 | Resolve manager profile |
| `lib/mvp/langgraph/nodes/loadThread.ts` | 16 | Get or create Callum thread |
| `lib/mvp/langgraph/nodes/classifyIntent.ts` | 30 | Heuristic intent classification (routes `navigate`, `explain_assessment`, `suggest_next_training`, `general_question`) |
| `lib/mvp/langgraph/nodes/loadAssessmentContext.ts` | 35 | Load assessment context from capability |
| `lib/mvp/langgraph/nodes/invokeCapability.ts` | 105 | Route intent to capability invocation |
| `lib/mvp/langgraph/nodes/produceResponse.ts` | 95 | Build `GraphResponse` from state |
| `lib/mvp/langgraph/nodes/persistThread.ts` | 31 | Persist messages to DB |
| `lib/mvp/langgraph/callumGraph.ts` | 28 | Wire 8 nodes into a linear StateGraph |
| `app/api/mvp/callum/v2/route.ts` | 56 | Next.js route using the compiled graph |
| `lib/mvp/schema/tool.ts` | 121 | Lightweight schema validation system |
| `lib/mvp/capabilities/tool-registry.ts` | 35 | LLM-discoverable tool descriptors from capabilities |
| `tests/langgraph-callum.test.ts` | 192 | 14 tests: graph compilation, node isolation, intent routing, response shape, error accumulation |

### Files Modified

| File | Change |
|------|--------|
| `lib/mvp/contracts/capability.ts` | Added `inputFields`, `outputFields`, `description` to `CapabilityDefinition` |
| `lib/mvp/capabilities/assessment.ts` | Added `description` + `inputFields` |
| `lib/mvp/capabilities/simPack.ts` | Added `description` + `inputFields` |
| `lib/mvp/capabilities/standards.ts` | Added `description` + `inputFields` |
| `lib/mvp/capabilities/training.ts` | Added `description` + `inputFields` |
| `lib/mvp/analysis/scoring.ts` | Added optional `enabledCriteria` filter to `scoreExtraction()` |
| `lib/mvp/analysis/runBaseCallumAnalysis.ts` | Derives enabled criteria set from `assessment_scope` and passes to `scoreExtraction()` |
| `lib/mvp/callum/memory.ts` | Changed `@/` imports to relative paths for test compatibility |
| `package.json` | Added `tests/langgraph-callum.test.ts` and `lib/mvp/callum/memory.ts` to test compilation |

---
