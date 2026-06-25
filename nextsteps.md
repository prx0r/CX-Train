# Next Steps — CX-Train / CallCallum

Prioritising backend architecture, data integrity, and flow completeness over feature count.

## 1. Manager Standards v0 — `/mvp/standards`

The current scoring criteria are hardcoded in `lib/mvp/db.ts` → `seedDefaults()`. A manager should be able to:

- View the active criteria set (checkpoints, weights, critical failures, readiness thresholds)
- Edit checkpoints (add/remove/reorder, adjust weights)
- Define multiple criteria versions and activate one at a time
- See which assessments were scored against which version

**Why this matters:** Without this, every scoring change invalidates past assessments. Versioning criteria is the foundation for defensible scoring.

**Files to touch:** `lib/mvp/query.ts` (add criteria CRUD), `app/api/mvp/standards/` (new API routes), `app/mvp/standards/page.tsx` (build out)

---

## 2. Multi-Scenario Support — let managers pick the caller scenario

Right now every assessment uses the same "Outlook not sending" scenario. The schema already has a `scenarios` table with multiple rows possible.

- Let the create-assessment form include a scenario selector
- Show scenario details (title, industry, difficulty, persona) when picking
- Manager can see which scenario was used on the detail page

**Why this matters:** Real MSPs handle many client types. Rotating scenarios prevents candidates from gaming the assessment. It's also the simplest backend win — the table already supports it.

**Files to touch:** `app/mvp/page.tsx` (extend create form), `app/api/mvp/assessments/route.ts` (accept scenario_id param), `lib/mvp/query.ts` (add `listActiveScenarios`)

---

## 3. Add `org_id` and `manager_id` to Tables

This is the schema migration that unlocks multi-manager and multi-tenant:

- Add `org_id TEXT NOT NULL DEFAULT 'org-default'` and `manager_id TEXT NOT NULL DEFAULT 'manager-default'` to `assessments`, `sessions`, `assessment_results`, `manager_feedback`
- Filter all queries by org/manager context
- The `defaultContext.ts` file created in Milestone 1 is the seed for this

**Why this matters:** Without this, all data is global. You can't have two managers using the same instance without stepping on each other. It's a small schema change but unblocks auth, teams, and analytics.

**Approach:** Do this as a migration script (not just seed defaults) so existing local DBs don't break.

---

## 4. Soft Delete / Archive for Assessments

Add a `deleted_at TEXT` column to assessments so managers can clean up their list without losing data. Update the list query to filter out soft-deleted rows unless explicitly requested.

**Why this matters:** The dashboard is immediately more useful when stale test entries can be hidden. No UI needed at first — just the backend toggle.

---

## 5. Scenario Performance Breakdown in Assessment Detail

The detail page (`/mvp/assessments/[id]`) currently shows raw transcript + AI analysis. Add a structured breakdown per checkpoint:

- Which checkpoints were passed/failed for this scenario
- Highlight missing info the candidate didn't ask for (didn't get hostname, didn't ask about recent changes)
- Compare against the scenario's `ideal_ticket_hints` for ticket scoring

**Why this matters:** Turns the detail page from "here's a score" into "here's exactly what they missed" — which is what a manager needs to coach.

**Files to touch:** `app/mvp/assessments/[id]/page.tsx`, `app/api/mvp/assessments/[id]/route.ts` (augment response with scenario comparison)

---

## 6. Test the AI Flow End-to-End Without External Dependencies

The 37 `test:mvp-flow` tests cover DB operations but skip AI calls. Add:

- A mock AI provider that returns deterministic fixture data
- Integration tests that go from create → chat → end → analyse → feedback using the mocks
- This catches regressions in the full flow without needing an OpenRouter key

**Why this matters:** The most fragile part of the app is the AI layer (network, rate limits, model changes). Locking down the flow with mocks makes it safe to refactor.

---

## 7. Assessment Batching / Bulk Invite

Let a manager enter multiple names (or paste a CSV) and create N assessments in one request. Each gets its own invite token and link.

**Why this matters:** The single-create form is fine for demo, but real managers have classes of 10-20 candidates. Bulk create is the cheapest UX win per backend line.

---

## 8. Schema-Backed Versioning for Everything

Once criteria have versions, do the same for:

- **Scenarios** — version the caller behaviour prompts so improvements don't break in-flight assessments
- **Rubric/Prompts** — track which AI system prompt was used for each analysis result
- **Migration scripts** — instead of `seedDefaults()` running on every create, use explicit migration files with up/down

**Why this matters:** Every assessment result becomes auditable. "Which criteria + prompt + scenario produced this score?" is the core question for a defensible assessment product.

---

## 9. Manager Dashboard Polish (low priority, high polish)

Once the backend is solid:

- Reusable table component with sort/filter
- Summary stats on `/mvp` that matter: pass rate, average score per scenario, recent trend
- Keyboard shortcuts (navigate with j/k, create with `c`)
- Export to CSV

**Why this is lower:** Visual polish on an incomplete backend is premature. Wait until the data model is stable.

---

## Ordering Philosophy

```
Milestone 2: Standards     →  (1)  — Criteria versioning, the backbone
Milestone 3: Scenarios     →  (2)  — Multi-scenario picker, low hanging fruit
Milestone 4: Multi-tenant  →  (3)  — org_id/manager_id migration
Milestone 5: Reliability   →  (6)  — Mock AI + integration tests
Milestone 6: Detail depth  →  (5)  — Scenario breakdown on detail page
```

Items 4, 7, 8, 9 are stretch or polish — slot in when the above is stable.
