# Cohesion — CallCallum Unified Dashboard

> Saved from session 2026-06-26 — product direction reset.

## User's Message (verbatim)

> god this is so unintuiitve its unbelievable loll u are making this too difficult. ok we are building the same dashboard to use across all 3 things check vision.md again therefore we just need to combine what we have into one thing and build it out properly, then with the hiring sim we just have the phonecall, for training we have the ticket also but its still the same dashboard same for the shift. the beauty then is that a manager can send out any one of these as a hiring sim or training sim and make their own custom packs etc we just need to get the simulator right. right now its all over the place, like the remote terminal is buggy and takes over the whole screen it should appear as like a sandbox so user can always see their ticket on the left hand side of the screen. we can actually start to move away from text chat now because voice is working, so we dont need a chat interface at all maybe just a bar at the top of the screen giving status updates showing that the user is thinking while the tts loads.

## Core Requirements

1. **One dashboard, three assignment types.**
   Not separate UIs per mode. The same shell renders for hiring exam, training drill, and training shift. Assignment type determines what features light up (phonecall only, ticket + call + tools, queue).

2. **Voice-first, text-free.**
   Voice is working. No chat bubbles. No text input. The interaction is:
   - Customer speaks → TTS plays
   - User speaks → mic records → STT transcribes → sent as message
   - Status bar at top shows: "Customer is thinking..." / "Listening..." / "Connecting..."
   - That's it. Clean. No chat UI.

3. **Ticket is always visible on the left.**
   The left panel shows the ticket detail at all times — ticket number, requester, company, status, priority, issue description. This never disappears. The user references the ticket while on the call and while using remote tools.

4. **Remote tools are a sandbox, not full-screen takeover.**
   When the user remotes into the machine, the tools appear as a sandboxed area (e.g., right side or center overlay) that does NOT hide the ticket. The user can always see the ticket on the left while working in the remote sandbox.

## What Went Wrong

### 1. Separate UIs per assignment type
We built two completely different renders:
- Hiring exam: simple chat page with text bubbles
- Training drill: complex Win11 shell with window manager, desktop, taskbar

This is the opposite of "one dashboard." Every assignment type should use the same shell. The shell adapts which panels are active, not which component tree renders.

**Fix:** Single `CandidateShell` component. Hiring exam = shell with ticket panel + call controls. Training drill = shell with ticket panel + call controls + remote sandbox. Same layout, different features enabled.

### 2. Chat UI when voice works
We kept a full text-based chat interface (input box, send button, message bubbles, scrollable history) when voice is the primary interaction. This adds visual noise and complexity for no benefit.

**Fix:** No chat bubbles. No text input (for the customer conversation — ticket writing still needs text). The voice interaction is:
- Top status bar shows call state
- Mic button to speak
- Customer replies play via TTS automatically
- Optional text transcript collapsed behind a toggle for review

### 3. Remote desktop takes over the full screen
The Win11 desktop overlay covers the entire center panel, hiding the ticket and everything else. The user has to open windows on the desktop to see the ticket or chat, which is the opposite of how a real service desk works.

**Fix:** Remote tools render in a bounded sandbox area (e.g., right 60% of the screen). The ticket panel stays pinned on the left. The Win11 desktop is replaced with a simplified tool panel that shows the remote desktop as one of several available views, not a full-screen mode switch.

### 4. Window manager complexity
The useWindowManager context with z-index tracking, drag/resize, minimize/maximize was designed for a full desktop OS simulation. This is overkill for a training tool. It adds hundreds of lines of state management + renders + event handlers for a feature that distracts from the core assessment.

**Fix:** No window manager. The remote sandbox uses a simpler tab/panel system. Tools (Outlook, Browser, CMD) are tabs within the sandbox, not draggable windows. The user clicks a tool and it opens in the sandbox panel. No z-index, no drag, no resize.

### 5. Initial message auto-play bugs
The hiring exam page's auto-play useEffect fired even for training drill mode because React hooks run before the conditional return. The sim shell also had duplicate speak calls from the useCustomerAudio hook plus the phase-change effect.

**Fix:** Single shell. Single voice hook. No duplicate speak paths. Auto-play only after user-initiated action (answering call).

## What A Correct Build Looks Like

```
┌─────────────────────────────────────────────────────────┐
│  ◆ Connexion Service Desk        ● On Call  🎤 ● ● ●   │  ← Top bar: logo, status, mic indicator
│                                                         │
│  ┌──────────────┐  ┌──────────────────────────────────┐ │
│  │  TICKET       │  │  REMOTE SANDBOX / CALL VIEW     │ │
│  │  INC-002847   │  │                                  │ │
│  │  🔴 High      │  │  [Hiring Exam: phone call view] │ │
│  │               │  │  [Training Drill: remote tools] │ │
│  │  Sarah        │  │                                  │ │
│  │  Thompson     │  │  ┌─────┬──────┬──────┬────────┐ │ │
│  │  Connexion    │  │  │Outlk│Browse│ CMD  │Ticket │ │ │
│  │  Dental       │  │  └─────┴──────┴──────┴────────┘ │ │
│  │               │  │  ┌──────────────────────────────┐ │ │
│  │  Outlook can't│  │  │  Remote desktop view /       │ │ │
│  │  send emails  │  │  │  tool output area            │ │ │
│  │               │  │  │                              │ │ │
│  │  Status: Open │  │  └──────────────────────────────┘ │ │
│  └──────────────┘  └──────────────────────────────────┘ │
│                                                         │
│  Status: "Customer is thinking..."         [🔴 End Call]│  ← Bottom bar
└─────────────────────────────────────────────────────────┘
```

### Layout (fixed, same for all types)

- **Top bar:** Logo, connection status, mic indicator, autoplay-blocked warning
- **Left panel (300px):** Always-visible ticket detail. Shows: ticket number, priority badge, requester info, issue description, status. Never disappears, never covered.
- **Main area:** Adapts by assignment type:
  - Hiring exam: customer voice interaction area (minimal — just shows "On call with Sarah Thompson" and maybe TTS waveform)
  - Training drill: remote sandbox with tool tabs at top, output area below
  - Training shift: queue view (future)
- **Bottom status bar:** Shows call state ("Customer is thinking...", "Listening...", "On call"), End Call button

### Voice Interaction (no chat UI)

1. User opens assessment → sees ticket on left, "Start Call" button
2. Clicks Start Call → customer greeting plays via TTS
3. User speaks into mic → STT transcribes → stored as message → AI customer responds → TTS plays response
4. Status bar shows "Customer is thinking..." during TTS generation
5. No text bubbles, no send button, no chat history visible (history is logged for analysis but not shown as chat UI)
6. Transcript can be reviewed collapsed under a toggle if needed

### Remote Sandbox (training drill)

- Tab bar at top of main area: Outlook | Browser | CMD | Ticket
- Clicking a tab opens that tool in the sandbox area
- No window manager, no drag, no resize — just clean tab switching
- Ticket panel stays visible on the left the entire time
- Actions/tools available as buttons in a right sidebar or within the tool panels

### Scoring & Backend

- Same backend spine: evidence timeline, deterministic scoring, manager report
- No changes needed to analysis, scoring, or DB
- The unified shell is purely a frontend architectural change

## ConnectWise / PSA Dashboard Layout Research

Reference: ConnectWise Manage, HaloPSA, Autotask service desk dashboards.

### Common Layout Pattern

```
┌──────────────────────────────────────────────────────────────────┐
│  Top bar: Logo / Search / Quick actions / Profile               │
├──────────────────────────────────────────────────────────────────┤
│  CALL BAR: Incoming call · On call · Thinking · Speaking        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  DEFAULT LANDING: Ticket Queue (table)                          │
│  ┌──────┬────────┬────────────┬────────┬─────────┬──────────┐   │
│  │ INC  │ Client │ Subject     │ Status │ Priority│ Assigned │   │
│  ├──────┼────────┼────────────┼────────┼─────────┼──────────┤   │
│  │ 2847 │ Connex │ Outlook    │ Open   │ HIGH    │ You      │   │
│  │      │ -ion   │ not sending│        │         │          │   │
│  └──────┴────────┴────────────┴────────┴─────────┴──────────┘   │
│                                                                  │
│  Click row → Ticket Detail (full screen)                        │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  INC-002847  🔴 HIGH  ● Open                             │    │
│  │  Outlook cannot send emails                               │    │
│  │  Sarah Thompson · Connexion Dental · Accounts             │    │
│  │                                                           │    │
│  │  Customer Description (from initial message)              │    │
│  │                                                           │    │
│  │  ┌──────────────────────────────────────────────────────┐ │    │
│  │  │  Ticket Notes / Draft                                │ │    │
│  │  │  [textarea]                                          │ │    │
│  │  └──────────────────────────────────────────────────────┘ │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  REMOTE ACTIVE: split layout                                    │
│  ┌──────────────┬───────────────────────────────────────────┐    │
│  │ Ticket panel │ Remote sandbox (tabbed tools)             │    │
│  │ (narrow,     │ Outlook │ Browser │ CMD                   │    │
│  │  still has   │ ┌─────────────────────────────────────┐   │    │
│  │  notes +     │ │ Tool output / actions               │   │    │
│  │  submit)     │ └─────────────────────────────────────┘   │    │
│  └──────────────┴───────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### Key Behaviors

1. **Landing page is always the ticket queue.** Even with one ticket. The candidate sees a table with their ticket(s). This makes it feel like a real service desk, not a custom assessment tool.

2. **Click a row → ticket detail opens full-screen.** The detail shows: header (ID, severity, status), requester info, description, and a notes/draft area. No left panel when not remoted.

3. **Call bar sits at the top across both views.** It shows the call state (incoming, active, thinking, speaking, ended). Mic button and end-call button live here. The call bar does NOT go away when switching between queue and detail views.

4. **Remote desktop mode is the only time the layout splits.** When the user remotes in, the ticket detail narrows to a left panel. The remote sandbox fills the right. When the remote session ends, the ticket goes back to full-screen.

5. **No chat bubbles, no send buttons for conversation.** Voice is the primary interaction. The status bar shows what's happening. The transcript exists backend-side but is not rendered as a chat UI.

6. **Ticket notes textarea is always visible** (in both full and split modes). The candidate can type notes at any time. Submit button appears when ready.

### What Real PSA Dashboards Look Like

- **ConnectWise Manage**: Left sidebar with modules (Service Desk, Sales, Projects, etc.). Main area shows a ticket grid with columns: Company, Contact, Summary, Status, Priority, Board, Assigned. Clicking opens a ticket in a detail view with tabs (Details, Time Entry, Notes, etc.).

- **HaloPSA**: Top navigation bar. Main area defaults to a ticket list view with filters and columns. Clicking a ticket opens a split view — ticket details on the left, conversation/updates on the right.

- **Autotask**: Left sidebar navigation. Ticket list as the default service desk view with configurable columns. Ticket detail has tabs for Notes, Time Entries, Attachments, etc.

### What CallCallum Should Borrow

- The **ticket queue as landing** — makes it feel like a real PSA
- The **call bar as persistent top element** — phone system metaphor
- The **full-screen ticket detail** — focus on the ticket
- The **split layout only when remoted** — ticket stays visible, tools get space
- The **notes always available** — techs type notes throughout the call

### What CallCallum Should Skip

- Complex left sidebar with modules (unnecessary for single-ticket scenarios)
- Ticket tabs (Details / Time / Notes) — keep it simple with a single scrollable view
- Multi-user assignment, SLA tracking, billing — not relevant for training

## Action Items

1. Build unified `CandidateShell` component that replaces both the hiring exam page and ItsmCandidateShell
2. Remove text chat UI (message bubbles, input box) — replace with status bar + mic
3. Keep ticket panel pinned on the left
4. Replace Win11 desktop + window manager with tabbed tool sandbox
5. Remove `useWindowManager`, `WindowProvider`, `Desktop`, `Taskbar`, `WindowFrame` from the candidate flow
6. Single voice hook, single speak path
7. Status bar component for call state

## Non-Goals

- Do not build a full Windows desktop simulation
- Do not implement drag/resize/minimize for tool windows
- Do not show chat bubbles
- Do not keep separate UI paths for different assignment types
- Do not touch the backend analysis/scoring/DB
