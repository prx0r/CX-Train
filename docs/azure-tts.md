# Azure Expressive TTS — CallCallum Integration

## Architecture

```
Sim pack (customer + callerBehavior)
  → assessment created → pack_snapshot_json stored in DB
    → candidate takes call → AI customer generates reply text
      → ServiceDeskSimulatorShell calls speak(text, mood, intensity)
        → POST /api/mvp/assessment/[token]/voice/tts { text, mood, intensity }
          → TTS route resolves voice config:
              1. Explicit params from request body
              2. Pack snapshot azureVoice config (per mood)
              3. mapMoodToAzureStyle(mood, intensity) (default mapping)
              4. Env var defaults
          → buildAzureSsml() generates SSML with mstts:express-as
          → POST to Azure Cognitive Services TTS endpoint
          → Returns audio/mpeg stream to browser
```

Azure Speech is purely a voice renderer. CallCallum owns all scenario logic, emotional state, prompt generation, and customer behaviour. Azure only receives the final text + SSML controls.

## Voice Resolution Order

When a TTS request arrives, the voice config is resolved in this priority:

```
1. Request body overrides
     azure_voice, azure_style, azure_rate, azure_pitch

2. Pack snapshot azureVoice (per mood)
     Pack defines voice/style/rate/pitch per mood state.
     Example from password-reset pack:
       neutral:    { style: "worried",  rate: "+10%", pitch: "+5%" }
       frustrated: { style: "angry",    rate: "+15%", pitch: "+8%" }
       reassured:  { style: "relieved", rate: "-5%",  pitch: "-2%" }

3. mapMoodToAzureStyle(mood, intensity)
     Fallback if pack doesn't provide azureVoice.
     Maps 11 CustomerMoods to Azure styles + prosody.

4. Environment variable defaults
     AZURE_TTS_VOICE, AZURE_TTS_REGION
```

## Sim Pack Voice Configuration

Each sim pack can define `azureVoice` in its customer object — a map of mood states to Azure SSML controls:

```typescript
// lib/mvp/sim/packs/password-reset.ts
customer: {
  name: 'David Chen',
  role: 'Paralegal',
  temperament: 'stressed',
  azureVoice: {
    neutral: {
      voiceName: 'en-GB-RyanNeural',   // Azure voice name
      style: 'worried',                 // mstts:express-as style
      styleDegree: 0.7,                 // emotional intensity 0.01-2.0
      rate: '+10%',                     // speaking rate
      pitch: '+5%',                     // voice pitch shift
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

If `azureVoice` is not defined in the pack, the system falls back to `mapMoodToAzureStyle()` which infers style/rate/pitch from the mood and intensity alone.

## Customer Mood Types

```typescript
type CustomerMood =
  | 'neutral'              // Default — calm, cooperative
  | 'friendly'             // Warm, positive interaction
  | 'confused'             // Non-technical, unsure
  | 'rushed'               // Time-pressure, wants speed
  | 'frustrated'           // Annoyed but controlled
  | 'angry'                // Overt anger, raising voice
  | 'anxious'              // Worried, uncertain
  | 'panicked'             // High stress, urgent
  | 'sad'                  // Defeated, disappointed
  | 'relieved'             // Issue resolved, grateful
  | 'passive_aggressive';  // Polite words, cold tone
```

## Mood → Azure Style Mapping

Defined in `mapMoodToAzureStyle()` (`lib/mvp/voice/tts.ts`):

| Mood | Azure Style | Rate | Pitch | Volume | Intensity Effect |
|------|------------|------|-------|--------|-----------------|
| neutral | chat | 0% | 0st | 0dB | Default speaking |
| friendly | friendly | 0% | 0st | 0dB | Warm, approachable |
| confused | chat | -5% | 0st | 0dB | Slower, hesitant |
| rushed | chat | +16% | +1st | +1dB | Fast, pressured |
| frustrated | angry | +8% | 0st | +1dB | Annoyed, controlled |
| angry | angry | +12% | +1st | +2dB | Loud, sharp |
| anxious | terrified | +10% | +1st | 0dB | Worried, tense |
| panicked | terrified | +18% | +2st | +2dB | Fast, high-pitched |
| sad | sad | -8% | -1st | -1dB | Slow, quiet |
| relieved | cheerful | -2% | 0st | 0dB | Brighter, relaxed |
| passive_aggressive | unfriendly | -2% | -1st | 0dB | Cold, flat |

## Intensity → Style Degree

```typescript
intensity: 0 | 1 | 2 | 3 | 4 | 5

0 → 0.8  (barely noticeable)
1 → 0.9  (subtle)
2 → 1.0  (moderate)
3 → 1.15 (noticeable)
4 → 1.35 (strong)
5 → 1.6  (intense)
```

## Character Presets

Pre-defined personas that set default voice, locale, mood, and intensity:

```typescript
CUSTOMER_PERSONAS = [
  {
    id: 'rushed_finance_manager',
    locale: 'en-GB',
    defaultVoice: 'en-GB-SoniaNeural',
    defaultMood: 'rushed',
    defaultIntensity: 4,
    speechPattern: 'short, pressured, practical',
    typicalPressure: 'payroll, board meeting, month end',
  },
  {
    id: 'confused_receptionist',
    locale: 'en-GB',
    defaultVoice: 'en-GB-SoniaNeural',
    defaultMood: 'confused',
    defaultIntensity: 2,
    speechPattern: 'polite, non-technical, unsure of terminology',
    typicalPressure: 'front desk queue, calls waiting',
  },
  {
    id: 'annoyed_ceo',
    locale: 'en-US',
    defaultVoice: 'en-US-GuyNeural',
    defaultMood: 'frustrated',
    defaultIntensity: 4,
    speechPattern: 'direct, impatient, expects fast ownership',
    typicalPressure: 'meeting starting, client presentation',
  },
  {
    id: 'passive_aggressive_office_manager',
    locale: 'en-GB',
    defaultVoice: 'en-GB-SoniaNeural',
    defaultMood: 'passive_aggressive',
    defaultIntensity: 3,
    speechPattern: 'polite words but cold tone',
    typicalPressure: 'recurring issue, previous bad support',
  },
  {
    id: 'panicked_teacher',
    locale: 'en-GB',
    defaultVoice: 'en-GB-SoniaNeural',
    defaultMood: 'panicked',
    defaultIntensity: 4,
    speechPattern: 'fast, worried, distracted',
    typicalPressure: 'lesson starting, projector broken',
  },
];
```

These are used to seed the pack's customer config. The pack can override any field.

## SSML Generation

The `buildAzureSsml()` function (`lib/mvp/voice/tts.ts`) builds the final SSML:

```xml
<speak version="1.0"
       xmlns="http://www.w3.org/2001/10/synthesis"
       xmlns:mstts="https://www.w3.org/2001/mstts"
       xml:lang="en-GB">
  <voice name="en-GB-SoniaNeural">
    <mstts:express-as style="angry" styledegree="1.35">
      <prosody rate="+12%" pitch="+1st" volume="+2dB">
        I already restarted Outlook. I need this working before payroll.
      </prosody>
    </mstts:express-as>
  </voice>
</speak>
```

Key SSML features used:
- **`mstts:express-as`** — emotional style (angry, cheerful, terrified, etc.)
- **`styledegree`** — emotional intensity 0.01–2.0
- **`<prosody rate>`** — speaking speed as percentage
- **`<prosody pitch>`** — voice pitch shift in semitones (st) or percentage
- **`<prosody volume>`** — loudness in dB

## Fallback Behaviour

```
Azure TTS enabled (AZURE_TTS_KEY set)?
  ├── Yes → Azure SSML with mstts:express-as
  │           └── If Azure fails → error (don't silently fallback, caller should retry)
  └── No  → OpenRouter/Kokoro (no style support, plain text)
```

If a voice doesn't support a requested style, `resolveAzureStyle()` walks a fallback chain:

```
angry → unfriendly → chat (no style, prosody only)
terrified → sad → chat
cheerful → friendly → chat
```

## Environment Variables

```env
# Required for Azure TTS:
AZURE_TTS_KEY=your_speech_resource_key
AZURE_TTS_REGION=eastus          # or uksouth, westus, etc.
AZURE_TTS_VOICE=en-GB-SoniaNeural  # default voice name

# Fallback OpenRouter/Kokoro (used if AZURE_TTS_KEY not set):
# VOICE_TTS_MODEL=hexgrad/kokoro-82m
# VOICE_TTS_VOICE=af_heart
```

## Key Files

| File | Role |
|------|------|
| `lib/mvp/voice/tts.ts` | SSML builder, mood→style mapper, character presets, Azure/Kokoro synthesis |
| `app/api/mvp/assessment/[token]/voice/tts/route.ts` | TTS API route — resolves voice config from pack + mood |
| `components/mvp/voice/CustomerAudioPlayer.tsx` | Frontend hook — calls TTS with text, mood, intensity |
| `lib/mvp/sim/types.ts` | `SimCustomer` type with `azureVoice` field, `AzureVoiceConfig`, `getDefaultAzureVoice()` |
| `lib/mvp/sim/snapshot.ts` | Pack snapshot — includes `azureVoice` in frozen pack data |
| `lib/mvp/sim/packs/*.ts` | Each pack has `azureVoice` per mood for its customer |
