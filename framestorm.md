# Framework Storm — Brainstorming the Assessment Architecture

> **Goal:** Replace ad-hoc criteria with legitimate, proven frameworks for each dimension of support call quality.
> **Method:** Map each dimension to one primary framework + supporting frameworks. Combine into category scores → total score.

---

## The High-Level Architecture

```
                    ┌──────────────────────────────┐
                    │     OVERALL SCORE (0-100)     │
                    │  (weighted from categories)   │
                    └──────────┬───────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
   ┌─────────────┐    ┌──────────────┐    ┌──────────────┐
   │  Category 1  │    │  Category 2   │    │  Category 3   │  ... more
   │  Score 0-100 │    │  Score 0-100  │    │  Score 0-100  │
   └──────┬──────┘    └──────┬───────┘    └──────┬───────┘
          │                  │                    │
     ┌────┴────┐        ┌────┴────┐         ┌────┴────┐
     │Framework│        │Framework│         │Framework│
     │  A (50%)│        │  B (30%)│         │  C (70%)│
     │  D (50%)│        │  E (70%)│         │  F (30%)│
     └─────────┘        └─────────┘         └─────────┘
```

Each **Framework** is a `FrameworkDefinition` (as already implemented) with 4-10 criteria.
Each **Category** combines 1-3 frameworks with weights.
The **Overall Score** combines categories with weights.

---

## Proposed Categories

| # | Category | What It Measures | Suggested Weight |
|---|----------|-----------------|-----------------|
| 1 | **Security & Compliance** | Identity verification, password handling, data protection, protocol adherence | 25% |
| 2 | **Technical Troubleshooting** | Diagnostic logic, root cause analysis, structured problem-solving | 25% |
| 3 | **Customer Experience** | Tone, empathy, communication clarity, active listening, rapport | 25% |
| 4 | **Process & Professionalism** | Ticket quality, documentation, ownership, process adherence | 15% |
| 5 | **MSP Custom** | Client-specific business rules, playbook compliance, SLAs | 10% |

---

## Framework Candidates — Sorted by Category

### Category 1: Security & Compliance

| Framework | Type | Source | What It Measures | Update Freq | Best For |
|-----------|------|--------|-----------------|-------------|----------|
| **ITIL 4 Information Security Mgmt** | Process standard | Axelos | Security controls in service management: identity verification, access control, data protection | ~3 years | Foundation — defines what security looks like in IT support |
| **GDPR / UK DPA 2018** (current) | Regulation | ICO/UK Gov | Personal data handling, data minimization, breach awareness | **Rarely changes** (amendments every 2-4 years) | Data protection in call handling |
| **NCSC Cyber Essentials** (current) | Government scheme | NCSC | 5 technical controls: firewalls, secure config, access control, malware, patch management | Annual refresh | Foundational security awareness |
| **PCI DSS** (if handling payments) | Industry standard | PCI Council | Cardholder data protection, authentication, access control | ~3 years | Only if MSP processes payments |
| **SOC 2 Trust Services Criteria** | Audit standard | AICPA | Security, availability, processing integrity, confidentiality, privacy | Stable (revisions ~5 years) | Organizational level, not individual |

**Verdict:** Keep **Cyber Essentials** and **GDPR** as they are. They're stable, rarely change, and directly relevant. Drop ISO 27001 (it's organizational, not individual). The existing coverage is actually good here.

**Overlap:** Cyber Essentials and GDPR overlap on access control and data protection. That's fine — different frameworks should overlap; it means the same evidence validates against multiple standards.

---

### Category 2: Technical Troubleshooting

| Framework | Type | Source | What It Measures | Update Freq | Best For |
|-----------|------|--------|-----------------|-------------|----------|
| **Kepner-Tregoe Problem Analysis** | Methodology | Kepner-Tregoe Inc. | Situation Appraisal → Problem Analysis (IS/IS NOT matrix) → Decision Analysis → Potential Problem Analysis | **Very stable** (unchanged since 1960s) | Core troubleshooting logic — the gold standard |
| **ITIL 4 Incident Management Practice** | Process standard | Axelos | Incident logging → categorization → prioritization → diagnosis → escalation → resolution → closure | ~3 years | Process adherence for call handling |
| **ITIL 4 Problem Management Practice** | Process standard | Axelos | Root cause analysis, workaround identification, known error database | ~3 years | Problem-solving depth |
| **Five Whys** | Technique | Sakichi Toyoda (Toyota) | Iterative root cause questioning — how many layers of "why" does the tech explore? | **Never changes** | Simplicity metric |
| **DMAIC (Six Sigma)** | Methodology | Motorola | Define → Measure → Analyze → Improve → Control | **Very stable** | Structured improvement logic |
| **Heuristic Reasoning / Differential Diagnosis** | Medical model | Multiple | List possible causes, test each, eliminate, confirm | **Never changes** | Advanced troubleshooting depth |

**Verdict:** Use **Kepner-Tregoe** as the primary framework — it's the most rigorous, most stable, and directly applicable to IT troubleshooting. Use **ITIL Incident Management** as a supporting framework for process adherence. Drop Six Sigma (too heavy for a single call assessment).

**A Kepner-Tregoe Criteria for Call Scoring:**
```
1. Clarified the problem (WHAT is vs isn't happening)
2. Established scope (WHERE does it occur, WHERE not)
3. Established timing (WHEN did it start, WHEN does it NOT occur)
4. Determined extent (HOW MANY users affected, HOW OFTEN)
5. Identified changes (WHAT changed before the problem started)
6. Tested possible causes (did they verify before acting?)
7. Confirmed root cause (did they confirm the fix addresses the cause?)
```

**ITIL Incident Management Criteria for Call Scoring:**
```
1. Correct incident categorization
2. Appropriate priority (impact + urgency)
3. Initial diagnosis attempted before escalation
4. Escalation at right time with right context
5. Resolution verified with user
6. Ticket updated with all findings
```

---

### Category 3: Customer Experience & Communication

| Framework | Type | Source | What It Measures | Update Freq | Best For |
|-----------|------|--------|-----------------|-------------|----------|
| **SERVQUAL** | Academic model | Parasuraman, Zeithaml, Berry (1988) | 5 dimensions: Reliability, Assurance, Tangibles, Empathy, Responsiveness | **Very stable** (widely validated, minor adaptations only) | Core customer service quality — most researched framework available |
| **SBAR** | Communication protocol | Military → Aviation → Healthcare (Kaiser Permanente) | Situation → Background → Assessment → Recommendation | **Never changes** | Structured communication during escalations and handoffs |
| **LEAP / HEAT / HEART** | Soft skill models | Industry practice | Listen → Empathize → Apologize → (Take action / Problem-solve) | **Never changes** (all same core pattern) | De-escalation and rapport on calls |
| **Feynman Technique** | Teaching method | Richard Feynman | Explain complex concepts in simple terms, no jargon, use analogies | **Never changes** | Assessing explanation quality |
| **HDI Support Center Standard** | Industry certification | HDI | 8 categories including communication, empathy, customer satisfaction | ~2 years (cert renewal) | Organizational benchmark |
| **COPC CX Standard** | Industry standard | COPC | Transaction monitoring: opening, needs assessment, resolution, communication, closing, compliance | ~3-4 years | QA process methodology |

**Verdict:** Use **SERVQUAL** as the primary framework — it's the most researched, validated, and stable. Use **SBAR** for escalation/handoff communication. Use **LEAP/HEAT** as a lightweight soft skills rubric embedded within the SERVQUAL Empathy dimension.

**SERVQUAL Criteria for Call Scoring:**
```
Reliability:
  - Followed through on commitments (callbacks, actions)
  - Provided accurate information
  - Resolved issue correctly the first time

Assurance:
  - Demonstrated technical competence
  - Inspired trust and confidence
  - Handled the call with authority

Empathy:
  - Acknowledged customer's frustration/urgency
  - Gave individualized attention
  - Understood customer's specific situation
  - Used the customer's name

Responsiveness:
  - Responded promptly
  - Kept customer updated during holds/escalations
  - Willing to help without deflection
```

**SBAR Criteria for Call Scoring (when escalation occurs):**
```
1. Situation stated concisely (what's happening)
2. Background provided (context, history, what led here)
3. Assessment given (professional judgment, what they think it is)
4. Recommendation made (what should happen next)
```

---

### Category 4: Process & Professionalism

| Framework | Type | Source | What It Measures | Update Freq | Best For |
|-----------|------|--------|-----------------|-------------|----------|
| **ITIL 4 Service Desk Practice** | Process standard | Axelos | Single point of contact, ownership, communication, escalation | ~3 years | Call ownership and lifecycle management |
| **HDI Support Center Standard** | Industry certification | HDI | 8 categories including processes, performance, continuous improvement | ~2 years | Overall service desk quality |
| **COPC Transaction Monitoring** | QA methodology | COPC | Opening → needs assessment → resolution → communication → closing → compliance | ~3-4 years | Call handling structure |
| **ISO 20000** | Org standard | ISO | Service management system (not individual) | ~5 years | Not useful for individual scoring |

**Verdict:** Use **ITIL 4 Service Desk** as primary for call handling process. Use **COPC-style transaction monitoring** categories for the call flow structure (opening, closing, documentation).

**Call Flow Criteria (COPC/HDI inspired):**
```
1. Proper opening (greeting, identification, offered name)
2. Needs assessment (asked probing questions)
3. Issue documented in ticket (clear summary)
4. Call handled with ownership (no unnecessary transfers)
5. Proper closing (summarized, confirmed, set expectations)
6. Ticket completed (all fields filled, resolution documented)
```

---

### Category 5: MSP Custom / Company

| Framework | Type | Source | What It Measures | Update Freq | Best For |
|-----------|------|--------|-----------------|-------------|----------|
| **Callum Baseline** (current) | Custom internal | Your org | 22 criteria across call fundamentals, diagnosis, resolution, ticket quality | **You control** | Already working — keep as the foundation |
| **Client SLAs** | Contractual | Per client | Response time, resolution time, availability, specific reporting | Per contract | Client-specific criteria |
| **Playbook Adherence** | Internal process | Your org | Did the agent follow the SOP for this ticket type? | Per playbook update | Consistency across team |
| **Knowledge Base Contribution** | Internal metric | Your org | Did the agent create/update KB articles? | Ongoing | Continuous improvement |

**Verdict:** Keep **Callum Baseline** as the core company framework. Add pack-specific criteria from the simulation packs. The existing Implementation already does this well — the packs define relevant criteria and the scoring engine handles it.

---

## Overlap Analysis

| Framework Pair | Overlap | Acceptable? |
|----------------|---------|-------------|
| SERVQUAL Empathy ↔ LEAP/HEAT | High — both measure empathy and active listening | ✅ Yes — LEAP/HEAT is a concrete rubric for the SERVQUAL dimension |
| Kepner-Tregoe ↔ ITIL Incident Diagnosis | Moderate — both cover diagnostic steps | ✅ Yes — KT is the method, ITIL is the process wrapper |
| Cyber Essentials Access Control ↔ GDPR Identity Verified | High — both verify identity before granting access | ✅ Yes — same evidence, two frameworks validate it differently |
| ITIL Incident ↔ COPC Transaction | Moderate — both cover call lifecycle | ⚠️ Potential redundancy — pick one for process, use the other for QA structure |
| HDI Standard ↔ COPC Standard | High — both are organizational QA standards | ⚠️ Don't use both for the same purpose — HDI is better for IT specifically |

**General rule:** Overlap is fine. The same candidate action (e.g., verifying identity) can legitimately count toward multiple frameworks. The UI should show this transparency ("Your identity check contributed to Security AND Customer Experience").

---

## Framework Stability Ratings

| Framework | Last Major Update | Next Expected | Stability |
|-----------|-----------------|---------------|-----------|
| **Kepner-Tregoe** | 1960s (methodology) | Never (unchanging method) | ✅ **Very high** |
| **SERVQUAL** | 1988 (model), minor adaptations since | Stable | ✅ **Very high** |
| **SBAR** | 2002 (healthcare adoption) | Never (unchanging protocol) | ✅ **Very high** |
| **LEAP/HEAT/HEART** | 1990s-2000s | Never (unchanging pattern) | ✅ **Very high** |
| **Feynman Technique** | 1960s | Never | ✅ **Very high** |
| **Cyber Essentials** | Annual refresh (2025 latest) | 2026 | ⚠️ **Annual check** |
| **GDPR** | 2018 (enforcement) | 2026+ (updates pending) | ✅ **Stable** (major changes rare) |
| **ITIL 4** | 2019 (ITIL 4), 2023 (update) | ~5 years | ⚠️ **Moderate** |
| **HDI Standard** | ~2 year renewal cycle | Ongoing | ⚠️ **Monitor** |
| **COPC Standard** | ~3-4 year cycle | ~2025-2026 | ⚠️ **Monitor** |

**Recommendation:** Build the core assessment around **stable, unchanging frameworks** (Kepner-Tregoe, SERVQUAL, SBAR). Use the more dynamic frameworks (Cyber Essentials, ITIL) as secondary overlays that can be updated independently.

---

## Proposed Architecture

```
TOTAL SCORE (100%)
├── Security & Compliance (25%)
│   ├── Cyber Essentials 2025 (50%) — stable gov't standard
│   └── GDPR / UK DPA 2018 (50%) — stable regulation
│
├── Technical Troubleshooting (25%)
│   ├── Kepner-Tregoe Problem Analysis (60%) — gold standard diagnostic method
│   └── ITIL Incident Management Practice (40%) — process wrapper
│
├── Customer Experience (25%)
│   ├── SERVQUAL (50%) — 5 validated service quality dimensions
│   ├── SBAR (25%) — escalation/handoff communication quality
│   └── LEAP/HEAT Rubric (25%) — soft skills execution on the call
│
├── Process & Professionalism (15%)
│   └── ITIL Service Desk + COPC Transaction Model — call handling lifecycle
│
└── MSP Custom / Company (10%)
    └── Callum Baseline + Pack-Specific Criteria — your business rules
```

### How It Works in Practice

1. **Same AI extraction call** — The evidence prompt asks the AI about ~30 criteria covering all 5 categories. No additional AI calls.

2. **Each framework reads from the same evidence pool** — Same as now. A criterion like `identity_check` feeds into Security (Cyber Essentials), Process (ITIL), and Customer Experience (SERVQUAL Assurance).

3. **Category score** = weighted combination of its frameworks' scores.

4. **Total score** = weighted combination of category scores.

5. **Pack relevance** filters which criteria are applicable per scenario (already implemented).

### What Changes

| Component | Current | Proposed |
|-----------|---------|----------|
| Framework count | 4 (Callum, CE, GDPR, ISO) | ~8-10 (across 5 categories) |
| Per-framework criteria | 6-22 | **4-8 each** (more focused) |
| Prompt additions | ~30 lines | ~40 lines (manageable) |
| AI call count | 2 | 2 (unchanged — all in same extraction) |
| Scoring engine | Binary 1pt | Keep binary 1pt per criterion, frameworks use their own weights |
| Readiness labels | ready/needs_sup/not_ready | Keep — per-category readiness + overall |

---

## Framework Selection — Manager Configurable

### The Pattern

Managers select which frameworks apply to an assessment. This is a **manager_profile** setting:

```typescript
// In manager_profiles table or manager settings UI
const managerProfile = {
  id: 'manager-default-v1',
  name: 'Default MSP Manager',
  
  // Which frameworks to assess against
  selectedFrameworks: [
    // Security & Compliance
    'cyber_essentials_2025',
    'gdpr_2018',
    
    // Technical Troubleshooting
    'kepner_tregoe_problem_analysis',
    'itil_incident_management',
    
    // Customer Experience
    'servqual',
    'sbar_communication',
    'leap_heat_rubric',
    
    // Process & Professionalism
    'itil_service_desk',
    
    // Company
    'callum_baseline_v1',
  ],
  
  // Category weights (must sum to 100%)
  categoryWeights: {
    security_compliance: 25,
    technical_troubleshooting: 25,
    customer_experience: 25,
    process_professionalism: 15,
    msp_custom: 10,
  },
  
  // Per-framework weights within each category (must sum to 100% per category)
  frameworkWeights: {
    // Security & Compliance
    cyber_essentials_2025: 50,
    gdpr_2018: 50,
    
    // Technical Troubleshooting
    kepner_tregoe_problem_analysis: 60,
    itil_incident_management: 40,
    
    // Customer Experience
    servqual: 50,
    sbar_communication: 25,
    leap_heat_rubric: 25,
    
    // Process
    itil_service_desk: 100,
    
    // Company
    callum_baseline_v1: 100,
  },
};
```

### How Selection Works

```
Manager creates assessment →
  Picks a pack (e.g., password-reset-v1) → 
  Their profile auto-selects which frameworks apply →
  Pack relevance filters per-framework criteria (already built) →
  Only selected frameworks are scored →
  Results show: "Assessed against: Cyber Essentials, GDPR, Kepner-Tregoe, SERVQUAL"
```

**New pack → auto-included.** Adding a new pack doesn't require framework changes. The pack's taxonomy tags auto-resolve to criteria across all selected frameworks. If criteria exist that match the pack's scenario, they're scored. If not, they're `not_applicable`.

**New framework → manager opts in.** When a new framework is added to the system, existing assessment profiles don't automatically include it. Managers update their profile to opt in. Historical assessments are unaffected.

---

## Technical Implementation

### How It Hooks Into the Existing Pipeline

The current pipeline in `runBaseCallumAnalysis.ts`:

```
evidence extraction (AI call #1) 
  → scoring (scoreExtraction) 
  → compliance (evaluateAllFrameworks) 
  → narrative (AI call #2)
```

The changes are minimal:

```typescript
// Current:
const complianceResult = evaluateAllFrameworks(evidencePool, DEFAULT_FRAMEWORKS, packId);

// Proposed: 
const selectedFrameworks = getFrameworksById(managerProfile.selectedFrameworks);
const complianceResult = evaluateAllFrameworks(evidencePool, selectedFrameworks, packId);
```

That's it. The `DEFAULT_FRAMEWORKS` registry already supports filtering by ID via `getFrameworksById()`. The pipeline doesn't change. The evidence extraction doesn't change. The scoring engine doesn't change.

### Category Combination Logic

```typescript
interface CategoryScore {
  categoryId: string;
  categoryLabel: string;
  weight: number;          // e.g., 25 (for 25%)
  score: number;            // 0-100 combined from frameworks
  frameworks: FrameworkResult[];
}

function computeCategoryScores(
  frameworkResults: FrameworkResult[],
  categoryDefs: CategoryDefinition[],
  frameworkWeights: Record<string, number>,
): CategoryScore[] {
  return categoryDefs.map(cat => {
    const catFrameworks = frameworkResults.filter(fw => 
      cat.frameworkIds.includes(fw.frameworkId)
    );
    
    let weightedScore = 0;
    for (const fw of catFrameworks) {
      const fwWeight = (frameworkWeights[fw.frameworkId] || 100) / 100;
      weightedScore += fw.score * fwWeight;
    }
    
    return {
      categoryId: cat.id,
      categoryLabel: cat.label,
      weight: cat.weight,
      score: Math.round(weightedScore),
      frameworks: catFrameworks,
    };
  });
}

function computeTotalScore(
  categoryScores: CategoryScore[],
  categoryWeights: Record<string, number>,
): number {
  let total = 0;
  for (const cat of categoryScores) {
    const weight = (categoryWeights[cat.categoryId] || 0) / 100;
    total += cat.score * weight;
  }
  return Math.round(total);
}
```

### Data Flow

```
Evidence Pool (AI extraction results)
  ↓
For each selected framework:
  evaluateSingleFramework(evidencePool, frameworkDef, packId)
  → FrameworkResult { score, passed, criteriaResults, ... }
  ↓
Group FrameworkResults by category
  → computeCategoryScores()
  → CategoryScore[] { score, weight, frameworks[] }
  ↓
  → computeTotalScore()
  → Overall score 0-100
  ↓
Narrative AI call (informed by category scores, not just total)
```

### Manager Profile Storage

```sql
-- Already exists: manager_profiles table
ALTER TABLE manager_profiles ADD COLUMN framework_selection_json TEXT;
ALTER TABLE manager_profiles ADD COLUMN category_weights_json TEXT;
ALTER TABLE manager_profiles ADD COLUMN framework_weights_json TEXT;

-- Example JSON in framework_selection_json:
-- ["cyber_essentials_2025", "gdpr_2018", "kepner_tregoe_problem_analysis", ...]
```

The assessment snapshot already stores manager standards at creation time (see `assessments.standards_snapshot_json`). This would also include the framework selection snapshot — so reassessing later uses the same frameworks the original manager selected.

---

## Global Report — Weaving Independent Assessments Into Coherent Feedback

### The Problem

Independent framework scores (Cyber Essentials: 80%, SERVQUAL: 65%, Kepner-Tregoe: 45%) are hard to interpret without context. The candidate/manager needs:

1. **"What do these numbers mean?"** — A total score that maps to readiness
2. **"Where did I lose points?"** — Category breakdown with biggest misses
3. **"What do I do about it?"** — Narrative feedback referencing specific criteria
4. **"How do frameworks relate to each other?"** — Mapping between frameworks

### Report Structure

```
┌─────────────────────────────────────────────────────────┐
│  ASSESSMENT REPORT                                       │
│  Candidate: Sarah Thompson                               │
│  Overall: 68/100 — Needs Supervision                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  CATEGORY SCORES                                          │
│                                                          │
│  Security & Compliance       78%  ✓ Pass                 │
│  ├── Cyber Essentials       80%  ✓                       │
│  └── GDPR                   75%  ✓                       │
│                                                          │
│  Technical Troubleshooting  52%  ✗ Needs work            │
│  ├── Kepner-Tregoe          45%  ✗                       │
│  └── ITIL Incident Mgmt     62%  ⚠                       │
│                                                          │
│  Customer Experience        71%  ✓                       │
│  ├── SERVQUAL               74%  ✓                       │
│  ├── SBAR                   60%  ⚠                       │
│  └── LEAP/HEAT              78%  ✓                       │
│                                                          │
│  Process & Professionalism  65%  ⚠                       │
│  └── ITIL Service Desk      65%  ⚠                       │
│                                                          │
│  MSP Custom                 82%  ✓                       │
│  └── Callum Baseline        82%  ✓                       │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  WHAT COST YOU THE MOST POINTS                           │
│  ─────────────────────────────                           │
│  1. No root cause analysis     KEPNER-TREGOE     -12pts  │
│  2. Scope not established      KEPNER-TREGOE      -8pts  │
│  3. Escalation missing SBAR    SBAR                -6pts  │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  AI NARRATIVE FEEDBACK                                    │
│  ─────────────────────────────                           │
│  "Sarah demonstrated good security awareness and          │
│   customer rapport. However, her troubleshooting          │
│   approach needs structure — she jumped to solutions      │
│   without fully scoping the problem first. For            │
│   escalations, using SBAR format would provide            │
│   clearer context for second-line teams."                 │
│                                                          │
│  Coaching focus:                                          │
│  • Practice IS/IS NOT problem definition (KT method)     │
│  • Use SBAR template for escalation handoffs             │
│  • Ask "how many users" before diagnosing                │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### UI Components Required

| Component | Data Source | What It Shows |
|-----------|-------------|---------------|
| `CategoryScoreCard` | `CategoryScore[]` | Per-category bar chart with framework breakdown |
| `FrameworkDetail` | `FrameworkResult[]` | Per-framework criteria list with pass/fail per criterion |
| `WhatCostYouMost` | Sorted list of missed criteria | Top 5-10 biggest point losses with framework attribution |
| `NarrativeFeedback` | AI narrative output | Prose feedback referencing category performance |
| `ComplianceSummary` | Pass/failed frameworks list | "Cyber Essentials: ✓ PASSED" / "Kepner-Tregoe: ✗ FAILED" |

### The AI Narrative Prompt

The narrative AI call already exists (Pipeline A, call #2). The difference is the prompt now receives category scores instead of just a total score:

```typescript
// Current prompt input:
{ score: 68, rating: 'needs_supervision', skillBreakdown: {...} }

// Proposed prompt input:
{ 
  totalScore: 68, 
  rating: 'needs_supervision',
  categories: [
    { id: 'technical_troubleshooting', score: 52, label: 'Technical Troubleshooting' },
    { id: 'customer_experience', score: 71, label: 'Customer Experience' },
    ...
  ],
  frameworks: [
    { id: 'kepner_tregoe', score: 45, passed: false, failedCriteria: [...] },
    { id: 'servqual', score: 74, passed: true },
    ...
  ],
  biggestMisses: [
    { criterion: 'root_cause_analysis', framework: 'kepner_tregoe', lost: 12 },
    ...
  ]
}
```

This lets the AI generate targeted feedback per category instead of generic advice.

### Candidate vs Manager Views

**Candidate view:** Simplified — total score, readiness, top 3 strengths, top 3 improvements, coaching focus. No framework details.

**Manager view:** Full detail — category breakdown, framework comparison, per-criterion evidence, historical trend data.

```
CANDIDATE:                       MANAGER:
┌──────────────────────┐        ┌──────────────────────────────┐
│  Score: 68/100       │        │  Score: 68/100               │
│  Needs Supervision   │        │  Needs Supervision           │
│                      │        │                              │
│  Strengths:          │        │  Category Breakdown:         │
│  • Good security     │        │  Security      78% ✓         │
│  • Clear steps       │        │  Troubleshoot  52% ✗         │
│                      │        │  Experience    71% ✓         │
│  To improve:         │        │  Process       65% ⚠         │
│  • Ask more probing  │        │  Company       82% ✓         │
│  questions before    │        │                              │
│  jumping to fixes    │        │  Framework Detail:           │
│                      │        │  KT: 3/7 criteria failed     │
│  Coaching:           │        │  - No IS/IS NOT              │
│  • Practice KT       │        │  - No change analysis        │
│    method            │        │  - Scope not established     │
└──────────────────────┘        └──────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Framework Definitions (1 day)

Create `FrameworkDefinition` objects for new frameworks:

```
lib/mvp/compliance/frameworks/
├── callum-baseline.ts        (keep, trim overlapping criteria)
├── cyber-essentials-2025.ts  (keep)
├── gdpr-2018.ts              (keep)
├── kepner-tregoe.ts          (NEW — 7 criteria)
├── servqual.ts               (NEW — 10 criteria)
├── sbar-communication.ts     (NEW — 4 criteria)
├── leap-heat-rubric.ts       (NEW — 4 criteria)
├── itil-incident-mgmt.ts     (NEW — 6 criteria)
├── itil-service-desk.ts      (NEW — 5 criteria)
└── index.ts                  (update registry)
```

### Phase 2: Evidence Prompt (1 day)

Add ~15 new criterion questions to `evidencePrompt.ts`:
- Kepner-Tregoe: IS/IS NOT, change analysis, scope, timing, extent, cause testing, confirmation
- SERVQUAL: reliability, assurance, empathy, responsiveness
- SBAR: situation, background, assessment, recommendation
- LEAP/HEAT: listen, empathize, apologize, take action

### Phase 3: Category Combination (0.5 day)

Add category combination logic to the analysis pipeline:
- `computeCategoryScores()` — groups framework results into categories
- `computeTotalScore()` — weighted combination of categories
- Store in `assessment_results` alongside framework results

### Phase 4: Manager Profile Selection (0.5 day)

- Add framework selection to manager profile model
- Snapshot selection at assessment creation time
- Filter frameworks in `evaluateAllFrameworks()` call

### Phase 5: Report UI (1 day)

- Update `AssessmentResults.tsx` to show category breakdown
- Add framework drill-down for managers
- Update AI narrative prompt to include category context

### Phase 6: Re-Red-Team (0.5 day)

- Run T1-T5 transcripts through new architecture
- Verify per-category scores make sense
- Verify total score composition

---

## Framework Stability Ratings

| Framework | Last Major Update | Next Expected | Stability |
|-----------|-----------------|---------------|-----------|
| **Kepner-Tregoe** | 1960s (methodology) | Never (unchanging method) | ✅ **Very high** |
| **SERVQUAL** | 1988 (model), minor adaptations since | Stable | ✅ **Very high** |
| **SBAR** | 2002 (healthcare adoption) | Never (unchanging protocol) | ✅ **Very high** |
| **LEAP/HEAT/HEART** | 1990s-2000s | Never (unchanging pattern) | ✅ **Very high** |
| **Feynman Technique** | 1960s | Never | ✅ **Very high** |
| **Cyber Essentials** | Annual refresh (2025 latest) | 2026 | ⚠️ **Annual check** |
| **GDPR** | 2018 (enforcement) | 2026+ (updates pending) | ✅ **Stable** (major changes rare) |
| **ITIL 4** | 2019 (ITIL 4), 2023 (update) | ~5 years | ⚠️ **Moderate** |
| **HDI Standard** | ~2 year renewal cycle | Ongoing | ⚠️ **Monitor** |
| **COPC Standard** | ~3-4 year cycle | ~2025-2026 | ⚠️ **Monitor** |

**Recommendation:** Build the core assessment around **stable, unchanging frameworks** (Kepner-Tregoe, SERVQUAL, SBAR). Use the more dynamic frameworks (Cyber Essentials, ITIL) as secondary overlays that can be updated independently.

---

---

## Evolution Path: From Prompt-Based to Trained Model

### The Core Insight

The frameworks are the grading rubric. Every assessment produces a labeled training example:

```
Input:  transcript text + ticket text + action timeline
Label:  framework criteria statuses (42 binary/ternary judgments)
```

After enough examples, a small model can learn to predict what the frameworks will output — effectively becoming the assessment engine without needing the prompt-based AI call.

### Phase 1: Bootstrap (Current — Prompt-Based AI)

```
Transcript → deepseek-v4-flash (prompt) → criteria → frameworks score
                                                         ↓
                                                 Store as training data
                                                (input = transcript, label = criteria)
```

- 1 AI call per assessment (~30s, ~$0.0012)
- 100 assessments → 100 labeled examples
- Prompt is the fallback generation mechanism

### Phase 2: Distill (Fine-Tune Small Model)

Use the labeled data from Phase 1 to fine-tune a small model.

```
Target: Qwen 2.5 0.5B or 1.5B (via LoRA)
Data:   1,000+ (transcript → criteria labels)
Task:   Multi-label classification (42 criteria × 5 statuses each)
Hardware: RTX 3090 or better (1.5B fits in 8GB with 4-bit)
Time:   ~2-3 hours for 1,000 examples at 1.5B
```

**Why Qwen specifically:**
- 0.5B runs on CPU at ~100ms per inference
- 1.5B runs on GPU at ~50ms per inference
- Supports long context (32K tokens handles full transcripts)
- Apache 2.0 license — no restrictions
- Can be quantized to 4-bit with minimal accuracy loss

**Fine-tuning approach:**
```python
# Training data format
{
  "transcript": "CALLER: Hi I can't log in...\nCANDIDATE: What's your name?...",
  "ticket": "Summary: Password reset...",
  "labels": {
    "identity_check": "pass",
    "company_check": "pass",
    "technical_discovery": "fail",
    "kt_define_problem": "pass",
    # ... all 42 criteria
  }
}

# LoRA fine-tuning
# Model: Qwen2.5-1.5B-Instruct
# Target modules: q_proj, v_proj (all attention layers)
# Rank: 16, Alpha: 32
# Loss: Binary cross-entropy per criterion
```

**Validation strategy:**
- Hold out 20% of assessments as test set
- Compare: trained model vs prompt-based AI on same transcripts
- Metric: per-criterion accuracy, framework score RMSE, readiness label accuracy
- Goal: >90% per-criterion agreement before replacing the AI call

### Phase 3: Embed (Local Inference, No API Call)

```
Transcript → Qwen 0.5B (local, 100ms) → criteria → frameworks score
                                             
No API call. No prompt. No latency. No cost.
```

**What this unlocks:**

| Capability | Before (Prompt AI) | After (Trained Model) |
|-----------|-------------------|----------------------|
| Cost per assessment | ~$0.0024 (2 calls) | **$0.00001** (electricity) |
| Latency | 30-60 seconds | **50-200 milliseconds** |
| API dependency | Full (OpenRouter/OpenAI) | **None — runs offline** |
| Privacy | Data sent to external API | **Data stays local** |
| Scaling bottleneck | API rate limits + cost | **Hardware only** |
| Consistency | Prompt changes alter behavior | **Model is deterministic** |

### Phase 4: Multi-Modal (Beyond Text)

The simulator already records more than transcripts:

| Data Source | Currently | Future Use |
|------------|-----------|------------|
| Chat transcript | ✅ Analyzed by AI | Still analyzed |
| Ticket text | ✅ Analyzed by AI | Still analyzed |
| Action timeline | ✅ Logged but not analyzed | **Model learns action patterns** |
| Tool navigation | ❌ Not captured | **Record mouse/keyboard interactions** |
| Remote desktop | ❌ Not captured | **Record screen + cursor movements** |
| Call timing | ✅ Logged as metrics | **Model learns timing patterns** |

**Remote desktop recording** is the big unlock. If you record the candidate's screen during the remote desktop session:
- Did they look in the right menu?
- Did they check event viewer before reinstalling?
- Did they verify before applying a fix?
- How fast did they navigate?

A vision-language model (Qwen2.5-VL 7B) could process screen recordings frame-by-frame and score:
```
"At 02:15, candidate opens Event Viewer → checks System log → 
 filters for Error → identifies source as 'WMI'. Correct diagnostic path."
```

Combined with the text model, you'd get a **holistic assessment**:
- Text model scores: what they said + how they documented
- Vision model scores: what they did + how they navigated
- Combined: full behavioral profile

### Phase 5: Self-Improving Loop

```
Assessment runs
  → Small model scores criteria
  → Frameworks compute scores
  → Manager reviews and adjusts scores (feedback)
  → Adjusted scores stored as new training example
  → Periodic retraining (weekly/monthly)
  → Model improves with each cycle
```

**The loop closes itself.** Every assessed call, when reviewed by a manager, generates a higher-quality training example. The model gradually converges toward manager-level scoring accuracy — without prompt engineering, without API costs, without external dependencies.

### What This Means Long-Term

| Timescale | State | Dependencies |
|-----------|-------|-------------|
| **Now** | Prompt-based AI (deepseek-v4-flash) | OpenRouter API, ~$240/100K |
| **1 month** | Qwen 0.5B fine-tuned, parallel with prompt AI | Training compute, 1K labeled examples |
| **3 months** | Qwen 1.5B replaces prompt AI for extraction | None — runs locally on inference |
| **6 months** | Qwen 2.5-VL 7B adds screen recording analysis | GPU for inference |
| **12 months** | Self-improving loop, manager feedback drives retraining | Manager review time only |

### Risks

| Risk | Mitigation |
|------|-----------|
| Small model accuracy < prompt AI | Keep prompt AI as fallback until >90% agreement. Use ensemble (both score, flag disagreement) |
| Distillation collapse | Add regularization. Don't train on model outputs exclusively — mix in human-reviewed data |
| Screen recording privacy | Process entirely on-device. Never transmit or store recordings. Delete after scoring |
| Overfitting to frameworks | Frameworks are the ground truth — fitting them is the goal, not a bug |
| Dataset drift (new scenarios) | Prompt AI handles novel scenarios. The trained model scores known ones. Disagreement = trigger for human review |

---

---

## Edge Cases for Framework Testing

These edge cases probe the boundaries of the multi-framework architecture. They should be added as test fixtures and run through the pipeline.

### Conduct & Communication Edge Cases

| ID | Scenario | What It Probes |
|----|----------|----------------|
| **E1** | Right fix, wrong reason — lucky guess diagnosis | Kepner-Tregoe: `kt_test_causes` fails even though fix worked |
| **E2** | Perfect escalation with full SBAR context | All SBAR criteria pass, ITIL escalation timing correct |
| **E3** | 5-minute silence during investigation, then announces fix without explanation | SERVQUAL: `responsiveness_updates` fails. Process: ownership borderline |
| **E4** | Argues with customer about what the issue is, doesn't test either hypothesis | Professional conduct fail. Empathy fail. Troubleshooting fail |
| **E5** | Follows playbook perfectly but can't handle customer deviation | Not captured by current criteria. May need adaptability criterion |
| **E6** | Over-explains with jargon for 5 minutes, customer confused | SBAR: assessment too long. SERVQUAL: empathy fails |
| **E7** | Handles chat + call simultaneously, both get partial attention | Current system can't measure parallel sessions |
| **E8** | 45 minutes to fix a 10-minute issue. Steps correct but meandering | ITIL: SLA breached. Timing metrics captured but not scored as criteria |

### Technical & Scenario Edge Cases

| ID | Scenario | What It Probes |
|----|----------|----------------|
| **E9** | Fixes issue but disables security to do it | Security fails, troubleshooting passes — tests category separation |
| **E10** | Correct diagnosis, no fix, escalates appropriately | KT passes, ITIL escalation passes, resolution fails — balanced scoring test |
| **E11** | Chat-only support with 3 simultaneous conversations | Different assessment mode needed |
| **E12** | Email thread — full resolution via email | No tone/empathy scoring from text. Different criteria needed |
| **E13** | Hardware dispatch — diagnoses fault, sends replacement | Resolution is indirect. Process should capture dispatch workflow |
| **E14** | 15 identical password resets in a shift — consistency scoring | Monotony assessment. Does process adherence hold? |
| **E15** | Company-wide VPN outage — major incident handling | Current criteria assume single-user. Needs scale-aware scoring |

---

## Frameworks Assessed and Rejected

| Framework | Why Rejected |
|-----------|-------------|
| **ISO 27001:2022** | Organizational certification, not individual technician assessment. Too abstract for call scoring. |
| **ISO 20000** | Same — certifies the service management system, not the agent. |
| **Six Sigma DMAIC** | Too heavy for single-call assessment. Better for process improvement projects. |
| **NPS/CSAT/CES** | Outcome metrics, not process metrics. Use to validate the scoring system, not to score individual calls. |
| **PCI DSS** | Only relevant if the MSP handles payment data. Narrow scope. |
| **SOC 2** | Organizational audit framework. Not applicable to individual assessment. |
