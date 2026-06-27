# Open Threads — CallCallum / CX-Train

> Everything you're juggling right now. Use this to decide what to focus on next.

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

**Status:** Active / Just worked on
**Files:** `lib/mvp/compliance/frameworks/`

Frameworks exist but need validation against official sources:
- **Kepner-Tregoe** ✅ Just rewritten to v4.0 with all 5 official KT disciplines (SA, PA, DA, PPA, POA)
- **What about the other 9?** Need to verify they match their official sources too
- **ISO 27001** — organizational-level, only relevant for compliance packs. Currently firing on all packs (wrong).
- **LEAP/HEAT** — dead code, no pack references its criteria IDs
- **SERVQUAL, SBAR, ITIL Incident, ITIL Service Desk** — defined but not listed in any pack's relevance map, so they never score

---

## Thread 3: Pack Relevance Mapping

**Status:** Needs fixing
**Files:** `lib/mvp/compliance/pack-relevance.ts`

Two problems with how frameworks map to packs:

1. **Compliance frameworks (CE, GDPR, ISO)** active on every general pack (Outlook, password reset, new starter, shared mailbox). Should only fire on compliance/security-specific packs that don't exist yet.

2. **Readiness frameworks (SERVQUAL, SBAR, LEAP/HEAT, ITIL Incident, ITIL Service Desk)** not listed in any pack, so their criteria always return `not_applicable`.

Fix: remove CE/GDPR/ISO from general packs, add the missing readiness frameworks to appropriate packs.

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

## Thread 8: Voice Layer + Audio Analysis

**Status:** Built, tested, and merged
**Files:** `lib/mvp/voice/`, `app/api/mvp/assessment/[token]/voice/`, `components/mvp/voice/`
**New:** `lib/mvp/audio/`, `docs/audio-analysis.md`, `tests/audio-analysis.test.ts`

**Voice:**
- STT (Whisper via OpenRouter) + TTS (Kokoro-82m) — 20 tests pass

**Audio Analysis (new — June 2026):**
- Full call recording saved to `data/recordings/{token}-{id}.webm`
- Acoustic analyzer: amplitude VAD on decoded PCM → silence ratio, talk ratio, longest silence, segment count, RMS envelope
- Turn timeline builder from `session_events` → response latency, talk balance, speaker timing
- Auto-recording: mic auto-starts when TTS finishes (captures natural pause time)
- Timing tracking: `tts_ended_at_ms` + `response_started_at_ms` stored in event payloads
- DB migration v5: `recording_path` + `recording_analysis_json` on `assessment_results`
- API: POST/GET/DELETE `/recording`
- 11 tests pass (analyzer + recorder + ID gen). 205 total, 0 fail.

**Left open:**
- Voice-only interaction mode (no chat bubbles)
- CandidateShell unification
- Frontend playback UI on results page
- Swap amplitude VAD for avr-vad (Silero ONNX) for better accuracy
- Speaker diarization via sherpa-onnx to separate tracks

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

## Thread 15: Framework Evaluation (Just Discussed)

**Status:** Need a decision
**Files:** Everything in `lib/mvp/compliance/frameworks/`

We identified that:
- Compliance frameworks (ISO, GDPR, CE) should only fire on compliance packs, not general packs
- LEAP/HEAT is dead code (never fires)
- We need to decide which new packs to build next and in what order

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
A: Standards + Packs         ✅ Done
B: Analysis Run Infrastructure ✅ Done (ish)
C: Deterministic Base Callum   ✅ Done (ish — evidence quality needs work)
D: Granular Manager Feedback   🔧 In progress
E: Candidate Scorecard v0      ❌ Not started
F: Callum For You v0           ❌ Not started (needs D first)
```

---

## Quick Reference: What Actually Blocks What

```
Thread 1 (analysis engine) → Thread 5 (sliders) → Thread 6 (calibration) → Thread 7 (distillation)
Thread 1 → Thread 13 (focus drills)
Thread 3 (pack mapping) → Thread 4 (new packs)
Thread 9 (unified shell) ← Thread 8 (voice)
Thread 10 (big vision) ← everything else (it's downstream of having a working product)
```
