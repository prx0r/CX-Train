# CallCallum SQLite MVP Flow Test

This is a local-only MVP mode for testing the product loop without Supabase.

It proves whether a manager can create an assessment link, a candidate can chat with an OpenRouter AI caller, the transcript and ticket are stored locally, and a manager can run analysis and give feedback.

## What This Uses

- Next.js native web app
- Local SQLite database via `better-sqlite3`
- OpenRouter free models via `AI_*` env vars
- No Supabase required for `/mvp`

## What This Does Not Include

- Production auth
- Supabase production workflow
- Voice/TTS/STT
- Custom GPT
- Chutes
- Billing
- LMS features
- Multi-tenant production logic
- Integrations

## Env Vars

Create `.env.local` with:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000

MVP_DB_PROVIDER=sqlite
MVP_SQLITE_PATH=./data/callcallum.db

AI_PROVIDER=openrouter
AI_BASE_URL=https://openrouter.ai/api/v1
AI_API_KEY=your-openrouter-key
AI_CALLER_MODEL=openrouter/free
AI_EVALUATOR_MODEL=openrouter/free
AI_TICKET_MODEL=openrouter/free
AI_REPORT_MODEL=openrouter/free
```

Do not expose `AI_API_KEY` to the browser. It is only used by server routes.

## Setup

```bash
npm install
npm run mvp:reset-db
npm run test:openrouter
npm run test:mvp-flow
npm run dev
```

Open:

```text
http://localhost:3000/mvp
```

## Manual Test

1. Run `npm run mvp:reset-db`.
2. Run `npm run dev`.
3. Open `http://localhost:3000/mvp`.
4. Create assessment for `Bad Candidate`.
5. Copy invite link.
6. Open invite link in incognito.
7. Candidate sends poor messages:
   - `What is the issue?`
   - `I'll get someone to call you back.`
   - Do not ask scope, impact, hostname, or deadline.
8. End call.
9. Submit poor ticket: `Outlook broken, needs fixing.`
10. Manager opens assessment detail.
11. Run analysis.
12. Confirm result is poor and specific.
13. Create assessment for `Good Candidate`.
14. Candidate asks:
   - who they are/company
   - what device/hostname
   - what exactly happens
   - when it started
   - whether only them or others
   - business impact/deadline
   - whether Outlook web works
   - next step
15. Submit a good ticket with user, company, hostname, issue, error, scope, impact, deadline, workaround, and next step.
16. Run analysis.
17. Confirm result is meaningfully better.
18. Add manager feedback or override.

## Routes

- Manager dashboard: `/mvp`
- Candidate link: `/mvp/assessment/<token>`
- Manager detail: `/mvp/assessments/<id>`

## API Routes

- `POST /api/mvp/assessments`
- `GET /api/mvp/assessments`
- `GET /api/mvp/assessment/[token]`
- `POST /api/mvp/assessment/[token]/message`
- `POST /api/mvp/assessment/[token]/end`
- `POST /api/mvp/assessment/[token]/ticket`
- `GET /api/mvp/assessments/[id]`
- `POST /api/mvp/assessments/[id]/analyse`
- `POST /api/mvp/assessments/[id]/feedback`

## Seed Data

The DB is seeded with one criteria version:

`MSP First-Line Call Readiness v1`

And one scenario:

`Outlook not sending before meeting`

Hidden facts stay server-side and are not returned by candidate APIs.

## Demo-Only Limitations

- SQLite is local and single-file.
- No authentication around `/mvp`.
- No production-grade access control.
- OpenRouter free routes can rate-limit or return inconsistent model formats.
- Analysis is useful for MVP validation, not final compliance-grade scoring.
