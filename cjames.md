# Connexion Training Platform — James Requirements

## Context

James (Connexion CEO) wants two practical internal tools:

1. **Helpdesk Training GPT / Simulator** — drills technicians on call handling, SLA judgement, first-call resolution, and correct ticket classification.
2. **Helpdesk Taxonomy GPT / Source-of-Truth Tool** — query and safely update the taxonomy that governs ticket handling.

He is **not** asking for public leaderboards, XP/badges, or a gamified candidate marketplace. Those are downstream.

## Project 1: Helpdesk Training

### Level 1 — Call Handling & Qualification

Current system already handles basic call flow. **Fix the scoring.**

#### Categories

| Category | Score Range | What it tests |
|----------|------------|---------------|
| Professionalism | 1–10 | Tone, conduct, respect |
| Friendliness | 1–10 | Rapport, warmth, approachability |
| Qualification | 1–10 | Asking right questions to understand issue |
| Setting expectations | 1–10 | Clear next steps, timeline, ownership |
| Obtaining symptoms | 1–10 | Capturing specifics: error, scope, timing |

**Total: 50 points. Pass threshold: 40 points** (matches James's suggestion).

### SLA Judgement (critical fix)

The system **must** score impact/severity according to Connexion's SLA matrix, not just repeat what the customer says.

If the user says "this is urgent," the trainee must still establish:
- Is it one user, group, or whole company?
- Is there a workaround?
- Is business stopped or degraded?
- What response/resolution target applies?

**James's complaint:** The GPT wrongly penalized him for "not asking impact directly" even though he had correctly inferred and acted on high impact. The scorer must allow **valid inference**, not just keyword-checking.

#### SLA Matrix

**Severity:**
- Low = single user, irritation more than stoppage
- Medium = group of users, business degraded, reasonable workaround
- High = entire company, critical, business processes stopped

**Impact:**
- Low = irritation, not blocking
- Medium = business degraded, workaround available
- High = business stopped, no workaround

**Priority matrix:**

| Impact | Severity | Priority |
|--------|----------|----------|
| High | High | P1 |
| High | Medium | P1 |
| High | Low | P2 |
| Medium | High | P1 |
| Medium | Medium | P2 |
| Medium | Low | P3 |
| Low | High | P2 |
| Low | Medium | P3 |
| Low | Low | P5 |

**SLA targets:**
| Priority | Response | Resolution |
|----------|----------|------------|
| P1 Emergency | 30 min | 4 hours |
| P2 Quick | 1 hour | 8 hours |
| P3 Normal | 4 hours | 24 hours |
| P4 Low | 8 hours | 30 days |
| P5 Scheduled | 8 hours | 60 days |

### Level 2 — First-Call Resolution

Scenarios must be simple T1-closeable issues. James named:
- password not working
- account lockouts

Good Level 2 scenarios (from taxonomy):
- password reset
- account locked
- MFA prompt confusion
- user cannot access webmail
- Outlook profile issue with simple workaround
- printer set to wrong default
- VPN password expired
- mailbox full
- Teams audio device wrong

**Goal:** Can the technician resolve on initial call OR gather enough evidence to escalate cleanly. Closing a ticket on the initial call is the gold standard.

### Reporting

James wants simple, practical reporting:
- Calls completed
- Scores per category
- Current level
- Weak areas
- Trend over time

Report example:
```
Technician: Fernando
Calls completed: 12
Average score: 42/60
Current level: Level 1
Weakest area: Obtaining symptoms
Ready for Level 2: Yes
```

## Project 2: Helpdesk Taxonomy

### Source of Truth

The taxonomy JSON (`taxonomy/Master Triage classification list.xlsx`) becomes the single source of truth for how tickets are classified, qualified, escalated, and handled.

Current taxonomy has 164 items across: Desktop/Laptop, Mobile, Desktop Application, Email Issue, Printer/Scanner, Security, Network, Server, Remote Desktop, Internet, SharePoint, Peripheral, MS Teams, User Training, Straight Close.

### Taxonomy Item Fields
```
id
classification (Incident/Request)
type
subtype
item
definition
examples
qualification_questions
t1_or_t2_owner
escalation_policy
playbook_steps
sla_notes
last_updated
version
```

### Query Interface

User asks natural language questions like:
- "What subtype should I use for a keyboard issue?"
- "Is an Electracom contractor new starter T1 or T2?"
- "What questions should I ask before escalating this ticket?"
- "What is the agreed approach for account lockouts?"

GPT/tool answers with:
- Recommended classification
- Why
- Missing qualifying info
- Playbook steps
- Escalation owner
- Taxonomy source item

### Safe Update Workflow

**Do not let AI directly mutate the source.** Use proposal workflow:

1. `propose_change` — create proposal with before/after JSON
2. `approve_change` — mark as approved
3. `apply_change` — apply to source of truth

Change proposal stores:
```
id
requested_by
taxonomy_item_id
change_type (add/update/delete)
before_json
after_json
reason
status (proposed | approved | rejected | applied)
approved_by
created_at
applied_at
```

## Architecture: Taxonomy → Training

Training scenarios should be built from taxonomy items:

```
taxonomy item
  → scenario template
  → simulated call
  → trainee attempt
  → score against taxonomy/playbook/SLA
  → manager report
```

Example: Taxonomy says "Identity & Access → Passwords → Account lockout, Owner: T1" with qualification questions and playbook. Training scenario uses that same taxonomy item.

## Build Priority

### Phase 1: SLA Scorer (NOW)
- `slaClassifier` module
- Input: affected_users, business_state, workaround, customer_claimed_priority
- Output: severity, impact, priority, response/resolution targets, reasoning
- Update feedback to allow valid inference

### Phase 2: Level 1 Scoring + Reporting
- Implement the 5 categories + SLA judgement
- Technician_progress tracking
- Manager report page

### Phase 3: Level 2 Scenarios
- password reset, account lockout, MFA issue, Outlook workaround, printer default
- Add first-call resolution scoring

### Phase 4: Taxonomy Query Tool
- Search interface with natural language queries
- Returns classification, owner, questions, playbook, escalation

### Phase 5: Taxonomy Change Proposals
- propose/approve/apply workflow
- Changelog

## What to STOP

- Public candidate marketplace
- Leaderboards
- XP/badges
- Job posting analysis
- Full fake RMM clone
- Intune/AD/365 simulations
- Heavy testing architecture

## Test Routine

1. **SLA priority judgement** — Single user can't log in, no workaround → correct P2/P1
2. **Valid inference allowed** — Candidate infers impact without asking "impact" explicitly → no penalty
3. **Level 1 pass** — All 5 categories scoring ≥8 → passes at 40/50
4. **Report page** — Shows technician name, calls completed, avg score, level, weakest area
5. **Taxonomy query** — "Who handles Electracom new starter?" → cites taxonomy field
6. **Taxonomy change proposal** — "Add keyboard issue item" → creates proposal, shows diff, doesn't apply until approved
