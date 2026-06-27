# Scoring Specification v2 — Callum Assessment Framework

> Two-layer scoring model with a deterministic core (Callum Rating) and a manager-augmented overlay (Callum For You).
> Designed to produce defensible, auditable scores for IT MSP first-line support candidates.

---

## 1. Architecture Overview

```
                 ┌─────────────────────────────────────┐
                 │         CORE DATA INPUTS            │
                 │  Transcript · Ticket · Actions ·    │
                 │  Timeline · Sim Events · Taxonomy   │
                 └──────────────┬──────────────────────┘
                                │
           ┌────────────────────┼────────────────────┐
           ▼                    ▼                    ▼
   ┌───────────────┐   ┌───────────────┐   ┌────────────────┐
   │  Deterministic │   │  AI Evidence   │   │  AI Narrative  │
   │   Binary Check │   │   Extraction   │   │   Generation   │
   │  (22 criteria) │   │  (22 criteria) │   │  (verdict line, │
   │  from sim data │   │  from AI model │   │   strengths,    │
   └───────┬───────┘   └───────┬───────┘   │   coaching)     │
           │                   │           └───────┬────────┘
           │    ┌──────────────┴──────────┐        │
           └───►│     UNIFY + SCORE        │◄───────┘
                │  (deterministic wins on  │
                │   conflicts; AI on       │
                │   communication nuance)  │
                └────────────┬────────────┘
                             │
                ┌────────────▼───────────────┐
                │      CALLUM RATING         │
                │   Score + Verdict          │
                │   Immutable, unchanging    │
                └────────────┬──────────────┘
                             │
                ┌────────────▼───────────────┐
                │    MANAGER OVERLAY FILTER  │
                │   Weight adjustments       │
                │   Custom criteria          │
                │   Category emphasis        │
                └────────────┬──────────────┘
                             │
                ┌────────────▼───────────────┐
                │   CALLUM FOR YOU RATING    │
                │   Manager-custom score     │
                │   Displayed alongside      │
                │   original Callum Rating   │
                └───────────────────────────┘
```

---

## 2. The Two Ratings

### 2.1 Callum Rating (Baseline)

The **Callum Rating** is the standardised, unchanging assessment produced by the system. Every candidate, every MSP, every manager gets the same Callum Rating for the same performance. It is the "golden source" that enables:

- Fair comparison across candidates
- Cross-MSP benchmarking
- Percentile rankings ("top 15% of all candidates")
- Proprietary data labeling at scale
- Audit trails (every point is traceable to evidence)

The Callum Rating **never changes** after an assessment is submitted. It is a frozen snapshot of the candidate's performance against the standard rubric.

### 2.2 Callum For You Rating (Manager-Adjusted)

The **Callum For You** rating is computed by applying a manager's scoring preferences as an overlay on top of the Callum Rating. Each manager configures:

- **Category weights** — "I care about ticket quality 2x more than standard"
- **Critical criteria** — "At my MSP, confirming the device hostname is mandatory"
- **Custom criteria** — "We require candidates to check our internal KB before escalating"
- **Severity tolerance** — "P3 tickets don't need urgency questions, P1/P2 do"
- **Pass/fail thresholds** — "I set my pass line at 65, not 60"

Both ratings are shown side by side:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   Callum Rating                Callum For You        │
│   ══════════════               ═══════════════       │
│   PASS · 78/100                PASS · 84/100         │
│   "Solid diagnosis. Ticket      "Great call handling. │
│    could be more detailed."      Your KB usage stands │
│                                   out for us."         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 2.3 Why Two Ratings

| Scenario | Callum Rating | Callum For You |
|----------|--------------|----------------|
| MedTech MSP cares about PHI (protected health info) compliance | Standard safety criteria are enough | MedTech adds "confirmed no PHI visible" as a critical check. Score drops from 85 to 65. |
| QuickFix MSP cares about first-call resolution above all | Standard resolution criteria apply | QuickFix weights resolution at 2x. Score rises from 72 to 80. |
| A candidate applies to 3 MSPs | Same Callum Rating at all 3 | Each MSP sees their own adjusted rating based on their standards |

The Callum Rating is the **candidate's truth**. The Callum For You is the **manager's truth**. Both matter. The candidate uses Callum Rating to benchmark themselves against peers. The manager uses Callum For You to hire for their specific needs.

---

## 3. Deterministic Scoring Engine

The core scoring engine is deterministic — no AI in the number. AI provides the **evidence** (what happened in the transcript/ticket), and deterministic code computes the **score** (what that means).

### 3.1 Criteria Hierarchy

```
┌──────────────────────────────────────────────────────────┐
│                    CRITICAL (4 pts)                       │
│  Must pass. If any fail → auto-FAIL.                     │
│  submitted_ticket · performed_triage · safety · next_steps│
├──────────────────────────────────────────────────────────┤
│                    CORE (18 pts)                          │
│  Binary. Each criterion = 1pt. Yes or no.                │
│  identity · company · issue · impact · urgency · scope   │
│  error_capture · recent_changes · technical_discovery    │
│  escalation · tone · conduct · communication             │
│  ticket_user · ticket_summary · ticket_impact ·          │
│  ticket_urgency · ticket_checks · ticket_nextstep        │
├──────────────────────────────────────────────────────────┤
│                    BONUS (up to +10 pts)                  │
│  AI-evaluated quality. Not binary.                       │
│  empathy · proactiveness · clarity · anticipation        │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Score Formula

```
coreEarned   = number of core criteria with status "pass" (partial = 0.5, fail = 0)
bonus        = AI exceptional service score (0–10)
totalCore    = 18

rawScore = ((coreEarned + bonus) / totalCore) × 100
finalScore = min(100, max(0, rawScore))
```

**Example calculations:**

| Scenario | Core | Bonus | Raw | Final |
|----------|------|-------|-----|-------|
| Perfect with exceptional service | 18/18 | +10 | 156 | 100 |
| Perfect, no bonus | 18/18 | 0 | 100 | 100 |
| Solid pass | 14/18 | +3 | 94 | 94 |
| Borderline pass | 11/18 | 0 | 61 | 61 |
| Fail (missing fundamentals) | 15/18 | +5 | 111 | 60 (capped) |
| Critical fail | 8/18 | 0 | 44 | 44 → FAIL |

### 3.3 Verdict

| Condition | Verdict |
|-----------|---------|
| finalScore ≥ 60 AND all critical criteria passed AND no fail gates triggered | **PASS** |
| finalScore < 60 OR any critical criterion failed OR a fail gate triggered | **FAIL** |

### 3.4 Fail Gates (Behaviours That Override Score)

These are specific, observable behaviours that the AI extracts as `red_flags`. Each maps to a fail gate:

| Red Flag | Effect on Verdict |
|----------|-------------------|
| `severe_customer_abuse` | Auto-FAIL, score = 0 |
| `unsafe_security_behaviour` | Auto-FAIL, score = 0 |
| `refusal_to_help` | Auto-FAIL, score capped at 20 |
| `hallucinated_fix` | Auto-FAIL, score capped at 50 |
| `invented_fix_without_evidence` | Score capped at 50 |
| `no_troubleshooting` | Score capped at 40 |
| `unsupported_ticket_claims` | Score capped at 70 |

### 3.5 Evidence Traceability

Every criterion in the score has an entry in the `evidence_extraction` output:

```json
{
  "identity_check": {
    "status": "pass",
    "evidence": [
      "Candidate: Can I confirm your name?",
      "Caller: It's Sarah Thompson."
    ],
    "deterministic_source": "sim_event.taxonomy_tags.include('communication.user_confirmation')"
  }
}
```

The `deterministic_source` field explains **exactly why** this criterion passed or failed. This makes every score auditable — a manager can trace any point back to the specific action, tag, or transcript quote that produced it.

---

## 4. The Manager Overlay Filter

### 4.1 Overlay Configuration

Managers define their overrides in `manager_standards.scoring_overrides_json`. This is **separate from** the pack/assessment configuration — it belongs to the manager's profile, not the pack.

```typescript
interface ManagerScoringOverlay {
  /* Category weight multipliers. 1.0 = standard weight. */
  categoryEmphasis: {
    call_control?: number;      // default: 1.0
    diagnosis?: number;         // default: 1.0
    resolution?: number;        // default: 1.0
    ticket_quality?: number;    // default: 1.0
    professionalism?: number;   // default: 1.0
  };

  /* Elevate criteria to critical (auto-fail if missed) */
  criticalOverrides: string[];

  /* Downgrade criteria (remove from scoring entirely) */
  disabledCriteria: string[];

  /* Custom criteria the manager wants checked */
  customCriteria: Array<{
    id: string;
    label: string;
    category: string;
    critical: boolean;
    description: string;
    /* HITL: over time these get AI-trained labels */
  }>;

  /* Threshold adjustments */
  thresholds: {
    passLine: number;    // default: 60
  };

  /* What this manager values most (shown in UI) */
  managerPriorities: {
    label: string;       // e.g. "First-call resolution"
    description: string; // e.g. "We prioritise solving on first contact"
    affectedCategories: string[];
  }[];
}
```

### 4.2 How the Overlay Is Applied

The overlay is a **transformation function** on the Callum Rating:

```
Callum For You = applyOverlay(Callum Rating, Manager Overlay)
```

The transformation:
1. Apply category emphasis multipliers to criteria weights
2. Add critical checks from `criticalOverrides`
3. Remove criteria from `disabledCriteria`
4. Add `customCriteria` and mark them as `evidence_source: 'unscored'` until manager labels training data
5. Apply custom pass/fail threshold
6. Recompute score and verdict

### 4.3 Manager Priorities Display

Each manager's overlay includes `managerPriorities` — a set of sentences explaining what this manager values. These are displayed to candidates before they take the assessment and to managers in the review UI:

```
Manager: Sarah (MedTech Service Desk Manager)
Priorities:
  - Patient safety first — confirm no PHI is visible before remoting
  - Full documentation — every field must be completed
  - First-call resolution is secondary to safety
```

---

## 5. The Data Moat — Proprietary Learning Engine

### 5.1 How Data Flows

```
Candidate takes exam
       │
       ▼
Callum Rating produced (18 binary + AI bonus)
       │
       ▼
Data stored: assessment_results
  ├── raw_model_json (full evidence extraction)
  ├── overall_score (Callum Rating)
  ├── criteria_breakdown_json (per-criterion)
  └── category_scores_json (per-category)
       │
       ▼
Manager reviews → submits feedback
       │
       ▼
manager_feedback table:
  ├── manager_label (PASS / FAIL)
  ├── manager_score (0-100)
  ├── notes (qualitative feedback)
  └── manager_criterion_feedback (per-criterion)
       │
       ▼
Labeled data accumulates → trains Global Callum
```

### 5.2 Manager Feedback Loop (HITL)

When a manager reviews an assessment, they can:

1. **Override the Callum verdict** — "I disagree, this candidate should PASS"
2. **Adjust individual criteria** — "I think identity_check should be 'pass', not 'fail'"
3. **Provide qualitative notes** — "Candidate showed great patience with a difficult customer"
4. **Add custom observations** — "Candidate asked about the spooler — not in the rubric but exactly right for this ticket type"

This feedback is stored with the assessment and becomes training data for:

### 5.3 Global Callum (Cross-MSP Intelligence)

```
┌─────────────────────────────────────────────────────┐
│                 GLOBAL CALLUM                        │
│                                                     │
│  Aggregated feedback from ALL managers               │
│  across ALL MSPs, anonymised by org.                 │
│                                                     │
│  Learns:                                             │
│  1. Which criteria predict real-world performance    │
│  2. What weighting produces best accuracy            │
│  3. New custom criteria managers keep adding         │
│  4. Management style clusters                        │
│                                                     │
│  Outputs:                                            │
│  - Improved default weights over time                │
│  - Recommended custom criteria for new managers      │
│  - Management style taxonomy                         │
│  - Predictive performance models                     │
└─────────────────────────────────────────────────────┘
```

### 5.4 Percentile Rankings

Once sufficient data is collected:

```
Candidate: James Wilson
Callum Rating: 78/100 · PASS
├── Percentile: Top 27% of all candidates
├── Percentile (Password Reset): Top 15%
├── Percentile (First-Line): Top 32%
├── Strongest: Diagnosis (94th percentile)
└── Weakest: Ticket Quality (41st percentile)
```

This becomes a product feature: "Scored in the top 15% of all candidates for password reset handling."

### 5.5 Management Style Clusters

As managers provide feedback, their preferences form clusters:

```
Management Style: "Documentation-First"
├── 34% of MSP managers are in this cluster
├── Priorities: ticket_quality > call_control > diagnosis
├── Typical pass threshold: 65
├── Most overridden criteria: next_steps, ticket_impact
└── Your style: "Your emphasis on documentation matches
                 this cluster more than 82% of managers."

Management Style: "Customer-Experience"
├── 28% of MSP managers
├── Priorities: call_control > professionalism > resolution
├── Typical pass threshold: 60
└── Most overridden criteria: customer_tone, empathy
```

### 5.6 Manager-to-Manager Intelligence

```
┌─────────────────────────────────────────────────────────┐
│ YOUR MANAGEMENT STYLE                                   │
│                                                         │
│ You weight diagnosis 1.7x more than the average         │
│ MSP manager. You disabled the "started_when" criterion  │
│ and added "checked_spooler" as a custom check.          │
│                                                         │
│ Candidates who score well in your adjusted scoring      │
│ tend to be strong in:                                   │
│   * Technical discovery (r=0.72 with your hiring)       │
│   * Error isolation (r=0.68)                            │
│                                                         │
│ Your hires have a 12-week retention rate 8% above       │
│ the average for your management style cluster.          │
├─────────────────────────────────────────────────────────┤
│ GLOBAL INSIGHT                                          │
│                                                         │
│ Managers who value "ticket_quality" most heavily        │
│ have 23% lower escalation rates in their first-line      │
│ teams. Your team's escalation rate is 11%.              │
└─────────────────────────────────────────────────────────┘
```

---

## 6. Comprehensive Criteria (18 Core + 4 Critical + Bonus)

### 6.1 Call Control & Communication (4 core criteria)

| ID | Criterion | What "pass" looks like |
|----|-----------|----------------------|
| `identity_check` | Confirmed caller identity | Asked "Can I confirm your name?" or used caller's name before proceeding |
| `company_check` | Confirmed company/client | Asked company name or referenced it from ticket details |
| `customer_tone` | Professional, respectful tone | No dismissive language. No interruptions. Matched customer's pace. |
| `customer_communication` | Clear communication throughout | Customer never asked "what do you mean?" or "can you repeat that?" |

### 6.2 Diagnosis & Investigation (7 core criteria)

| ID | Criterion | What "pass" looks like |
|----|-----------|----------------------|
| `issue_clarification` | Clarified the exact issue | Restated the problem in their own words. Got confirmation from customer. |
| `started_when` | Asked when it started | "When did this start happening?" — captured timeline |
| `impact` | Asked business impact | "What work is blocked by this?" or "How is this affecting you?" |
| `urgency` | Asked urgency/deadline | "Do you have a deadline?" or "How soon do you need this?" |
| `scope` | Asked scope (one user or many) | "Is anyone else having this issue?" |
| `error_or_status_capture` | Captured error/status details | Asked "what does the error say?" or found status themselves via tools |
| `recent_changes` | Asked about recent changes | "Did anything change recently? Software updates? New hardware?" |

### 6.3 Resolution & Escalation (3 core criteria)

| ID | Criterion | What "pass" looks like |
|----|-----------|----------------------|
| `technical_discovery` | Performed technical investigation | Used tools, ran checks, applied structured troubleshooting (not guessing) |
| `customer_communication` | Kept customer informed | Explained what they were doing and why. Customer knew the plan. |
| `escalation_judgement` | Made appropriate escalation decisions | Escalated when necessary. Did not escalate prematurely. |

### 6.4 Ticket Quality (6 core criteria)

| ID | Criterion | What "pass" looks like |
|----|-----------|----------------------|
| `ticket_user_company` | User + company in ticket | Ticket has requester name and company |
| `ticket_issue_summary` | Clear issue summary | One-liner that tells the story: "Outlook stuck in Work Offline mode" |
| `ticket_impact` | Business impact noted | "Unable to send client invoices before 2pm deadline" |
| `ticket_urgency` | Urgency recorded | Priority level set (P1-P4) with justification |
| `ticket_checks_attempted` | List of checks done | "Checked Outlook status, verified webmail works, ping to Exchange OK" |
| `ticket_next_step` | Next step documented | "Awaiting profile rebuild. Customer to test in 30 mins." |

### 6.5 Critical Criteria (4 criteria — must pass)

| ID | Criterion | Why it's critical |
|----|-----------|-------------------|
| `submitted_ticket` | A ticket was submitted | Without a ticket, there is no record of the work. The ticket is the output artifact. |
| `performed_triage` | Ticket was triaged/classified | Triage shows the candidate understood what type of issue this was. |
| `safety` | No unsafe actions | Safety is non-negotiable in IT support. No destructive actions without evidence. |
| `next_steps` | Customer knows what happens next | Leaving a customer without next steps is abandonment. |

### 6.6 Exceptional Service Bonus (AI-evaluated, 0-10 pts)

| Dimension | Max | Scoring Guide |
|-----------|-----|---------------|
| **Empathy** | 3 | 0=absent, 1=basic ("I understand"), 2=genuine ("That must be stressful with the deadline"), 3=transformative (customer mood visibly shifted from frustrated to reassured) |
| **Proactiveness** | 3 | 0=reactive only, 1=anticipated one need, 2=anticipated multiple needs, 3=set up the customer for future success (prevention, not just cure) |
| **Clarity** | 2 | 0=confusing/jargon, 1=clear but technical, 2=plain language perfectly matched to customer's technical level |
| **Anticipation** | 2 | 0=didn't look ahead, 1=mentioned one follow-up, 2=identified potential downstream issues and escalated or documented |

---

## 7. AI Integration Points

### 7.1 Evidence Extraction (AI reads transcript, outputs structured data)

The AI is prompted to extract:

```json
{
  "criteria": {
    "identity_check": {
      "status": "pass",
      "evidence": ["Agent: 'Can I confirm your name?'", "Caller: 'It's Sarah.'"],
      "agent_quote": "Can I confirm your name?"
    }
  },
  "red_flags": [
    { "type": "hallucinated_fix", "severity": "major", "evidence": "Agent: 'I think your hard drive is failing, you should replace it.'" }
  ],
  "exceptional_service": {
    "empathy": 2,
    "proactiveness": 1,
    "clarity": 2,
    "anticipation": 0
  },
  "ticket_assessment": {
    "status": "pass",
    "missing_fields": [],
    "evidence": "Ticket contains user, company, issue, impact, checks, and next steps."
  }
}
```

### 7.2 Narrative Generation (AI writes qualitative feedback)

The AI is prompted to produce:

```json
{
  "summary": "Solid call handling with good diagnosis. The candidate correctly identified the Work Offline issue and verified the fix. The ticket covers all required fields but could include more detail on the checks performed.",
  "strengths": [
    "Correct technical diagnosis — identified Outlook Work Offline mode",
    "Verified the fix with a test email",
    "Professional, patient tone throughout"
  ],
  "improvements": [
    "Did not ask about business impact before starting the fix",
    "Did not check webmail to isolate the issue",
    "Ticket could be more specific about each check performed"
  ],
  "most_costly_miss": "Not asking about business impact — the customer had a 30-minute deadline for client invoices",
  "ticket_feedback": "Good structure but misses impact context. Include: 'Customer unable to send client invoices due before 2pm client meeting.'",
  "management_style_fit": { ... }
}
```

### 7.3 Key Deterministic Overrides

The engine always prefers **deterministic evidence** over AI extraction when available. For sim packs, the sim events are the ground truth:

| Criterion | Deterministic Source | AI Fallback |
|-----------|---------------------|-------------|
| `identity_check` | `session_events.taxonomy_tags.includes('communication.user_confirmation')` | AI reads transcript |
| `submitted_ticket` | `tickets` table has a row for this session | N/A |
| `performed_triage` | `session_events.event_type === 'ticket_triage_submitted'` | N/A |
| `next_steps` | `session_events.taxonomy_tags.includes('ticket.next_step_set')` | AI reads transcript |
| `safety` | `session_events.red_flag === null` | AI reads transcript |

---

## 8. Verdict Line Specification

The verdict line is the single most important piece of feedback. It must be:

1. **First 5 words** — Say the verdict and score
2. **Next 10-15 words** — Say WHY (specific actions or omissions)
3. **Professional tone** — Respectful, direct, no fluff

### 8.1 Verdict Line Templates

**PASS templates:**
```
PASS 85/100 — Correct diagnosis and verified fix. Ticket is complete with next steps.
PASS 62/100 — Met the minimum. Good tone, but diagnosis was shallow and ticket lacks detail.
PASS 94/100 — Exceptional call control and thorough investigation. Set up for first-call resolution.
PASS 78/100 — Strong technical skills. Work on asking about business impact and documenting urgency.
```

**FAIL templates:**
```
FAIL 55/100 — No ticket submitted. A ticket is required for every engagement.
FAIL 42/100 — Failed to triage. Customer left without next steps — critical failure.
FAIL 28/100 — Invented a fix without evidence. No troubleshooting performed.
FAIL 58/100 — Just below passing. Missing: scope, impact, urgency questions. Ticket is thin.
```

### 8.2 Verdict Line Rules

- Always start with `PASS` or `FAIL` followed by `score/100`
- Always end with a period
- Be specific — name the action or omission, don't say "needs improvement"
- If fail due to critical criteria, state which one
- If fail due to score threshold, state what the highest-impact misses were
- Never use words like "might", "could", "maybe" — be definitive

---

## 9. Database Schema Extensions

```sql
-- Existing manager_feedback table gets expanded
ALTER TABLE manager_feedback ADD COLUMN manager_verdict TEXT;  -- 'PASS' | 'FAIL'
ALTER TABLE manager_feedback ADD COLUMN manager_score INTEGER;  -- 0-100
ALTER TABLE manager_feedback ADD COLUMN manager_notes TEXT;
ALTER TABLE manager_feedback ADD COLUMN scoring_overlay_snapshot_json TEXT;  -- frozen overlay at review time

-- Manager criterion-level feedback
CREATE TABLE IF NOT EXISTS manager_criterion_feedback (
  id TEXT PRIMARY KEY,
  feedback_id TEXT NOT NULL,
  criterion_id TEXT NOT NULL,
  original_status TEXT NOT NULL,     -- AI/deterministic status
  manager_status TEXT NOT NULL,      -- manager's override
  original_score REAL NOT NULL DEFAULT 0,
  manager_score REAL NOT NULL DEFAULT 0,
  manager_comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Management style profile (auto-computed from feedback history)
CREATE TABLE IF NOT EXISTS manager_style_profiles (
  manager_id TEXT PRIMARY KEY,
  style_cluster TEXT,
  category_emphasis_json TEXT,        -- computed from overlay history
  avg_pass_threshold REAL,
  criteria_override_frequency_json TEXT,
  comparison_percentiles_json TEXT,   -- vs other managers
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Global benchmarks (computed periodically, not per-assessment)
CREATE TABLE IF NOT EXISTS global_benchmarks (
  id TEXT PRIMARY KEY,
  metric_name TEXT NOT NULL,          -- e.g. 'avg_callum_score'
  metric_value REAL NOT NULL,
  filter_json TEXT,                   -- e.g. '{"pack_id": "pack-password-reset-v1", "level": 1}'
  sample_size INTEGER NOT NULL,
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Manager scoring overlays (persistent, separate from standards snapshot)
ALTER TABLE manager_standards ADD COLUMN scoring_overlay_json TEXT;

-- Assessment results gains manager-adjusted rating
ALTER TABLE assessment_results ADD COLUMN callum_for_you_score INTEGER;
ALTER TABLE assessment_results ADD COLUMN callum_for_you_verdict TEXT;
ALTER TABLE assessment_results ADD COLUMN callum_for_you_json TEXT;
```

---

## 10. Implementation Phases

### Phase A — Core Scoring (now)
- [x] 18 core binary criteria + 4 critical + bonus
- [x] Deterministic engine with AI evidence extraction
- [x] PASS/FAIL verdict with verdict line
- [x] Category breakdown in results UI
- [x] `scoringspec.md` (this document)

### Phase B — Manager Overlay (next)
- [ ] `scoring_overlay_json` column + CRUD for manager settings
- [ ] `applyOverlay()` function to compute Callum For You
- [ ] UI: side-by-side display of both ratings
- [ ] UI: manager configuration panel for overlay

### Phase C — Manager Feedback (next)
- [ ] Per-criterion manager override UI
- [ ] `manager_criterion_feedback` table population
- [ ] Aggregate feedback → training data

### Phase D — Global Callum (future)
- [ ] `global_benchmarks` table + periodic recomputation
- [ ] Percentile rankings for candidates
- [ ] Management style cluster analysis
- [ ] Predictive models for hiring outcomes

### Phase E — Proprietary Data Moat (future)
- [ ] Labeled dataset export for model fine-tuning
- [ ] Custom criteria auto-detection (from manager patterns)
- [ ] Manager-to-manager intelligence dashboard
- [ ] API for MSPs to query their own benchmarks

---

## 11. What Makes This Defensible

### 11.1 Audit Trail
Every point is traceable to:
1. A specific criterion in the rubric
2. Evidence from the transcript (AI-extracted) or sim events (deterministic)
3. The deterministic engine that computed the score
4. The manager's overlay configuration (for Callum For You)

A manager can click any criterion and see the exact conversation quote that produced the score.

### 11.2 Fairness
- The **Callum Rating** is the same for every candidate. No manager bias enters the baseline.
- The **Callum For You** is transparent — the manager's adjustments are visible and configurable.
- **Deterministic scoring** ensures reproducibility. Same assessment → same score, every time.

### 11.3 Scalability
- The system works for 1 candidate or 10,000 candidates.
- Manager overlays can be inherited ("use the standard MedTech overlay") or custom.
- New packs plug into the same scoring engine — no reconfiguration required.

### 11.4 Professional Credibility
- Based on ITIL 4/5 service desk practices (incident management, service request, knowledge management)
- Aligned with HDI quality assurance frameworks (call monitoring, ticket quality)
- Maps to real MSP KPIs: first-call resolution rate, ticket quality score, customer satisfaction
- Evidence-based — never says "the AI thinks..." — says "the transcript shows..."

---

## 12. What NOT to Do

| Don't | Why |
|-------|-----|
| Use readiness labels (ready/needs_supervision/not_ready) | HR doesn't need a tiered label. They need a PASS/FAIL decision with the score as context. |
| Let AI compute the score | AI is non-deterministic. The score must be reproducible and auditable. AI provides evidence, code computes the score. |
| Mix manager feedback into the baseline | The Callum Rating is the golden source. Manager feedback augments, not replaces. |
| Ship without an audit trail | Every score must be explainable. "The AI said 72" is not acceptable. |
| Use different scoring per pack | The scoring engine is pack-agnostic. Packs define what actions exist; the engine scores what was done. |
| Build the Global Callum before Manager Overlay | Managers need the overlay first — it's the product. Global Callum is the data moat that comes from accumulation. |

---

## 13. Taxonomy-Aware Criterion Resolution

### 13.1 The Problem

Managers upload their own Master Triage Classification (XLSX via `taxonomy_items` table). This taxonomy defines their service desk structure: board names, ticket types, subcategories, items, required playbook questions, escalation guidance.

Two managers might use completely different taxonomies for the same ticket type:

```
Manager A (MedTech):          Manager B (LegalTech):
Type: Support Request         Type: Incident Management
├── Access & Identity          ├── Access Management
│   ├── Password Reset         │   ├── Password Reset
│   │   └── Playbook:          │   │   └── Playbook:
│   │     ✓ Confirm employee ID│   │     ✓ Verify via personal email
│   │     ✓ Check lockout      │   │     ✓ Set temporary password
│   │     ✓ Reset via admin    │   │     ✓ Log in admin console
│   │     ✗ MFA re-sync        │   │     ✗ Biometric re-auth
│   └── MFA Issues              │   └── MFA Reconfiguration
└── Hardware                     └── Software Issues
```

Both are "password reset" tickets, but the playbook steps and required checks are different. The scoring system must adapt.

### 13.2 The Resolution Engine

Instead of hardcoding criteria to taxonomy items, we introduce a **Criterion Resolver** that maps between three domains:

```
                    ┌──────────────────────────────┐
                    │    STANDARD RUBRIC (18 core)  │
                    │    identity_check             │
                    │    company_check              │
                    │    issue_clarification        │
                    │    safety                     │
                    │    ...14 more                  │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │   TAXONOMY FIELD MAPPER       │
                    │                               │
                    │   Maps taxonomy fields →      │
                    │   standard rubric criteria    │
                    │                               │
                    │   "confirm_employee_id" →     │
                    │     already covered by        │
                    │     identity_check            │
                    │                               │
                    │   "biometric_re-auth" →       │
                    │     no match → new criterion  │
                    │     added to manager overlay  │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │    MERGED CRITERION SET       │
                    │                               │
                    │   identity_check ✓ (standard)  │
                    │   company_check  ✓ (standard)  │
                    │   confirm_employee_id ✗ (map→ │
                    │     identity_check, already OK)│
                    │   biometric_re-auth ✗ (NEW)    │
                    │   ...                          │
                    └──────────────────────────────┘
```

### 13.3 Taxonomy Field -> Rubric Criterion Mapping

A mapping file (`lib/mvp/taxonomy/criterion-map.ts`) defines which taxonomy playbook steps map to which standard criteria via keyword pattern matching:

```typescript
export interface TaxonomyCriterionMapping {
  patterns: string[];          // Keywords indicating a standard criterion match
  criterionId: string | null;  // The standard criterion mapped to (null = independent)
  coverage: 'full' | 'partial' | 'independent';
}

export const TAXONOMY_CRITERION_MAP: TaxonomyCriterionMapping[] = [
  { patterns: ['confirm identity', 'verify caller', 'employee id', 'confirm user'],
    criterionId: 'identity_check', coverage: 'full' },
  { patterns: ['company name', 'organisation', 'client name'],
    criterionId: 'company_check', coverage: 'full' },
  { patterns: ['impact', 'business impact', 'what is affected', 'work blocked'],
    criterionId: 'impact', coverage: 'full' },
  { patterns: ['error message', 'screenshot', 'error code', 'status code'],
    criterionId: 'error_or_status_capture', coverage: 'full' },
  { patterns: ['recent changes', 'anything change', 'update recently'],
    criterionId: 'recent_changes', coverage: 'full' },
  { patterns: ['MFA', 'multi-factor', 'biometric', 'sms code'],
    criterionId: null, coverage: 'independent' },
  { patterns: ['admin console', 'reset via admin', 'Azure AD'],
    criterionId: 'technical_discovery', coverage: 'partial' },
  { patterns: ['temporary password', 'send reset link'],
    criterionId: 'safety', coverage: 'partial' },
];
```

### 13.4 The Resolution Algorithm

The resolver runs at assessment creation time, frozen into the assessment snapshot:

```
1. Load standard 18 core criteria
2. Load manager's taxonomy items (playbook steps)
3. For each taxonomy playbook step:
   a. Match against TAXONOMY_CRITERION_MAP via keyword patterns
   b. If coverage = 'full' or 'partial' -> criterion is already covered by standard
   c. If coverage = 'independent' or no match -> create new taxonomy_derived criterion
4. Load manager custom criteria from scoring_overlay_json
5. Add custom criteria (dedup against existing)
6. Load PSA pre-filled fields from manager_standards
7. Mark matching criteria as auto-fulfilled (auto-pass)
8. Freeze the merged set -> taxonomy_criteria_json on assessments
```

### 13.5 PSA Pre-Filled Field Awareness

Many MSPs use a PSA tool (ConnectWise, Autotask, HaloPSA) that auto-fills certain ticket fields. If a field is auto-filled, the candidate shouldn't be penalized for not "asking" for it:

```typescript
// lib/mvp/taxonomy/psa-field-map.ts

export const PSA_FIELD_TO_CRITERION = [
  { psaField: 'Company', criterionId: 'company_check', psaSystem: 'connectwise' },
  { psaField: 'Contact', criterionId: 'identity_check', psaSystem: 'connectwise' },
  { psaField: 'Site', criterionId: 'company_check', psaSystem: 'connectwise' },
  { psaField: 'Priority', criterionId: 'ticket_urgency', psaSystem: 'connectwise' },
];
```

When a manager selects their PSA system and which fields it auto-populates, matching criteria are marked `autoFulfilled: true`, source: `psa_prefilled`, status: `pass` — with a note "Auto-fulfilled by PSA — not scored."

### 13.6 Dynamic AI Prompting

When a manager's taxonomy defines a playbook step that maps to a custom criterion, the AI evidence extraction prompt is dynamically extended:

```
"MedTech's playbook requires you to check:
- Has the MFA device been re-synced? [taxonomy_synced_mfa_device]

Look through the transcript and ticket for evidence."
```

The AI dynamically adapts to the manager's playbook without changing the scoring engine.

---

## 14. Standards Alignment Framework

To make the product defensible and marketable to enterprise MSPs, each criterion is traceable to an industry standard.

### 14.1 Standard -> Criterion Mapping

```typescript
// lib/mvp/analysis/standards-alignment.ts

export const STANDARDS_ALIGNMENTS = [
  // ── ITIL 4 / 5 (UK & global standard for ITSM) ──
  {
    standard: 'ITIL 4', standardVersion: '4.0 / 5.0',
    standardClause: 'Incident Management Practice',
    standardDescription: 'Incidents should be logged, classified, investigated, resolved, and closed with clear documentation.',
    mappedCriteria: ['submitted_ticket','performed_triage','issue_clarification','technical_discovery','next_steps'],
    coverage: 'full'
  },
  {
    standard: 'ITIL 4', standardVersion: '4.0 / 5.0',
    standardClause: 'Service Request Management Practice',
    standardDescription: 'Service requests should be validated, authorized, fulfilled, and closed.',
    mappedCriteria: ['identity_check','company_check','escalation_judgement','next_steps'],
    coverage: 'full'
  },
  {
    standard: 'ITIL 4', standardVersion: '4.0 / 5.0',
    standardClause: 'Service Desk Practice: Communication',
    standardDescription: 'Communicate clearly with users, set expectations, confirm satisfaction.',
    mappedCriteria: ['customer_tone','customer_communication','next_steps'],
    coverage: 'full'
  },

  // ── OWASP ASVS 4.0 (Security verification for credential handling) ──
  {
    standard: 'OWASP ASVS', standardVersion: '4.0',
    standardClause: 'V2.1 - Password Security',
    standardDescription: 'Passwords must not be shared in plaintext, stored insecurely, or transmitted without encryption.',
    mappedCriteria: ['safety'], coverage: 'partial'
  },
  {
    standard: 'OWASP ASVS', standardVersion: '4.0',
    standardClause: 'V2.2 - Identity Verification',
    standardDescription: 'User identity confirmed through a secure, multi-step process before credential changes.',
    mappedCriteria: ['identity_check'], coverage: 'full'
  },
  {
    standard: 'OWASP ASVS', standardVersion: '4.0',
    standardClause: 'V2.3 - Multi-Factor Authentication',
    standardDescription: 'MFA methods are secure and MFA bypasses require documented authorization.',
    mappedCriteria: ['safety'], coverage: 'partial'
  },

  // ── ISO 27001:2022 (Information security management) ──
  {
    standard: 'ISO 27001', standardVersion: '2022',
    standardClause: 'A.5.15 - Access Control',
    standardDescription: 'Access to information and assets shall be controlled per the access control policy.',
    mappedCriteria: ['identity_check','safety'], coverage: 'full'
  },
  {
    standard: 'ISO 27001', standardVersion: '2022',
    standardClause: 'A.5.24 - Incident Management',
    standardDescription: 'Security incidents responded to in accordance with documented procedures.',
    mappedCriteria: ['performed_triage','escalation_judgement','submitted_ticket'], coverage: 'full'
  },

  // ── ISO 20000-1:2018 (IT service management system) ──
  {
    standard: 'ISO 20000-1', standardVersion: '2018',
    standardClause: '8.2 - Incident Management',
    standardDescription: 'Incidents recorded, classified, prioritised, resolved, closed with documentation.',
    mappedCriteria: ['submitted_ticket','performed_triage','issue_clarification','next_steps','ticket_urgency'],
    coverage: 'full'
  },

  // ── HDI Support Center Standard 4.0 ──
  {
    standard: 'HDI Support Center Standard', standardVersion: '4.0',
    standardClause: 'Quality Assurance - Call Monitoring',
    standardDescription: 'Defined quality criteria for evaluating support interactions: greeting, identity verification, issue diagnosis, resolution, closure.',
    mappedCriteria: ['identity_check','company_check','customer_tone','customer_communication','issue_clarification','technical_discovery','next_steps'],
    coverage: 'full'
  },
  {
    standard: 'HDI Support Center Standard', standardVersion: '4.0',
    standardClause: 'Quality Assurance - Ticket Quality',
    standardDescription: 'Tickets contain sufficient detail for another analyst to continue the work without additional research.',
    mappedCriteria: ['ticket_user_company','ticket_issue_summary','ticket_impact','ticket_urgency','ticket_checks_attempted','ticket_next_step'],
    coverage: 'full'
  },

  // ── GDPR / UK DPA 2018 ──
  {
    standard: 'GDPR / UK DPA 2018', standardVersion: '2018',
    standardClause: 'Article 5(1)(f) - Integrity and Confidentiality',
    standardDescription: 'Personal data processed with appropriate security, including protection against unauthorised access.',
    mappedCriteria: ['safety','identity_check'], coverage: 'partial'
  },
];
```

### 14.2 Alignment Coverage Report

The system produces a standards coverage report per assessment:

```
┌─────────────────────────────────────────────────────┐
│ STANDARDS COVERAGE                                  │
│                                                     │
│ ITIL 4 Incident Management      ████████░░ 85%      │
│ ITIL 4 Service Desk Practice    █████████░ 92%      │
│ HDI Call Monitoring             ████████░░ 80%      │
│ HDI Ticket Quality              ██████████ 100%     │
│ OWASP ASVS V2.1 (Password)      ██████░░░░ 60%      │
│ ISO 20000-1 Incident Mgmt       ████████░░ 85%      │
│ ISO 27001 A.5.15 (Access Ctrl)  ██████████ 100%     │
│ GDPR Art 5(1)(f)                ████████░░ 75%      │
│                                                     │
│ Overall Standards Alignment: 84%                     │
│ AI model: Callum v1 (ITIL 4, HDI 4.0, OWASP 4.0)   │
└─────────────────────────────────────────────────────┘
```

### 14.3 Marketing Language

This becomes a powerful differentiator for MSP-facing sales:

```
Callum AI is aligned to:
  - ITIL 4 / 5 -- The global standard for IT service management
  - HDI Support Center Standard 4.0 -- Industry benchmark for support quality
  - OWASP ASVS 4.0 -- Application security verification for credential handling
  - ISO 20000-1:2018 -- IT service management system requirements
  - ISO 27001:2022 -- Information security management
  - GDPR / UK DPA 2018 -- Data protection by design

Every scoring criterion maps to at least one international standard.
Your assessments aren't just "AI opinion" -- they're standards-aligned,
auditable evaluations that your compliance team can stand behind.
```

### 14.4 Dynamic Per-Assessment Alignment

The alignment report adjusts per assessment based on:
- Which pack was used (some packs map to more standards)
- Which manager overlay was applied
- Which criteria actually PASSED (passed criteria contribute; failed criteria deduct)

A candidate who passes more criteria gets a higher standards alignment score -- reinforcing they're operating at a professional, standards-compliant level.

---

## 15. The Full Criterion Pipeline (End-to-End)

```
ASSESSMENT CREATION
───────────────────
1. Pack selected -> standard criteria loaded (18 core + 4 critical)
2. Manager taxonomy loaded -> playbook steps analyzed
3. Taxonomy -> criterion mapping applied
   |-- Matched steps -> criteria already covered
   +-- Unmatched steps -> new taxonomy_derived criteria
4. Manager scoring overlay applied
   |-- weight adjustments
   |-- critical overrides
   |-- custom criteria added
   +-- PSA pre-filled fields -> auto-pass flagged
5. Merged criterion set frozen into assessment row

ASSESSMENT EXECUTION
───────────────────
6. Candidate takes assessment (call + remote + ticket)
7. Sim events logged (deterministic evidence)
8. Ticket submitted

ANALYSIS
───────
9. AI evidence extraction reads transcript + ticket
   |-- Standard criteria checked
   |-- Taxonomy-derived criteria checked against playbook prompts
   +-- Exceptional service dimensions evaluated
10. Deterministic overrides where sim events provide ground truth
11. Score computed from merged criterion set
12. Callum Rating frozen

MANAGER REVIEW
──────────────
13. Manager sees Callum Rating
14. Manager reviews per-criterion -> can override individual checks
15. Manager overlay applied -> Callum For You computed
16. Manager feedback stored -> becomes labeled training data
17. Standards alignment report generated -> shows coverage per standard

GLOBAL INTELLIGENCE
───────────────────
18. Feedback aggregated across all managers (anonymised)
19. Management style clusters updated
20. Percentile benchmarks recomputed
21. Criterion -> taxonomy mapping improved from real data
22. Standards alignment coverage tracked over time
```

---

## 16. Updated Implementation Priorities

| Phase | What | Priority |
|-------|------|----------|
| **A** (done) | Core binary scoring, PASS/FAIL verdict, category breakdowns | Done |
| **B** (next) | Manager overlay (Callum For You), weight config, custom criteria | High |
| **C** (next) | Taxonomy-aware criterion resolution, PSA field awareness | High |
| **D** | Standards alignment framework, coverage reports | Medium |
| **E** | Manager feedback loop, per-criterion override UI | Medium |
| **F** | Global Callum, percentile rankings, style clusters | Future |
| **G** | Certification readiness prediction | Future |
