# CX-Train Testing Guide

## Recent Progress

### Sim Engine (Hardened)
- **SimPack types** — `SimState` (nested `call/remote/outlook/network/evidence/flags/discovered`), `SimAction` (phases, preconditions, effects, taxonomy tags, red flags), `SimPack` (customer, hiddenTruth, rubric, idealTicket)
- **State machine** — Phase transitions (`not_started` → `call_active` → `remote_active` → `ticketing` → `submitted`), nested dot-path effects, `$now` dynamic resolution, precondition checks
- **Safe projection** — Phase-based visibility: `outlook` hidden until `tool.outlook.*` discovered, `network` hidden until `tool.cmd.*`, `sentTestEmail` hidden until `fix.correct_root_cause`. Red-flag actions visible to candidate but metadata hidden.
- **Pack registry** — `pack-outlook-sim-v2` only, unknown packs fail loudly
- **Deterministic scoring** — 15 criteria, reads `taxonomy_tags` from event payload, same events → same score every time

### Voice Layer
- **TTS** — Kokoro-82m via OpenRouter (`/api/v1/audio/speech`), returns MP3 audio
- **STT** — Whisper Large v3 Turbo via OpenRouter (`/api/v1/audio/transcriptions`), accepts base64 audio
- **VoiceRecorderButton** — Hold-to-talk or click-to-toggle, MediaRecorder with opus codec, mic permission handling
- **CustomerAudioPlayer** — `useCustomerAudio` hook, auto-plays customer replies, handles browser autoplay blocking with fallback button

### ServiceNow-Style UI
- **ItsmCandidateShell** — Full-screen candidate layout with dark sidebar, top bar, Win11 floating windows on remote connect
- **Win11 desktop** — Outlook, Browser, CMD windows appear when remoted into ALDER-LT-023
- **Incoming call banner** — Blue strip with caller info and Answer Call button
- **Right actions panel** — Actions grouped by tool, red-flag actions shown in red

### Connectivity
- HTTPS proxy (self-signed cert) on port 3000 → Next.js on 3001 for Firefox microphone support
- UFW port 3000 open for external access

---

## How to Test

### Prerequisites
```bash
# Start the dev server (runs on :3001 internally)
cd /root/projects/CX-Train
PORT=3001 nohup npx next dev -H 127.0.0.1 -p 3001 &

# Start HTTPS proxy (serves :3000 → :3001)
node scripts/https-proxy.mjs &
```

### Browser Flow

1. **Open** `https://138.199.223.35:3000/mvp` (or `http://localhost:3000` locally)

2. **Create assessment**
   - Select mode: **Dashboard Sim (Win11 + Voice)**
   - Pack: **Outlook Not Sending — Work Offline v2**
   - Enter candidate name → Create
   - Open the invite link

3. **Answer call**
   - Incoming call banner appears after ~1.5s
   - Click **Answer Call**
   - Customer (Sarah) speaks opening line via TTS

4. **Diagnose via chat**
   - Type messages or click **"Click to talk"** to speak
   - Customer replies in text + TTS audio
   - Ask: scope, impact, what's happening

5. **Remote into machine**
   - Click **Remote into ALDER-LT-023** (top bar)
   - Win11 desktop appears with floating windows:
     - **Customer Chat** — type or use voice
     - **Outlook** — actions via right panel or Win11 tool dock
     - **Browser** — check webmail
     - **CMD** — ping, ipconfig
     - **Ticket** — write notes during call

6. **Diagnose & fix**
   - Open Outlook → Check Outbox → Check Status → Disable Work Offline → Send test email
   - Or try red-flag actions (Reinstall, Delete profile, Escalate) — they work but are flagged

7. **End call & submit ticket**
   - Click **End Call** → ticket form appears
   - Write ticket → Submit

8. **Manager review**
   - Go to `https://138.199.223.35:3000/mvp/assessments`
   - Click assessment to view transcript, timeline, scoring

### Voice-Specific Testing

| What to test | How | Expected |
|---|---|---|
| TTS | Answer call or send message | Customer reply plays as audio |
| STT | Click "Click to talk" → speak | Transcript appears as message |
| Mic in Firefox | Use HTTPS URL | Browser prompts for permission |
| Autoplay blocked | First page load | 🔇 "Play audio" button appears; click it |
| Voice during remote | Click "Click to talk" in Customer Chat window | Works inside Win11 overlay |

### Headless Tests
```bash
node scripts/test-mvp-flow.mjs              # 37 — full lifecycle
node scripts/test-dashboard-sim.mjs          # 28 — sim actions + events
npx tsx scripts/test-sim-hardening.mjs       # 60 — security + correctness
npx tsx scripts/test-voice.mjs               # 20 — voice layer
```

---

## Architecture Overview

```
Browser (HTTPS :3000)
  │
  ├─ HTTPS Proxy (self-signed cert) ─→ Next.js Dev (HTTP :3001)
  │
  ├─ /mvp                  → Manager dashboard (create assessments, review)
  ├─ /mvp/assessment/[tok] → Candidate ITSM shell
  │     ├─ Answer Call     → POST /sim/action (start_call)
  │     ├─ Chat            → POST /message → AI customer (OpenCode Go)
  │     ├─ Voice input     → POST /voice/transcribe → OpenRouter Whisper
  │     ├─ Tool actions    → POST /sim/action → state machine → event log
  │     ├─ TTS playback    → POST /voice/tts → OpenRouter Kokoro → MP3
  │     └─ Submit ticket   → POST /ticket → assessment completed
  │
  └─ /mvp/assessments/[id] → Manager detail view (transcript, timeline, score)
```

### Key Files

| File | Purpose |
|---|---|
| `lib/mvp/sim/types.ts` | SimPack, SimState, SimAction, TaxonomyTag types |
| `lib/mvp/sim/stateMachine.ts` | Phase transitions, nested effects, precondition checks |
| `lib/mvp/sim/packConfig.ts` | "Outlook Work Offline" scenario pack |
| `lib/mvp/sim/safeProjection.ts` | Phase-based state visibility gating |
| `lib/mvp/sim/packRegistry.ts` | Code-pack registry (fail loudly on unknown) |
| `lib/mvp/sim/scoring.ts` | Deterministic scoring from event stream |
| `lib/mvp/sim/aiCustomer.ts` | AI prompt builder with available/forbidden facts |
| `lib/mvp/voice/stt.ts` | OpenRouter Whisper transcription |
| `lib/mvp/voice/tts.ts` | OpenRouter Kokoro TTS |
| `components/mvp/sim/ItsmCandidateShell.tsx` | ServiceNow-style candidate layout |
| `components/mvp/voice/VoiceRecorderButton.tsx` | Browser mic recorder |
| `components/mvp/voice/CustomerAudioPlayer.tsx` | TTS playback with autoplay handling |
| `scripts/https-proxy.mjs` | HTTPS proxy for Firefox mic support |

### Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `AI_PROVIDER` | `opencode-go` | Text AI provider |
| `AI_API_KEY` | — | OpenCode Go API key |
| `AI_CALLER_MODEL` | `deepseek-v4-flash` | AI customer model |
| `OPENROUTER_API_KEY` | — | TTS/STT via OpenRouter |
| `VOICE_STT_MODEL` | `openai/whisper-large-v3-turbo` | Speech-to-text model |
| `VOICE_TTS_MODEL` | `hexgrad/kokoro-82m` | Text-to-speech model |
| `VOICE_TTS_VOICE` | `af_heart` | Kokoro voice ID |

---

## Next Steps

### Immediate (grounding)
- [ ] Fix HTTPS proxy stability (auto-restart if Next.js crashes)
- [ ] Test full flow in Firefox with mic permission prompt
- [ ] Verify TTS plays on first customer message without 🔇 button click

### Short-term
- [ ] Second scenario pack (Password Reset / Account Lockout)
- [ ] Timer/SLA display in sidebar during call
- [ ] Call history / transcript in manager view
- [ ] Candidate can edit transcript before sending (dev mode)

### Medium-term
- [ ] Queue mode — multiple calls per assessment
- [ ] Difficulty levels (manager-selectable)
- [ ] Randomised ticket frequency
- [ ] ConnectWise-style ticket management in sidebar
- [ ] Voice interruption/barge-in
- [ ] Scoring tone of voice (post-MVP)

### Long-term
- [ ] Store audio clips for manager review (with consent)
- [ ] Real-time WebRTC phone call mode
- [ ] Classroom/cohort management
- [ ] Leaderboards and achievements
