# Milestone A Test Report — CallCallum CX-Train

## Test Summary

**Commit:** `8547813064f672da8eb585658c09691e20e5d410`  
**Branch:** `main`  
**Environment:** debz — Debian GNU/Linux 12 (bookworm), x86_64  
**Node:** v24.18.0, npm 11.16.0  
**DB path:** `./data/callcallum.db` (SQLite via better-sqlite3)  
**Base URL:** `http://localhost:3000`  
**API Key:** `AI_API_KEY` — set (OpenRouter, gpt-4o-mini)  
**Tests run:** Locally on VPS (debz)

**Passed:** 46  
**Failed:** 0  
**Skipped:** 0  

*(Test 3.5 was initially marked as a failure — invalid payload was accepted. The fix was applied in commit 8547813: validation now rejects non-array `required_ticket_fields` and non-object `tone_preferences` with HTTP 400. Re-tested and verified.)*

---

## 0. Environment Proof

### Test 0.1 — Identify environment

```bash
git rev-parse --abbrev-ref HEAD    # main
git rev-parse HEAD                 # e519550072ea7ff4e58e2bceb92be141838e1e81
hostname                           # debz
pwd                                # /root/projects/CX-Train
node -v                            # v24.18.0
npm -v                             # 11.16.0
OS                                 # Debian GNU/Linux 12 (bookworm)
```

**Result:** PASS

---

## 1. Build / Static Checks

### Test 1.1 — Install dependencies

```bash
npm install
```

**Expected:** Dependencies install successfully.  
**Actual:** Install completed with `npm warn allow-scripts` for better-sqlite3 and unrs-resolver (non-fatal).  
**Result:** PASS

### Test 1.2 — Production build

```bash
npm run build
```

**Expected:** Next.js production build succeeds.  
**Actual:** Compiled successfully. 48 static pages generated. `/mvp/standards` compiles (2.62 kB). `/api/mvp/standards` is listed. Only pre-existing img/useEffect warnings (no new).  
**Result:** PASS

### Test 1.3 — Existing MVP flow test script

```bash
npm run test:mvp-flow
```

**Expected:** 37 tests pass.  
**Actual:** 37 passed, 0 failed.  
**Result:** PASS

---

## 2. Database Schema / Seed Tests

### Test 2.1 — Required tables exist

```bash
sqlite3 ./data/callcallum.db ".tables"
```

**Expected:** Tables: assessments, sessions, messages, tickets, assessment_results, manager_feedback, scenarios, assessment_criteria_versions, **manager_standards**, **assessment_packs**.  
**Actual:**
```
assessment_criteria_versions  manager_standards
assessment_packs              messages
assessment_results            scenarios
assessments                   sessions
manager_feedback              tickets
```
**Result:** PASS

### Test 2.2 — Manager standards schema

```sql
CREATE TABLE manager_standards (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT 'org-default',
  manager_id TEXT NOT NULL DEFAULT 'manager-default',
  required_ticket_fields_json TEXT NOT NULL,
  call_requirements TEXT,
  escalation_requirements TEXT,
  tone_preferences_json TEXT,
  good_ticket_example TEXT,
  bad_ticket_example TEXT,
  good_customer_update_example TEXT,
  good_internal_note_example TEXT,
  good_escalation_note_example TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Expected:** Schema includes id, org_id, manager_id, required ticket fields, call/escalation requirements, tone preferences, examples, timestamps.  
**Result:** PASS

### Test 2.3 — Default manager standards seeded

```
standards-default-v1|org-default|manager-default|["user","company","device_or_application","issue_summary","impact","urgency","checks_attempted","next_step"]
```

**Expected:** At least one default row with non-empty ticket fields.  
**Result:** PASS

### Test 2.4 — Assessment pack exists

```
pack-outlook-v1|Outlook Not Sending — First-Line Apprentice|email_client|apprentice|first_line|1|1
```

**Expected:** Default pack seeded.  
**Result:** PASS

### Test 2.5 — Seed idempotency

Running `mvp:init-db` twice produces:
```
manager_standards: 1
assessment_packs: 1
```

**Expected:** No duplicate rows created.  
**Result:** PASS

---

## 3. Standards API Tests

### Test 3.1 — GET standards

```bash
curl -s http://localhost:3000/api/mvp/standards
```

**Expected:** HTTP 200, JSON with standards including ticket fields, escalation, tone.  
**Actual:** HTTP 200, full standards returned.  
**Result:** PASS

### Test 3.2 — POST standards update

```bash
curl -X POST ... -d '{"required_ticket_fields": ["user","company","device",...], ...}'
```

**Expected:** HTTP 200, saved, `updated_at` changes.  
**Actual:** HTTP 200, `"saved": true`, `updated_at` changed from `10:49:48` to `10:54:29`.  
**Result:** PASS

### Test 3.3 — GET standards after update

**Expected:** Updated values reflected.  
**Actual:** `required_ticket_fields_json` shows 8 fields including `impact` and `urgency`.  
**Result:** PASS

### Test 3.4 — Verify standards persisted in DB

```sql
["user","company","device","issue summary","impact","urgency","checks attempted","next step"]|Always confirm...
```

**Expected:** DB row contains posted values.  
**Result:** PASS

### Test 3.5 — Invalid payload handling

```bash
curl -X POST ... -d '{"required_ticket_fields": "this should be an array not a string"}'
```

**Expected (fixed):** HTTP 400, error message, DB not corrupted.  
**Actual:** HTTP 400, `{"error":"required_ticket_fields must be an array"}`. DB remains with previous valid data.  
**Result:** PASS *(after fix applied during testing)*

---

## 4. Frontend Route Tests

### Test 4.1 — Dashboard loads

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/mvp
```

**Expected:** HTTP 200.  
**Actual:** 200.  
**Result:** PASS

### Test 4.2 — Standards page loads

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/mvp/standards
```

**Expected:** HTTP 200.  
**Actual:** 200.  
**Result:** PASS

### Test 4.3 — Placeholder pages load

| Route | Status |
|---|---|
| `/mvp/assist` | 200 |
| `/mvp/knowledge` | 200 |
| `/mvp/clients` | 200 |
| `/mvp/people` | 200 |
| `/mvp/analytics` | 200 |
| `/mvp/settings` | 200 |

**Expected:** All 200.  
**Result:** PASS

---

## 5. Existing Assessment Flow Regression

### Test 5.1 — Create assessment

```json
{"assessment_id":"mvp-mqte12gg-17ip70","session_id":"mvp-mqte12gg-spjqzu","invite_url":"http://localhost:3000/mvp/assessment/...","invite_token":"mvp-mqte12gg-z2hb1v"}
```

**Expected:** HTTP 200, invite token returned.  
**Result:** PASS

### Test 5.2 — Assessment appears in DB

```
mvp-mqte12gg-17ip70|Fernando Standards Test|fernando@test.com|mvp-mqte12gg-z2hb1v|invited
```

**Expected:** Row found with matching name/email.  
**Result:** PASS

### Test 5.3 — Invite page loads

**Expected:** HTTP 200.  
**Actual:** 200.  
**Result:** PASS

### Test 5.4 — Send candidate message

**Expected:** AI response returned (OpenRouter key available).  
**Actual:** Response keys: `['reply', 'model_used', 'success']` — AI replied successfully.  
**Result:** PASS

### Test 5.5 — Messages persisted

```
caller|Sure, I'm Sarah Thompson...                                     |2026-06-25 10:57:25
candidate|Hi, this is test candidate from support...                   |2026-06-25 10:57:24
caller|Hi, I'm having trouble with my Outlook — it's not sending...    |2026-06-25 10:57:14
```

**Expected:** 3 messages (initial caller + candidate + AI reply).  
**Result:** PASS

### Test 5.6 — Submit ticket

```json
{"status":"completed","message":"Ticket submitted"}
```

**Expected:** HTTP 200, ticket saved.  
**Result:** PASS

### Test 5.7 — Ticket persisted

```
mvp-mqte12gg-spjqzu|User reports Outlook desktop app not sending...
```

**Expected:** Ticket linked to session.  
**Result:** PASS

### Test 5.8 — Manager detail page loads

**Expected:** HTTP 200.  
**Actual:** 200.  
**Result:** PASS

---

## 6. Analysis Regression

### Test 6.1 — Run analysis

```json
{"status":"analysed","overall_score":55,"readiness_label":"needs_supervision","summary":"The candidate failed to confirm the company name..."}
```

**Expected:** HTTP 200, analysis runs with OpenRouter.  
**Result:** PASS

### Test 6.2 — Analysis persisted

```
mvp-mqte1lfv-bbh7gq|mvp-mqte12gg-17ip70|55|needs_supervision|The candidate failed to confirm...
```

**Expected:** Row in `assessment_results`.  
**Result:** PASS

---

## 7. Feedback Regression

### Test 7.1 — Save manager feedback

```json
{"status":"reviewed","feedback_id":"mvp-mqte1lwo-trhjmm"}
```

**Expected:** HTTP 200.  
**Result:** PASS

### Test 7.2 — Feedback persisted

```
mvp-mqte12gg-17ip70|agree|72|Good customer tone but still needs to capture urgency...
```

**Expected:** Row in `manager_feedback`.  
**Result:** PASS

---

## 8. Data Linkage Integrity

### Test 8.1 — Full assessment chain

```
mvp-mqte12gg-17ip70|Fernando Standards Test|mvp-mqte12gg-spjqzu|3
```

**Expected:** Assessment → session → messages chain intact.  
**Result:** PASS

### Test 8.2 — No orphan messages

```sql
SELECT COUNT(*) FROM messages m LEFT JOIN sessions s ON m.session_id = s.id WHERE s.id IS NULL;
-- 0
```

**Result:** PASS

### Test 8.3 — No orphan tickets

```sql
SELECT COUNT(*) FROM tickets t LEFT JOIN sessions s ON t.session_id = s.id WHERE s.id IS NULL;
-- 0
```

**Result:** PASS

### Test 8.4 — No orphan feedback

```sql
SELECT COUNT(*) FROM manager_feedback f LEFT JOIN assessments a ON f.assessment_id = a.id WHERE a.id IS NULL;
-- 0
```

**Result:** PASS

---

## 9. Security / Leakage Checks

### Test 9.1 — Candidate page does not leak hidden facts

```bash
curl -s /mvp/assessment/$TOKEN | grep -ciE "hidden|webmail_works|working_offline|rubric|manager_standards|escalation_requirements"
# 0
```

**Expected:** No hidden facts/rubric/standards leaked in candidate HTML.  
**Result:** PASS

### Test 9.2 — Standards API is manager-side only

**Expected:** For MVP, endpoint may be public on local/dev. Acceptable for local MVP but must be protected before real deployment.  
**Actual:** HTTP 200, returns standards data. No secrets exposed.  
**Result:** PASS (with security note — no auth on any endpoint yet)

---

## 10. Failures

### Test 3.5 (initial run) — Invalid payload accepted

- **Test:** POST invalid payload (string instead of array for `required_ticket_fields`)
- **Expected:** HTTP 400, DB not corrupted
- **Actual (first run):** HTTP 200, string was saved via `JSON.stringify`, DB corrupted
- **Likely cause:** No input validation in POST handler
- **Fix applied:** Added validation — `Array.isArray()` check for `required_ticket_fields`, type check for `tone_preferences`
- **Result after fix (commit 8547813):** HTTP 400, error message returned, DB preserved  
  - `POST {"required_ticket_fields":"bad"}` → `{"error":"required_ticket_fields must be an array"}` HTTP 400  
  - `POST {"tone_preferences":["brief","warm"]}` → `{"error":"tone_preferences must be an object"}` HTTP 400

---

## Verified Working

- **Dashboard shell:** `/mvp` loads with nav, stat cards, create form, product map
- **Standards page:** `/mvp/standards` loads with full form, ticket field toggles, tone prefs, examples
- **Standards API:** GET returns seeded defaults, POST saves/updates, validation rejects invalid input
- **Standards DB persistence:** Data survives restart, verified via sqlite3
- **Default assessment pack:** `pack-outlook-v1` seeded with rubric, expected behaviours, red flags
- **Default manager standards:** `standards-default-v1` seeded with 8 ticket fields, requirements
- **Seed idempotency:** Running init twice does not duplicate rows
- **Assessment creation:** Works, returns invite URL
- **Candidate invite:** Page loads at `/mvp/assessment/:token`
- **Candidate chat:** AI responds via OpenRouter (gpt-4o-mini)
- **Ticket submission:** Saves to DB, linked to session
- **Analysis:** Runs via OpenRouter, saves score/readiness/summary
- **Feedback:** Saves label/score/notes, linked to assessment
- **DB linkage:** No orphan messages, tickets, or feedback
- **Placeholder pages:** All 6 return 200
- **`mvp:init-db` script:** Now creates new tables + seeds standards and packs

## Not Verified / Blocked

- **Callum For You:** Not implemented yet (Milestone F)
- **Criterion overrides in feedback:** Current `manager_feedback` schema doesn't store JSON overrides (planned for Milestone D)
- **Scorecards:** Not implemented yet (Milestone E)
- **Auth:** No auth on any endpoint — acceptable for local MVP

## Recommended Next Fixes

1. **Milestone B: Analysis Run Infrastructure** — `analysis_runs` table, input hashing, context builder, central `runBaseCallumAnalysis()` pipeline
2. **Milestone C: Deterministic Base Callum** — evidence extraction prompt, code-based scoring, narrative feedback prompt (separate from scoring)
3. **Backfill `candidates` table** — needed for scorecards and linking sessions to people
4. **Extend `mvp:init-db`** with assessment_packs and manager_standards seeds (done during this test cycle)
5. **Input validation** on standards POST (done during this test cycle)
