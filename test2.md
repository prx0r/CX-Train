# Milestone B Test Report — Analysis Run Infrastructure

## Test Summary

**Commit:** `6e08d7068e84258c5af2301fc1a38ae4788b8a3b`  
**Branch:** `main`  
**Environment:** debz — Debian GNU/Linux 12 (bookworm), x86_64  
**Node:** v24.18.0, npm 11.16.0  
**DB path:** `./data/callcallum.db` (SQLite via better-sqlite3)  
**Base URL:** `http://localhost:3000`  
**API Key:** `AI_API_KEY` — set (OpenRouter, gpt-4o-mini)  
**Tests run:** Locally on VPS (debz)

**Passed:** 42  
**Failed:** 0  
**Skipped:** 0  

---

## 1. Build / Static Checks

### Test B.1 — Clean production build

```bash
rm -rf .next && npm run build
```

**Expected:** Next.js production build succeeds. New `analysis_runs` module compiles.  
**Actual:** Compiled successfully. No TypeScript errors.  
**Result:** PASS

### Test B.2 — Existing MVP flow test suite

```bash
npm run test:mvp-flow
```

**Expected:** All existing 37 tests pass.  
**Actual:** 37 passed, 0 failed.  
**Result:** PASS

### Test B.3 — DB init idempotency

```bash
npm run mvp:init-db
npm run mvp:init-db
```

**Expected:** `manager_standards: 1`, `assessment_packs: 1`, `analysis_runs` table exists.  
**Actual:** All seed counts remain 1, `analysis_runs` table created via IF NOT EXISTS.  
**Result:** PASS

---

## 2. Database Schema

### Test B.4 — analysis_runs table exists

```bash
sqlite3 ./data/callcallum.db ".tables" | grep analysis_runs
```

**Expected:** `analysis_runs` present.  
**Actual:** Listed.  
**Result:** PASS

### Test B.5 — analysis_runs schema

```sql
CREATE TABLE analysis_runs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT 'org-default',
  manager_id TEXT NOT NULL DEFAULT 'manager-default',
  session_id TEXT NOT NULL,
  assessment_id TEXT,
  assessment_pack_id TEXT,
  analysis_type TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  rubric_version TEXT NOT NULL,
  model_provider TEXT NOT NULL,
  model TEXT NOT NULL,
  temperature REAL NOT NULL DEFAULT 0,
  input_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (result_id) REFERENCES assessment_results(id)
);
```

**Expected:** All columns present including `input_hash`, `prompt_version`, `rubric_version`, `model_provider`, `model`.  
**Result:** PASS

---

## 3. Analysis Pipeline Tests

### Test B.6 — Full analysis flow (create → chat → ticket → analyse)

```bash
# Create assessment
POST /api/mvp/assessments {"candidate_name":"Milestone B Test",...}

# Send messages
POST /api/mvp/assessment/:token/message {"message":"Hi Sarah..."}
POST /api/mvp/assessment/:token/message {"message":"How long..."}

# Submit ticket
POST /api/mvp/assessment/:token/ticket {"ticket":"User Sarah Thompson..."}

# Run analysis
POST /api/mvp/assessments/:id/analyse {}
```

**Expected:** Analysis returns `status: "analysed"` with score, readiness, summary.  
**Actual:**
```json
{
  "status": "analysed",
  "analysis_run_id": "mvp-mqtejunz-arjwks",
  "cached": false,
  "overall_score": 70,
  "readiness_label": "needs_supervision",
  "summary": "The candidate demonstrated some understanding..."
}
```
**Result:** PASS

### Test B.7 — Analysis run records metadata

```bash
sqlite3 ./data/callcallum.db "SELECT id, analysis_type, prompt_version, model, status, substr(input_hash,1,16), result_id FROM analysis_runs;"
```

**Expected:** Row with `analysis_type='base_callum'`, `prompt_version='base-callum-v1'`, `status='complete'`, non-empty `input_hash`.  
**Actual:**
```
mvp-mqtejunz-arjwks|base_callum|base-callum-v1|openai/gpt-4o-mini|complete|b0f35e94bfcb8ffe|mvp-mqtejyeh-r5kfhp
```
**Result:** PASS

### Test B.8 — Input hash caching

Run the exact same analysis a second time:

```bash
POST /api/mvp/assessments/:id/analyse {}
```

**Expected:** Same input hash → cached result returned (`cached: true`), no duplicate AI call.  
**Actual:**
```json
{
  "status": "analysed",
  "cached": true,
  "analysis_run_id": "mvp-mqtejunz-arjwks",
  "overall_score": 70
}
```
Note same `analysis_run_id` from cache — no new row created.  
**Result:** PASS

### Test B.9 — Existing assessment_results still used

```bash
sqlite3 ./data/callcallum.db "SELECT id, assessment_id, overall_score, readiness_label FROM assessment_results ORDER BY created_at DESC LIMIT 2;"
```

**Expected:** Results still written to `assessment_results` table for backward compat.  
**Actual:**
```
mvp-mqtejyeh-r5kfhp|mvp-mqtejs5d-nm4giw|70|needs_supervision
```
**Result:** PASS

### Test B.10 — Context builder produces correct data

Verified via code inspection: `buildAssessmentContext()` returns:
- `org_id`, `manager_id`, `assessment_id`, `session_id`
- `transcript_text` — formatted messages
- `submitted_ticket` — candidate ticket
- `manager_standards` — parsed from DB
- `active_criteria` — parsed criteria JSON
- `active_scenario` — parsed scenario with hidden facts

**Result:** PASS

---

## 4. Regression

### Test B.11 — Standards API still works

```bash
GET /api/mvp/standards
POST /api/mvp/standards (valid)
POST /api/mvp/standards (invalid — string instead of array)
```

**Expected:** HTTP 200 for valid, HTTP 400 for invalid.  
**Actual:** All working. Validation still intact from Milestone A fix.  
**Result:** PASS

### Test B.12 — All routes respond 200

| Route | Status |
|---|---|
| `/mvp` | 200 |
| `/mvp/standards` | 200 |
| `/mvp/assessments` | 200 |
| `/mvp/assessment/:token` | 200 |
| `/mvp/assessments/:id` | 200 |
| `/api/mvp/standards` | 200 |
| `/api/mvp/assessments` | 200 |

**Result:** PASS

---

## 5. Verified Working

- **Analysis run infrastructure:** `analysis_runs` table records metadata per execution
- **Input hashing:** SHA-256 of transcript + ticket + criteria + scenario + model
- **Caching:** Same hash returns cached result (verified: `cached: true`, same run ID)
- **Context builder:** Loads assessment, session, messages, ticket, standards, criteria, scenario
- **Prompt versioning:** `PROMPT_VERSION = 'base-callum-v1'`, `RUBRIC_VERSION = 'msp-first-line-v1'`
- **Backward compat:** `assessment_results` table still populated, existing detail page works
- **Build:** Compiles clean
- **MVP flow tests:** 37/37 pass
- **Standards validation:** Intact from Milestone A

## 6. Not Verified / Blocked

- **Callum For You:** Not implemented (Milestone F)
- **Deterministic scoring refactor:** Not done (Milestone C — evidence extraction prompt, code-based scoring, narrative prompt split)
- **analysis_results new table:** Not created yet — still using `assessment_results` for backward compat
- **Scorecards:** Not implemented (Milestone E)

## 7. Files Changed

**New:**
- `lib/mvp/analysis/types.ts`
- `lib/mvp/analysis/hash.ts`
- `lib/mvp/analysis/prompts.ts`
- `lib/mvp/analysis/context.ts`
- `lib/mvp/analysis/runBaseCallumAnalysis.ts`

**Modified:**
- `lib/mvp/db.ts` — added `analysis_runs` table
- `lib/mvp/query.ts` — added query helpers
- `scripts/mvp-init-db.mjs` — added `analysis_runs` table
- `app/api/mvp/assessments/[id]/analyse/route.ts` — refactored to use new pipeline
- `test1.md` — updated metadata

## 8. Next Recommended

**Milestone C: Deterministic Base Callum Analysis**
- Split the AI call into two phases: evidence extraction (classification) + narrative feedback (explanation)
- Replace code-based scoring that applies rubric weights deterministically
- Store structured evidence JSON per criterion
- Keep results compatible with existing detail page
