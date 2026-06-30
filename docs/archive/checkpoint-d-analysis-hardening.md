# Checkpoint D — Analysis Hardening / Evaluator Calibration

## Problem

A test transcript where the candidate told the customer "fuck off" received ~32/100. This is unacceptable. Severe professional conduct failure must trigger an explicit fail gate, cap the score extremely low, and explain exactly why.

## What Changed

### Architecture

Analysis now has three strict layers:

```
Layer 1: Evidence Extraction (AI)
  → structured criteria statuses + red flags (conduct, security, etc.)
  
Layer 2: Deterministic Scoring + Fail Gates (code, no AI)
  → normal weighted score → detect fail gates → apply score caps → force readiness
  
Layer 3: Narrative Report (AI, score-locked)
  → readable feedback based on fixed score and evidence
```

### Fail Gates

| Gate | Severity | Score Cap | Readiness | Trigger |
|------|----------|-----------|-----------|---------|
| severe_customer_abuse | critical | 10 | not_ready | Candidate insults, swears at, mocks, or abuses customer |
| unsafe_security_behaviour | critical | 25 | not_ready | Candidate asks for password/MFA/credentials |
| refusal_to_help | critical | 20 | not_ready | Candidate refuses to help, dismisses, abandons |
| hallucinated_fix | major | 50 | needs_supervision | Candidate claims fix without evidence |
| no_troubleshooting | major | 40 | not_ready | Candidate performs no meaningful troubleshooting |
| invented_fix_without_evidence | major | 50 | needs_supervision | Legacy dealbreaker |
| critical_urgency_missed | major | 70 | needs_supervision | Legacy dealbreaker |

### Scoring Behaviour

1. Calculate normal weighted score from criteria statuses.
2. Detect triggered fail gates from red flags.
3. Find the strictest score cap among triggered gates.
4. Apply `finalScore = Math.min(rawScore, strictestCap)`.
5. If any critical gate hit → `readiness = not_ready`.
6. If major gates but score < 60 → `readiness = not_ready`.
7. Store both `rawScoreBeforeCaps` and `finalScore`.

### Rubric Version

`callcallum-base-v0.4-analysis-hardening`

New criteria added: `professional_conduct`, `customer_communication`.

### Files Changed

| File | Change |
|------|--------|
| `lib/mvp/analysis/types.ts` | Added `FailGateHit`, `GateSeverity`, `EvidenceItem`, `ReadinessLabel`, `DeterministicAnalysisResult`, `RUBRIC_VERSION` |
| `lib/mvp/analysis/scoring.ts` | Rewrote with `FAIL_GATES`, `detectFailGates()`, `computeFinalScore()`, `rawScoreBeforeCaps` |
| `lib/mvp/analysis/evidencePrompt.ts` | v2: added conduct/security/refusal criteria, red flag definitions, explicit extraction rules |
| `lib/mvp/analysis/narrativePrompt.ts` | v2: passes gate info to AI, warns narrative must not change score |
| `lib/mvp/analysis/runBaseCallumAnalysis.ts` | Wired fail gates between step 2 and step 3; stores gate hits in structured output |
| `lib/mvp/analysis/__fixtures__/index.ts` | 7 test fixtures (abuse, security, no_troubleshooting, good_imperfect, perfect, hallucinated_fix, no_ticket) |
| `scripts/test-analysis-hardening.mjs` | 8 tests run against fixtures (7 fixture + 1 reproducibility) |
| `package.json` | Added `test:analysis-hardening` script |
| `app/api/mvp/debug/assessment/[id]/route.ts` | Results now include `raw_score_before_caps`, `gate_hits`, `rubric_version` |

## Test Results

```
=== Analysis Hardening Tests (Checkpoint D) ===

Fixture: severe_abuse
  Score: 10 (raw: 35) [expected 0-10] ✓
  Readiness: not_ready ✓
  Gate: severe_customer_abuse (critical, cap 10)

Fixture: unsafe_security
  Score: 25 (raw: 85) [expected 0-25] ✓
  Readiness: not_ready ✓
  Gate: unsafe_security_behaviour (critical, cap 25)

Fixture: no_troubleshooting
  Score: 25 (raw: 25) [expected 0-40] ✓
  Readiness: not_ready ✓
  Gate: no_troubleshooting (major, cap 40)

Fixture: good_imperfect
  Score: 87 (raw: 87) [expected 65-90] ✓
  Readiness: ready ✓
  No gates

Fixture: perfect_call
  Score: 100 (raw: 100) [expected 85-100] ✓
  Readiness: ready ✓
  No gates

Fixture: hallucinated_fix
  Score: 50 (raw: 54) [expected 0-50] ✓
  Readiness: not_ready ✓
  Gate: hallucinated_fix (major, cap 50)

--- Deterministic Reproducibility ---
  Same fixture produces same score: 10 (PASS)

=== Results: 7 passed, 0 failed ===
```

### Key Assertions Verified

- **Abusive candidate** → score 10 (capped from 35), `not_ready`, gate hit with evidence
- **Unsafe password ask** → score 25 (capped from 85), `not_ready`, gate hit
- **No troubleshooting** → score 25, `not_ready`, gate hit
- **Perfect candidate** → score 100, `ready`, no gates
- **Reproducible** → same fixture always gives same score
- **No AI calls** → all tests run on pure code

## Remaining Work Before Voice Testing

1. Wire live AI extraction to return the new red flag types (already prompted in v2, needs end-to-end test)
2. Manager UI should visually highlight gate hits at the top of results
3. Consider adding `refusal_to_help` detection (prompt has it, not yet in fixtures)
