# Session Progress Log

> Running log of changes made during this session (2026-06-28).

---

## LangGraph Callum Graph
- Built zero-dependency `StateGraph` abstraction (`lib/mvp/langgraph/graph.ts`)
- 8 nodes: validateContext → loadProfile → loadThread → classifyIntent → loadAssessmentContext → invokeCapability → produceResponse → persistThread
- v2 route at `/api/mvp/callum/v2` (v1 unchanged as fallback)
- 14 tests, 248 total

## Tool Schema System
- Lightweight schema validation (`lib/mvp/schema/tool.ts`)
- `FieldSchema` + `validateObject()` + `describeSchema()`
- All 4 capabilities have `inputFields` + `description` for LLM discovery
- Tool registry (`lib/mvp/capabilities/tool-registry.ts`)

## Hiring Packs + Templates
- 4 hiring packs: outlook-basic, vpn-triage, printer-down, email-phishing
- 6 templates: 4 hiring progressive + 2 training
- Templates linked to packs via `templateId`
- `HiringWorkspace` with simplified call + notes layout

## Scoring Scope Filter
- `scoreExtraction()` accepts `enabledCriteria: Set<string>`
- Derived from `assessment_scope.enabledCategories`
- 3 tests

## Premium Callum Chat UI (reverted to sidebar)
- Callum moved to bottom of ITSM sidebar (`CallumSidebar`)
- Light theme restored (white bg, sidebar, boxy cards)
- Nav tabs back on left sidebar
- Voice Lab link added to sidebar

## Azure TTS Removed
- Stripped all Azure TTS code (362→54 lines)
- Kokoro/OpenRouter is the only provider
- Voice Lab with 13 Kokoro voices

## Low-Latency Voice Loop (reverted to push-to-talk)
- Client-side VAD built but user preferred push-to-talk button
- Phrase chunker, TTS queue, latency tracker still available
- Streaming LLM endpoint (`/message/stream`) with SSE

## Hiring Assessment Flow (current)
- **Briefing** phase — Callum coaching tips + Start Call button
- **Live Call** — Teams ringtone, push-to-talk mic (hold to speak), notes textarea for drafting
- **Note phase** — finalise notes + Submit for Review
- Logo in white circle in CallBar

## Callum Profile Management
- `update_callum_profile` capability (tone, humour, detail, feedback, custom instructions)
- Profile loaded into system prompt for every general question
- `manager_callum_profiles` table already existed

## Callum Response Fixes
- Strip `<thinking>` tags from AI responses
- Strip preamble before 'response:' or 'answer:'
- Low temperature (0.1) and short maxTokens (256) for faster replies

## Documentation
- `control.md` — spec for tool-calling LLM, action confirmation, platform control
- `ideas.md` — platform restructure brainstorm
- `threads.md` — updated with Threads 18-20
- `callumintegration.md` — second pass documented
- `changes2.md` — full implementation report
