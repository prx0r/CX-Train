# Active Architecture — CallCallum MVP

## Active Spine

```
/mvp + SQLite + local manager profiles + invite tokens + deterministic scoring
```

This is the **only** actively developed architecture. All new features must build on this path.

### Stack
- **Framework:** Next.js 14 App Router
- **Database:** SQLite via `better-sqlite3` (local/dev/demo)
- **AI Provider:** OpenRouter or mock (abstraction in `lib/ai/provider.ts`)
- **Auth:** None (local MVP). Manager pages are unprotected. Candidate invite tokens provide basic access control.
- **Scoring:** Code-based deterministic scoring. AI extracts evidence only.

### Core Flow
1. Manager opens `/mvp`
2. Manager creates or selects a profile
3. Manager chooses **assignment type** (Hiring Exam, Training Drill, or Training Shift — coming soon)
4. Manager creates assessment (type maps to internal mode)
5. App generates candidate invite link
6. Candidate opens invite link
7. Candidate completes the assignment (chat call for Hiring Exam, service-desk shell for Training Drill)
8. Candidate submits ticket
9. System runs evidence extraction (AI/mock)
10. Code computes deterministic score
11. System creates report
12. Manager views transcript, ticket, evidence checks, score, readiness label
13. Manager can agree/disagree and override criterion-level judgments
14. Feedback stored for future calibration

### Assignment Types
CallCallum is one platform with three assignment types:
- **Hiring Exam** (`hiring_exam`) — assesses new starters on basic call handling. Maps to `chat_call` mode.
- **Training Drill** (`training_drill`) — practises one ticket type with service-desk simulator. Maps to `dashboard_sim` mode.
- **Training Shift** (`training_shift`) — coming soon. Simulated queue across a time block.

The `assignment_type` field on `assessments` is the product-level switch. Internal `assessment_mode` is derived from it. See `lib/mvp/assignment-types.ts`.

### Key Modules

| Module | Status | Path |
|---|---|---|
| assess | active | `app/mvp/`, `app/api/mvp/` |
| assignment-types | active | `lib/mvp/assignment-types.ts` |
| standards | active | `app/api/mvp/standards`, `lib/mvp/db.ts` |
| analysis | active | `lib/mvp/analysis/`, `app/api/mvp/assessments/[id]/analyse` |
| feedback | active | `app/api/mvp/assessments/[id]/feedback` |
| assist | planned | not built |
| knowledge | planned | not built |
| clients | planned | not built |
| people | planned | not built |
| analytics | planned | not built |
| settings | not_built | not built |

### Database Tables (SQLite)

```
assessments, sessions, messages, tickets,
assessment_results, manager_feedback, manager_feedback_criteria,
scenarios, assessment_criteria_versions,
manager_standards, assessment_packs, analysis_runs,
manager_profiles, manager_criterion_feedback
```

All tables are created by `lib/mvp/db.ts:initTables()` and seeded by `seedDefaults()`.

### Key Data Rules
- Standards are versioned and snapshotted per assessment
- Analysis runs are hashed for cache/reproducibility
- AI never produces authoritative score — code computes final readiness
- Candidate endpoints never expose hidden facts, rubric, or manager data

## External Datasets (Support-Quality Reference)

External datasets are used for support-quality research, examples, fixture generation, and failure-mode taxonomy. They are not used as authoritative candidate assessment truth. Candidate scoring remains controlled by scenario hidden truth, deterministic rubric, and manager standards snapshot.

### Current Datasets

| Dataset | Licence | Status | Use |
|---|---|---|---|
| Help Desk Tickets (Mendeley v2) | CC BY 4.0 | Documented | Failure-mode taxonomy, utterance examples, calibration reference |
| IT Helpdesk Chatbot (Kaggle) | Unknown | Licence check required | Not used until verified |

### Data Boundary

```
data/external/   — raw downloads (gitignored, never committed)
data/derived/    — lightweight derived JSON (committed, no raw data)
scripts/datasets/ — import/profile/transform scripts
```

### Rules
- External datasets are **reference material only** — never assessment truth
- Manager scores from external datasets are not CallCallum readiness scores
- No raw personal data from any dataset is committed
- All derived data is synthetic or heavily transformed
- App must not depend on external dataset files at runtime
- See `docs/DATASET_EVALUATION.md` for full dataset evaluation
- See `docs/DATASET_ATTRIBUTION.md` for licence compliance
- See `docs/DATASET_PROFILE_SUMMARY.md` for profile statistics

## Frozen Legacy

The following are **not part of the active MVP spine**. Do not add new features here:

```
Supabase integration (lib/supabase/, supabase/)
Clerk auth (middleware.ts, lib/auth.ts)
GPT Actions (gptinstructions.md, gpt-actions-openapi.yaml)
Taxonomy system (lib/taxonomy.ts, lib/taxonomy-db.ts)
Chutes AI (lib/ai/chutes.ts, lib/ai/monitor.ts, lib/ai/feedback-analyzer.ts)
Voice evaluation (lib/voice/)
Evaluation layer (lib/evaluation/)
Legacy dashboard pages (app/(dashboard)/)
Legacy assessment pages (app/assessment/, app/voice/)
```

These files remain for reference but are not maintained or tested as part of the active product path.
