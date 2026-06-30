# LTX Video Prompting Guides — Comprehensive Knowledge Base

> Compiled from official documentation, blog posts, tutorials, and community sources.
> Last updated: June 2026

---

## Table of Contents

1. [Model Overview](#1-model-overview)
2. [Prompting Fundamentals (Official)](#2-prompting-fundamentals-official)
3. [Prompt Structure & Formatting](#3-prompt-structure--formatting)
4. [Key Elements to Include](#4-key-elements-to-include)
5. [Camera Motion & Language](#5-camera-motion--language)
6. [Style Modifiers & Visual Details](#6-style-modifiers--visual-details)
7. [Audio & Voice](#7-audio--voice)
8. [Technical Parameters](#8-technical-parameters)
9. [What Works Well](#9-what-works-well)
10. [What to Avoid](#10-what-to-avoid)
11. [Image-to-Video Prompting](#11-image-to-video-prompting)
12. [LipDub (Speech Replacement)](#12-lipdub-speech-replacement)
13. [Fast Flow vs Pro Flow](#13-fast-flow-vs-pro-flow)
14. [Resolution & Specs Matrix](#14-resolution--specs-matrix)
15. [Negative Prompts](#15-negative-prompts)
16. [LoRA Camera Control Adapters](#16-lora-camera-control-adapters)
17. [Sample Prompts](#17-sample-prompts)
18. [Prompt Templates](#18-prompt-templates)
19. [Source URLs](#19-source-urls)

---

## 1. Model Overview

**LTX** is a family of open-source AI video foundation models developed by **Lightricks**.

| Model | Release | Key Features |
|-------|---------|-------------|
| LTX Video (2B params) | Nov 2024 | First open-source text-to-video |
| LTXV-13b | May 2025 | 13B params, 60s+ generation |
| **LTX-2** (19B+ params) | Oct 2025 | Audio-video sync, 4K, 50fps, DiT-based |
| **LTX-2.3** (22B params) | Mar 2026 | Rebuilt VAE, 4x larger text connector, native portrait, HDR, improved prompt adherence |

**LTX-2.3 capabilities:**
- Generates synchronized video + audio in a single pass
- Native 4K (3840x2160) output
- Up to 50 fps and ~20 seconds duration
- Native 9:16 portrait mode
- Open-source (Apache 2.0)
- Fast and Pro generation flows
- LoRA / IC-LoRA support for customization

---

## 2. Prompting Fundamentals (Official)

*Source: [docs.ltx.video prompting guide](https://docs.ltx.video/api-documentation/implementation-guides/prompting-guide.md)*

### Golden Rules
1. **Write as a single flowing paragraph** — gives the model a cohesive scene
2. **Use present tense** verbs for action and movement
3. **Match detail level to shot scale** — close-ups need more precision than wide shots
4. **Describe camera movement relative to the subject**
5. **Aim for 4–8 descriptive sentences**
6. **Keep within 200 words**
7. **Iterate freely** — LTX is designed for fast experimentation

### Prompt Structure (from GitHub README)
Build prompts in this order:
1. Start with main action in a single sentence
2. Add specific details about movements and gestures
3. Describe character/object appearances precisely
4. Include background and environment details
5. Specify camera angles and movements
6. Describe lighting and colors
7. Note any changes or sudden events

### Good Prompting Pattern
```
subject + environment + action + camera move + lighting + texture + mood
```

### Automatic Prompt Enhancement
LTX-2 pipelines support automatic prompt enhancement via an `enhance_prompt` parameter (enabled by default in Studio).

---

## 3. Prompt Structure & Formatting

### Cinematography-First Approach
Think like a cinematographer describing a shot list. Start directly with the action.

**Example structure:**
```
[SHOT TYPE]. [LOCATION] – [TIME] – [GENRE]
[Scene description: environment, lighting, atmosphere]
[Subject description: appearance, clothing, expression]
[Action sequence flowing from beginning to end]
[Camera movement: how and when it moves]
[Dialogue in "quotation marks"]
[Audio: ambient sounds, music]
```

### Shot scale indicators
- Wide establishing shot
- Medium shot
- Close-up / Extreme close-up
- Over-the-shoulder
- Overhead view

### Pacing & temporal effects
- Slow motion
- Time-lapse
- Rapid cuts
- Lingering shot / Continuous shot
- Freeze-frame / Fade-in / Fade-out
- Seamless transition / Sudden stop

---

## 4. Key Elements to Include

### 1. Establish the Shot
Use cinematography terms: "Cinematic wide shot," "Extreme close-up," "Handheld medium shot," "Static camera," "Aerial drone shot"

### 2. Set the Scene
- Lighting conditions: golden hour, neon glow, dramatic shadows, soft diffused light, flickering candles
- Color palette: vibrant, muted, monochromatic, high contrast, warm amber, cool blue
- Surface textures: rough stone, smooth metal, worn fabric, glossy, wet
- Atmosphere: fog, mist, rain, dust, smoke, particles

### 3. Describe the Action
Write as a natural sequence from beginning to end. Be specific about movements and gestures.

### 4. Define Characters
- Age, hairstyle, clothing, distinguishing features
- Express emotion through **physical cues** (facial expressions, posture, gestures) — NOT abstract labels like "sad" or "confused"

### 5. Identify Camera Movement
Specify when and how the camera moves. Describe how subjects appear AFTER the movement. ("The camera pans right, revealing...")

### 6. Describe the Audio
- Place dialogue in **quotation marks**
- Specify language and accent if needed
- Describe ambient sound, music, voice style

---

## 5. Camera Motion & Language

### Camera Movement Keywords
| Term | Description |
|------|-------------|
| Dolly in / Push in | Camera moves toward subject |
| Dolly out / Pull back | Camera moves away from subject |
| Dolly left / Dolly right | Camera moves sideways |
| Pan left / Pan right | Camera rotates horizontally |
| Tilt up / Tilt down | Camera rotates vertically |
| Track / Follows | Camera moves alongside subject |
| Circles around / Orbits | Camera moves in an arc around subject |
| Crane up / Jib up | Camera rises upward |
| Crane down / Jib down | Camera lowers |
| Handheld | Unsteady, documentary-style movement |
| Static frame | No camera movement |
| Overhead / Top-down | Bird's eye view |
| Over-the-shoulder | Shot from behind a character |
| Zoom in / Zoom out | Lens zoom (different from dolly) |

### Camera Control LoRAs (LTX-2)
Dedicated LoRA adapters for precise camera control:
- Dolly In / Dolly Out / Dolly Left / Dolly Right
- Jib Up / Jib Down
- Static Camera

*Source: [huggingface.co/Lightricks](https://huggingface.co/Lightricks)*

---

## 6. Style Modifiers & Visual Details

### Animation Styles
- Stop-motion
- 2D animation / 3D animation
- Claymation
- Hand-drawn
- Pixar style
- Anime

### Stylized Aesthetics
- Comic book
- Cyberpunk
- 8-bit pixel
- Surreal
- Minimalist
- Painterly
- Illustrated
- Film noir
- Fashion editorial
- Analog film

### Cinematic Genres
- Period drama
- Fantasy
- Epic space opera
- Thriller
- Modern romance
- Experimental film
- Arthouse
- Documentary
- Horror
- Sci-fi

### Lighting Keywords
- Soft rim light
- Backlighting
- Golden hour
- Neon glow
- Natural sunlight
- Dramatic shadows
- Flickering candles / lamps
- High contrast
- Soft diffused

### Film Characteristics
- Film grain
- Lens flares
- Motion blur
- Depth of field
- Shallow depth of field
- Bokeh
- Chromatic aberration

### Color Palettes
- Vibrant / Saturated
- Muted / Desaturated
- Monochromatic
- High contrast
- Warm amber tones
- Cool blue and magenta
- Black and white

### Atmosphere Elements
- Fog / Mist
- Rain / Drizzle
- Dust / Particles
- Smoke
- Steam
- Reflections

---

## 7. Audio & Voice

### Ambient Settings
- Coffeeshop noise
- Wind and rain
- Forest ambience with birds
- Live music venue
- Construction site
- Hum of chatter
- Distant drilling

### Dialogue Style
- Energetic announcer
- Resonant voice with gravitas
- Distorted radio-style
- Robotic monotone
- Childlike curiosity
- Dramatic whisper
- Shouting over noise

### Volume
- Whisper
- Mutter
- Shout / Scream
- Quietly

### Languages Supported for Speech
English, French, Spanish, German, Russian (validated for LipDub)

---

## 8. Technical Parameters

### Generation Flows: Fast vs Pro

| Aspect | Fast Flow | Pro Flow |
|--------|-----------|----------|
| Best for | Ideation, iteration, storyboarding | Final renders, production output |
| Speed | Faster turnaround | Slower, quality-focused |
| Duration | Up to 20s | Up to 10s |
| Resolution | Up to 4K | Up to 4K |
| Use case | Volume exploration | Polished final output |

**Workflow:** Start with Fast for exploration → move winning prompts to Pro for final render.

### CFG (Classifier-Free Guidance)
- **Distilled model:** CFG=1 (baked into distillation). Do NOT raise significantly.
- Increasing CFG above 1 doubles forward passes per step and can cause oversaturation/distortion.
- If experimenting, stay in **1.0–1.5** range.

### Steps
- **Distilled pipeline:** 8 steps (Stage 1) + 3 steps (Stage 2) = 11 total
- **Full model pipeline:** 15–40 steps, uses LTXV Scheduler
- **Full model + LoRA strength:** 0.2 (distilled) vs 0.5 (default template)

### Inference Steps for Different Models
| Pipeline | Steps Stage 1 | Steps Stage 2 |
|----------|--------------|---------------|
| DistilledPipeline | 8 | 4 |
| TwoStageDistilled | 8 | 3 |
| Full model | 15-40 | N/A |

### Frame Rate Options
- 24 fps (cinematic feel)
- 25 fps (standard)
- 30 fps (smoother motion)
- 48 fps / 50 fps (high frame rate)

### Resolution Options
- 1080p: 1920x1080 (landscape) / 1080x1920 (portrait)
- 1440p: 2560x1440 (landscape) / 1440x2560 (portrait)
- 4K: 3840x2160 (landscape) / 2160x3840 (portrait)

### Duration
- Fast Flow: up to 20 seconds (at 1080p/25fps)
- Pro Flow: up to 10 seconds
- Frame count = duration × frame rate + 1

### Samplers
- Distilled: `euler_ancestral_cfg_pp` (Stage 1), `euler_cfg_pp` (Stage 2)
- Full model: LTXV Scheduler, multimodal guider with independent audio/video guidance

---

## 9. What Works Well

| Strength | Description |
|----------|-------------|
| **Cinematic compositions** | Wide, medium, and close-up shots with thoughtful lighting, shallow depth of field, natural motion |
| **Emotive human moments** | Strong single-subject emotional expressions, subtle gestures, facial nuance |
| **Atmosphere & setting** | Fog, mist, golden-hour light, rain, reflections, ambient textures |
| **Clear camera language** | Explicit instructions like "slow dolly in" or "handheld tracking" |
| **Stylized aesthetics** | Painterly, noir, analog film, fashion editorial, pixelated animation |
| **Lighting & mood control** | Backlighting, color palettes, rim light, flickering lamps |
| **Voice/Speech** | Characters can talk and sing in multiple languages |
| **Dialogue in quotation marks** | Clearly delineated speech improves audio generation |
| **Present tense verbs** | "walks," "turns," "says" — keeps action immediate |

### Image-to-Video Sweet Spot
LTX 2.3 has improved I2V motion with reduced "Ken Burns effect" and static outputs. Strong for animating existing images with natural motion.

### Prompt Adherence Improvements (LTX 2.3)
The 4x larger text connector means LTX 2.3 is better at:
- Following multi-subject prompts
- Preserving left/right and foreground/background relationships
- Holding onto more attributes from longer prompts
- Keeping cinematic instructions coherent across the clip

---

## 10. What to Avoid

| Avoid | Reason |
|-------|--------|
| **Internal emotional states** | Use visual cues (posture, gesture, facial expression) instead of labels like "sad" or "confused" |
| **Text and logos** | Readable text is not currently reliable — avoid signage, brand names, printed material |
| **Complex physics / chaotic motion** | Non-linear motion (jumping, juggling) can introduce artifacts — dancing is OK |
| **Overloaded scenes** | Too many characters/actions/objects reduces clarity and accuracy |
| **Conflicting lighting logic** | Mixed light sources confuse scene interpretation (e.g., "warm sunset with cold fluorescent glow") |
| **Overcomplicated prompts** | Start simple and layer complexity gradually; more instructions = higher chance some are missed |
| **Excessive word count** | Keep within 200 words |

### Known Limitations
- Occasional lip-sync inconsistencies in long scenes
- Artifacts in complex multi-person scenes
- Text rendering within video is unreliable

---

## 11. Image-to-Video Prompting

When starting from an image, your prompt should focus on **what happens next** rather than describing the scene (the image already provides that).

### I2V Prompt Focus
- **Motion and action** — how subjects should move or change over time
- **Camera movement** — tracking, panning, zooming, or static shots
- **Audio** — dialogue (in quotation marks), music, ambient sound

### I2V Template
```
[Subject] [does what action]. [Camera movement description].
[Audio description: "dialogue" or ambient sounds].
```

**Example:**
> "The woman turns to face the camera and smiles, a warm breeze moving through her hair. Soft piano music plays in the background."

### Technical Settings (ComfyUI default)
- Image conditioning strength: 0.7 (Stage 1), 1.0 (Stage 2)
- Source image sets the first frame
- Model generates motion and audio from that starting point

---

## 12. LipDub (Speech Replacement)

For replacing dialogue in existing video (video-to-video, IC-LoRA).

### Prompt Template
```
[Speaker] is speaking [Language/Accent], saying: "[Dialogue]"
```

**Example:**
> A woman speaking in Russian saying: "Сегодня отличный день, чтобы протестировать рабочие процессы ComfyUI для дубляжа с использованием LTX."

### Best Practices
- **Provide full dialogue text** — model follows content, does NOT translate
- **Use native script** — write in the target language's alphabet (Cyrillic, Chinese characters, etc.)
- **Single speaker only** — beta IC-LoRA doesn't distinguish multiple speakers
- **Match audio length** — keep prompt at similar timing/syllable length to original
  - Too long: model may skip words
  - Too short: output may sound slow and unnatural

### Validated Languages
English, French, Spanish, German, Russian

---

## 13. Fast Flow vs Pro Flow

| | Fast Flow | Pro Flow |
|---|---|---|
| **Best fit** | Ideation, iteration, storyboard passes | Final output, higher-fidelity renders |
| **Speed** | Faster turnaround | Slower, more quality-focused |
| **Duration** | Up to 20s | Up to 10s |
| **Resolution** | Up to 4K | Up to 4K |
| **Pricing** | Lower cost per second | Higher cost per second |
| **Endpoints** | text-to-video, image-to-video | All endpoints including audio-to-video, retake, extend |

**Workflow recommendation:** Start with Fast to explore compositions, switch to Pro for final render.

---

## 14. Resolution & Specs Matrix

### LTX-2.3 Model Support

| Model | Resolution | FPS | Duration (seconds) |
|-------|-----------|-----|-------------------|
| ltx-2-3-fast | 1080p | 24, 25 | 6, 8, 10, 12, 14, 16, 18, 20 |
| ltx-2-3-fast | 1080p | 48, 50 | 6, 8, 10 |
| ltx-2-3-fast | 1440p | 24, 25, 48, 50 | 6, 8, 10 |
| ltx-2-3-fast | 4K | 24, 25, 48, 50 | 6, 8, 10 |
| ltx-2-3-pro | 1080p | 24, 25, 48, 50 | 6, 8, 10 |
| ltx-2-3-pro | 1440p | 24, 25, 48, 50 | 6, 8, 10 |
| ltx-2-3-pro | 4K | 24, 25, 48, 50 | 6, 8, 10 |

### Aspect Ratios
| Resolution | 16:9 (landscape) | 9:16 (portrait) |
|-----------|------------------|-----------------|
| 1080p | 1920x1080 | 1080x1920 |
| 1440p | 2560x1440 | 1440x2560 |
| 4K | 3840x2160 | 2160x3840 |

Video dimensions must be divisible by 32.

---

## 15. Negative Prompts

Default negative prompt used in LTX-2.3 ComfyUI templates:
```
pc game, console game, video game, cartoon, childish, ugly
```

You can customize the negative prompt to steer away from specific unwanted qualities. Add descriptive terms for artifacts you're seeing (specific visual styles, lighting issues, motion artifacts).

For the **distilled model**: CFG is always 1. The negative prompt still influences the output through the text encoder guidance mechanism.

---

## 16. LoRA Camera Control Adapters

Official LTX-2 camera control LoRAs available on HuggingFace:

| LoRA | Description |
|------|-------------|
| Camera Control Dolly In | Push toward subject |
| Camera Control Dolly Out | Pull away from subject |
| Camera Control Dolly Left | Move camera left |
| Camera Control Dolly Right | Move camera right |
| Camera Control Jib Up | Raise camera |
| Camera Control Jib Down | Lower camera |
| Camera Control Static | Lock camera position |

### LoRA Strength Guidelines
- **0.9–1.1**: Subtle effect
- **1.2–1.4**: Balanced, recommended for most use cases
- **1.5–1.6**: Strong effect, maximum style transfer

**Best practices:**
- Keep total combined strength under 2.0
- Test combinations incrementally
- Effect LoRAs combine better than control LoRAs
- Avoid mixing multiple IC-LoRA control types

---

## 17. Sample Prompts

### Product Ad
> "A premium glass perfume bottle on a wet black stone surface, tiny water droplets and soft mist in the air, camera slowly pushes in, dramatic rim light, high contrast reflections, luxury commercial style, ultra-detailed textures"

### Portrait Social Video (9:16)
> "A stylish woman in a red leather jacket walking through a neon-lit city street at night, vertical 9:16 composition, subtle handheld camera movement, glowing signs in the background, cinematic depth of field, realistic motion, cool blue and magenta lighting"

### Cinematic Action
> "Cinematic wide shot of a rugged desert mountain range at golden hour. A towering sandstone peak catches warm orange light, overlooking a vast arid basin and layered rocky hills under a soft, hazy pastel sky."

### Dialogue Scene
> "A news reporter standing in front of cordoned-off cars, yellow caution tape fluttering behind him. Warm early sun reflecting off the camera lens. He looks directly into the camera: 'Thank you, Sylvia. Black gold has been found!' The camera pans right revealing a construction site. A geyser of oil erupts from the ground."

### Animation/Humor
> "A calm sunlit frog yoga studio. The senior frog instructor sits cross-legged, voice deep: 'We are one with the pond.' All frogs answer: 'Ommm...' The camera pans to a frog who suddenly snaps its tongue out catching a fly. The master exhales: 'But we do not chase the flies... not during class.'"

### Image-to-Video Motion
> "Animate the subject naturally with a gentle head turn and fabric movement, preserve facial identity, avoid aggressive zoom, realistic body motion, soft cinematic lighting, stable framing"

### Aerial / Landscape
> "A cinematic wide aerial shot of a rugged desert mountain range at golden hour. A towering sandstone peak catches warm orange light, overlooking a vast arid basin under a soft hazy pastel sky."

### Horror / Atmosphere
> "A live-action horror style, thick black oily tentacles slither across the floor and furniture of a living room. Dark, glowing eyes peer through a heavy mist, creating an atmosphere of eerie supernatural dread."

### Stop-Motion Style (with LoRA)
> "A stop-motion style scene featuring birds made of yellow felt. One bird approaches a birdhouse and shares a worm with another, showcasing the tactile textures of wool, cardboard, and twine in a miniature set."

### Audio-to-Video / Dialogue
> "The camera opens on a woman in her 30s sitting at a desk, holding a photograph. She looks up and says softly: 'I never thought I'd see this again.' Her voice trembles with emotion. Warm afternoon light streams through a window behind her."

---

## 18. Prompt Templates

### General Purpose Template
```
[Shot type], [location] at [time of day]. [Subject description] [action/verb], [detail about how]. The camera [camera movement], [what is revealed]. [Lighting/atmosphere description], [color palette]. [Audio description: "dialogue" or ambient sounds].
```

### Product Ad Template
```
A premium [product description] on [surface/environment], [atmospheric details], camera [camera movement], [lighting style], [color treatment], [commercial genre/style], [texture details]
```

### Portrait / Character Template
```
A [age/gender] [character description] wearing [clothing] [action] in [environment], [aspect ratio if portrait], [camera style], [background details], [lighting], [mood/emotion via physical cues]
```

### Action Scene Template
```
[Cinematic style] shot of [subject] [action] towards/from/through [location]. The camera [movement] as [subject] [follow-up action]. [Environmental details: dust, motion blur, etc.]. [Secondary action or reveal].
```

### Multi-Character Dialogue Template
```
[Shot type] of [character A] and [character B] in [location]. [Character A], [emotional state], [action/gesture]: "[Dialogue line 1]" [Character B] [reaction]: "[Dialogue line 2]" The camera [movement] revealing [new information or character]. [Audio: ambient sound].
```

---

## 19. Source URLs

### Official Documentation
- https://docs.ltx.video/api-documentation/implementation-guides/prompting-guide.md
- https://docs.ltx.video/open-source-model/usage-guides/text-to-video.md
- https://docs.ltx.video/open-source-model/usage-guides/image-to-video.md
- https://docs.ltx.video/open-source-model/usage-guides/lo-ra.md
- https://docs.ltx.video/open-source-model/advanced-workflows/two-stage-distilled.md
- https://docs.ltx.video/models.md
- https://docs.ltx.video/llms.txt

### Official LTX Site
- https://ltx.io/model/ltx-2
- https://ltx.video/blog/how-to-prompt-for-ltx-2
- https://ltx.io/blog-category/tutorials

### GitHub
- https://github.com/Lightricks/LTX-2
- https://github.com/Lightricks/LTX-2.3

### HuggingFace
- https://huggingface.co/collections/Lightricks/ltx-23
- https://huggingface.co/Lightricks/LTX-2.3

### Community Guides
- https://veevid.ai/blog/ltx-2-3-complete-guide
- https://civitai.com/models/2448150/ltx-23

### Wikipedia
- https://en.wikipedia.org/wiki/LTX_(text-to-video_model)
