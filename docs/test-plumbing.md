# Plumbing Spine v0 Test Report

**Date:** 2026-06-25
**Commit:** `a569246` (Plumbing Spine v0)
**Branch:** `main`
**Environment:** debz — Debian GNU/Linux 12 (bookworm), x86_64
**Node:** v24.18.0, npm 11.16.0
**DB path:** `./data/callcallum.db` (SQLite via better-sqlite3)
**Base URL:** `http://localhost:3000`

---

## P.1 — Environment

```bash
$ git rev-parse --abbrev-ref HEAD
main
$ git rev-parse HEAD
a5692466a522b3f9b9091a4c57dd1243a87bb5b6
$ hostname
debz
$ pwd
/root/projects/CX-Train
$ node -v
v24.18.0
$ npm -v
11.16.0
```

**Result:** PASS

---

## P.2 — Build

```bash
$ rm -rf .next && npm run build
```

**Expected:** Next.js production build succeeds. New plumbing routes compile.

**Actual:**
```
✓ Compiled successfully
✓ Generating static pages (51/51)
```

51 static pages generated. New `/api/mvp/debug/status`, `/api/mvp/debug/assessment/[id]`, `/mvp/system` all listed.

Pre-existing warnings for legacy `/api/levels/check` and `/api/taxonomy/search` (dynamic server usage during static generation) — not a regression.

**Result:** PASS

---

## P.3 — Existing MVP Flow

```bash
$ npm run test:mvp-flow
```

**Expected:** 37 tests pass.

**Actual:**
```
=== Results: 37 passed, 0 failed ===
```

**Result:** PASS

---

## P.4 — DB Init Idempotency

```bash
$ npm run mvp:init-db
$ npm run mvp:init-db
$ sqlite3 ./data/callcallum.db ".tables"
```

**Expected:** No duplicate rows, tables exist, command does not fail.

**Actual:**
```
[mvp:init-db] Manager standards already exist, skipping
[mvp:init-db] Assessment pack already exists, skipping
[mvp:init-db] Manager profile already exists, skipping
[mvp:init-db] Password reset scenario already exists, skipping
[mvp:init-db] Printer scenario already exists, skipping
```

Tables: `analysis_runs`, `assessment_criteria_versions`, `assessment_packs`, `assessment_results`, `assessments`, `manager_feedback`, `manager_standards`, `messages`, `scenarios`, `sessions`, `tickets`, `manager_profiles`, `manager_criterion_feedback`

```bash
$ sqlite3 ./data/callcallum.db "SELECT COUNT(*) FROM manager_standards;"
1
$ sqlite3 ./data/callcallum.db "SELECT COUNT(*) FROM assessment_packs;"
3
$ sqlite3 ./data/callcallum.db "SELECT COUNT(*) FROM analysis_runs;"
1
```

**Result:** PASS

---

## P.5 — System Status API

```bash
$ curl -s http://localhost:3000/api/mvp/debug/status | jq .
```

**Expected:** `ok: true`, modules listed, routes listed, DB counts, seed status, `hasOpenRouterKey` boolean, no API key leaked.

**Actual:**
```json
{
  "ok": true,
  "data": {
    "modules": [
      { "id": "assess", "status": "active" },
      { "id": "standards", "status": "active" },
      { "id": "analysis", "status": "active" },
      { "id": "feedback", "status": "active" },
      { "id": "assist", "status": "planned" },
      { "id": "knowledge", "status": "planned" },
      { "id": "clients", "status": "planned" },
      { "id": "people", "status": "planned" },
      { "id": "analytics", "status": "planned" },
      { "id": "settings", "status": "not_built" }
    ],
    "routes": [
      { "module": "assess", "method": "POST", "path": "/api/mvp/assessments" },
      { "module": "assess", "method": "GET", "path": "/api/mvp/assessments" },
      { "module": "assess", "method": "GET", "path": "/api/mvp/assessment/[token]" },
      { "module": "assess", "method": "POST", "path": "/api/mvp/assessment/[token]/message" },
      { "module": "assess", "method": "POST", "path": "/api/mvp/assessment/[token]/ticket" },
      { "module": "assess", "method": "GET", "path": "/api/mvp/assessments/[id]" },
      { "module": "analysis", "method": "POST", "path": "/api/mvp/assessments/[id]/analyse" },
      { "module": "feedback", "method": "POST", "path": "/api/mvp/assessments/[id]/feedback" },
      { "module": "standards", "method": "GET", "path": "/api/mvp/standards" },
      { "module": "standards", "method": "POST", "path": "/api/mvp/standards" },
      { "module": "system", "method": "GET", "path": "/api/mvp/debug/status" },
      { "module": "system", "method": "GET", "path": "/api/mvp/debug/assessment/[id]" },
      { "module": "assist", "method": "GET", "path": "/api/mvp/assist", "status": "planned" },
      { "module": "assist", "method": "POST", "path": "/api/mvp/assist", "status": "planned" },
      { "module": "knowledge", "method": "GET", "path": "/api/mvp/knowledge", "status": "planned" },
      { "module": "clients", "method": "GET", "path": "/api/mvp/clients", "status": "planned" },
      { "module": "people", "method": "GET", "path": "/api/mvp/people", "status": "planned" }
    ],
    "database": {
      "path": "./data/callcallum.db",
      "tables": ["analysis_runs","assessment_criteria_versions","assessment_packs","assessment_results","assessments","manager_feedback","manager_standards","messages","scenarios","sessions","tickets"],
      "counts": {
        "assessments": 2,
        "sessions": 2,
        "messages": 7,
        "tickets": 1,
        "assessment_results": 1,
        "manager_feedback": 0,
        "manager_standards": 1,
        "assessment_packs": 3,
        "analysis_runs": 1,
        "scenarios": 3
      }
    },
    "seeds": {
      "managerStandards": true,
      "assessmentPacks": true,
      "criteria": true,
      "scenario": true
    },
    "environment": {
      "nodeEnv": "development",
      "hasOpenRouterKey": false,
      "openRouterModel": "openai/gpt-4o-mini",
      "defaultOrgId": "org-default",
      "defaultManagerId": "manager-default"
    },
    "warnings": []
  }
}
```

**Secrets check:**
```bash
$ curl -s /api/mvp/debug/status | grep -iE "sk-or|api_key|secret|password"
# No matches (excluding hasOpenRouterKey field name)
```
No secrets leaked. `hasOpenRouterKey` returns boolean only.

**Result:** PASS

---

## P.6 — System Page

```bash
$ curl -i http://localhost:3000/mvp/system
```

**Expected:** HTTP 200, page contains "System", module statuses, route inventory.

**Actual:**
- HTTP 200
- HTML contains "System" heading
- HTML contains "Assess", "Standards", "Analysis", "Feedback" module labels
- HTML contains active/planned status indicators
- Route table rendered with method/path/status columns
- Database section with table counts
- Seed status indicators
- Environment section

**Result:** PASS

---

## P.7 — Create Assessment

```bash
$ curl -X POST http://localhost:3000/api/mvp/assessments \
  -H "Content-Type: application/json" \
  -d '{"candidate_name":"Plumbing Test","candidate_email":"test@test.com"}'
```

**Expected:** HTTP 200, assessment ID returned, token/invite URL returned.

**Actual:**
```json
{
  "assessment_id": "mvp-mqtgldws-vuxp2t",
  "session_id": "mvp-mqtgldws-fcp26l",
  "invite_url": "http://localhost:3000/mvp/assessment/mvp-mqtgldws-hcjh57",
  "invite_token": "mvp-mqtgldws-hcjh57"
}
```

**Result:** PASS

---

## P.8 — Assessment Debug Before Chat

```bash
$ curl -s http://localhost:3000/api/mvp/debug/assessment/$ASSESSMENT_ID | jq .
```

**Expected:** `ok: true`, assessment exists, session exists, message count may be 1 (initial AI message), ticket missing as warning, no crash.

**Actual:**
```json
{
  "ok": true,
  "data": {
    "assessment": {
      "id": "mvp-mqtgldws-vuxp2t",
      "title": "Call Readiness: Plumbing Test",
      "candidate_name": "Plumbing Test",
      "status": "invited"
    },
    "session": {
      "status": "in_progress"
    },
    "messageCount": 1,
    "messages": [
      { "role": "caller", "content": "Hi, I'm having trouble with my Outlook..." }
    ],
    "ticket": null,
    "integrity": {
      "hasAssessment": true,
      "hasSession": true,
      "hasMessages": true,
      "hasTicket": false,
      "hasAnalysis": false,
      "hasFeedback": false,
      "orphanRisks": [
        "Session exists but no ticket submitted",
        "No analysis result"
      ]
    },
    "warnings": ["No ticket submitted for this session"]
  }
}
```

No hidden facts leaked. Warning for missing ticket is clear.

**Result:** PASS

---

## P.9 — Candidate Chat + Debug State

```bash
$ curl -X POST /api/mvp/assessment/$TOKEN/message \
  -d '{"message":"Hi, can I confirm your name and what company you are with?"}'
```

**Actual:** `reply_ok: True, reply_len: 70`

```bash
$ curl -s /api/mvp/debug/assessment/$ASSESSMENT_ID | jq .data.messageCount
3
```

Messages increased from 1 to 3 (candidate + AI reply added). Messages linked to session.

**Result:** PASS

---

## P.10 — Ticket Submit + Debug State

```bash
$ curl -X POST /api/mvp/assessment/$TOKEN/ticket \
  -d '{"ticket":"User Sarah Thompson at Alder & Co Accountants..."}'
```

**Actual:** `Status: completed`

```bash
$ curl -s /api/mvp/debug/assessment/$ASSESSMENT_ID | jq .data.integrity.hasTicket
true
```

**Result:** PASS

---

## P.11 — Analyse + Debug State

```bash
$ curl -X POST /api/mvp/assessments/$ASSESSMENT_ID/analyse -d '{}'
```

**Actual (analysis succeeded — deterministic pipeline):**
```
Status: analysed
ResultID: mvp-mqtglypq-80lq9r
RunID: mvp-mqtglgz7-ac6ztx
```

```bash
$ curl -s /api/mvp/debug/assessment/$ASSESSMENT_ID | jq '.data.integrity'
{
  "hasAnalysis": true,
  "analysisStatus": "complete",
  "analysisRuns": 1
}
$ sqlite3 ./data/callcallum.db "SELECT ar.id, ar.status, ar.result_id, ar2.id as result_exists FROM analysis_runs ar LEFT JOIN assessment_results ar2 ON ar.result_id = ar2.id;"
mvp-mqtglgz7-ac6ztx|complete|mvp-mqtglypq-80lq9r|mvp-mqtglypq-80lq9r
```

Analysis run linked to existing assessment result. Score: 76, readiness: `needs_supervision`.

**Result:** PASS

---

## P.12 — Cache Visibility

```bash
$ curl -X POST /api/mvp/assessments/$ASSESSMENT_ID/analyse -d '{}'
```

Analysis with same hash returned cached result (status `analysed`, same result_id).

```bash
$ sqlite3 ./data/callcallum.db "SELECT id, status, substr(input_hash,1,16), created_at FROM analysis_runs WHERE assessment_id='$ASSESSMENT_ID' ORDER BY created_at DESC;"
```

Single analysis run record with `complete` status. No duplicate runs for same hash.

**Result:** PASS

---

## P.13 — Failure Visibility: Missing Ticket

Created a fresh assessment with a message but no ticket:

```bash
$ curl -X POST /api/mvp/assessments/$NEW_ASSESSMENT_ID/analyse -d '{}'
```

**Actual:**
```json
{
  "status": "analysis_failed",
  "error_code": "TICKET_NOT_FOUND",
  "error": "Cannot analyse assessment because no ticket has been submitted."
}
```

```bash
$ curl -s /api/mvp/debug/assessment/$NEW_ASSESSMENT_ID | jq '.data.integrity'
{
  "hasTicket": false,
  "hasAnalysis": false,
  "orphanRisks": [
    "Session exists but no ticket submitted",
    "No analysis result"
  ]
}
```

Clear error message. Debug API shows missing ticket as the failure point. No corrupt result saved.

**Result:** PASS

---

## P.14 — Route Inventory Completeness

From `/api/mvp/debug/status` routes list and `lib/mvp/api/registry.ts`:

**Active routes (12):**
| Method | Path |
|--------|------|
| POST | /api/mvp/assessments |
| GET | /api/mvp/assessments |
| GET | /api/mvp/assessment/[token] |
| POST | /api/mvp/assessment/[token]/message |
| POST | /api/mvp/assessment/[token]/ticket |
| GET | /api/mvp/assessments/[id] |
| POST | /api/mvp/assessments/[id]/analyse |
| POST | /api/mvp/assessments/[id]/feedback |
| GET | /api/mvp/standards |
| POST | /api/mvp/standards |
| GET | /api/mvp/debug/status |
| GET | /api/mvp/debug/assessment/[id] |

**Planned routes (5):**
| Method | Path |
|--------|------|
| GET | /api/mvp/assist |
| POST | /api/mvp/assist |
| GET | /api/mvp/knowledge |
| GET | /api/mvp/clients |
| GET | /api/mvp/people |

All expected routes present. Registry matches actual deployed routes.

**Result:** PASS

---

## P.15 — No Secret Leakage

```bash
$ curl -s /api/mvp/debug/status | grep -iE "sk-or|api_key|secret|password"
```

No matches. The `hasOpenRouterKey` field is a boolean. No actual key values, secrets, or passwords exposed.

**Result:** PASS

---

## Summary

| Test | Result |
|------|--------|
| P.1 — Environment | PASS |
| P.2 — Build | PASS |
| P.3 — Existing MVP Flow | PASS |
| P.4 — DB Init Idempotency | PASS |
| P.5 — System Status API | PASS |
| P.6 — System Page | PASS |
| P.7 — Create Assessment | PASS |
| P.8 — Debug Before Chat | PASS |
| P.9 — Candidate Chat + Debug | PASS |
| P.10 — Ticket + Debug | PASS |
| P.11 — Analyse + Debug | PASS |
| P.12 — Cache Visibility | PASS |
| P.13 — Missing Ticket Failure | PASS |
| P.14 — Route Inventory | PASS |
| P.15 — No Secret Leakage | PASS |

**Passed:** 15/15
**Failed:** 0
**Skipped:** 0

**Commit:** `a569246`
**Branch:** `main`
**Environment:** debz (Debian 12, x86_64)
**DB path:** `./data/callcallum.db`
**Base URL:** `http://localhost:3000`

## Verified

- API registry: `lib/mvp/api/registry.ts` — 17 routes documented (12 active, 5 planned)
- Response helpers: `lib/mvp/api/responses.ts` — `ok()`/`fail()` with standard `{ ok, data, error }` shape
- Error codes: `lib/mvp/api/errors.ts` — 16 codes with messages and HTTP status mapping
- Context loader: `lib/mvp/context/buildMvpContext.ts` — loads assessment, session, messages, ticket, standards, analysis runs, results, feedback with integrity warnings
- System page: `/mvp/system` — HTTP 200, shows module statuses, route inventory, DB status, seeds, environment
- System status API: `/api/mvp/debug/status` — full structured status, no secrets leaked
- Assessment debug API: `/api/mvp/debug/assessment/[id]` — full backend state with integrity checks
- DB diagnostics: `lib/mvp/diagnostics/dbDiagnostics.ts` — table counts, seed status, integrity warnings, latest activity
- Module registry: `lib/mvp/modules.ts` — 10 modules with status tracking
- Analysis failure visibility: `error_code`/`error_message` stored on `analysis_runs`; missing ticket → controlled `TICKET_NOT_FOUND` error
- Existing MVP flow: 37/37 pass (no regression)
- Build: compiles clean, 51 static pages

## Current Infra Answer

**Do we have the plumbing spine needed for the CallCallum vision?**

**Partially — core plumbing is in place, but gaps remain:**

### What is solid
- System status API + page give full observability
- Assessment debug API pinpoints exactly where an assessment is in the flow
- Error codes + response helpers provide consistent API shape
- Context loader centralizes data access for future modules
- Module/route registries document what exists and what is planned
- Analysis_runs records error_code/error_message on failure
- Build and all tests pass

### What remains fragile
- **No auth** — manager pages at `/mvp` are fully public
- **No invite lifecycle** — tokens never expire, no revoke, no status tracking beyond what assessments table provides
- **Deterministic engine not proven in production** — the pipeline ran once and scored 76, but needs more validation
- **No manager profile selection UI** — profiles table exists but `/mvp` always uses default
- **Legacy code still in the repo** — 38 legacy API routes, 21 legacy dashboard pages, Supabase migrations all present
- **Server reliability** — `next dev` often gets killed by shell process management; needs `setsid` to survive

### What should be built next
1. Invite lifecycle (expiry, revoke, status)
2. Manager profile selection/creation UI
3. Criterion-level manager feedback overrides
4. Deterministic engine edge case validation (empty transcript, partial data, bad ticket)
5. Local auth gate (simple password or env-var gating)
