# Checkpoint E — Dashboard Sim v0: Outlook Work Offline

## Why Dashboard Sim Exists

The dashboard sim upgrades one assessment mode from:

```text
messages + ticket + analysis
```

to:

```text
messages + sim_events + ticket + analysis
```

Instead of only chatting with a simulated customer, the candidate can also click fake Outlook/browser/cmd buttons. Every action generates a `sim_event` with before/after state, so the analysis gets deterministic evidence of the candidate's diagnostic path.

## How It Works

### Modes

```text
chat_call          — existing chat-only assessment (default)
dashboard_sim      — chat + fake tool buttons + sim_events (new)
voice_dashboard_sim — reserved for future
```

### Data Model

```sql
assessments
  assessment_pack_id TEXT   -- links to the sim pack
  assessment_mode    TEXT   -- 'chat_call' | 'dashboard_sim'

assessment_packs
  sim_config_json           -- tool + action definitions
  sim_initial_state_json    -- starting sim state
  sim_success_conditions_json -- pass conditions

sim_sessions
  session_id         TEXT   -- 1:1 with sessions
  current_state_json TEXT   -- live sim state
  final_state_json   TEXT   -- state on ticket submission

sim_events
  session_id         TEXT
  sequence_index     INT    -- ordered by index
  event_type         TEXT   -- sim_started | action_performed | observation_returned | red_flag_triggered | sim_completed
  actor              TEXT   -- candidate | system
  tool_id            TEXT   -- outlook | browser | cmd
  action_id          TEXT   -- check_outlook_status | toggle_work_offline | ...
  state_before_json  TEXT
  state_after_json   TEXT
  timestamp_ms       INT
```

### Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/mvp/assessments` | POST | Create assessment — accepts `assessment_mode` + `assessment_pack_id` |
| `/api/mvp/assessment/[token]` | GET | Load candidate assessment — returns `sim` block for dashboard_sim |
| `/api/mvp/assessment/[token]/sim` | GET | Current sim state (safe visible + actions) |
| `/api/mvp/assessment/[token]/sim/action` | POST | Perform sim action, returns result + new state |
| `/api/mvp/assessment/[token]/message` | POST | Chat — includes sim event context for dashboard_sim |
| `/api/mvp/assessment/[token]/ticket` | POST | Submit ticket — completes sim_session |

### Safe vs Hidden State

The candidate never sees:
- Hidden root cause (Work Offline)
- Success conditions
- Red flag scoring config
- Full rubric
- Manager standards

The candidate sees:
- Tools available (Outlook, Browser, CMD)
- Safe actions whose preconditions are met
- Visible state (outlook_open, outbox_count, outlook_status)
- Action timeline

### Scoring Integration

Sim scoring is deterministic (code, not LLM):

| Criteria | Condition |
|---|---|
| checked_outlook_status | action `check_outlook_status` occurred |
| checked_webmail | action `check_webmail` OR candidate asked in chat |
| disabled_work_offline | action `toggle_work_offline` occurred |
| sent_test_email | `send_test_email` after `toggle_work_offline` |
| avoided_red_flags | no `red_flag_triggered` events |

Red flags:
- `reinstall_outlook` before checking status
- `delete_mail_profile` before checking status
- `escalate_without_basic_checks` before checking anything
- Finishing without `test_email_sent`

### First Scenario

**Pack**: `pack-outlook-sim-v1`

**Root cause**: Outlook Work Offline enabled.

**Correct path**:
1. Clarify impact with customer
2. Check webmail/browser (isolate scope)
3. Open Outlook
4. Check Outlook status → detect Working Offline
5. Disable Work Offline
6. Send test email → Outbox clears
7. Write ticket note with full details

## What Is Not Built

- Voice
- Full RAG system
- M365 Admin / Printer / VPN tools
- Real Windows desktop
- Drag/drop windows
- Screen sharing
- ConnectWise / IT Glue integration
