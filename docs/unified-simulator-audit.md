# Unified Simulator Architecture Audit

> Audit date: 2026-06-26
> Purpose: Identify why the codebase has drifted into separate products instead of one unified simulator foundation.
> This is an audit only — no recommendations are implemented.

---

## 1. Current State Summary

The codebase currently has **three render paths** pretending to be one product:

| Path | Entry Point | What Renders | Used For |
|------|-------------|-------------|----------|
| Chat assessment | `app/mvp/assessment/[token]/page.tsx` (hiring_exam branch) | Simple chat bubbles + text input + ticket form | Hiring Exam |
| Sim shell v1 | `components/mvp/sim/CandidateSimShell.tsx` | Full Win11 desktop overlay with WindowProvider, auto-opened tool windows | Legacy — orphaned |
| Sim shell v2 | `components/mvp/sim/ItsmCandidateShell.tsx` | Hybrid: ticket panel + Win11 desktop when remoted | Training Drill |

Backend also has two modes: `chat_call` and `dashboard_sim`, which the frontend uses to branch.

---

## 2. Mismatch With Intended Vision

The intended vision (from `docs/vision.md`) is:

> One platform with three assignment types. Not three separate tools.

But the current code implements:

> Two separate UIs that happen to share a database.

The hiring exam path is a **chat application**. The training drill path is a **Windows desktop simulator**. These are fundamentally different interaction models when they should be capability variations of a single service-desk shell.

---

## 3. File-by-File Findings

### 3.1. `app/mvp/assessment/[token]/page.tsx`

**What it does:**
- Loads assessment data via API
- If `assignmentType === 'training_drill'` → renders `ItsmCandidateShell` via `React.lazy`
- Otherwise → renders a standalone chat-based candidate assessment UI

**Why this is wrong:**
- The early-return branch means the chat page and sim shell are completely separate renders with separate component trees, separate state, separate voice hooks
- Both paths call `useCustomerAudio` and `speak`, causing potential double-play issues
- The hiring exam path has no ticket panel, no service-desk shell, no call bar — it's just a chat app

**Also contains:**
- An auto-play `useEffect` that fires for ALL assignment types (line 86-97), causing TTS to play before the call is answered in training drill mode. The guard was added later but the architectural split remains.

### 3.2. `components/mvp/sim/CandidateSimShell.tsx`

**What it does:**
- A full Win11 desktop simulation with all tool windows auto-opened on mount
- Uses `WindowProvider` with Desktop, Taskbar, WindowFrame, etc.
- 3-second polling interval

**Why this is wrong:**
- Represents the "Training Drill = Windows Simulator" mental model
- CustomerChatWindow is the primary interaction — a floating chat bubble window on a fake desktop
- No ticket-first layout; ticket is a peripheral window
- Desktop/Taskbar/WindowManager are hundreds of lines of complexity for what should be a tool panel
- This file appears to be orphaned/unused (replaced by ItsmCandidateShell) but still exists

### 3.3. `components/mvp/sim/ItsmCandidateShell.tsx`

**What it does:**
- The currently active sim shell for training drill
- Uses `WindowProvider` + Desktop + Taskbar + all tool windows
- Recent refactor added a ticket-first layout for the pre-call state
- When remoted, shows Win11 desktop as full-screen overlay

**Why this is wrong:**
- The remote desktop overlay (`position: absolute; inset: 0`) completely hides the ticket panel — user cannot see ticket while using remote tools
- Still uses the full Win11 desktop/window manager infrastructure
- Two `useCustomerAudio` instances possible (one from parent page, one here)
- Actions panel is only available in chat mode, not when remoted
- Text input box + send button + message bubbles still present even though voice is the preferred interaction

### 3.4. `lib/mvp/assignment-types.ts`

**What it does:**
- Maps assignment types to internal modes: `hiring_exam → chat_call`, `training_drill → dashboard_sim`

**Why this is wrong:**
- The mapping from assignment_type → assessment_mode implies the modes are fundamentally different (chat vs sim)
- There is no concept of "capabilities" — what features of the unified shell should be enabled for each type
- A training_shift assignment has no mode at all (`null`), reinforcing that it's a "coming soon separate product"

**What should exist instead:**
```ts
// Aspirational — not yet implemented
type SimulatorCapabilities = {
  call: boolean;
  voice: boolean;
  textFallback: boolean;
  ticketPanel: boolean;
  remoteDesktop: boolean;
  tools: string[];
  ticketComposer: boolean;
}
// Each assignment type maps to a capabilities config, not a render path
```

### 3.5. `app/api/mvp/assessments/route.ts`

**What it does:**
- Creates assessments with an `assessment_mode` field
- `chat_call` → creates assessment without sim session
- `dashboard_sim` → creates assessment with sim session + pack

**Why this is wrong:**
- The mode choice happens at creation time, making it impossible for the same shell to handle both
- No concept of "always create the simulator session; the mode just controls which capabilities are exposed"
- The hiring exam path creates a `chat_call` assessment that has no sim session at all

### 3.6. `app/api/mvp/assessment/[token]/route.ts`

**What it does:**
- Returns `assessment_mode` which the frontend uses to branch
- For `dashboard_sim`, returns sim state (tools, actions, timeline)

**Why this is wrong:**
- Returns `assessment_mode` instead of `capabilities` — forces the frontend to decode what this mode means
- The sim data (tools, actions) is only returned for `dashboard_sim` assessments, meaning hiring exam assessments have no way to show available actions even if the UI wanted to
- No `assignment_runtime.capabilities` object in the response

### 3.7. `components/win11/*` (Desktop, Taskbar, WindowFrame, SCSS files)

**What they do:**
- Desktop.tsx: Shows 5 desktop app icons (Outlook, Edge, CMD, Chat, Ticket) with double-click to open + right-click context menu with "Open all tools"
- Taskbar.tsx: Full Windows 11 taskbar with start button, pinned apps, clock
- WindowFrame.tsx: Draggable, resizable window with minimize/maximize/close, 8 resize handles, z-index stacking
- All linked via `WindowProvider` context

**Why this is wrong:**
- ~400 lines of window management infrastructure (context, reducer, drag, resize, z-order, minimize/maximize) for what should be tabbed or docked tool panels
- `backdrop-filter: blur(16px)` on taskbar (already removed but the architecture remains)
- The desktop is the primary metaphor, but the ticket should be the primary metaphor
- No user would use a full Windows desktop sim to train for service desk work — they would use a service desk dashboard with embedded remote tools

**Estimated complexity removed if deprecated:**
- `Desktop.tsx` (77 lines)
- `Desktop.scss`
- `Taskbar.tsx`
- `Taskbar.scss`
- `WindowFrame.tsx` (150+ lines)
- `WindowFrame.scss`
- `SystemTray.tsx`
- `lib/win11/windowState.tsx` (194 lines)
- `lib/win11/types.ts` (37 lines)
- All tool `*Window.tsx` components repurposed

### 3.8. `components/win11/tools/CustomerChatWindow.tsx`

**What it does:**
- A floating chat window with message bubbles, text input, send button, voice button

**Why this is wrong:**
- Chat bubbles + text input are the primary interaction model — this is the core problem
- The vision says "call bar, not chat window"
- Voice is working, so the text chat UI is redundant for candidate interaction
- A transcript can exist backend-side without rendering as a chat UI

### 3.9. `lib/mvp/sim/*` (stateMachine, packConfig, packRegistry, eventLog, safeProjection, aiCustomer, scoring)

**What they do:**
- State machine for action application with phase transitions
- Pack definition for Outlook Work Offline
- Pack registry for looking up packs by ID
- Event logging to both `sim_events` and `session_events`
- Safe projection to prevent hidden fact leaks
- AI customer context builder
- Deterministic sim scoring

**Why these are salvageable:**
- These are well-separated from the UI — they don't know about Desktop, WindowManager, etc.
- The state machine, event log, safe projection, and scoring are all reusable in a unified shell
- The Outlook-specific pack can remain as one of many potential packs

### 3.10. `components/mvp/voice/*` (VoiceRecorderButton, CustomerAudioPlayer)

**What they do:**
- VoiceRecorderButton: Records mic audio, sends to STT API, returns transcript
- CustomerAudioPlayer (useCustomerAudio): Fetches TTS audio, plays it, handles autoplay blocking

**Why these are good:**
- Well-designed, reusable hooks/components
- Voice layer is clean I/O — no scoring from raw audio
- Both are already used in multiple places (hiring page, sim shell)
- These should be the primary input mechanism in the unified shell

---

## 4. Why Assignment Types Became Separate Products

The root cause is a chain of architectural decisions:

1. **`assessment_mode` as the product switch** — Instead of having `assignment_type` control capabilities on a single shell, `assessment_mode` (`chat_call` vs `dashboard_sim`) was used as the if/else branch in the frontend.

2. **No capability model** — There is no `SimulatorCapabilities` type or configuration. The frontend has to infer from `assessment_mode` what to render.

3. **Win11 desktop was the first sim implementation** — The training drill was built as a full Windows desktop before the hiring exam. When the hiring exam was added later, it was simpler to build a separate chat page than to extract the shared foundation.

4. **`@/components/mvp/sim/` became a "desktop sim" folder, not a "simulator foundation" folder** — The naming encouraged the idea that "sim = Win11 desktop."

5. **No one stopped to ask "what does hiring exam look like in the service desk shell?"** — If they had, they would have realized: hiring exam IS the service desk shell, just with remote tools and extra capabilities locked.

---

## 5. Proposed Unified Mental Model

```
┌─────────────────────────────────────────────────────────────┐
│  ServiceDeskSimulatorShell (always renders)                 │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  TopBar: logo / assignment label / status / profile  │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  CallBar: call status / "Customer thinking..." / mic │   │
│  ├─────────────────────┬────────────────────────────────┤   │
│  │  TicketSidePanel    │  WorkArea                      │   │
│  │  (always visible)   │  (changes by phase/caps)      │   │
│  │                     │                                │   │
│  │  INC-002847         │  Pre-call: call guidance      │   │
│  │  🔴 High            │  + "Start Call" button        │   │
│  │  Sarah Thompson     │                                │   │
│  │  Connexion Dental   │  On call: active call view    │   │
│  │  Accounts           │  (no chat bubbles, just       │   │
│  │                     │   status + voice interaction)  │   │
│  │  "Outlook cannot    │                                │   │
│  │   send emails..."   │  Remoted: RemoteDesktopPane   │   │
│  │                     │  (embedded, not fullscreen)    │   │
│  │  [Notes area]       │  + tool tabs (Outlook, CMD,   │   │
│  │  [Submit ticket]    │    Browser) in work area       │   │
│  │                     │                                │   │
│  └─────────────────────┴────────────────────────────────┘   │
│                                                             │
│  Assignment type controls:                                   │
│  Hiring Exam  → call=true, remoteDesktop=false, tools=[]    │
│  Training Drill → call=true, remoteDesktop=true,            │
│                   tools=["outlook","browser","cmd"]         │
│  Training Shift → [later] queue=true, multi-case=true       │
└─────────────────────────────────────────────────────────────┘
```

### Key Principle

The candidate never leaves the service desk shell. The ticket is always on the left. The call is a phone bar, not a chat window. Remote tools are embedded panels in the work area, not a full-screen desktop. Assignment type determines which panels/features are active.

---

## 6. Proposed Future Component Tree

```
components/mvp/simulator/
├── ServiceDeskSimulatorShell.tsx    ← Single entry point. Always renders.
│                                     Props: assignmentType, capabilities, token
│                                     Wraps: TopBar + CallBar + split layout
│
├── SimulatorTopBar.tsx              ← Logo, assignment label, status, profile
├── CallBar.tsx                      ← Call state machine:
│                                      idle → incoming → active → thinking → speaking → ended
│                                      Shows mic button, status text, end-call button
│                                      No chat bubbles. No text input (except fallback).
│
├── TicketSidePanel.tsx              ← Always-visible left panel.
│                                      Ticket ID, severity, requester, company, description
│                                      Notes/scratchpad area
│                                      Submit ticket button
│                                      Renders from API `ticket` data
│
├── WorkArea.tsx                     ← Right panel. Content changes by phase/caps.
│                                      Pre-call: guidance + "Start Call"
│                                      On call: call visualization (voice waveform?)
│                                      Remoted: RemoteDesktopPane or ToolLauncher
│                                      Post-call: ticket composer
│
├── RemoteDesktopPane.tsx            ← Embedded remote desktop sandbox.
│                                      NOT fullscreen. Does NOT hide ticket panel.
│                                      Shows tool tabs at top (Outlook | Browser | CMD)
│                                      Shows tool output in the pane below
│                                      NO WindowProvider, NO drag/resize/minimize
│                                      Actions log to session_events
│
├── ToolLauncher.tsx                 ← Tab bar for available tools.
│                                      Renders tabs based on `capabilities.tools`
│                                      Each tab switches the active tool view
│
├── TicketComposer.tsx               ← Post-call ticket writing view.
│                                      Textarea + submit button
│
├── TextFallbackInput.tsx            ← Minimal text input for voice-unavailable scenarios.
│                                      Single line, no history, no bubbles.
│                                      Only shown when voice is unavailable.
│
└── (reuse from components/mvp/voice/)
    ├── VoiceRecorderButton.tsx      ← Mic button → STT → onTranscript callback
    └── (useCustomerAudio hook)      ← TTS playback, autoplay handling
```

### Deleted/Deprecated

```
components/win11/
├── Desktop.tsx              → Remove. Replaced by RemoteDesktopPane.
├── Desktop.scss             → Remove.
├── Taskbar.tsx              → Remove. Replaced by SimulatorTopBar.
├── Taskbar.scss             → Remove.
├── SystemTray.tsx           → Remove.
├── WindowFrame.tsx          → Remove. No draggable windows.
├── WindowFrame.scss         → Remove.
└── tools/
    ├── CustomerChatWindow.tsx   → Remove. No chat window. Voice + CallBar instead.
    ├── OutlookWindow.tsx        → Rewrite as simple tool panel (no WindowFrame).
    ├── BrowserWindow.tsx        → Rewrite as simple tool panel.
    ├── CommandPromptWindow.tsx  → Rewrite as simple tool panel.
    └── TicketWindow.tsx         → Rewrite or merge into TicketComposer.

lib/win11/
├── windowState.tsx          → Remove. No window manager needed.
└── types.ts                 → Remove.

components/mvp/sim/
├── CandidateSimShell.tsx    → Remove. Orphaned.
├── ItsmCandidateShell.tsx   → Remove. Replaced by ServiceDeskSimulatorShell.
├── SimTimeline.tsx          → Keep or fold into WorkArea.
├── ToolDock.tsx             → Merge concept into ToolLauncher.
└── tools/                   → Depends on content.

app/mvp/assessment/[token]/page.tsx  → Rewrite: always render ServiceDeskSimulatorShell.
                                        No more if/else branching by assignment_type.
```

---

## 7. Proposed Future API Shape

### `GET /api/mvp/assessment/[token]`

```json
{
  "ok": true,
  "data": {
    "assessment": {
      "id": "assess-abc123",
      "title": "Call Readiness: Alex Candidate",
      "status": "invited",
      "assignment_type": "hiring_exam",
      "created_at": "2026-06-26T..."
    },
    "assignment_runtime": {
      "shell": "service_desk",
      "mode_label": "Hiring Exam",
      "capabilities": {
        "call": true,
        "voice": true,
        "text_fallback": true,
        "ticket_panel": true,
        "remote_desktop": false,
        "tools": [],
        "ticket_composer": true
      }
    },
    "ticket": {
      "id": "INC-002847",
      "title": "Outlook cannot send emails",
      "requester_name": "Sarah Thompson",
      "company": "Connexion Dental",
      "department": "Accounts",
      "severity": "high",
      "status": "open",
      "description": "Hi, I'm having trouble with my Outlook...",
      "impact": "Cannot send invoices for client meeting",
      "urgency": "High — deadline in 30 minutes"
    },
    "call": {
      "status": "not_started",
      "caller_name": "Sarah Thompson",
      "caller_company": "Connexion Dental"
    },
    "sim": {
      "available_actions": [],
      "visible_state": {},
      "timeline": []
    }
  }
}
```

**Key rules:**
- `capabilities` object tells the shell what features to enable — NO branching by `assessment_mode`
- `assignment_type` is a string label, not a mode switch
- No hidden facts, rubric, red flags, ideal ticket, scoring config
- `sim.available_actions` replaces the old `safe_actions` pattern — always present (even if empty array) so the shell can render consistently

### `POST /api/mvp/assessment/[token]/message`

```json
{
  "input_source": "voice",
  "text": "transcribed text",
  "duration_ms": 2340
}
```

Response:
```json
{
  "reply": "Customer reply text",
  "call_status": "customer_speaking"
}
```

No change needed here — the existing endpoint already works.

### `POST /api/mvp/assessment/[token]/sim/action`

No change needed — the existing endpoint already works. Returns `{ ok, data: { event, visible_state, safe_actions, phase, timeline } }`.

---

## 8. Migration Strategy

### Phase 1: Foundation (can be done in parallel)

1. Add `capabilities` as a concept in `lib/mvp/assignment-types.ts` — keep old `assessmentMode` for backward compat
2. Extend `GET /api/mvp/assessment/[token]` to return `assignment_runtime.capabilities` alongside existing fields
3. No UI changes yet — just add the data to the API response

### Phase 2: New Shell (can coexist with old paths)

4. Build `components/mvp/simulator/ServiceDeskSimulatorShell.tsx` — the unified shell
5. Build `CallBar.tsx` — voice-first, no chat bubbles
6. Build `TicketSidePanel.tsx` — always-visible ticket
7. Build `WorkArea.tsx` — phase-based content switching
8. Build `RemoteDesktopPane.tsx` — tabbed tools, no WindowManager
9. Rewrite tool views (Outlook, Browser, CMD) as simple panels without WindowFrame

### Phase 3: Switchover

10. Rewrite `app/mvp/assessment/[token]/page.tsx` to always render `ServiceDeskSimulatorShell`
11. Remove the `if (assignmentType === 'training_drill')` branch
12. Remove `components/mvp/sim/CandidateSimShell.tsx`
13. Remove `components/mvp/sim/ItsmCandidateShell.tsx`

### Phase 4: Cleanup

14. Remove `components/win11/` directory
15. Remove `lib/win11/` directory
16. Remove `WindowFrame.tsx` and associated SCSS
17. Remove `CustomerChatWindow.tsx`
18. Remove `SimTimeline.tsx` if folded into WorkArea

---

## 9. Do Not Build Yet

- **Training Shift engine** — queue system, multi-case, scheduling, random calls
- **ConnectWise integration** — fake ticket panel is sufficient for training
- **Manager dashboard analytics** — cross-candidate trends, heatmaps
- **Manager score template builder** — keep defaults
- **Full WebRTC phone dialer** — mic button + TTS is sufficient
- **Gamification** — levels, badges, leaderboards
- **The actual unified simulator shell** — wait for sign-off on this audit first
- **Removal of old components** — wait until replacement is verified working

---

## 10. Open Questions for the Human Owner

1. **Voice-first for all assignment types?** — The vision says yes. But should hiring exam have a text fallback for accessibility / dev environments where mic isn't available?

2. **What does the "active call" work area show?** — No chat bubbles. Just status text + mic button? Or a waveform visualization? Or an optional collapsed transcript toggle?

3. **RemoteDesktopPane granularity** — Should tools be tabbed (top tabs switching views) or tiled (side by side)? Should the user be able to see Outlook output and CMD output simultaneously?

4. **Custom packs** — You mentioned "managers can make their own packs." Should the pack system remain JSON-based (editable via /mvp/standards style UI) or use a new UI?

5. **CandidateSimShell.tsx** — This appears to be an orphaned predecessor to ItsmCandidateShell. Is it safe to delete?

6. **ToolDock.tsx** — A Win11-style tool dock exists alongside the Win11 desktop components. Should this concept be the basis for RemoteDesktopPane tool tabs?

7. **SimTimeline.tsx** — Currently shows timeline events. Should this be visible to the candidate during the assessment, or only in the manager report?

8. **Message history** — For the hiring exam, should the candidate be able to review the call transcript after the call ends? Or is the transcript manager-only?
