# Callum Integration Implementation Log

Date: 2026-06-28

## Scope

Built the pre-LangGraph Callum foundation. This pass adds contracts, manager-safe context, capabilities, proposal persistence, and a first assessment-review Callum panel.

LangGraph was intentionally not added yet.

## What Changed

### Contracts

Added `lib/mvp/contracts/`:

- `validation.ts`
- `page-context.ts`
- `capability.ts`
- `sim-pack-draft.ts`
- `assessment.ts`

These define versioned, runtime-validated shapes for Callum-facing page context, sim pack drafts, capability definitions, and manager assessment context.

### Manager Context

Added:

- `lib/mvp/manager/context.ts`

This provides server-side manager-safe projections such as assessment review context. The API reloads authoritative context from the database instead of trusting client page text.

### Capabilities

Added `lib/mvp/capabilities/`:

- `registry.ts`
- `assessment.ts`
- `simPack.ts`
- `standards.ts`
- `training.ts`
- `index.ts`

Initial capabilities:

- `get_assessment_review_context`
- `list_sim_packs`
- `get_manager_standards`
- `draft_training_assignment`

Callum now talks to registered capabilities rather than arbitrary SQL or raw implementation modules.

### Proposals And Memory

Added:

- `lib/mvp/callum/proposals.ts`
- `lib/mvp/callum/memory.ts`

Added SQLite tables in `lib/mvp/db.ts`:

- `callum_threads`
- `callum_messages`
- `callum_proposals`
- `manager_callum_profiles`

Training assignment requests are stored as pending proposals, not executed immediately.

### API

Added:

- `app/api/mvp/callum/route.ts`

Supported v0 behaviours:

- Explain an assessment result from manager-safe context.
- Suggest a training assignment as a pending proposal.
- Return navigation targets.
- Persist Callum thread messages.

### UI

Added:

- `components/mvp/callum/CallumPanel.tsx`
- `components/mvp/callum/CallumActionCard.tsx`

Mounted on:

- `app/mvp/assessments/[id]/page.tsx`

The panel sends structured page context for the current assessment review page.

### AI Provider

Updated:

- `lib/ai/provider.ts`

Added `callum` as an accepted `runAiTask` task name for future model-backed Callum nodes.

## Tests Added

Added:

- `tests/callum-contracts.test.ts`

Coverage:

- Page context validation and normalization.
- Page context rejection when route is missing.
- Sim pack draft validation.
- Unknown capability rejection.
- Training assignment proposal persistence.
- Candidate assessment routes do not import manager context.

Updated:

- `package.json`

The new contract test is now included in `npm test`.

## Verification Run

Commands run:

```bash
npm test
./node_modules/.bin/tsc --noEmit
npm run test:mvp-flow
```

Results:

- `npm test`: passed, 11 suites, 0 failed.
- `tsc --noEmit`: passed.
- `npm run test:mvp-flow`: passed, 37 passed, 0 failed.

## Deliberately Not Built Yet

- LangGraph graph.
- LangGraph interrupts/checkpointing.
- Executable Callum actions.
- Confirm/edit/cancel proposal UI behaviour.
- DB-backed custom sim packs.
- Runtime sim pack creation.
- Persistent Callum dock across all manager pages.
- Candidate-facing Callum.

## Next Recommended Step

Add proposal confirmation flow:

1. Confirm pending proposal.
2. Revalidate source context hash / expiry.
3. Execute existing assessment creation logic.
4. Mark proposal executed or failed.

After that, wrap the same capability flow in LangGraph.
