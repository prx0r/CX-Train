# Next Testing Steps & Roadmap

> **Current state:** Pipeline A with 10 frameworks, 80+ criteria, evidence-validated scoring.
> **Next phase:** Slider-based scoring, manager calibration, model distillation.

---

## Current Test Transcripts (5 edge cases)

We have 5 test transcripts covering key edge cases:

| ID | Transcript | What It Tests | Current Result |
|----|-----------|---------------|----------------|
| T1 | `gold-mfa-unsafe` | Excellent candidate — safe MFA handling | ✅ Raw 74, Validated 39, 37 verified |
| T2 | `tricky-perfect-but-abusive` | Perfect tech, abusive conduct | ✅ Raw 78, Validated 60, 41 verified, 2 red flags |
| T3 | `tricky-pii-over-phone` | Polite but leaks PII | ✅ Raw 44, Validated 18, 20 verified, 1 red flag |
| T4 | `tricky-passive-aggressive` | Subtle passive-aggressive conduct | ✅ Raw 73, Validated 50, 34 verified, unprofessional_conduct ✅ |
| T5 | `tricky-ambiguous-pii` | Asks DOB for ID, handles password via email | ✅ Raw 73, Validated 52, 30 verified |

---

## Phase 1: Fix Evidence Quality (Immediate)

The biggest remaining issue: the AI often returns empty evidence quotes, making the validated score much lower than raw.

### Testing Steps

- [ ] **1.1 Test evidence quote enforcement** — Run gold-mfa-unsafe through a prompt that strictly requires evidence quotes. Compare quote completeness vs current. Target: >80% of pass/fail criteria have verbatim quotes.
- [ ] **1.2 Test maxTokens adequacy** — Run with 16384 maxTokens. Check if truncation causes missing quotes. Current 8192 is too low for 56 criteria.
- [ ] **1.3 Test reduced criteria set** — Split into two extraction calls (core 16 Callum criteria + framework-specific 40). Compare quote quality vs single 56-criteria call.
- [ ] **1.4 Test all 5 transcripts** — After prompt fix, re-run all 5. Verify: red flags detected, evidence quotes present, validated/raw gap reasonable (<30% gap).
- [ ] **1.5 Test invalidation logic** — Verify: fundamental criteria (started_when, scope, impact) never invalidated. Security-only criteria (malware, secure config) properly invalidated on password-reset calls.
- [ ] **1.6 Test event_check criteria** — Wire real event data into evidence pool. Verify: submitted_ticket = 1 if event exists, 0 if not. Not "not_observed."

### Pass Criteria

| Metric | Current | Target |
|--------|---------|--------|
| AI evidence quotes per transcript | ~30% of criteria | >80% of pass/fail criteria |
| Validated/raw gap | ~40-50% | <30% |
| Red flag detection | 100% on overt, 100% on passive | 100% on all |
| False invalidation | 0 (fixed in FUNDAMENTAL_CRITERIA) | 0 |
| Evidence quality ratio | 53-83% | >70% |

---

## Phase 2: Slider-Based Scoring (Next)

### Why Sliders Instead of Binary

Binary 1/0 per criterion loses nuance. A candidate can be mostly correct but miss a minor detail — binary scoring treats that as a full fail.

**Slider approach:**

```
Identity Check:
  0 ←——————————————————————————→ 10
  Didn't ask at all           Asked name, company,
                              employee ID, verified
                              against system

Customer Tone:
  0 ←——————————————————————————→ 10
  Swore at customer           Perfect tone, empathetic,
                              used name, patient
```

Sliders give:
- **Granularity** — partial credit for partial performance
- **Manager calibration** — every slider position becomes a data point for the manager's LoRA
- **Confidence weighting** — AI outputs a score AND a confidence. Low confidence = slider defaults toward 5.
- **Training signal** — slider positions are continuous labels for model training (regression, not classification)

### Implementation Plan

- [ ] **2.1 Define slider ranges** — Each criterion gets a 0-10 slider with anchor descriptions at 0, 5, and 10
- [ ] **2.2 Build slider UI** — Drag handle per criterion, shows current value, shows evidence quote alongside
- [ ] **2.3 AI outputs slider values** — Change extraction prompt from "pass/partial/fail" to a 0-10 score with evidence quote
- [ ] **2.4 Framework scoring adapts** — Framework score = average of slider values × 10, not binary percentage
- [ ] **2.5 Test slider consistency** — Same transcript scored 3 times by same model. Variance should be <1 point.
- [ ] **2.6 Display slider results** — Show slider positions per criterion, colour-coded: red (0-3), yellow (4-6), green (7-10)

### Slider Anchor Examples

```typescript
const sliderAnchors = {
  identity_check: {
    0: 'Did not ask for any identifying information',
    5: 'Asked for name, proceeded without additional verification',
    10: 'Asked for name, company, employee ID, verified against system before proceeding',
  },
  customer_tone: {
    0: 'Swore at, insulted, or mocked the customer',
    5: 'Neutral tone — neither warm nor cold, functional',
    10: 'Professional, empathetic, used customer name, patient, adapted tone to situation',
  },
  technical_discovery: {
    0: 'Performed no investigation — jumped to solution or escalated immediately',
    5: 'Checked one or two basic things before deciding on action',
    10: 'Systematic investigation: checked status, isolated cause, tested hypothesis, confirmed fix',
  },
};
```

---

## Phase 3: Manager Calibration (Medium-term)

### How It Works

1. Manager opens a completed assessment
2. See AI's slider positions for every criterion
3. Manager adjusts any slider they disagree with
4. System records the delta (AI score vs manager score)
5. After ~50 adjustments, a LoRA adapter is trained that shifts the model toward this manager
6. Manager's profile shows their calibration stats

### Testing Steps

- [ ] **3.1 Build calibration UI** — AI sliders + manager override sliders side by side
- [ ] **3.2 Record deltas** — Store each adjustment as training data
- [ ] **3.3 Simulate calibration** — Create a mock manager profile with known preferences. Generate 100 synthetic adjustments. Train LoRA. Verify: post-training scores match mock preferences better than pre-training.
- [ ] **3.4 Test profile portability** — Export LoRA adapter, load on different base model. Verify inference still works.
- [ ] **3.5 Test staged training** — Phase 1: random sampling. Phase 2: high-variance prioritisation. Phase 3: edge cases. Measure: how many adjustments needed to reach 90% agreement.

### Manager Profile Output

```json
{
  "managerId": "manager-alex",
  "calibrationSessions": 47,
  "totalAdjustments": 312,
  "attunement": 0.78,
  "emphasis": {
    "tone": { "direction": "stricter", "delta": 1.5 },
    "documentation": { "direction": "more lenient", "delta": -0.8 },
    "security": { "direction": "aligned", "delta": 0.1 }
  },
  "blindSpots": [
    "Scope questions: rates passing 70% when not asked",
    "Verification: rarely checks for resolution confirmation"
  ]
}
```

---

## Phase 4: Model Distillation (Long-term)

### Path to Local Inference

| Stage | Model | Cost/Assessment | Latency | Data Needed |
|-------|-------|----------------|---------|-------------|
| Current | deepseek-v4-flash | ~$0.0012 | 30-60s | 0 |
| Stage 1 | Qwen 0.5B (prompt) | ~$0.0001 | 200-500ms | 0 |
| Stage 2 | Qwen 0.5B (fine-tuned) | ~$0.00001 | 50-200ms | 1,000+ labelled |
| Stage 3 | Qwen 1.5B (fine-tuned) | ~$0.00002 | 100-300ms | 5,000+ labelled |
| Stage 4 | Qwen 2.5-VL 7B (multi-modal) | ~$0.00005 | 500-2000ms | 10,000+ labelled calls + screen recordings |

### Testing Steps

- [ ] **4.1 Collect labelled data** — Every assessment run with slider positions becomes a training example
- [ ] **4.2 Train Qwen 0.5B** — Use LoRA on 1K examples. Evaluate against held-out test set.
- [ ] **4.3 Compare vs prompt AI** — Run same 5 transcripts through both. Measure per-criterion agreement. Goal: >90%.
- [ ] **4.4 Deploy in parallel** — Run both models. Show both scores. Flag disagreements for human review.
- [ ] **4.5 Replace prompt AI** — When agreement >90% sustained for 1K consecutive assessments, swap.

---

## The End State

```
Manager sets up calibration:
  → Scores 50-100 transcripts with sliders
  → LoRA adapter trained to their preferences
  
Candidate takes assessment:
  → Local Qwen 0.5B scores criteria (50-200ms, $0.00001)
  → Frameworks compute category + total scores
  → Manager reviews delta between AI and their calibrated profile
  → If delta small → auto-approved. If large → manager reviews specific criteria.

Continuous improvement:
  → Every manager adjustment trains the model
  → Model converges toward each manager's standards
  → New managers start from base model, calibrate over time
  → Manager profiles are portable (export LoRA, take to new employer)
```

No API calls. No prompt engineering. No external dependencies. Just local inference + manager-specific calibration.
