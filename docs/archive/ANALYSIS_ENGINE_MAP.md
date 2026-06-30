# Analysis Engine Map

## Entry Routes

| Method | Route | Handler |
|--------|-------|---------|
| POST | `/api/mvp/assessments/[id]/analyse` | `app/api/mvp/assessments/[id]/analyse/route.ts` → `runBaseCallumAnalysis()` |

## Pipeline Stages

```
Client POST /api/mvp/assessments/:id/analyse
  │
  ├─ 1. initTables() / seedDefaults()    — ensures SQLite schema + seed data
  │
  ├─ 2. runBaseCallumAnalysis(assessmentId)
  │     │
  │     ├─ buildAssessmentContext()       — loads assessment, session, messages, ticket
  │     │                                   from SQLite via lib/mvp/query.ts
  │     │
  │     ├─ FAIL GATE: missing ticket     → returns TICKET_NOT_FOUND error
  │     ├─ FAIL GATE: no messages        → returns NO_MESSAGES_FOUND error
  │     │
  │     ├─ buildAnalysisInputHash()       — SHA-256 of transcript + ticket + scenario +
  │     │                                   rubric version + prompt version + model
  │     │
  │     ├─ CACHE CHECK: existing hash     → returns cached result if exists + complete
  │     │
  │     ├─ CREATE analysis_runs record    — status = 'running'
  │     │
  │     ├─ LAYER 1: Evidence Extraction
  │     │     buildEvidenceExtractionPrompt()  → system/user prompt
  │     │     runAiTask('evaluator', ...)       → AI call (temperature 0)
  │     │     parseExtractionJson()             → validate + normalize
  │     │
  │     ├─ LAYER 2: Deterministic Scoring
  │     │     scoreExtraction({ criteria, redFlags, weights, thresholds })
  │     │       ├─ weighted average → rawScore
  │     │       ├─ detectFailGates() → gateHits
  │     │       ├─ computeFinalScore() → cap + readiness
  │     │       └─ returns: score, rawScoreBeforeCaps, readiness, gateHits, ...
  │     │
  │     ├─ LAYER 3: Narrative Feedback
  │     │     buildNarrativePrompt()      → system/user prompt (score-locked)
  │     │     runAiTask('evaluator', ...)  → AI call (temperature 0.3)
  │     │     parseNarrativeJson() / buildFallbackNarrative()
  │     │
  │     ├─ INSERT assessment_results      — stores score, readiness, structured JSON
  │     ├─ UPDATE assessment set status   → 'analysed'
  │     ├─ UPDATE analysis_runs           → status = 'complete', link result_id
  │     │
  │     └─ return { status, score, readiness, structured }
```

## Database Tables Used

| Table | Read | Write | Purpose |
|-------|------|-------|---------|
| `assessments` | ✓ | ✓ | Assessment status, scenario_id, criteria_version_id, manager_profile_id |
| `sessions` | ✓ | | Session linked to assessment |
| `messages` | ✓ | | Chat transcript (role + content) |
| `tickets` | ✓ | | Candidate-submitted ticket text |
| `assessment_results` | ✓ | ✓ | Score, readiness, raw_model_json (structured), strengths, weaknesses |
| `analysis_runs` | ✓ | ✓ | Execution metadata: hash, model, prompt/rubric versions, status, error_code, result_id |
| `manager_standards` | ✓ | | Current standards for snapshot |
| `scenarios` | ✓ | | Scenario content (initial message, caller persona, hidden facts) |
| `assessment_criteria_versions` | ✓ | | Rubric criteria JSON |
| `manager_feedback` | ✓ | ✓ | Manager review (label, score, notes) |

## AI Provider Calls

| Call | Provider | Model | Temperature | Purpose |
|------|----------|-------|-------------|---------|
| Layer 1 | `runAiTask('evaluator', ...)` | `AI_EVALUATOR_MODEL` or mock | 0 | Evidence extraction |
| Layer 3 | `runAiTask('evaluator', ...)` | `AI_EVALUATOR_MODEL` or mock | 0.3 | Narrative feedback |

If `OPENROUTER_API_KEY` is not set, the mock provider is used, returning deterministic placeholder responses.

## Prompt Files

| File | Purpose |
|------|---------|
| `lib/mvp/analysis/evidencePrompt.ts` | `EVIDENCE_PROMPT_VERSION = 'evidence-extraction-v2-analysis-hardening'` — system + user prompt for extraction |
| `lib/mvp/analysis/narrativePrompt.ts` | `NARRATIVE_PROMPT_VERSION = 'narrative-feedback-v2-analysis-hardening'` — score-locked narrative prompt |

## Scoring Functions

| Function | File | Pure? | Purpose |
|----------|------|-------|---------|
| `scoreExtraction()` | `scoring.ts` | ✓ Yes | Full scoring pipeline: weights + gates + cap |
| `detectFailGates()` | `scoring.ts` | ✓ Yes | Map red flags to gate hits |
| `computeFinalScore()` | `scoring.ts` | ✓ Yes | Apply cap + determine readiness |
| `buildFallbackResult()` | `scoring.ts` | ✓ Yes | Error case result |

## Where Score Is Calculated

**Score is 100% code-generated.** AI never decides the score.

1. AI outputs criteria statuses (pass/partial/fail) and red flags
2. Code in `scoreExtraction()` computes weighted average
3. Code in `detectFailGates()` / `computeFinalScore()` applies caps and readiness
4. Narrative AI cannot change score

## Where Readiness Is Calculated

Readiness is determined by code in `computeFinalScore()`:
- If any critical gate → `not_ready`
- If major gates → `overrideReadiness` (capped by score floor: <60 → `not_ready`)
- Otherwise → threshold on final score (ready ≥80, needs_supervision ≥60, not_ready <60)

## Where Evidence Quotes Are Generated

Evidence quotes come from the AI evidence extraction step. Each criterion has an `evidence` array with quotes from transcript/ticket. These are collected by `collectEvidenceQuotes()` in `runBaseCallumAnalysis.ts`.

## Where Hidden Facts Are Used

Hidden facts are loaded from `scenarios.hidden_facts_json` in `buildAssessmentContext()` and passed ONLY to the evidence extraction prompt and narrative prompt as context. They are NOT returned to candidate-facing routes.

## Candidate-Safe Scenario

The legacy `lib/assessment-data.ts` has a `safeScenario()` function that strips hidden facts. The active MVP candidate route (`app/api/mvp/assessment/[token]/route.ts`) manually selects only safe fields: `id`, `title`, `candidate_name`, `status`, `session_id`, `messages`, `has_ticket`, `scenario_title`. It does not return raw scenario rows.

## Result Persistence

| Table | Fields Stored |
|-------|---------------|
| `assessment_results` | `overall_score`, `readiness_label`, `summary`, `raw_model_json` (full structured), `strengths_json`, `weaknesses_json`, `checkpoint_json` |
| `analysis_runs` | `status`, `result_id`, `error_code`, `error_message`, `input_hash`, `model`, `model_provider`, `prompt_version`, `rubric_version`, `analysis_type` |

## Manager Feedback

| Table | Fields |
|-------|--------|
| `manager_feedback` | `assessment_id`, `result_id`, `manager_label`, `manager_score`, `notes` |
| `manager_criterion_feedback` | `feedback_id`, `criterion_id`, `original_status`, `manager_status`, `original_score`, `manager_score`, `manager_comment` |
