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

Current dev server command:

```bash
npx next dev -H 0.0.0.0 -p 3000
```

Current URLs:

```text
http://138.199.223.35:3000/mvp                        # Manager dashboard
http://138.199.223.35:3000/mvp/assessment/<token>     # Candidate assessment

---

## Next Work: Interactive App Surfaces

### Problem

The remote desktop apps (Outlook, Browser, CMD, Control Panel) currently have limited interactivity — clicking an app mostly triggers a backend sim action. The user wants to actually interact with the apps: click folders, right-click items, switch ribbon tabs, type commands, navigate pages — without triggering a backend call for every trivial UI action.

### Constraints

- **No heavy CPU/GPU** — this runs in a browser on unknown hardware. No canvas-based rendering, no VM-in-browser, no full OS simulation.
- **No window manager** — per `cohesion.md`, no drag/resize/minimize/z-index management.
- **Scoring-relevant actions still hit backend** — actions like "disable Work Offline", "send test email", "reinstall Outlook" must still be logged to `session_events` via `POST /api/mvp/assessment/[token]/sim/action`.
- **Local UI state is free** — folder selection, right-click menus, tab switching, hover states, scroll positions — all frontend-only, zero backend cost.

### Recommended Approach: Rich React Components + Local State + Selective Backend

Each app component becomes a rich interactive surface. Interactions split into two categories:

| Interaction | Handling | Example |
|---|---|---|
| UI navigation (click folder, switch ribbon tab, right-click menu, scroll) | Local React state, `useState` | Clicking Inbox folder just sets `selectedFolder: 'inbox'` |
| Scoring-relevant action | Backend `POST /sim/action` | Clicking "Disable Work Offline" sends action |
| UI state that reflects sim state | Polled from `simData.visible_state` via existing 10s interval | Outbox count, work offline status |

This approach costs near-zero CPU (React re-renders only the changed subtree) while making the apps feel real.

### Outlook Interactive Plan

Target file: `components/mvp/simulator/OutlookPanel.tsx`

**Folder navigation** (local state):
- Clicking any folder in the left sidebar sets `selectedFolder` and shows its contents
- Inbox shows real-looking email list (mock data)
- Drafts, Sent Items, Deleted Items show appropriate mock content
- Outbox reflects real `outboxCount` from sim state
- Folders show unread count badges

**Ribbon tabs** (local state):
- Clickable tabs: File, Home, Send/Receive, Folder, View
- Each tab shows different ribbon buttons (greyed out if not applicable)
- Home tab: New Email, Reply, Reply All, Forward, Delete
- Send/Receive tab: Send/Receive All (hits backend), Work Offline toggle (hits backend), Update Folder

**Email list interactivity** (local state):
- Click an email to select it (highlight)
- Double-click opens reading pane below
- Right-click context menu: Mark as Read, Mark as Unread, Delete, Print
- Reading pane shows sender, subject, body

**Status bar** (from sim state + local):
- Always visible: Connected/Work Offline status, outbox count, server info
- Clicking status area triggers connection status check (hits backend)

**Right-click context menu** (local state):
- Custom `useContextMenu` hook
- Menu appears at cursor position
- Dismisses on click outside or menu action

### Browser Interactive Plan

Target file: `components/mvp/simulator/BrowserPanel.tsx`

**Address bar** (local state):
- Editable URL bar at top
- Shows current "page"
- Clicking "Check Outlook Web App" navigates to OWA page

**Tab bar** (local state):
- Multiple tabs (New Tab, OWA, etc.)
- Click to switch, close button on each tab

**Page content** (local state):
- OWA page shows a simulated Outlook Web App login/page
- Search engine shows a mock search results page
- Pages can have clickable links

**Right-click** (local state):
- Context menu: Open in new tab, Copy link address, etc.

### Command Prompt Interactive Plan

Target file: `components/mvp/simulator/CommandPromptPanel.tsx`

**Text input** (local state):
- Editable command line at bottom
- User types commands and presses Enter
- Command history (up/down arrow)

**Known commands** (local state, not backend):
- `help` — list available commands
- `ipconfig` — show mock network config (also hits backend for scoring)
- `ping outlook.office365.com` — show mock ping output (also hits backend)
- `cls` / `clear` — clear screen
- `whoami` — show user
- Unknown commands show "command not recognized"

**Output area** (local state):
- Scrollable output showing command history + results
- Mock output looks like real CMD

### Control Panel Interactive Plan

Target file: currently inline in `RemoteDesktopPane.tsx`

**Category navigation** (local state):
- Clickable left sidebar categories: Programs, Mail, Network and Internet, System
- Each shows different content in the main area

**Programs view**:
- "Repair Microsoft 365 Apps" button (hits backend for red flag)
- "Reinstall Outlook" button (hits backend, red flag)
- "Delete mail profile" button (hits backend, red flag)

### Shared Infrastructure

```tsx
// Hook for right-click context menu
function useContextMenu() {
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const show = (e: React.MouseEvent, items: MenuItem[]) => { ... };
  const hide = () => setMenu(null);
  return { menu, show, hide };
}

// Global ContextMenuRenderer component
function ContextMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
  // Renders at fixed position, dark theme, closes on click outside
}
```

### Non-Goals

- Do not build a real terminal emulator or shell
- Do not build a real web browser
- Do not add drag/resize to app panels
- Do not render full desktop backgrounds or window chrome for each app
- Do not add animations that consume CPU (no CSS transitions on heavy elements)
- Do not replace the tab-based sandbox layout

### Effort Estimate

| Component | Changes | Est. size |
|---|---|---|
| `useContextMenu` hook | New file, ~60 lines | Small |
| `ContextMenu` component | New file, ~80 lines | Small |
| `OutlookPanel` | Major rewrite, ~400 lines | Medium |
| `BrowserPanel` | Moderate rewrite, ~200 lines | Medium |
| `CommandPromptPanel` | Significant rewrite, ~250 lines | Medium |
| `ControlPanel` (extract from RemoteDesktopPane) | Extract + enhance, ~150 lines | Small |

Total estimated additions: ~800-1000 lines of new React code, zero new dependencies, zero backend changes.
```
