# CallCallum launch checklist

Do not deploy for an MSP demo until all blocking items are checked.

## Environment

- [ ] `NEXT_PUBLIC_SUPABASE_URL` is set.
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set server-side only.
- [ ] `DATABASE_URL` is available only to migration/operations tooling.
- [ ] `CHUTES_API_KEY` is set server-side only.
- [ ] `CHUTES_API_URL` is set or the documented default is accepted.
- [ ] `CHUTES_MODEL` is set or the documented default is accepted.
- [ ] `ENABLE_DEMO` is absent/false in production.
- [ ] No secret is committed, exposed through `NEXT_PUBLIC_*`, or printed in logs.

## Database

- [ ] Back up the target database or confirm it is disposable staging data.
- [ ] Run `npm run migrate:assessment` with `DATABASE_URL` configured.
- [ ] Command reports 6 assessment tables, 8 required session columns, and at least 10 active scenarios.
- [ ] Confirm the manager user has `role = 'admin'`.
- [ ] Confirm the manager user receives a `tenant_id` after first assessment creation.
- [ ] Confirm assessment, candidate, invite, session, and review rows carry the expected tenant/pack IDs.
- [ ] Confirm RLS policies exist for assessment tables and assessment sessions.

## Build and deployment

- [x] `npm test` passes locally.
- [x] `npx tsc --noEmit` passes locally.
- [x] `npm run build` exits 0 and creates `.next/BUILD_ID` locally.
- [ ] Deployment uses Node 20 and installs from the committed lockfile.
- [ ] Deployment build exits successfully.
- [ ] `/`, `/sign-in`, and manager dashboard load over HTTPS.
- [ ] `/assessment/[token]` is public while manager routes require authentication.

## Authentication and tenant isolation

- [ ] Anonymous access to `/dashboard/admin/assessments` redirects to sign-in.
- [ ] Non-admin accounts cannot access manager APIs or pages.
- [ ] A manager cannot read another tenant's assessment by changing the URL ID.
- [ ] Invalid and expired invite tokens are rejected.
- [ ] Candidate responses never include `hidden_facts`, required checkpoints, ideal ticket, or common mistakes.
- [ ] Production ignores the unsigned `demo_admin` cookie.

## Candidate and AI flow

- [ ] Candidate can open the invite without creating an account.
- [ ] Candidate sees the secrets/confidential-data warning.
- [ ] Chutes returns a caller response and stays in character.
- [ ] Caller does not volunteer hidden facts before appropriate questions.
- [ ] Ending a call stores `transcript_json` and `transcript_text`.
- [ ] Evidence extraction returns checkpoint booleans and transcript evidence.
- [ ] Candidate cannot submit a ticket before the call transcript.
- [ ] Ticket text and ticket score are stored.
- [ ] Candidate cannot exceed the pack's scenario count.
- [ ] Final ticket changes the assessment status to `completed`.

## Manager report

- [ ] Report shows recommendation, overall score, call scores, checkpoint evidence, ticket quality, and transcripts.
- [ ] Evidence statements are supported by transcript text.
- [ ] Manager can agree with or override the AI result.
- [ ] Override requires a reason.
- [ ] Saving a decision creates a manager review and changes status to `reviewed`.

## Demo safety

- [ ] Use fictional candidate/client data.
- [ ] Run the exact steps in `DEMO_SCRIPT.md` once before presenting.
- [ ] Keep one completed staging assessment as a fallback if Chutes is unavailable live.
- [ ] State that AI supports—not replaces—manager judgement.
- [ ] State the v1 limitations listed in `DEMO_SCRIPT.md`.

## Release decision

- [ ] All blocking checks above pass.
- [ ] One real MSP manager has reviewed a report for usefulness and credibility.
- [ ] Known issues are recorded with an owner and mitigation.
