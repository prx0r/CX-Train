# Calibr8 — Manager Calibration & the Readiness Graph

The data moat is not the audio. It is manager-corrected judgement data about helpdesk readiness.

---

## The Flywheel

1. Candidate takes simulated helpdesk call
2. Callum scores transcript + ticket against known scenario truth
3. Candidate retries and improves
4. Manager reviews only high-signal attempts
5. Manager corrects Callum where it disagrees
6. System learns manager's judgement pattern
7. Common failure modes become new drills
8. More candidates train on those drills
9. Aggregated error data becomes benchmark / content / moat
10. MSPs join because the benchmark gets better

---

## Data Value Hierarchy

| Data type | Moat value |
|---|---|
| Raw audio/transcripts | Low/medium |
| Audio + ticket note | Medium |
| Audio + known scenario truth | High |
| Audio + ticket + AI score + manager override | Very high |
| Above + hiring/training outcome | Extremely high |
| Above + retry/improvement curve | Massive |

The real gold: **Manager-corrected judgement data about helpdesk readiness.**

RLHF is the idea that human judgements can train models toward human preferences. For us, the feedback is not generic "which answer is better?" It is:

> "Would this MSP manager trust this person with a real client call?"

That is a much more specific and valuable signal.

---

## What to Collect from Every Attempt

Do not just store transcript + score. Store a structured event record:

### 1. Scenario truth
- issue type
- hidden root cause
- urgency
- client persona
- required checks
- expected escalation
- forbidden actions
- security red flags
- ideal ticket note
- acceptable workaround

### 2. Candidate behaviour
- questions asked
- questions missed
- assumptions made
- unsafe advice
- escalation decision
- ticket classification
- note quality
- customer communication
- time to useful diagnosis
- whether they closed too early

### 3. AI judgement
- criterion score
- evidence snippets
- confidence
- uncertainty flags
- suspected hallucination / unsupported claim
- rubric version used

### 4. Manager judgement
- pass/fail
- criterion adjustments
- override reason
- severity
- "would interview"
- "would hire"
- "would let handle client"
- manager free-text note

### 5. Outcome later
- hired / not hired
- passed probation
- needed training
- real-ticket performance
- manager satisfaction
- improvement over retries

The last category is the nuclear moat. If you can eventually say:

> "Candidates who pass these three scenario types usually survive MSP onboarding better."

Then you have something much bigger.

---

## Manager Calibration Flywheel

### Step 1: Blind review

Manager reviews attempt before seeing Callum score. They rate:
- customer handling
- diagnosis
- ticket quality
- escalation
- security judgement
- overall readiness

Then reveal Callum's score. Show:

> "You scored this 12 points lower than Callum, mainly on escalation and ticket quality."

### Step 2: Override reason

Every manager correction asks one tiny question: "Why?" Options:
- AI missed security concern
- candidate was too vague
- wrong escalation
- ticket note not acceptable
- client tone was poor
- good judgement despite missed step
- our MSP has stricter standard
- scenario/rubric needs changing

This creates labelled disagreement data.

### Step 3: Manager DNA

After 20 reviews, generate:
- "Your MSP scores identity verification stricter than default."
- "You tolerate slower diagnosis if ticket notes are strong."
- "You prefer early escalation on security-related calls."
- "Your pass threshold is around 78, not 70."

Now the product feels personalised.

### Step 4: Calibrated scoring

Callum score becomes:

- Default Callum score: 74
- Your MSP calibrated score: 68
- Reason: your managers heavily penalise missing impact questions and weak escalation notes.

---

## The Golden Dataset

For each scenario, collect:
- 5 bad attempts
- 5 mediocre attempts
- 5 good attempts
- 5 weird/borderline attempts
- manager labels
- final agreed labels

Use it to test every scoring change. Before deploying a new scoring prompt/model, run:

> "Did the judge still score the golden examples correctly?"

This stops scoring drift. Standard LLM-eval thinking: modern evaluation workflows use golden datasets, judge calibration, regression testing, and production monitoring instead of trusting one-off model outputs.

---

## The Common-Error Corpus

This might become your public/content moat. Publish anonymised insights like:

> "The 12 most common mistakes entry-level IT support candidates make on simulated MSP calls."

Examples:
- asks "have you restarted?" before understanding business impact
- fails to confirm identity before reset/MFA discussion
- treats possible phishing as a normal email issue
- closes call without next step
- writes ticket notes that are useless to second line
- overpromises fix time
- does not ask whether issue affects one user or many
- fails to classify urgency/SLA
- misses emotional signal from customer
- escalates without evidence
- gives unsupported technical claims
- forgets to summarise back

That dataset becomes:
- content marketing
- better scenario generation
- benchmark reports
- training curriculum
- manager dashboard insights
- eventual model fine-tuning material

### Why this beats MSPs' own call data

An MSP may have 500 hours of calls. But they usually do not have:
- consistent rubrics
- scenario truth labels
- cross-candidate comparison
- retry curves
- manager disagreement labels
- failure taxonomy
- hiring outcome mapping
- safe anonymised benchmark data

Your advantage: your world is simulated and instrumented. Like the difference between "We have hours of football footage" and "We have labelled training drills showing exactly which skills predict match performance."

---

## Product Direction: CallCallum Readiness Graph

Every candidate/technician gets mapped across skills:

- impact discovery
- questioning sequence
- identity verification
- customer reassurance
- technical reasoning
- evidence capture
- ticket writing
- escalation judgement
- security suspicion
- AI-safe working
- prioritisation
- closure/next steps

Every attempt updates the graph. Every manager override calibrates the graph. Every failure cluster generates a drill.

---

## Calibration Tab in the Dashboard

A manager dashboard tab called **Calibration** shows:

1. **Agreement rate** — "Callum agrees with your manager reviews 82% of the time."
2. **High-disagreement criteria** — "Most disagreement: ticket quality, escalation judgement."
3. **Manager strictness** — "Your MSP scores 9% stricter than default."
4. **Suggested changes** — "Raise ticket-quality weight from 15% to 22%?"
5. **Golden examples** — "These 8 reviewed attempts define your current standard."
6. **Drift alerts** — "Your scoring standard changed this month — recent reviews are stricter on customer tone."

---

## Mystery Calls / Resilience Testing

Frame as **authorised service-desk resilience testing** — not "catch out employees." The MSP opts in, tells employees calls may be quality-tested, purpose is improvement, not punishment. (UK GDPR requires transparency, fairness, purpose limitation, and data minimisation for monitoring-like processing.)

Use cases:
- identity verification test
- MFA reset process test
- suspicious email test
- urgent VIP pressure test
- new starter access request test
- possible account compromise test
- "angry client" professionalism test

This becomes **helpdesk social-engineering resilience testing** — a real cyber angle. AI voice/vishing risk is growing. The principle: don't train people to "hear if it's AI." Train them to follow verification process even when the voice sounds real.

---

## The Strongest Flywheel Version

```
Candidate/practice users
  ↓
Lots of simulated support attempts
  ↓
Common error taxonomy emerges
  ↓
Managers review best/borderline attempts
  ↓
Manager calibration data improves scoring
  ↓
Better scoring creates better feedback
  ↓
Better feedback makes candidates retry
  ↓
Retry curves reveal which drills actually improve performance
  ↓
Those drills become scenario packs
  ↓
MSPs use packs for hiring/training/mystery-call testing
  ↓
More manager feedback + real outcome labels
  ↓
CallCallum becomes the benchmark for first-line helpdesk readiness
```

### Key compounding assets
- Failure taxonomy
- Manager judgement data
- Golden calibrated attempts
- Scenario difficulty ratings
- Retry improvement curves
- Outcome mapping
- MSP-specific scoring profiles

---

## What to Avoid

Do not fine-tune too early. The early moat is **data structure, not model weights.**

Build this first:
- consistent rubrics
- label schema
- manager override flow
- agreement metrics
- golden examples
- error taxonomy
- anonymisation pipeline
- scenario versioning

Fine-tuning comes only after you have thousands of reviewed attempts.

---

## Immediate Build Recommendation

### Tables / fields to add soon
- `rubric_versions`
- `criterion_labels`
- `attempt_events`
- `error_codes`
- `manager_reviews`
- `manager_overrides`
- `override_reasons`
- `calibration_profiles`
- `golden_attempts`
- `scenario_difficulty_stats`
- `retry_progressions`
- `outcome_labels`

### UI loops to add
- Blind manager review
- Override reason tagging
- Agreement dashboard
- Candidate retry graph
- Common error dashboard
- Generate drill from failure cluster

---

## The One-Line Thesis

> MSPs have call recordings. CallCallum has calibrated, labelled, comparable helpdesk judgement data.

That is the moat.

The product should become: **A manager-calibrated readiness engine for IT support calls.** Not just a sim. Not just scoring. Not a fake cert. A system that learns: *"What does good first-line support actually look like, according to real MSP managers?"*
