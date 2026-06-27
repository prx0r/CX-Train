# SimPack v2 — Data Flow Breaks

> Bug report: 2026-06-27
> When selecting a non-Outlook pack (e.g. password-reset), the simulator shows Outlook data
> because several routes have `|| 'pack-outlook-sim-v2'` fallbacks and the scenario system is not
> pack-aware.

---

## Root Cause Map

There are **6 distinct bugs** causing Outlook data to leak into any non-Outlook pack. They cascade.

```
                  ┌─────────────────────────────────────┐
                  │  Assessment creation                │
                  │  (assessments/route.ts)             │
                  │                                     │
                  │  1. scenario = getActiveScenario()  │← ALWAYS returns Outlook
                  │     (no pack-awareness)             │   (Bug #1)
                  │                                     │
                  │  2. First message INSERT uses       │
                  │     scenario.initial_message        │← "Hi, I'm having trouble
                  │     (NOT pack.customer.openingLine) │   with my Outlook..."
                  │                                     │   (Bug #2)
                  │                                     │
                  │  3. INSERT INTO assessments sets    │
                  │     scenario_id = scenario.id       │← Always Outlook scenario ID
                  │     (packId might be correct but    │
                  │     scenario_id is always Outlook)  │   (Bug #3)
                  └──────────┬──────────────────────────┘
                             │
                             ▼
                  ┌─────────────────────────────────────┐
                  │  Token route (GET assessment)       │
                  │  (assessment/[token]/route.ts)      │
                  │                                     │
                  │  4. ticketData built from scenario  │← Sarah Thompson / Outlook
                  │     THEN overridden from pack IF    │   (Bug #4: pack fallback
                  │     assessment_pack_id is truthy    │    is correct here but
                  │     OR falls back to 'pack-outlook- │    scenario data is used
                  │     sim-v2' if null                 │    if pack is null)
                  │                                     │
                  │  5. remoteDesktop block:            │
                  │     packId = assessment_pack_id     │
                  │     || 'pack-outlook-sim-v2'        │← SILENT FALLBACK (Bug #5)
                  └──────────┬──────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
  ┌─────────────────┐ ┌──────────┐ ┌──────────────┐
  │ GET /sim/route  │ │POST msg  │ │POST sim/     │
  │ (sim/route.ts)  │ │route     │ │action/route  │
  │                 │ │(line 70) │ │(line 40)     │
  │ packId =        │ │          │ │              │
  │ assessment_     │ │ packId = │ │ pack =       │
  │ pack_id         │ │ assess-  │ │ getPackById  │
  │ || 'pack-       │ │ ment_    │ │ (packId ||   │
  │ outlook-sim-v2' │ │ pack_id  │ │ 'pack-outlook│
  │                 │ │ || 'pack-│ │ -sim-v2')    │
  │   (Bug #5)      │ │ outlook- │ │   (Bug #5)   │
  │                 │ │ sim-v2'  │ │              │
  └─────────────────┘ └──────────┘ └──────────────┘
```

---

## Bug #1 — `getActiveScenario()` always returns the Outlook scenario

**File:** `lib/mvp/query.ts:133-137`
```typescript
export function getActiveScenario(): ScenarioRow | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM scenarios WHERE active = 1 LIMIT 1').get();
  return row || null;
}
```

**Problem:** No `ORDER BY`, no pack-awareness. Every seeded scenario has `active = 1` (Outlook is first). This always returns `scenario-outlook-001` regardless of which pack the assessment uses.

**DB seed order** (in `db.ts`):
1. `scenario-outlook-001` — active=1
2. `scenario-password-001` — active=1
3. `scenario-printer-001` — active=1
4. `scenario-wifi-001` — active=1

**Impact:** Every assessment creation stores `scenario_id = scenario-outlook-001` in its row.

---

## Bug #2 — First chat message is always the Outlook scenario's initial message

**File:** `app/api/mvp/assessments/route.ts:101-102`
```typescript
db.prepare(`INSERT INTO messages (id, session_id, role, content, created_at)
  VALUES (?, ?, 'caller', ?, datetime('now'))`).run(makeId(), sessionId, scenario.initial_message);
```

**Problem:** `scenario` is loaded from `getActiveScenario()` (Bug #1), so `scenario.initial_message` is always `"Hi, I'm having trouble with my Outlook — it's not sending emails..."` even for password-reset packs.

**The pack's `customer.openingLine`** (e.g. `"Hi, I think my account is locked..."`) is never used as the first message.

---

## Bug #3 — `scenario_id` on the assessments table is always the Outlook scenario

**File:** `app/api/mvp/assessments/route.ts:91-96`
```typescript
db.prepare(`INSERT INTO assessments
  (id, ..., scenario_id, ..., assessment_pack_id, ...)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(
  assessmentId, ..., scenario.id, ..., packId, ...
);
```

**Problem:** Always stores `scenario.id` (= `scenario-outlook-001`) as the `scenario_id` regardless of pack. This pollutes every downstream query that reads `scenario_id` from the assessments table.

---

## Bug #4 — Ticket data uses scenario data as fallback before pack override

**File:** `app/api/mvp/assessment/[token]/route.ts:38-60`
```typescript
let ticketData = {
  requester_name: full.scenario?.caller_persona?.split(',')[0]?.trim() || 'Customer',
  // ^ "Sarah Thompson" (Outlook)
  description: full.messages?.[0]?.content || 'No description available',
  // ^ Outlook initial message
};

/* Try to get richer ticket data from pack */
if (packId) {
  const pack = getPackById(packId);
  ticketData.requester_name = pack.customer.name;  // correct override
  ticketData.company = pack.customer.company;       // correct override
}
```

**Problem:** If `assessment_pack_id` is nullish (see Bug #6), the pack block is skipped entirely and the ticket retains Outlook data. Even when it works, `description` falls back to `full.messages[0].content` which is the Outlook initial message (Bug #2), and is never overridden by `pack.customer.openingLine`.

---

## Bug #5 — Four API routes silently fall back to Outlook pack

**Every route that loads a sim pack has `|| 'pack-outlook-sim-v2'` as its fallback.** If `assessment_pack_id` is null/undefined/empty, the route silently loads Outlook instead of erroring.

| # | File | Line | Code |
|---|---|---|---|
| 5a | `app/api/mvp/assessment/[token]/route.ts` | 90 | `const packId = (full.assessment as any).assessment_pack_id \|\| 'pack-outlook-sim-v2'` |
| 5b | `app/api/mvp/assessment/[token]/sim/route.ts` | 20 | `const packId = (full.assessment as any).assessment_pack_id \|\| 'pack-outlook-sim-v2'` |
| 5c | `app/api/mvp/assessment/[token]/message/route.ts` | 70 | `const packId = (assessment as any).assessment_pack_id \|\| 'pack-outlook-sim-v2'` |
| 5d | `app/api/mvp/assessment/[token]/sim/action/route.ts` | 40 | `const pack = getPackById(packId \|\| 'pack-outlook-sim-v2')` |

**Impact:** If `assessment_pack_id` is null (empty string, undefined, etc.), ALL of these routes silently serve the Outlook pack — its caller persona (Sarah Thompson), its tools (outlook, browser, cmd), its sim state, and its AI caller behavior.

---

## Bug #6 — Assessment creation silently coerces any non-listed pack to Outlook

**File:** `app/api/mvp/assessments/route.ts:62-63`
```typescript
const preferredPackId: string = body.assessmentPackId || body.assessment_pack_id || ENABLED_TRAINING_DRILL_PACKS[0];
const resolvedPackId: string = ENABLED_TRAINING_DRILL_PACKS.includes(preferredPackId) ? preferredPackId : ENABLED_TRAINING_DRILL_PACKS[0];
```

**File:** `lib/mvp/assignment-types.ts:69-74`
```typescript
export const ENABLED_TRAINING_DRILL_PACKS = [
  'pack-outlook-sim-v2',       // index 0 — DEFAULT
  'pack-password-reset-v1',
  'pack-new-starter-v1',
  'pack-shared-mailbox-v1',
];
```

**Problem:** If the frontend doesn't send `assessmentPackId`, or sends a value not in `ENABLED_TRAINING_DRILL_PACKS`, the pack silently coerces to `pack-outlook-sim-v2` at index 0.

---

## Bug Trace: What Happens With a Correctly-Created Password-Reset Assessment

Even when the assessment is created with `assessment_pack_id = 'pack-password-reset-v1'`:

1. **First message** is still the Outlook initial message (Bug #2)
2. **Ticket description** in the UI shows the Outlook initial message (Bug #4: `full.messages[0].content`)
3. **`scenario_id`** in the DB is still `scenario-outlook-001`
4. **AI caller prompt** is built from the password-reset pack correctly (since `hasRemoteTools` is true for `dashboard_sim` mode, and `buildAiCustomerContext` is pack-aware)
5. **Sim state/tools/actions** are correctly loaded from password-reset pack (since `assessment_pack_id` is truthy, no fallback fires)
6. **But the chat history starts with "Hi, I'm having trouble with my Outlook"** — so the candidate sees an Outlook message first

---

## Same-Class Bugs Found (Similar Patterns)

### Pattern: Hardcoded scenario data in legacy path

**File:** `app/api/mvp/assessment/[token]/message/route.ts:88-99`
```typescript
/* Legacy chat_call mode — use scenario-based prompt */
systemMessage = `${callerPrompt}
...
Critical rules:
...
- Stay in character: frustrated accountant Sarah Thompson from Alder & Co
- Keep responses concise (1-3 sentences)
- Never break character or mention that you are an AI`;
```

The names "Sarah Thompson from Alder & Co" are hardcoded into the fallback prompt. This is only hit for `hiring_exam` (chat_call) assessments, but if `assessment_mode` is not `dashboard_sim`, this hardcoded Outlook persona is used regardless of any pack data.

### Pattern: `assessment_pack_id` columns may not be updated in DB schema

**File:** `lib/mvp/db.ts` — The `assessments` table schema (lines 40-51):
```sql
CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  candidate_name TEXT NOT NULL,
  ...
  scenario_id TEXT,
  criteria_version_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
);
```

The `assessments` table schema doesn't explicitly declare `assessment_pack_id`, `assessment_mode`, or `assignment_type` — they were added as dynamic columns via later `ALTER TABLE` migrations (in the `MVP_MIGRATIONS` array further down). If the migration hasn't run, those columns are missing and return `undefined`, triggering all the `|| 'pack-outlook-sim-v2'` fallbacks.

### Pattern: `sim/action/route.ts` line 26 allows remote actions for `call_only` packs

**File:** `app/api/mvp/assessment/[token]/sim/action/route.ts:24-28`
```typescript
const assignmentType = (full.assessment as any).assignment_type || 'hiring_exam';
const capabilities = getCapabilitiesForType(assignmentType);
if (!capabilities?.remoteDesktop && (full.assessment as any).assessment_mode !== 'dashboard_sim') {
  return NextResponse.json({ error: '...' }, { status: 400 });
}
```

The condition allows remote actions if `assessment_mode === 'dashboard_sim'`, even when the pack has `mode: 'call_only'`. The pack mode only adjusts `capabilities.remoteDesktop = false` in the main token route, but the action route gate only checks the DB field, not the pack mode. A frontend that sends action requests directly could attempt remote actions on a `call_only` pack.

---

## Structural Analysis: Why This Pattern Exists

The root structural issue is that the codebase has **two parallel data models** that are not unified:

| System | Source of Truth | Used By |
|---|---|---|
| **Scenarios** (DB table) | `scenarios` table, seeded via `db.ts` | Old chat_call assessments, initial message, ticketData fallback |
| **Packs** (code-level) | `lib/mvp/sim/packs/*.ts`, loaded via `getPackById()` | Sim state, actions, scoring, tools, AI caller |

The two systems coexist but don't cross-reference. Scenarios are DB-seeded with non-pack-aware content, while packs are code-defined with full pack-specific content. **The assessment creation always links to both** — a scenario (always Outlook) and a pack (the selected one). But downstream consumers read from whatever is easiest: the scenario for ticketData, the pack for sim state.

**The fundamental fix required:**
1. Remove the `scenario` dependency from sim assessments entirely — when a pack is selected, the pack should be the sole source of truth for customer persona, opening line, hidden facts, etc.
2. Remove all `|| 'pack-outlook-sim-v2'` fallbacks — if `assessment_pack_id` is null, the route should either error (for sim packs) or use the legacy scenario fallback (for chat_call packs), not silently load a different pack.
3. The first message should come from `pack.customer.openingLine`, not `scenario.initial_message`, when a pack is selected.

---

## Consolidation Table (All Bug Locations)

| # | File | Line | Issue | Severity |
|---|---|---|---|---|
| 1 | `lib/mvp/query.ts` | 133-137 | `getActiveScenario()` always returns Outlook (all scenarios `active=1`, no ORDER BY) | **High** |
| 2 | `app/api/mvp/assessments/route.ts` | 102 | First message is always `scenario.initial_message` (Outlook), never `pack.customer.openingLine` | **High** |
| 3 | `app/api/mvp/assessments/route.ts` | 91-96 | `scenario_id` always set to Outlook scenario ID, regardless of pack | **Medium** |
| 4 | `app/api/mvp/assessment/[token]/route.ts` | 38-60 | Ticket data uses scenario as fallback, `description` never overridden by `pack.customer.openingLine` | **Medium** |
| 5a | `app/api/mvp/assessment/[token]/route.ts` | 90 | `assessment_pack_id \|\| 'pack-outlook-sim-v2'` | **Critical** |
| 5b | `app/api/mvp/assessment/[token]/sim/route.ts` | 20 | `assessment_pack_id \|\| 'pack-outlook-sim-v2'` | **Critical** |
| 5c | `app/api/mvp/assessment/[token]/message/route.ts` | 70 | `assessment_pack_id \|\| 'pack-outlook-sim-v2'` | **Critical** |
| 5d | `app/api/mvp/assessment/[token]/sim/action/route.ts` | 40 | `packId \|\| 'pack-outlook-sim-v2'` | **Critical** |
| 6 | `app/api/mvp/assessments/route.ts` | 62-63 | Non-listed packs silently coerce to Outlook | **Medium** |
| — | `app/api/mvp/assessment/[token]/message/route.ts` | 98 | Hardcoded "Sarah Thompson from Alder & Co" in legacy prompt | **Low** |
| — | `app/api/mvp/assessment/[token]/sim/action/route.ts` | 26 | Gate allows remote actions for `call_only` packs (checks `assessment_mode` not pack mode) | **Medium** |
