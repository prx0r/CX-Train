# CallCallum — Agent Handbook & Source of Truth

## 1. Product Vision

**CallCallum** is a minimal MSP first-line call-readiness assessment tool.

A manager creates an assessment, sends a candidate invite link, the candidate completes a simulated support call, writes a ticket, the system converts the transcript and ticket into deterministic evidence checks, produces a readiness report, and the manager reviews/corrects the result.

### Core Value Proposition

> Manager-calibrated, evidence-backed, deterministic first-call readiness assessment.

The value is not "AI roleplay." The value is reproducible, auditable, manager-calibrated assessment.

### Key Design Decisions

- **AI extracts evidence only.** Backend code computes the authoritative score deterministically. AI never decides the final score.
- **Standards are versioned and snapshotted.** Changing standards never alters past scores.
- **Analysis runs are hashed.** Same input → same cached result. Reproducibility is hard requirement.
- **Three scenario packs** seeded: Outlook Not Sending, Password Reset, Printer Not Printing.
- **Manager profiles** are local (SQLite). No Supabase required for MVP.

---

## 2. Repository Map

```
Active spine directory:  /mvp + SQLite + local manager profiles
Total files:             ~190 .ts/.tsx files
Active MVP files:        ~43 files (12 routes + 13 pages + 18 lib)
Legacy frozen files:     ~120+ files (38 legacy routes, 21 dashboard pages, Supabase, voice, evaluation, taxonomy)
Documentation:           ~25 .md files at root, 3 in docs/
```

### Active MVP (build on this)

```
app/api/mvp/                          # 12 API route files
app/mvp/                              # 13 page files
lib/mvp/                              # 18 library files
lib/ai/                               # 6 files (provider + mock)
```

### Frozen Legacy (do not build on this)

```
app/api/assessments/                  # legacy Supabase assessment routes
app/api/assessment/                   # legacy candidate flow
app/api/gpt/                          # GPT Actions integration
app/api/voice/                        # voice session routes
app/api/levels/                       # level progression
app/api/session/                      # legacy session submission
app/api/progress/                     # trainee progress
app/api/labels/                       # label search
app/api/prompt/                       # bot prompt retrieval
app/api/upload/                       # file upload
app/api/admin/                        # taxonomy/bot CRUD
app/api/webhooks/                     # Clerk webhook
app/api/ai/                           # Chutes AI analyze/monitor
app/api/taxonomy/                     # taxonomy search/propose
app/(auth)/                           # Clerk sign-in/sign-up
app/(dashboard)/                      # admin/trainee dashboards
app/assessment/                       # legacy candidate assessment
app/voice/                            # voice assessment UI
app/demo/                             # demo login bypass
lib/supabase/                         # Supabase client/proxy
lib/voice/                            # STT/TTS/chat providers
lib/evaluation/                       # evaluation layer
lib/ai/chutes.ts                      # Chutes AI integration
lib/ai/feedback-analyzer.ts           # feedback analysis
lib/ai/monitor.ts                     # AI monitoring
components/admin/                     # admin dashboard components
components/trainee/                   # trainee components
components/assessments/               # legacy assessment components
components/shared/                    # shared UI components
supabase/                             # migrations, schema, seeds
taxonomy/                             # taxonomy JSON files
```

---

## 3. API Route Inventory

### Active MVP Routes

| Method | Path | Module | File |
|--------|------|--------|------|
| POST | `/api/mvp/assessments` | assess | `app/api/mvp/assessments/route.ts` |
| GET | `/api/mvp/assessments` | assess | `app/api/mvp/assessments/route.ts` |
| GET | `/api/mvp/assessment/[token]` | assess | `app/api/mvp/assessment/[token]/route.ts` |
| POST | `/api/mvp/assessment/[token]/message` | assess | `app/api/mvp/assessment/[token]/message/route.ts` |
| POST | `/api/mvp/assessment/[token]/ticket` | assess | `app/api/mvp/assessment/[token]/ticket/route.ts` |
| POST | `/api/mvp/assessment/[token]/end` | assess | `app/api/mvp/assessment/[token]/end/route.ts` |
| GET | `/api/mvp/assessments/[id]` | assess | `app/api/mvp/assessments/[id]/route.ts` |
| POST | `/api/mvp/assessments/[id]/analyse` | analysis | `app/api/mvp/assessments/[id]/analyse/route.ts` |
| POST | `/api/mvp/assessments/[id]/feedback` | feedback | `app/api/mvp/assessments/[id]/feedback/route.ts` |
| GET | `/api/mvp/standards` | standards | `app/api/mvp/standards/route.ts` |
| POST | `/api/mvp/standards` | standards | `app/api/mvp/standards/route.ts` |
| GET | `/api/mvp/debug/status` | system | `app/api/mvp/debug/status/route.ts` |
| GET | `/api/mvp/debug/assessment/[id]` | system | `app/api/mvp/debug/assessment/[id]/route.ts` |
| GET | `/api/mvp/manager-profiles` | profiles | `app/api/mvp/manager-profiles/route.ts` |

### Planned Routes (not yet built)

| Method | Path | Module |
|--------|------|--------|
| GET | `/api/mvp/assist` | assist |
| POST | `/api/mvp/assist` | assist |
| GET | `/api/mvp/knowledge` | knowledge |
| GET | `/api/mvp/clients` | clients |
| GET | `/api/mvp/people` | people |

### Legacy Routes (frozen — do not modify)

Full list: 38 route files under `app/api/` excluding `/mvp/`. Notable:
- `/api/assessment/[token]/*` — legacy Supabase candidate flow
- `/api/gpt/first-calls/[token]/*` — GPT Actions integration
- `/api/voice/session/*` — voice session CRUD
- `/api/session` — legacy session submission
- `/api/assessments/*` — legacy assessment CRUD + report

---

## 4. MVP Pages

| Path | Purpose | Status |
|------|---------|--------|
| `/mvp` | Manager dashboard, create assessment | active |
| `/mvp/standards` | Manager standards editor (ticket fields, tone) | active |
| `/mvp/assessments` | Assessment list | active |
| `/mvp/assessments/[id]` | Manager review: transcript, ticket, analysis, feedback | active |
| `/mvp/assessment/[token]` | Candidate chat UI | active |
| `/mvp/system` | Developer/operator status page | active |
| `/mvp/assist` | Placeholder — planned | planned |
| `/mvp/knowledge` | Placeholder — planned | planned |
| `/mvp/clients` | Placeholder — planned | planned |
| `/mvp/people` | Placeholder — planned | planned |
| `/mvp/analytics` | Placeholder — planned | planned |
| `/mvp/settings` | Placeholder — not built | not_built |

---

## 5. Library Module Map

### Active MVP Libraries

| File | Lines | Purpose |
|------|-------|---------|
| `lib/mvp/db.ts` | 657 | SQLite schema (13 tables), migrations, seed defaults (3 scenarios, 3 packs, criteria, standards, profile) |
| `lib/mvp/query.ts` | 295 | SQLite query layer: CRUD for assessments, sessions, messages, tickets, results, feedback, standards, packs, analysis runs |
| `lib/mvp/defaultContext.ts` | 4 | Constants: org-default, manager-default |
| `lib/mvp/modules.ts` | 52 | Module status registry (10 modules) |
| `lib/mvp/api/errors.ts` | 73 | 16 error codes with messages and HTTP status |
| `lib/mvp/api/responses.ts` | 50 | Standard response helpers: `ok()`, `fail()`, `failWithCustomCode()` |
| `lib/mvp/api/registry.ts` | 115 | Route inventory: 17 routes, active + planned |
| `lib/mvp/context/buildMvpContext.ts` | 130 | Shared context loader with integrity warnings |
| `lib/mvp/diagnostics/dbDiagnostics.ts` | 175 | DB diagnostics: table counts, seed status, integrity warnings, latest activity |
| `lib/mvp/analysis/types.ts` | 98 | Analysis pipeline type definitions |
| `lib/mvp/analysis/context.ts` | 42 | Build analysis context from assessment |
| `lib/mvp/analysis/hash.ts` | 25 | SHA-256 input hashing for cache/reproducibility |
| `lib/mvp/analysis/prompts.ts` | 36 | Prompt version constants |
| `lib/mvp/analysis/evidencePrompt.ts` | 86 | Evidence extraction prompt builder |
| `lib/mvp/analysis/narrativePrompt.ts` | 50 | Narrative feedback prompt builder |
| `lib/mvp/analysis/scoring.ts` | 154 | Deterministic scoring: weights, thresholds, dealbreakers |
| `lib/mvp/analysis/validation.ts` | ~40 | JSON validation helpers |
| `lib/mvp/analysis/runBaseCallumAnalysis.ts` | 258 | Main analysis orchestrator (3-step pipeline) |

### AI Provider

| File | Lines | Purpose |
|------|-------|---------|
| `lib/ai/provider.ts` | 166 | OpenRouter provider with task routing, retry, JSON parsing |
| `lib/ai/mock-provider.ts` | ~80 | Deterministic mock provider for testing without API key |
| `lib/ai/chutes.ts` | 769 | **FROZEN** Chutes AI integration |
| `lib/ai/feedback-analyzer.ts` | 468 | **FROZEN** Feedback analysis |
| `lib/ai/monitor.ts` | 424 | **FROZEN** AI monitor |
| `lib/ai/index.ts` | 40 | Barrel exports |

### Legacy Libraries (Frozen)

| Directory | Files | Purpose |
|-----------|-------|---------|
| `lib/supabase/` | 3 | Supabase client, server, proxy |
| `lib/voice/` | 8 | STT/TTS/chat providers, session, cost-tracker |
| `lib/evaluation/` | 5 | Evaluator, scoring, scenarios |
| `lib/taxonomy.ts` | 1 | File-based taxonomy |
| `lib/taxonomy-db.ts` | 1 | DB-based taxonomy |
| `lib/auth.ts` | 1 | Demo auth bypass |
| `lib/scoring.ts` | 1 | Legacy rubric scoring |
| `lib/assessment-ai.ts` | 1 | Legacy AI assessment |
| `lib/assessment-data.ts` | 1 | Legacy data helpers |
| `lib/assessment-scoring.ts` | 1 | Legacy scoring |
| `lib/checkpoint-statements.ts` | 1 | Legacy checkpoint strings |
| `lib/gpt-action-auth.ts` | 1 | GPT Action auth |
| `lib/invites.ts` | 1 | Legacy invite helpers |
| `lib/rubric.ts` | 1 | Legacy rubric constants |
| `lib/types.ts` | 370 | Legacy type definitions |

---

## 6. Database Schema (SQLite)

13 tables created by `lib/mvp/db.ts:initTables()`:

### Core Assessment Tables

```
assessments           — id, title, candidate_name, candidate_email, invite_token, status, 
                        scenario_id, criteria_version_id, manager_profile_id, created_at, completed_at
sessions              — id, assessment_id, status, started_at, ended_at
messages              — id, session_id, role (caller|candidate|system), content, created_at
tickets               — id, session_id, candidate_ticket_text, created_at
```

### Analysis Tables

```
assessment_results    — id, assessment_id, session_id, criteria_version_id, raw_model_json,
                        overall_score, readiness_label, summary, strengths_json, weaknesses_json,
                        checkpoint_json, ticket_score, created_at
analysis_runs         — id, org_id, manager_id, session_id, assessment_id, assessment_pack_id,
                        analysis_type, prompt_version, rubric_version, model_provider, model,
                        temperature, input_hash, status, result_id, error_code, error_message,
                        created_at, updated_at
```

### Manager Tables

```
manager_profiles       — id, display_name, company_name, role, created_at, updated_at
manager_standards      — id, org_id, manager_id, required_ticket_fields_json, call_requirements,
                         escalation_requirements, tone_preferences_json, good_ticket_example,
                         bad_ticket_example, good_customer_update_example, good_internal_note_example,
                         good_escalation_note_example, manager_profile_id, version, is_active, created_at, updated_at
manager_feedback       — id, assessment_id, result_id, manager_label, manager_score, notes, created_at
manager_criterion_feedback — id, feedback_id, criterion_id, original_status, manager_status,
                             original_score, manager_score, manager_comment, created_at
```

### Content Tables

```
scenarios              — id, title, industry, difficulty, caller_persona, hidden_facts_json,
                         caller_behaviour_prompt, initial_message, ideal_ticket_hints, active, created_at
assessment_criteria_versions — id, name, version, criteria_json, prompt_text, created_at, active
assessment_packs       — id, title, scenario_type, role_level, difficulty, version, customer_persona,
                         hidden_facts_json, expected_behaviours_json, required_ticket_fields_json,
                         red_flags_json, rubric_json, caller_behaviour_prompt, initial_message,
                         is_active, created_at, updated_at
```

### Seed Data

| Entity | ID | Notes |
|--------|----|-------|
| Criteria | `criteria-msp-v1` | MSP First-Line Call Readiness v1 (14 checkpoints) |
| Scenario | `scenario-outlook-001` | Outlook not sending (Sarah Thompson, Alder & Co) |
| Scenario | `scenario-password-001` | Password reset not working (James Wilson, Mercer & Tate Law) |
| Scenario | `scenario-printer-001` | Printer not printing (Dr. Emily Chen, Westside Medical) |
| Standards | `standards-default-v1` | 8 ticket fields, call requirements, tone prefs |
| Pack | `pack-outlook-v1` | Outlook Not Sending — First-Line Apprentice |
| Pack | `pack-password-v1` | Password Reset — First-Line Apprentice |
| Pack | `pack-printer-v1` | Printer Not Printing — First-Line Apprentice |
| Profile | `manager-default-v1` | Default Manager, CallCallum Demo MSP |

---

## 7. Analysis Pipeline

The deterministic assessment pipeline (`runBaseCallumAnalysis`) works in 3 steps:

```
Step 1: Evidence Extraction (AI, temperature 0)
  Input: transcript + ticket + scenario + standards
  Output: structured evidence per criterion (pass/partial/fail), red flags, ticket assessment
  
Step 2: Deterministic Scoring (code, no AI)
  Input: evidence + rubric weights + thresholds + dealbreakers
  Process: pass=1, partial=0.5, fail=0 → weighted sum → thresholds → dealbreaker overrides
  Output: score (0-100), readiness label, skill breakdown
  
Step 3: Narrative Feedback (AI, temperature 0.3)
  Input: score + rating + evidence
  Output: human-readable coaching feedback (not authoritative)
  
Step 4: Store
  - analysis_runs record with full metadata (model, hash, versions)
  - assessment_results with score, readiness, structured output
```

### Key Properties
- Same input → same deterministic score (hash-based caching)
- Prompt version, rubric version, model, provider stored on every run
- AI failure → fallback narrative, never corrupt score
- Missing ticket → controlled TICKET_NOT_FOUND error with HTTP 400

---

## 8. Error Codes

Defined in `lib/mvp/api/errors.ts`:

| Code | HTTP Status | Default Message |
|------|-------------|-----------------|
| ASSESSMENT_NOT_FOUND | 404 | The specified assessment was not found |
| SESSION_NOT_FOUND | 404 | No session found for this assessment |
| TOKEN_NOT_FOUND | 404 | The invite token is invalid or has expired |
| TICKET_NOT_FOUND | 400 | No ticket has been submitted for this assessment |
| NO_MESSAGES_FOUND | 400 | No messages found for this session |
| STANDARDS_NOT_FOUND | 404 | No manager standards found |
| ANALYSIS_CONTEXT_INCOMPLETE | 400 | Cannot run analysis: missing required data |
| AI_PROVIDER_MISSING_KEY | 503 | AI provider API key is not configured |
| AI_PROVIDER_FAILED | 502 | AI provider returned an error |
| AI_INVALID_JSON | 502 | AI response could not be parsed as valid JSON |
| DB_WRITE_FAILED | 500 | Failed to write to database |
| DB_READ_FAILED | 500 | Failed to read from database |
| VALIDATION_ERROR | 400 | Request validation failed |
| NOT_IMPLEMENTED | 501 | This feature is not yet implemented |
| UNKNOWN_ERROR | 500 | An unexpected error occurred |

---

## 9. Response Format

Legacy routes use ad-hoc `NextResponse.json()` shapes.

New plumbing routes use standard helpers:

### Success
```json
{ "ok": true, "data": { ... }, "meta": { ... } }
```

### Error
```json
{ "ok": false, "error": { "code": "TICKET_NOT_FOUND", "message": "...", "details": {} } }
```

### Legacy routes still using old format
```
POST /api/mvp/assessments
GET /api/mvp/assessments
GET /api/mvp/assessment/[token]
POST /api/mvp/assessment/[token]/message
POST /api/mvp/assessment/[token]/ticket
GET /api/mvp/assessments/[id]
POST /api/mvp/assessments/[id]/analyse
POST /api/mvp/assessments/[id]/feedback
GET /api/mvp/standards
POST /api/mvp/standards
```

These return `{ "key": value }` directly without the `{ ok, data }` wrapper. Not a priority to refactor unless the route is touched.

---

## 10. Configuration & Environment

### Required for MVP
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
MVP_DB_PROVIDER=sqlite
MVP_SQLITE_PATH=./data/callcallum.db
```

### Optional (AI — mock used if missing)
```env
AI_PROVIDER=openrouter
AI_BASE_URL=https://openrouter.ai/api/v1
AI_API_KEY=sk-or-v1-...
AI_CALLER_MODEL=openrouter/free
AI_EVALUATOR_MODEL=openrouter/free
```

### Frozen Legacy (not needed for MVP)
```env
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=
# SUPABASE_SERVICE_ROLE_KEY=
# DATABASE_URL=
# CHUTES_API_KEY=
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
# CLERK_SECRET_KEY=
```

---

## 11. Tests

| Command | What | Count | Time |
|---------|------|-------|------|
| `npm test` | Unit tests (scoring, evaluation, voice session) | 40 | ~5-10s |
| `npm run test:mvp-flow` | Integration tests against SQLite | 37 | ~5s |
| `npm run test:analysis-scoring` | Deterministic scoring validation | ~15 | ~3s |
| `npm run test:openrouter` | API key smoke test | 1 | ~3s |
| `npm run build` | Production build verification | — | ~60s |

### Test Files

| File | Tests | What It Covers |
|------|-------|----------------|
| `tests/assessment-scoring.test.ts` | 7 | Checkpoint scoring, ticket scoring, readiness labels, call/ticket combination |
| `tests/evaluation-scoring.test.ts` | 14 | Validation, weighted scoring, risk penalties, skill bonuses, rubric lookup |
| `tests/voice-session.test.ts` | 15 | Session CRUD, mock providers, cost estimation |
| `scripts/tests/validate-ai-integration.ts` | 13 | AI module validation (frozen legacy, needs DB) |
| `scripts/test-analysis-scoring.mjs` | ~15 | Deterministic scoring engine |

---

## 12. Critical Issues & Risks

### Open

1. **No auth on MVP** — Manager pages at `/mvp` are fully public. Anyone on the network can create assessments and view transcripts. The audit flagged this as P0.
2. **Live API key in `.env.local`** — `AI_API_KEY` is an active OpenRouter key. Gitignored but exposed on the server filesystem.
3. **Next.js 14.2.0 CVE** — CVE-2025-29927 (middleware authorization bypass). Bump to 14.2.25+ when ready.
4. **`npx tsc --noEmit` false positives** — Stale `.next/types/` files cause type errors if `.next` isn't cleaned first. Always delete `.next` before running standalone typecheck.
5. **Server reliability** — `next dev` processes get killed by shell tool process group cleanup. Must use `setsid -f` to survive between shell invocations.
6. **Server hangs on port 3000** — If `ss -tlnp | grep 3000` shows a LISTEN but curl says connection refused, a zombie process is holding the port. Kill it: `fuser -k 3000/tcp`.
7. **Old docs still describe dead Supabase architecture** — `SETUP.md`, `SOURCE_OF_TRUTH.md`, `DEPLOY.md`, `WORKING_SETUP.md` are misleading.
8. **Two definitions of "passed"** — GPT-supplied vs server-computed in legacy code (frozen, not an MVP concern).
9. **Demo admin bypass** — `demo_admin=1` cookie in `lib/auth.ts` and `lib/supabase/proxy.ts`.
10. **Deterministic engine not fully battle-tested** — ran once and scored 76. Needs more edge case validation.

### Fixed in Plumbing Spine v0

- Build passes ✓
- All tests pass (40 unit + 37 integration) ✓
- TypeScript check passes (after deleting `.next`) ✓
- Analysis_runs stores error_code/error_message on failure ✓
- Missing ticket → controlled TICKET_NOT_FOUND error ✓
- System status API + page provide full observability ✓
- Assessment debug API pinpoints failure location ✓
- Module/route registries document everything ✓
- Central error codes + response helpers exist ✓
- Context loader centralizes data access ✓

---

## 13. Agent CPU Conservation Discipline

CX23 is a shared VPS. Heavy operations slow down everyone and can get the agent killed.

### Golden Rule

**Do not make the server hotter than you found it.**

Before every heavy operation, ask: "Is this necessary right now, or can I verify a lighter way first?"

### Search

```bash
# NEVER search node_modules, .next, data, or .git
grep -R --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=data "pattern" .
# Better: scope to known directories
grep -n "pattern" lib/mvp/db.ts
grep -rn "pattern" lib/ app/ components/
```

### Build

```bash
# Run ONCE per task session, at the end. Not repeatedly.
npm run build
# Lightweight alternative during editing:
npx tsc --noEmit --skipLibCheck
```

### Install

```bash
# Only if package.json changed
git diff HEAD -- package.json
```

### Dev Server

```bash
# Sequence: stop → edit → lightweight check → start → test → stop
pkill -f "next dev"
# ... edit files ...
npx tsc --noEmit --skipLibCheck
setsid -f npx next dev --port 3006 > /tmp/nd.log 2>&1
# ... test via curl ...
# Stop when done
kill $(pgrep -f "next" 2>/dev/null)
```

### Tests

```bash
# Order: targeted → unit → integration → build. Stop at first catch.
# Fastest:
node --test .test-dist/tests/assessment-scoring.test.js
# Medium:
npm test
# Heavy:
npm run test:mvp-flow && npm run build
```

### Server Troubleshooting

```bash
# Port conflict?
ss -tlnp | grep 3000
fuser -k 3000/tcp

# Zombie next process?
pgrep -a next
kill -9 <PID>

# Container eating CPU?
docker stats --no-stream
docker ps
docker stop <CONTAINER_ID>

# Overall load?
top -bn1 | head -10
```

### Summary Checklist

- [ ] Am I searching node_modules? → Stop. Use `--exclude-dir`.
- [ ] Am I running npm install? → Did package.json change? If no, skip.
- [ ] Am I running npm run build? → Is this the final verification? If not, use `npx tsc --noEmit`.
- [ ] Is the dev server running? → Should it be? Stop when not in use.
- [ ] Is Docker/Coolify eating resources? → Check `docker stats`.
- [ ] Is the server load high (>2.0)? → Wait or ask before adding load.
- [ ] Can I read one file instead of searching 1000? → Yes. Read the file.
- [ ] Can I verify with one grep instead of full test suite? → If yes, do that first.

---

## 14. Build Order (What to Build Next)

Per `nextsteps.md` and current state:

```
1. Invite lifecycle (expiry, revoke, status tracking)
   — tokens never expire, no revoke endpoint
   — no "invite used" tracking beyond assessment status

2. Manager profile selection/creation UI
   — profiles table exists, but /mvp always uses default
   — add profile picker to dashboard

3. Criterion-level manager feedback overrides
   — manager_criterion_feedback table exists but UI not built
   — this is the product moat (calibration data)

4. Deterministic engine hardening
   — edge cases: empty transcript, partial data, bad ticket
   — verify 3 scenario packs produce distinct score distributions

5. Local auth gate
   — simple password or env-var gating
   — do not build full auth, just basic protection

6. Then: Callum For You (manager-calibrated re-scoring)
```

---

## 15. Agent Rules

1. **AI scores are not authoritative.** AI extracts evidence only. Code computes the final score.
2. **No hidden facts to candidates.** Candidate-facing APIs must strip `hidden_facts`, `rubric`, `checkpoints`, `red_flags`, `ideal_ticket` from scenario responses.
3. **No placeholder polish.** Do not waste time on `/mvp/assist`, `/mvp/knowledge`, `/mvp/clients`, `/mvp/people`, `/mvp/analytics` pages. They are placeholders.
4. **No voice yet.** `lib/voice/` is frozen.
5. **No analytics yet.** Cross-candidate analytics come after the core assessment loop is proven.
6. **No Callum For You yet.** Manager-calibrated re-scoring needs sufficient feedback data first.
7. **No Supabase in active MVP.** SQLite only. Supabase code is legacy/frozen.
8. **No new features in legacy architecture.** All new code goes in `/mvp` + SQLite path.
9. **Version everything.** Every analysis run records prompt version, rubric version, model, provider, and input hash.
10. **Tests prove product behavior, not just route status.** Score differences, field leakage, caching, reproducibility.
11. **Do not build on a hot server.** Check `top` first. If load > 2.0, stop and wait.
