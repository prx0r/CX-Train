# Recent Advice: Sim Engine Hardening + Voice Layer

## What Changed

Two commits on `main`:

1. **`9843701` — Harden sim engine**: 60 regression tests, safe projection, phase machine, taxonomy tags, pack registry, dynamic effects, deterministic scoring
2. **`a70f704` — Voice layer**: STT (Whisper Large v3 Turbo) + TTS (Kokoro-82m) via OpenRouter, 20 voice tests

All 195 tests pass (37 MVP flow + 28 dashboard sim + 24 sim foundation + 16 session events + 10 analysis scoring + 60 hardening + 20 voice).

---

## How the Sim Engine Now Works

### Architecture: "State Machine + Event Log + Safe Projection"

```
SimPack (declarative config)
  → SimState (nested: call, remote, outlook, network, evidence, flags, discovered)
  → applyAction(state, action) checks phase + preconditions
    → mutates state via nested dot-path effects
    → returns { ok, result, updatedState }
  → safeProjection strips hiddenTruth, gated state
  → eventLog writes to session_events (canonical) + sim_events (backward compat)
  → scoreSimEvents reads event stream → deterministic score
```

### Key Files

| File | Role |
|---|---|
| `lib/mvp/sim/types.ts` | `SimPack`, `SimState`, `SimAction`, `TaxonomyTag`, `VisibleAction`, `SimActionResult` with `ok`/`errorCode` |
| `lib/mvp/sim/stateMachine.ts` | Phase transitions (`not_started`→`call_active`→`remote_active`→`ticketing`→`submitted`), nested effects, `$now` dynamic resolution, precondition checks |
| `lib/mvp/sim/packConfig.ts` | "Outlook Work Offline" pack — 23 actions with `taxonomyTags` instead of `evidenceTags` |
| `lib/mvp/sim/safeProjection.ts` | Phase-based visibility: `outlook` block hidden until `discovered[]` has `tool.outlook.*`; `network` hidden until `tool.cmd.*`; `sentTestEmail` hidden until `fix.correct_root_cause`. Red-flag actions visible with `redFlag: true` but metadata hidden. |
| `lib/mvp/sim/scoring.ts` | 15 criteria, reads `taxonomy_tags` from payload, deterministic — same events → same score |
| `lib/mvp/sim/packRegistry.ts` | Map: `pack-outlook-sim-v2` → factory. Unknown packs fail loudly. |
| `lib/mvp/sim/eventLog.ts` | Dual-writes to `sim_events` + `session_events`. Canonical reads via `getCanonicalEvents()` → `getSessionEvents()`. |
| `lib/mvp/sim/aiCustomer.ts` | Builds AI prompt with `availableFacts`/`forbiddenFacts` from current `SimState.factsRevealed`, not from raw `hiddenTruth`. |

### Red Flag Handling

- Red-flag actions (reinstall Outlook, delete mail profile, escalate without checks, blame outage) are **visible to the candidate** with `redFlag: true` on `VisibleAction`
- Red-flag **metadata** (severity, message, id) is hidden from candidate — only visible in manager report
- API route returns `result.ok: false` + `errorCode` for rejected actions — **no event logged**

### Scoring Pipeline

```
session_events (canonical event stream)
  → scoreSimEvents checks performed action_ids + taxonomy_tags in payload
  → deterministic score 0-100
  → AI writes evidence summary (separate analysis pass)
  → Manager can override
```

---

## How the Voice Layer Works

### Flow

```
Browser MediaRecorder (audio/webm;codecs=opus)
  → POST /voice/transcribe
    → base64 → OpenRouter /api/v1/audio/transcriptions (Whisper Large v3 Turbo)
    → returns { text, metadata: { duration_ms, stt_provider, stt_model } }
  → transcript → POST /message { input_source: "voice", audio_metadata }
    → existing sim engine processes it (same as text)
    → returns customer reply text
  → display text + POST /voice/tts
    → OpenRouter /api/v1/audio/speech (Kokoro-82m)
    → returns audio/mpeg
  → browser plays via Audio()

  Event stored: { event_type: "candidate_message", input_source: "voice",
    audio_metadata_json: { duration_ms, mime_type, stt_provider, stt_model } }
```

### Files

| File | Role |
|---|---|
| `lib/mvp/voice/types.ts` | `VoiceMetadata`, `SttResult`, `InputSource`, defaults |
| `lib/mvp/voice/stt.ts` | `transcribeAudio()` — base64 → OpenRouter transcription, `validateAudioSize()` |
| `lib/mvp/voice/tts.ts` | `synthesizeSpeech()` — text → OpenRouter TTS |
| `app/.../voice/transcribe/route.ts` | Accepts multipart audio, 8MB limit, returns `{text, metadata}` |
| `app/.../voice/tts/route.ts` | Accepts `{text}`, 1000-char limit, returns `audio/mpeg` |
| `components/mvp/voice/VoiceRecorderButton.tsx` | Hold-to-talk or click-to-toggle, MediaRecorder, mic permission handling, visual recording indicator |
| `components/mvp/voice/CustomerAudioPlayer.tsx` | `useCustomerAudio` hook — speaks customer replies, stops on new input, gates mic during TTS playback |

### UX Rules

- Voice input only during active phases (gated by sim engine)
- Ticket writing remains typed
- Mic disabled while TTS is playing
- Text transcript always visible
- Click-to-toggle mode avoids mouse-up bugs

---

## AI Provider Setup

The system uses **two independent AI providers**:

### Text AI (customer responses, analysis, scoring)
- **Provider**: OpenCode Go (opencode.ai)
- **Endpoint**: `https://opencode.ai/zen/go/v1/chat/completions`
- **Model**: `deepseek-v4-flash` (or whatever `AI_CALLER_MODEL` is set to)
- **Configured via**: `AI_PROVIDER=opencode-go`, `AI_BASE_URL`, `AI_API_KEY`
- **Used for**: All text generation — customer chat, evidence extraction, narrative feedback

### Voice AI (STT + TTS)
- **Provider**: OpenRouter
- **STT endpoint**: `https://openrouter.ai/api/v1/audio/transcriptions` (Whisper Large v3 Turbo)
- **TTS endpoint**: `https://openrouter.ai/api/v1/audio/speech` (Kokoro-82m)
- **Configured via**: `OPENROUTER_API_KEY`
- **Used for**: Speech-to-text transcription, text-to-speech synthesis

**How they connect**: The text AI (opencode go) generates the customer's text reply via `runAiTask('caller', ...)`. That text reply is then passed to the TTS endpoint (OpenRouter Kokoro) to be spoken aloud. They are independent services — the text endpoint does not need TTS capabilities, and the TTS endpoint does not need chat capabilities.

**Yes, this already works as described.** The `.env.local` has `AI_PROVIDER=opencode-go` for text, and you just need to add `OPENROUTER_API_KEY=sk-...` for voice. The two APIs don't overlap.

---

## How to Test

### Full Browser Flow

```bash
npm run dev
```

1. Open `http://localhost:3000/mvp` — manager dashboard
2. Click **Create Assessment**, set mode to `dashboard_sim`, pack `pack-outlook-sim-v2`
3. Copy invite link, open in another tab
4. See Win11 desktop with Customer Chat, Outlook, Browser, CMD, Ticket windows
5. Click **Start call** in chat (phase: `not_started` → `call_active`)
6. Type messages to Sarah from Connexion Dental
7. Or click **Click to talk** and speak — transcript will be sent as message
8. Customer reply appears as text + speaks via TTS (if `OPENROUTER_API_KEY` is set)
9. Click **Remote into ALDER-LT-023** (phase: `call_active` → `remote_active`)
10. In Outlook: Open → Check Outbox → Check status → Disable Work Offline → Send test email
11. Try red-flag actions (Reinstall Outlook, Delete profile, Blame outage) — these are visible but flagged
12. Click **End call** → write ticket → submit
13. Check `/mvp/assessments` for score

### Headless Tests

```bash
node scripts/test-mvp-flow.mjs           # 37 — full lifecycle
node scripts/test-dashboard-sim.mjs       # 28 — sim actions + scoring
npx tsx scripts/test-sim-hardening.mjs    # 60 — security + correctness
npx tsx scripts/test-voice.mjs            # 20 — voice layer
```

### What to Watch for

| Check | What to look for |
|---|---|
| Initial API response | No `outlook`, `network`, `connectwise` in `safe_state` |
| After opening Outlook | `outlook.workOffline: true` appears, `sentTestEmail` stays hidden |
| After fix + test email | `outlook.sentTestEmail: true` appears |
| Red-flag actions | Visible in `safe_actions` with `redFlag: true`, no `severity`/`message` |
| Rejected actions | API returns `{ok:false, errorCode:"PRECONDITION_FAILED"}`, no event logged |
| session_events | Contains `input_source`, `audio_metadata_json` for voice |
| Scoring | Same transcript → identical score regardless of `input_source` |
| Voice (with OPENROUTER_API_KEY) | Customer text is spoken via TTS, mic disabled during playback |
