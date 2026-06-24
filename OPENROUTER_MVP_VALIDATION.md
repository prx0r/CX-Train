# OpenRouter MVP Validation Report

## 1. What was changed

The primary AI provider was switched from Chutes AI to OpenRouter free models. The existing deterministic scoring, candidate web flow, and manager report infrastructure were preserved.

## 2. What files were changed

### Created
- `lib/ai/provider.ts` - OpenAI-compatible provider layer with task routing and error handling
- `scripts/test-openrouter.mjs` - Standalone API key smoke test
- `.env.local` - Local config with the supplied OpenRouter key (not committed)

### Modified
- `lib/assessment-ai.ts` - `extractAssessmentEvidence` now uses `runAiTask('evaluator', ...)`
- `app/api/assessment/[token]/respond/route.ts` - Caller simulation now uses `runAiTask('caller', ...)`
- `lib/ai/index.ts` - Exports new provider functions
- `package.json` - Added `test:openrouter` script
- `.env.example` - OpenRouter vars as primary; Chutes/Clerk as legacy/optional
- `README.md` - Rewritten for OpenRouter-first setup
- `SETUP.md` - Rewritten for OpenRouter-first setup
- `LAUNCH_CHECKLIST.md` - Updated env var requirements
- `DEMO_SCRIPT.md` - Chutes references replaced with OpenRouter
- `IMPLEMENTATION_PROGRESS.md` - Updated to reflect current state

## 3. Which OpenRouter free model(s) were used

`openrouter/free` for all task types (caller, evaluator, ticket, report). This routes to whichever free model is currently available.

## 4. Whether the API key worked

**Passed.** `node scripts/test-openrouter.mjs` confirmed:
- API key is valid
- `openrouter/free` model responds correctly
- Response: `"ok"` (test prompt)

## 5. Whether caller simulation felt realistic

**Not tested end-to-end** (no Supabase credentials available locally). The caller prompt logic was preserved from the previous Chutes implementation - it uses the same scenario data, hidden facts, and character rules. The only change is the API call. The prompt is unchanged, so realistic behaviour depends on the free model's instruction-following. Some free models may be more eager to reveal facts or use jargon.

## 6. Whether hidden facts stayed hidden

**Not tested end-to-end.** The hidden facts are passed in the system prompt server-side and stripped from candidate-facing responses by `publicScenario()`. The code change does not affect this.

## 7. Whether evidence extraction returned valid JSON

**Not tested end-to-end.** The `extractAssessmentEvidence` function now calls `runAiTask('evaluator')` which uses `response_format: { type: 'json_object' }`. The `parseJsonResponse` helper handles markdown fences and invalid JSON. If the model returns invalid JSON, the function returns null and the session is marked as failed/pending.

## 8. Whether ticket scoring worked

**Already deterministic.** Ticket scoring uses `scoreTicket()` in `lib/assessment-scoring.ts` with regex patterns. No AI is involved. This was not changed.

## 9. Whether the manager report was actually useful

**Already working.** The report page (`app/(dashboard)/dashboard/admin/assessments/[id]/report/page.tsx`) shows readiness, per-call scores, checkpoints, ticket quality, transcript viewer, and manager override. No changes to reporting.

## 10. Whether bad candidate behaviour was penalised

**Already deterministic.** The scoring system (`calculateCheckpointScore`, `getFirstCallsReadiness`) penalises missed critical checkpoints and unsafe advice. No AI involvement in final scores. No changes needed.

## 11. Whether good candidate behaviour scored better

**Already deterministic.** Higher checkpoint pass rates produce higher scores. No changes needed.

## 12. What failed

- **End-to-end acceptance test**: Blocked. No Supabase credentials are configured in this environment. Cannot create assessments, start sessions, or verify the full candidate flow.
- **`npx tsc --noEmit`**: Pre-existing failures from stale `.next/types/` files. Not a regression.

## 13. What is flaky

- **Free model availability**: `openrouter/free` routes to whatever free model OpenRouter has available. If all free models are overloaded, the caller and evaluator will fail with 429 or timeout. The provider returns clear error messages for both cases.

## 14. What is still fake or demo-only

- No real candidate data exists locally.
- No Supabase database is connected.
- The caller and evaluator can only be tested by running the full stack with a real database.

## 15. What must be fixed before showing an MSP

1. **Configure Supabase** and run the schema migration.
2. **Run the full E2E flow** with a real OpenRouter key (supplied).
3. **Verify the free model** used for `openrouter/free` responds with usable caller dialogue (not too helpful, not too vague).
4. **Check evidence extraction** returns valid JSON with checkpoint booleans and evidence quotes.
5. **Verify no hidden facts leak** in network responses.
6. **Test bad/good candidate scenarios** to confirm scores differentiate meaningfully.

## 16. Exact test command results

### `npm test`
```
ℹ tests 40
ℹ pass 40
ℹ fail 0
```
**Passed.**

### `npx tsc --noEmit`
```
error TS6053: File '/home/codespace/CX-Train/.next/types/...' not found.
```
**Failed** (pre-existing, stale `.next/types/` from tsconfig include pattern. Not a regression.)

### `npm run build`
```
✓ ...build completed
```
**Passed.** Exits 0, creates `.next/BUILD_ID`.

### `git diff --check`
```
No output.
```
**Passed.** No whitespace errors.

### `npm run test:openrouter`
```
PASS: OpenRouter responded with: "ok"
PASS: API key is valid. Free models are reachable.
```
**Passed.**
