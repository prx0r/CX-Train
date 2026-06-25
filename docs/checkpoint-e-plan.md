# Checkpoint E — Dashboard Sim v0: Outlook Work Offline

## Goal

Add a new `dashboard_sim` assessment mode alongside the existing `chat_call` mode. The candidate chats with a simulated customer while clicking simplified Outlook/browser/cmd tool buttons. Every action generates a `sim_event`. The manager sees transcript + action timeline + score + red flags.

## Principle

This is not a fake Windows desktop. It is an evidence-capture layer. The candidate practises: think → explain → perform action → observe result → explain → document.

## Changes

### Database (idempotent migrations in `lib/mvp/db.ts`)

- `assessments`: add `assessment_pack_id TEXT`, `assessment_mode TEXT DEFAULT 'chat_call'`
- `assessment_packs`: add `sim_config_json`, `sim_initial_state_json`, `sim_success_conditions_json`
- New table `sim_sessions`: tracks current/final state per assessment
- New table `sim_events`: ordered action log with before/after state

### Sim module (`lib/mvp/sim/`)

- `types.ts`: AssessmentMode, SimToolId, SimEventType, SimActionConfig, SimPackConfig
- `packConfig.ts`: the Outlook sim action definitions + helper to load from pack row
- `stateMachine.ts`: validate preconditions, apply state patches, return result
- `eventLog.ts`: insert/query sim_events
- `scoring.ts`: code-based sim scoring (no LLM needed for button clicks)
- `timeline.ts`: build manager-facing timeline from sim_events

### Routes

- `POST /api/mvp/assessments`: accept `assessment_pack_id` + `assessment_mode`, create sim_session
- `GET /api/mvp/assessment/[token]`: return safe sim config + visible_state for dashboard_sim
- `GET /api/mvp/assessment/[token]/sim`: current safe sim state
- `POST /api/mvp/assessment/[token]/sim/action`: perform action, return result + new state
- `POST /api/mvp/assessment/[token]/message`: include sim event context for dashboard_sim
- `POST /api/mvp/assessment/[token]/ticket`: complete sim_session

### Frontend

- `app/mvp/assessment/[token]/page.tsx`: branch on assessment_mode
- `components/mvp/sim/CandidateSimShell.tsx`: layout with chat + tools + timeline
- `components/mvp/sim/CustomerChat.tsx`: existing chat UI adapted
- `components/mvp/sim/ToolDock.tsx`: toolbar with Outlook/Browser/CMD buttons
- `components/mvp/sim/tools/OutlookTool.tsx`: Outlook action buttons
- `components/mvp/sim/tools/BrowserTool.tsx`: browser/webmail buttons
- `components/mvp/sim/tools/CommandPromptTool.tsx`: cmd buttons
- Components are minimal — buttons, not pixel-perfect Windows clones

### Analysis

- Update context to include `sim_events` + `sim_final_state`
- Add `simScoring` section to analysis output
- Hash includes sim_events for cache reproducibility

### Manager page

- Add action timeline section above analysis
- Show ordered actions with timestamps, results, red flags

### Tests

- `scripts/test-dashboard-sim.mjs`: full end-to-end flow
- `npm run test:dashboard-sim`
- `npm run test:mvp-flow` (ensure no regression)
- `npm run build`

## Not building

- Voice
- Real Windows VM
- Full RAG system
- M365 Admin / Printer / VPN tools
- Drag/drop windows
- Screen sharing
