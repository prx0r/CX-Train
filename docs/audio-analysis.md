# Audio Analysis — Call Recording & Acoustic Evidence

## What It Does

Records the full call audio, persists it to disk, runs lightweight acoustic analysis (amplitude VAD, no GPU), tracks speaker turn timing, and enables auto-recording when the AI customer finishes speaking.

## Built So Far (June 2026)

| Piece | File | Status |
|-------|------|--------|
| Acoustic analyzer (decode → VAD → silence/talk metrics) | `lib/mvp/audio/analyzer.ts` | ✅ Done |
| Recording save/load/delete to disk | `lib/mvp/audio/recorder.ts` | ✅ Done |
| Speaker turn timeline builder | `lib/mvp/audio/turns.ts` | ✅ Done |
| API routes: POST/GET/DELETE recording | `app/api/mvp/assessment/[token]/recording/route.ts` | ✅ Done |
| DB migration v5: recording_path, recording_analysis_json | `lib/mvp/db.ts` | ✅ Done |
| Auto-recording when TTS ends (autoRecordTrigger) | `VoiceRecorderButton.tsx` | ✅ Done |
| TTS end callback with timestamp | `CustomerAudioPlayer.tsx` | ✅ Done |
| Full call audio accumulation + flush on endCall | `VoiceRecorderButton.tsx` + shell | ✅ Done |
| response_started_at_ms + tts_ended_at_ms in API | `message/route.ts` | ✅ Done |
| Timing data wired through sendMessage | `ServiceDeskSimulatorShell.tsx` | ✅ Done |
| Tests (11: analyzer + recorder + ID gen) | `tests/audio-analysis.test.ts` | ✅ 205 pass |

## Data Flow v2 (with timing)

```
Call starts → MediaRecorder captures mic chunks
  → fullCallChunksRef accumulates ALL audio
  → Each utterance: chunks → STT → text → API

AI responds → TTS plays (speak())
  → audio.onended fires → onTtsEnd(Date.now())
    → sets ttsEndedAtRef
    → increments autoRecordTrigger
      → VoiceRecorderButton auto-starts mic
        → onRecordingStarted(responseStartedAtRef)

Candidate speaks → silence detected or manual stop
  → Blob → STT → text
  → POST /message with:
      tts_ended_at_ms: when AI finished speaking
      response_started_at_ms: when candidate started speaking
    → Server stores in session_events payload_json

Call ends (endCall) → flushRecordingTrigger++
  → Blob from fullCallChunksRef → POST /recording
    → Server saves .webm + runs analyzeAudio()
    → Stores recording_path + recording_analysis_json
    → Builds turn timeline from session_events

Manager reviews → GET /recording (playback)
  → Sees: audio player + acoustic stats + turn timing
```

## API Endpoints

```
POST /api/mvp/assessment/[token]/recording
  Body: { audio: Blob, duration_ms: number }
  Response: { id, path, analysis: { durationMs, silenceRatio, talkRatio, longestSilenceMs, silenceSegments } }

GET /api/mvp/assessment/[token]/recording
  Response: audio/webm binary stream

DELETE /api/mvp/assessment/[token]/recording
  Response: { deleted: true }
```

## Acoustic Analysis Output

```typescript
interface AudioAnalysis {
  durationMs: number;
  sampleRate: number;
  channels: number;

  // Silence / hesitation
  totalSilenceMs: number;
  silenceRatio: number;           // 0.0–1.0
  longestSilenceMs: number;
  silenceSegments: number;        // estimated turn count from VAD

  // Talk time
  totalTalkMs: number;
  talkRatio: number;              // 0.0–1.0

  // RMS envelope (energy/loudness profile)
  avgRms: number;
  peakRms: number;
  rmsVariance: number;            // loudness variation

  // Segment timeline
  segments: Array<{
    startMs: number;
    endMs: number;
    type: 'speech' | 'silence';
    rms: number;
  }>;
}
```

## Turn Timeline Output

```typescript
interface TurnTimeline {
  turns: SpeakerTurn[];             // ordered list of who spoke when
  totalCustomerTurns: number;
  totalCandidateTurns: number;
  avgCustomerTurnMs: number;        // how long customer speaks on avg
  avgCandidateTurnMs: number;       // how long candidate speaks on avg
  avgResponseLatencyMs: number;     // KEY: hesitation metric
  maxResponseLatencyMs: number;
  minResponseLatencyMs: number;
  totalCustomerTalkMs: number;
  totalCandidateTalkMs: number;
  customerTalkRatio: number;        // 0.0–1.0
  candidateTalkRatio: number;       // 0.0–1.0
  callDurationMs: number;
  sentencesPerTurn: number;
}

interface SpeakerTurn {
  speaker: 'customer' | 'candidate';
  startMs: number;
  endMs: number;
  durationMs: number;
  responseLatencyMs: number | null;  // ms since previous speaker finished
  text: string;
}
```

## Timing Grades

```typescript
computeTimingGrade(avgLatencyMs):
  < 500ms   → "very_fast"     (talking over / interrupting)
  500–1500  → "responsive"    (good pace)
  1500–3000 → "normal"        (measured pace)
  3000–6000 → "hesitant"      (pausing / thinking too long)
  > 6000    → "very_slow"     (awkward silences)

computeTalkBalanceGrade(talkImbalance):
  < 0.10    → "balanced"
  0.10–0.25 → "slightly_imbalanced"
  0.25–0.40 → "imbalanced"
  > 0.40    → "very_imbalanced"
```

## Storage

- Files stored in `data/recordings/` (gitignored)
- Naming: `{assessment_token}-{uuid}.webm`
- No external storage needed for MVP

## DB Changes

Columns on `assessment_results`:
- `recording_path TEXT` — path to the audio file
- `recording_analysis_json TEXT` — AudioAnalysis JSON

## Frontend: Auto-Recording Flow

`VoiceRecorderButton` changes:
- `autoRecordTrigger` prop — when incremented, starts recording automatically
- `flushRecordingTrigger` prop — when incremented, emits full recording blob
- `onRecordingStarted` — fires with timestamp when recording starts (for latency calc)
- `onFullRecording` — fires with accumulated blob when call ends
- `fullCallChunksRef` — accumulates ALL audio across utterances

`useCustomerAudio` changes:
- `setOnTtsEnd(cb)` — registers callback that fires with `Date.now()` when TTS finishes

`ServiceDeskSimulatorShell` changes:
- On TTS end → increment autoRecordTrigger
- On endCall → increment flushRecordingTrigger → upload full recording
- `handleFullRecording()` → POST to `/recording`
- `sendMessage()` includes `tts_ended_at_ms` + `response_started_at_ms`

## What Analysis This Enables

### From Acoustic VAD (no ML, amplitude-based):

| Metric | What It Reveals | Scoring Integration |
|--------|----------------|---------------------|
| **Silence ratio** | How much of the call is dead air vs active conversation | SERVQUAL Responsiveness: low silence = good pace |
| **Longest silence** | Candidate went quiet for an extended period | ITIL call handling: long silence = lost thread |
| **Silence segments** | Number of pauses — high count = fragmented conversation | Callum Baseline: professionalism |
| **RMS variance** | Loudness variation — high variance = emotional shifts | SERVQUAL Empathy: calm vs agitated |
| **Talk ratio** | Who dominated the conversation | Balance metric — candidate should lead but not dominate |

### From Turn Timing (session_events):

| Metric | What It Reveals | Scoring Integration |
|--------|----------------|---------------------|
| **Avg response latency** | How quickly candidate responds after customer speaks | SERVQUAL Responsiveness: fast = attentive, slow = hesitant |
| **Response latency grade** | very_fast → responsive → normal → hesitant → very_slow | Candidate readiness tier |
| **Max pause between turns** | Candidate got stuck or didn't know what to say | KT Situation Appraisal: hesitation = inadequate preparation |
| **Talk balance** | Candidate vs customer talk dominance | Callum Baseline: customer_communication |
| **Sentences per turn** | Candidate speaks in short bursts vs long monologues | Communication clarity indicator |
| **Candidate rush score** (<300ms = rushing, >5s = hesitating) | Combined metric for call pacing | Overall call quality indicator |

### Combined (acoustic + timing):

| Insight | How It's Computed |
|---------|------------------|
| **Candidate hesitated before answering** | High response latency + silence before turn |
| **Candidate interrupted customer** | Response latency <200ms + customer turn cut short |
| **Candidate lost train of thought** | Long silence mid-turn + fragmented segments |
| **Candidate was rushed or anxious** | Fast response latency + high speech energy + short turns |
| **Candidate was calm and professional** | Moderate latency + balanced talk ratio + stable RMS |
| **Call had awkward flow** | High silence ratio + imbalanced talk + high max pause |

## Future (No-GPU) Enhancements

1. **avr-vad** — swap amplitude VAD for Silero ONNX VAD (more accurate silence detection)
2. **sherpa-onnx** — speaker diarization (separate candidate from customer audio without relying on turn events)
3. **Pitch analysis** — detect vocal fry, upspeak, prosody patterns from PCM
4. **Energy trajectory** — detect frustration/calm shifts over call duration
5. **Word-level timing** — combine transcript word boundaries with audio for speech rate

## Non-Goals for v1

- No real-time analysis (post-call only)
- No ML-based emotion detection (can be added later)
- No external storage (local disk only)
- No speaker diarization from raw audio (we use event-based turn tracking instead)
