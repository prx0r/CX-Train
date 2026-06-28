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

## Preliminary Testing Pass

Rerun on 2026-06-28 after the proposal confirmation commit:

```bash
npm test
./node_modules/.bin/tsc --noEmit
npm run test:mvp-flow
```

Results:

- `npm test`: passed, 11 test files, 0 failed.
- `tsc --noEmit`: passed.
- `npm run test:mvp-flow`: passed, 37 checks, 0 failed.

What this proves:

- Contract validators compile and run.
- Capability registry rejects unknown capabilities.
- Capabilities that require confirmation cannot execute through the generic registry.
- Training proposal creation persists a pending proposal.
- Proposal confirmation creates one assessment through the shared MVP creation service.
- Double confirmation is blocked.
- Rejected, expired, stale, and wrong-manager proposals do not execute.
- Existing MVP flow still passes after extracting assessment creation into `lib/mvp/assessments/create.ts`.

What this does not prove yet:

- Browser-level Callum panel behaviour across desktop/mobile.
- Confirm/reject button behaviour in a real hydrated page.
- Route handlers under a running Next server for every error path.
- Concurrent confirmation attempts against the same proposal.
- Authenticated manager identity enforcement beyond the current default manager profile.
- Production database migration behaviour on an existing SQLite file.

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

## Further Testing Needed

### Browser And API Testing

Add Playwright or equivalent browser coverage for:

- `/mvp/assessments/[id]` renders the Callum panel without hydration errors.
- `Why did they score low?` produces an answer using current assessment context.
- `Assign them something to improve this` renders a proposal card.
- Confirm creates a new training drill assessment and disables the action buttons.
- Reject marks the proposal rejected and disables the action buttons.
- Stale and expired proposal responses are displayed clearly.
- Navigation responses route to the intended MVP page.

Add route-level tests for:

- `POST /api/mvp/callum`
- `POST /api/mvp/callum/proposals/[id]/confirm`
- `POST /api/mvp/callum/proposals/[id]/reject`

The current tests exercise the underlying functions more deeply than the Next route handlers. That is useful, but route coverage is still needed because request parsing, status codes, default manager profile handling, and response shapes can drift.

### Data And Migration Testing

Test against:

- A fresh database.
- An existing database created before the Callum tables existed.
- A database with pending proposals created before a schema version change.
- A database with multiple managers once real manager identity is wired in.

### Concurrency Testing

Confirm the same proposal twice in parallel. The expected result is one execution and one rejection with `NOT_PENDING` or equivalent. The current logic blocks a second sequential confirmation, but it does not yet use an explicit SQLite transaction or compare-and-set update around status transition.

### Security Testing

Keep adding tests that prove:

- Candidate token endpoints never import manager context.
- Candidate token endpoints never return hidden facts, rubrics, red flags, ideal actions, manager standards, or Callum thread/proposal data.
- Client page context cannot override server-loaded assessment IDs or manager-only data.
- Capability names and payloads are validated before any execution path.

### AI Behaviour Testing

Once real Callum LLM calls are enabled, add golden prompt/response tests for:

- Evidence-grounded assessment explanation.
- Data gaps shown when evidence is missing.
- Refusal to invent packs, candidates, scores, or transcripts.
- Proposal-only behaviour for create/update/send actions.
- Manager style applied only after factual reasoning is complete.

## Potential Break Points

- `callum_proposals` status changes are not wrapped in one atomic transaction. Parallel confirmation could race.
- Manager identity is still effectively `manager-default-v1` in the new route handlers. Real auth/manager resolution must replace this before multi-manager use.
- `CallumActionCard` assumes confirm success means a training assignment was created. Future proposal types need proposal-type-specific success copy.
- Proposal payload validation is currently narrow and hand-written for `create_training_assignment`. More proposal types need formal contract validators.
- Source context hashing depends on the current shape of manager assessment context. Intentional context changes will make old proposals stale, which is correct, but rollout messaging needs to be clear.
- The shared assessment creation service still seeds defaults internally. That is pragmatic for MVP, but production paths may want explicit init/migration boundaries.
- Existing taxonomy seed warnings appeared during manual dev-server verification. They did not block this flow, but they are noise and could hide future startup failures.
- UI confirmation does not yet refresh assessment lists or navigate to the created training drill.
- There is no edit proposal flow yet. Managers must reject/regenerate rather than adjust a proposal.

## Not Wired Yet

- LangGraph graph wrapper.
- LangGraph checkpointer or interrupts.
- Real manager authentication in Callum routes.
- Organization or multi-manager authorization.
- Proposal edit flow.
- Proposal list/history UI.
- Persistent dashboard-wide Callum dock.
- Custom sim pack authoring lifecycle.
- Executable custom sim packs generated from Callum drafts.
- Manager memory beyond stored Callum messages/profile.
- Tool/capability telemetry and audit analytics.
- Formal route-handler tests for Callum APIs.

## Future Backend Integration Principles

Every future backend process that Callum can touch should be integrated in this order:

1. Define the contract in `lib/mvp/contracts`.
2. Add a server-side context loader or service function that owns the real data access.
3. Register a narrow capability in `lib/mvp/capabilities`.
4. Mark the capability as `read`, `propose`, or `execute`.
5. For writes, create a proposal payload schema version.
6. Persist a proposal with source context hash, expiry, and validation result.
7. Require manager confirmation before execution.
8. Execute through the existing product service, not custom SQL inside Callum.
9. Add contract tests, capability tests, proposal tests, and candidate non-leak tests.
10. Only then expose the capability to the Callum route or LangGraph node.

Callum should keep talking to capabilities, not implementation details. That means no arbitrary SQL tools, no direct imports of candidate context loaders, no React prop scraping, and no unvalidated AI JSON in execution paths.

## Future LangGraph Shape

LangGraph should wrap the working capability/proposal loop rather than replace it.

Recommended graph v1:

1. `validatePageContext`
2. `loadManagerCallumProfile`
3. `loadAuthoritativeContext`
4. `classifyIntent`
5. `routeIntent`
6. `invokeReadCapabilities`
7. `produceAnswerOrProposal`
8. `persistThreadMessage`
9. `finalizeResponse`

Writes should still go through the proposal table. Do not use LangGraph interrupts as the source of truth for confirmation until the SQLite proposal lifecycle is reliable in production. Later, LangGraph interrupts can become a UX/runtime convenience, but the product audit trail should remain in proposals.

When adding new backend domains, prefer a boring pattern:

- Contract first.
- Capability second.
- Proposal third.
- UI fourth.
- Graph wrapper last.

This keeps the manager operating layer extensible without letting Callum become a fragile prompt that depends on whichever component or database table happens to exist today.

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
