# Recent Progress — Taxonomy Ground Truth v0 + Dataset Integration

## What was just built (this session)

### Dataset Integration (reference material only)
- Evaluated Mendeley Help Desk Tickets v2 (CC BY 4.0 — cleared for use) and Kaggle IT Helpdesk Chatbot (licence pending — not used)
- Created `docs/DATASET_EVALUATION.md`, `docs/DATASET_ATTRIBUTION.md`, `docs/DATASET_PROFILE_SUMMARY.md`
- Built dataset profiler (`scripts/datasets/profile-helpdesk-datasets.ts`) and support-quality bank builder (`scripts/datasets/build-support-quality-bank.ts`)
- Extracted 13 failure modes (missing scope, vague escalation, priority mismatch, etc.)
- Generated derived data: `failure-mode-bank.seed.json`, `ticket-quality-examples.seed.json`, `support-utterance-examples.seed.json`, `manager-scored-ticket-examples.seed.json`
- Added 6 new analysis-engine fixtures (vague-escalation, missing-scope, long-handoff, priority-mismatch, unclear-resolution, multi-message)

### Taxonomy Ground Truth v0
- Imported Master Triage classification list.xlsx (163 items — 115 Incidents, 48 Requests) into SQLite `taxonomy_items` table
- Auto-seeds on first init; manual import via `npm run taxonomy:import`
- `/mvp/taxonomy` page — searchable taxonomy browser with detail panel, type filters
- `/api/mvp/taxonomy/search?q=` endpoint with full-text search
- `taxonomy_item_id` field added to `assessment_packs`, `scenarios`, `assessment_results`, `analysis_runs`
- `TaxonomyClassificationMatch` type in analysis types — tracks predicted/expected classification, correctness, missed playbook questions, escalation guidance
- 5 taxonomy-linked gold fixtures:
  - `gold-wifi-good` (ready) vs `gold-wifi-bad-premature-reboot` (not_ready)
  - `gold-login-problem-good` (ready)
  - `gold-mfa-unsafe` (needs_supervision)
  - `gold-new-starter-electracom` (not_ready — Request-type scenario, incident rubric undervalues)
- `test:taxonomy` (7 tests) and `test:analysis:gold` (31 tests) scripts

### Test Results
- **129 tests, 129 pass, 0 fail**
- Build: Next.js build succeeds
- All analysis-engine fixtures validated (22 regular + 5 gold = 27 total)

## What existed before (last commit: `d64d2e1`)
- Phase 3: deterministic scoring hardened, 54 failure modes catalogued, 16 analysis fixtures, caching/reproducibility fixed
- Manager dashboard with 9-section nav, standards, assessment workflow
- 3 assessment packs (Outlook, Password Reset, Printer)
- Scoring: code-based deterministic with fail gates, derived gates, evidence grounding
- 71 tests passing

## Key differences vs previous
- **New**: Taxonomy ground truth v0 — structured classification data from XLSX
- **New**: Dataset integration boundary, profiler, derived data bank
- **New**: 11 new analysis-engine fixtures (6 dataset-pattern + 5 gold taxonomy-linked)
- **New**: `/mvp/taxonomy` page + `/api/mvp/taxonomy/search`
- **New**: Taxonomy-linked analysis types and columns
- **New**: Wi-Fi assessment pack (4th scenario)
- **Tests**: 71 → 129 (+58 new tests)

## Where to go after

### Immediate next steps (high priority)
1. **Wire taxonomy into actual analysis pipeline** — `analysis_runs.taxonomy_match_json` is stored but not yet populated by `runBaseCallumAnalysis.ts`. Needs to: look up the assessment pack's `taxonomy_item_id`, extract candidate's classification from the evidence, compare against taxonomy ground truth, compute `TaxonomyClassificationMatch`, include it in the analysis response and stored result.

2. **Taxonomy-linked scoring criteria** — Add criteria for "classification correct" and "playbook questions asked" to the deterministic scoring rubric. Currently gold fixtures validate structure but the scoring doesn't reward classification accuracy.

3. **Kaggle dataset licence check** — Manually download from Kaggle, verify licence, then integrate patterns or skip.

### Medium priority
4. **Assessment packs for gold scenarios** — Create dedicated assessment packs for MFA (Mobile > MFA) and new starter (Request > User Management > New Starter Electracom Contractor) with appropriate rubrics. The current generic incident rubric undervalues Request-type scenarios.

5. **Bulk import/export** — Allow managers to update taxonomy via CSV upload rather than direct XLSX edits.

6. **Taxonomy change audit** — `taxonomy_changes` table exists in the taxonomy README reference but is not implemented in SQLite. Add versioning and change tracking.

7. **Playbook question extraction** — During analysis, explicitly compare candidate's questions against taxonomy `playbook` triage questions. Report which were asked and which were missed.

### Lower priority / future
8. **Synthetic scenario generation** — Use taxonomy items + failure mode patterns to auto-generate new assessment scenarios. Each taxonomy item defines expected triage; each failure mode defines what to do wrong.

9. **Calibration dashboard** — Show manager how their scoring compares to taxonomy-referenced gold fixtures over time.

10. **ConnectWise / IT Glue integration** — Only after MVP is stable. The taxonomy already references CW portal access items (ID 225, 261).
