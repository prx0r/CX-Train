# Flaws Analysis — Current Compliance Framework Architecture

> Honest review of the limitations, risks, and fixes needed before this is production-ready.

---

## 1. The Applicability Problem

### The Issue

Cyber Essentials has a criterion called "Malware protection awareness" that looks for keywords like `antivirus|malware|virus` in the transcript. For a **password reset** ticket, this criterion should be `not_applicable`. But currently it scores as `fail` because the candidate never mentions malware (they shouldn't — it's a password reset).

**This is unfair.** The candidate didn't miss anything — the scenario simply didn't exercise that control.

### The Tension

```
We want:                           We also want:
─────────────────────              ─────────────────────
Deterministic scoring              Criteria that don't apply
Every point traceable              should not penalise the candidate
Same evidence → same score         Scenarios vary in scope
```

If we let the AI decide relevance: we lose determinism (different AI calls could flag different criteria as relevant).

If we use keyword matching: the password reset scenario unfairly fails on malware criteria.

If we mark everything `pass` when no evidence exists: the framework becomes meaningless (everyone passes everything they weren't tested on).

### The Solution: Pack-Level Relevance Mapping

Each pack (password-reset, outlook-work-offline, new-starter) defines which compliance criteria are **relevant** to that scenario:

```typescript
// In pack definition (e.g., password-reset.ts)
const relevantFrameworkCriteria = {
  callum_baseline_v1: ['identity_check', 'company_check', 'issue_clarification', ...],  // all 23
  cyber_essentials_2025: ['ce_access_control', 'ce_unauthorized_access', 'ce_patch_awareness'],
  // Not included: ce_secure_config, ce_malware_awareness (not relevant for password reset)
  gdpr_2018: ['gdpr_identity_verified', 'gdpr_data_minimization', 'gdpr_breach_awareness'],
  iso_27001_2022: ['iso_access_control', 'iso_incident_management', 'iso_patch_management', 'iso_escalation'],
};
```

**How it works:**
1. Framework definitions stay static — they define the full standard
2. At assessment creation time, the pack's `relevantFrameworkCriteria` filters which criteria are scored
3. Criteria not in the relevance list get status `not_applicable` with evidence "Not relevant for this pack"
4. The score is computed ONLY from applicable criteria
5. The display shows "This criterion was not assessed for this ticket type"

**This is fully deterministic, auditable, and fair.** The pack author explicitly decides which criteria are exercised by their scenario.

---

## 2. Framework Authenticity

### The Issue

Are our frameworks the "official" versions? Not exactly.

| Framework | Official Version | Our Version |
|-----------|-----------------|-------------|
| **Cyber Essentials** | 5 technical controls (firewalls, secure config, access control, malware, patch management) | 7 criteria derived from the 5 controls plus additional checks |
| **ISO 27001:2022** | 93 Annex A controls across 4 domains | 8 selected controls relevant to first-line support |
| **GDPR / UK DPA 2018** | 7 principles + 8 data subject rights + numerous articles | 6 criteria covering identity verification, data minimization, breach awareness |
| **ITIL 4** | 34 practices across the Service Value System | Referenced as alignment, not a separate framework |
| **Callum Baseline** | Not an official standard — it's our own rubric | Our 18+4 rubric |

**What we should call them:**
- "Mapped from Cyber Essentials 2025" (not "Cyber Essentials 2025 Certified")
- "Aligned to ISO 27001:2022 Annex A" (not "ISO 27001 Compliant")
- "Based on GDPR / UK DPA 2018 principles" (not "GDPR Compliant")

**Why this matters:**
If a manager uses our GDPR framework to claim their team is "GDPR certified," and an auditor finds gaps that our criteria missed, we have liability exposure. We must be clear about what these scores represent: **an assessment mapping**, not a **certification audit**.

### The Fix
- Rename framework types to include "Mapped from" or "Aligned to"
- In the UI: display "Mapped from Cyber Essentials 2025" not "Cyber Essentials 2025"
- Never use the word "certified" or "compliant" — use "assessed against" or "mapped to"
- Add a disclaimer: "This assessment evaluates candidate behaviours relevant to this framework. It is not a substitute for a formal certification audit."

---

## 3. Weighting Consistency

### The Issue

Currently, different frameworks use different weight scales:

| Framework | Weight Range | Rationale |
|-----------|-------------|-----------|
| Callum Baseline | 0 or 1 (binary) | Equal importance — 18 binary checks |
| Cyber Essentials | 5-10 per criterion | NCSC control hierarchy |
| GDPR | 5-10 per criterion | ICO regulatory risk levels |
| ISO 27001 | 5-10 per criterion | ISO Annex A control numbering |

This means a candidate who fails a weight-10 Cyber Essentials criterion loses more "percentage points" than someone who fails a Callum Baseline criterion (which is always 1).

**The issue:** Percentage scores across frameworks are not directly comparable. A Cyber Essentials 55% means something different from a GDPR 22%.

### The Fix
- Do NOT compare percentage scores across frameworks
- The UI should show raw scores per framework with framework-specific thresholds
- Frameworks should display "pass/fail" based on their own threshold, not relative scoring
- The **only** cross-framework output should be a list: "Frameworks assessed: 4. Passed: ISO 27001, Callum Baseline. Failed: Cyber Essentials, GDPR."

---

## 4. Evidence Overlap Double-Counting

### The Issue

Multiple frameworks read the same evidence and count it toward their own scores. This is fine — each framework has its own criteria and weight. But if a manager looks at:

```
Callum Baseline: identity_check PASS 1/1pt
Cyber Essentials: ce_access_control PASS 10/10pt (maps to identity_check)
ISO 27001: iso_access_control PASS 10/10pt (maps to identity_check)
```

They see the SAME candidate action contributing to 3 frameworks. This isn't double-counting *a single score* (frameworks are independent), but it can look like padded results.

### The Fix
- The UI should make it clear that frameworks are independent assessments of the same evidence
- "Your identity verification action contributed positively to all 3 frameworks"
- This is actually a **selling point** — it shows the candidate's actions are broadly effective across standards

---

## 5. AI Context Understanding Limits

### The Issue

The `transcript_keyword` check type uses simple string matching. `gdpr_data_minimization` checks if the transcript contains keywords like `ask for password|social security|bank details`. If found, it FAILS the criterion (the candidate asked for unnecessary personal data).

But what if the candidate says "I'm NOT going to ask you for your password" — the keyword `ask for password` is present but the context is correct. The simple keyword match would incorrectly FAIL.

### The Fix
- Simple keyword matching is replaced with AI-prompted extraction for subtle criteria
- For `gdpr_data_minimization`: instead of keyword matching, the AI is asked "Did the candidate ask the caller for any unnecessary personal data?" — the AI extracts `pass` or `fail` based on understanding the conversation, not just keyword presence
- This changes the check type from `transcript_keyword` to `ai_criteria` — the AI becomes the evidence extractor, and the deterministic engine just reads the AI's judgment

---

## 6. Summary: What Needs to Change

| Problem | Fix | Priority |
|---------|-----|----------|
| Irrelevant criteria scored as fail | Pack-level relevance mapping | **High** |
| Framework naming overpromises | Add "Mapped from" / "Aligned to" labels | **High** |
| Percentages not cross-framework comparable | Independent pass/fail per framework, no combined % | **Medium** |
| Evidence overlap looks like padding | UI explains independent assessment | **Low** |
| Keyword matching is fragile | Use AI extraction for subtle criteria | **Medium** |

---

## 7. Revised Solutions — Two-Pass Architecture

### 7.1 The Core Insight

The current approach conflates two separate questions into one AI call:
1. "Is this criterion relevant to this transcript?" (scope question)
2. "Did the candidate satisfy this criterion?" (quality question)

These are different tasks. Q1 is about **what was discussed**. Q2 is about **how well it was done**. Combining them into one complex AI call produces brittle, non-auditable results.

**The fix:** Separate them into two passes. Pass 1 is simple (constrained topic identification). Pass 2 is the existing criteria evaluation, but only runs against relevant criteria from Pass 1.

### 7.2 Two-Pass Architecture

```
Pass 1: TOPIC EXTRACTION (temperature 0, constrained output)
─────────────────────────────────────────────────────────
AI prompt: "Given this transcript, which of these topics
were discussed? Output a JSON array of topic IDs only."

Possible topics: [identity_discussion, access_request,
  password_security, network_config, malware_threat,
  data_handling, breach_concern, patch_discussion,
  external_vendor, secure_config]

AI output: ["identity_discussion", "access_request",
  "password_security", "data_handling"]

↓ (100% deterministic from here)

Pass 1.5: TOPIC → CRITERIA MAPPING (deterministic lookup)
─────────────────────────────────────────────────────────
Each framework criterion defines requiredTopics: string[]

ce_access_control ← [identity_discussion, access_request]
  ✓ Both topics present in extracted topics → RELEVANT

ce_malware_awareness ← [malware_threat]
  ✗ Topic NOT present → NOT_APPLICABLE

ce_firewall_config ← [network_config, secure_config]
  ✗ Neither topic present → NOT_APPLICABLE

↓

Pass 2: CRITERIA EVALUATION (temperature 0)
────────────────────────────────────────────
For RELEVANT criteria only:
AI evaluates pass/fail/partial with evidence quotes.
SAME as current AI evidence extraction, just filtered.

For NOT_APPLICABLE criteria:
Automatically set to status: 'not_applicable'
Evidence: "Topic not discussed in transcript"
Excluded from score calculation.
```

### 7.3 Why This Is More Robust

| Aspect | Old Approach | New Approach |
|--------|-------------|-------------|
| Relevance decision | Manual per-pack OR implicit in AI scoring | Two-step: AI identifies topics (simple task), deterministic mapping decides relevance |
| AI task complexity | "Is this criterion relevant AND did they pass?" (compound) | "Which topics were discussed?" (simple list) |
| Determinism risk | AI makes compound decision — error compounds | AI makes simple decision — deterministic mapping gates it |
| Audit trail | Can't trace why a criterion wasn't scored — was it irrelevant or did they fail? | Clear: "Not scored because topic 'malware_threat' was not discussed" |
| Scalability | Per-pack relevance file needs updating for every new pack | New pack = same topic extraction. No manual mapping maintenance. |

### 7.4 Topic Extraction — Constraining the AI

The topic extraction is designed to be maximally reliable:

```
1. CONSTRAINED OUTPUT: Only these exact topic strings are valid:
   [identity_discussion, access_request, password_security,
    network_config, malware_threat, data_handling, breach_concern,
    patch_discussion, external_vendor, secure_config]

2. TEMPERATURE ZERO: Same input = same output, every time.

3. STRUCTURED JSON: Response format: { topics: string[] }

4. SIMPLICITY CHECKS: If the AI returns a topic not in the
   allowed list → ignore it. If it returns null → fall back
   to pack taxonomy as default topics.

5. MINIMUM TOPICS: If no topics extracted (empty array),
   ALL criteria are treated as relevant (conservative default).
```

### 7.5 Fallback Strategy

If the AI topic extraction fails completely, we fall back to the pack's own metadata. Every pack already has a `taxonomyClassification` field (e.g., `['email.outlook', 'diagnostic.connectivity']`) which IS a classification of what the scenario is about:

```typescript
// Fallback: map pack taxonomy → topics
function packTaxonomyToTopics(taxonomy: string[]): string[] {
  const map: Record<string, string[]> = {
    'email.outlook': ['identity_discussion', 'access_request'],
    'identity.access_management': ['identity_discussion', 'password_security', 'access_request'],
    'onboarding.new_starter': ['identity_discussion', 'access_request', 'data_handling'],
    'email.shared_mailbox': ['identity_discussion', 'access_request'],
    'network.connectivity': ['network_config', 'external_vendor'],
    // ... more mappings
  };
  return taxonomy.flatMap(t => map[t] || []);
}
```

This gives us THREE layers of reliability:
1. **AI topic extraction** (primary) — adaptable, accurate, covers any transcription
2. **Pack taxonomy fallback** (backup) — deterministic, based on pack metadata
3. **All-criteria fallback** (safety net) — if both fail, score everything

### 7.6 Flaw #2 (Framework Authenticity) — Resolution

**Don't rename the frameworks.** Instead, be crystal clear about what they represent:

```
In the scoring breakdown UI:
  "Callum Baseline" → "Standard Assessment"
  "Cyber Essentials 2025" → "Cyber Essentials 2025 (Derived)"
  "ISO 27001:2022" → "ISO 27001:2022 (Derived)"

Disclaimer on every framework result:
  "This is an assessment mapping derived from [Standard Name].
   It evaluates candidate behaviours relevant to the standard's criteria.
   It is not a formal certification audit and does not constitute
   compliance certification."
```

The word "Derived" is honest, professional, and legally defensible. It means "we studied the standard, extracted the relevant parts, and built assessment criteria from them."

### 7.7 Flaw #3 (Weighting) — Resolution

**Don't compare percentages.** The UI changes:

```
BEFORE (confusing):                    AFTER (clear):
┌─────────────────────────┐           ┌─────────────────────────┐
│ Cyber Essentials: 86%   │           │ Cyber Essentials        │
│ GDPR: 29%               │           │ ─────────────           │
│ ISO 27001: 89%          │           │ Passed: 3/3 criteria   │
└─────────────────────────┘           │ Score: 86%              │
                                      │ (3 passed × 10pts each) │
                                      └─────────────────────────┘
```

Show both the percentage AND the raw pass count. E.g., "2/4 criteria passed (50%), 2 of 3 applicable criteria passed (67%)." This communicates that the score is driven by specific, countable evaluations, not some opaque formula.

### 7.8 Flaw #5 (Keyword Matching) — Resolution

**Replace ALL transcript_keyword criteria with ai_criteria.** The AI is better at understanding context than regex:

```
OLD (fragile, keyword match):
  checkType: 'transcript_keyword'
  checkTarget: 'ask for password|social security|bank details'
  passIf: 'pass'  // reversed — if keyword found → FAIL

NEW (robust, AI-evaluated):
  checkType: 'ai_criteria'
  checkTarget: 'gdpr_data_minimization'
  passIf: 'pass'
  // AI prompt: "Did the candidate ask for or request
  //    unnecessary personal data from the caller?"
```

The AI is prompted with the specific evaluation question for each criterion. This gives it the full context of the conversation ("I'm NOT going to ask for your password" vs "What's your password?") that keyword matching misses.

### 7.9 Implementation Plan (Revised)

| Step | What | Effort |
|------|------|--------|
| 1 | Replace all `transcript_keyword` checks with `ai_criteria` in framework definitions | 30 min |
| 2 | Add `TOPIC_CRITERIA_MAP` to evaluator — deterministic mapping from topics → criteria | 30 min |
| 3 | Add `TOPICS` constant — the allowed topic list for AI extraction | 10 min |
| 4 | Add `extractTopics(packTaxonomy)` function — returns topics from AI or fallback | 2 hours |
| 5 | Wire topic extraction into the evidence pool / framework evaluation | 1 hour |
| 6 | Update UI: framework display shows "Derived", pass count, disclaimer | 1 hour |
| 7 | Remove `pack-relevance.ts` file (replaced by topic-based relevance) | 5 min |
