# Control — Making Callum the Command Interface

> How Callum goes from answering questions to commanding the entire platform.
> Spec for the tool-calling, LLM-routing, action-confirmation layer.

---

## 1. The Problem

Right now Callum can:
- Navigate (heuristic regex → router.push)
- Explain assessments (heuristic text builder)
- Suggest training (capability → proposal)
- Answer general questions (deepseek-v4-flash)

Callum cannot:
- Modify anything (standards, assessments, settings)
- Run multi-step workflows
- Show its reasoning or tool calls
- Let the user confirm/cancel actions in-flight
- Be extended with new tools without editing the graph

The goal: **Callum becomes a read-write agent that can fully operate the platform through conversation.**

---

## 2. Architecture: Tool-Calling LLM inside LangGraph

```
User says: "Create a hiring assessment for Sarah and send her the link"

  ┌──────────────────────────────────────────────┐
  │  LangGraph Callum Graph                      │
  │                                              │
  │  1. validateContext  ─── always             │
  │  2. loadProfile      ─── always             │
  │  3. loadThread       ─── always             │
  │  4. classifyIntent   ─── LLM router         │ ← REPLACE heuristic with LLM
  │  5. selectTool       ─── LLM picks tool    │ ← NEW
  │  6. validateInput    ─── schema check       │ ← NEW (Zod-like)
  │  7. confirmAction    ─── if destructive     │ ← NEW (proposal or inline)
  │  8. executeTool      ─── run handler        │ ← NEW (tool registry)
  │  9. observeResult    ─── format response    │ ← NEW (tool output → message)
  │  10. produceResponse ─── always             │
  │  11. persistThread   ─── always             │
  └──────────────────────────────────────────────┘
```

### Key change: `classifyIntent` becomes an LLM call

Instead of:
```typescript
function classifyIntent(message: string): CallumIntent {
  if (message.includes('show')) return 'navigate';
  if (message.includes('training')) return 'suggest_next_training';
  // ...
}
```

It becomes:
```typescript
async function llmClassifyIntent(message: string, tools: ToolDef[]): Promise<{ tool: string; args: any }> {
  // Call deepseek with:
  //  - Available tool definitions (with descriptions + input schemas)
  //  - The user's message
  //  - Return: { tool: "create_assessment", args: { candidateName: "Sarah", type: "hiring_exam" } }
}
```

This is **function calling** / **tool use** — the LLM natively decides which tool to call and with what arguments.

---

## 3. Tool Definition Contract

Every tool Callum can use follows this shape:

```typescript
interface ToolDef<Args = any, Result = any> {
  /** Unique name used by the LLM to identify this tool */
  name: string;

  /** LLM-facing description of what this tool does. Crucial for correct routing. */
  description: string;

  /** Which domain this tool belongs to (for grouping/audit) */
  domain: 'navigation' | 'assessment' | 'standards' | 'admin';

  /** Whether this tool changes data (requires confirmation) or just reads */
  access: 'read' | 'write';

  /** Schema for the arguments the LLM must provide */
  inputSchema: Record<string, FieldSchema>;

  /** The actual implementation */
  handler: (args: Args, ctx: ToolContext) => Promise<Result>;
}
```

### ToolContext (what every handler receives)

```typescript
interface ToolContext {
  managerProfileId: string;
  threadId: string;
  pageContext: CallumPageContext | null;
  signal?: AbortSignal;
}
```

---

## 4. Initial Tool Registry

### Navigation Tools

| Tool | Description | Access | Input |
|------|------------|--------|-------|
| `navigate` | Navigate to a page in the platform | read | `page: "dashboard" \| "assessments" \| "standards" \| "taxonomy" \| "system"` |
| `search_assessments` | Search/filter assessments by status, name, type | read | `query?: string, status?: string, type?: string` |

### Read Tools

| Tool | Description | Access | Input |
|------|------------|--------|-------|
| `get_assessment_context` | Load full review context for an assessment | read | `assessmentId: string` |
| `list_assessments` | List all assessments with status and scores | read | `limit?: number` |
| `get_standards` | Get current manager standards configuration | read | `—` |
| `get_system_status` | Get platform system health | read | `—` |
| `get_assessment_results` | Get scores, compliance, and analysis for an assessment | read | `assessmentId: string` |

### Write Tools (require confirmation)

| Tool | Description | Access | Input |
|------|------------|--------|-------|
| `create_assessment` | Create a new assessment for a candidate | write | `candidateName: string, type: "hiring" \| "training", packId?: string` |
| `create_training_proposal` | Suggest a training drill based on assessment results | write | `assessmentId: string, packId: string` |
| `update_standards` | Update assessment standards configuration | write | `standards: {...}` |
| `delete_assessment` | Remove an assessment from the system | write | `assessmentId: string` |

---

## 5. Action Confirmation Flow

For write tools, the graph must pause and ask the user to confirm:

```
User: "Create a hiring assessment for Sarah"

  → LLM selects create_assessment tool
  → Graph runs validateInput → succeeds
  → Graph reaches confirmAction node
  → confirmAction checks: tool.access === 'write'
  → Graph returns { type: 'proposed_action', tool: 'create_assessment', args: {...}, pendingActionId: '...' }
  → User sees: "Create a hiring assessment for Sarah Thompson? [Confirm] [Cancel]"
  → User clicks Confirm
  → Graph runs executeTool → handler runs → assessment created
  → Graph returns { type: 'answer', message: 'Assessment created. Link: ...' }
```

This already maps to the existing proposal system:
- `pendingActionId` maps to `callum_proposals.id`
- Confirm endpoint: `POST /api/mvp/callum/proposals/[id]/confirm`
- The proposal stores the tool name + serialized args

**But**: The current proposal system only supports `create_training_assignment`. The payload schema and confirmation handler need to be tool-generic.

### Generic Proposal Payload

```typescript
interface ToolProposalPayload {
  tool: string;           // e.g., "create_assessment"
  args: Record<string, unknown>;  // the arguments
  description: string;    // Human-readable summary for the confirmation card
}
```

The confirm handler becomes:
```typescript
async function confirmToolProposal(proposalId: string): Promise<Result> {
  const proposal = getProposal(proposalId);
  const { tool, args } = proposal.payload as ToolProposalPayload;
  const toolDef = getTool(tool);
  return toolDef.handler(args, ctx);
}
```

---

## 6. LLM Router Implementation

The current `classifyIntent` in `lib/mvp/langgraph/nodes/classifyIntent.ts` uses regex:

```typescript
function heuristicClassify(message: string): CallumIntent {
  const m = message.toLowerCase();
  if (/\b(open|show|go to|navigate)\b/.test(m)) return 'navigate';
  if (/\b(assign|training|drill)\b/.test(m)) return 'suggest_next_training';
  // ...
}
```

**Replace with:**

```typescript
async function llmClassifyIntent(message: string): Promise<{
  tool: string;
  args: Record<string, unknown>;
}> {
  const tools = listToolDefs(); // gets all registered tool definitions

  const prompt = `You are Callum, an AI assistant for a service desk training platform.

Available tools:
${tools.map(t => `- ${t.name}: ${t.description}
  Input: ${JSON.stringify(t.inputSchema)}`).join('\n')}

Based on the user's message, select the most appropriate tool and provide the arguments.
If no tool fits, respond with { tool: "general_chat", args: { message: "...explanation..." } }

User message: "${message}"

Respond with JSON: { tool: string, args: object }`;

  const result = await runAiTask('callum', {
    messages: [{ role: 'system', content: prompt }],
    temperature: 0.1,
    maxTokens: 512,
    responseFormat: 'json_object',
  });

  return JSON.parse(result.content);
}
```

The result feeds into `selectTool` node which looks up the tool def, validates args against inputSchema, and routes to execute or confirm.

---

## 7. Graph Node Changes

### New nodes needed:

| Node | What it does |
|------|-------------|
| `llmClassifyIntent` | Calls deepseek with tool defs + user message → returns `{ tool, args }` |
| `validateToolInput` | Validates args against the tool's inputSchema. Returns errors if invalid. |
| `confirmAction` | If tool.access === 'write', creates proposal, returns `proposed_action` response. If read, returns empty. |
| `executeTool` | Runs `tool.handler(args, ctx)`. Returns `{ ok, output, error }`. |
| `formatToolResult` | Converts tool output into a human-readable message. |

### Modified nodes:

| Node | Change |
|------|--------|
| `classifyIntent` | Keep as fallback. If LLM call fails, use heuristic. |
| `loadAssessmentContext` | Keep for read tools. Write tools don't need it. |
| `invokeCapabilityNode` | Rename/merge into `executeTool`. Capabilities become tool handlers. |
| `produceResponse` | Now handles tool output formatting + error formatting. |

---

## 8. Directory Structure

```
lib/mvp/
  langgraph/
    graph.ts              ← StateGraph class (unchanged)
    state.ts              ← GraphState type (extend with tool fields)
    callumGraph.ts        ← Wire new nodes
    nodes/
      validateContext.ts  ← unchanged
      loadProfile.ts      ← unchanged
      loadThread.ts       ← unchanged
      classifyIntent.ts   ← add LLM routing
      selectTool.ts       ← NEW: look up tool def, validate args
      confirmAction.ts    ← NEW: proposal for write tools
      executeTool.ts      ← NEW: run tool handler
      formatResult.ts     ← NEW: tool output → message
      produceResponse.ts  ← simplified (tool output already formatted)
      persistThread.ts    ← unchanged

  tools/                    ← NEW: tool registry
    registry.ts             ← registerTool, getTool, listTools
    definitions/
      navigation.ts         ← navigate, search_assessments
      assessments.ts        ← create_assessment, get_assessment_context, list_assessments
      standards.ts          ← get_standards, update_standards
      admin.ts              ← get_system_status, delete_assessment
```

---

## 9. GraphState Extensions

```typescript
interface GraphState {
  // Existing fields...
  pageContext, message, threadId, managerProfileId,
  thread, assessmentContext, intent, errors,

  // New tool-calling fields
  selectedTool: string | null;           // tool name selected by LLM
  toolArgs: Record<string, unknown> | null;  // args from LLM
  toolValidation: { valid: boolean; errors: string[] } | null;
  toolResult: { ok: boolean; output?: unknown; error?: string } | null;
  requiresConfirmation: boolean;
  pendingProposalId: string | null;      // set by confirmAction node
}
```

---

## 10. Implementation Order

| Step | What | Risk | Dependencies |
|------|------|------|-------------|
| 1 | Create `lib/mvp/tools/` with `registry.ts` and 3 tool definitions (navigate, list_assessments, get_assessment_context) | Low | None — additive |
| 2 | Add `llmClassifyIntent` node that calls deepseek with tool defs | Low | Step 1 |
| 3 | Add `selectTool` + `validateToolInput` nodes | Low | Step 1 |
| 4 | Add `executeTool` node (wraps existing capabilities) | Low | Step 1 |
| 5 | Add `confirmAction` node (wraps existing proposal system) | Low | Existing proposal.ts |
| 6 | Add tool-generic proposal payload + confirmation handler | Medium | Step 5 |
| 7 | Wire all new nodes into `callumGraph.ts` | Low | Steps 2-6 |
| 8 | Replace heuristic `classifyIntent` with LLM route (keep fallback) | Low | Step 2 |
| 9 | Add write tools (create_assessment, update_standards) | Medium | Step 6 |
| 10 | Parallel test: v1 heuristic vs v2 LLM routing for same inputs | Medium | Step 8 |
| 11 | Remove heuristic classifyIntent after v2 proven | Low | Step 10 |

---

## 11. Key Design Decisions

1. **Tools wrap capabilities, not replace them** — The existing capability registry (`lib/mvp/capabilities/`) stays. Tool handlers call `invokeCapability()` internally. This keeps the contract system intact.

2. **LLM routing has a heuristic fallback** — If the deepseek call fails or returns invalid JSON, fall back to the existing regex-based `classifyIntent`. The system degrades gracefully.

3. **Proposal system becomes tool-generic** — Instead of `create_training_assignment`, any write tool can create a proposal. The confirmation handler reads the tool name from the proposal payload and dispatches to the right tool.

4. **No autonomous execution** — The LLM never executes write tools without confirmation. Read tools execute immediately. This is enforced by the graph topology (confirmAction node sits between validateInput and executeTool).

5. **Input schemas use the existing `FieldSchema` from `lib/mvp/schema/tool.ts`** — No new schema system needed. The lightweight schema validator (`validateObject`) already exists.

---

---

## 12. Self-Modification: Callum Changing Itself

The user should be able to say "be more direct" or "speak casually" and Callum updates its own behavior.

### How it works

There's already a `manager_callum_profiles` table in the DB:

```sql
CREATE TABLE manager_callum_profiles (
  id TEXT PRIMARY KEY,
  manager_profile_id TEXT NOT NULL,
  assistant_name TEXT NOT NULL DEFAULT 'Callum',
  tone TEXT NOT NULL DEFAULT 'direct',
  humour_level TEXT NOT NULL DEFAULT 'low',
  formality TEXT NOT NULL DEFAULT 'professional',
  response_length TEXT NOT NULL DEFAULT 'concise',
  custom_instructions TEXT
);
```

Add a tool:

```typescript
{
  name: 'update_callum_profile',
  description: 'Change how Callum behaves — tone, formality, humour, directness, or set custom instructions.',
  access: 'write',
  inputSchema: {
    tone: { type: 'string', description: 'direct | friendly | empathetic | professional', optional: true },
    humour_level: { type: 'string', description: 'none | low | medium | high', optional: true },
    formality: { type: 'string', description: 'casual | professional | formal', optional: true },
    response_length: { type: 'string', description: 'concise | balanced | detailed', optional: true },
    custom_instructions: { type: 'string', description: 'Free-form instructions for how Callum should behave', optional: true },
  },
  handler: async (args, ctx) => {
    updateManagerProfile(ctx.managerProfileId, args);
    return { ok: true, message: 'Profile updated.' };
  }
}
```

The system prompt injected into every LLM call reads from this profile:

```
You are Callum, an AI assistant. Your tone is {tone}, humour level is {humour_level},
formality is {formality}, and responses should be {response_length}.
{custom_instructions}
```

### Conversation flow:

> **User:** "Stop being so formal, just talk to me like a human."
> **Callum (LLM):** "I'll update my profile to be more casual." → calls `update_callum_profile({ tone: 'friendly', formality: 'casual' })`
> **Callum responds:** "Got it. From now on I'll keep it casual. What's up?"

---

## 13. Memory: Callum Remembers

Callum needs two memory layers:

### Layer 1: Conversation History (already exists)
- `callum_messages` table stores every message per thread
- Frontend stores last ~50 messages in localStorage
- Survives page refreshes

### Layer 2: Long-Term Fact Memory (proposed)
Add a `callum_memory` table:

```sql
CREATE TABLE callum_memory (
  id TEXT PRIMARY KEY,
  manager_profile_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(manager_profile_id, key)
);
```

Add tools:

```typescript
{
  name: 'remember',
  description: 'Store a fact about the user or a preference for future reference.',
  access: 'write',
  inputSchema: {
    key: { type: 'string', description: 'A short identifier for the fact (e.g. user_preferred_name, last_topic)' },
    value: { type: 'string', description: 'The fact to remember' },
  },
  handler: async (args, ctx) => {
    upsertMemory(ctx.managerProfileId, args.key, args.value);
    return { ok: true };
  }
}

{
  name: 'recall',
  description: 'Retrieve a stored fact from memory.',
  access: 'read',
  inputSchema: {
    key: { type: 'string', description: 'The fact identifier to look up' },
  },
  handler: async (args, ctx) => {
    const value = getMemory(ctx.managerProfileId, args.key);
    return { ok: true, value };
  }
}

{
  name: 'forget',
  description: 'Remove a stored fact from memory.',
  access: 'write',
  inputSchema: {
    key: { type: 'string', description: 'The fact identifier to forget' },
  },
  handler: async (args, ctx) => {
    deleteMemory(ctx.managerProfileId, args.key);
    return { ok: true };
  }
}
```

### How memory feeds into the system prompt

Before every LLM call, the graph loads all memory entries for the current manager:

```
Your name is {name}. {tone_settings}
You know the following facts about this user:
- They prefer to be called "Alex"
- The last topic was "creating a phishing simulation pack"
- They are left-handed (just kidding)

{custom_instructions}
```

This gives Callum persistent identity and knowledge across sessions.

---

## 14. Theme & Visual Control

The user should be able to say "make the site blue" or "switch to light mode" and Callum does it.

### Implementation

Define CSS custom properties on `:root`:

```css
:root {
  --bg-primary: #0d0d0f;
  --bg-secondary: #18181b;
  --text-primary: #e4e4e7;
  --accent: #004b8d;
  /* ... */
}
```

Add a tool:

```typescript
{
  name: 'set_theme',
  description: 'Change the visual theme of the platform — colors, dark/light mode, accent.',
  access: 'write',
  inputSchema: {
    mode: { type: 'string', description: 'dark | light', optional: true },
    accent_color: { type: 'string', description: 'Primary accent color (hex, e.g. #004b8d)', optional: true },
    theme_preset: { type: 'string', description: 'default | ocean | forest | midnight | sunset', optional: true },
  },
  handler: async (args, ctx) => {
    applyTheme(args); // sets CSS custom properties on document.documentElement
    return { ok: true, message: `Theme updated: ${args.theme_preset || 'custom'}` };
  }
}
```

The theme is persisted in a `manager_preferences` table (or the existing `manager_callum_profiles`).

---

## 15. MCP (Model Context Protocol) — Future Exploration

> "Nothing that connects externally due to security concerns" — internal MCPs only.

### What is MCP?

MCP is an open protocol (by Anthropic) that lets LLMs connect to tools and data sources through a standardized server interface. Think of it as "USB-C for AI" — one protocol, many tools.

### Promising Internal MCPs

| MCP Server | What it does | Why useful | Security |
|-----------|-------------|-----------|----------|
| **SQLite MCP** | Lets the LLM run SQL queries directly against a database | Callum can query anything — "show me all assessments that scored below 50" becomes a SQL query | ✅ Local only, no external calls |
| **Filesystem MCP** | Read/write files in allowed directories | Callum could read pack definitions, write exports, manage recordings | ✅ Local only, path-restricted |
| **Memory MCP** | Persistent key-value memory (like §13 but as MCP) | Structured memory with the MCP protocol | ✅ Local only |
| **Puppeteer MCP** | Headless browser control | Callum could test the UI, take screenshots, verify flows | ⚠️ Local only but powerful — restrict carefully |

### What to avoid

| MCP Server | Why avoid |
|-----------|-----------|
| **Web search / Brave / Tavily** | External API calls — security concern |
| **GitHub / GitLab** | External — could leak credentials |
| **Slack / Discord** | External communication |
| **Email** | External |
| **APIs that require network access** | Data could leave the server |

### Future architecture with MCP

```
Callum (LangGraph)
  │
  ├── Built-in tools (platform control)
  │     ├── navigate, create_assessment, update_profile
  │     ├── remember, recall, forget
  │     └── set_theme, get_system_status
  │
  └── MCP servers (pluggable, internal only)
        ├── SQLite MCP → direct DB queries
        ├── Filesystem MCP → read pack files, export results
        └── Memory MCP → structured persistent memory
```

MCP servers run as child processes. Callum discovers available tools by querying the MCP server's tool list at startup. No external network access is needed.

---

## 16. Summary: What Callum Becomes

```
╔══════════════════════════════════════════════════════╗
║                    CALLUM                            ║
║                                                      ║
║  ┌─────────────┐  ┌──────────┐  ┌────────────────┐  ║
║  │ Personality  │  │ Memory   │  │ Tools          │  ║
║  │ • tone       │  │ • facts  │  │ • platform     │  ║
║  │ • formality  │  │ • prefs  │  │ • data         │  ║
║  │ • humour     │  │ • history│  │ • self-modify  │  ║
║  │ • custom     │  │          │  │ • MCP plugins  │  ║
║  └─────────────┘  └──────────┘  └────────────────┘  ║
║                                                      ║
║  User: "Be more direct and remember I prefer         ║
║         dark themes with blue accent"                ║
║                                                      ║
║  Callum: ✅ Profile updated to "direct"              ║
║           ✅ Remembered "prefers dark theme"          ║
║           ✅ Theme set to midnight + blue accent      ║
╚══════════════════════════════════════════════════════╝
```

---

## 17. Current Gaps Before This Works

| Gap | Status | Needed for |
|-----|--------|------------|
| Tool registry | ❌ Not built | Tool layer |
| LLM classifyIntent (replaces heuristic) | ❌ Not built | Tool routing |
| selectTool + validateInput + executeTool nodes | ❌ Not built | Graph nodes |
| Generic proposal payload for any write tool | ❌ Not built | Confirmation |
| Self-modification: profile update tool | 🔧 Partially — DB table exists, no tool | Personality control |
| Memory: `callum_memory` table + remember/recall/forget tools | ❌ Not built | Long-term memory |
| Theme: `set_theme` tool + CSS variable wiring | ❌ Not built | Visual control |
| MCP server runner | ❌ Not built | Extensibility |

**What's already in place:**
- LangGraph graph with 8 nodes ✅
- Capability registry with 4 capabilities ✅
- Proposal system with atomic confirmation ✅
- `manager_callum_profiles` table with tone/humour fields ✅
- Lightweight schema validation in `lib/mvp/schema/tool.ts` ✅
- v2 route running in parallel with v1 ✅
- 248 tests passing ✅
