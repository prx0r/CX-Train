# Remote Desktop — Interactive Win11-Style Sandbox Build Plan

## 1. Scope & Goals

Deliver an interactive Windows-11-style remote desktop sandbox inside the training drill shell. The candidate must be able to:

- See a realistic desktop with icons, taskbar, and app windows
- Open apps, click through their UIs naturally (folder navigation, ribbon tabs, typed commands, right-click menus)
- Have every meaningful interaction recorded in `session_events` for the evidence timeline
- Experience zero perceptible lag from UI interactions (all local React state)

All of this without:
- Canvas rendering, WebGL, or heavy graphics libraries (no CPU/GPU cost)
- Drag/resize/minimize window management (per `cohesion.md`)
- Full-screen takeover of the shell (per `cohesion.md` and `progress.md`)
- Any new npm dependencies
- Any backend schema changes

---

## 2. Architecture Decision

Four alternatives were considered:

| # | Approach | CPU/GPU | Interactivity | Engineering Cost | Verdict |
|---|---|---|---|---|---|
| A | Canvas-based desktop | Medium-High | Full | Very high | Rejected — no DOM accessibility, reimplementing text/scrollbars/layout in canvas is months of work |
| B | Full HTML/CSS window manager with drag/resize | Low | Full | High | Rejected — violates `cohesion.md` directive: no z-index-heavy window manager, no drag/resize |
| C | Tabbed panel (current) | Low | Low | Low | Rejected — not a desktop, no simultaneous app windows, feels like a settings page |
| **D** | **React window frames + local state + selective backend** | **Low** | **High** | **Medium** | **Selected** — window-like frames with title bars and close buttons, rich local UI state per app, only scoring actions hit the backend |

### Approach D in detail

Every app is a full React component with its own internal UI state. Interactions split into two categories:

| Interaction | Where state lives | Backend call? | Example |
|---|---|---|---|
| UI navigation (folder click, ribbon tab switch, typed command, right-click menu) | Local `useState` / `useReducer` | No | Clicking "Inbox" in Outlook folder sidebar |
| Scoring-relevant action (disable Work Offline, send test email, reinstall) | Backend `POST /sim/action` | Yes | Clicking "Disable Work Offline" ribbon button |

The desktop (icons, taskbar, open windows) is managed by a simple `useReducer` at the `RemoteDesktopPane` level. Windows are tiled at preset positions — no draggable coordinates, no resize handles, no z-index wars overhead.

---

## 3. Desktop Foundation

### 3.1 Component Tree

```
RemoteDesktopPane
├── RemoteHeader          (ScreenConnect bar — "Connected to ALDER-LT-023")
├── DesktopSurface        (Win11 wallpaper + icons)
│   └── DesktopIcon[]     (Outlook, Edge, CMD, Control Panel, Recycle Bin)
├── WindowManager         (renders open windows in z-order)
│   └── WindowFrame[]     (title bar + close button + app content)
│       ├── OutlookApp    (rich Outlook clone)
│       ├── BrowserApp    (browser with tabs + address bar)
│       ├── CmdApp        (typed command-line terminal)
│       └── ControlPanelApp (settings categories)
└── Taskbar               (Start button, open app buttons, clock)
```

### 3.2 Desktop State (useReducer)

```ts
interface DesktopState {
  openWindows: WindowEntry[];
  nextZ: number;
  activeApp: string | null;
}

interface WindowEntry {
  id: string;         // unique window id
  app: string;        // 'outlook' | 'browser' | 'cmd' | 'control_panel'
  title: string;      // app window title
  zIndex: number;     // stacking order
  position: { x: number; y: number };  // fixed preset position
  size: { w: number; h: number };      // fixed preset size
}

type DesktopAction =
  | { type: 'OPEN';  app: string; title: string }
  | { type: 'CLOSE'; app: string }
  | { type: 'FOCUS'; app: string }
  | { type: 'CLOSE_ALL' };
```

Rules:
- Only one window per app type (opening Outlook again focuses existing window)
- `FOCUS` bumps `zIndex` to `nextZ++` — simple stacking, no z-index wars
- `CLOSE_ALL` fired when leaving remote mode (state reset)
- Windows open at preset positions — no dragging, no coordinate math

### 3.3 Preset Window Positions

Windows auto-arrange in a cascading grid within the desktop bounds:

| App | Preset position | Size | Reason |
|---|---|---|---|
| Outlook | Centered `(40, 40)` | `calc(100% - 80px) x calc(100% - 120px)` | Largest — main work app |
| Browser | Offset `(70, 70)` | `calc(100% - 140px) x calc(100% - 160px)` | Slightly smaller, offset |
| CMD | Bottom-left `(40, bottom - 220)` | `600px x 200px` | Terminal-style overlay |
| Control Panel | Centered `(80, 60)` | `700px x 500px` | Settings dialog |

### 3.4 WindowFrame Component

Shared component wrapping every app window:

```
┌──────────────────────────────────────────────┐
│ ✦ Outlook - Sarah@Connexion Dental    [×]    │
├──────────────────────────────────────────────┤  ← title bar (32px, dark)
│                                              │
│         <App content goes here>              │  ← flex: 1
│                                              │
└──────────────────────────────────────────────┘
```

Props: `{ title, appId, zIndex, position, size, onClose, onFocus, children }`

- 8px border-radius (Win11 rounded corners)
- 1px solid border, light box-shadow
- Title bar has app icon + title + close button
- Clicking title bar or content calls `onFocus(appId)`
- Close button calls `onClose(appId)` + records event
- CSS `position: absolute` with the preset coordinates — no drag listeners
- Lightweight — just a styled `<div>` wrapper

### 3.5 DesktopSurface

- Background: deep blue gradient (`#0b5ea8` → `#0f77c8`) or a subtle wallpaper
- Desktop icons positioned in a grid (column layout, left-aligned)
- Icons: Outlook, Edge, Command Prompt, Control Panel, (Recycle Bin — visual only)
- Each icon is a `<button>` with icon glyph + label
- Single click selects, double click opens (or single click, since this is a training tool)
- Opening an app calls `dispatch({ type: 'OPEN', app, title })` + fires the corresponding sim action (`open_outlook`, `open_browser`, etc.)

### 3.6 Taskbar

```
┌─────────────────────────────────────────────────────────┐
│  ⊞  │  📧 Outlook  │  🌐 Edge (inactive)  │  🕐 10:42  │
└─────────────────────────────────────────────────────────┘
```

- Dark background (`#1a1a1a`), 40px height
- Start button (⊞) — returns focus to desktop (closes or minimizes all)
- App buttons — one per open window, active app highlighted
- Clicking an app button calls `dispatch({ type: 'FOCUS', app })`
- Clock on right side
- System tray with fake icons (network, volume — decorative only)

---

## 4. Per-App Interactive Specification

Each app is a self-contained React component with its own local state. It receives:
- `actions: SafeAction[]` — available sim actions for this tool (from backend/state machine)
- `state: Record<string, unknown>` — visible sim state (workOffline, outboxCount, etc.)
- `onAction: (id: string, tool: string) => void` — fires scoring-relevant backend actions
- `onRecordInteraction: (event) => void` — logs UI-only interactions to `session_events`

### 4.1 OutlookApp (previously OutlookPanel)

**Local state:**
```ts
interface OutlookLocalState {
  selectedFolder: 'inbox' | 'drafts' | 'sent' | 'outbox' | 'deleted' | 'calendar' | 'contacts';
  selectedEmailIndex: number | null;
  activeRibbonTab: 'home' | 'send_receive' | 'folder' | 'view';
  contextMenu: { x: number; y: number; items: MenuItem[] } | null;
  readingPaneOpen: boolean;
}
```

**Ribbon tabs** (local state — click to switch, no backend):

| Tab | Visible Ribbon Buttons |
|---|---|
| Home | New Email, Reply, Reply All, Forward, Delete, Mark as Read/Unread |
| Send/Receive | **Send/Receive All Folders** (backend), **Work Offline toggle** (backend), Update Folder, Download Headers |
| Folder | New Folder, Rename Folder, Copy Folder |
| View | Change View, Reading Pane (Right/Bottom/Off), Message Preview |

Ribbon buttons that are not scoring-relevant are visual only (greyed out or informational). Scoring-relevant buttons call `onAction()`.

**Folder pane** (local state):
- Inbox: shows 12 mock emails (subjects, senders, dates)
- Drafts: 1 mock draft
- Sent Items: shows 1 sent email if `sentTestEmail === true`, else 0
- Outbox: shows `outboxCount` emails from sim state, each clickable
- Deleted Items: 8 mock deleted emails
- Clicking a folder sets `selectedFolder` and renders appropriate email list
- Each folder shows unread/unsent count badges

**Email list** (local state):
- Grid with columns: icon, Subject, From, Received, Status
- Click selects email (`selectedEmailIndex`)
- Right-click opens context menu: "Mark as Read", "Mark as Unread", "Delete", "Print", "Forward"
- Double-click opens reading pane (local state: `readingPaneOpen: true`)

**Reading pane** (local state):
- Shows selected email: sender, recipients, subject, body
- Body is mock text relevant to the scenario ("Invoice batch for approval")
- Close button or click-away dismisses

**Status bar** (from sim state):
- Always visible at bottom
- Shows connection status (Working Offline / Connected)
- Shows outbox item count
- Shows test email sent confirmation ✓
- Clicking status bar area triggers `onAction('check_outlook_status', 'outlook')`

**Interaction recording:**
| User action | Event logged |
|---|---|
| Switch folder | `POST /event` — `{ event_type: 'tool_opened', tool_id: 'outlook', label: 'Switched to Inbox folder' }` |
| Select email | `POST /event` — `{ event_type: 'action_performed', tool_id: 'outlook', label: 'Selected email: Invoice batch for approval' }` |
| Switch ribbon tab | `POST /event` — `{ event_type: 'tool_opened', tool_id: 'outlook', label: 'Switched to Send/Receive tab' }` |
| Right-click action | `POST /event` — `{ event_type: 'action_performed', tool_id: 'outlook', label: 'Right-click: Mark as Read' }` |
| Scoring action | `POST /sim/action` — full state machine processing |

### 4.2 BrowserApp (previously BrowserPanel)

**Local state:**
```ts
interface BrowserLocalState {
  tabs: { id: string; title: string; url: string }[];
  activeTabId: string;
  currentUrl: string;
  addressBarValue: string;
}
```

**Address bar** (local state):
- Shows current URL
- Back/Forward/Refresh buttons (visual only)
- Typing navigates to mock pages

**Tab bar**:
- Default tabs: "New Tab", "Outlook Web App"
- Click to switch active tab
- "Check Outlook Web App" opens OWA tab + fires `onAction('check_webmail', 'browser')`

**Page rendering** (local state):
- OWA page: shows simulated OWA inbox with "Compose" button, mock sent item
- New Tab: shows search engine or blank page
- Default homepage: Bing or company intranet mock

**Interaction recording:**
| User action | Event logged |
|---|---|
| Switch tab | `POST /event` — `{ event_type: 'tool_opened', tool_id: 'browser', label: 'Switched to OWA tab' }` |
| Navigate URL | `POST /event` — `{ event_type: 'action_performed', tool_id: 'browser', label: 'Navigated to: ...' }` |

### 4.3 CmdApp (previously CommandPromptPanel)

**Local state:**
```ts
interface CmdLocalState {
  commandHistory: { input: string; output: string }[];
  currentInput: string;
  cwd: string;  // e.g. 'C:\Users\Sarah'
}
```

**Known commands** (local state processing):

| Command | Local output (no backend) | Backend action |
|---|---|---|
| `help` | Lists available commands | None |
| `cls` / `clear` | Clears screen | None |
| `whoami` | Shows `alder\sarah` | None |
| `dir` | Shows mock directory listing | None |
| `ping outlook.office365.com` | Mock ping output: 4 replies, 0% loss | `onAction('run_ping', 'cmd')` |
| `ipconfig` / `ipconfig /all` | Mock network config | `onAction('run_ipconfig', 'cmd')` |
| `nslookup outlook.office365.com` | Mock DNS resolution | None |
| `tracert outlook.office365.com` | Mock trace route | None |
| Unknown command | `'command' is not recognized...` | None |

**Command input**:
- Typeable `<input>` at bottom of the terminal
- Enter submits command, adds to history
- Up/down arrow navigates command history (local state array)
- Output area scrolls automatically to bottom

**Visual**:
- Black background (`#0f172a`), green/white text (monospace)
- Classic CMD appearance
- Command prompt: `C:\Users\Sarah>`

**Interaction recording:**
| User action | Event logged |
|---|---|
| Run any command (backend or not) | `POST /event` — `{ event_type: 'action_performed', tool_id: 'cmd', label: 'Ran command: ping outlook.office365.com' }` |
| Backend-relevant command | Additionally `POST /sim/action` |

### 4.4 ControlPanelApp (previously inline in RemoteDesktopPane)

**Extracted to own file:** `components/mvp/simulator/ControlPanelApp.tsx`

**Local state:**
```ts
interface ControlPanelLocalState {
  selectedCategory: 'home' | 'programs' | 'mail' | 'network' | 'system';
}
```

**Left sidebar** (local state):
- Control Panel Home
- Programs
- Mail (Microsoft Outlook)
- Network and Internet
- System

Clicking a category switches the right pane content.

**Right pane — per category:**

*Home view*: Category icons in a grid.

*Programs view*:
- "Uninstall or change a program" section header
- "Repair Microsoft 365 Apps" — informational button (greyed until candidate clicks) → backend API
- "Reinstall Outlook" — red flag action → `onAction('reinstall_outlook', 'control_panel')`
- Clear warning: "This is a disruptive fix. Try basic checks first."

*Mail view*:
- "Mail (Microsoft Outlook)" profiles
- "Delete and recreate Outlook profile" — red flag action → `onAction('delete_mail_profile', 'control_panel')`
- Clear warning: "This deletes all cached data. Use only after basic checks."

*Network & Internet view*: Informational — shows network adapters, Wi-Fi status.

*System view*: Device info, Windows version — informational.

**Interaction recording:**
| User action | Event logged |
|---|---|
| Switch category | `POST /event` — `{ event_type: 'tool_opened', ... }` |
| Click action button | `POST /sim/action` (if backend action) or `POST /event` (if UI only) |

---

## 5. Event Recording & Transcript Integration

### 5.1 Two categories of events

```
UI-only interactions ──► POST /api/mvp/assessment/[token]/event
    (folder clicks, tab switches, right-click menus, typed commands)
    event_type: 'action_performed' | 'tool_opened' | 'ticket_note_updated'

Scoring-relevant actions ──► POST /api/mvp/assessment/[token]/sim/action
    (Work Offline toggle, send test email, reinstall, etc.)
    State machine processes → sim_events + session_events
```

### 5.2 New event type proposal

The current event route (`app/api/mvp/assessment/[token]/event/route.ts`) allows 3 event types. For fine-grained UI interaction logging, add a fourth:

```ts
const ALLOWED_EVENT_TYPES = new Set<SessionEventType>([
  'tool_opened',
  'action_performed',
  'ticket_note_updated',
  'ui_interaction',       // NEW — folder click, right-click, tab switch, typed command
]);
```

`ui_interaction` events are non-scoring but populate the evidence timeline with rich detail about exactly how the candidate navigated the interface. Example:

```json
{
  "event_type": "ui_interaction",
  "tool_id": "outlook",
  "action_id": "folder_switch",
  "label": "Switched to Outbox folder",
  "started_at_ms": 1719420000000
}
```

### 5.3 Interaction logging from RemoteDesktopPane

Every window open/close/focus goes through the desktop reducer AND gets logged:

```ts
function openApp(app: string) {
  // Log to session_events
  fetch(`/api/mvp/assessment/${token}/event`, {
    method: 'POST',
    body: JSON.stringify({
      event_type: 'tool_opened',
      tool_id: app,
      label: `Opened ${app}`,
      started_at_ms: Date.now(),
    }),
  });

  // Fire the sim action if applicable (for state machine)
  if (app === 'outlook') onSimAction('open_outlook', 'outlook');
  if (app === 'browser') onSimAction('open_browser', 'browser');

  // Update local desktop state
  dispatch({ type: 'OPEN', app, title: appTitle });
}
```

### 5.4 Transcript visibility for the candidate

The collapsed `TranscriptToggle` in the left panel should show:
- Customer messages
- Candidate messages
- **System observations** (NEW — from session_events with actor='system')
- Action results (from `result_text` in action events)

Currently the TranscriptToggle only shows `messages` array (role: 'candidate' | 'caller'). It should also pull from `session_events` to show action observations. This makes the transcript a true "what happened" log.

Implementation: extend `TranscriptToggle` to accept an `events` prop or merge events into the message list in `ServiceDeskSimulatorShell`.

---

## 6. Backend Integration

### 6.1 Existing routes — no changes needed

| Route | Method | Purpose | Status |
|---|---|---|---|
| `/api/mvp/assessment/[token]/sim` | GET | Load safe state, actions, timeline | OK |
| `/api/mvp/assessment/[token]/sim/action` | POST | Apply sim action, update state | OK |
| `/api/mvp/assessment/[token]/event` | POST | Record candidate UI event | Add `ui_interaction` type |
| `/api/mvp/assessment/[token]/message` | POST | Voice transcript + AI customer response | OK |
| `/api/mvp/assessment/[token]/voice/transcribe` | POST | STT | OK |
| `/api/mvp/assessment/[token]/voice/tts` | POST | TTS | OK |
| `/api/mvp/assessment/[token]/ticket` | POST | Submit final ticket | OK |

### 6.2 State flow

```
Candidate clicks "Disable Work Offline" in Outlook
    ↓
onAction('disable_work_offline', 'outlook')
    ↓
POST /sim/action { action_id: 'disable_work_offline', tool_id: 'outlook', started_at_ms }
    ↓
route.ts: loads pack, finds action, gets sim_sessions.current_state_json
    ↓
applyAction(state, action) → { result, updatedState }
    ↓
UPDATE sim_sessions set current_state_json = updatedState
    ↓
INSERT into sim_events (action_performed + observation_returned)
    ↓
mirrored to session_events (canonical)
    ↓
Response: { safe_actions, visible_state, phase, timeline }
    ↓
Shell: setSimData(response.data)
    ↓
OutlookApp re-renders with new state (workOffline: false, status: 'Connected')
```

### 6.3 Optimistic UI

For immediate feedback on scoring actions:
- When `onAction()` fires, immediately update local UI state to reflect the expected outcome
- Backend response confirms and corrects if needed
- If the action fails (precondition), revert to previous state and show error toast

Example: clicking "Disable Work Offline" immediately shows "Connected" status in Outlook's status bar. The backend response arrives ~200ms later and confirms.

---

## 7. Performance Strategy

### 7.1 Zero-cost interactions

| What | Cost | Why |
|---|---|---|
| Folder click in Outlook | ~1ms | `setState({ selectedFolder: 'inbox' })` — single React re-render of the email list area |
| Right-click context menu | ~1ms | `setState({ contextMenu: { x, y, items } })` — renders a positioned `<div>` |
| Typing in CMD | ~1ms per keystroke | `setState({ currentInput })` — re-renders only the input line |
| Switching ribbon tabs | ~1ms | `setState({ activeRibbonTab })` — re-renders the ribbon toolbar |
| Opening a window | ~2ms | `dispatch({ OPEN })` — one window frame + app component renders |
| Focusing a window | ~1ms | `dispatch({ FOCUS })` — z-index bump, re-render window frame |

### 7.2 Expensive interactions (backend round trips)

| What | Cost | Mitigation |
|---|---|---|
| Scoring action (Disable WFO) | ~200ms network | Optimistic UI update, toast feedback |
| Loading sim state (poll) | ~200ms network | 10s polling interval, non-blocking |
| Voice STT/TTS | ~1000-3000ms | Status bar shows "Thinking..." / "Speaking..." |

### 7.3 Memoization

- `WindowFrame` wrapped in `React.memo` — skips re-render if zIndex/position/size unchanged
- `DesktopIcon` components static — no re-renders after initial mount
- `Taskbar` memoized — only re-renders when `openWindows` array changes
- App components avoid expensive computations (no sorting, no filtering large datasets)

### 7.4 Conditional rendering

```
Only the active window renders its full app content.
Background windows show a placeholder or are `display: none` until focused.
```

Actually, since we want to show content for all visible windows (cascading view):
- All open windows render their content
- Windows are CSS `position: absolute` with preset coordinates
- Only one window per app type (no duplicate app windows)
- max 4 windows open = max 4 app components rendered

---

## 8. Implementation Phases

### Phase 1: Desktop Skeleton (2-3 hours)
Files: `RemoteDesktopPane.tsx` (rewrite)
- `useReducer` for desktop state (openWindows, activeApp, zIndex)
- `WindowFrame` shared component
- `DesktopSurface` with icons
- `Taskbar` with app buttons + clock
- Replace current tab system entirely

### Phase 2: OutlookApp Rewrite (3-4 hours)
Files: `OutlookPanel.tsx` → `OutlookApp.tsx` (new, ~400 lines)
- Local state: selectedFolder, selectedEmail, activeRibbonTab, readingPaneOpen
- Clickable folder sidebar with mock email content per folder
- Switchable ribbon tabs with different button sets
- Right-click context menu on emails
- Reading pane
- Status bar (from sim state)
- All interactions logged

### Phase 3: CmdApp Rewrite (2-3 hours)
Files: `CommandPromptPanel.tsx` → `CmdApp.tsx` (new, ~250 lines)
- Local state: commandHistory, currentInput, cwd
- Known command router (help, cls, whoami, dir, ping, ipconfig, nslookup, tracert)
- Mock outputs for each command
- Typeable input with history (arrow up/down)
- Black terminal styling, monospace font

### Phase 4: BrowserApp Rewrite (2-3 hours)
Files: `BrowserPanel.tsx` → `BrowserApp.tsx` (new, ~200 lines)
- Local state: tabs, activeTabId, currentUrl
- Tab bar with close buttons
- Address bar (editable, shows URL)
- Simulated OWA page content
- Simulated search engine new tab
- Back/Forward buttons (visual only)

### Phase 5: ControlPanelApp Extraction (1 hour)
Files: New `ControlPanelApp.tsx` (~150 lines), remove inline from RemoteDesktopPane
- Sidebar category navigation (local state)
- Per-category content panes
- Red-flag actions with clear warnings

### Phase 6: Event Logging + Transcript (1-2 hours)
Files: `ServiceDeskSimulatorShell.tsx`, `TranscriptToggle`, `event/route.ts`
- Add `ui_interaction` event type to route
- Wire `onRecordInteraction` through all app components
- Extend TranscriptToggle to show system events from session_events
- All window open/close/focus events logged

### Phase 7: Testing & Polish (1-2 hours)
- Run all test suites: `test:dashboard-sim`, `test:dashboard-sim-foundation`, `test:assignment-types`, `test-session-events`, `test-voice`
- Verify build: `npx tsc --noEmit`, `npm run build`
- Manual smoke test: open Outlook → check status → disable WFO → send test → verify timeline
- Test red flag recording: open Control Panel → reinstall Outlook → verify red flag in timeline
- Test CMD command typing and history

**Total estimate: 12-18 hours**

---

## 9. Other Bugs & Fixes Identified

### 9.1 Critical

| # | Bug | Location | Fix |
|---|---|---|---|
| 1 | **Internal notes lost on reload** | `ServiceDeskSimulatorShell.tsx` | On mount, load prior internal notes from `session_events` where `event_type = 'ticket_note_updated'` and `action_id = 'add_internal_note'`. The candidate GET route already returns session events — add a `loadPriorNotes` effect. |
| 2 | **Browser/CMD are action-button lists** | `BrowserPanel.tsx`, `CommandPromptPanel.tsx` | Replaced in Phase 3-4 above. |
| 3 | **No CMD input** | `CommandPromptPanel.tsx` | Currently only shows action buttons. Phase 3 adds typeable terminal. |
| 4 | **Outlook folder list non-interactive** | `OutlookPanel.tsx` | Folders are `<button>` elements but only Outbox has onClick. Phase 2 makes all folders interactive. |

### 9.2 Medium

| # | Bug | Location | Fix |
|---|---|---|---|
| 5 | **Event route allows only 3 types** | `event/route.ts` | Add `'ui_interaction'` to `ALLOWED_EVENT_TYPES`. |
| 6 | **Transcript shows only messages, not system events** | `TranscriptToggle` in shell | Extend to show `session_events` entries (action observations, phase transitions) alongside messages. Merge both sources sorted by timestamp. |
| 7 | **No sim data loading indicator** | `RemoteDesktopPane`, `Shell` | When `simData` is null and `capabilities.remoteDesktop` is true, show a "Connecting to remote desktop..." loading state instead of blank tab bar. |
| 8 | **Session must be 'in_progress' for event route** | `event/route.ts` | Check should be relaxed — events may fire before session state transitions. Allow `not_started` and `in_progress`. |

### 9.3 Minor

| # | Bug | Location | Fix |
|---|---|---|---|
| 9 | **Poling interval runs even when hidden** | `Shell` `useEffect` | Already guarded by `document.hidden` — good. No change. |
| 10 | **Ticket submitted page uses dark theme** | `Shell` line 228 | Already `background: '#111'` — matches global style. No change. |
| 11 | **Candidate loading page had blue bg** | `app/mvp/assessment/[token]/page.tsx` | Already fixed to `#111` in prior session. No change. |
| 12 | **Voice auto-play blocked warning** | `Shell` top bar | The "Play audio" button appears but is small. Consider making it more prominent when call is incoming and audio hasn't started. |

---

## 10. Files Changed (Full Inventory)

### New files
```
components/mvp/simulator/OutlookApp.tsx          (~400 lines)
components/mvp/simulator/BrowserApp.tsx          (~200 lines)
components/mvp/simulator/CmdApp.tsx              (~250 lines)
components/mvp/simulator/ControlPanelApp.tsx     (~150 lines)
components/mvp/simulator/WindowFrame.tsx          (~80 lines)
components/mvp/simulator/DesktopSurface.tsx       (~60 lines)
components/mvp/simulator/Taskbar.tsx              (~80 lines)
components/mvp/simulator/ContextMenu.tsx          (~70 lines)
components/mvp/simulator/useContextMenu.ts        (~50 lines)
remotedesktop.md                                   (this file)
```

### Modified files
```
components/mvp/simulator/RemoteDesktopPane.tsx    (full rewrite — desktop + window management)
components/mvp/simulator/ServiceDeskSimulatorShell.tsx  (wire transcript with session events, load prior notes, pass onRecordInteraction)
app/api/mvp/assessment/[token]/event/route.ts     (add 'ui_interaction' type, relax session check)
```

### Removed files (replaced)
```
components/mvp/simulator/OutlookPanel.tsx         → OutlookApp.tsx
components/mvp/simulator/BrowserPanel.tsx         → BrowserApp.tsx
components/mvp/simulator/CommandPromptPanel.tsx   → CmdApp.tsx
```

---

## 11. Testing Strategy

### 11.1 Per-phase unit tests

After each phase, run existing test suites to verify no regressions:

```bash
npm run test:assignment-types          # 21 tests
npm run test:dashboard-sim             # 28 tests
npm run test:dashboard-sim-foundation  # 24 tests
node scripts/test-session-events.mjs   # 16 tests
node scripts/test-voice.mjs            # 20 tests
npx tsc --noEmit                       # TypeScript compilation
```

### 11.2 Manual smoke test script

After full implementation:

1. Create a Training Drill assignment on manager dashboard
2. Open candidate link → service board loads
3. Click ticket row → ticket detail opens with NotesPanel
4. Answer call → CallBar shows "Connected to Sarah"
5. Click "Open Remote Desktop" → desktop appears on right
6. Desktop icons visible, taskbar visible
7. Double-click Outlook icon → Outlook window opens
8. Click "Home" ribbon → ribbon buttons change
9. Click "Send/Receive" ribbon tab → ribbon buttons change
10. Observe Work Offline toggle (active, highlighted)
11. Click "Outbox" folder → email list shows 3 unsent emails
12. Click an email → highlights, reading pane opens
13. Right-click email → context menu appears
14. Click "Inspect Connection Status" → observation appears in transcript
15. Click "Turn off Work Offline" → toggle deactivates, status shows "Connected"
16. Click "Send/Receive All" → Outbox clears, status shows "0 items"
17. Click "Send Test Email" → test email sent, confirmation shown
18. Verify all actions appear in collapsed transcript
19. Click "Control Panel" in taskbar → Control Panel opens
20. Navigate categories via sidebar
21. Post internal notes → verify in NotesPanel history
22. Switch to Live Notes tab → type ticket draft
23. End call → ticketing phase
24. Write closure → submit → verify completion page
25. Go back to manager dashboard → run analysis → verify timeline shows all events

### 11.3 Performance benchmarks

- Desktop idle: < 5% CPU
- Open 4 apps simultaneously: < 10% CPU
- Typing in CMD: < 15% CPU
- Memory: < 50MB additional beyond shell baseline
- First paint of remote desktop: < 100ms

---

## 12. Non-Goals (Explicit Exclusions)

- ❌ No drag/resize/minimize window operations
- ❌ No snapping or window snapping layouts
- ❌ No animations (CSS transitions everywhere disabled)
- ❌ No real terminal emulator (CMD is a simulation)
- ❌ No real browser (Browser shows mock pages)
- ❌ No file system browsing (no Explorer, no file dialogs)
- ❌ No multi-monitor support
- ❌ No notification center or system tray interactions
- ❌ No login/lock screen
- ❌ No Start menu (just desktop icons + taskbar)
- ❌ No Settings app (Control Panel only)
- ❌ No admin escalation/UAC simulation
