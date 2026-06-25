# Analysis Engine Failure Modes

## A. Determinism Failures

| # | Failure | Status | Test |
|---|---------|--------|------|
| A1 | Same transcript gives different score on re-run | ✓ FIXED — scoring is pure function, hash-based caching | test-analysis-hardening.mjs |
| A2 | Same ticket gives different score | ✓ FIXED — scoring is deterministic | test-analysis-hardening.mjs |
| A3 | AI model randomness changes final score | ✓ FIXED — AI does not compute score | scoring.ts |
| A4 | Analysis re-run overwrites previous result | ✓ FIXED — caching by input_hash returns existing | runBaseCallumAnalysis.ts |
| A5 | Rubric version not stored | ✓ FIXED — stored in analysis_runs | runBaseCallumAnalysis.ts:105 |
| A6 | Prompt version not stored | ✓ FIXED — stored in analysis_runs | runBaseCallumAnalysis.ts:105 |
| A7 | Manager standards not snapshotted | ⚠️ PARTIAL — context.ts tries snapshot, falls back to current | context.ts:20-37 |

## B. Evidence Failures

| # | Failure | Status | Test |
|---|---------|--------|------|
| B1 | Score says pass but no evidence quote | ⚠️ OPEN — no validator enforces evidence exists per pass | — |
| B2 | Evidence quote not found in transcript/ticket | ⚠️ OPEN — no grounding validator | — |
| B3 | Evidence quote is hallucinated by AI | ⚠️ OPEN — no quote grounding check | — |
| B4 | Criterion marked fail despite candidate asking the question | ⚠️ OPEN — depends on AI extraction quality | — |
| B5 | Criterion marked pass from vague unrelated text | ⚠️ OPEN — depends on AI extraction quality | — |
| B6 | Ticket-only evidence counted as call evidence | ⚠️ OPEN — criteria don't distinguish source | — |

## C. Scoring Nonsense

| # | Failure | Status | Test |
|---|---------|--------|------|
| C1 | Unsafe advice but score still ready | ✓ FIXED — unsafe_security_behaviour gate caps at 25, forces not_ready | test-analysis-hardening.mjs |
| C2 | Invented fix but gets high score | ✓ FIXED — hallucinated_fix gate caps at 50 | test-analysis-hardening.mjs |
| C3 | No diagnostic questions but gets ready | ⚠️ PARTIAL — no_troubleshooting gate caps at 40, but depends on AI flagging it | — |
| C4 | Empty ticket but gets high ticket score | ⚠️ OPEN — ticket criteria depend on AI extraction | — |
| C5 | One-message call but gets decent score | ⚠️ OPEN — pre-check requires ≥2 messages, but doesn't check quality | runBaseCallumAnalysis.ts:44-46 |
| C6 | Contradictory statements and still gets credit | ⚠️ OPEN — no contradiction detection | — |
| C7 | Auto-fail red flag but readiness remains ready | ✓ FIXED — critical gates force not_ready | scoring.ts:computeFinalScore() |

## D. Hidden Fact Leakage

| # | Failure | Status | Test |
|---|---------|--------|------|
| D1 | Candidate endpoint exposes hidden_facts | ✓ FIXED — MVP route manually selects safe fields | app/api/mvp/assessment/[token]/route.ts |
| D2 | Candidate endpoint exposes required_checkpoints | ✓ FIXED — not returned in candidate API | — |
| D3 | Candidate endpoint exposes ideal_ticket | ✓ FIXED — not returned in candidate API | — |
| D4 | Candidate endpoint exposes rubric | ✓ FIXED — not returned in candidate API | — |
| D5 | AI caller reveals hidden facts without being asked | ⚠️ OPEN — depends on prompt compliance, no automated test | — |
| D6 | AI caller gives away expected answer | ⚠️ OPEN — prompt instructs not to, but no enforcement | — |
| D7 | Candidate infers scoring from API response | ⚠️ OPEN — meta field shows message count, possible leak | — |

## E. Scenario Mismatch

| # | Failure | Status | Test |
|---|---------|--------|------|
| E1 | Password transcript scored with printer rubric | ✓ FIXED — context.ts uses assessment's scenario_id | context.ts |
| E2 | Scenario_id missing but analysis still runs | ⚠️ OPEN — scenario is optional in AnalysisContext | types.ts:97 |
| E3 | Criteria_version missing but analysis still runs | ⚠️ OPEN — getActiveCriteria() returns null silently | context.ts:16 |
| E4 | Assessment pack changed after session changes old score | ✓ FIXED — analysis_runs uses versions, hash includes pack | hash.ts |
| E5 | Mismatched pack/scenario not detected | ⚠️ OPEN — no validation that pack matches scenario | — |

## F. Manager Calibration Failures

| # | Failure | Status | Test |
|---|---------|--------|------|
| F1 | Manager override does not store original score | ⚠️ OPEN — feedback route updates score directly without storing original | feedback/route.ts:38-39 |
| F2 | Criterion feedback does not store original status | ✓ FIXED — manager_criterion_feedback stores original_status | db.ts schema |
| F3 | Manager correction not traceable to analysis run | ⚠️ OPEN — feedback stores result_id but frontend may not link | — |
| F4 | Manager feedback changes old score without audit | ⚠️ OPEN — No version/change log | — |
| F5 | Feedback too coarse to improve rubric | ⚠️ OPEN — Only label + score, no structured reason | — |

## G. Adversarial Candidate Behavior

| # | Failure | Status | Test |
|---|---------|--------|------|
| G1 | Prompt injection ("ignore previous instructions") | ⚠️ OPEN — no guard in extraction prompt | — |
| G2 | Candidate asks caller for hidden facts | ⚠️ OPEN — hidden facts in context, caller might reveal | — |
| G3 | Candidate claims actions in ticket not in transcript | ⚠️ OPEN — no cross-reference check | — |
| G4 | Good call but terrible ticket | ⚠️ PARTIAL — ticket criteria weighted at 12/44 | scoringguide.md |
| G5 | Good ticket but poor call | ⚠️ PARTIAL — call criteria weighted at 32/44 | scoringguide.md |
| G6 | Candidate spams irrelevant text | ⚠️ OPEN — no length/content sanity check | — |
| G7 | Candidate uses one mega-question with many keywords | ⚠️ OPEN — AI might give credit for keyword matching | — |
| G8 | Candidate refuses to troubleshoot | ✓ FIXED — refusal_to_help gate | scoring.ts |

## H. Data Quality Failures

| # | Failure | Status | Test |
|---|---------|--------|------|
| H1 | Empty transcript | ⚠️ PARTIAL — pre-check fails if <2 messages, but empty transcript = 1 initial message + no reply passes | — |
| H2 | Missing ticket | ✓ FIXED — pre-check returns TICKET_NOT_FOUND | runBaseCallumAnalysis.ts:40-42 |
| H3 | Duplicate messages | ⚠️ OPEN — no dedup check | — |
| H4 | Messages out of order | ⚠️ OPEN — no order validation | — |
| H5 | Role reversal (caller/candidate swapped) | ⚠️ OPEN — no role validation | — |
| H6 | Very long transcript (token limit) | ⚠️ OPEN — no length check, may hit AI context window | — |
| H7 | Non-English transcript | ⚠️ OPEN — English prompts assume English | — |
| H8 | Malformed JSON from model | ✓ FIXED — parseExtractionJson handles this | validation.ts |
| H9 | Model timeout / rate limit | ✓ FIXED — runAiTask has retry logic | ai/provider.ts |

## Summary

| Category | Total | Fixed | Partial | Open |
|----------|-------|-------|---------|------|
| A. Determinism | 7 | 6 | 1 | 0 |
| B. Evidence | 6 | 0 | 0 | 6 |
| C. Scoring nonsense | 7 | 4 | 2 | 1 |
| D. Hidden fact leakage | 7 | 4 | 0 | 3 |
| E. Scenario mismatch | 5 | 2 | 0 | 3 |
| F. Manager calibration | 5 | 1 | 0 | 4 |
| G. Adversarial behavior | 8 | 1 | 2 | 5 |
| H. Data quality | 9 | 3 | 1 | 5 |
| **Total** | **54** | **21** | **6** | **27** |
