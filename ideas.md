# Ideas — Platform Restructuring

> Brainstorming how to reorganise the platform around the chat-centric, conversational paradigm.
> Generated 2026-06-28 after UX reorientation: sidebar → floating bubbles → gone entirely. Chat is the interface.

---

## 1. Core Insight: Chat Is the Shell

The old model: sidebar nav → page → content. User clicks links, pages load.

The new model: **Chat is the shell**. The user talks to Callum. Callum navigates, summarizes, suggests actions. The page content is secondary — it's the result of a conversation.

This means:
- The chat bar at the bottom is the primary interface — always visible, always ready
- Navigation icons above the chat are shortcuts, not the main way to move around
- The main content area shows whatever Callum navigated to or suggested
- When you land on a page, Callum should proactively greet you with context

## 2. The Dashboard as a "Newsfeed"

The dashboard should feel like opening an app to a smart feed:

- **Top**: Stats cards (total, pending, completed, hiring/training split) — real data
- **Left column**: Recent assessments list (clickable, shows status badges)
- **Right column**: Activity feed + Callum suggestions
- **Callum suggestion chips** on the dashboard that trigger chat messages

The dashboard should be the default landing, and Callum should greet with something like:
> "Good morning. You have 3 pending assessments. Sarah Thompson's result is ready for review. Want me to walk through it?"

## 3. Assessment Review → Conversational

Currently, the assessment review page (`/mvp/assessments/[id]`) is a traditional page with tabs/panels. It should feel like:

- Callum opens with a summary: "Sarah scored 72/100 — Needs Supervision. Here are the key misses: [list]. Want me to suggest training?"
- The page content (scores, transcript, compliance) is still visible but secondary
- Callum drives the interaction: explain, compare, suggest, drill down
- The page sections are collapsible panels you can show/hide via chat

## 4. Navigation Reimagined

Navigation should feel like moving through a conversation:

| User says | Callum does | Content shows |
|-----------|------------|---------------|
| "Show me assessments" | Navigates to `/mvp/assessments` + summarizes | Assessment list |
| "Review Sarah" | Navigates to `/mvp/assessments/{id}` + explains score | Assessment review |
| "Create a hiring test" | Pre-fills creation form | Assessment creation |
| "What standards are set?" | Opens standards + reads current values | Standards page |
| "Any updates?" | Checks recent activity + reports | Dashboard with highlights |

The nav icons above the chat are accelerators — they jump you to a page, but Callum greets you there.

## 5. Callum as a Proactive Agent

Not reactive (wait for input) but proactive:

- **On page load**: Callum reads the page context and offers a relevant suggestion
- **On assessment completion**: Callum proactively tells the manager the result is ready
- **On standards change**: Callum notifies managers of the impact
- **On repeated failures**: Callum suggests creating a focus drill

This requires:
- WebSocket or polling for real-time updates
- A notification system in the chat (system messages)
- Callum initiating conversations, not just responding

## 6. The Content Paradox

If chat is the primary interface, what happens to the page content?

Options:
1. **Split view**: Chat at bottom, content above. Current approach.
2. **Chat-native content**: Content renders INSIDE the chat as rich cards/messages. The page is just a shell around the chat.
3. **Immersive mode**: Chat takes full screen for conversation. Content appears in a slide-over panel.

**Recommendation**: Start with option 1 (current). Evolve toward option 2 for key flows (assessment review, creation). Keep option 3 for deep-dive analysis.

## 7. Ideas for Rich Chat Messages

Callum's responses should be more than plain text:

- **Score cards**: Inline mini-scorecard showing overall score + key misses
- **Assessment cards**: Clickable cards showing candidate name, status, score
- **Action buttons**: "Review Sarah" → button that navigates. "Create drill" → confirm button
- **Progress bars**: Visual breakdown of criteria categories
- **Timeline**: Expandable transcript timeline within the chat

The `/api/mvp/callum/v2` response already supports `type: 'proposed_action'` with a `pendingActionId`. Extend this to support rich card types.

## 8. The Template + Pack Problem

Currently templates (UI layout + scoring scope) and packs (customer scenario) are two separate concepts:

```
Template defines: What UI elements are visible, what gets scored
Pack defines: Who the customer is, what the issue is
```

For hiring, you select:
1. A template (difficulty: basic/intermediate/advanced/expert)
2. A pack (customer scenario: Outlook, VPN, Printer, Phishing)

Callum should handle this selection conversationally:
> "Let's create a hiring assessment. What difficulty? I'd recommend Basic for screening."
> → User: "Intermediate"
> → Callum: "Great. For the scenario, I have VPN connection issue or Printer troubleshooting. The VPN one tests triage skills better."

## 9. Multi-Model Routing

Not all questions need deepseek-v4-flash:
- **Navigation**: Instant, no AI needed (heuristic classifyIntent already handles this)
- **Assessment explanation**: Needs context + deepseek
- **General questions**: Can use a cheaper/faster model
- **Training suggestions**: Needs deepseek for reasoning

The LangGraph graph should route to the right model based on intent.

## 10. Scoring Scope Transparency

When viewing an assessment, the user should see:
- What mode was used (hiring vs training)
- Which elements were active (call only? call + triage? full desk?)
- Which criteria were scored (and which were excluded by mode)
- What template/pack was used

This already flows through `mode_config` → `assessment_scope` → `scoringScope`, but it's not surfaced in the UI. Add a "Scope" badge to the assessment review page showing active elements.

## 11. The Naming Problem

"Assessment" is generic. The three modes should feel distinct:

| Internal | User-facing | Vibe |
|----------|------------|------|
| `hiring_exam` | **Hiring Call** | Quick screening, one call + note |
| `training_drill` | **Training Drill** | Single-ticket practice with tools |
| `training_shift` | **Shift Sim** | Multi-ticket, timed, queue pressure |

The hiring templates should feel like levels:
- **Level 1** — Basic Call (just converse + write note)
- **Level 2** — Triage Call (+ prioritize, classify, SLA)
- **Level 3** — Tech Call (+ remote tools, detailed notes)
- **Level 4** — Full Screen (all elements, retry allowed)

---

## Summary: The Platform Should Feel Like

> You open the app. Callum greets you. You talk. Stuff happens.

Not:

> You open the app. You navigate a sidebar. You click links. You read pages.

The chat is the interface. Everything else is support.
