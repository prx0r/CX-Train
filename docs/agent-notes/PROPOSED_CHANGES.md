# Proposed Changes — Training Project Updates (Source of Truth: Initial Email)

Date: 2026-03-11

This document lists the proposed changes required to make the training project meet the requirements described in your initial email. It focuses on persistence/tracking, deterministic scoring, SLA-based priority logic, level progression, troubleshooting in Level 2, reporting, and the taxonomy tool direction. It does **not** implement changes; it is a specification for the next build steps.

---

## 1) Persistence & Tracking (Per-User)

### Current risk
- Session attribution is fuzzy (first-name matching). This risks duplicated users and broken progress tracking.

### Chosen approach (per latest direction)\n**Full name as identifier**\n- Require **full name** capture at session start.\n- Add a **disambiguation step** if multiple users match.\n- Add an admin tool to merge duplicates (future).\n\n### Proposed DB changes (both options)
- Add a canonical `users.display_name` or `users.preferred_name` to show in reports.
- Store `sessions.tech_name_raw` (what the user said) for audit.

---

## 2) Deterministic Scoring (Standardized 1–10)

**Source of truth:** The initial email explicitly requires the following categories with 1–10 scores:
- Professionalism
- Friendliness
- Qualification
- Setting expectations
- Obtaining symptoms

### Problem
Current scores are GPT-generated and can drift. We need **deterministic and reproducible** scoring.

### Proposed model
- The GPT returns **evidence booleans** only (e.g., `used_name`, `asked_scope`, `set_callback_window`).
- The backend computes category scores deterministically from a fixed rubric.
- Each category has 4–6 evidence items worth fixed points, scaled to 1–10.

### Example rubric (initial draft, based on email intent)
These are placeholders to be reviewed and adjusted. The final rubric should live in code/config, not the prompt.

**Professionalism (1–10)**
- Calm, controlled language throughout
- Avoids over-promising
- Clear ownership/next step language
- No invented tools/actions

**Friendliness (1–10)**
- Polite greeting / tone
- Uses caller’s name
- Empathy statement (e.g., “I can see how that’s frustrating”)
- Courteous close

**Qualification (1–10)**
- Asks for scope
- Asks for impact
- Confirms severity and priority driver
- Confirms urgency against SLA, not caller claims

**Setting Expectations (1–10)**
- States ticket will be logged
- Provides response timeframe
- Provides resolution expectation or review point
- Provides callback window

**Obtaining Symptoms (1–10)**
- Asks for precise symptom description
- Confirms when last working
- Asks about recent changes
- Asks for exact error wording

### Output changes
- Store `sessions.score_breakdown` (JSON per category)
- Store `sessions.rubric_evidence` (JSON of evidence booleans)
- Compute `sessions.score_total` deterministically

---

## 3) SLA-Based Priority Correctness (No Inference)

**Source of truth:** The email includes severity/impact matrix and SLA targets. The GPT must not infer severity/priority based solely on the caller claiming “high priority.”

### Proposed changes
- Add `sessions.severity_level` and `sessions.impact_level` (normalized values)
- Compute `priority_correct` using the SLA matrix in code
- Require GPT to ask explicitly for scope + impact before assigning priority

### SLA mapping (from email)
**Severity definitions**
- Low: single user, irritation, not stoppage
- Medium: group of users, degraded, workaround exists
- High: entire company, major processes stopped

**Priority matrix**
- High Impact / High Severity ? P1
- High Impact / Medium Severity ? P1
- High Impact / Low Severity ? P2
- Medium Impact / High Severity ? P1
- Medium Impact / Medium Severity ? P2
- Medium Impact / Low Severity ? P3
- Low Impact / High Severity ? P2
- Low Impact / Medium Severity ? P3
- Low Impact / Low Severity ? P5

**SLA targets**
- P1 Emergency: 30 min response / 4 hrs resolution
- P2 Quick: 1 hr response / 8 hrs resolution
- P3 Normal: 4 hrs response / 24 hrs resolution
- P4 Low: 8 hrs response / 30 days resolution
- P5 Scheduled: 8 hrs response / 60 days resolution

---

## 4) Levels & Progression

**Source of truth:** The email explicitly proposes Level 1 (call handling only) and Level 2 (basic troubleshooting & first-call resolution). It also proposes a points threshold (e.g., 40) to progress.

### Proposed changes
- Add `pathways.level` (1, 2, 3)
- Add `trainee_progress.level` and `trainee_progress.level_points`
- Define Level 1 pass threshold (e.g., 40+ total points across the 5 category scores)
- Level 2 introduces basic troubleshooting items and first-call resolution
- Level 3 reserved for future expansion

---

## 5) Level 2 — First-Call Resolution Scenarios

**Source of truth:** The email states Level 2 should include in-call troubleshooting for straightforward issues.

### Required scenario list (seed)
- Passwords not working
- Account lockouts
- (Add more: AI can propose additional common first-call close scenarios)

### Behavioral changes
- GPT is allowed to guide through simple troubleshooting steps
- If resolved, the GPT should end the call with ticket closure as the “gold standard”

---

## 6) Reporting

**Source of truth:** The email requests reporting on calls, scores, levels, weaknesses.

### Proposed reporting requirements
- Per-tech: total calls, average scores, category breakdowns, current level
- Weakness heatmap by category and checkpoint
- Session history trend lines
- Level progression over time

### Data needed
- `sessions.score_breakdown`
- `sessions.rubric_evidence`
- `trainee_progress.level` and `level_points`

---

## 7) Helpdesk Taxonomy Tool

**Source of truth:** The email proposes converting the triage tool into a self-service taxonomy assistant with update capabilities.

### Requirements
- Natural-language querying for classification, playbooks, escalation policies
- Acts as the single source of truth
- Must support updates **through the tool** (no spreadsheets)

### Suggested implementation (from email)
- Convert taxonomy into GPT-friendly formats:
  - `taxonomy.json` (structured records)
  - `playbook.md`
  - `escalation.md`
- Add GPT Actions backed by a small internal service:
  - `GET /taxonomy/search`
  - `GET /taxonomy/item/{id}`
  - `POST /propose-change`
  - `POST /apply-change`
- Enforce RBAC and audit logging

---

## 8) Prompt/System Instruction Updates

### Required behavioral changes
- Do not infer impact or priority; ask explicitly
- Use SLA rules to assign priority
- Store the evidence items for deterministic scoring
- Level 2 allows on-call troubleshooting for first-call resolution scenarios

---

## 9) Open Decisions (Need Confirmation)

1) **Identity**
- Use `trainee_code` (recommended) or full name as unique key?

2) **Rubric finalization**
- Confirm or adjust the evidence items for each 1–10 category

3) **Level threshold**
- Confirm Level 1 ? Level 2 threshold (example: 40 points)

---

## 10) Next Steps (once decisions confirmed)

1) Update DB schema for scoring + levels + identity
2) Update API routes to accept evidence inputs and compute deterministic scores
3) Update dashboard reporting to show category scores + level
4) Update GPT prompt to align with SLA and new scoring protocol
5) Implement taxonomy tool (separate track)

---

End of document.

