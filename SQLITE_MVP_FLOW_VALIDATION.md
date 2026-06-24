# SQLite MVP Flow Validation

## Commit tested

Working tree implementation after adding `/mvp` SQLite flow. Commit not created yet at time of validation.

## Env used

- `MVP_DB_PROVIDER=sqlite`
- `MVP_SQLITE_PATH=./data/callcallum.db`
- `AI_PROVIDER=openrouter`
- `AI_BASE_URL=https://openrouter.ai/api/v1`
- `AI_CALLER_MODEL=openrouter/free`
- `AI_EVALUATOR_MODEL=openrouter/free`
- `AI_TICKET_MODEL=openrouter/free`
- `AI_REPORT_MODEL=openrouter/free`

## What was implemented

- Local SQLite database setup using `better-sqlite3`.
- SQLite schema for assessments, sessions, messages, tickets, results, manager feedback, criteria versions, and one scenario table.
- Default criteria version: `MSP First-Line Call Readiness v1`.
- Default scenario: `Outlook not sending before meeting`.
- Manager dashboard at `/mvp`.
- Candidate chat page at `/mvp/assessment/[token]`.
- Manager detail page at `/mvp/assessments/[id]`.
- Candidate message API using OpenRouter caller model.
- Analysis API using OpenRouter evaluator model with strict JSON parsing.
- Manager feedback API.
- Scripts: `mvp:init-db`, `mvp:reset-db`, `test:mvp-flow`.

## Automated tests

| Command | Result | Notes |
|---|---|---|
| `npm run mvp:reset-db` | pass | Deleted and re-created SQLite DB; seeded criteria and scenario. |
| `npm run test:mvp-flow` | pass | 37 DB/service checks passed. Tests local DB flow without browser. |
| `npm run test:openrouter` | pass | OpenRouter free model responded with `ok`; API key not printed. |
| `npm test` | pass | Existing 40/40 tests still pass. |
| `npm run build` | pass | Build succeeds. Existing dynamic route warnings remain. |

## Manual flow tests

| Test | Result | Notes |
|---|---|---|
| Create assessment through `/api/mvp/assessments` | pass | Returned assessment ID, invite token, invite URL. |
| Candidate payload hidden facts check | pass | Candidate GET did not expose `ALDER-LT-023`. |
| Candidate sends message | pass | Candidate message and AI caller reply stored. |
| End call | pass | Session marked completed. |
| Submit ticket | pass | Ticket stored. |
| Run analysis | pass | Result stored in SQLite. |
| Store manager feedback | pass | Feedback stored and assessment marked reviewed. |
| Manager detail API | pass | Returned transcript, ticket, result, feedback. |

## Bad candidate vs good candidate

- Bad candidate score: 20
- Bad candidate summary: Candidate barely gathered information and submitted an unusable ticket.
- Good candidate score: 88
- Good candidate summary: Candidate confirmed identity/company, captured device info, clarified issue, asked critical questions, set next steps, and avoided unsafe advice.
- Did the analysis clearly distinguish them? yes

## What worked

- Local SQLite path does not require Supabase.
- Manager can create a private candidate link.
- Candidate can chat with OpenRouter caller.
- Transcript and ticket are stored in SQLite.
- Manager can view transcript and ticket.
- Evaluator analysis stores score, readiness label, summary, strengths, weaknesses, checkpoints, and ticket score.
- Manager feedback/override is stored.
- Bad-vs-good candidate comparison produced meaningfully different outcomes.

## What failed

- Nothing blocking in the tested local flow.
- `better-sqlite3` took around two minutes to compile in this Node 24 environment because no prebuilt binary was available.

## What is flaky

- `openrouter/free` can route to different free models.
- Free model responses can be short, odd, rate-limited, or occasionally invalid JSON.
- Caller responses are acceptable for MVP but not polished enough for a customer demo without more prompt tuning.

## What is fake/demo-only

- No manager authentication.
- No candidate access expiry.
- No production tenancy/security model.
- SQLite is local-only and not production storage.
- Analysis is AI-generated evidence, not final hiring automation.

## Biggest blocker

The biggest blocker is OpenRouter free model variability. The product loop works, but analysis/caller quality can vary depending on which free model is routed.

## Would I show this flow to an MSP for feedback?

Yes, but only as a guided local demo. It is good enough to validate whether managers care about the transcript, ticket, readiness evidence, and feedback loop. It is not production-ready.
