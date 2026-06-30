# SimPack Architecture & Implementation Plan

> Written 2026-06-26. Foundations first, packs second.

---

## 0. Executive Summary

This document specifies **two new training drill packs** (Printer Spooler, VPN DNS) and the **foundational backend reorganization** needed so the same service desk shell, remote desktop, and scoring pipeline serve all packs without per-pack rewrites.

The key insight: the remote desktop (7 apps, DesktopSurface, Taskbar, WindowFrame) and the `ServiceDeskSimulatorShell` are already pack-agnostic. A new pack is just a data definition — customer, scenario, actions, rubric, scoring criteria, taxonomy tags. The work is decoupling the Outlook-specific assumptions from `SimState`, `TaxonomyTag`, and `scoring.ts`.

---

## 1. Current Architecture Assessment

### 1.1 What Works (zero changes needed)

| Component | File | Why |
|---|---|---|
| `SimPack` interface | `lib/mvp/sim/types.ts:207` | Clean abstraction: customer, initialState, actions, rubric, idealTicket |
| Pack registry | `lib/mvp/sim/packRegistry.ts:4` | Simple factory map. Ready for multiple packs |
| State machine | `lib/mvp/sim/stateMachine.ts:55` | `applyAction()` reads effects/tags/observations from any `SimAction` |
| `safeProjection` | `lib/mvp/sim/safeProjection.ts` | Returns all actions unfiltered; `getVisibleState` filters by discovery tags only |
| Event log bridge | `lib/mvp/sim/eventLog.ts` | Writes to `sim_events` + `session_events`. Carries taxonomy_tags + red_flags |
| `session_events` | `lib/mvp/events/eventLog.ts` | Canonical event stream with `payload_json`. Pack-agnostic |
| Remote desktop shell | `components/mvp/simulator/*` | All 7 apps pre-built. DesktopSurface, Taskbar, WindowFrame zero changes |
| `ServiceDeskSimulatorShell` | `components/mvp/simulator/ServiceDeskSimulatorShell.tsx` | Renders any sim pack via phase/capabilities |
| Assessment creation | `app/api/mvp/assessments/route.ts` | `assessmentPackId` already selectable; `sim_sessions` created for training_drill |
| Sim action API | `app/api/mvp/assessment/[token]/sim/action/route.ts` | Generic: loads pack, finds action, runs state machine, logs events |

### 1.2 What's Coupled (must fix before new packs)

| Issue | File(s) | Severity |
|---|---|---|
| `SimState` has Outlook-only named fields | `lib/mvp/sim/types.ts:118-129` | **Blocking** — can't represent printer/VPN state |
| `TaxonomyTag` is a closed TypeScript union of 39 literals | `lib/mvp/sim/types.ts:10-46` | **Blocking** — can't add tags without editing types.ts |
| `getInitialState()` returns Outlook defaults | `lib/mvp/sim/packConfig.ts:5-53` | **Medium** — each pack already provides `initialState` in `SimPack` |
| `scoreSimEvents()` hardcodes Outlook action IDs | `lib/mvp/sim/scoring.ts:39-135` | **High** — each pack needs its own criteria and weights |
| `PrinterApp` is local-only state (doesn't read sim state) | `components/mvp/simulator/PrinterApp.tsx` | **Medium** — needs to show pack-driven printer status |
| `VpnApp` is local-only state (doesn't read sim state) | `components/mvp/simulator/VpnApp.tsx` | **Medium** — needs to show pack-driven VPN status |
| `CmdApp` missing spooler/DNS commands | `components/mvp/simulator/CmdApp.tsx` | **Medium** — needs `net start spooler`, `ipconfig /flushdns`, `nslookup` |
| `OutlookApp` reads `state.outlook` directly | `components/mvp/simulator/OutlookApp.tsx` | **Low** — works but needs refactor for consistency |

---

## 2. Foundation Work (Phase 0: Do This First)

These 6 steps decouple the sim engine from any single pack. After this phase, adding a pack = one new file + one registry line.

### Step 0.1 — Generic `toolStates` Map in SimState

**File:** `lib/mvp/sim/types.ts`

Replace named optional fields with a generic map:

```ts
// BEFORE:
interface SimState {
  outlook?: { workOffline: boolean; outboxCount: number; ... };
  network?: { internetReachable: boolean; dnsWorks: boolean; ... };
  connectwise?: { ticketId: string | null; ... };
}

// AFTER:
type SimToolStateKey = 'outlook' | 'network' | 'connectwise' | 'printer' | 'vpn';

interface SimState {
  phase: SimPhase;
  call: { startedAt: number | null; endedAt: number | null; customerMood: CustomerMood; factsRevealed: string[]; };
  remote: { connected: boolean; deviceName: string; currentApp: string; };
  toolStates: Partial<Record<SimToolStateKey, Record<string, unknown>>>;
  evidence: EvidenceState;
  flags: FlagsState;
  discovered: string[];
}
```

Each pack defines its own tool state keys in its initializer. The state machine's `setNested` already uses dot-path keys; paths change from `outlook.workOffline` to `toolStates.outlook.workOffline`.

Migration impact:
- `stateMachine.ts` — all effect paths get `toolStates.` prefix
- `safeProjection.ts` — `pickSafe()` reads from `toolStates`
- `OutlookApp.tsx` — reads `props.state.toolStates.outlook`
- `PrinterApp.tsx` — reads `props.state.toolStates.printer`
- `VpnApp.tsx` — reads `props.state.toolStates.vpn`
- `packConfig.ts` (Outlook pack) — initial state uses `toolStates.outlook`
- `scoring.ts` — reads `finalState.toolStates` instead of direct fields

### Step 0.2 — Open `TaxonomyTag` to String + Runtime Validation

**File:** `lib/mvp/sim/types.ts`

```ts
// BEFORE: closed union of 39 literals
export type TaxonomyTag = 'communication.scope_question' | ... | 'red_flag.guessed_root_cause_without_evidence';

// AFTER: open string with structural validation
export type TaxonomyTag = string;

export function isValidTaxonomyTag(tag: string): boolean {
  return /^[a-z_]+\.[a-z_]+\.[a-z_]+$/.test(tag);
}

// Tag registry for documentation/discovery
export const REGISTERED_TAGS: Record<string, { category: string; subcategory: string; item: string; description: string }> = {
  'communication.scope_question': { category: 'communication', subcategory: 'scope_question', item: 'scope_question', description: 'Candidate asked whether one user or many are affected' },
  'communication.impact_question': { category: 'communication', subcategory: 'impact_question', item: 'impact_question', description: 'Candidate asked about business impact' },
  // ... existing tags registered here
  // New packs register their tags at pack definition time
};
```

Each pack defines its own tags at the bottom of its pack file. The registry is for tooling/docs only, not for type-level enforcement. The naming convention (`domain.category.item`) is enforced at registration-time (`isValidTaxonomyTag`).

### Step 0.3 — Pack-Driven Scoring

**File:** `lib/mvp/sim/scoring.ts` — rewrite

Add to `SimPack`:

```ts
interface SimPackScoringCriterion {
  id: string;
  label: string;
  weight: number;                       // score points
  check: 'action_performed'             // check if action_id was performed
       | 'tag_present'                   // check if taxonomy tag exists in any event
       | 'tag_in_event'                  // check a specific event for a tag
       | 'state_value';                  // check a state path equals a value
  target: string;                        // action_id, taxonomy tag, or dot.path
  value?: unknown;                       // expected value (for state_value check)
  positive?: boolean;                    // true = add points, false = subtract
}

interface SimPack {
  // ... existing fields ...
  scoringCriteria: SimPackScoringCriterion[];
  diagnosticChecklist: { id: string; label: string; criteria: string; }[];
}
```

The scoring function becomes generic:

```ts
function scoreSimEvents(params: { pack: SimPack; events: SessionEvent[]; finalState: SimState }): SimScoringResult {
  // 1. Iterate pack.scoringCriteria, evaluate each against events + state
  // 2. Compute actionCriteria (pass/partial/fail per criterion)
  // 3. Compute scoreDelta (sum of weights for passing criteria, subtract red flags)
  // 4. Build timelineSummary from events
  // 5. Build technicalPath from pack.diagnosticChecklist + actionCriteria
}
```

The Outlook pack's current hardcoded logic moves into pack config as `scoringCriteria` entries:

```ts
scoringCriteria: [
  { id: 'asked_impact', label: 'Asked business impact', weight: 8, check: 'tag_present', target: 'communication.impact_question' },
  { id: 'asked_scope', label: 'Asked scope', weight: 8, check: 'tag_present', target: 'communication.scope_question' },
  { id: 'opened_outlook', label: 'Opened Outlook', weight: 5, check: 'action_performed', target: 'open_outlook' },
  { id: 'checked_status', label: 'Checked Outlook status', weight: 15, check: 'action_performed', target: 'check_outlook_status' },
  { id: 'disabled_wfo', label: 'Disabled Work Offline', weight: 20, check: 'action_performed', target: 'disable_work_offline' },
  { id: 'verified_fix', label: 'Verified fix', weight: 10, check: 'action_performed', target: 'send_test_email' },
  { id: 'used_kb', label: 'Used knowledge base', weight: 5, check: 'action_performed', target: 'search_kb_outlook' },
  { id: 'avoided_red_flags', label: 'Avoided red flags', weight: 10, check: 'state_value', target: 'flags.guessedWithoutEvidence', value: false },
],
diagnosticChecklist: [
  { id: 'confirmed_user', label: 'Identified the user', criteria: 'confirmed_user' },
  { id: 'asked_scope', label: 'Asked scope (one user or many)', criteria: 'asked_scope' },
  { id: 'asked_impact', label: 'Asked business impact', criteria: 'asked_impact' },
  { id: 'opened_outlook', label: 'Opened Outlook to investigate', criteria: 'opened_outlook' },
  { id: 'checked_status', label: 'Checked Outlook connection status', criteria: 'checked_status' },
  { id: 'disabled_wfo', label: 'Disabled Work Offline (correct fix)', criteria: 'disabled_wfo' },
  { id: 'verified_fix', label: 'Verified fix with test email', criteria: 'verified_fix' },
  { id: 'used_kb', label: 'Used knowledge base', criteria: 'used_kb' },
  { id: 'avoided_red_flags', label: 'Avoided dangerous actions', criteria: 'avoided_red_flags' },
],
```

This ensures scoring is always data-defined, never hardcoded. The same function scores any pack.

### Step 0.4 — Split Pack Files from Infrastructure

Create directory structure:

```
lib/mvp/sim/
├── types.ts                  # Core types (extensible SimState, open TaxonomyTag)
├── registry.ts               # Pack registry (imports from packs/)
├── stateMachine.ts           # Generic state machine (path prefixes changed)
├── scoring.ts                # Parameterized scoring (reads pack.scoringCriteria)
├── safeProjection.ts         # Updated to read from toolStates
├── eventLog.ts               # Unchanged
├── timeline.ts               # Unchanged
└── packs/
    ├── index.ts              # Export all pack IDs + factory fns
    ├── outlook-work-offline.ts
    ├── printer-spooler.ts    # NEW
    └── vpn-dns.ts            # NEW
```

Each pack file exports: `PACK_ID`, `getInitialState()`, `getPack()`. The registry maps `PACK_ID -> factory`.

### Step 0.5 — Add Missing CmdApp Commands

**File:** `components/mvp/simulator/CmdApp.tsx`

Add these to the `KNOWN_COMMANDS` array:

| Command | Type | Output (mock) | Backend action trigger |
|---|---|---|---|
| `net stop spooler` | system | "The Print Spooler service was stopped successfully." | — |
| `net start spooler` | system | "The Print Spooler service was started successfully." | `restart_spooler` |
| `sc query spooler` | system | Shows spooler service status: RUNNING or STOPPED | `check_spooler` |
| `ipconfig /flushdns` | network | "Successfully flushed the DNS Resolver Cache." | `flush_dns` |
| `nslookup <hostname>` | network | Shows IP resolution result (or NXDOMAIN) | — |

Each command's output adapts based on `visibleState` (e.g., `sc query spooler` shows "STOPPED" or "RUNNING" based on `state.toolStates.printer.spoolerRunning`).

### Step 0.6 — Make PrinterApp and VpnApp State-Driven

**File:** `components/mvp/simulator/PrinterApp.tsx`

Replace local `useState` with props-driven state. Accept:

```tsx
interface PrinterAppProps {
  state?: { hpOffline: boolean; stuckJobs: number; spoolerRunning: boolean; testPageSent: boolean; };
  onAction?: (id: string, tool: string) => void;
  onRecordInteraction?: (actionId: string, label: string, eventType?: string) => void;
}
```

The printer list, status badges, and queue counts are driven by `state`. Clicking "Send Test Page" calls `onAction('send_test_page', 'printer')`.

**File:** `components/mvp/simulator/VpnApp.tsx`

Same pattern. Accept:

```tsx
interface VpnAppProps {
  state?: { connected: boolean; dnsFlushed: boolean; lastError: string | null; serverHostname: string; };
  onAction?: (id: string, tool: string) => void;
  onRecordInteraction?: (actionId: string, label: string, eventType?: string) => void;
}
```

VPN toggle, status indicator, and error messages driven by `state`. Clicking "Connect" calls `onAction('connect_vpn', 'vpn')`.

**File:** `components/mvp/simulator/RemoteDesktopPane.tsx`

Update `renderApp()` to pass toolStates to PrinterApp and VpnApp:

```tsx
case 'printer': return <PrinterApp state={safeState.toolStates?.printer as any} onAction={onAction} onRecordInteraction={onRecordInteraction} />;
case 'vpn': return <VpnApp state={safeState.toolStates?.vpn as any} onAction={onAction} onRecordInteraction={onRecordInteraction} />;
```

And update `OutlookApp` to read from `safeState.toolStates?.outlook`.

---

## 3. Drill 2 Spec — Printer Offline: Print Spooler Stopped

### 3.1 Customer & Scenario

```
Customer:      Mark Chen
Company:       Pacific Logistics
Role:          Operations Manager
Temperament:   stressed ("I've been trying to print for 20 minutes!")
Device:        ALDER-LT-023

Opening line:
"The main office printer isn't printing. I've got 3 shipping manifests queued
and the labels need to go out before the 2pm courier cutoff. Can you get this
working? The printer is right next to me and it's showing a green light, so
I know it's on."
```

### 3.2 Hidden Truth

```
Root cause:    Print Spooler service stopped after Windows Update at 3am
Correct fix:   Open Cmd, run "net start spooler", verify printer goes online
Diagnostic path:
  1. Open Printers panel → see HP offline with 3 stuck jobs
  2. Check printer physical status → green light, USB connected (rule out power/cable)
  3. Check network connectivity → internet works (rule out network)
  4. Open Cmd → "sc query spooler" → STATE: 1 STOPPED
  5. Run "net start spooler" → Print Spooler starts, printer goes Online, queue clears
  6. Send test page → customer confirms
  7. Document fix in ticket

Facts revealed by actions:
  - open_printers:      "Oh right, the printer shows Offline on my screen too."
  - check_spooler:      "Actually, Windows did do an update last night — could that be related?"
```

### 3.3 Initial SimState

```ts
{
  phase: 'not_started',
  call: { startedAt: null, endedAt: null, customerMood: 'frustrated', factsRevealed: [] },
  remote: { connected: false, deviceName: 'ALDER-LT-023', currentApp: 'none' },
  toolStates: {
    printer: { hpOffline: true, stuckJobs: 3, spoolerRunning: false, testPageSent: false, driverVersion: '21.200.1.2' },
    network: { internetReachable: true, dnsWorks: true },
    connectwise: { ticketId: null, priority: null, status: null, notes: [], kbArticlesViewed: [], assetsViewed: [] },
  },
  evidence: { askedImpact: false, askedScope: false, confirmedUser: false, confirmedDevice: false, checkedObviousCause: false, verifiedFix: false },
  flags: { guessedWithoutEvidence: false, performedRiskyAction: false, ignoredUserEmotion: false },
  discovered: [],
}
```

### 3.4 Tools

`['customer_chat', 'ticket', 'printer', 'cmd', 'control_panel', 'connectwise', 'notes', 'network', 'browser']`

### 3.5 Actions (18 total)

**Call Lifecycle (shared across all packs):**
- `start_call` (customer_chat) — "Call connected. Customer is on the line."
- `end_call` (customer_chat) — "Call ended. Proceed to write your ticket."

**Remote Access (shared):**
- `remote_connect` (connectwise) — "Remote session established with ALDER-LT-023."

**Diagnostic Actions:**

| ID | Tool | Requires | Observation |
|---|---|---|---|
| `open_printers` | printer | — | "Printers panel opens. HP LaserJet Pro M404dn shows **Offline** status with 3 jobs stuck in queue." |
| `check_printer_status` | printer | — | "HP LaserJet: Status Offline. 3 jobs stuck. Physical printer shows green power light and USB connected. No error on LCD." |
| `check_network` | network | — | "Ethernet adapter active. Internet reachable. Device on corporate LAN. Not a connectivity issue." |
| `test_webmail` | browser | — | "Webmail loads fine. Can send test email. Printer issue is not network-related." |

**Fix Actions:**

| ID | Tool | Requires | Observation | Tags | Weight |
|---|---|---|---|---|---|
| `open_cmd` | cmd | — | "Command Prompt opens." | `tool.cmd.open` | +3 diagnosis |
| `check_spooler` | cmd | — | "sc query spooler returns STATE: 1 STOPPED. Print Spooler service is not running." | `diagnostic.service_checked` `tool.cmd.spooler_status` | +15 diagnosis |
| `restart_spooler` | cmd | — | Effects: `toolStates.printer.spoolerRunning=true`, `toolStates.printer.hpOffline=false`, `toolStates.printer.stuckJobs=0`. Observation: "Print Spooler started. HP LaserJet now shows **Online**. Queue cleared — 3 jobs printed." | `fix.correct_root_cause` `tool.cmd.restart_spooler` | +20 fix |
| `send_test_page` | printer | `printer.spoolerRunning=true` | Effects: `toolStates.printer.testPageSent=true`, `evidence.verifiedFix=true`. Observation: "Test page sent. Customer confirms: 'Yes, that just printed! Thank you.'" | `verification.user_confirmed` `tool.printer.test_page` | +10 verification |

**Support Actions:**

| ID | Tool | Observation | Tags | Weight |
|---|---|---|---|---|
| `open_ticket` | connectwise | "Ticket opened for Mark Chen / Pacific Logistics." | `tool.connectwise.open_ticket` | — |
| `update_priority` | connectwise | "Priority set to High — courier cutoff approaching." | `tool.connectwise.set_priority` `ticket.urgency_noted` | +5 ticket |
| `search_kb_printer` | connectwise | Effects: `toolStates.connectwise.kbArticlesViewed=['printer-spooler-update']`. Observation: "KB article 'Print Spooler stops after Windows Update' found at KB-5512." | `diagnostic.kb_used` `tool.connectwise.search_kb` | +5 diagnosis |
| `view_asset` | connectwise | "Asset ALDER-LT-023: Dell Latitude 5540, Windows 11, HP LaserJet Pro M404dn (USB). Last patched yesterday." | `tool.connectwise.view_asset` | +3 diagnosis |
| `add_note` | connectwise | "Note added to ticket." | `tool.connectwise.add_note` | — |

**Red Flag Actions:**

| ID | Tool | Red Flag ID | Severity | Message |
|---|---|---|---|---|
| `reinstall_printer_driver` | control_panel | `jumped_to_disruptive_fix` | major | "Attempted to reinstall printer driver before checking spooler status." |
| `delete_printer` | control_panel | `destructive_action_without_evidence` | major | "Deleted and re-added printer — destructive step before basic service check." |
| `escalate_without_checks` | connectwise | `escalate_without_basic_checks` | major | "Escalated to Tier 2 without checking spooler or printer status." |
| `blame_network_outage` | customer_chat | `guessed_without_evidence` | major | "Blamed network outage without checking connectivity first." |

### 3.6 Scoring Criteria

```ts
scoringCriteria: [
  { id: 'asked_impact', label: 'Asked business impact', weight: 8, check: 'tag_present', target: 'communication.impact_question' },
  { id: 'asked_scope', label: 'Asked scope', weight: 8, check: 'tag_present', target: 'communication.scope_question' },
  { id: 'confirmed_user', label: 'Confirmed user identity', weight: 5, check: 'tag_present', target: 'communication.user_confirmation' },
  { id: 'opened_printers', label: 'Opened Printers panel', weight: 5, check: 'action_performed', target: 'open_printers' },
  { id: 'checked_status', label: 'Checked printer status', weight: 10, check: 'action_performed', target: 'check_printer_status' },
  { id: 'checked_connectivity', label: 'Ruled out network issue', weight: 8, check: 'action_performed', target: 'check_network' },
  { id: 'checked_spooler', label: 'Checked Print Spooler', weight: 15, check: 'action_performed', target: 'check_spooler' },
  { id: 'restarted_spooler', label: 'Restarted Print Spooler', weight: 20, check: 'action_performed', target: 'restart_spooler' },
  { id: 'verified_print', label: 'Verified with test page', weight: 10, check: 'action_performed', target: 'send_test_page' },
  { id: 'used_kb', label: 'Used knowledge base', weight: 5, check: 'action_performed', target: 'search_kb_printer' },
  { id: 'avoided_red_flags', label: 'Avoided red flags', weight: 10, check: 'state_value', target: 'flags.performedRiskyAction', value: false },
],
```

### 3.7 Ideal Ticket

```ts
idealTicket: {
  summary: 'HP LaserJet Pro M404dn not printing at Pacific Logistics — Print Spooler stopped after Windows Update',
  requiredFields: ['user', 'company', 'device', 'peripheral', 'issue_summary', 'impact', 'urgency', 'checks_attempted', 'root_cause', 'resolution', 'verification', 'next_step'],
  mustMention: ['Mark Chen', 'Pacific Logistics', 'Print Spooler', 'Windows Update', 'net start spooler', 'test page confirmed'],
  mustNotInvent: ['printer hardware fault', 'USB cable broken', 'driver corruption', 'network outage'],
}
```

### 3.8 How Existing Apps Are Reused

| Desktop App | What it shows in this drill | Driven by |
|---|---|---|
| Printers | HP LaserJet "Offline" with 3 stuck jobs; goes "Online" after spooler restart | `toolStates.printer` |
| Cmd | `sc query spooler` shows STOPPED; `net start spooler` starts it; `net stop spooler` stops it | `toolStates.printer.spoolerRunning` |
| Control Panel | "Programs: Repair Printer Driver" and "Devices: Delete Printer" available as red flag traps | Static |
| Network | Ethernet connected, internet OK | `toolStates.network` |
| Browser | Webmail test page accessible | Static |
| Outlook | Not relevant but available (shows normal state) | `toolStates.outlook` |

The desktop always shows all 7 icons. The sim pack just defines which ones are diagnostically useful.

---

## 4. Drill 3 Spec — VPN Cannot Connect: DNS Cache Poisoned

### 4.1 Customer & Scenario

```
Customer:      Jenna Davis
Company:       Mountain West Insurance
Role:          Remote Sales Representative
Temperament:   frustrated ("I have client proposals due in 2 hours!")
Device:        ALDER-LT-023 (working from Denver office — not home)

Opening line:
"Hi, I'm working from the Denver office this week and my VPN won't connect.
I keep getting 'cannot connect to server' every time I try. I need our CRM
to pull client renewal data before the 3pm review. I've already tried three
times and it just spins for a minute then fails."
```

### 4.2 Hidden Truth

```
Root cause:    Stale/corrupt DNS cache can't resolve VPN server hostname
Correct fix:   ipconfig /flushdns → verify DNS resolution works → reconnect VPN
Diagnostic path:
  1. Open VPN panel → see disconnected, error: "cannot resolve vpn.mtnwest.local"
  2. Check Network → Ethernet connected, internet working
  3. Open Browser → navigate to google.com → loads fine (internet works)
  4. Open Cmd → ping vpn.mtnwest.local → fails (DNS)
  5. Run nslookup vpn.mtnwest.local → returns "Non-existent domain" (DNS cache issue)
  6. Run ipconfig /flushdns → DNS cache cleared
  7. Run nslookup vpn.mtnwest.local → now resolves to 10.50.1.12
  8. Open VPN → connect → now green/connected
  9. Verify CRM accessible

Facts revealed by actions:
  - check_vpn_status:    "I did switch from home Wi-Fi to the office network this morning — maybe that caused it?"
  - check_dns:           "Oh, I remember now — IT changed the VPN server address last month."
```

### 4.3 Initial SimState

```ts
{
  phase: 'not_started',
  call: { startedAt: null, endedAt: null, customerMood: 'frustrated', factsRevealed: [] },
  remote: { connected: false, deviceName: 'ALDER-LT-023', currentApp: 'none' },
  toolStates: {
    vpn: { connected: false, dnsFlushed: false, lastError: 'Cannot resolve server address: vpn.mtnwest.local', serverHostname: 'vpn.mtnwest.local' },
    network: { internetReachable: true, dnsWorks: false, ethernetConnected: true, wifiEnabled: false },
    connectwise: { ticketId: null, priority: null, status: null, notes: [], kbArticlesViewed: [], assetsViewed: [] },
  },
  evidence: { askedImpact: false, askedScope: false, confirmedUser: false, confirmedDevice: false, checkedObviousCause: false, verifiedFix: false },
  flags: { guessedWithoutEvidence: false, performedRiskyAction: false, ignoredUserEmotion: false },
  discovered: [],
}
```

### 4.4 Tools

`['customer_chat', 'ticket', 'vpn', 'network', 'cmd', 'browser', 'control_panel', 'connectwise', 'notes']`

### 4.5 Actions (19 total)

**Call + Remote (shared):** `start_call`, `end_call`, `remote_connect`

**Diagnostic Actions:**

| ID | Tool | Observation |
|---|---|---|
| `open_vpn` | vpn | "VPN panel opens. Status: Disconnected. Last error: 'Cannot resolve server address: vpn.mtnwest.local'." |
| `check_vpn_status` | vpn | "VPN type: L2TP/IPsec. Server: vpn.mtnwest.local. Status: Not connected. Error timestamp: 09:47 AM today." |
| `check_network` | network | "Ethernet connected (corporate LAN). Internet reachable. Not a physical connectivity issue." |
| `test_internet` | browser | "Google.com loads successfully. General internet access works. Issue is specific to VPN resolution." |

**Fix Actions:**

| ID | Tool | Requires | Observation | Tags | Weight |
|---|---|---|---|---|---|
| `open_cmd` | cmd | — | "Command Prompt opens." | `tool.cmd.open` | +3 diagnosis |
| `ping_vpn` | cmd | — | "ping vpn.mtnwest.local: Ping request could not find host. Please check the name and try again." (shows DNS failure) | `tool.cmd.ping` `diagnostic.connectivity_verified` | +8 diagnosis |
| `check_dns` | cmd | — | "nslookup vpn.mtnwest.local returns: *** vpn.mtnwest.local: Non-existent domain. DNS resolver cache is stale." | `diagnostic.dns_checked` `tool.cmd.nslookup` | +15 diagnosis |
| `flush_dns` | cmd | — | Effects: `toolStates.vpn.dnsFlushed=true`, `toolStates.network.dnsWorks=true`. Observation: "ipconfig /flushdns: Successfully flushed the DNS Resolver Cache." | `fix.correct_root_cause` `tool.cmd.flushdns` | +20 fix |
| `verify_dns` | cmd | `vpn.dnsFlushed=true` | "nslookup vpn.mtnwest.local now resolves to 10.50.1.12. DNS resolution restored." | `verification.dns_resolved` | +5 verification |
| `connect_vpn` | vpn | `vpn.dnsFlushed=true` | Effects: `toolStates.vpn.connected=true`. Observation: "VPN connected to vpn.mtnwest.local. Status: Connected. Remote sales CRM now accessible." | `fix.correct_root_cause` `tool.vpn.connected` | +10 fix |
| `verify_crm` | browser | `vpn.connected=true` | Effects: `evidence.verifiedFix=true`. Observation: "CRM loads successfully over VPN. Customer confirms: 'Great, I can see the renewal data now!'" | `verification.user_confirmed` | +10 verification |

**Support Actions:**

| ID | Tool | Observation |
|---|---|---|
| `open_ticket` | connectwise | "Ticket opened for Jenna Davis / Mountain West Insurance." |
| `update_priority` | connectwise | "Priority set to High — proposals due in 2 hours." |
| `search_kb_vpn` | connectwise | "KB article 'VPN DNS resolution failures after network change' found at KB-6721." |
| `view_asset` | connectwise | "Asset ALDER-LT-023: Dell Latitude 5540, Windows 11, L2TP VPN configured." |
| `add_note` | connectwise | "Note added to ticket." |

**Red Flag Actions:**

| ID | Tool | Red Flag | Severity |
|---|---|---|---|
| `reinstall_vpn` | control_panel | Candidate reinstalled VPN client before checking DNS resolution. | major |
| `disable_firewall` | control_panel | Candidate disabled Windows Firewall — security risk without checking DNS first. | critical |
| `escalate_without_checks` | connectwise | Candidate escalated to Tier 2 without basic DNS diagnostics. | major |
| `blame_isp` | customer_chat | Candidate blamed ISP without checking browser or running ping. | major |
| `factory_reset_network` | control_panel | Candidate attempted network stack reset before checking DNS cache. | major |

### 4.6 Scoring Criteria

```ts
scoringCriteria: [
  { id: 'asked_impact', label: 'Asked business impact', weight: 8, check: 'tag_present', target: 'communication.impact_question' },
  { id: 'asked_scope', label: 'Asked about recent changes', weight: 8, check: 'tag_present', target: 'communication.recent_changes' },
  { id: 'confirmed_user', label: 'Confirmed user identity', weight: 5, check: 'tag_present', target: 'communication.user_confirmation' },
  { id: 'opened_vpn', label: 'Opened VPN panel', weight: 5, check: 'action_performed', target: 'open_vpn' },
  { id: 'checked_network', label: 'Checked network status', weight: 8, check: 'action_performed', target: 'check_network' },
  { id: 'tested_internet', label: 'Tested internet in browser', weight: 5, check: 'action_performed', target: 'test_internet' },
  { id: 'pinged_vpn', label: 'Pinged VPN server', weight: 8, check: 'action_performed', target: 'ping_vpn' },
  { id: 'checked_dns', label: 'Checked DNS with nslookup', weight: 15, check: 'action_performed', target: 'check_dns' },
  { id: 'flushed_dns', label: 'Flushed DNS cache', weight: 20, check: 'action_performed', target: 'flush_dns' },
  { id: 'verified_dns', label: 'Verified DNS resolution', weight: 5, check: 'action_performed', target: 'verify_dns' },
  { id: 'connected_vpn', label: 'Connected VPN', weight: 10, check: 'action_performed', target: 'connect_vpn' },
  { id: 'verified_crm', label: 'Verified CRM access', weight: 10, check: 'action_performed', target: 'verify_crm' },
  { id: 'used_kb', label: 'Used knowledge base', weight: 5, check: 'action_performed', target: 'search_kb_vpn' },
  { id: 'avoided_red_flags', label: 'Avoided red flags', weight: 15, check: 'state_value', target: 'flags.performedRiskyAction', value: false },
],
```

### 4.7 Ideal Ticket

```ts
idealTicket: {
  summary: 'VPN not connecting for Jenna Davis at Mountain West Insurance — DNS cache stale after office network switch',
  requiredFields: ['user', 'company', 'location', 'device', 'issue_summary', 'impact', 'urgency', 'checks_attempted', 'root_cause', 'resolution', 'verification', 'next_step'],
  mustMention: ['Jenna Davis', 'Mountain West Insurance', 'DNS cache', 'ipconfig /flushdns', 'VPN server resolution', 'CRM verified'],
  mustNotInvent: ['VPN server down', 'ISP outage', 'firewall blocking', 'corrupt VPN client'],
}
```

### 4.8 How Existing Apps Are Reused

| Desktop App | What it shows in this drill | Driven by |
|---|---|---|
| VPN | Disconnected, error "cannot resolve", status dot red; goes green after flushdns+connect | `toolStates.vpn` |
| Network | Ethernet connected, Wi-Fi off, status: "Internet access" | `toolStates.network` |
| Cmd | `ping` fails (DNS), `nslookup` returns NXDOMAIN, `ipconfig /flushdns` success | `toolStates.vpn`, `toolStates.network` |
| Browser | google.com works; CRM page loads after VPN connect | Static + `vpn.connected` check |
| Control Panel | "Network Reset", "Windows Firewall", "Uninstall VPN" available as red flag traps | Static |
| Outlook | Not relevant but available | `toolStates.outlook` |

---

## 5. How This Architecture Reuses Across All Three Assignment Types

### 5.1 Current State vs Target

| Layer | Hiring Exam (now) | Hiring Exam (target) | Training Drill (now) | Training Drill (target) | Training Shift (now) | Training Shift (target) |
|---|---|---|---|---|---|---|
| **Shell** | Chat page | `ServiceDeskSimulatorShell` (ticket only, no remote) | `ServiceDeskSimulatorShell` | `ServiceDeskSimulatorShell` (ticket + remote) | N/A | `ServiceDeskSimulatorShell` (ticket + queue + remote) |
| **Sim pack** | None | None | `packConfig.ts` (hardcoded) | `packs/*.ts` (any pack) | N/A | `packs/*.ts` (any pack, multi) |
| **Capabilities** | `remoteDesktop:false` | `remoteDesktop:false` | `remoteDesktop:true` | `remoteDesktop:true` | `remoteDesktop:true` (future) | `remoteDesktop:true` |
| **Call interaction** | Voice + chat | Voice-only (CallBar) | Voice + sim | Voice-only (CallBar) | N/A | Voice + queue |
| **Scoring** | AI analysis | AI analysis | Hardcoded Outlook | Pack-driven | N/A | Pack-driven, multi-session |
| **Manager UI** | Create hiring exam | Create hiring exam | Create training drill + drill selector | Create training drill + drill selector (3 options) | Disabled card | Create training shift (future) |

### 5.2 Unified Data Flow

```
                     Manager Dashboard
                           │
              ┌────────────┼────────────┐
              │            │            │
         Hiring Exam   Training Drill  Training Shift
              │            │            │
              │     [selects pack]      │
              │     outlook / printer   │
              │     / vpn-dns / custom  │
              │            │            │
              ▼            ▼            ▼
         ┌─────────────────────────────────────┐
         │    assessment_type stored in DB      │
         │    assessment_pack_id if drill/shift │
         │    sim_sessions created if needed    │
         └─────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
         hiring_exam              training_drill / shift
              │                         │
              ▼                         ▼
    ServiceDeskSimulatorShell    ServiceDeskSimulatorShell
    (no remoteDesktop cap)       (remoteDesktop cap)
    (ticket + CallBar)          (ticket + CallBar + RemoteDesktopPane)
              │                         │
              │                         ▼
              │              GET /assessment/[token]
              │              → returns pack title, sim state
              │                         │
              │                         ▼
              │              RemoteDesktopPane
              │              → DesktopSurface + all 7 apps
              │              → apps driven by pack's toolStates
              │                         │
              ▼                         ▼
         ┌─────────────────────────────────────┐
         │         Voice interaction            │
         │         STT → message → TTS          │
         │         CallBar manages state        │
         └─────────────────────────────────────┘
                           │
                           ▼
         ┌─────────────────────────────────────┐
         │         session_events               │
         │  (messages, actions, observations)   │
         │  taxonomy_tags + red_flags in payload │
         └─────────────────────────────────────┘
                           │
                           ▼
         ┌─────────────────────────────────────┐
         │         Ticket submission            │
         │         POST /ticket → completed     │
         └─────────────────────────────────────┘
                           │
                           ▼
         ┌─────────────────────────────────────┐
         │         Analysis pipeline            │
         │  Stage 1: AI evidence from events    │
         │  Stage 2: Deterministic scoring      │
         │  Stage 3: AI narrative feedback      │
         │  Pack-driven params where relevant   │
         └─────────────────────────────────────┘
```

### 5.3 How Capabilities Gate the UI

```ts
// assignment-types.ts
const ASSIGNMENT_TYPES = {
  hiring_exam:   { capabilities: { call: true, voice: true, ticketPanel: true, remoteDesktop: false, ... } },
  training_drill: { capabilities: { call: true, voice: true, ticketPanel: true, remoteDesktop: true, ... } },
  training_shift: { capabilities: { call: true, voice: true, ticketPanel: true, remoteDesktop: true, ... } }, // future
};

// ServiceDeskSimulatorShell.tsx — already uses capabilities to gate:
{capabilities.remoteDesktop && <button>Open Remote Desktop</button>}
{capabilities.call && <CallBar ... />}
{capabilities.voice && <VoiceRecorderButton ... />}
```

Same shell, same components, different capabilities visible. No code forking needed.

---

## 6. Manager Customization Path

This outlines how manager rules, taxonomy, and custom packs wire together across 4 levels of increasing sophistication.

### Level 0: Built-in Packs (Now)

```
Manager selects training_drill → picks from dropdown: Outlook | Printer | VPN
Pack ID stored in assessment.assessment_pack_id
Sim engine, apps, scoring use the pack definition as-is
```

**Implementation:** `DRILL_OPTIONS` array in `app/mvp/page.tsx` gains 2 entries. `ENABLED_TRAINING_DRILL_PACKS` gains 2 IDs. Zero new infrastructure.

### Level 1: Manager Standards Influence Scoring (Partial, can build now)

Managers already set standards at `/mvp/standards` (required ticket fields, call requirements, tone preferences). These are snapshotted into the assessment at creation time and flow into the analysis prompts.

For sim packs specifically, manager standards could influence:
- **Required ticket fields** — the ideal ticket spec already has `requiredFields`. The AI analysis stage checks candidate tickets against both the pack's `idealTicket` AND the manager's `required_ticket_fields` from the snapshot
- **Call requirements** — the AI evidence extraction prompt already includes `call_requirements` from standards
- **Escalation requirements** — the `escalate_without_checks` red flag could check against manager-defined escalation criteria

This largely already works via the existing standards snapshot → analysis prompt pipeline. No new infrastructure needed.

### Level 2: Parameterized Packs (Medium, future)

Allow managers to override specific pack fields per assessment:

```ts
// POST /api/mvp/assessments body:
{
  candidate_name: "Alex",
  assignmentType: "training_drill",
  assessmentPackId: "pack-printer-spooler-v1",
  packOverrides: {                     // NEW
    customer: { name: "Custom Name", company: "CustomCo" },
    urgency: "critical",
    customContext: "This printer handles shipping labels worth $50k/day"
  }
}
```

**Backend:** Add `pack_overrides_json` column to `assessments`. The `getPackById()` function merges overrides into the base pack definition. Overrides are snapshotted for analysis reproducibility.

**UI:** When selecting a drill, show "Customize" toggle that expands customer name/company/context fields. Pre-filled with defaults from the pack.

**Guardrails:** Only allow overrides for non-scoring fields (customer metadata, context). Never let managers change actions, rubric, or hidden truth — that would break scoring validity.

### Level 3: Taxonomy-Driven Pack Generation (High, future)

Managers browse the taxonomy (`/mvp/taxonomy`) — a library of ~200 classified help desk issues organized by type/sub_type/item. Each taxonomy item has: definition, playbook steps, keywords, escalation guidance, helpdesk tier.

A taxonomy item like "Printer Offline > Print Spooler Stopped" could auto-generate a training pack:

```
Taxonomy Item:              Auto-Generated Pack Field
─────────────────────────────────────────────────────────
item: "Print Spooler"  →    pack title
type: "hardware"       →    tool list (printer, cmd, network)
sub_type: "printer"    →    rubric weights
playbook steps (1-7)   →    diagnostic path + actions
keywords               →    taxonomy tags
escalation guidance     →    red flag definitions
definition_scope        →    hidden truth + correct fix
```

**Implementation:** Add `taxonomy_item_id` FK to `assessment_packs` DB table. A pack factory function that accepts a taxonomy item ID and generates the pack programmatically. The manager sees: "Create Drill from Taxonomy" → search taxonomy → select item → pack auto-generated → customize → create assessment.

**Why this matters:** vision.md says managers should "make their own custom packs." Taxonomy-driven generation means managers don't write sim code — they pick from a structured issue library. The library can be maintained centrally by training managers, and each entry automatically becomes a trainable drill.

### Level 4: Full Custom Pack Builder (Strategic, later)

A UI where managers build packs from scratch: define customer, write opening line, add diagnostic steps, set correct/incorrect paths, define red flags, set rubric weights. This requires a pack builder UI + validation + testing workflow. Not in scope for this milestone.

---

## 7. Training Shift Architecture (Future)

Training shift reuses the same shell but adds:
- **Queue view** — multiple tickets visible at once in the landing grid
- **Time pressure** — a simulated clock with SLA timers
- **Multi-session** — same candidate handles multiple calls/incidents in sequence
- **Difficulty ramp** — later tickets are harder

Technically, this is enabled by making the shell capable of loading **multiple packs** in sequence:

```ts
// training_shift assessment_pack_id = ['pack-outlook-sim-v2', 'pack-printer-spooler-v1', 'pack-vpn-dns-v1']
// Each pack runs as a sub-session. Scoring aggregates across all sub-sessions.
```

The shell, remote desktop, apps, state machine, and scoring pipeline remain unchanged. Only the orchestration layer (which pack loads when) is new.

**Guardrail from vision.md:** Do not build training shift yet. The architecture just needs to NOT close the door: keep pack loading parameterized (already done), keep session events per-session (already done), and don't hardcode single-pack assumptions.

---

## 8. Implementation Order (Prioritized)

### Phase 0 — Foundation (must be first)
```
 1. Make SimState extensible via toolStates map           [types.ts, stateMachine.ts,
 2. Open TaxonomyTag type + add runtime validation         safeProjection.ts,
 3. Rewrite scoring.ts to be pack-driven                   OutlookApp.tsx,
 4. Split pack files into packs/ directory                 packConfig.ts → packs/outlook-work-offline.ts]
 5. Add CmdApp commands (spooler, flushdns, nslookup)      [CmdApp.tsx]
 6. Make PrinterApp, VpnApp state-driven                   [PrinterApp.tsx, VpnApp.tsx, RemoteDesktopPane.tsx]
```
A 6-step refactor touching ~8 files. After this, adding a pack = one new file in `packs/` + one line in `registry.ts` + one line in `DRILL_OPTIONS`.

### Phase 1 — Drill 2 (Printer Spooler)
```
 7. Create lib/mvp/sim/packs/printer-spooler.ts
 8. Register in registry.ts
 9. Add to ENABLED_TRAINING_DRILL_PACKS
10. Add to DRILL_OPTIONS in app/mvp/page.tsx
```

### Phase 2 — Drill 3 (VPN DNS)
```
11. Create lib/mvp/sim/packs/vpn-dns.ts
12. Register in registry.ts
13. Add to ENABLED_TRAINING_DRILL_PACKS
14. Add to DRILL_OPTIONS in app/mvp/page.tsx
```

### Phase 3 — Tests
```
15. Update test:assignment-types to verify 3 enabled packs
16. Update test:dashboard-sim to verify pack-specific scoring
17. Add test:dashboard-sim-printer (independent test for printer pack)
18. Add test:dashboard-sim-vpn (independent test for vpn pack)
19. Add e2e: open assessment with each pack → verify same shell rendered
```

### Phase 4 — Taxonomy Linkage (after Phase 2)
```
20. Add taxonomy_item_id to assessment_packs table
21. Link each pack to its taxonomy item
22. Analysis pipeline reads taxonomy match data from pack
```

### Phase 5 — Manager Customization (future)
```
23. Add pack_overrides_json to assessments
24. Override UI in manager create flow
25. Taxonomy-driven pack generation from taxonomy items
```

---

## 9. Verification: Proof the Same Shell Is Reused

After implementing all 3 packs, the following test matrix proves shell reusability:

| Test | What to Verify |
|---|---|
| Create training_drill with pack-outlook-sim-v2 | Candidate sees ticket queue → opens ticket → Answer Call → Open Remote Desktop → Outlook icon opens OutlookApp with Work Offline state. All 7 desktop icons visible. |
| Create training_drill with pack-printer-spooler-v1 | Candidate sees same ticket queue → opens ticket → **same** Answer Call → **same** Open Remote Desktop → **same** desktop background + 7 icons. Printer icon opens PrinterApp with "Offline" status. Cmd accepts `net start spooler`. |
| Create training_drill with pack-vpn-dns-v1 | **Same** flow. Desktop shows all 7 icons. VPN icon opens VpnApp with "Disconnected" + DNS error. Cmd accepts `nslookup` and `ipconfig /flushdns`. |
| Create hiring_exam (no pack) | Same shell renders. Ticket on left. CallBar at top. Voice-only. **No** "Open Remote Desktop" button. **No** sim data loaded. |
| Manager list page | Shows 3 assignment type labels (Hiring Exam, Training Drill, Training Shift). Drill column shows which pack was selected ("Outlook Work Offline", "Printer Spooler Stopped", "VPN DNS Cache"). |

**What must be identical across all drills:**
- Top bar (Connexion PSA logo, mode badge, board label)
- CallBar (status, mic button, caller name)
- Ticket queue landing page (same grid columns)
- Ticket detail page (same header, metadata rows, customer description)
- RemoteDesktopPane (same ScreenConnect header, same 7 desktop icons, same taskbar)
- NotesPanel (same Internal Notes + Live Notes tabs)
- TranscriptToggle (same collapsed/expand behavior)
- TicketComposerView (same textarea + Submit button)

**What varies by pack:**
- Ticket title, requester name, description (from pack.customer)
- The initial state of each desktop app (from pack.toolStates)
- Which sim actions produce scoring events (from pack.actions + pack.scoringCriteria)
- What the ideal ticket should contain (from pack.idealTicket)

---

## 10. Guardrails

1. **One shell.** Never branch `ServiceDeskSimulatorShell` into pack-specific variants.
2. **Pack = data, not code.** A pack file should be pure data definition (customer, actions, rubric, scoring criteria). No conditional logic, no DOM, no API calls.
3. **State machine stays generic.** `applyAction()` should never check for specific action IDs. Phase transitions use action IDs as triggers; app-specific state changes use `effects` dot-paths.
4. **Scoring is data-driven.** `scoreSimEvents()` reads `pack.scoringCriteria` — no hardcoded string comparisons.
5. **Red flags are defined per pack.** The same 4 red flag patterns (disruptive fix, destructive action, escalate without checks, blame without evidence) appear in each pack, but each pack defines its own version with pack-specific action IDs.
6. **Taxonomy tags follow convention.** All tags use the `domain.category.specific_item` dotted format. The `isValidTaxonomyTag()` validator enforces this at registration time.
7. **Don't build training shift.** Keep the card "Coming Soon" in the manager UI. The API already rejects `training_shift` with `TRAINING_SHIFT_NOT_AVAILABLE`.
8. **Don't build the pack builder UI.** Packs are defined in TypeScript for now. The manager customization story (Levels 1-3) is spec'd but not implemented until the pack infrastructure stabilizes.
9. **session_events is canonical.** All sim actions, observations, red flags, and taxonomy tags flow into `session_events` via `insertSimEvent`. Analysis reads from `session_events`, not `sim_events`.
10. **assignment_type, not assessment_mode.** Runtime behavior gates on `assignment_type` and `SimulatorCapabilities`. `assessment_mode` is compatibility plumbing only.
