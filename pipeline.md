# Pipeline Testing Framework

> Compare different analysis architectures on the same test transcripts to determine which produces the best, fairest, most reliable results.

---

## Current Test Transcripts

We have 3 test transcripts in `tests/fixtures/analysis-engine/` that probe different edge cases:

| ID | File | What It Tests |
|----|------|---------------|
| **T1** | `gold-mfa-unsafe.json` | Excellent candidate — safe MFA handling, no password requests, good diagnosis |
| **T2** | `tricky-perfect-but-abusive.json` | Technically perfect troubleshooting BUT swore at/swore at customer |
| **T3** | `tricky-pii-over-phone.json` | Polite and helpful BUT asked for unnecessary PII, read out temp password over phone, logged PII in ticket |

Each transcript has expected values (criteria statuses, red flags, score range) that represent the "ground truth" — what a fair assessment should produce.

---

## Pipeline Architectures to Test

Each pipeline takes (transcript, ticket) and produces (criteria results, red flags, scores, compliance verdict). The differences are in **how relevance is determined** and **how validation works**.

### Pipeline A: Current Production (Baseline)

```
transcript + ticket
  → AI evidence extraction (1 call, temp=0)
  → Deterministic scoring (scoreExtraction + computeFinalScore)
  → Compliance evaluation (pack-relevance.ts filters criteria)
  → Narrative generation (1 call, temp=0.3)
```

- **Relevance:** Manual `pack-relevance.ts` mapping
- **Validation:** `validateEvidenceGrounding()` — deterministic quote checking
- **AI calls:** 2
- **Status:** ✅ Working, 194 tests pass

### Pipeline B: AI-Decides Relevance (One Call)

```
transcript + ticket
  → AI evidence extraction (1 call, temp=0) — each criterion includes `relevant: bool`
  → Relevance filter: skip criteria where AI said relevant=false
  → Deterministic scoring
  → Compliance evaluation (uses AI relevance instead of pack-relevance.ts)
  → Narrative generation
```

- **Relevance:** AI decides per-criterion in the same extraction call
- **Validation:** Same grounding check
- **AI calls:** 2
- **Change from A:** Add `relevant` field to AI output. Replace pack-relevance filter with AI-relevance filter.
- **Cost:** Identical to A (same number of calls)
- **Risk:** AI might mark things relevant that aren't (false positive), or miss things (false negative)

### Pipeline C: Two-Pass Audit (Your Idea)

```
transcript + ticket
  → Pass 1: AI evidence extraction (1 call, temp=0) — broad analysis
  → Deterministic scoring
  → Compliance evaluation
  → Pass 2: AI verifier (1 call, temp=0) — audits Pass 1's output
    → Prompt: "Given this transcript and the system's analysis below,
               for each criterion state AGREE or DISAGREE with the score.
               If DISAGREE, quote the transcript and explain why."
  → Final output combines both passes — show agreement rate
```

- **Relevance:** Pass 1 decides. Pass 2 audits the decision.
- **Validation:** Pass 2 AI + deterministic grounding
- **AI calls:** 3 (extraction + narrative + verifier)
- **Change from A:** Add verifier call. Modify output to include per-criterion agreement.
- **Cost:** +50% AI calls (~$0.001 per assessment)

### Pipeline D: Two-Pass with Different Models

Same as C, but Pass 2 uses a different model (e.g., smaller/cheaper verifier vs larger analyzer). Tests whether a cheaper model can reliably audit a more expensive one.

### Pipeline E: Deterministic-Only (No Verifier AI)

```
transcript + ticket
  → AI evidence extraction (1 call, temp=0)
  → Deterministic scoring (scoreExtraction)
  → Deterministic evidence grounding (quote verification)
  → Deterministic compliance (pack-relevance.ts)
  → Deterministic narrative (template-based, no AI)
```

- **Relevance:** Manual `pack-relevance.ts`
- **Validation:** Deterministic only
- **AI calls:** 1
- **Cost:** ~50% less than A
- **Risk:** Narrative quality suffers (template feedback vs AI-generated)

---

## Testing Harness

The harness lives at `scripts/run-pipeline-tests.ts` and works as follows:

```typescript
// Each pipeline implements this interface:
interface AnalysisPipeline {
  name: string;
  run(transcript: Transcript, ticket: Ticket): Promise<PipelineResult>;
}

interface PipelineResult {
  criteria: Record<string, { status: string; evidence: string[]; relevant: boolean }>;
  redFlags: Array<{ type: string; severity: string; evidence: string }>;
  score: number;
  readiness: 'ready' | 'needs_supervision' | 'not_ready';
  compliance: CombinedComplianceResult;
  validation: {
    groundedQuotes: number;
    ungroundedQuotes: number;
    agreementRate?: number;  // Only for C/D
    warnings: string[];
  };
  cost: {
    aiCalls: number;
    estimatedTokens: number;
  };
}
```

### Running Tests

```bash
# Run all pipelines against all transcripts
npx tsx scripts/run-pipeline-tests.ts

# Run specific pipeline against specific transcript
npx tsx scripts/run-pipeline-tests.ts --pipeline C --transcript tricky-perfect-but-abusive

# Output comparison table
npx tsx scripts/run-pipeline-tests.ts --compare
```

### Comparison Matrix

Each pipeline run produces a row in this comparison:

```
┌──────────────────────┬──────────┬──────────────┬──────────────┬──────────────┐
│ Metric               │ Pipeline A│ Pipeline B   │ Pipeline C   │ Pipeline D   │
├──────────────────────┼──────────┼──────────────┼──────────────┼──────────────┤
│ Correct score (T1)   │   80     │     ?        │     ?        │     ?        │
│ Correct score (T2)   │   55     │     ?        │     ?        │     ?        │
│ Correct score (T3)   │   40     │     ?        │     ?        │     ?        │
│ Red flags detected   │          │              │              │              │
│  - severe_abuse (T2) │   ✓      │     ?        │     ?        │     ?        │
│  - unsafe_sec (T3)   │   ✓      │     ?        │     ?        │     ?        │
│ Evidence grounding % │          │              │              │              │
│ AI calls             │    2     │     2        │     3        │     3        │
│ Est. cost/assessment │  $0.0024 │   $0.0024    │   $0.00325   │   $0.003     │
│ False relevance (T1) │   N/A    │     ?        │     ?        │     ?        │
│ Missed relevance (T1)│   N/A    │     ?        │     ?        │     ?        │
└──────────────────────┴──────────┴──────────────┴──────────────┴──────────────┘
```

---

## What We're Testing Specifically

### 1. Relevance Accuracy

For each criterion, does the pipeline correctly decide if it's relevant?

```typescript
const groundTruth: Record<string, boolean> = {
  // For password-reset scenario:
  ce_malware_awareness: false,     // malware not discussed in a password reset
  identity_check: true,            // identity IS checked in password reset
  gdpr_data_minimization: true,    // relevant — candidate might ask for PII
  // ...
};
```

Measure: **precision** (criteria marked relevant that should be) and **recall** (criteria marked irrelevant that should be).

### 2. Hallucination Detection

How often does the pipeline catch AI hallucinations (claims not supported by transcript)?

- **Pipeline A:** `validateEvidenceGrounding()` catches quote mismatches
- **Pipeline C:** Pass 2 AI can catch semantic hallucinations (AI said "candidate asked for password" when transcript shows they didn't)
- **Pipeline E:** Only catches exact quote mismatches, not semantic hallucinations

### 3. Cost vs Accuracy Tradeoff

| Pipeline | AI calls | Est. cost/100K | Key weakness |
|----------|----------|----------------|--------------|
| A | 2 | $240 | pack-relevance maintenance |
| B | 2 | $240 | AI relevance may be unreliable |
| C | 3 | $325 | Extra cost, more complex |
| D | 3 | ~$280 | Different model may disagree |
| E | 1 | $120 | No narrative quality |

### 4. Edge Cases Each Pipeline Should Handle

| Edge Case | Pipelines That Handle It | Pipelines That Don't |
|-----------|------------------------|---------------------|
| Candidate swears at customer | All (detected by AI extraction) | None |
| Candidate asks for PII unnecessarily | All (AI extraction detects it) | None |
| AI hallucinates a quote | A, C, D (grounding catches it) | E (no grounding, if removed) |
| AI marks irrelevant criteria as relevant | B, C, D (C has second check) | A (pack-relevance is manual) |
| Pack not yet mapped in pack-relevance.ts | B, C, D (AI decides) | A, E (no mapping → scores everything) |
| Very long transcript exceeds token limit | All fail equally | None |
| Candidate speaks in non-English language | All fail equally | None |

---

## Implementation Plan

### Phase 1: Harness (This Sprint)

1. Create `scripts/run-pipeline-tests.ts` — the comparison framework
2. Implement Pipeline A (current production code, already exists as reference)
3. Run against all 3 transcripts, record baseline results
4. Add a `--compare` flag that outputs the comparison matrix

### Phase 2: Pipeline B — AI Relevance

1. Modify `evidencePrompt.ts` to add `"relevant": true/false` to each criterion output
2. Create `PipelineB` in the harness that uses AI relevance instead of pack-relevance.ts
3. Run against all 3 transcripts, compare with baseline

### Phase 3: Pipeline C — Two-Pass Verifier

1. Create `verifierPrompt.ts` — the Pass 2 auditor prompt
2. Create `runVerifierPass()` in the analysis pipeline
3. Create `PipelineC` in the harness
4. Run against all 3 transcripts, compare with baseline

### Phase 4: Pipeline D — Different Models

1. Add model config to the harness
2. Test different model pairs (gpt-4o-mini for Pass 1, cheaper model for Pass 2)
3. Run comparison

### Phase 5: Analysis & Decision

1. Generate the full comparison matrix
2. Identify which pipeline:
   - Most accurately detects red flags
   - Most accurately scores criteria
   - Best bang for buck
3. Make a build recommendation

---

## File Structure

```
scripts/run-pipeline-tests.ts     ← Main harness
scripts/pipelines/pipeline-a.ts   ← Current production
scripts/pipelines/pipeline-b.ts   ← AI decides relevance
scripts/pipelines/pipeline-c.ts   ← Two-pass verifier
scripts/pipelines/pipeline-d.ts   ← Two-pass different models
lib/mvp/analysis/verifierPrompt.ts ← Pass 2 auditor prompt (for C/D)
```

---

## How to Read Results

For each transcript, the pipeline outputs:

```
Transcript: tricky-perfect-but-abusive
────────────────────────────────────────────────────
Pipeline A (current):
  Score: 55 | Readiness: not_ready | AI calls: 2
  Red flags: [severe_customer_abuse]
  Criteria: 22 evaluated, 0 not_applicable
  Grounding: 18/22 quotes verified, 4 warnings

Pipeline C (two-pass verifier):
  Score: 55 | Readiness: not_ready | AI calls: 3
  Red flags: [severe_customer_abuse]
  Criteria: 22 evaluated, 0 not_applicable
  Pass 2 agreement: 20/22 criteria (91%)  ← NEW METRIC
  Disagreements: 
    - customer_tone: Pass 1=partial, Verifier=FAIL 
      "Candidate literally swore at customer - 'fuck' alone is a fail"
```

The **agreement rate** in Pipeline C is the key metric we don't have today. It tells us how much confidence we should have in the analysis. A low agreement rate (< 80%) signals the pipeline is unreliable. A high rate (> 95%) means we can trust the results.
