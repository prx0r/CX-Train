# Codebase Reorganisation

## The three products

```
┌─────────────────────────────────────────────────────────────┐
│                    SHARED INFRASTRUCTURE                     │
│  taxonomy (source of truth) · SLA classifier · auth · DB   │
│  scoring engine · analysis pipeline · event system         │
└─────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   CANDIDATE      │  │    MANAGER      │  │   TECHNICIAN    │
│   DASHBOARD      │  │   DASHBOARD     │  │   DASHBOARD     │
│                  │  │                 │  │                 │
│ Standalone       │  │ Sends hiring    │  │ Child of        │
│ hiring platform  │  │ assessments     │  │ manager dash    │
│                  │  │ to candidates   │  │                 │
│ Candidates       │  │ Creates/manages │  │ T1/T2 techs     │
│ practise calls,  │  │ MSP orgs        │  │ access training,│
│ submit tickets,  │  │                 │  │ taxonomy,       │
│ get scored       │  │ Sets standards  │  │ triage tool,    │
│                  │  │ & procedures    │  │ docs, Ask Callum│
│                  │  │ per MSP client  │  │                 │
│                  │  │                 │  │ Each MSP has    │
│                  │  │ Invites techs   │  │ own custom      │
│                  │  │ to their MSP    │  │ standards &     │
│                  │  │ org             │  │ procedures      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Product 1: Candidate Dashboard

**Purpose:** Standalone hiring platform. Candidates receive an invite link, practise support calls, submit tickets, and get scored.

**Route group:** `/mvp/assessment/[token]/` (token-based, no account needed)

| Route | What |
|-------|------|
| `/mvp/assessment/[token]` | Assessment workspace (call + ticket UI) |
| `POST .../message` | Chat with AI customer |
| `POST .../ticket` | Submit ticket, trigger analysis |
| `POST .../sim/action` | Simulator actions (dashboard sim mode) |

**Key files:**
- `app/mvp/assessment/[token]/` — candidate-facing pages
- `app/mvp/analysis/[assessmentId]/` — post-call report
- `app/api/mvp/assessment/[token]/` — API routes
- `lib/mvp/sim/` — sim packs, AI customer, scoring

**Entry point:** Manager sends invite link → candidate clicks → does assessment → sees report.

---

## Product 2: Manager Dashboard

**Purpose:** Managers create and send hiring assessments to candidates AND manage their MSP organisation (standards, procedures, technician access).

**Route group:** `/mvp/` + `/msp/admin`

| Route | What |
|-------|------|
| `/mvp` | Manager home (clients, assessments, pipeline) |
| `/mvp/assessments` | View/send hiring assessments |
| `/mvp/standards` | Set scoring criteria, SLA rules, escalation policies |
| `/msp/admin` | Create MSP org, generate invites, manage techs |
| `/api/msp/standards` | Per-MSP standards CRUD |

**Key files:**
- `app/mvp/` — manager-facing pages
- `app/mvp/assessments/create.ts` — assessment creation
- `lib/mvp/manager/` — manager context helpers
- `lib/mvp/query.ts` — assessment/standards queries
- `app/api/msp/` — MSP admin APIs

**Entry point:** Manager signs in → dashboard → send assessments OR manage MSP.

---

## Product 3: Technician Dashboard

**Purpose:** Daily operational tools for T1/T2 technicians. Child of the manager dashboard — managers invite techs to their MSP org, techs get role-appropriate access.

**Route group:** `/msp/`

| Route | T1 | T2 | Manager | What |
|-------|:--:|:--:|:-------:|------|
| `/msp/triage` | ✅ | ✅ | ✅ | Classify tickets against taxonomy, get playbook/escalation |
| `/msp/taxonomy` | ✅ | ✅ | ✅ | Browse 162 taxonomy items (role-filtered) |
| `/msp/training` | ✅ | ✅ | ✅ | Role-specific call handling drills |
| `/msp/docs` | ❌ | ✅ | ✅ | Write operational documentation linked to taxonomy |
| `/msp/admin` | ❌ | ❌ | ✅ | Manage org, invites, techs, SLA overrides |

**Key files:**
- `app/msp/` — all technician pages
- `lib/msp.ts` — MSP library (orgs, techs, invites, triage, docs)
- `app/api/msp/` — MSP APIs

**Entry point:** Manager generates invite link → technician clicks → signs in → gets role-specific dashboard.

---

## Shared infrastructure (used by all three)

| Layer | Key files | Used by |
|-------|-----------|---------|
| Taxonomy | `lib/taxonomy.ts`, `taxonomy/taxonomy.json`, `app/api/taxonomy/` | All |
| SLA classifier | `lib/mvp/analysis/slaClassifier.ts` | All |
| Auth | `lib/auth.ts`, `lib/auth-client.ts` | All |
| Database | `lib/mvp/db.ts` | All |
| AI provider | `lib/ai/provider.ts` | All |
| Scoring engine | `lib/mvp/analysis/scoring.ts` | Candidate + Manager |
| Analysis pipeline | `lib/mvp/analysis/runBaseCallumAnalysis.ts`, `normalize-scores.ts` | Candidate |
| Event system | `lib/mvp/events/` | Candidate |

---

## Per-MSP customisation model

```
Global defaults (taxonomy.json, SLA matrix, scoring config)
        │
        ▼
Per-MSP overrides (msp_standards table)
  ├── scoring_categories_json  — custom categories/weights
  ├── sla_overrides_json       — custom SLA matrix rules
  ├── escalation_rules_json    — custom escalation paths
  └── call_requirements        — custom call handling expected
        │
        ▼
Assessment snapshot (scoring_snapshot_json on each assessment)
  — frozen at creation time, never changes
```

Each MSP client gets:
- Their own taxonomy visibility rules (which subTypes T1/T2 can see)
- Their own SLA thresholds and priority matrix
- Their own scoring categories and weights
- Their own escalation rules
- Their own technicians with roles

The global defaults are the starting point. Managers override per-MSP.

---

## What maps to what (current routes → product)

| Route | Product | Status |
|-------|---------|--------|
| `/mvp/assessment/[token]` | Candidate | ✅ Active |
| `/mvp/analysis/[assessmentId]` | Candidate | ✅ Active |
| `/mvp` | Manager | ✅ Active |
| `/mvp/assessments` | Manager | ✅ Active |
| `/mvp/standards` | Manager | ✅ Active |
| `/mvp/people` | Manager | 🏗 Partial |
| `/msp` | Technician | ✅ Fresh |
| `/msp/triage` | Technician | ✅ Fresh |
| `/msp/taxonomy` | Technician | ✅ Fresh |
| `/msp/training` | Technician | ✅ Fresh |
| `/msp/docs` | Technician | ✅ Fresh |
| `/msp/admin` | Manager→Technician | ✅ Fresh |
| `/taxonomy` | Cross-product | ✅ Fresh |
| `/taxonomy/chat` | Cross-product | ✅ Fresh |
| `/(candidate)/profile` | Candidate | 🧊 Legacy (public profile) |
| `/(dashboard)/dashboard/admin` | Manager | 🧊 Legacy (old admin) |
| `/(public)/practice` | Candidate | 🧊 Legacy |

---

## Cleanup proposal

**Keep (active products):**
- `app/msp/` — technician dashboard
- `app/api/msp/` — MSP APIs
- `app/taxonomy/` — taxonomy browser + chat
- `app/api/taxonomy/` — taxonomy APIs
- `app/mvp/assessment/[token]/` — candidate assessment flow
- `app/mvp/analysis/` — candidate report
- `app/mvp/` — manager dashboard
- `app/api/mvp/` — MVP APIs
- `lib/msp.ts` — MSP library
- `lib/taxonomy.ts` — taxonomy library
- `lib/mvp/` — core infra (shared)
- `lib/ai/` — AI provider (shared)
- `lib/auth*.ts` — auth (shared)

**Move to `/archive/` (not aligned with James direction):**
- `lib/voice/` — voice pipeline (James wants text)
- `lib/mvp/compliance/` — compliance frameworks (future)
- `lib/mvp/langgraph/` — Callum LangGraph (future)
- `lib/mvp/callum/` — Callum proposals (future)
- `lib/evaluation/` — old scoring system
- `lib/assessment-*.ts` — old assessment code
- `lib/scoring.ts`, `lib/rubric.ts` — old scoring
- `components/mvp/voice/` — voice UI components
- `components/admin/` — old admin components
- `components/trainee/` — old trainee components
