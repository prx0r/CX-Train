# Attention — CallCallum Recent Work

## Scope

This covers the last ~3 hours of work across 7 commits on `main`. Everything builds toward **deterministic, inspectable, manager-trustworthy assessment analysis** — the core of the CallCallum MVP.

---

## Commits (newest first)

### `fbcbb73` — Analysis Engine Breakpoint Suite
- 54 failure modes catalogued across 8 categories in `docs/ANALYSIS_ENGINE_FAILURE_MODES.md`
- Full pipeline map in `docs/ANALYSIS_ENGINE_MAP.md`
- 16 JSON fixtures in `tests/fixtures/analysis-engine/` covering: excellent/bad/unsafe password reset, empty ticket, good+bad call/ticket combos, contradictory candidate, false ticket claims, prompt injection, one-message call, ambiguous call, perfect call, scenario mismatch, hidden fact probe, abusive candidate, ticket with unsupported fix
- `tests/analysis-engine.test.ts` — 19 tests: structure validation, score ranges, readiness labels, gate assertions, determinism check (all fixtures run twice), evidence grounding proxy, candidate-safe boundary, sanity checks
- 59/59 tests pass (19 new + 40 existing)

### `a254487` — Adversarial Engine Tests
- 43 adversarial edge cases in `scripts/test-adversarial.mjs`
- **Found and fixed**: red flag type matching was case-sensitive — `SEVERE_CUSTOMER_ABUSE` or `"  severe_customer_abuse  "` would silently bypass all gates
- Fixed `detectFailGates()` to normalize with `toLowerCase().trim()`
- 0 crashes across all 43 adversarial tests

### `5f9526b` — 50-Transcript Scoring Simulator
- `scripts/test-50-transcripts.mjs` — 50 realistic call transcripts across 9 categories
- Each run through deterministic scorer twice for determinism check
- Key finding: **Rubric weights are too evenly distributed** — missing scope (weight 2/46) only drops score 4 points. Documented in `docs/report-50-transcripts.md`
- Determinism: 50/50 ✓. Scoring engine: 0 bugs found.

### `3253a27` — Scoring Guide
- `docs/scoringguide.md` — comprehensive documentation: 23 criteria weights, status mapping, raw score formula, 7 fail gates, 4 worked examples, determinism guarantee, AI boundaries, rubric versioning

### `ee3c688` — Checkpoint D: Analysis Hardening
- 7 fail gates with severity, score caps, and readiness overrides:
  - `severe_customer_abuse` (critical, cap 10, not_ready)
  - `unsafe_security_behaviour` (critical, cap 25, not_ready)
  - `refusal_to_help` (critical, cap 20, not_ready)
  - `hallucinated_fix` (major, cap 50, needs_supervision)
  - `no_troubleshooting` (major, cap 40, not_ready)
  - `invented_fix_without_evidence` (major, cap 50, needs_supervision)
  - `critical_urgency_missed` (major, cap 70, needs_supervision)
- Rubric version bumped to `callcallum-base-v0.4-analysis-hardening`
- New criteria: `professional_conduct`, `customer_communication`
- Evidence prompt v2 with conduct/security/refusal rules
- 7 test fixtures + reproducibility test
- All tests pass: hardening 7/7, scoring 10/10, unit 40/40, flow 37/37

### `4aea39f` — Plumbing Spine v0
- `docs/test-plumbing.md` — 15/15 plumbing validation tests
- `docs/agentadvice.md` — expanded to full source of truth with complete codebase audit
- `package.json` — wired `test:analysis-scoring` script

### `a569246` — Plumbing Spine v0 + Architectural Cleanup
- `lib/mvp/api/errors.ts` — 16 central error codes
- `lib/mvp/api/responses.ts` — `ok()`/`fail()` helpers
- `lib/mvp/api/registry.ts` — 17 route inventory
- `lib/mvp/modules.ts` — 10 module status registry
- `lib/mvp/context/buildMvpContext.ts` — shared context loader
- `lib/mvp/diagnostics/dbDiagnostics.ts` — DB diagnostics
- `app/api/mvp/debug/status` — system status API
- `app/api/mvp/debug/assessment/[id]` — assessment debug API
- `app/mvp/system` — developer/operator status page
- `docs/ACTIVE_ARCHITECTURE.md` / `docs/AGENT_RULES.md`
- README updated for active `/mvp` + SQLite spine

---

## Current State

### Active MVP Spine
```
/mvp + SQLite + local manager profiles + invite tokens + deterministic scorer
```

### Analysis Engine Architecture
```
Layer 1: Evidence Extraction (AI, temperature 0)
Layer 2: Deterministic Scoring + Fail Gates (pure code)
Layer 3: Narrative Report (AI, score-locked, temperature 0.3)
```

**Score is 100% code-generated.** AI never decides the final score or readiness label.

### Key Database Tables
13 SQLite tables. `analysis_runs` stores execution metadata (hash, model, prompt/rubric version, gate hits). `assessment_results` stores score, readiness, structured JSON.

### Test Suite (59 total)
| Test File | Count | What |
|-----------|-------|------|
| `tests/assessment-scoring.test.ts` | 7 | Checkpoint scoring, ticket scoring |
| `tests/evaluation-scoring.test.ts` | 14 | Validation, weighted scoring (legacy) |
| `tests/voice-session.test.ts` | 15 | Session CRUD (legacy) |
| `tests/analysis-engine.test.ts` | 19 | 16 fixtures, score ranges, gates, determinism |
| `scripts/test-analysis-hardening.mjs` | 7 | Fail gate fixtures |
| `scripts/test-analysis-scoring.mjs` | 10 | Pure scoring functions |

### 54 Failure Modes
- **21 fixed**: determinism (6), scoring nonsense (4), hidden facts (4), scenario mismatch (2), adversarial (1), data quality (3)
- **6 partial**: evidence (1), scoring (2), calibration (1), data (2)
- **27 open**: evidence grounding (6), AI caller disclosure (3), adversarial candidate (5), data quality (5), manager calibration (4), scenario mismatch (2)

---

## Architecture Boundaries

### Active — build here
```
app/mvp/
app/api/mvp/
lib/mvp/
lib/ai/provider.ts
```

### Frozen — do not build new features here
```
app/(auth)/            Clerk sign-in
app/(dashboard)/       Legacy admin/trainee dashboards
app/assessment/        Legacy Supabase assessment flow
app/voice/             Voice evaluation
app/api/assessments/   Legacy assessment routes
app/api/gpt/           GPT Actions
app/api/voice/         Voice sessions
app/api/levels/        Level progression
app/api/taxonomy/      Taxonomy CRUD
app/api/admin/         Admin CRUD
lib/supabase/          Supabase client
lib/voice/             STT/TTS/chat
lib/evaluation/        Legacy evaluation layer
lib/ai/chutes.ts       Chutes integration
```

---

## What to Build Next

1. **Evidence grounding validator** — verify evidence quotes exist in transcript/ticket (biggest current risk)
2. **AI caller hidden fact disclosure tests** — verify caller doesn't reveal facts unless asked appropriately
3. **Ticket/call evidence cross-reference** — detect when ticket claims actions not in transcript
4. **Rubric weight tuning** — per `docs/report-50-transcripts.md` recommendations
5. **Invite lifecycle** — token expiry, revoke, status tracking
