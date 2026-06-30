# Checkpoint E1 — Unified Evidence Timeline + Simulator Sandbox Foundation

## What exists already (Checkpoint E work)

- `assessments.assessment_mode` and `assessments.assessment_pack_id` columns
- `sim_sessions` / `sim_events` tables for dashboard_sim mode
- Sim module: `lib/mvp/sim/` (types, eventLog, stateMachine, scoring, timeline, packConfig)
- Sim API routes: GET `/sim`, POST `/sim/action`
- CandidateSimShell, ToolDock, SimTimeline components
- Dashboard_sim assessment creation, message context, ticket completion
- Manager page shows action timeline

## What E1 adds

### 1. `session_events` table — unified evidence timeline

One table for ALL event types (chat, tools, ticket, timing). This is the long-term source of truth.

### 2. Events module `lib/mvp/events/`

- `types.ts` — SessionEventType, SessionActor, timing metrics
- `eventLog.ts` — appendSessionEvent, getSessionEvents, getNextSequenceIndex
- `timeline.ts` — buildEvidenceTimeline, summariseForAnalysis, calculateTimingMetrics

### 3. Route updates

- **Assessment creation**: writes `assessment_started` + initial `customer_message` events
- **Message route**: writes `candidate_message` + `customer_message` events alongside existing messages
- **Ticket route**: writes `ticket_submitted` + `assessment_completed` events

### 4. Timing metrics

Calculated from session_events:
- total_duration_ms
- time_to_first_response_ms
- time_to_first_action_ms
- time_to_resolution_ms
- time_to_ticket_submit_ms

### 5. Windows-like sim UI

Tool panels restyled to look like Windows app windows:
- Title bars with min/max/close buttons (non-functional, decorative)
- Blue title bars (Outlook), gray panels (CMD), browser frame
- Proper spacing, borders, shadow

### 6. Analysis context

Updated to include:
- evidence_timeline
- timing_metrics
- sim_action_summary

### 7. Not touching

- Frozen Supabase/Clerk/GPT Actions/legacy voice code
- Existing message table — kept for backwards compatibility
- Existing `sim_events` / `sim_sessions` — kept, new code prefers `session_events`
- Voice — not built yet
