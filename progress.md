# Progress Handoff — Unified Service Desk Simulator

Date: 2026-06-26

## Current Direction

The product is being pulled back toward the original truth in `vision.md` and `cohesion.md`: this is one MSP readiness simulator, not three separate products. The three assignment types should all run through one service-desk shell, with capabilities switched on or off:

- `hiring_exam`: ticket/call/voice/ticket submission, no remote desktop tools.
- `training_drill`: the same shell plus a remote desktop sandbox and ticket-type-specific simulation pack.
- `training_shift`: the same shell plus a queue/multi-ticket layer later. Keep it disabled for now.

The user’s feedback has consistently been about realism and product feel, not just whether buttons work. They are asking for something that feels like a serious PSA/helpdesk product: ConnectWise-like ticket grid, ticket detail, persistent call bar, internal notes, remote access, and a believable desktop/tool environment. They do not want a generic AI demo with chat bubbles, random action buttons, or a forced sequence of steps.

## What The User Actually Wants

Based on the recent feedback, the user wants:

1. A real service desk dashboard.
   It should look and behave like a premium/legacy PSA such as ConnectWise Manage: dense tables, ticket board, status/priority/owner/SLA metadata, no marketing-style UI, no playful cards.

2. A single simulator foundation.
   Hiring, training drills, and future shifts should feel like the same product. Assignment type should augment capabilities, not swap to unrelated UI paths.

3. Voice-first customer interaction.
   The call should be visible in a persistent top bar. The candidate should answer a call, speak, hear the customer, and continue working the ticket. Text transcript/fallback can exist, but it should not be the main interaction.

4. Freedom to make mistakes.
   Do not hard-block actions because the candidate is “not in the right phase.” Let them try things in the wrong order. Record the attempt. Let scoring and red flags judge it.

5. A realistic remote desktop foundation.
   The user rejected “click random action buttons” as not training the correct skill. The remote environment should feel like a Windows desktop with actual app-like surfaces. Outlook should show the stuck Outbox and Work Offline state in the UI. The candidate should solve by interacting with the Outlook clone, not selecting a hidden-answer action from a list.

6. Internal notes and ticket writing as first-class workflow.
   The candidate should be able to post internal notes immediately, before/during/after the call. Closure/ticket submission is separate.

## Current Implementation Summary

### Unified Candidate Shell

Primary file:

- `components/mvp/simulator/ServiceDeskSimulatorShell.tsx`

The candidate route now renders this shell directly:

- `app/mvp/assessment/[token]/page.tsx`

The older split between chat page and `ItsmCandidateShell` is gone from the visible route. `components/mvp/simulator` is now the active direction.

### Assignment Capabilities

Primary file:

- `lib/mvp/assignment-types.ts`

It defines `SimulatorCapabilities`:

- `call`
- `voice`
- `textFallback`
- `ticketPanel`
- `remoteDesktop`
- `tools`
- `ticketComposer`

Assignment types now map to capabilities. `assessment_mode` still exists for DB/backward compatibility, but new runtime decisions should prefer assignment capabilities wherever possible.

### Candidate Event Logging

New generic candidate event route:

- `app/api/mvp/assessment/[token]/event/route.ts`

Use this for UI/workflow events that are not sim-pack tool actions:

- open ticket
- claim ticket
- post internal note
- open closure notes
- start/end non-sim calls

These go into `session_events`, which is the canonical event stream.

### Sim Tool Event Logging

Remote/tool actions still go through:

- `POST /api/mvp/assessment/[token]/sim/action`
- `app/api/mvp/assessment/[token]/sim/action/route.ts`
- `lib/mvp/sim/eventLog.ts`

`insertSimEvent` writes to `sim_events` and mirrors to `session_events`. `session_events` remains the source of truth for scoring/reporting/evidence.

### Current Remote Desktop Direction

Primary files:

- `components/mvp/simulator/RemoteDesktopPane.tsx`
- `components/mvp/simulator/OutlookPanel.tsx`
- `components/mvp/simulator/BrowserPanel.tsx`
- `components/mvp/simulator/CommandPromptPanel.tsx`

Recent changes moved away from a right-hand action list toward:

- Windows-like desktop surface
- taskbar
- app icons
- window frames
- Outlook clone with folders, Outbox, ribbon controls, Work Offline status
- Control Panel clone for risky/destructive mistake paths

This is the correct direction, but it is still only a first pass. Continue building app-like interactions instead of adding more exposed “action buttons.”

### State Machine Freedom

Primary files:

- `lib/mvp/sim/stateMachine.ts`
- `lib/mvp/sim/safeProjection.ts`

Recent change: the state machine no longer hard-rejects actions based on phase. Candidates can attempt actions in a free order. The system can still produce failed outcomes for actions that naturally cannot succeed, but those attempts should be logged.

Important principle:

Do not use UI gating or backend phase rejection to force the ideal path. Let the candidate behave naturally. Score after.

## Styling Guidance For New Agent

The manager dashboard and candidate service desk should copy the ConnectWise-style visual language as closely as practical:

- dense white/grey enterprise UI
- black/dark header chrome
- square or 2-3px radius controls
- small bold uppercase table headers
- monochrome base palette with restrained status colors
- data grids over big cards
- ticket board as the default view
- ticket detail with metadata rows, notes, status, owner, priority, SLA
- no hero sections
- no gradient-orb backgrounds
- no “AI app” card aesthetic
- no chat-bubble-first interface

Key manager-side files:

- `app/mvp/page.tsx`
- `components/mvp/ManagerShell.tsx`
- `components/mvp/itsm/ItsmTicketTable.tsx`
- `components/mvp/itsm/ItsmStatsCards.tsx`
- `components/mvp/itsm/ItsmSidebar.tsx`

The manager dashboard currently improved visually, but it still needs to become more like a ConnectWise ticket board:

- Add board filters: Help Desk, New, In Progress, Waiting Customer, Completed.
- Add columns: Ticket, Company, Contact, Summary, Status, Priority, Owner, Last Updated, Assignment Type, Score.
- Make row click open the assessment detail.
- Reduce decorative stats-card feel. Use compact counters/toolbars instead.
- Make create-assignment feel like creating/sending a ticket/work item, not a marketing flow.

## Codebase Map

### Candidate App

- `app/mvp/assessment/[token]/page.tsx`
  Loads candidate assessment data and renders `ServiceDeskSimulatorShell`.

- `components/mvp/simulator/ServiceDeskSimulatorShell.tsx`
  Main unified candidate shell. Contains queue, ticket detail, call bar, notes, transcript, remote desktop, closure.

- `components/mvp/simulator/CallBar.tsx`
  Persistent top call state and voice controls.

- `components/mvp/simulator/TicketSidePanel.tsx`
  Narrow ticket panel used during remote mode.

- `components/mvp/simulator/WorkArea.tsx`
  Closure composer and shared work area helpers. The old CTI/start-call placeholder should not be reintroduced.

- `components/mvp/voice/VoiceRecorderButton.tsx`
  Browser microphone recording and STT upload.

- `components/mvp/voice/CustomerAudioPlayer.tsx`
  TTS playback hook.

### Candidate APIs

- `app/api/mvp/assessment/[token]/route.ts`
  Candidate load endpoint. Returns assignment runtime/capabilities, ticket, messages, and sim data when available.

- `app/api/mvp/assessment/[token]/message/route.ts`
  Candidate message/voice transcript endpoint. Stores transcript in `messages` and `session_events`, calls AI customer, stores customer reply.

- `app/api/mvp/assessment/[token]/voice/transcribe/route.ts`
  STT endpoint.

- `app/api/mvp/assessment/[token]/voice/tts/route.ts`
  TTS endpoint.

- `app/api/mvp/assessment/[token]/event/route.ts`
  Generic candidate workflow event endpoint.

- `app/api/mvp/assessment/[token]/sim/route.ts`
  Loads safe sim state/actions/timeline.

- `app/api/mvp/assessment/[token]/sim/action/route.ts`
  Applies sim-pack actions and logs them.

- `app/api/mvp/assessment/[token]/ticket/route.ts`
  Submits final candidate ticket/closure.

### Sim Engine

- `lib/mvp/sim/packConfig.ts`
  Outlook Work Offline training drill pack. Defines tools/actions/rubric/hidden truth.

- `lib/mvp/sim/stateMachine.ts`
  Applies actions to sim state. Keep this permissive. Avoid hard phase gates.

- `lib/mvp/sim/safeProjection.ts`
  Projects state/actions to candidate UI. Avoid hidden answer leakage.

- `lib/mvp/sim/eventLog.ts`
  Logs sim events and mirrors them into canonical `session_events`.

- `lib/mvp/events/eventLog.ts`
  Canonical event log helpers.

- `lib/mvp/sim/scoring.ts`
  Deterministic sim scoring.

### Manager App

- `app/mvp/page.tsx`
  MVP dashboard / assignment creation / queue.

- `app/mvp/assessments/[id]/page.tsx`
  Manager assessment detail and evidence view.

- `app/api/mvp/assessments/route.ts`
  Creates/list assessments. Still writes `assessment_mode` for compatibility.

- `app/api/mvp/assessments/[id]/route.ts`
  Manager detail data.

- `app/api/mvp/assessments/[id]/analyse/route.ts`
  Analysis trigger.

## Important Recent Changes

1. Removed hidden-answer leak from closure placeholder.
   Do not put the root cause/fix in candidate-facing placeholder text.

2. Added unified capability model in tests and runtime.
   `scripts/test-assignment-types.mjs` now asserts unified-shell capabilities instead of old mode mapping assertions.

3. Fixed `scripts/test-voice.mjs`.
   It now transpiles local TypeScript modules with the installed `typescript` package so the smoke test actually runs.

4. Added generic event logging.
   `POST /api/mvp/assessment/[token]/event` records normal ticketing UI actions into `session_events`.

5. Began desktop foundation.
   Remote desktop now has desktop/taskbar/app windows and an Outlook clone. Continue this direction.

## Current Gaps / Next Work

### 1. Replace Remaining Action-Button Thinking

The remote desktop should not be “action buttons on a screen.” Build actual app surfaces:

- Outlook should have clickable folder list, ribbon, status bar, message list, account status.
- Browser should have address bar, webmail page, send-test affordance.
- Command Prompt should allow typed commands or at least command-line-like interaction.
- Control Panel should show realistic tool entries for risky actions.

Actions should be triggered by app UI affordances, not a training checklist.

### 2. Improve Outlook Clone

Next Outlook improvements:

- Make Work Offline toggle visually behave like Outlook’s Send/Receive ribbon.
- Show status bar at bottom from first open.
- When Work Offline is disabled, update status to Connected.
- When Send/Receive runs after disabling Work Offline, clear Outbox count.
- Show sent item/test email confirmation.
- Avoid revealing root cause text before the candidate notices it in UI.

### 3. Internal Notes Should Persist Better

Internal notes currently live in frontend state and are logged to `session_events`. Consider rendering prior posted notes from timeline/session events on reload.

### 4. Manager Dashboard Needs ConnectWise Pass

The candidate side got most attention. The manager dashboard still needs a stronger ConnectWise-like service-board pass:

- compact toolbar
- board tabs
- dense assessment/ticket grid
- row click to detail
- less card-like creation flow
- stronger assessment status/score/readiness labels

### 5. Training Shift Is Not Ready

Keep it visible as coming soon only. Do not build multi-ticket shift until the single-ticket shell and remote desktop foundation feel correct.

### 6. Avoid Building A Full OS Window Manager

There is tension in the docs: `cohesion.md` says no full Windows desktop simulation, but recent user feedback asked for an actual desktop-like foundation. The correct compromise is:

- desktop-like remote sandbox with app windows/taskbar
- no draggable/resizable/z-index-heavy window manager
- no full-screen takeover
- ticket/call/notes stay available

## Testing Commands

Use these after simulator changes:

```bash
npm run test:dashboard-sim
npm run test:dashboard-sim-foundation
npm run test:assignment-types
node scripts/test-session-events.mjs
node scripts/test-voice.mjs
npm run build
```

Notes:

- Some tests spawn shell commands and may need sandbox approval.
- Existing build warnings about `<img>` and hook deps predate this work.
- Running `npm run build` while `next dev` is active can corrupt/dirty `.next` dev cache. Restart the dev server afterwards.

## Dev Server

Current dev server command used:

```bash
npx next dev -H 0.0.0.0 -p 3003
```

Local URL:

```text
http://localhost:3003/mvp
```

## Guardrails For New Agent

- Preserve one shell. Do not branch back into separate candidate experiences.
- Preserve voice-first call flow.
- Do not show root cause or correct fix in candidate-facing placeholder text.
- Do not add generic "Next step" action lists. Build UI surfaces that imply real tools.
- Let candidates make mistakes. Log everything. Score later.
- Keep ticketing visible and professional.
- Copy ConnectWise-like density and visual language for the manager dashboard.
- Treat `assessment_mode` as compatibility plumbing, not product architecture.
- Prefer `assignment_type` and `SimulatorCapabilities` for runtime behavior.
- Keep `session_events` canonical for evidence, transcript, actions, notes, and scoring.

---

## Session 2026-06-26 — Global Styling & Gap Fixes

### Global ConnectWise-style Design Tokens

`app/globals.css` now defines a full set of `--cx-*` CSS custom properties shared across all pages:

- `--cx-bg-main`, `--cx-bg-white`, `--cx-bg-light`, `--cx-bg-dark`, `--cx-sidebar-bg`, `--cx-header-bg`
- `--cx-border`, `--cx-border-light`, `--cx-border-table`, `--cx-border-dark`
- `--cx-text-primary`, `--cx-text-secondary`, `--cx-text-muted`, `--cx-text-link`
- accent colors for green/red/yellow states
- `--cx-radius: 3px` (boxy/square controls)

All components use inline styles referencing these values, so changing a token in `globals.css` propagates everywhere.

### Manager Dashboard Restyled

Changed from blue theme to ConnectWise black/white boxy style:

- **ItsmSidebar**: Blue (`#1b2f53`) → black (`#111`) with white text, dark header, white accent borders
- **ItsmStatsCards**: Decorative cards with emoji/icons/colored borders → compact bordered counter bar (no box shadow, no emoji)
- **app/mvp/page.tsx**: Blue buttons (`#82b814`, `#0070d2`) → black/white, 3px radius, dense table layout, ConnectWise-style "Create Assignment" bordered panel

### Gap 1: Text Chat Removed (Voice-Only)

Per `cohesion.md`, the `CallTranscriptPanel` was replaced with a collapsible `TranscriptToggle`:

- No text input for conversation — voice recording (`VoiceRecorderButton`) is the only interaction
- Transcript history hidden behind a "Show Transcript" toggle (read-only, no send)
- Status bar shows call state; mic button in CallBar for speaking

### Gap 2: Remote Sandbox Tab System

Replaced `WindowFrame` (absolute-positioned window overlays with minimize) with a proper tab-based panel in `RemoteDesktopPane`:

- Tab bar: Desktop | Outlook | Edge | Command | Control Panel
- Content switches without `position:absolute` overlays
- No drag/resize/minimize — matches `cohesion.md` requirement
- Taskbar at bottom shows active apps

### Gap 3: Outlook Clone Improvements

`OutlookPanel` updates:

- Status bar ("Working Offline" / "Connected") always visible from first open
- Send/Receive button disabled while Work Offline is active
- Work Offline toggle updates connection state in real time
- Sent confirmation shown after test email
- Folder counts update dynamically (Sent Items shows 1 after send)

### New: Tabbed Notes Panel

Replaced `InternalNotesPanel` with a `NotesPanel` component offering two tabs:

- **Internal Notes**: Personal scratchpad — questions to ask, facts to capture. Posts to `session_events`.
- **Live Notes**: Ticket/closure notes area with monospace font, ready for final submission.

Both tabs available in the non-remoted ticket workbench and the remoted right-side panel.

### Removed: Work Status Card from Ticket Detail

The "Work Status" card showing call state (`Incoming call from...`, `On call with...`) was removed from the ticket work area. Call state is now only displayed in the persistent **CallBar** at the top of the shell, matching `cohesion.md` design.

### Tests

All 109 tests pass across 5 suites:

```bash
npm run test:assignment-types     # 21 passed
npm run test:dashboard-sim        # 28 passed
npm run test:dashboard-sim-foundation  # 24 passed
node scripts/test-session-events.mjs   # 16 passed
node scripts/test-voice.mjs            # 20 passed
npm run build                      # compiles clean
```

## Dev Server

```bash
npx next dev -H 0.0.0.0 -p 3000
```

**Important**: The host firewall uses UFW with default DROP policy. Port 3000 is explicitly allowed. If the server is unreachable from a browser, check that:
1. The port is in `sudo ufw status` — if not, run `sudo ufw allow 3000/tcp`
2. The server is actually running — `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/mvp` should return 200
3. No stale `EADDRINUSE` error — kill old processes with `kill $(lsof -ti:3000)` then restart with fresh `.next` dir

Current URLs:

```text
http://138.199.223.35:3000/mvp                        # Manager dashboard
http://138.199.223.35:3000/mvp/assessment/<token>     # Candidate assessment
```

---

## Session 2026-06-26 — Interactive Win11 Desktop (BUILT)

### What Was Built

The remote desktop tab system was fully replaced with a Windows-11-style desktop with interactive app windows. Every interaction is local React state — zero CPU/GPU cost, zero new dependencies.

### New Foundation Files (9 files)

| File | Purpose |
|---|---|
| `components/mvp/simulator/useContextMenu.ts` | Right-click context menu hook (~50 lines) |
| `components/mvp/simulator/ContextMenu.tsx` | Dark-themed context menu renderer |
| `components/mvp/simulator/WindowFrame.tsx` | Shared window wrapper (title bar × close button, 8px radius) |
| `components/mvp/simulator/DesktopSurface.tsx` | Blue gradient desktop with 7 app icons |
| `components/mvp/simulator/Taskbar.tsx` | Dark Win11-style taskbar, Start button, app buttons, clock |

### Interactive App Components (7 files)

All apps use local `useState` for UI navigation. Only scoring-relevant actions (Disable Work Offline, Send Test Email, Ping, etc.) hit the backend `POST /sim/action`.

**OutlookApp** (`OutlookApp.tsx` — replaces `OutlookPanel.tsx`):
- Clickable folder sidebar: Inbox (12 mock), Drafts (1), Sent Items, Outbox (from sim state), Deleted Items
- Switchable ribbon tabs: Home, Send/Receive, Folder, View — each shows different toolbar buttons
- Email list with clickable rows, right-click context menu (Mark Read/Unread, Delete, Print)
- Reading pane: back/forward, shows sender/subject/body
- Status bar always visible: Working Offline/Connected status, outbox count, clickable to inspect connection
- Ribbon toggle for Work Offline (highlights red when active)

**CmdApp** (`CmdApp.tsx` — replaces `CommandPromptPanel.tsx`):
- Typeable command line at bottom with blinking caret
- Command history via ArrowUp/ArrowDown
- Known commands: `help`, `cls`, `whoami`, `dir`, `ping` (hits backend), `ipconfig` (hits backend), `nslookup`, `tracert`
- Mock realistic output for each command
- Black terminal background, green prompt, monospace font

**BrowserApp** (`BrowserApp.tsx` — replaces `BrowserPanel.tsx`):
- Multiple tabs with close buttons, add tab (+)
- Editable address bar with Enter to navigate
- "Check Outlook Web App" quick link — navigates to simulated OWA page
- Blank page shows search-engine-like UI with bookmarks
- OWA page shows working webmail status

**ControlPanelApp** (`ControlPanelApp.tsx` — extracted from inline code):
- Sidebar: Control Panel Home, Programs, Mail, Network and Internet, System
- Programs view: "Repair Microsoft 365 Apps" (info), "Reinstall Outlook" (red flag, hits backend)
- Mail view: "Delete Outlook profile" (red flag, hits backend)
- Network view: Shows active network, IP info
- System view: Device name ALDER-LT-023, RAM, Windows version
- Red flag actions shown with ⚠ warning banners

**NetworkApp** (`NetworkApp.tsx`):
- Tabs: Status, Wi-Fi, Ethernet
- Status: shows IPv4, gateway, DNS, DHCP status
- Wi-Fi: shows Wi-Fi is off (device on ethernet)
- Ethernet: adapter details, speed, MAC, IP config

**VpnApp** (`VpnApp.tsx`):
- Toggle VPN connection on/off (local state)
- Shows connection status with green/grey dot
- VPN type, server address, IPsec info

**PrinterApp** (`PrinterApp.tsx`):
- Lists 3 printers with status badges (Online/Offline)
- HP LaserJet Pro M404dn shows offline with 3 stuck jobs in queue
- Canon imageRUNNER shows online
- Microsoft Print to PDF always available
- Click detail view shows IP, driver, queue, troubleshooting info

### RemoteDesktopPane Rewrite

Replaced tab system (`Desktop \| Outlook \| Edge \| CMD \| Control Panel`) with `useReducer`-based desktop state:

```ts
type DesktopAction = { type: 'OPEN', app, title } | { type: 'CLOSE', app } | { type: 'FOCUS', app };
```

- Desktop shows 7 app icons in left column
- Clicking an icon opens a `WindowFrame` at preset position (full height, floating)
- Multiple windows cascade — z-ordering via reducer's `nextZ` counter
- Taskbar shows open app buttons, clicking focuses window
- Close button on each window title bar
- No drag, no resize, no minimize (per `cohesion.md`)

### Backend Changes

| File | Change |
|---|---|
| `lib/mvp/events/types.ts` | Added `'ui_interaction'` to `SessionEventType` |
| `lib/mvp/sim/types.ts` | Added `'network'`, `'vpn'`, `'printer'` to `SimToolId` |
| `app/api/mvp/assessment/[token]/event/route.ts` | Added `ui_interaction` to allowed types, relaxed session status check to allow `not_started` |
| `lib/mvp/sim/packConfig.ts` | Added `network`, `vpn`, `printer` to tools array |

### Event Recording Architecture

```
UI-only interaction (folder click, right-click, typed command, window open/close)
    ↓
recordAppEvent(app, actionId, label)  // in ServiceDeskSimulatorShell
    ↓
POST /api/mvp/assessment/[token]/event  { event_type: 'ui_interaction', tool_id, action_id, label }
    ↓
INSERT into session_events  (canonical evidence timeline)

Scoring-relevant action (disable Work Offline, send test email, reinstall)
    ↓
onAction(actionId, tool)  // in RemoteDesktopPane
    ↓
POST /api/mvp/assessment/[token]/sim/action
    ↓
State machine → sim_events + session_events (full state tracking)
```

### Remaining Gaps

1. **Internal notes lost on reload** — `internalNotes` state starts empty. Should load prior notes from `session_events` on mount (filter by `event_type = 'ticket_note_updated'` and `action_id = 'add_internal_note'`).
2. **Transcript doesn't show system events** — `TranscriptToggle` only shows `messages` array (candidate + caller). Should merge `session_events` entries (action observations, phase transitions) sorted by timestamp.
3. **New app sim actions** — NetworkApp, VpnApp, PrinterApp are locally interactive but have no backend sim actions. They could be wired into future drill packs (e.g., a Wi-Fi troubleshooting scenario).
4. **Loading state for remote desktop** — When `simData` is null and `capabilities.remoteDesktop` is true, the shell shows nothing. Should show "Connecting to remote desktop..." until data loads.
5. **NotesPanel Live Notes tab doesn't submit** — The Live Notes tab in the remote layout's NotesPanel shows ticketText but there's no submit button. The ticket is submitted only from the `ticketing` phase's `TicketComposerView`.

### Tests

All 109 tests pass across 5 suites:

```bash
npm run test:assignment-types          # 21 passed
npm run test:dashboard-sim             # 28 passed
npm run test:dashboard-sim-foundation  # 24 passed
node scripts/test-session-events.mjs   # 16 passed
node scripts/test-voice.mjs            # 20 passed
npx tsc --noEmit                       # compiles clean
```

### Key Codebase Map (simulator components)

```
components/mvp/simulator/
├── ServiceDeskSimulatorShell.tsx   # Main candidate shell (orchestrates everything)
├── RemoteDesktopPane.tsx           # Desktop + window management (useReducer)
├── WindowFrame.tsx                 # Shared window wrapper
├── DesktopSurface.tsx             # Desktop icons
├── Taskbar.tsx                    # Taskbar with app buttons
├── ContextMenu.tsx                 # Right-click context menu
├── useContextMenu.ts               # Context menu hook
├── OutlookApp.tsx                  # Rich Outlook clone (active)
├── BrowserApp.tsx                  # Browser with tabs/address bar
├── CmdApp.tsx                      # Typeable terminal
├── ControlPanelApp.tsx             # Control Panel with categories
├── NetworkApp.tsx                  # WiFi/Ethernet status
├── VpnApp.tsx                      # VPN toggle
├── PrinterApp.tsx                  # Printer queue/status
├── TicketSidePanel.tsx             # Left ticket panel in remote mode
├── CallBar.tsx                     # Top call status bar
├── WorkArea.tsx                    # Work status / closure composer
├── VoiceRecorderButton.tsx         # Mic button for voice
└── CustomerAudioPlayer.tsx         # TTS playback
```

### Guardrails For New Agent

- Preserve one shell. Do not branch back into separate candidate experiences.
- Preserve voice-first call flow (text chat is collapsed behind transcript toggle).
- Do not show root cause or correct fix in candidate-facing placeholder text.
- Do not add generic "Next step" action lists. Build UI surfaces that imply real tools.
- Let candidates make mistakes. Log everything. Score later.
- Keep ticketing visible and professional.
- Copy ConnectWise-like density and visual language for the manager dashboard.
- Treat `assessment_mode` as compatibility plumbing, not product architecture.
- Prefer `assignment_type` and `SimulatorCapabilities` for runtime behavior.
- Keep `session_events` canonical for evidence, transcript, actions, notes, and scoring.
- Do not add drag/resize/minimize to window frames (per `cohesion.md`).
- All UI interactions should be local React state — zero network cost for folder clicks, etc.
- Only scoring-relevant actions call `POST /sim/action`. Everything else is `POST /event` with `ui_interaction`.
- New app components must be added to both `packConfig.ts` tools array and `sim/types.ts` SimToolId.
```

---

## Session 2026-06-26 — SimPack Foundation & Taxonomy Upload

### Foundation: Extensible SimState (toolStates)

`SimState` converted from Outlook-specific named fields to a generic `toolStates` map supporting any tool:

```ts
// Before:
interface SimState {
  outlook?: { workOffline: boolean; outboxCount: number; ... };
  network?: { internetReachable: boolean; ... };
  connectwise?: { ticketId: string | null; ... };
}

// After:
type SimToolStateKey = 'outlook' | 'network' | 'connectwise' | 'printer' | 'vpn';
interface SimState {
  toolStates: Partial<Record<SimToolStateKey, Record<string, unknown>>>;
}
```

Migration impact:
- `stateMachine.ts` — all effect paths changed from `outlook.workOffline` to `toolStates.outlook.workOffline`
- `safeProjection.ts` — reads from `toolStates` with per-tool visibility guards (printer/vpn added)
- `OutlookApp.tsx` / `PrinterApp.tsx` / `VpnApp.tsx` — read from `state.outlook|printer|vpn` (safeProjection surfaces these as top-level keys)
- `aiCustomer.ts` — reads `state.toolStates.outlook` and `state.toolStates.network`
- `packConfig.ts` — all effect paths updated to `toolStates.*` prefix

### Foundation: Open TaxonomyTag + Runtime Validation

`TaxonomyTag` converted from closed union of 39 literals to open `string` with structural validation:

```ts
export type TaxonomyTag = string;

export function isValidTaxonomyTag(tag: string): boolean {
  return /^[a-z_]+\.[a-z_]+\.[a-z_]+$/.test(tag);
}
```

`REGISTERED_TAXONOMY_TAGS` registry added for documentation/discovery. New packs define their own tags by following the `domain.category.item` convention.

### Foundation: Pack-Driven Scoring

`SimPack` extended with two new fields:

```ts
interface SimPackScoringCriterion {
  id: string; label: string; weight: number;
  check: 'action_performed' | 'tag_present' | 'tag_in_event' | 'state_value';
  target: string; value?: unknown; positive?: boolean;
}

interface SimPackDiagnosticStep {
  id: string; label: string; criteria: string;
}
```

`scoring.ts` completely rewritten — reads `pack.scoringCriteria` and `pack.diagnosticChecklist`, evaluates each criterion generically, no hardcoded action IDs or tag comparisons. The old Outlook scoring logic moved into `packConfig.ts` as data arrays.

### Foundation: State Machine Generic Preconditions

`SimAction` extended with:
- `strictPreconditions?: boolean` — when true, effects are NOT applied if preconditions fail
- `failureObservation?: string` — shown when preconditions fail

State machine replaced hardcoded `['send_receive', 'send_test_email']` action ID list with these fields. Phase transitions (`start_call`, `remote_connect`, `end_call`) remain generic trigger-based.

### Foundation: DesktopSurface Bug Fix

`DesktopSurface.tsx` had zero height — `flex: 1` on a non-flex parent + only absolute children + `overflow: hidden` clipped all desktop icons to 0px. Changed to `position: absolute; inset: 0` to fill parent. This is why the remote desktop showed no apps.

### Foundation: CmdApp New Commands

Added 5 commands to `CmdApp.tsx` for multi-pack support:

| Command | Purpose | Backend action |
|---|---|---|
| `sc query spooler` | Check Print Spooler service status | — |
| `net start spooler` | Start Print Spooler | `restart_spooler` |
| `net stop spooler` | Stop Print Spooler | — |
| `ipconfig /flushdns` | Flush DNS cache | `flush_dns` |
| `nslookup <hostname>` | DNS resolution lookup | — |

Commands are state-aware — e.g., `sc query spooler` shows STOPPED/RUNNING based on `toolStates.printer.spoolerRunning`, `nslookup` returns NXDOMAIN when `toolStates.network.dnsWorks === false`.

### Foundation: PrinterApp + VpnApp State-Driven

Previously both used local `useState`. Now accept `state` + `onAction` props and read from sim state:

- **PrinterApp** — shows HP Offline/Online status, stuck jobs queue, spooler status hint, "Send Test Page" button, test page sent confirmation. All driven by `state.printer.*`
- **VpnApp** — shows connected/disconnected status, last error message, DNS troubleshooting hint, "Connect" and "Check Status" buttons. All driven by `state.vpn.*`

`RemoteDesktopPane` updated to pass `state` and `onAction` to both.

### Taxonomy XLSX Upload

**API Route:** `POST /api/mvp/taxonomy`

Accepts `multipart/form-data` with:
- `file` — .xlsx file (expected columns: ID, Board_Name, Type, SubType, Item, definition scope, Playbook, keywords, Helpdesk Tier, Escalation Guidance)
- `action=replace` (optional) — clears all existing items before import

Parses XLSX via `xlsx` library, generates deterministic IDs via `md5(ID+Type+SubType+Item)`, uses `INSERT OR IGNORE` for idempotent dedup. Returns `{ ok, total, inserted, skipped, typeCounts }`.

**Manager UI:** `app/mvp/taxonomy/page.tsx`

Added upload section at top of taxonomy page:
- File picker for .xlsx files
- "Replace all existing items before import" checkbox
- Upload status feedback (success/error banner with counts)
- ConnectWise-style boxy visual design

### Architecture Spec

`simpack.md` — 858-line architecture document covering:
- Current architecture assessment (what works vs what's coupled)
- 6-step foundation refactor (all implemented in this session)
- Full spec for 2 new drill packs (Printer Spooler, VPN DNS) with actions, rubric, scoring criteria
- Cross-assignment reuse diagram (hiring exam / training drill / training shift)
- 4-level manager customization path (built-in → parameterized → taxonomy-driven → custom builder)
- Training shift architecture outline
- Prioritized implementation order
- Verification matrix proving same shell reused across packs
- 10 guardrails for implementation

### Tests

All 109 tests pass across 5 suites:

```bash
npm run test:assignment-types          # 21 passed
npm run test:dashboard-sim             # 28 passed
npm run test:dashboard-sim-foundation  # 24 passed
node scripts/test-session-events.mjs   # 16 passed
node scripts/test-voice.mjs            # 20 passed
npx tsc --noEmit                       # compiles clean
npm run build                          # 54 static pages generated
```

### Files Changed (16)

```
lib/mvp/sim/types.ts                    # toolStates, open TaxonomyTag, scoring types
lib/mvp/sim/stateMachine.ts             # strictPreconditions, failureObservation
lib/mvp/sim/scoring.ts                  # pack-driven rewrite
lib/mvp/sim/safeProjection.ts           # toolStates reads, printer/vpn visibility
lib/mvp/sim/packConfig.ts              # toolStates paths, scoringCriteria, checklist
lib/mvp/sim/aiCustomer.ts              # toolStates reads
components/mvp/simulator/CmdApp.tsx     # 5 new commands + state prop
components/mvp/simulator/PrinterApp.tsx # state-driven rewrite
components/mvp/simulator/VpnApp.tsx     # state-driven rewrite
components/mvp/simulator/RemoteDesktopPane.tsx  # pass state/onAction to apps
components/mvp/simulator/DesktopSurface.tsx     # position:absolute fix
components/mvp/simulator/ControlPanelApp.tsx    # ESLint fix
components/mvp/simulator/NetworkApp.tsx         # ESLint fix
app/api/mvp/taxonomy/route.ts          # POST handler for XLSX upload
app/mvp/taxonomy/page.tsx              # Upload UI section
simpack.md                             # Architecture spec (new file)
```

---

## Session 2026-06-26 — PSA Ticket Workspace & Triage Workflow

### Two-Column Ticket Detail Layout

Restructured the candidate ticket detail from a flat single-column layout into a proper ConnectWise-style two-column workspace:

```
┌──────────320px──────────┬──────────────────────────────────┐
│ LEFT: Metadata + Triage │ RIGHT: Work Area                 │
│                         │                                  │
│ ← Back to service board │ Customer Description             │
│ INC-XXXXXX  🔴 HIGH     │                                  │
│ Title / Requester info  │ Notes Panel                      │
│ Status  ║ Owner ║ Board │ [Internal Notes] [Live Notes]    │
│ SLA: Due Today          │ note list / scrollable           │
│                         │ shared composer                  │
│ [Claim] [Open Remote]   │ Ctrl+Enter to post               │
│ [Submit Ticket]         │                                  │
│                         │ Call Transcript (collapsed)      │
│ Triage Ticket           │                                  │
│ Status / Type / Cat...  │ Remote Desktop (when active)     │
│ Impact / Urgency / Pri  │                                  │
│ Submit Triage           │                                  │
└─────────────────────────┴──────────────────────────────────┘
```

Key changes:
- SLA/Board moved from horizontal cards into the left metadata panel
- Customer description stays on the right above notes
- Notes panel uses the full right-column width
- Remote desktop replaces the right column content when active (notes preserved in state)
- Disconnect remote restores the notes view

### Triage Workflow

Before working the ticket, the candidate completes a triage form:

1. Claim ticket → logs `ticket_claimed`
2. Set Status (Open / In Progress / Waiting Customer / Resolved / Escalated) → logs `ticket_status_updated`
3. Select Type → from taxonomy (Incident / Request)
4. Select Category → from taxonomy sub_types (Desktop/Laptop, Email, Network...)
5. Select Subcategory → from taxonomy items
6. Select Impact → Extensive / Large / Medium / Small
7. Select Urgency → Critical / High / Medium / Low
8. Select Priority → P1-P5 from taxonomy
9. Submit Triage → logs `ticket_triage_submitted` with full triage snapshot

After submission, the triage panel shows a read-only summary.

### Taxonomy: Live from DB

The triage category/subcategory/item options now come from the **uploaded Master Triage Classification XLSX** (163 items in the taxonomy_items DB table), not hardcoded arrays:

- `GET /api/mvp/taxonomy/ticket-taxonomy` — new API route merging DB taxonomy_items with default impact/urgency/priority options
- Frontend fetches this on mount and falls back to `defaultTicketTaxonomy.ts` if the API is unavailable

### Event Logging

Every triage action logs to `session_events` with old/new values and taxonomy tags:

| Event Type | Description |
|---|---|
| `ticket_claimed` | Candidate claimed the ticket |
| `ticket_status_updated` | Status changed |
| `ticket_type_set` | Ticket type selected |
| `ticket_category_set` | Category selected |
| `ticket_subcategory_set` | Subcategory selected |
| `ticket_item_set` | Item/service selected |
| `ticket_impact_set` | Impact selected |
| `ticket_urgency_set` | Urgency selected |
| `ticket_priority_set` | Priority selected |
| `ticket_triage_submitted` | Full triage submitted |

### New/Extracted Components

| File | Purpose |
|---|---|
| `components/mvp/simulator/TicketMetadataPanel.tsx` | Left metadata panel — ticket ID, severity, title, requester, status, owner, board, SLA |
| `components/mvp/simulator/TicketTriagePanel.tsx` | Triage form with cascade selects (category→subcategory→item), impact/urgency/priority, submit. Read-only summary after submission |
| `components/mvp/simulator/TicketNotesPanel.tsx` | Extracted from shell — Internal/Live Notes tabs, shared composer, scrollable list, persists across remote open/close |
| `app/api/mvp/taxonomy/ticket-taxonomy/route.ts` | API endpoint merging DB taxonomy_items with default impact/urgency/priority options |
| `lib/mvp/taxonomy/defaultTicketTaxonomy.ts` | Default fallback taxonomy (used when DB is empty or API unavailable) |

### Tests

All 109 tests pass across 5 suites:

```bash
npm run test:dashboard-sim             # 28 passed
npm run test:assignment-types          # 21 passed
npm run test:dashboard-sim-foundation  # 24 passed
node scripts/test-session-events.mjs   # 16 passed
node scripts/test-voice.mjs            # 20 passed
npx tsc --noEmit                       # compiles clean
npm run build                          # 55 static pages generated
```

---

## Session 2026-06-26 — Auto-Analysis Spec, Triage UX Fixes, Subcategory Type Filter

### Changes

**Type → Subcategory filtering** — subcategory options now filter by the selected type. Selecting "Incident" shows only Incident subcategories; selecting "Request" shows only Request subcategories. Changing type resets subcategory/item selections.

**Collapsible triage panel** — after all triage fields are filled and submitted, the panel collapses to a summary view showing Status/Board/Type/Subcategory/Priority. Click "▼ Edit" to reopen. Partial submissions don't auto-collapse.

**Submit for Review button** — added to the ticket queue page when the call has ended (phase=ticketing). Includes a textarea for the final ticket summary. Also accessible from the ticket detail header's "Submit Ticket" button.

**End call fix** — call status now correctly transitions to `'ended'` when the remote desktop path calls `end_call`, so the End Call button in CallBar disappears.

**Triage info on queue row** — the ticket queue table row now shows the triage selections (Tier, Type, Priority) inline below the ticket title.

### New Document

`automate.md` — detailed spec for post-submission auto-analysis, candidate-facing results walkthrough, retake flow, learning walkthrough (ideal diagnostic path vs actual), and manager AI assistant. Covers architecture, data flow, implementation order (6 phases), and guardrails.

---

## Session 2026-06-26 — Auto-Analysis on Submission

### Phase 1 + 2 Implemented

**Auto-analysis on ticket submission:**
- `POST /api/mvp/assessment/[token]/ticket` now triggers `runBaseCallumAnalysis()` after storing the ticket
- Full 3-stage pipeline runs synchronously: AI evidence extraction (deepseek-v4-flash via opencode.ai, temp 0) → deterministic scoring → AI narrative feedback (temp 0.3)
- Returns `analysis` (raw) + `candidate_analysis` (cleaned for display) in the response

**Candidate results view** (`components/mvp/results/AssessmentResults.tsx`):
- Shows: large score number, readiness label badge, diagnostic checklist (✓/✗ per criterion), strengths, improvements, ticket feedback, coaching focus
- ConnectWise-style dense layout
- Loading state: "Analyzing your performance..." while LLM processes

**Reload persistence:**
- `GET /api/mvp/assessment/[token]` returns `candidate_analysis` for completed/analysed assessments
- `app/mvp/assessment/[token]/page.tsx` passes `initialAnalysis` to shell on page load

**Helper added:**
- `buildCandidateAnalysis()` in `runBaseCallumAnalysis.ts` — extracts safe results from raw analysis (no internal model JSON, no hidden rubric)

### Files changed (7)
```
app/api/mvp/assessment/[token]/ticket/route.ts    # Triggers analysis after ticket stored
app/api/mvp/assessment/[token]/route.ts           # Returns analysis on GET for reload
lib/mvp/analysis/runBaseCallumAnalysis.ts          # Added buildCandidateAnalysis helper
components/mvp/results/AssessmentResults.tsx        # NEW: candidate results view
components/mvp/simulator/ServiceDeskSimulatorShell.tsx  # Loading + results state
app/mvp/assessment/[token]/page.tsx                # Passes initialAnalysis to shell
automate.md                                        # Updated with implementation progress
```

### Verified
- End-to-end test: full sim flow → ticket submission → analysis triggered → results returned with score, checklist, narrative
- All 109 tests pass
- Build: 55 static pages
