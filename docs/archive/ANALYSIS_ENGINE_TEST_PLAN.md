# Analysis Engine Test Plan

## Test Files

| File | Type | What It Covers |
|------|------|----------------|
| `tests/analysis-engine.test.ts` | Unit (no AI calls) | 16 fixtures, score ranges, readiness, gates, determinism, evidence proxy, data quality |
| `scripts/test-50-transcripts.mjs` | Unit (no AI calls) | 50 realistic transcript scenarios |
| `scripts/test-analysis-hardening.mjs` | Unit (no AI calls) | 7 fail gate fixtures + reproducibility |
| `scripts/test-adversarial.mjs` | Unit (no AI calls) | 43 adversarial edge cases |
| `scripts/test-analysis-scoring.mjs` | Unit (no AI calls) | 10 pure scoring function tests |

## Fixtures in `tests/fixtures/analysis-engine/`

| Fixture | What It Tests | Breakpoints Covered |
|---------|---------------|-------------------|
| `excellent-password-reset.json` | Ideal call, all criteria pass | C1-C5, D5-D7 |
| `bad-password-reset.json` | No discovery, poor ticket | C3, C4, C5, H1 |
| `unsafe-password-reset.json` | Asks for password + MFA code | C1, G2 |
| `empty-ticket.json` | Good call but empty ticket | C4, H2 |
| `good-call-bad-ticket.json` | Good call, terrible ticket | C5 |
| `bad-call-good-ticket.json` | Bad call, excellent ticket | C3, C5 |
| `contradictory-candidate.json` | User gives conflicting info | G8 |
| `candidate-claims-false-actions.json` | Ticket claims actions not in transcript | B2, B3, G3 |
| `prompt-injection-candidate.json` | Candidate tries AI injection | G1 |
| `one-message-call.json` | Only one candidate message | C5, H1 |
| `ambiguous-minimal-call.json` | Vague customer, candidate tries | C3, G8 |
| `long-noisy-call.json` | Textbook perfect call | C1-C5 (positive) |
| `scenario-mismatch.json` | Printer transcript under outlook scenario | E1, E2 |
| `hidden-fact-probe.json` | Candidate asks probing questions | D5, D6 |
| `abusive-candidate.json` | Dismissive/refusal behavior | C1, C7, G8 |
| `ticket-fix-not-in-transcript.json` | Ticket claims extensive undocumented fix | B2, B3, G3 |

## Breakpoint Coverage

| Category | Total | Covered | Not Covered |
|----------|-------|---------|-------------|
| A. Determinism | 7 | 6 | A7 (standards snapshot fallback) |
| B. Evidence | 6 | 2 | B4-B6 (AI quality dependent) |
| C. Scoring nonsense | 7 | 6 | C6 (contradiction detection) |
| D. Hidden fact leakage | 7 | 4 | D5-D7 (AI caller behavior) |
| E. Scenario mismatch | 5 | 3 | E3, E5 |
| F. Manager calibration | 5 | 1 | F1, F3-F5 |
| G. Adversarial | 8 | 5 | G2, G6, G7 |
| H. Data quality | 9 | 4 | H3-H7, H9 |

**Total breakpoints: 54. Covered by fixtures/tests: 31. Remaining: 23.**

## How to Run

```bash
# Run all analysis engine tests (part of npm test)
npm test

# Run individual hardening tests
npm run test:analysis-hardening     # 7 fixtures + determinism
npm run test:analysis-scoring       # 10 pure scoring tests
node scripts/test-50-transcripts.mjs # 50 realistic transcript scenarios
node scripts/test-adversarial.mjs   # 43 adversarial edge cases
```

## Known Gaps

1. **No AI caller test** — testing the AI caller's hidden fact disclosure requires actual API calls
2. **Evidence grounding** — verifying quotes exist in transcript needs AI extraction output
3. **Manager calibration** — feedback integrity tests need route-level integration tests
4. **Non-English** — all fixtures are English
5. **Long transcript truncation** — not tested
