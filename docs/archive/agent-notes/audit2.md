# System Audit — CallCallum / CX-Train
**Date:** 2026-06-28
**Purpose:** Verify everything is connected and ready for demo.

---

## 1. System Architecture Overview

```
Browser ←→ Cloudflare Tunnel ←→ Next.js Dev Server (port 3000)
  │
  ├── /mvp/*                    — Manager dashboard + candidate pages
  ├── /api/mvp/*                — API routes
  │   ├── assessments           — CRUD + analysis + feedback
  │   ├── assessment/[token]    — Candidate-facing: chat, ticket, voice, recording
  │   └── voice/*               — Legacy voice routes (frozen)
  │
  ├── lib/mvp/*                 — Core logic
  │   ├── analysis/             — Evidence extraction, scoring, validation
  │   ├── compliance/           — 11 frameworks, evaluator, pack-relevance
  │   ├── audio/                — Recording, VAD, diarization, analyzer
  │   ├── voice/                — TTS (Azure + Kokoro), STT (Whisper)
  │   ├── sim/                  — Sim packs, state machine, AI customer
  │   ├── events/               — Session events, timeline
  │   └── results/              — Evidence-validated scoring calculator
  │
  ├── components/mvp/           — React components
  │   ├── simulator/            — ServiceDeskSimulatorShell, CallBar, etc.
  │   ├── voice/                — VoiceRecorderButton, CustomerAudioPlayer
  │   └── results/              — AssessmentResults
  │
  └── data/                     — SQLite DB, recordings, models
```

---

## 2. Framework Status (11 total)

| Framework | Type | Criteria | Pack-Relevance | AI Prompt | Results Page | observableInCall |
|-----------|------|----------|----------------|-----------|-------------|-----------------|
| Callum Baseline v1.1 | baseline | 27 | ✅ 4 packs | ✅ | ✅ | ✅ all |
| Kepner-Tregoe v4.0 | skills | 25 | ✅ 4 packs | ✅ | ✅ | ✅ all |
| CompTIA Troubleshooting v1.0 | skills | 13 | ✅ 4 packs | ✅ | ✅ | ✅ all |
| SERVQUAL v2.0 | skills | 13 | ❌ no packs | ✅ | ✅ | ✅ all |
| SBAR v2.0 | skills | 4 | ❌ no packs | ✅ | ✅ | ✅ all |
| LEAP/HEAT v2.0 | skills | 4 | ❌ no packs | ✅ | ✅ | ✅ all |
| ITIL Incident Mgmt v2.0 | skills | 6 | ❌ no packs | ✅ | ✅ | ✅ all |
| ITIL Service Desk v2.0 | skills | 6 | ❌ no packs | ✅ | ✅ | ✅ all |
| Cyber Essentials 2025 | compliance | 6 | ✅ 4 packs | ✅ | ✅ | ❌ (org-level) |
| GDPR 2018 | compliance | 6 | ✅ 4 packs | ✅ | ✅ | ❌ (org-level) |
| ISO 27001:2022 | compliance | 8 | ✅ 4 packs | ✅ | ✅ | ❌ (org-level) |

**Gap:** SERVQUAL, SBAR, LEAP/HEAT, ITIL Incident, ITIL Service Desk lack pack-relevance entries. They exist in the AI prompt and framework definitions but never score on any sim pack.

---

## 3. Data Flow Verification

### Candidate takes an assessment (happy path)

```
Manager creates assessment → POST /api/mvp/assessments { title, candidate, assignment_type }
  → assessment record in SQLite with invite_token
  → Manager sends invite link

Candidate opens link → GET /mvp/assessment/[token]
  → ServiceDeskSimulatorShell renders
  → Fetches assessment data from GET /api/mvp/assessment/[token]

Candidate + AI customer chat:
  → Candidate speaks → VoiceRecorderButton → STT → POST /api/.../message
  → AI customer responds → speak(text, mood) → TTS → audio playback
  → Every utterance logged as session_event

Candidate submits ticket:
  → POST /api/.../ticket → ticket stored
  → Trigger analysis: POST /api/.../analyse
    → runBaseCallumAnalysis() orchestrates:
      1. Evidence extraction via deepseek-v4-flash (59 criteria)
      2. Deterministic scoring (scoreExtraction)
      3. Compliance evaluation (evaluateAllFrameworks)
      4. Narrative feedback (AI call #2)
    → Results stored in assessment_results

Call ends:
  → endCall() → flushRecordingTrigger
  → POST /api/.../recording { audio: Blob }
    → save to data/recordings/
    → analyzeAudio() (VAD + silence/talk metrics)
    → runDiarization() (sherpa-onnx speaker separation)
    → buildEmotionalTrajectory() (mood changes from events)
    → Combined analysis stored in assessment_results.recording_analysis_json

Manager reviews:
  → GET /mvp/assessments/[id]
    → GET /api/mvp/assessments/[id]
      → Returns assessment + messages + ticket + analysis result
      → Returns complianceData (11 frameworks)
      → Returns categoryScores
      → Returns recordingPath + recordingAnalysis
```

### ⚠️ Known Gaps in the Flow

| Step | Status | Details |
|------|--------|---------|
| Manager creates assessment | ✅ | Working |
| Candidate chat via text | ✅ | Working |
| Candidate chat via voice | ✅ | STT + TTS working |
| Auto-recording on TTS end | ✅ | autoRecordTrigger wired |
| Full recording upload on endCall | ✅ | flushRecordingTrigger wired |
| VAD + silence analysis | ✅ | analyzeAudio() runs on upload |
| Speaker diarization | ✅ | sherpa-onnx runs on upload |
| Emotional trajectory | ✅ | From session_events mood changes |
| Evidence extraction (AI) | ⚠️ | ~63% quote coverage, needs prompting work |
| Deterministic scoring | ✅ | scoreExtraction() works |
| Multi-framework compliance | ✅ | evaluateAllFrameworks() works |
| Narrative feedback (AI) | ⚠️ | Second AI call, quality depends on prompt |
| Results stored in DB | ✅ | assessment_results table |
| Manager results page | ✅ | Shows grouped frameworks + summary + validation |
| Recording playback | ⚠️ | GET /recording route exists, UI not wired |
| Azure TTS with mood | ✅ | SSML with express-as + prosody |
| Kokoro TTS fallback | ✅ | Works if AZURE_TTS_KEY unset |

---

## 4. API Routes Inventory

### Active MVP routes

| Route | Method | Purpose | Status |
|-------|--------|---------|--------|
| `/api/mvp/assessments` | GET/POST | List/create assessments | ✅ |
| `/api/mvp/assessments/[id]` | GET | Assessment detail + results | ✅ Returns compliance data |
| `/api/mvp/assessments/[id]/analyse` | POST | Run analysis pipeline | ✅ |
| `/api/mvp/assessments/[id]/feedback` | POST | Manager feedback | ✅ |
| `/api/mvp/assessment/[token]` | GET | Candidate assessment load | ✅ |
| `/api/mvp/assessment/[token]/message` | POST | Send message | ✅ |
| `/api/mvp/assessment/[token]/event` | POST | Log event (sim actions) | ✅ |
| `/api/mvp/assessment/[token]/voice/tts` | POST | Synthesize speech | ✅ Azure + Kokoro |
| `/api/mvp/assessment/[token]/voice/transcribe` | POST | STT transcription | ✅ |
| `/api/mvp/assessment/[token]/recording` | POST/GET/DELETE | Recording upload/playback | ✅ VAD + diarization + emotional |
| `/api/mvp/standards` | GET/POST | Manager standards | ✅ |
| `/api/mvp/manager-profiles` | GET/POST | Manager profiles | ✅ |
| `/api/mvp/debug/status` | GET | System status | ✅ |
| `/api/mvp/debug/assessment/[id]` | GET | Debug assessment | ✅ |

### Frozen legacy routes (not maintained)
`/api/voice/session/*`, `/api/voice/session/[id]/*` — Voice sessions via legacy pipeline.

---

## 5. Database Schema

SQLite (`data/callcallum.db`) — 19 tables.

Key tables for the demo flow:

| Table | What It Stores | Populated By |
|-------|---------------|-------------|
| `assessments` | Assessment records, invite tokens, pack snapshots | API route |
| `sessions` | Call session state | API route |
| `messages` | Chat transcripts | /message route |
| `session_events` | Canonical event stream with timestamps | /message, /event routes |
| `tickets` | Candidate ticket submissions | /ticket route |
| `assessment_results` | Scores, criteria, compliance, recording paths | /analyse + /recording |
| `manager_feedback` | Manager reviews and overrides | /feedback route |
| `manager_profiles` | Manager identities | /manager-profiles route |
| `sim_sessions` | Sim pack session state | Sim engine |
| `sim_events` | Sim-specific events (backward compat) | Sim engine |

Key DB columns added during this sprint:
- `assessment_results.recording_path` — path to audio file
- `assessment_results.recording_analysis_json` — VAD + diarization + emotional analysis
- `assessment_results.compliance_json` — 11-framework evaluation results
- `assessment_results.category_scores_json` — Category-weighted scores

---

## 6. Test Coverage

```
npm test → 205 tests, 22 suites, 0 fail
```

| Test File | Tests | What It Covers |
|-----------|-------|---------------|
| `audio-analysis.test.ts` | 11 | VAD analyzer, recording save/load/delete |
| `analysis-engine.test.ts` | 30+ | 31 fixtures, scoring, gates, labels |
| `mvp-analysis-scoring.test.ts` | 10 | Scoring pipeline with framework compliance |
| `analysis-gold.test.ts` | 20+ | Gold fixture validation |
| `voice-session.test.ts` | 20 | STT, TTS, voice session lifecycle |
| `assessment-scoring.test.ts` | 20 | Legacy scoring |
| `evaluation-scoring.test.ts` | 20 | Legacy evaluation |
| `pack-factory.test.ts` | 20 | Sim pack structure |
| `taxonomy.test.ts` | 10 | Taxonomy search |
| `datasets-quality.test.ts` | 10 | Dataset validation |

---

## 7. Environment & Configuration

`.env.local` has active keys for:
- ✅ AI: OpenCode Go + deepseek-v4-flash
- ✅ STT: OpenRouter Whisper
- ✅ TTS: Azure Neural (SoniaNeural) — verified working
- ✅ TTS fallback: OpenRouter Kokoro

To run:
```bash
npm run mvp:init-db    # Initialize SQLite with seed data
npm run dev            # Start dev server
```

Cloudflare tunnel:
```bash
cloudflared tunnel --url http://localhost:3000
```

---

## 8. Demo Checklist

### Prerequisites
- [x] Dev server running (`npm run dev`)
- [x] Cloudflare tunnel active
- [x] DB seeded with packs + scenarios
- [x] AI API keys configured

### Demo Flow
1. [ ] Open Cloudflare URL → `/mvp` (manager dashboard)
2. [ ] Create assessment → fill candidate name, select pack, create
3. [ ] Copy invite link → open in new tab
4. [ ] Candidate page loads → chat with AI customer
5. [ ] Use voice (hold-to-talk) or type
6. [ ] AI customer responds with expressive TTS (Azure)
7. [ ] Submit ticket → analysis runs
8. [ ] Wait for scoring (~30-60s)
9. [ ] Manager page → refresh → see results
10. [ ] See grouped frameworks (Skills vs Compliance)
11. [ ] Expand criteria → see evidence quotes + explanations
12. [ ] See summary (Strengths, Misses, Coaching)
13. [ ] See emotional trajectory data

---

## 9. What's Not Working / Gaps

| Gap | Impact | Effort to Fix |
|-----|--------|--------------|
| SERVQUAL/SBAR/LEAP/ITIL not in pack-relevance | 5 frameworks never score on any pack | 10 min — add IDs to pack-relevance.ts |
| Evidence quote quality ~63% | Some criteria lack transcript quotes | Prompt engineering + maxTokens tuning |
| Recording playback UI not on manager page | Can't play call audio from results | Add <audio> element to results page |
| Emotional state not in evidence pool | Emotional criteria never score | Wire emotionalEvidence into evidence pool in analysis pipeline |
| tricky-passive-aggressive JSON fails sometimes | Model returns trailing text | JSON parsing fix done, may need more work |
| No compliance-specific sim packs | CE/GDPR/ISO frameworks always show "not applicable" | Build phishing/malware/data-breach packs |
| Manager page doesn't show recording analysis | VAD + diarization data not displayed | Add to manager results rendering |
| No Training Shift mode | Third assignment type not built | Significant effort |

---

## 10. Tips for the Next Agent

### Code navigation
- **Frameworks**: `lib/mvp/compliance/frameworks/*.ts` — each framework is a self-contained `FrameworkDefinition` export
- **Sim packs**: `lib/mvp/sim/packs/*.ts` — each pack has customer, callerBehavior, hiddenTruth, initialState, actions
- **AI prompts**: `lib/mvp/analysis/evidencePrompt.ts` — CRITERIA_DEFINITIONS + RED_FLAG_DEFINITIONS + buildEvidenceExtractionPrompt()
- **Scoring**: `lib/mvp/analysis/scoring.ts` — `scoreExtraction()` is the deterministic engine
- **Validation**: `lib/mvp/analysis/validation.ts` — `validateEvidenceGrounding()` checks transcript quotes
- **TTS**: `lib/mvp/voice/tts.ts` — Azure SSML builder, mood mapping, Kokoro fallback
- **Recording**: `lib/mvp/audio/` — analyzer (VAD), recorder (file I/O), diarizer (sherpa-onnx), turns (timeline)
- **API routes**: `app/api/mvp/` — each subfolder is a route group

### Common pitfalls
- **Pack-relevance is how frameworks score on scenarios.** If a framework isn't in `pack-relevance.ts` for a pack, its criteria always return `not_applicable`. This is the #1 reason a framework "does nothing."
- **Evidence prompt must be updated when adding new criteria.** The `CRITERIA_DEFINITIONS` array in `evidencePrompt.ts` is what the AI sees. If you add criteria to a framework without updating this array, the AI never extracts evidence for them.
- **Session events are the canonical data source.** `session_events` table stores every action with timestamps. The `sim_events` table is legacy backward compat.
- **Azure TTS requires `mstts:express-as` namespace.** The `<prosody>` tag must wrap `<mstts:express-as>`, not the other way around. Volume uses descriptive values (`medium`, `loud`), not `+1dB`.
- **sherpa-onnx-node installs native addon.** The npm package is just JS bindings; it downloads native binaries at install time. Works on x64 Linux without GPU.

### Quick wins for the next session
1. Add SERVQUAL/SBAR/LEAP/ITIL to `pack-relevance.ts` (5 frameworks → 10 min)
2. Wire recording analysis data into the manager results page UI (audio player + VAD stats + diarization)
3. Wire emotional evidence into the analysis pipeline evidence pool
4. Build a phishing-report compliance pack (first real use of CE/GDPR/ISO)
5. Rerun the e2e AI test after prompt improvements to measure quote coverage

### Model notes
- `deepseek-v4-flash` via OpenCode Go is the AI provider
- Sometimes returns trailing text after valid JSON — the `parseExtractionJson()` fix handles this
- Temperature 0 for evidence extraction, 0.8 for customer simulation
- maxTokens set to 16384 for extraction (was 8192)
- Azure TTS (SoniaNeural/RyanNeural) for customer voice, Kokoro as fallback

### File size notes
- `data/models/` contains ~45MB of ONNX models for sherpa-onnx diarization
- These are gitignored; run `scripts/download-diarization-models.sh` to fetch
- Recordings stored in `data/recordings/` (gitignored)
