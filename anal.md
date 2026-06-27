# Assessment Analysis — Framework Validation & Evidence Pipeline

> **Status:** Mid-development audit of all 10 frameworks, 80+ criteria, evidence validation pipeline.
> **AI Model:** deepseek-v4-flash via opencode-go
> **Test Transcripts:** 5 edge-case transcripts (gold MFA, abusive, PII leak, passive-aggressive, ambiguous PII)

---

## Framework Coverage Validation

We have 10 frameworks registered in `DEFAULT_FRAMEWORKS`. Each contributes criteria to the assessment.

| Framework | Criteria | Status | Notes |
|-----------|----------|--------|-------|
| Callum Baseline | 23 | ✅ Full coverage | System-level: submitted_ticket, performed_triage, safety |
| Cyber Essentials 2025 | 7 | ✅ Full coverage | System-level: ce_unauthorized_access |
| GDPR / UK DPA 2018 | 6 | ✅ Full coverage | |
| ISO 27001:2022 | 8 | ✅ Full coverage | System-level: iso_incident_mgmt, iso_classification |
| Kepner-Tregoe Problem Analysis | 7 | ✅ Full coverage | |
| SERVQUAL Service Quality | 10 | ✅ Full coverage | Maps to shared checkTargets (identity_check, technical_discovery) |
| SBAR Structured Communication | 4 | ✅ Full coverage | |
| LEAP/HEAT Customer Interaction | 4 | ✅ Full coverage | |
| ITIL Incident Management | 6 | ✅ Full coverage | |
| ITIL Service Desk Practice | 5 | ✅ Full coverage | |

**Total: 80 criteria across 10 frameworks.**

All criteria from all 10 frameworks are included in every assessment run. The AI extraction prompt contains all 42 unique extraction keys (shared checkTargets are deduplicated).

---

## Evidence Pipeline Architecture

### Three Evidence States

```
verified       ✅   Transcript quote found verbatim. Criterion contributes to validated score.
not_observed   –    AI couldn't determine or event data not available. Scores 0. No flag.
invalidated    ⊘   Topic not discussed in this call. Excluded from scoring entirely.
```

### Which Criteria Can Be Invalidated

| Check Type | Can Be Invalidated? | Reason |
|-----------|---------------------|--------|
| `ai_criteria` | ✅ Yes | Conversation topic wasn't discussed |
| `transcript_keyword` | ✅ Yes | Keywords not found in transcript |
| `ticket_field` | ⚠️ Rarely | Only if ticket text is completely empty |
| `event_check` | ❌ Never | System event — if not found, it's 0, not irrelevant |
| `action_performed` | ❌ Never | System action — same as above |
| `action_not_performed` | ❌ Never | System action — same as above |

**System-level criteria (never invalidated):**
- `submitted_ticket` — event_check
- `performed_triage` — event_check
- `safety` — action_not_performed
- `ce_unauthorized_access` — action_not_performed
- `iso_incident_management` — event_check
- `iso_classification` — event_check

### Evidence Sources

The evidence pool is assembled from two sources:

1. **AI extraction (primary)** — The deepseek-v4-flash call returns per-criterion evidence quotes from the transcript
2. **Validator fallback (secondary)** — If AI didn't supply a quote, the validator searches the transcript using criterion-specific keyword patterns

The validator checks AI quotes first. If they exist and are found verbatim → ✅ verified. If not → fallback search. If fallback finds nothing → not_observed or invalidated.

---

## Real AI Test Results

### Gold MFA (good candidate)

| Metric | Value |
|--------|-------|
| Raw score | 74 |
| Validated score | 39 |
| Verified | 37 |
| Invalidated (irrelevant) | 5 |
| Not observed | 38 |
| Red flags | None |

The low validated score (39 vs 74 raw) reflects that many criteria passed but lack transcript evidence quotes. The gap flags the assessment as having low evidence quality — a manager should review.

### Tricky Perfect But Abusive

| Metric | Value |
|--------|-------|
| Raw score | 78 |
| Validated score | 60 |
| Verified | 41 |
| Invalidated (irrelevant) | 32 |
| Not observed | 7 |
| Red flags | severe_customer_abuse, unprofessional_conduct |

Correctly detected both red flags. The abuse gate caps the score. 32 criteria marked irrelevant — mostly security/compliance criteria that weren't discussed in this password-reset call. System-level criteria (submitted_ticket, performed_triage) now show as not_observed instead of invalidated.

### Tricky PII Over Phone

| Metric | Value |
|--------|-------|
| Raw score | 44 |
| Validated score | 18 |
| Verified | 20 |
| Invalidated (irrelevant) | 35 |
| Not observed | 25 |
| Red flags | unsafe_security_behaviour |

Security violation correctly detected. Low validated score reflects weak evidence quality — many pass criteria lack transcript quotes.

### Tricky Passive Aggressive

| Metric | Value |
|--------|-------|
| Raw score | 73 |
| Validated score | 50 |
| Verified | 34 |
| Invalidated (irrelevant) | 27 |
| Not observed | 19 |
| Red flags | unprofessional_conduct (✅ now detected) |

The `unprofessional_conduct` red flag now fires correctly for passive-aggressive behaviour (sighs, condescension). Validated score 50 reflects borderline evidence quality.

### Tricky Ambiguous PII

| Metric | Value |
|--------|-------|
| Raw score | 73 |
| Validated score | 52 |
| Verified | 30 |
| Invalidated (irrelevant) | 28 |
| Not observed | 22 |
| Red flags | None |

Borderline PII request (DOB for ID check) not flagged as security issue — correctly handled. Validated score gap reflects evidence quality concern.

---

## Evidence Quality Issues

### 1. Shared checkTarget evidence mapping

Multiple framework criteria read from the same AI extraction key. Example:

```
AI extracts:  identity_check = "What's your name and company?"
Mapped to:
  - callum_baseline_v1 → identity_check ✅ works
  - cyber_essentials_2025 → ce_access_control (checkTarget: identity_check) ✅ works via mapping
  - gdpr_2018 → gdpr_identity_verified (checkTarget: identity_check) ✅ works via mapping
  - iso_27001_2022 → iso_access_control (checkTarget: identity_check) ✅ works via mapping
```

The checkTarget mapping in the results page handles this — see `checkTargetMap` in `page.tsx`.

### 2. System-level criteria never invalidated

Fixed. System-level criteria (event_check, action_performed, action_not_performed) no longer get marked as irrelevant. They correctly show as `not_observed` when event data is absent.

### 3. Evidence quote truncation

Fixed. Quotes are stored full-length and only truncated for display. Verbatim matching against transcript is always exact.

### 4. Auto-generated evidence strings

The compliance evaluator generates auto-evidence like "Event not found" or "Keyword found in transcript". The validator correctly ignores these — they don't count as real evidence. Only actual transcript quotes from the AI are accepted.

---

## Validator Reliability

The validator uses three methods to find evidence, in order:

| Method | Reliability | Example |
|--------|------------|---------|
| AI-supplied quote | ✅ High | AI says evidence="What's your name?" — searched verbatim |
| Keyword pattern match | ⚠️ Medium | Pattern "name" finds "What's your name?" in transcript |
| Label word fallback | ⚠️ Low | Extracts keywords from criterion label, searches transcript |

The AI-supplied quote method is the most reliable. The fallback methods can produce false positives (matching the wrong line) or false negatives (missing evidence for criteria without patterns).

**The validator is not perfect, but it's honest.** Every evidence decision is transparent — you can see the quote, the match method, and the transcript context.

---

## Recommendations

### 1. Improve AI evidence quoting

The biggest improvement would come from the AI providing better, more targeted evidence quotes. Current AI quotes are sometimes generic ("I understand that's urgent") rather than criterion-specific ("The issue is blocking my work — I have a deadline"). This is a prompt engineering fix.

### 2. Add evidence quality score

The gap between raw and validated scores is a useful metric. Consider adding an "Evidence Quality" score:

```
Evidence Quality = validatedScore / rawScore * 100
```

High (>90%): Strong evidence. Low (<60%): Review recommended.

### 3. System-level criteria defaults

System-level criteria (submitted_ticket, performed_triage) should default to 0/fail when no event data is available, not not_observed. This is already the behavior — they just show as `–` in the display rather than 0.

### 4. Validator should not override relevance

The validator's job is to check evidence, not decide relevance. Relevance should be determined by:
1. Pack-relevance mapping (which criteria does this scenario exercise?)
2. AI judgment (was this topic discussed?)
3. System events (did the event happen?)

The validator only checks step 3. Steps 1 and 2 are upstream.

---

## Files

| File | Purpose |
|------|---------|
| `lib/mvp/results/scoring-calculator.ts` | Evidence validation, three-state status, system-level criteria protection |
| `app/mvp/results/design-a/page.tsx` | Results display, checkTarget mapping, framework breakdown |
| `tests/fixtures/analysis-engine/ai-results/*.json` | Real AI extraction results for 5 test transcripts |
| `lib/mvp/analysis/evidencePrompt.ts` | AI extraction prompt (42 criteria) |
| `lib/mvp/compliance/frameworks/*.ts` | 10 framework definitions |
