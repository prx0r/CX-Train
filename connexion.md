# Connexion Training & Taxonomy Platform

## What this is

Connexion's operational helpdesk playbook, turned into an interactive training and triage system. The taxonomy is the foundation layer underneath both products:

- **Training Simulator** — drill technicians on call handling, SLA judgement, first-call resolution, and taxonomy-driven classification
- **Taxonomy Copilot** — let techs ask "what do I do with this ticket?" and get the agreed classification, playbook, and escalation rule

## Architecture: one brain, three surfaces

```
taxonomy_items (162 items, source of truth)
  │
  ├── taxonomy_changes (proposal/approve/apply workflow)
  │
  ├── Taxonomy Copilot (query)
  │     └── /taxonomy/chat — strict Q&A from source of truth only
  │     └── /taxonomy — browse/search/filter all items
  │
  ├── Scenario Generator
  │     └── POST /api/taxonomy/scenario — creates training scenario from item
  │
  ├── MSP Technician Dashboard (/msp)
  │     └── /msp/triage — classify tickets against taxonomy, get playbook/escalation
  │     └── /msp/taxonomy — role-filtered taxonomy browser
  │     └── /msp/training — role-specific drills generated from taxonomy items
  │     └── /msp/docs — T2+ documentation linked to taxonomy items
  │     └── /msp/admin — manager creates org, generates invites, sets SLA overrides
  │
  ├── Training Simulator
  │     └── simulated call against taxonomy item
  │     └── scored against playbook + SLA matrix
  │     └── escalation decision scored
  │
  └── Manager Reports
        └── technician_progress (calls, scores, level, weak areas)
```

## Taxonomy: source of truth

**Location:** `taxonomy/taxonomy.json` — 162 items imported from `Master Triage classification list.xlsx`

### Schema per item

| Field | Type | Example |
|-------|------|---------|
| `id` | string | `taxonomy-106` |
| `category` | string | `Tier 1 Service Board` |
| `type` | string | `Incident` |
| `subType` | string | `Desktop/Laptop` |
| `item` | string | `Login Problem` |
| `definition_scope` | text | Includes/excludes, scope |
| `playbook_steps` | text | Numbered steps for T1 |
| `keywords` | string[] | `["can't log in", "login failed"]` |
| `helpdesk_tier` | string | `T1` |
| `escalation_guidance` | text | When and how to escalate |
| `last_updated` | date | `2026-06-30` |
| `version` | number | `1` |

### Taxonomy Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/taxonomy/all` | All items |
| `GET` | `/api/taxonomy/search?q=` | Scored keyword search |
| `GET` | `/api/taxonomy/item/{id}` | Single item |
| `GET` | `/api/taxonomy/validate` | Reports missing fields, duplicates |
| `POST` | `/api/taxonomy/scenario` | Generate training scenario from item |
| `POST` | `/api/taxonomy/propose-change` | Create proposal (safe, no direct mutation) |
| `POST` | `/api/taxonomy/approve-change` | Apply approved proposal |

### MSP Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/msp/me` | Current user's MSP context (org, role, technician id) |
| `POST` | `/api/msp/org` | Create MSP organisation |
| `GET` | `/api/msp/invite?token=` | Check invite details |
| `POST` | `/api/msp/invite` | Create invite link |
| `PUT` | `/api/msp/invite` | Redeem invite token |
| `GET` | `/api/msp/technicians?msp_id=` | List technicians |
| `PATCH` | `/api/msp/technicians` | Update technician role |
| `GET` | `/api/msp/standards?msp_id=` | Get per-MSP standards |
| `POST` | `/api/msp/standards` | Update per-MSP standards |
| `POST` | `/api/msp/triage` | Classify ticket description against taxonomy |
| `GET` | `/api/msp/docs?msp_id=` | List documentation |
| `POST` | `/api/msp/docs` | Create document |
| `PATCH` | `/api/msp/docs` | Update document |
| `GET` | `/api/msp/scenarios?role=` | List role-filtered training scenarios |

### Safe update workflow

```
propose_change → status: proposed → approve_change → status: applied
     (stores before/after JSON,       (updates taxonomy.json,
      requester, reason, timestamp)     logs approver, timestamp)
```

The GPT must **never** directly mutate the taxonomy. All changes go through the proposal workflow with full audit trail in `taxonomy/changes.log.jsonl`.

## Training: Level 1 — Call Handling

### Categories (scored 1–10 each)

| Category | What it tests |
|----------|---------------|
| Professionalism | Tone, conduct, respect |
| Friendliness | Rapport, warmth, approachability |
| Qualification | Asking right questions to understand issue |
| Setting expectations | Clear next steps, timeline, ownership |
| Obtaining symptoms | Capturing specifics: error, scope, timing |
| SLA judgement | Correct severity/impact/priority per SLA matrix |

**Total: 60 points. Pass: 40+ points to enter Level 2.**

### SLA Classifier (`lib/mvp/analysis/slaClassifier.ts`)

Determines severity/impact/priority per Connexion's SLA matrix.

**Input:**
```
affected_users: single | group | company
business_state: irritation | degraded | stopped
workaround: yes | no | unknown
customer_claimed_priority?: string
is_security_incident?: boolean
is_outage?: boolean
```

**Output:**
```
severity: low | medium | high
impact: low | medium | high
priority: P1 | P2 | P3 | P4 | P5
response_target: e.g. "30 minutes"
resolution_target: e.g. "4 hours"
reasoning: string[]
```

**Priority matrix:**

| Impact | Severity | Priority | Response | Resolution |
|--------|----------|----------|----------|------------|
| High | High/Medium | P1 | 30 min | 4 hours |
| High | Low | P2 | 1 hour | 8 hours |
| Medium | High | P1 | 30 min | 4 hours |
| Medium | Medium | P2 | 1 hour | 8 hours |
| Medium | Low | P3 | 4 hours | 24 hours |
| Low | High | P2 | 1 hour | 8 hours |
| Low | Medium | P3 | 4 hours | 24 hours |
| Low | Low | P5 | 8 hours | 60 days |

**Valid inference fix:** `scoreSLAJudgement()` awards partial credit if the candidate *inferred* impact from context rather than asking the keyword question directly. This directly addresses James's complaint.

## Training: Level 2 — First-Call Resolution

Scenarios derived from taxonomy items that are T1-closeable:

- password reset / account locked
- MFA prompt confusion
- user cannot access webmail
- Outlook profile issue with simple workaround
- printer set to wrong default
- VPN password expired
- mailbox full
- Teams audio device wrong

**Goal:** Resolve on initial call OR gather sufficient evidence to escalate cleanly.

## Data model (current)

```
taxonomy_items        ← 162 items, source of truth
taxonomy_changes      ← proposal/approve/apply audit log

msp_organisations     ← per-MSP client config
msp_technicians       ← linked to auth users with role (t1/t2/manager)
msp_invites           ← manager-generated invite links with role + expiry
msp_taxonomy_access   ← per-role taxonomy subType visibility
msp_standards         ← per-MSP scoring, SLA, escalation overrides
msp_docs              ← T2+ documentation linked to taxonomy items

training_scenarios    ← derived from taxonomy items (via scenario generator)
training_attempts     ← per-attempt records
assessment_results    ← analysis output, scores, structured JSON
attempt_competency_scores  ← per-competency aggregated scores
attempt_criterion_results  ← per-criterion evidence + IDs
candidate_competency_stats ← per-user per-competency aggregates

analysis_jobs         ← background retry for timed-out analysis
technician_progress   ← per-user level tracking, stats (planned)
```

## Frontend surfaces

### MSP Technician Dashboard (`/msp`)
Role-based access: T1, T2, or Manager. Manager creates org → generates invite link → technician accepts with role.

| Page | T1 | T2 | Manager | What it does |
|------|:--:|:--:|:-------:|-------------|
| `/msp/triage` | ✅ | ✅ | ✅ | Paste ticket description → get classification, playbook, escalation, evidence from taxonomy |
| `/msp/taxonomy` | ✅ | ✅ | ✅ | Browse/search 162 items with role-filtered visibility |
| `/msp/training` | ✅ | ✅ | ✅ | Role-specific scenarios generated from taxonomy items |
| `/msp/docs` | ❌ | ✅ | ✅ | Browse/create/edit operational documentation linked to taxonomy |
| `/msp/admin` | ❌ | ❌ | ✅ | Create org, generate invites, manage techs, set SLA overrides |

### Taxonomy Browser (`/taxonomy`)
- Search, filter by type/subType
- Item detail view: definition, playbook, keywords, tier, escalation
- Propose change

### Taxonomy Copilot (`/taxonomy/chat`)
- Strict Q&A: answers only from taxonomy endpoint results
- Response format includes classification, item ID, questions, actions, escalation, evidence
- Never invents categories or playbook steps

### Analysis Report (`/mvp/analysis/[id]`)
- Competency breakdown with percentage + raw scores
- Retake comparison (attempt vs previous attempt diff)
- SLA judgement score

## What to STOP building (for now)

- Public candidate marketplace
- Leaderboards
- XP/badges/streaks
- Job posting analysis
- Full fake RMM clone
- Intune/AD/365 simulations
- Heavy gamification/testing architecture

## Current build status

### ✅ Done
- Taxonomy import (162 items from Excel to JSON)
- Taxonomy browser + search/filter/detail
- Taxonomy copilot chat (strict source-of-truth Q&A)
- Proposal/approve/apply change workflow with audit log
- Scenario generator (taxonomy item → training scenario)
- SLA classifier module (severity/impact/priority matrix)
- Valid inference scoring (partial credit for inferred impact)
- 280 passing tests, 32/32 competency mapping
- Analysis jobs timeout/retry infrastructure
- Evidence ID resolution (quotes → message/event IDs)
- Candidate aggregate stats (per-competency)
- Manager-safe competency route (token/auth-gated)
- **MSP dashboard** — /msp with role-based access (T1/T2/Manager)
- **Ticket triage** — classify descriptions against taxonomy, get playbook/escalation
- **Role-filtered training** — scenarios filtered by technician tier
- **MSP documentation** — T2+ can write operational notes
- **Invite flow** — manager creates org, generates links, technicians accept
- **Per-MSP standards** — SLA overrides per organisation

### 🔜 Next (Phase 2)
- Level 1 scoring with James's 6 categories
- Technician progress tracking table + API
- Manager report page (calls, scores, level, weak areas)
- Scenario generator integrated into training flow

### 📅 Future (Phase 3+)
- Level 2 first-call-resolution scenarios
- Taxonomy enrichment (fill missing tier/escalation fields)
- ConnectWise / IT Glue integration (after taxonomy is solid)
- Technician calibration and review

## Demo scripts for James

### Demo 1: Taxonomy Copilot
User asks: *"User can't log in. What should T1 ask and when should they escalate?"*

System replies with:
- Classification: Tier 1 Service Board / Incident / Desktop/Laptop / Login Problem
- Item ID: taxonomy-106
- Playbook questions (verbatim from taxonomy)
- Escalation rule (verbatim from taxonomy)
- Evidence to capture
- Source item ID and fields used

### Demo 2: Training Call
Choose taxonomy item → start simulated call → trainee handles user → system scores:
- Professionalism: 8/10, Friendliness: 8/10, Qualification: 7/10
- Setting expectations: 8/10, Obtaining symptoms: 6/10
- SLA judgement: 8/10, Escalation quality: 7/10
- Specific feedback: what was done well, what was missed, escalation correctness

### Demo 3: Manager Report
```
Technician: Fernando
Calls completed: 8
Current level: Level 1
Average score: 41/50
Weakest area: Obtaining symptoms
Most missed taxonomy area: Identity & Access → Login Problem
Ready for Level 2: Yes
```

## Files reference

| File | Purpose |
|------|---------|
| `connexion.md` | This document — product overview |
| `cjames.md` | James's full requirements, SLA matrix, test routine |
| `cspec.md` | Codebase architecture specification |
| `cbuild.md` | Build notes and sprint history |
| `taxonomy/taxonomy.json` | 162-item source of truth |
| `taxonomy/Master Triage classification list.xlsx` | Original Excel source |
| `taxonomy/gptinstructions.md` | System prompt for taxonomy GPT |
| `taxonomy/changes.log.jsonl` | Change proposal audit log |
| `lib/taxonomy.ts` | Taxonomy loading, search, validation, scenario generation |
| `lib/mvp/analysis/slaClassifier.ts` | SLA matrix classifier + scoring |
| `lib/mvp/analysis/normalize-scores.ts` | Post-analysis normalization |
| `lib/mvp/analysis/jobs.ts` | Analysis timeout + background retry |
| `lib/msp.ts` | MSP library — orgs, technicians, invites, triage, docs, role filtering |
| `lib/mvp/db.ts` | Core schema — includes 6 MSP tables (orgs, techs, invites, taxonomy access, standards, docs) |
| `app/msp/` | MSP dashboard routes — layout, triage, taxonomy, training, docs, admin, accept-invite |
| `app/api/msp/` | MSP API routes — me, org, invite, technicians, standards, triage, docs, scenarios |
