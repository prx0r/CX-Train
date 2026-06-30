# Open Threads — CallCallum / CX-Train

> Everything you're juggling right now. Use this to decide what to focus on next.
> Last updated: 2026-06-28 (second pass — LangGraph, hiring packs, chat UI, scoring scope)

---

## Thread 1: Analysis Engine Hardening

**Status:** Active / In progress
**Files:** `lib/mvp/analysis/`, `lib/mvp/compliance/`, `lib/mvp/results/scoring-calculator.ts`

The core AI-evidence → deterministic-scoring pipeline. Most recent work was:
- 10 frameworks defined with pack-relevance filtering
- Three-state evidence validation (verified/invalidated/not_observed)
- FUNDAMENTAL_CRITERIA to prevent invalidating essential checks
- 5 test transcripts (T1-T5) running through Pipeline A

**Left open:**
- Evidence quote quality is poor (~30% of criteria have quotes, target >80%)
- Validated/raw gap is ~40-50%, target <30%
- maxTokens (8192) is too low for 56 criteria with quotes — need 16384
- event_check criteria need real event data wired in (submitted_ticket currently shows not_observed)
- CRITERION_DESCRIPTIONS duplicate framework definitions (maintenance burden)
- Pack-relevance not wired through to results display page

---

## Thread 2: Framework Completion & Correctness

**Status:** 11 frameworks, validated against official sources
**Files:** `lib/mvp/compliance/frameworks/`

| Framework | Version | Criteria | Status |
|-----------|---------|----------|--------|
| Kepner-Tregoe | 4.0 | 25 | ✅ Official KT 5 disciplines |
| CompTIA Troubleshooting | 1.0 | 13 | ✅ NEW — 6-step CompTIA methodology |
| Callum Baseline | 1.0 | 23 | ✅ Core |
| SERVQUAL | 2.0 | 13 | ✅ RATER dimensions |
| SBAR | 2.0 | 4 | ✅ Official SBAR protocol |
| LEAP/HEAT | 2.0 | 4 | ✅ Customer interaction model |
| ITIL Incident Mgmt | 2.0 | 6 | ✅ ITIL 4 aligned |
| ITIL Service Desk | 2.0 | 5 | ✅ ITIL 4 aligned |
| Cyber Essentials | 2025 | 6 | ✅ Exact 5 NCSC controls + call proxies |
| GDPR | 2018 | 6 | ✅ 7 principles mapped |
| ISO 27001 | 2022 | 8 | ✅ Relevant Annex A controls |

**Key changes:**
- Cyber Essentials rewritten to match exact 5 NCSC controls (added Firewalls, removed non-core)
- All compliance frameworks now have `observableInCall` flag to distinguish organizational vs call-level
- CompTIA added as industry-standard troubleshooting methodology
- All frameworks have `subcategory` for grouped display

---

## Thread 3: Pack Relevance Mapping

**Status:** Fixed
**Files:** `lib/mvp/compliance/pack-relevance.ts`

**Changes made:**
- All 4 active sim packs now have KT + CompTIA criteria mapped
- Compliance frameworks (CE, GDPR, ISO) still on general packs — but their `observableInCall: false` criteria don't score on per-call assessments
- New compliance packs can be added later that explicitly enable compliance criteria

---

## Thread 4: New Packs to Build

**Status:** Planning

### General Readiness (fill out common MSP scenarios)
- Printer troubleshooting
- VPN/connectivity issue
- Slow computer
- MFA/authentication issue

### Compliance/Security (where ISO, GDPR, CE actually fire)
- Phishing report simulation
- Malware response
- Social engineering / password reset security
- Data breach handling
- PII handling

### AI-Assisted Triage Pack
- Trainee has an AI assistant during the call
- Assessment is about AI-use judgment, not just fix correctness
- Could be a key differentiator

### Training Video + Sim Combos
- Watch ISO 27001 / GDPR / Cyber Essentials training video
- Then handle a sim that tests comprehension

---

## Thread 5: Slider-Based Scoring (0-10)

**Status:** Planned (Phase 2 in framestorm.md)
**Files:** Not started

Replace binary 1/0 per criterion with 0-10 slider positions with anchor descriptions at 0, 5, 10.

**Why:** Binary loses nuance. Partial credit, manager calibration data, and training signal for model distillation all need continuous scores.

**Not started:** No slider UI, no prompt changes to output 0-10, no anchor descriptions integrated.

---

## Thread 6: Manager Calibration (LoRA)

**Status:** Planned (Phase 3 in framestorm.md, Part 5 in vision2.md)
**Files:** Not started

Manager adjusts AI's slider positions → deltas stored as training data → LoRA adapter trained per manager → model converges to manager's standards.

Requires Thread 5 (sliders) first. Also requires Thread 1 (analysis engine) to be stable.

---

## Thread 7: Model Distillation (Qwen Local)

**Status:** Planned (Phase 4 in framestorm.md)
**Files:** `qwen.md` has notes

Goal: Replace prompt-based AI (deepseek-v4-flash, ~$0.0024/assessment, 30-60s) with local Qwen 0.5B/1.5B inference (~$0.00001, 50-200ms, no API call, data stays local).

Requires Thread 5 (sliders produce continuous training labels) + Thread 6 (manager calibration data). Chicken-and-egg: need ~1K labelled examples before small model can replace prompt AI.

---

## Thread 8: Voice Layer + Audio Analysis + Diarization

**Status:** All built, tested, and wired
**Files:** `lib/mvp/voice/`, `lib/mvp/audio/`, `app/api/mvp/assessment/[token]/voice/`, `components/mvp/voice/`
**Docs:** `docs/audio-analysis.md`, `tests/audio-analysis.test.ts`

**Voice:**
- STT (Whisper via OpenRouter) + TTS (Kokoro-82m) — 20 tests pass

**Audio Analysis:**
- Full call recording saved to `data/recordings/{token}-{id}.webm`
- Acoustic analyzer: amplitude VAD → silence ratio, talk ratio, longest silence, segment count, RMS envelope
- Turn timeline: response latency, talk balance, speaker timing from session_events
- Auto-recording: mic auto-starts when TTS finishes (captures natural pause time)
- Timing tracking: `tts_ended_at_ms` + `response_started_at_ms` in event payloads
- DB migration v5: `recording_path` + `recording_analysis_json`
- API: POST/GET/DELETE `/recording`
- 11 tests, 205 total, 0 fail

**Speaker Diarization:**
- `sherpa-onnx-node` v1.13.3 installed (CPU-only ONNX inference)
- Models: pyannote segmentation (6.8MB) + 3D-Speaker embedding (37.7MB)
- Runs automatically after recording upload
- Labels segments as "customer" vs "candidate"
- Graceful fallback if models unavailable

**Left open:**
- Frontend playback UI on results page
- Swap amplitude VAD for avr-vad (Silero ONNX) for better accuracy

---

## Thread 9: Unified Candidate Shell

**Status:** Designed but not built
**Files:** `cohesion.md`

Hiring exam, training drill, and training shift should share one shell component. Assignment type determines what features light up:
- Hiring exam: phone call UI + ticket panel
- Training drill: phone call + ticket + remote desktop tools
- Training shift: queue of tickets with prioritisation

Currently hiring exam and training drill have separate UIs. Voice makes the chat interface redundant for the call part.

---

## Thread 10: The Big Vision (vision2.md)

**Status:** Conceptual / No code

The Six Product Layers:
1. **Standards Repository** — MSP operating model as structured data (not built)
2. **Procedure Packs** — machine-readable SOPs (partially built as sim packs)
3. **Training/Sim Layer** — the current CX-Train (built)
4. **QA/Review Layer** — score real tickets against standards (not built)
5. **AI Policy Middleware** — gate AI suggestions against MSP standards (not built)
6. **Automation Readiness** — classify workflows by automation safety (not built)

Plus: Skills Passport, Hiring Pipeline, Candidate Profiles, Marketplace.

**Danger:** This is the most seductive thread. It's all compelling but building none of it ships a product.

---

## Thread 11: Training Shift Mode

**Status:** Planned
**Files:** `lib/mvp/assignment-types.ts` has the type defined, nothing else

Multi-ticket simulation with prioritisation, triage, queue pressure. "Real MSP flight simulator." No code exists.

---

## Thread 12: Ticket QA Mode

**Status:** Planned (vision2.md Part 2 section 4)
**Files:** Not started

Paste a real transcript + ticket → score against standards. No simulation needed. Manager gets an assessment report without putting a candidate through a sim.

Could sell before full automation — MSP can QA existing tickets immediately.

---

## Thread 13: Focus Drills (Adaptive Remediation)

**Status:** Planned (vision2.md Part 2 section 6-7)
**Files:** Not started

Personalised scenarios generated from a trainee's past weak spots. If someone keeps failing identity verification and ticket notes, generate a drill that combines both.

Requires Thread 1 (analysis engine) to produce reliable weakness identification, and enough assessment history to detect patterns.

---

## Thread 14: Skills Passport / Hiring Marketplace

**Status:** Conceptual (vision2.md Part 3-4)
**Files:** Not started

Portable proof-of-skill profiles. Candidates own their assessment history. MSPs search opted-in profiles. Hiring pipeline.

Vision2.md explicitly says "don't build marketplace first" — Phase 4-5 at earliest.

---

## Thread 15: Results Page — Multi-Framework Display + Summary

**Status:** Built — both test and live pages
**Files:** `app/mvp/results/design-a/page.tsx`, `app/mvp/assessments/[id]/page.tsx`, `app/api/mvp/assessments/[id]/route.ts`

**design-a (fixture viewer):**
- Grouped framework display with subcategory X/Y scores
- Split into 🧰 Skills Assessment and 📋 Compliance Standards
- Summary grid: Strengths, Misses, Coaching Focus, Ticket Quality
- 🔍 Evidence Validation section with grounded/removed quote details
- Auto-generated event evidence treated as verified (system events)

**Live manager page:**
- API now returns `complianceData`, `categoryScores`, `recordingAnalysis` from DB
- Manager page renders grouped framework view when data available
- Old criteria breakdown preserved for backward compatibility
- `frameworkType` field on each framework result for correct section sorting

**To do:**
- Wire evidence validation details into live page (currently fixture-only)
- Add recording playback UI
- Add summary insights to live page

---

## Thread 17: AI Provider Lazy Env Fix

**Status:** Fixed
**Files:** `lib/ai/provider.ts`

`MODEL_BY_TASK`, `API_KEY`, `BASE_URL` were read at module import time — broke `tsx` scripts that set env vars before imports. Fixed by making all reads lazy (function calls evaluated at runtime).

---

## Thread 16: Remote Desktop Simulator

**Status:** Exists but buggy
**Files:** `remotedesktop.md`, sim pack remote tools

Remote desktop terminal exists but:
- Overlays full screen when it should be a sandbox panel
- Ticket should stay visible on the left during remote session
- Navigation tracking needs improvement

---

## Current Build Order (from nextsteps.md)

```
A: Standards + Packs                  ✅ Done
B: Analysis Run Infrastructure        ✅ Done
C: Deterministic Base Callum          ✅ Done (11 frameworks, 248 tests)
D: Granular Manager Feedback          ✅ Done (live results page, grouped frameworks)
E: Candidate Scorecard v0             ❌ Not started
F: Callum For You v0                  ❌ Not started (needs D first)
G: Evidence Quality                   🔧 In progress (~30% quotes, target 80%)
H: Audio Analysis + Diarization       ✅ Done (recording, VAD, sherpa-onnx diarization)
I: Compliance Framework Correctness   🔧 In progress (CE done, GDPR/ISO pending)
J: CompTIA Framework                   ✅ Done (13 criteria, 6-step methodology)
K: Results Page UX                    ✅ Done (summary, validation, grouped view)
L: Hiring Packs + Templates           ✅ Done (4 packs, 6 templates, live)
M: LangGraph Callum Graph             ✅ Done (v2 route, 8 nodes, 14 tests)
N: Premium Callum Chat UI             ✅ Done (floating panel, page-aware prompts)
O: Scoring Scope Filter               ✅ Done (enabledCriteria, 3 tests)
```

---

## Thread 18: Callum LangGraph Integration + Chat UI

**Status:** Live — v2 graph running in parallel with v1
**Files:** `lib/mvp/langgraph/`, `app/api/mvp/callum/v2/`, `components/mvp/callum/CallumChatBar.tsx`, `tests/langgraph-callum.test.ts`

**Built:**
- Zero-dependency `StateGraph` abstraction (LangGraph-compatible API)
- 8 graph nodes: validateContext → loadProfile → loadThread → classifyIntent → loadAssessmentContext → invokeCapability → produceResponse → persistThread
- v2 route at `/api/mvp/callum/v2` (v1 stays as fallback)
- Heuristic intent classification (navigate, explain_assessment, suggest_next_training, general_question)
- General questions now call deepseek-v4-flash via `runAiTask('callum', ...)`
- Premium floating chat panel (not full-width bar)
- Page-aware context prompts based on sidebar navigation
- Chat history persisted in localStorage
- 14 tests + 3 scoring scope tests

**Known gaps:**
- v1 still the default route; v2 needs comparison testing before swap
- No LLM-as-router yet (still uses heuristic classifyIntent)
- Callum panel only on MVP layout — not on non-MVP pages
- No multi-turn context awareness (each message is stateless beyond localStorage history)

## Thread 19: Hiring Packs + Progressive Templates

**Status:** Live — 4 hiring packs, 6 templates
**Files:** `lib/mvp/sim/hiringPacks.ts`, `lib/mvp/workspace/templates.ts`, `lib/mvp/workspace/types.ts`, `components/mvp/workspace/HiringWorkspace.tsx`

**Built:**
- 4 hiring packs: outlook-basic, vpn-triage, printer-down, email-phishing
- 4 difficulty levels: basic, intermediate, advanced, expert
- 6 templates: 4 hiring progressive + 2 training
- `HiringWorkspace` — simplified call + notes layout (no ticket queue, triage, remote tools)
- Call auto-starts on mount for hiring exams
- Packs linked to templates via `templateId`

**Known gaps:**
- No UI to select template + pack when creating an assessment
- Manager creates hiring assessments via dashboard but can't choose difficulty
- No hiring pack proposal capability in Callum (only `create_training_assignment` exists)
- Scoring scope filter is wired but needs end-to-end test with real hiring assessment

## Thread 20: Scoring Scope Filter

**Status:** Built + tested
**Files:** `lib/mvp/analysis/scoring.ts`, `lib/mvp/analysis/runBaseCallumAnalysis.ts`, `tests/langgraph-callum.test.ts`

**Built:**
- `scoreExtraction()` accepts optional `enabledCriteria: Set<string>`
- `runBaseCallumAnalysis()` derives enabled criteria from `assessment_scope.enabledCategories`
- `coreEarned`/`totalCore` correctly scoped to enabled criteria
- 3 unit tests covering: exclusion, empty set, no crash

**Known gaps:**
- No end-to-end test proving a hiring exam uses different criteria than a training drill
- No UI feedback showing which criteria were in scope vs excluded

## Quick Reference: What Actually Blocks What

```
Thread 1 (analysis engine) → Thread 5 (sliders) → Thread 6 (calibration) → Thread 7 (distillation)
Thread 1 → Thread 13 (focus drills)
Thread 3 (pack mapping) → Thread 4 (new packs)
Thread 9 (unified shell) ← Thread 8 (voice)
Thread 10 (big vision) ← everything else (it's downstream of having a working product)
Thread 18 (Callum graph) ← Thread 19 (hiring packs) [to wire Callum → hiring proposals]
```
