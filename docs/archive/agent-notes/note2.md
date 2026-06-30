# First Calls Custom GPT handoff

Updated: 2026-06-24

## Direction

Use the infrastructure already in the repository. Do not build another datastore or another caller UI.

- Supabase remains the production persistence/auth/tenant layer.
- The Custom GPT is the caller and structured evidence extractor.
- The server owns deterministic scoring and recommendations.
- Chutes is not used by the Custom GPT workflow.
- Candidate identity is full name plus a private assessment code, never name alone.

## Completed in the current unpushed change set

- Added API-key-protected GPT Actions to:
  - validate an assessment code and read progress;
  - start the next fixed First Calls scenario;
  - submit transcript, ticket, checkpoint evidence, and feedback.
- Replaced the broad training-hub OpenAPI schema with the three-action First Calls contract.
- Replaced the broad GPT instructions with fixed First Calls assessor instructions.
- Kept hidden scenario facts out of Action responses; they live in the GPT instructions.
- Manager assessment creation now produces a 96-bit private assessment code.
- Added `GPT_SETUP.md` with exact Custom GPT configuration steps.
- Added a blind manager calibration flow:
  1. manager reads transcript and ticket;
  2. manager rates 1–10 and records an independent recommendation;
  3. AI evidence and score are revealed;
  4. manager rates/comments on the AI analysis.
- Added migration `20260624010000_manager_ai_feedback.sql` for calibration fields.
- Updated the migration runner to apply and verify both assessment migrations.
- Updated `IMPLEMENTATION_PROGRESS.md`.

## Validation completed

- `npm test` passed after the GPT Action and calibration changes.
- `npx tsc --noEmit` passed after the GPT Action and calibration changes.
- `git diff --check` passed before the final report/calibration edits.
- The focused OpenAPI contract presence check passed.
- Confirmed the dedicated `/api/gpt` path does not import or call Chutes.

## Validation intentionally stopped

The final `npm run build` was stopped because Next.js webpack workers were consuming too many local resources. Do not restart it on the current laptop unless resource usage is acceptable. The previous First Calls commit built successfully before this latest GPT Actions change set.

Recommended next validation location: Vercel preview build or another CI/remote machine.

## Required next steps

1. Run a remote/CI production build and confirm all three GPT routes appear:
   - `/api/gpt/first-calls/[token]`
   - `/api/gpt/first-calls/[token]/start`
   - `/api/gpt/first-calls/[token]/submit`
2. Apply both Supabase migrations using `npm run migrate:assessment`.
3. Configure deployment environment:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Update `servers[0].url` in `gpt-actions-openapi.yaml` to the deployed `/api` URL.
5. In the Custom GPT builder:
   - paste `gptinstructions.md` into Instructions;
   - import `gpt-actions-openapi.yaml` under Actions;
   - use API-key authentication;
   - header name: `x-api-key`;
   - value: `select api_key from bots where id = 'call_sim';`.
6. Test typed ChatGPT first. Voice + Actions support must be verified in the exact ChatGPT client before promising voice assessments.
7. Run one full path:
   - manager creates assessment;
   - candidate enters matching name and code in GPT;
   - completes all three calls and tickets;
   - manager performs blind review;
   - AI analysis is revealed;
   - manager submits AI calibration feedback.
8. Verify invalid code, wrong name, repeated submission, fourth-call prevention, and cross-tenant access failures.

## Learning from manager feedback

Do not automatically retrain on every manager comment. Store the paired record:

`transcript + ticket + AI evidence/score + manager rating/decision + manager critique`

Use it first as an evaluation dataset. Track agreement, score error, repeated false positives/negatives, and checkpoint-specific disagreement. Improve prompts and deterministic rubric definitions from reviewed patterns. Consider fine-tuning only after collecting a sufficiently large, cleaned, consistently labelled dataset with a separate held-out evaluation set.

## Files to read first

- `GPT_SETUP.md`
- `gpt-actions-openapi.yaml`
- `gptinstructions.md`
- `app/api/gpt/first-calls/[token]/route.ts`
- `app/api/gpt/first-calls/[token]/start/route.ts`
- `app/api/gpt/first-calls/[token]/submit/route.ts`
- `supabase/migrations/20260624010000_manager_ai_feedback.sql`
