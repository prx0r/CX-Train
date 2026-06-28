# Callum Integration Implementation Log

Date: 2026-06-28

## Scope

Built the pre-LangGraph Callum foundation. This pass adds contracts, manager-safe context, capabilities, proposal persistence, proposal confirmation, and a first assessment-review Callum panel.

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

Confirmation is now handled by backend proposal resolution functions:

- `confirmCallumProposal`
- `rejectCallumProposal`

Confirmation checks:

- Proposal exists.
- Proposal belongs to the current manager profile.
- Proposal is still `pending`.
- Proposal has not expired.
- Source context hash still matches current manager assessment context.
- Payload matches the expected schema version.

Execution uses the shared MVP assessment creation service rather than raw SQL.

Proposal statuses now used:

- `pending`
- `approved`
- `executed`
- `rejected`
- `expired`
- `stale`
- `failed`

### API

Added:

- `app/api/mvp/callum/route.ts`
- `app/api/mvp/callum/proposals/[id]/confirm/route.ts`
- `app/api/mvp/callum/proposals/[id]/reject/route.ts`

Supported v0 behaviours:

- Explain an assessment result from manager-safe context.
- Suggest a training assignment as a pending proposal.
- Confirm a pending training proposal and create a real training drill assessment.
- Reject a pending proposal.
- Return navigation targets.
- Persist Callum thread messages.

### Assessment Creation Service

Added:

- `lib/mvp/assessments/create.ts`

Refactored:

- `app/api/mvp/assessments/route.ts`

The existing assessment creation endpoint now delegates to the shared service. Callum proposal confirmation uses the same service, so confirmed proposals go through the existing MVP assessment creation path instead of a custom database write path.

### UI

Added:

- `components/mvp/callum/CallumPanel.tsx`
- `components/mvp/callum/CallumActionCard.tsx`

Mounted on:

- `app/mvp/assessments/[id]/page.tsx`

The panel sends structured page context for the current assessment review page.

`CallumActionCard` now supports:

- Confirm
- Reject
- Inline execution result or failure message

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
- Execute capabilities requiring confirmation cannot run directly through the generic registry.
- Unknown page types normalize safely.
- Training assignment proposal persistence.
- Manager context reports data gaps when evidence is missing.
- Pending training proposal confirmation creates exactly one assessment.
- Confirmed proposals cannot be confirmed twice.
- Rejected proposals cannot later execute.
- Expired proposals cannot execute.
- Stale proposals cannot execute after source context changes.
- Proposals cannot be confirmed by a different manager profile.
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

## Manual Verification

Manual verification was run against a fresh temporary SQLite database:

```bash
MVP_SQLITE_PATH=/tmp/callum-manual-verify.db AI_PROVIDER=mock NEXT_PUBLIC_APP_URL=http://127.0.0.1:3001 npm run dev:mvp
```

Verified:

- Created a fresh training drill assessment.
- Submitted candidate interaction and ticket.
- Analysis completed with a concrete score.
- `/mvp/assessments/[id]` returned HTTP 200.
- Asking Callum `Why did they score low?` returned an assessment-grounded answer using candidate/result/ticket context and data gaps.
- Asking Callum `Assign them something to improve this` returned a `create_training_assignment` proposed action.
- Proposal row contained proposal type, payload schema version, payload JSON, pending/executed status, source context hash, and expiry.
- Confirming the proposal created one new training drill assessment through the shared MVP creation service.
- Confirmation changed the proposal status to `executed`.

Observed existing taxonomy seed warnings during dev-server startup. They did not block the Callum flow and were not part of this change.

## Deliberately Not Built Yet

- LangGraph graph.
- LangGraph interrupts/checkpointing.
- Edit proposal UI behaviour.
- DB-backed custom sim packs.
- Runtime sim pack creation.
- Persistent Callum dock across all manager pages.
- Candidate-facing Callum.

## Next Recommended Step

Wrap the working capability/proposal flow in LangGraph only after this confirmation loop is accepted:

1. Validate page context.
2. Load manager Callum profile.
3. Classify intent.
4. Route to existing read/propose capabilities.
5. Produce answer or proposal.
6. Persist thread messages.

Do not use LangGraph interrupts for proposal confirmation yet. The SQLite proposal table remains the product-level confirmation boundary.
