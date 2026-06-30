# Azure Expressive TTS — CallCallum Source of Truth

Last tested: 2026-06-27
API key: Active (eastus region)
Voices available: 730

---

## 1. Architecture

```
Sim pack (customer config + azureVoice)
  → assessment created → pack_snapshot_json stored in DB
    → candidate takes call → AI customer generates reply text
      → ServiceDeskSimulatorShell calls speak(text, mood, intensity)
        → POST /api/mvp/assessment/[token]/voice/tts { text, mood, intensity }
          → TTS route resolves voice config:
              1. Explicit params from request body (azure_voice, azure_style, etc.)
              2. Pack snapshot azureVoice config (per mood state)
              3. mapMoodToAzureStyle(mood, intensity) (default mapping)
              4. Env var defaults (AZURE_TTS_VOICE, AZURE_TTS_REGION)
          → buildAzureSsml() generates SSML
          → POST to Azure Cognitive Services TTS endpoint
          → Returns audio/mpeg stream to browser
```

Azure Speech is purely a voice renderer. CallCallum owns all scenario logic, emotional state, prompt generation, and customer behaviour. Azure only receives the final text + SSML controls.

---

## 2. API Endpoint

**TTS synthesis:**
```
POST https://{region}.tts.speech.microsoft.com/cognitiveservices/v1
Headers:
  Ocp-Apim-Subscription-Key: {key}
  Content-Type: application/ssml+xml
  X-Microsoft-OutputFormat: audio-24khz-48kbitrate-mono-mp3
Body: SSML string
```

**List available voices:**
```
GET https://{region}.tts.speech.microsoft.com/cognitiveservices/voices/list
Headers:
  Ocp-Apim-Subscription-Key: {key}
```

**Output formats tested:**
| Format | Status | Use |
|--------|--------|-----|
| `audio-24khz-48kbitrate-mono-mp3` | ✅ Works | Recommended for browser playback |
| `audio-24khz-96kbitrate-mono-mp3` | ✅ Works | Higher quality, larger files |

**WAV/PCM formats untested** — use only if needed for downstream audio analysis.

---

## 3. SSML Structure — What Works

### ✅ Working: Plain text (no style, no prosody)

```xml
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-GB">
  <voice name="en-GB-SoniaNeural">
    Hello, this is a test.
  </voice>
</speak>
```

### ✅ Working: Express-as only (emotion style, no prosody)

```xml
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-GB">
  <voice name="en-GB-RyanNeural">
    <mstts:express-as style="angry" styledegree="1.0">
      This should work with Ryan.
    </mstts:express-as>
  </voice>
</speak>
```

### ✅ Working: Prosody wrapping express-as (style + rate/pitch/volume)

```xml
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-GB">
  <voice name="en-GB-RyanNeural">
    <prosody rate="+12%" pitch="+1st" volume="loud">
      <mstts:express-as style="angry" styledegree="1.0">
        I already restarted Outlook. I need this working before payroll.
      </mstts:express-as>
    </prosody>
  </voice>
</speak>
```

### ✅ Working: Prosody only (no style element)

```xml
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-GB">
  <voice name="en-GB-SoniaNeural">
    <prosody rate="+10%" pitch="+1st" volume="loud">
      This is faster and louder but without emotion style.
    </prosody>
  </voice>
</speak>
```

### ❌ NOT Working: Express-as wrapping prosody

```xml
<voice name="...">
  <mstts:express-as style="angry" styledegree="1.0">
    <prosody rate="+12%" pitch="+1st" volume="loud">  <!-- ❌ 400 error -->
      Text here.
    </prosody>
  </mstts:express-as>
</voice>
```

**Rule:** `<prosody>` must be OUTSIDE (wrapping) `<mstts:express-as>`, never inside it.

---

## 4. Voice Availability — en-GB

Tested via voices list endpoint. Only Neural voices support `mstts:express-as`.

| Voice | Styles Available |
|-------|----------------|
| `en-GB-SoniaNeural` (female) | `cheerful`, `sad` |
| `en-GB-RyanNeural` (male) | `cheerful`, `chat`, `whispering`, `sad` |
| `en-GB-AdaMultilingualNeural` | None |
| `en-GB-OllieMultilingualNeural` | None |
| `en-GB-LibbyNeural` | None |

**Important:** Even if a style isn't listed, it may still work. `SoniaNeural + angry` returned audio successfully despite `angry` not being in its StyleList. Azure may silently fallback. But for reliability, use only listed styles per voice.

---

## 5. Prosody Volume — Valid Values

Tested and confirmed:

| Value | Works? |
|-------|--------|
| `silent` | ✅ |
| `x-soft` | ✅ |
| `soft` | ✅ |
| `medium` | ✅ |
| `loud` | ✅ |
| `x-loud` | ✅ |
| `default` | ✅ |
| `+1dB`, `-1dB`, `+2dB` | ❌ **400 error** |

Use descriptive values only. Relative dB notation is not supported by Azure.

Valid values per Azure docs: `silent`, `x-soft`, `soft`, `medium`, `loud`, `x-loud`, `default`.

---

## 6. Mood → Azure Style Mapping

Defined in `mapMoodToAzureStyle()` in `lib/mvp/voice/tts.ts`.

| Mood | Azure Style | Rate | Pitch | Volume | Notes |
|------|------------|------|-------|--------|-------|
| neutral | `chat` | 0% | 0st | medium | Default speaking |
| friendly | `friendly` | 0% | 0st | medium | Warm, approachable |
| confused | `chat` | -5% | 0st | medium | Slower, hesitant |
| rushed | `chat` | +16% | +1st | loud | Fast, pressured |
| frustrated | `angry` | +8% | 0st | loud | Annoyed but controlled |
| angry | `angry` | +12% | +1st | x-loud | Loud and sharp |
| anxious | `terrified` | +10% | +1st | medium | Worried, tense |
| panicked | `terrified` | +18% | +2st | x-loud | Very fast, high-pitched |
| sad | `sad` | -8% | -1st | soft | Slow, quiet |
| relieved | `cheerful` | -2% | 0st | medium | Brighter, relaxed |
| passive_aggressive | `unfriendly` | -2% | -1st | medium | Cold, flat |

**Style fallback chain** (when a voice doesn't support the requested style):

```typescript
const STYLE_FALLBACKS: Record<string, string[]> = {
  angry: ['unfriendly', 'chat'],
  terrified: ['sad', 'chat'],
  unfriendly: ['chat'],
  cheerful: ['friendly', 'chat'],
  friendly: ['chat'],
  sad: ['chat'],
};
```

If the final fallback (`chat`) isn't available either, express-as is omitted and only prosody is used.

---

## 7. Intensity → Style Degree

```typescript
intensity: 0 | 1 | 2 | 3 | 4 | 5

0 → 0.8   (barely noticeable)
1 → 0.9   (subtle)
2 → 1.0   (moderate)
3 → 1.15  (noticeable)
4 → 1.35  (strong)
5 → 1.6   (intense)
```

Avoid extreme values by default. Overacting makes the sim feel fake.

---

## 8. Character Presets

Defined in `CUSTOMER_PERSONAS` in `lib/mvp/voice/tts.ts`:

```typescript
[
  { id: 'rushed_finance_manager',     locale: 'en-GB', voice: 'en-GB-SoniaNeural', defaultMood: 'rushed',    intensity: 4 },
  { id: 'confused_receptionist',       locale: 'en-GB', voice: 'en-GB-SoniaNeural', defaultMood: 'confused',  intensity: 2 },
  { id: 'annoyed_ceo',                locale: 'en-US', voice: 'en-US-GuyNeural',    defaultMood: 'frustrated', intensity: 4 },
  { id: 'passive_aggressive_office_manager', locale: 'en-GB', voice: 'en-GB-SoniaNeural', defaultMood: 'passive_aggressive', intensity: 3 },
  { id: 'panicked_teacher',           locale: 'en-GB', voice: 'en-GB-SoniaNeural', defaultMood: 'panicked',   intensity: 4 },
  { id: 'non_technical_employee',     locale: 'en-GB', voice: 'en-GB-SoniaNeural', defaultMood: 'confused',   intensity: 2 },
]
```

---

## 9. Environment Variables

```env
# Required for Azure TTS:
AZURE_TTS_KEY=your_speech_resource_key
AZURE_TTS_REGION=eastus
AZURE_TTS_VOICE=en-GB-SoniaNeural   # default

# Fallback OpenRouter/Kokoro (used if AZURE_TTS_KEY not set):
# VOICE_TTS_MODEL=hexgrad/kokoro-82m
# VOICE_TTS_VOICE=af_heart
```

Stored in `.env.local` (gitignored). Documented in `.env.example`.

---

## 10. Sim Pack Voice Config

Each pack can define per-mood Azure voice config in its customer object:

```typescript
// lib/mvp/sim/packs/password-reset.ts
customer: {
  name: 'David Chen',
  role: 'Paralegal',
  temperament: 'stressed',
  azureVoice: {
    neutral: {
      voiceName: 'en-GB-RyanNeural',
      style: 'worried',
      styleDegree: 0.7,
      rate: '+10%',
      pitch: '+5%',
    },
    frustrated: {
      voiceName: 'en-GB-RyanNeural',
      style: 'angry',
      styleDegree: 1.0,
      rate: '+15%',
      pitch: '+8%',
    },
    reassured: {
      voiceName: 'en-GB-RyanNeural',
      style: 'relieved',
      styleDegree: 0.6,
      rate: '-5%',
      pitch: '-2%',
    },
  },
},
```

If `azureVoice` isn't defined, `mapMoodToAzureStyle()` infers style/rate/pitch from mood + intensity.

---

## 11. Voice Resolution Priority

When a TTS request arrives:

```
1. Request body overrides
     azure_voice, azure_style, azure_rate, azure_pitch

2. Pack snapshot azureVoice[mood]
     Full SSML config for the current mood state

3. mapMoodToAzureStyle(mood, intensity)
     Fallback mapping table (style, rate, pitch, volume)

4. Environment variable defaults
     AZURE_TTS_VOICE, AZURE_TTS_REGION
```

---

## 12. Testing Notes

All tests performed against eastus region with the project's API key.

```bash
# Test basic TTS
node -e "
const key = 'YOUR_KEY';
const ssml = '<speak version=\"1.0\" xmlns=\"http://www.w3.org/2001/10/synthesis\" xml:lang=\"en-GB\"><voice name=\"en-GB-SoniaNeural\">Hello.</voice></speak>';
fetch('https://eastus.tts.speech.microsoft.com/cognitiveservices/v1', {
  method: 'POST',
  headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3' },
  body: ssml
}).then(r => r.ok ? r.arrayBuffer().then(b => console.log('OK', b.byteLength, 'bytes')) : r.text().then(t => console.log('FAIL', t)));
"

# List voices
node -e "
fetch('https://eastus.tts.speech.microsoft.com/cognitiveservices/voices/list', {
  headers: { 'Ocp-Apim-Subscription-Key': 'YOUR_KEY' }
}).then(r => r.json()).then(v => {
  const gb = v.filter(x => x.Locale === 'en-GB' && x.VoiceType === 'Neural');
  gb.forEach(v => console.log(v.ShortName, '—', (v.StyleList||[]).join(', ')));
});
"
```

---

## 13. Key Files

| File | Role |
|------|------|
| `lib/mvp/voice/tts.ts` | SSML builder, mood→style mapper, character presets, Azure/Kokoro synthesis |
| `app/api/mvp/assessment/[token]/voice/tts/route.ts` | TTS API route — resolves voice config from pack + mood |
| `components/mvp/voice/CustomerAudioPlayer.tsx` | Frontend hook — calls TTS with text, mood, intensity |
| `lib/mvp/sim/types.ts` | `SimCustomer` with `azureVoice`, `AzureVoiceConfig`, `getDefaultAzureVoice()` |
| `lib/mvp/sim/snapshot.ts` | Pack snapshot — includes `azureVoice` in frozen pack data |
| `lib/mvp/sim/packs/*.ts` | Each pack has `azureVoice` per mood for its customer |
| `docs/azure-tts.md` | This file — source of truth |
