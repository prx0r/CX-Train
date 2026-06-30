# CallCallum Scoring Guide

## How Deterministic Scoring Works

The scoring engine is in `lib/mvp/analysis/scoring.ts`. It runs entirely in code — no AI decides the final score. AI only extracts evidence; code computes the result.

---

## 1. The Three-Layer Pipeline

```
Transcript + Ticket
          │
          ▼
Layer 1: Evidence Extraction (AI, temperature 0)
  → For each of 23 criteria, outputs: pass / partial / fail / not_observed / not_applicable
  → Also outputs: red flags (conduct failures, security issues, etc.)
  → Also outputs: ticket assessment
          │
          ▼
Layer 2: Deterministic Scoring + Fail Gates (code, no AI)
  → Normal weighted score from criteria
  → Fail gate detection from red flags
  → Score cap application
  → Readiness label assignment
          │
          ▼
Layer 3: Narrative Report (AI, temperature 0.3, score-locked)
  → Writes readable feedback
  → Cannot change score, readiness, or gate status
```

---

## 2. Criteria Weights

23 criteria, each with a weight. The total weight pool determines the maximum possible score.

### Professional Conduct (7 points total)
| Criterion | Weight | What It Measures |
|-----------|--------|------------------|
| professional_conduct | 4 | Remained professional, did not abuse or dismiss customer |
| customer_communication | 3 | Communicated clearly and respectfully |

### Discovery & Triage (15 points total)
| Criterion | Weight | What It Measures |
|-----------|--------|------------------|
| identity_check | 1 | Confirmed caller name or identity |
| company_check | 1 | Confirmed company or organisation |
| issue_clarification | 2 | Clarified the exact issue |
| started_when | 1 | Asked when the issue started |
| impact | 3 | Asked about business impact |
| urgency | 3 | Asked about deadline or urgency |
| scope | 2 | Asked whether one or multiple users affected |
| technical_discovery | 2 | Performed technical checks (webmail, other apps) |

### Resolution (5 points total)
| Criterion | Weight | What It Measures |
|-----------|--------|------------------|
| error_or_status_capture | 1 | Asked for error messages |
| recent_changes | 1 | Asked about recent changes |
| next_steps | 3 | Set clear next steps or expectations |

### Soft Skills (5 points total)
| Criterion | Weight | What It Measures |
|-----------|--------|------------------|
| customer_tone | 2 | Used professional, empathetic tone |
| safety | 4 | Avoided unsafe advice or invented fixes |

### Ticket Quality (12 points total)
| Criterion | Weight | What It Measures |
|-----------|--------|------------------|
| ticket_user_company | 1 | Includes user name and company |
| ticket_issue_summary | 2 | Clear issue description |
| ticket_impact | 2 | Business impact stated |
| ticket_urgency | 2 | Urgency or deadline included |
| ticket_checks_attempted | 2 | Lists troubleshooting steps tried |
| ticket_next_step | 2 | Next step or plan documented |
| escalation_judgement | 2 | Appropriate escalation decision |

### Total possible weight: 44

---

## 3. Status Scores

Each criterion receives a status from the evidence extraction step. The status maps to a numeric score:

| Status | Score | Meaning |
|--------|-------|---------|
| pass | 1.0 | Clearly demonstrated with evidence |
| partial | 0.5 | Partially demonstrated but incomplete |
| fail | 0.0 | Not demonstrated when it should have been |
| not_observed | 0.0 | Could not determine from available data |
| not_applicable | excluded | Not relevant to this scenario |

---

## 4. Raw Score Calculation

```
For each criterion:
  earned = weight × statusScore
  earnedScore += earned
  maxPossibleScore += weight   (if not not_applicable)

rawScore = round((earnedScore / maxPossibleScore) × 100)
```

### Example

A candidate who passes every criterion:
```
earnedScore = 44, maxPossibleScore = 44, rawScore = 100
```

A candidate who misses urgency (weight 3) but passes everything else:
```
earnedScore = 41, maxPossibleScore = 44
rawScore = round(41 / 44 × 100) = 93
```

A candidate who misses impact (3), urgency (3), scope (2), and ticket fields:
```
earnedScore = 32, maxPossibleScore = 44
rawScore = round(32 / 44 × 100) = 73
```

---

## 5. Readiness Thresholds (Before Gates)

After raw score is calculated, the initial readiness is:

| Score Range | Readiness Label | Meaning |
|-------------|-----------------|---------|
| 80–100 | ready | Good first-line technician |
| 60–79 | needs_supervision | Margin for coaching |
| 0–59 | not_ready | Needs more training |

---

## 6. Fail Gates (Score Caps + Readiness Override)

Fail gates are the critical innovation. They run AFTER normal scoring and can override both score and readiness.

### Gate Detection

The evidence extraction step outputs red flags. Each red flag type maps to a fail gate:

| Gate | Severity | Score Cap | Forces Readiness | Triggered By |
|------|----------|-----------|------------------|--------------|
| severe_customer_abuse | critical | 10 | not_ready | Candidate insults, swears at, mocks, threatens, or abuses the customer |
| unsafe_security_behaviour | critical | 25 | not_ready | Candidate asks for password, MFA code, or sensitive credentials |
| refusal_to_help | critical | 20 | not_ready | Candidate refuses to troubleshoot, dismisses issue, abandons call |
| hallucinated_fix | major | 50 | needs_supervision | Candidate claims fix or diagnosis without evidence |
| no_troubleshooting | major | 40 | not_ready | Candidate performs no meaningful troubleshooting |
| invented_fix_without_evidence | major | 50 | needs_supervision | Legacy: candidate invents unsupported fix |
| critical_urgency_missed | major | 70 | needs_supervision | Legacy: critical urgency not captured |

### Score Capping Logic

```
strictestCap = minimum scoreCap across all triggered gates
finalScore = min(rawScore, strictestCap)
```

### Readiness Override Logic

```
if any critical gate triggered:
    readiness = not_ready

else if any major gate triggered:
    readiness = strictest_major_gate.overrideReadiness
    if readiness == 'needs_supervision' AND finalScore < 60:
        readiness = not_ready

else:
    readiness = normal threshold from finalScore
```

### Key Principle

Some behaviours override normal scoring entirely. A candidate who abuses the customer cannot score above 10, regardless of how many technical questions they asked.

---

## 7. Complete Worked Examples

### Example A: Abusive Candidate

```
Criteria passed: identity_check, company_check, issue_clarification, impact, urgency, scope
Criteria failed: professional_conduct, customer_tone, customer_communication,
                 technical_discovery, error_or_status_capture, recent_changes,
                 next_steps, all ticket criteria

Red flags: severe_customer_abuse (evidence: "fuck off")

earnedScore = 14, maxPossibleScore = 44
rawScore = round(14/44 × 100) = 31

Gate: severe_customer_abuse (critical, cap 10)
finalScore = min(31, 10) = 10
readiness = not_ready

Result: score 10, not_ready, gate hit with evidence
```

### Example B: Unsafe Security

```
Candidate asks for password but otherwise does well.

Criteria passed: most technical criteria
Criteria failed: safety (asked for password), escalation_judgement

Red flags: unsafe_security_behaviour

rawScore = 85
Gate: unsafe_security_behaviour (critical, cap 25)
finalScore = min(85, 25) = 25
readiness = not_ready

Result: score 25, not_ready, gate hit
```

### Example C: Good But Missed Urgency

```
Candidate does well but forgets to ask about deadline.

Criteria passed: identity_check, company_check, issue_clarification, impact,
                 scope, technical_discovery, error_or_status_capture,
                 next_steps, customer_tone, professional_conduct, safety
Criteria failed: urgency, recent_changes, ticket_urgency

No red flags, no gates triggered.

earnedScore ≈ 38, maxPossibleScore = 44
rawScore = round(38/44 × 100) = 86

No gates triggered.
readiness = ready (86 >= 80)

Result: score 86, ready
```

### Example D: No Meaningful Troubleshooting

```
Candidate is polite but asks no questions, submits poor ticket.

Criteria passed: customer_tone, professional_conduct, customer_communication
Criteria failed: everything else

Red flags: no_troubleshooting

rawScore = 25
Gate: no_troubleshooting (major, cap 40)
finalScore = min(25, 40) = 25
readiness = not_ready

Result: score 25, not_ready, gate hit
```

---

## 8. Deterministic Guarantee

Same input always produces the same output:

```
Same transcript + same ticket + same criteria statuses + same red flags
    → Same rawScore, same gateHits, same finalScore, same readiness
```

This is enforced by:
- Hashing: `lib/mvp/analysis/hash.ts` creates a SHA-256 of all inputs
- Caching: if same hash exists as a completed run, returns cached result
- Versioning: every analysis run stores `rubric_version` and `prompt_version`
- Code-based scoring: no randomness, no AI influence on score

---

## 9. Where the AI Can and Cannot Influence

### AI Controls (Layer 1)
- Which criteria are marked pass/partial/fail
- Evidence quotes
- Red flag detection
- Ticket assessment

### AI Does NOT Control (Layer 2 + 3)
- The numeric score
- The readiness label
- Gate hits
- Score caps
- Whether a critical gate overrides normal scoring

### AI Can Write (Layer 3, score-locked)
- Summary text
- Strength descriptions
- Improvement suggestions
- Coaching advice

But the AI is told the score, readiness, and gate hits are fixed and it must not change them.

---

## 10. Rubric Versioning

Current rubric version: `callcallum-base-v0.4-analysis-hardening`

Every analysis run stores:
- `rubric_version` — which rubric definition was used
- `prompt_version` — which evidence extraction prompt was used
- `model` — which AI model ran the extraction
- `model_provider` — e.g. openrouter, mock
- `input_hash` — SHA-256 of all inputs

This ensures full reproducibility. If the rubric changes in the future, old analysis records remain valid and their scores are traceable to the rubric that was active at the time.

---

## 11. Test Fixtures

Seven test fixtures in `lib/mvp/analysis/__fixtures__/index.ts` verify the scoring engine:

| Fixture | Score | Readiness | Gates |
|---------|-------|-----------|-------|
| severe_abuse | ≤10 | not_ready | severe_customer_abuse |
| unsafe_security | ≤25 | not_ready | unsafe_security_behaviour |
| no_troubleshooting | ≤40 | not_ready | no_troubleshooting |
| good_imperfect | 65–90 | ready | none |
| perfect_call | 85–100 | ready | none |
| hallucinated_fix | ≤50 | not_ready | hallucinated_fix |
| no_ticket | 0 | not_ready | N/A (pre-analysis gate) |

Run them with:
```bash
node scripts/test-analysis-hardening.mjs
```

The reproducibility test verifies the same fixture always produces the same score.
