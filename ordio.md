# Ordio — Hiring Simulator Integration

## Overview

Integration of audiator's voice engine and analysis report features into the CX-Train core infrastructure. CX-Train's simpack system, AI call model prompting, and analysis pipeline are retained as the foundation — audiator contributions sit on top as UX and voice-engine enhancements.

---

## Architecture

```
CX-Train (core infra)
├── sim packs (lib/mvp/sim/)        ← defines caller persona, scenario, scoring
├── AI call model (lib/ai/)          ← prompts LLM as the customer
├── analysis pipeline (lib/mvp/analysis/)
│   ├── evidence extraction          ← AI extracts criteria from transcript
│   ├── deterministic scoring        ← binary scoring engine
│   ├── compliance evaluation        ← multi-framework compliance
│   └── narrative feedback           ← AI coaching summary
├── voice engine (lib/voice/)        ← STT/TTS providers

Contributions from audiator
├── Self-hosted Kokoro TTS           ← lib/voice/tts.ts → KokoroTtsProvider
├── TTS caching                      ← SHA1-hash file cache in data/tts-cache/
├── Vosk / whisper.cpp STT           ← lib/voice/stt.ts → VoskSttProvider, WhisperCppSttProvider
├── Voice loop utilities             ← lib/voice/voiceLoop.ts → latency tracker, phrase chunker, TTS queue
├── MP3 recording playback           ← ffmpeg WebM→MP3 conversion in recording route
├── Candidate analysis report page   ← app/mvp/analysis/[assessmentId]/
│   ├── Scenario info from simpack   ← customer persona, root cause, fix
│   ├── Call recording audio player  ← streams MP3 via ?format=mp3
│   ├── Acoustic & turn metrics      ← talk ratio, timing grades, diarization
│   ├── Assessment overview          ← score, verdict, category bars, strengths, coaching
│   └── Transcript                   ← role-styled messages
```

---

## File Manifest

### New files

| File | Purpose |
|------|---------|
| `app/mvp/analysis/[assessmentId]/page.tsx` | Candidate-facing analysis report page |
| `components/mvp/analysis/CallRecordingPlayer.tsx` | Audio player for call recording |
| `components/mvp/analysis/AcousticMetrics.tsx` | Acoustic bars, turn timing grades, diarization stats |
| `components/mvp/analysis/TranscriptView.tsx` | Role-styled transcript display |
| `components/mvp/analysis/AssessmentOverview.tsx` | Score, verdict, strengths/improvements, coaching |
| `lib/voice/voiceLoop.ts` | Latency tracker, phrase chunker, TTS queue |

### Modified files

| File | Changes |
|------|---------|
| `lib/mvp/audio/recorder.ts` | Added `getMp3Path()` helper |
| `app/api/mvp/assessment/[token]/recording/route.ts` | POST: WebM→MP3 via ffmpeg; GET: `?format=mp3` support |
| `lib/voice/providers.ts` | Added provider name types, `DEFAULT_TTS_VOICE`, `MAX_AUDIO_SIZE_BYTES`, cost entries |
| `lib/voice/tts.ts` | Added `KokoroTtsProvider` (self-hosted), `synthesizeSpeech()` with SHA1 caching |
| `lib/voice/stt.ts` | Added `VoskSttProvider`, `WhisperCppSttProvider`, `FixtureSttProvider`, `getSttProvider()` factory |
| `app/api/mvp/assessments/[id]/route.ts` | Returns `packSnapshot` / `packCustomer` from `pack_snapshot_json` |
| `app/mvp/assessments/[id]/page.tsx` | "View Candidate Report" link next to analysis score |

---

## Data Flow

### Simpack → Analysis Report

```
1. Assessment created
   ├── pack_snapshot_json written to assessments table
   │   └── includes: customer persona, hidden truth, scoring defaults
   └── assessment_pack_id references the pack

2. Candidate takes call (hiring_exam or training_drill)
   ├── AI customer prompted from pack persona
   ├── Messages recorded in messages table
   ├── Audio recorded → POST /api/mvp/assessment/[token]/recording
   │   ├── WebM saved to data/recordings/
   │   ├── MP3 generated via ffmpeg
   │   └── Acoustic analysis stored in recording_analysis_json
   └── Ticket submitted

3. Analysis runs
   ├── POST /api/mvp/assessments/[id]/analyse
   └── runBaseCallumAnalysis() stores scores in assessment_results

4. Report page loads
   ├── GET /api/mvp/assessments/[id]
   │   ├── Returns assessment, messages, result, recording data
   │   └── Returns packSnapshot/packCustomer from pack_snapshot_json
   └── app/mvp/analysis/[assessmentId] renders:
       ├── Scenario section (customer name, company, role, temperament, issue)
       ├── Audio player (GET .../recording?format=mp3)
       ├── Assessment overview (score, verdict, category bars, coaching)
       ├── Acoustic metrics (talk ratio, timing grades, diarization)
       └── Transcript
```

### Voice Engine Provider Selection

TTS is selected via `TTS_PROVIDER` env var:
- `openrouter` → OpenRouter API (Kokoro via cloud)
- `kokoro` → Self-hosted Kokoro at `KOKORO_BASE_URL` (default `http://127.0.0.1:8880`)
- `openai` → OpenAI TTS API
- `fixture` → Silent WAV for testing

STT is selected via `VOICE_STT_PROVIDER` env var:
- `openrouter` → OpenRouter Whisper
- `groq` → Groq Whisper
- `vosk` → Self-hosted Vosk at `VOSK_BASE_URL`
- `whisper_cpp` → Self-hosted whisper.cpp at `WHISPER_CPP_BASE_URL`
- `fixture` → Text-to-text fixture for testing

TTS caching: SHA1(`{voice}\n{format}\n{text}`) → `data/tts-cache/{voice}-{hash}.mp3`

---

## Key Environment Variables

```
# Voice Engine (from audiator)
KOKORO_BASE_URL=http://127.0.0.1:8880        # self-hosted Kokoro TTS
VOSK_BASE_URL=http://127.0.0.1:2700          # self-hosted Vosk STT
WHISPER_CPP_BASE_URL=                         # self-hosted whisper.cpp STT
TTS_PROVIDER=openrouter|kokoro|openai|fixture
VOICE_STT_PROVIDER=openrouter|groq|vosk|whisper_cpp|fixture
TTS_CACHE_DIR=./data/tts-cache
TTS_VOICE=af_heart                           # default Kokoro voice

# AI (existing)
AI_BASE_URL=                                  # OpenCode-compatible API
AI_API_KEY=
OPENROUTER_API_KEY=
GROQ_API_KEY=
```

---

## Testing

### Run all tests

```bash
npm test
```

Expected: 248 tests pass across 22 suites.

### Test categories

| Test suite | What it covers |
|------------|---------------|
| `tests/assessment-scoring.test.ts` | Scoring engine, criteria, thresholds |
| `tests/evaluation-scoring.test.ts` | Legacy evaluation scoring |
| `tests/voice-session.test.ts` | Voice session CRUD, STT/TTS/chat mocks, cost estimation |
| `tests/analysis-engine.test.ts` | Analysis pipeline |
| `tests/mvp-analysis-scoring.test.ts` | MVP deterministic scoring |
| `tests/datasets-quality.test.ts` | Dataset quality checks |
| `tests/taxonomy.test.ts` | Taxonomy import and search |
| `tests/analysis-gold.test.ts` | Gold-standard analysis validation |
| `tests/pack-factory.test.ts` | Pack registry, pack validation, fail gates |
| `tests/audio-analysis.test.ts` | Audio analysis pipeline |
| `tests/callum-contracts.test.ts` | Callum contract validation |
| `tests/callum-routes.test.ts` | Callum API routes |
| `tests/langgraph-callum.test.ts` | Callum state machine |

### Manual testing flow

1. **Start the dev server**
   ```bash
   npm run dev
   ```

2. **Create a hiring exam assessment** via the MVP dashboard at `/mvp`

3. **Open the invite link** and take the call (text or voice mode)

4. **Submit ticket** to complete the assessment

5. **Run analysis** from the assessment detail page at `/mvp/assessments/[id]`

6. **View candidate report** at `/mvp/analysis/[assessmentId]`

7. **Verify**:
   - Scenario info shows customer persona from simpack
   - Audio player streams MP3 recording
   - Assessment scores, strengths/improvements display
   - Acoustic metrics appear (if recording was made)
   - Transcript shows all messages

### Voice engine test

```bash
# Test self-hosted Kokoro
KOKORO_BASE_URL=http://127.0.0.1:8880 TTS_PROVIDER=kokoro node -e "
  const { synthesizeSpeech } = require('./lib/voice/tts');
  synthesizeSpeech('Hello, this is a test.').then(b => console.log('TTS OK:', b.byteLength, 'bytes'));
"
```

### Lint & typecheck

```bash
npx tsc --noEmit      # TypeScript check
npm run lint           # ESLint
```
