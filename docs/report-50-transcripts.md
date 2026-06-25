# 50-Transcript Scoring Engine Simulator — Results

**Commit:** `ee3c688`
**Rubric:** `callcallum-base-v0.4-analysis-hardening`
**Total weight pool:** 46 (22 criteria)
**Fail gates:** 7
**Scenarios:** 50 across 9 categories

---

## Executive Summary

| Measure | Result |
|---------|--------|
| Determinism | **50/50 ✓** — All scenarios produce identical scores across runs |
| Gate logic | **Correct for all 7 gates** — 29 gate-triggering scenarios all produce correct `not_ready` or capped score |
| Score math | **Correct** — Weighted average calculation verified |
| Rubric weight satisfaction | **33/50 match manager intuition** — 17 scenarios score higher than expected because individual criterion weights are small relative to the 46-point pool |
| Scoring engine bugs found | **0** — The engine works correctly. All 17 mismatches are rubric tuning issues |

---

## Category Results

### Conduct Failures (scenarios 1-8)
**All pass.** Every abusive/dismissive/threatening scenario correctly triggers `severe_customer_abuse` or `refusal_to_help` gate. Scores capped at 10-20. Readiness all `not_ready`.

### Security Failures (scenarios 9-14)
**All pass.** Every password/MFA/credential request correctly triggers `unsafe_security_behaviour` gate. Scores capped at 25. Readiness all `not_ready`.

### Refusal to Help (scenarios 15-19)
**All pass.** Each refuses/dismisses/deflects correctly triggers `refusal_to_help` gate. Scores capped at 20. Readiness all `not_ready`.

### Invented Fixes (scenarios 20-24)
**4/5 pass.** Scenario #24 (generic fix claim) scores 50 → `not_ready` because capped score < 60 threshold. This is correct behavior — the gate caps at 50, and 50 < 60 means `not_ready`, even though the override says `needs_supervision`. The engine correctly applies the rule "if score < 60, must be not_ready."

### No Meaningful Troubleshooting (scenarios 25-30)
**All pass.** All correctly trigger `no_troubleshooting` gate. Scores capped at 20-40.

### Partial / Incomplete (scenarios 31-36)
**3/6 pass.** Three scenarios score higher than manager intuition expected. Root cause: ticket criteria have combined weight of 12/46. Even a terrible ticket only costs ~26% if the call was decent.

### Good Calls with Subtle Misses (scenarios 37-42)
**0/6 pass** on expectation match, but **all engine behavior is correct**. Missing a single weight-1 or weight-2 criterion out of 46 changes the score by only 2-4 points. These scenarios score 89-98 because the candidate passed most criteria. The mismatch is in rubric weights, not the scoring engine.

### Good / Nearly Perfect Calls (scenarios 43-46)
**1/4 pass on expectations, engine correct for all.** Same weight issue: missing `customer_tone` (weight 2) or `next_steps` (weight 3) barely dents the total.

### Ticket Quality Issues (scenarios 47-50)
**0/4 pass on expectations, engine correct for all.** A one-line ticket drops the score to 76 (from 100). A ticket with invented info still scores 98 because only `ticket_issue_summary` (weight 2) and `ticket_checks_attempted` (weight 2) are affected.

---

## Rubric Weight Findings

The scoring engine is correct. The rubric weights need tuning for manager-realistic scores:

### Problem: Small weights dilute impact of misses

```
Weight of missing all 7 ticket fields:  12/46 = 26% penalty → score 72
Weight of missing scope (one vs many):  2/46  = 4% penalty  → score 96
Weight of missing recent_changes:       1/46  = 2% penalty  → score 98
```

A manager feels "missed scope" is a meaningful failure. The rubric says it's 4% of the total.

### Recommended Weight Adjustments

| Criterion | Current | Suggested | Reason |
|-----------|---------|-----------|--------|
| scope | 2 | 5 | Core discovery question |
| urgency | 3 | 5 | Critical for prioritisation |
| next_steps | 3 | 5 | Core closure behaviour |
| identity_check | 1 | 2 | Basic professional behaviour |
| company_check | 1 | 2 | Basic professional behaviour |
| started_when | 1 | 2 | Basic discovery |
| ticket_user_company | 1 | 3 | Core ticket field |
| ticket_issue_summary | 2 | 3 | Core ticket field |
| error_or_status_capture | 1 | 2 | Technical discovery |
| recent_changes | 1 | 3 | Often root cause |

This would change the total weight pool from 46 to ~58, making individual misses more impactful.

### Verification of Recommended Weights

With suggested weights:
- Missing scope (weight 5/58) → score ~91 (was 96)
- Missing all ticket fields (weight 19/58) → score ~67 (was 72)
- Missing recent_changes (weight 3/58) → score ~95 (was 98)

These still feel generous for a single miss, but this is the intended behavior — a single missed criterion should not tank an otherwise good call. The weight changes should be validated with a second pass.

---

## Scoring Engine Verdict

| Property | Status |
|----------|--------|
| Deterministic (same input = same output) | ✓ Verified across all 50 scenarios |
| Gate logic (critical gates force not_ready) | ✓ All 29 gate-triggering scenarios correct |
| Score capping (min of raw and strictest cap) | ✓ All gate scenarios correctly capped |
| Readiness floor (score < 60 = not_ready even with major gate) | ✓ Verified |
| Status score mapping (pass=1, partial=0.5, fail=0) | ✓ Verified |
| not_applicable exclusion | ✓ Verified |
| Empty criteria (score 0) | ✓ Verified |
| Reproducibility | ✓ 50/50 identical across runs |

**No scoring engine bugs found.** The engine is ready for production use.

### What to Fix Next

1. **Rubric weights** (not scoring engine) — adjust as recommended above
2. **Add conduct detection in evidence prompt** — the prompt already has rules, but needs end-to-end testing with real AI
3. **Add manager UI for gate hits** — show red flags prominently in assessment detail page
