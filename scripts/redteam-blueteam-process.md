# Red Team / Blue Team Process

> A reusable process for systematic security and quality auditing of the CX-Train platform.
> Designed so any agent (or human) can adopt these roles and carry out testing independently.

---

## Overview

The Red Team / Blue Team process is an iterative adversarial testing cycle:

```
┌────────────────────────────────────────────────────────────────┐
│  RED TEAM (Attack)                    BLUE TEAM (Defend)       │
│  ┌──────────────────┐                ┌──────────────────┐     │
│  │ 1. Reconnaissance│                │ 4. Triage & Fix   │     │
│  │ 2. Vulnerability │                │ 5. Implement      │     │
│  │    Discovery     │                │ 6. Validate       │     │
│  │ 3. Exploit Proof │                │ 7. Document       │     │
│  └────────┬─────────┘                └────────┬───────────┘     │
│           │                                    │                │
│           └──────────── Report ────────────────┘                │
│                                                               │
│              ↺ Iterate until stable ↺                          │
└────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Red Team — Session Setup

### Prerequisites
- Git repo cloned
- `npm install` completed
- `npm test` baseline: all tests passing (first time) or note known failures
- `docs/agent-notes/redteam.md` and `docs/agent-notes/blueteam.md` exist (or create fresh copies)

### Roles
- **Red Team Agent:** Adversarial mindset. Finds flaws, proves they're real.
- **Documenter:** Records findings in `docs/agent-notes/redteam.md`.

### 1.1 Reconnaissance

Scan these areas systematically:

```
📁 Target Areas:
├── Scoring Engine        → lib/mvp/analysis/scoring.ts
├── Compliance Evaluator  → lib/mvp/compliance/evaluator.ts
│   ├── Frameworks        → lib/mvp/compliance/frameworks/*.ts
│   └── Pack Relevance    → lib/mvp/compliance/pack-relevance.ts
├── Analysis Pipeline     → lib/mvp/analysis/runBaseCallumAnalysis.ts
│   ├── Evidence Prompt   → lib/mvp/analysis/evidencePrompt.ts
│   ├── Context Builder   → lib/mvp/analysis/context.ts
│   ├── Validation        → lib/mvp/analysis/validation.ts
│   └── Scoring           → lib/mvp/analysis/scoring.ts
├── Simulator             → lib/mvp/sim/
│   ├── State Machine     → stateMachine.ts
│   ├── Safe Projection   → safeProjection.ts
│   ├── Scoring           → scoring.ts
│   ├── Merge Config      → mergeConfig.ts
│   └── Packs             → packs/*.ts
├── AI Provider           → lib/ai/provider.ts
├── Database              → lib/mvp/db.ts, query.ts
├── API Routes            → app/api/mvp/**/*.ts
├── Auth Middleware       → middleware.ts
└── Test Fixtures         → tests/fixtures/**/*.json
```

### 1.2 Artifact Reading Checklist

For each target area, read:
- Type definitions (interfaces, types)
- Function signatures and return types
- Error handling paths (catch blocks, null checks)
- Data transformation pipelines (map/filter/reduce)
- State mutations
- Input validation
- Authentication/authorization guards
- Test fixtures and expected values

### 1.3 Vulnerability Discovery Checklist

For each file, ask:

| Question | What to Look For |
|----------|-----------------|
| **Dead code?** | Functions defined but never called. Parameters accepted but ignored. Fields that are always empty. |
| **Logic inversion?** | Boolean conditions that are backwards. `passIf` not matching actual behavior. |
| **Data loss?** | Fields dropped during mapping. Properties not included in return types. |
| **Type safety?** | `as any` casts. Missing null checks. Optional fields assumed present. |
| **Security?** | Direct interpolation of user input into prompts. No authentication. Weak RNG. No rate limiting. |
| **Race conditions?** | Sequential ID generation. No transaction isolation. |
| **Silent failures?** | Empty catch blocks. Default values that hide errors. |
| **Fixture drift?** | Test fixtures with expected values that don't match current code. |
| **Architecture mismatch?** | Documentation says one thing, code does another. Proposed designs that over-engineer simple problems. |
| **State machine?** | Missing phase validation. Actions available in wrong phases. Missing transition guards. |
| **Config injection?** | Unvalidated custom criteria. Negative weights. Bad JSON silently accepted. |

---

## Phase 2: Blue Team — Remediation

### 2.1 Triage

Severity classification:

| Severity | Criteria | Action |
|----------|----------|--------|
| CRITICAL | Data corruption, wrong scores, security breach, silent wrong results | Fix immediately, block release |
| HIGH | Incorrect scoring, security exposure, reliability issues | Fix this sprint |
| MEDIUM | Edge-case failures, misleading UI, latent bugs | Fix this iteration |
| LOW | Code quality, minor inconsistencies, docs | Fix when convenient |

### 2.2 Fix Strategy

For each finding:
1. **Read the full code path** — don't fix the symptom, fix the root cause
2. **Find the simplest fix** — prefer small surgical changes over architectural rewrites
3. **Consider side effects** — what else depends on this behavior?
4. **Add a verification test** — prove the fix works AND stays fixed

### 2.3 Implementation Checklist

```typescript
// Before:
const readiness: ReadinessLabel = verdict === 'PASS' ? 'ready' : 'not_ready';

// After:
const { score: finalScore, readiness } = computeFinalScore(rawScore, gateHits);
```

Always:
- Remove dead code paths
- Add logging to silent failures
- Validate inputs before processing
- Use `crypto.randomBytes()` over `Math.random()`
- Parameterize SQL queries (already done in this codebase)
- Add security guards around prompt injection surfaces

### 2.4 Validation

After each fix:
```bash
npm test  # All tests must pass
```

Before declaring done:
- Re-run ALL existing tests — 0 failures
- Add regression tests for each fixed bug
- Verify the fix doesn't break edge cases
- Run the verification test suite if one exists

---

## Phase 3: Re-Red-Team (Iteration)

### 3.1 Verify Fixes

For each BLUE TEAM fix, attempt to re-break it:

```typescript
// Example: verify computeFinalScore is connected
test('R1.1: poor ticket quality caps readiness', () => {
  const r = scoreExtraction({ criteria: badTicketCriteria() });
  assert.equal(r.rating, 'needs_supervision');  // was: 'ready' (wrong)
});
```

### 3.2 Probe for New Vulnerabilities

Fixed code can introduce new bugs. Check:
- Did the fix change behavior in unexpected ways?
- Did we add new code paths that need testing?
- Did we introduce new type assertions or casts?

### 3.3 Escalate if Fix Fails

If a fix is incomplete or introduces new issues:
1. Document what worked and what didn't in `docs/agent-notes/redteam.md`
2. Return to BLUE TEAM with specific failure details
3. BLUE TEAM revises the approach
4. Iterate

---

## Automation

### CI Integration

Add these checks to CI:

```yaml
# .github/workflows/redteam.yml (example)
steps:
  - name: Run all tests
    run: npm test
  
  - name: Validate framework definitions
    run: npx tsx scripts/validate-frameworks.ts
  
  - name: Validate pack structures
    run: npx tsx scripts/validate-packs.ts
  
  - name: Security audit
    run: npx tsx scripts/security-audit.ts
  
  - name: Fixture consistency check
    run: npx tsx scripts/check-fixtures.ts
```

### Scheduled Audits

| Frequency | Audit Type | Scope |
|-----------|-----------|-------|
| Per commit | Unit tests | All `npm test` |
| Per PR | Integration validation | Framework defs, packs, fixtures |
| Weekly | Security audit | Auth, prompt injection, rate limiting |
| Monthly | Full red team | All areas listed in 1.1 |
| Per release | Production readiness | All findings must be MEDIUM+ fixed |

---

## Script Templates

### Red Team Runner (`scripts/redteam-runner.ts`)

```typescript
/**
 * Automated red team scanner.
 * Usage: npx tsx scripts/redteam-runner.ts [--quick | --full]
 * 
 * --quick: Check scoring engine, compliance evaluator, test fixtures
 * --full:  Everything + security audit + prompt injection testing
 */

interface RedTeamFinding {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  file: string;
  line?: number;
  title: string;
  description: string;
  evidence?: string;
}

async function runRedTeam(mode: 'quick' | 'full'): Promise<RedTeamFinding[]> {
  const findings: RedTeamFinding[] = [];
  
  // 1. Score extraction consistency
  // 2. Framework definition validation
  // 3. Pack relevance coverage
  // 4. State machine phase validation
  // 5. Authentication checks (full only)
  // 6. Prompt injection surface (full only)
  // 7. Fixture calibration
  // 8. Token generation strength
  
  return findings;
}
```

### Blue Team Validator (`scripts/blueteam-validator.ts`)

```typescript
/**
 * Validates that all BLUE TEAM fixes are in place.
 * Usage: npx tsx scripts/blueteam-validator.ts
 * 
 * Returns PASS/FAIL for each fix category.
 */
```

---

## Red Team Report Template

Add findings to `docs/agent-notes/redteam.md`:

```markdown
### [SEVERITY] Title

**Location:** `file.ts:line`

**The Bug:** One-line description of what's wrong.

**Root Cause:** Why it exists (architecture, oversight, regression).

**Evidence:** 
- Test fixture `X` expects `Y` but gets `Z`
- Code path: `A → B → C` where `B` drops `field`
- Actual output vs. expected output

**Impact:** What this means for the product.

**Failing Tests (if any):** List of test names.
```

---

## Blue Team Fix Template

Add fixes to `docs/agent-notes/blueteam.md`:

```markdown
### [SEVERITY] Fix Title

**Root Cause:** ...

**Fix:**
```typescript
// Before:
...

// After:
...
```

**Why It Works:** ...

**Validation:** Test name that proves the fix.
```

---

## Quick-Start for New Agents

### To act as RED TEAM:
1. Read `docs/agent-notes/redteam.md` — understand current findings
2. Read `docs/agent-notes/blueteam.md` — understand what was fixed
3. Run `npm test` — establish baseline
4. For each area in 1.1, read the code and apply the checklist from 1.3
5. Add new findings to `docs/agent-notes/redteam.md`
6. Return the report

### To act as BLUE TEAM:
1. Read `docs/agent-notes/redteam.md` — understand all current findings
2. Read `docs/agent-notes/blueteam.md` — understand the fix strategy
3. For each finding, implement the simplest fix
4. Run `npm test` after each fix
5. Add verification tests
6. Update `docs/agent-notes/blueteam.md` with completed fixes
7. Return the results

### To iterate:
1. BLUE TEAM finishes → RED TEAM re-checks → if new findings → BLUE TEAM again
2. Continue until `npm test` passes AND RED TEAM finds no new CRITICAL/HIGH issues
