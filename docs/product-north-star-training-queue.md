# Product North Star — AI Simulated Service Desk

## The Product

CallCallum is an **AI simulated service desk for MSP junior onboarding**.

Not an AI call test. Not a generic helpdesk simulator. A system where a junior tech is placed into a fake live queue, receives AI calls/tickets across the day, works them in a simulated dashboard, writes tickets, and the manager gets a summary instead of babysitting them.

## The Killer Sentence

> CallCallum replaces the senior-tech babysitting phase of junior onboarding with an AI simulated service desk that records, scores, and escalates readiness.

## Three Modes

### Assessment Mode (Current — Checkpoint E)
One controlled test link for hiring or readiness check. Candidate gets one scenario, handles it, gets scored. Manager reviews.

### Training Queue Mode (Next)
A trainee is "on shift" in the simulator and receives scheduled/random AI calls across the day. Cases escalate in difficulty. Manager gets an end-of-day report instead of sitting beside the trainee.

### Live Shadow Mode (Future)
Trainee handles real tickets/calls with Callum observing, coaching, and scoring in the background. Supervisor intervenes only when the score drops below threshold.

## The Product Loop (Training Queue Mode)

```
Manager creates training day
→ Trainee joins simulated service desk
→ AI calls/tickets arrive on a schedule
→ Trainee handles them in the dashboard
→ Actions + voice/chat + ticket notes recorded
→ Callum scores each case
→ Manager gets end-of-day report
→ Next day difficulty adapts
```

## Progression System

```
Level 1 — Call Handling
  Greeting, identity, empathy, scope, impact, expectation setting, ticket quality.

Level 2 — First-Call Resolution
  Password reset, account lockout, Outlook Work Offline, MFA setup, simple printer mapping.

Level 3 — Escalation Judgement
  VPN, Wi-Fi scope, shared mailbox permissions, possible outage, "T1 or T2?" cases.

Level 4 — Queue Pressure
  Multiple open tickets, interruptions, SLA priority, angry caller, red herrings.
```

This directly matches the manager's original requirements: real scoring/levels, Level 2 first-call troubleshooting, reporting on number of calls, scores, level, and weak areas.

## Why This Is Different

| ServiceDesk Simulator | CallCallum |
|---|---|
| "I want to practise helpdesk." | "I'm an MSP manager. I need this junior ready for live calls without burning senior tech time." |
| Individual practice tool | Manager-scored onboarding pipeline |
| No manager oversight | Manager gets daily readiness summary |
| Static scenarios | Adaptive difficulty |
| No scoring or reporting | Deterministic scoring + manager calibration |

## Architecture Principles

### Unified Evidence Timeline Is Required
Voice, chat, tool actions, ticket notes — everything becomes a `session_event`. This is the non-negotiable foundation. Without it, scoring, timing, and review are inconsistent between modes.

### Training Shifts Reuse Assessment Sessions
A "training shift" is a sequence of assessment sessions. Each case is an `assessment` with its own `session_events`, `ticket`, and `analysis`. The shift simply orchestrates multiple cases in series.

### Future Data Model

```
training_shift
  trainee_id, manager_id, starts_at, ends_at
  difficulty_level, case_queue_mode
  status: active/completed

scheduled_sim_case
  shift_id, assessment_pack_id
  scheduled_at, started_at, completed_at
  difficulty, status

trainee_progress
  trainee_id, level, cases_completed
  average_score, weak_areas

daily_report
  shift_id, date, cases, scores
  level_progress, manager_notes
```

Do not build these yet. They are the target, not the current checkpoint.

## Build Order

```
Checkpoint D — Analysis Hardening ✓
  Fail gates, evidence-linked scoring, gold fixtures.

Checkpoint E — Unified Evidence Timeline ✓
  Voice/chat/action/ticket all become one timeline.

Checkpoint F — Dashboard Sim v0 ✓
  Outlook Work Offline case with fake tools/actions.

Checkpoint G — Manager Review + Calibration
  Manager corrects criteria, score, and notes.

Checkpoint H — Training Queue Mode
  Trainee starts a simulated shift and receives 3–5 cases.

Checkpoint I — Voice-only
  Audio/transcription events using same timeline.

Checkpoint J — Voice + Simulator
  Candidate speaks while using fake dashboard actions.
```

## What Is True Right Now

- One simulated ticket/call works end-to-end
- Evidence timeline captures all events
- Score is deterministic
- Manager can review
- The system scores one call properly

## What Must Be True Before Building Queue Mode

- Multiple scenario packs exist (not just Outlook)
- Each pack has deterministic scoring
- Manager calibration feedback loop exists
- Scoring can be compared across cases
- Difficulty levels are defined and map to scenario packs

## Guardrails

- Do not build random calls before the case engine works
- Do not build queue scheduling before single-case scoring is validated
- Do not build Live Shadow Mode before Training Queue Mode is stable
- Do not build voice before the event model handles it
- Do not replace the existing chat_call assessment — it is Assessment Mode
