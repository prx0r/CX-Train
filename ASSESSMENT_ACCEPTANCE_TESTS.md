# Assessment workflow acceptance tests

Run against staging after the assessment migration. Record date, commit SHA, tester, environment URL, and evidence for every result.

## Preconditions

- Staging uses fictional data.
- Supabase and Chutes environment variables are configured.
- The migration verifier passes: `npm run migrate:assessment`.
- A manager account exists with `role = 'admin'`.

## A. Build and route smoke tests

| ID | Test | Expected |
|---|---|---|
| A1 | Run `npm test` | Exit 0. |
| A2 | Run `npx tsc --noEmit` | Exit 0. |
| A3 | Run `npm run build` | Exit 0 and `.next/BUILD_ID` exists. |
| A4 | Open `/dashboard/admin/assessments` anonymously | Redirect to sign-in. |
| A5 | Open a valid `/assessment/[token]` anonymously | Candidate instructions load without sign-in. |

## B. Manager creates an assessment

1. Sign in as the staging manager.
2. Create a hiring assessment for `Test Candidate`, three calls, candidate difficulty.
3. Verify the response and database.

Expected:

- candidate row uses the manager tenant ID;
- pack uses candidate ID, tenant ID, manager user ID, `hiring`, `candidate`, count 3, and `invited`;
- invite has a unique token and future expiry;
- generated URL opens successfully;
- creation takes under 60 seconds.

## C. Token and isolation failures

| ID | Test | Expected |
|---|---|---|
| C1 | Replace token with a random value | 404/not found; no scenario data. |
| C2 | Set invite expiry in the past and reopen | 410/expired. |
| C3 | Request another tenant's assessment ID as manager | 404; no data leakage. |
| C4 | Inspect candidate API responses | No hidden facts, checkpoints, ideal ticket, or common mistakes. |

Restore a valid unexpired invite before continuing.

## D. Candidate completes a call

1. Start Call 1.
2. Verify the scenario title/persona are visible but hidden facts are absent.
3. Ask at least three questions, including impact and scope.
4. End the call.

Expected:

- one session exists with tenant, pack, and scenario IDs;
- repeated start returns the unfinished session rather than creating another;
- caller stays in persona and reveals facts only after appropriate questions;
- transcript JSON/text is stored;
- checkpoint results contain booleans and evidence;
- score is calculated by the backend;
- the UI moves to ticket writing.

## E. Ticket writing

1. Attempt ticket submission against a fresh session before ending the call.
2. Submit a complete ticket after a completed call.

Expected:

- premature submission is rejected;
- ticket text is stored;
- score checks issue, user/client, device, impact, scope, troubleshooting, priority, next action, detail, and invention;
- readiness score equals 75% call score plus 25% ticket score;
- starting again selects a different unused scenario.

Repeat D/E until all three calls are complete. A fourth start must return `complete: true` and create no session.

## F. Completion and evidence report

Expected after the final ticket:

- pack status is `completed` and `completed_at` is set;
- recommendation follows hiring thresholds and critical-miss rules;
- manager detail shows 3/3 completed;
- report shows each scenario, readiness score, feedback, checkpoint evidence, ticket, and transcript;
- quoted evidence exists in or is directly supported by the transcript;
- the report states that AI supports manager judgement.

## G. Manager review

1. Save a review agreeing with AI.
2. On a separate assessment, attempt an override without a reason.
3. Add a reason and save the override.

Expected:

- agreement creates a manager review;
- override without reason is rejected;
- valid override stores AI score, manager score, agreement flag, reason, notes, and final readiness;
- pack status becomes `reviewed` and recommendation reflects the manager decision.

## H. Regression

- Existing `POST /api/session` still accepts its documented Custom GPT payload.
- Existing admin and trainee dashboard routes render.
- Production does not authenticate a forged `demo_admin=1` cookie.

## Result record

| Field | Value |
|---|---|
| Date | |
| Commit | |
| Tester | |
| Environment | |
| Passed | |
| Failed | |
| Blockers | |
| Evidence links | |
