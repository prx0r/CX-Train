# Next Steps — CX-Train / CallCallum

Prioritising backend architecture, data integrity, and flow completeness over feature count.

## Build Order

```
Milestone A: Standards + Packs         (done — manager_standards + assessment_packs seeded)
Milestone B: Analysis Run Infrastructure (analysis_runs, hashing, context builder, central pipeline)
Milestone C: Deterministic Base Callum   (evidence extraction prompt, code-based scoring, narrative feedback)
Milestone D: Granular Manager Feedback   (criterion overrides, corrected rating, per-criterion labels)
Milestone E: Candidate Scorecard v0      (aggregate strengths/weaknesses across sessions)
Milestone F: Callum For You v0           (manager-calibrated judgement using feedback history)
```

---

## Milestone B — Analysis Run Infrastructure

Build the scaffolding that the scoring pipeline will run on.

### New tables

- `analysis_runs` — each execution record: session, assessment, prompt version, rubric version, model, provider, input hash, status
- `analysis_results` — structured output: rating, score, summary, structured JSON, evidence

### Key work

- Input hashing helper: hash(transcript + ticket + pack id/version + standards updated_at + rubric version + prompt version + model)
- If same hash exists and status is complete, return cached result
- Analysis context builder: `buildAssessmentContext({ sessionId, assessmentId, managerId, orgId })` returning org, manager, standards, assessment, pack, transcript, ticket, candidate, candidateHistory, previousFeedback
- Central `runBaseCallumAnalysis()` orchestrator
- Prompt version constants (don't hardcode prompt strings)

**Files:** `lib/mvp/analysis/types.ts`, `lib/mvp/analysis/context.ts`, `lib/mvp/analysis/hash.ts`, `lib/mvp/analysis/prompts.ts`, `lib/mvp/analysis/runBaseCallumAnalysis.ts`

---

## Milestone C — Deterministic Base Callum Analysis

The analysis engine itself — use AI for evidence extraction and classification, code for scoring and rating.

### Evidence extraction (AI call, temperature 0)

Prompt intent: classify each criterion as pass/partial/fail/not_applicable with transcript/ticket evidence. Do not score freely.

Output JSON: `{ criteria: { [key]: { status, evidence[], notes } }, missed_questions: string[], red_flags: [{ type, evidence }], ticket_assessment: { status, missing_fields, evidence } }`

### Deterministic scoring (code)

- pass=1, partial=0.5, fail=0, not_applicable=excluded
- Apply rubric weights from assessment_pack
- Rating thresholds: Ready >=80, Needs Supervision >=60, Not Ready <60
- Dealbreaker overrides: unsafe_advice → max Not Ready, invented_fix → max Needs Supervision, critical_urgency_missed → max Needs Supervision

### Narrative feedback (second AI call)

Score/rating are fixed by code. AI only writes explanation: summary, strengths, improvements, most costly miss, ticket feedback, better phrasing examples, manager standard fit, coaching focus.

### Save result

Save analysis_run + analysis_result with full metadata. Do not overwrite previous results unless same hash.

**Files:** `lib/mvp/analysis/scoring.ts`, `lib/mvp/analysis/runBaseCallumAnalysis.ts` (extend)

---

## Milestone D — Granular Manager Feedback

Manager feedback is the product moat — it's how Callum learns what each manager values.

### Feedback form additions

- Was Callum right? (too harsh / about right / too lenient / wrong focus)
- Manager rating override (Ready / Needs Supervision / Not Ready)
- Manager score (0-100)
- What did Callum miss? (free text)
- Criterion overrides: show core labels (impact, urgency, ticket quality, next steps, customer tone, technical discovery, escalation judgement, safety) and let manager set pass/partial/fail/not_applicable

### Storage

- Preserve original Callum labels
- Store manager overrides alongside them
- Criterion overrides as JSON: `{ "impact": "fail", "urgency": "partial", ... }`
- Tie feedback to analysis_run, session, assessment

### Later (Milestone F)

- Use accumulated overrides to calibrate Callum For You per manager

**Files:** `app/mvp/assessments/[id]/page.tsx` (extend feedback section), `app/api/mvp/assessments/[id]/feedback/route.ts` (extend schema)

---

## Milestone E — Candidate Scorecard v0

After each analysis, generate/update a scorecard per candidate.

### Scorecard data

- Latest rating and score
- Average score across sessions
- Strengths (criteria passed repeatedly)
- Weaknesses (criteria failed repeatedly)
- Progress summary text

### Logic

If candidate has 3 sessions and failed urgency twice, add urgency to weaknesses. If passed customer tone repeatedly, add to strengths.

### API

`GET /api/mvp/candidates/[id]/scorecard`

### Page

Simple panel on the assessment detail page linking to candidate scorecard, or a new `/mvp/people` page.

**Files:** `lib/mvp/scorecard.ts`, `app/api/mvp/candidates/[id]/scorecard/route.ts`

---

## Milestone F — Callum For You v0

A second analysis layer that predicts how *this specific manager* would judge the candidate.

### Inputs

- Base Callum analysis
- Transcript + ticket
- Manager standards
- Recent manager feedback (last N entries)
- Manager profile summary (if available)

### Output

- Rating, score, confidence (low/medium/high)
- Why-list explaining deviation from base Callum
- Saved as `analysis_run` with `analysis_type = 'callum_for_you'`

### Trigger

Manual from result page initially. Automatic once manager has enough feedback history.

**Files:** `lib/mvp/analysis/runCallumForYou.ts`, `app/mvp/assessments/[id]/page.tsx` (add Callum For You section)

---

## Stretch / Later

- Assessment batching / bulk invite (CSV import)
- Retake/replay support (session per attempt)
- Soft delete for assessments
- Schema-backed versioning for everything (migration scripts)
- Dashboard polish (sorting, filtering, export)
- Multi-tenant auth (org_id/manager_id migration on existing tables)
