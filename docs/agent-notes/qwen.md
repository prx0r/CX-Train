# Qwen Pathway — Local Model Distillation for CX-Train

> **Strategy:** Replace the prompt-based AI extraction call with a fine-tuned small language model.
> **Moat:** Managers train proprietary models on their own data. Data never leaves their infrastructure.
> **End State:** Self-improving loop where every assessment and every manager review trains the model.

---

## The Core Insight

The frameworks are the grading rubric. Every assessment produces a labeled training example:

```
Input:  transcript text + ticket text + action timeline
Label:  framework criteria statuses (42 binary/ternary judgments)
Output: per-criterion pass/fail/partial → category scores → total score
```

This means: **the assessment pipeline is a labeling machine.** Every call scored by the prompt-based AI produces a high-quality training example for a smaller model to learn from.

---

## Why Qwen Specifically

| Criterion | Qwen 2.5 0.5B | Qwen 2.5 1.5B | Qwen 2.5-VL 7B |
|-----------|---------------|---------------|-----------------|
| Parameters | 494M | 1.54B | 7.6B |
| Inference (CPU) | ~50ms | ~200ms | N/A |
| Inference (GPU) | ~10ms | ~50ms | ~200ms |
| Context length | 32K tokens | 32K tokens | 32K tokens |
| Quantized (4-bit) | < 1GB RAM | ~1.5GB RAM | ~5GB RAM |
| License | Apache 2.0 | Apache 2.0 | Apache 2.0 |
| Multi-modal | No | No | **Yes** (vision) |
| Fine-tune cost | ~1hr on RTX 3090 | ~3hr on RTX 3090 | ~8hr on A100 |

**Selection rationale:**
- 0.5B for pure text extraction (cheapest, fastest, runs anywhere)
- 1.5B if higher accuracy needed (still fits in consumer GPU memory)
- 7B VL for screen recording analysis (vision-language understanding)

---

## The Moat

### What Competitors Can't Copy

| Asset | How It's Built | Why It's a Moat |
|-------|---------------|-----------------|
| **Framework definitions** | Hand-authored from SERVQUAL, Kepner-Tregoe, ITIL, SBAR, LEAP/HEAT | Legitimate frameworks that took months to research, validate, and codify |
| **Labeled training data** | Every assessment run produces (transcript → criteria labels) pairs | Data is proprietary to each deployment. One MSP's data is useless to another's model |
| **Manager feedback loop** | Managers adjust scores → corrections become training data | The model converges toward each manager's standards. A competitor's model doesn't know your manager's preferences |
| **Prompt distillation** | The prompt-based AI (deepseek-v4-flash) generates the initial labels | The prompt is a bootstrap mechanism. The trained model replaces it entirely — no prompt to copy |
| **Deployment-specific tuning** | Each customer fine-tunes on their own calls | Model learns client-specific terminology, playbooks, and escalation patterns |
| **Multi-modal data** | Screen recordings from remote desktop sessions | Unique data modality. No competitor has candidate navigation patterns at scale |

### The Data Network Effect

```
More assessments → more labeled data → better model → 
  more accurate scoring → more customers trust the scores → 
    more assessments run on platform → more labeled data
```

This is a **data moat**. Each deployment's model improves with use. A new competitor starts from zero labeled data and must bootstrap from prompts alone.

### Privacy as a Feature

UK GDPR, ICO guidelines, and the Employment Practices Code all push toward:
- Data minimisation (Article 5(1)(c))
- Automated decision-making protections (Article 22)
- Transparency in employee monitoring

The Qwen architecture addresses all three by design:
- **Data never leaves the customer's system.** The model runs locally, inference is local, training is local.
- **No raw data is stored.** Screen recordings are processed in memory and deleted immediately. Only structured scores persist.
- **The decision is assistive.** A human manager makes the final readiness call. The model scores criteria — it doesn't hire or fire.

---

## Multi-Modal Expansion

### Phase 1: Text Only (Current → Distill)

```
Input:  transcript + ticket text
Model:  Qwen 0.5B fine-tuned on 42 criteria
Output: per-criterion statuses → framework scores → category scores
```

This replaces the deepseek-v4-flash extraction call entirely.

### Phase 2: Action Logs (Add Behavioral Data)

The simulator logs every action the candidate takes:
- Tool opened
- Command run
- Settings checked
- Button clicked
- Time spent per action

These are structured events with timestamps. A small classifier (not even a full LLM) can learn scoring patterns:
```
"Opened Event Viewer → checked System log → filtered by Error" → scores technical_discovery = pass
"Clicked password reset without checking identity" → scores safety = fail
```

The event sequence becomes a feature vector fed into a lightweight classifier (XGBoost or small transformer head on Qwen embeddings).

### Phase 3: Screen Recording (Vision-Language)

The candidate's remote desktop session is recorded as screen frames. Qwen2.5-VL 7B processes frames and extracts:

```
Frame seq 10-25:  "Candidate opens Outlook → checks status bar → 
                   sees 'Working Offline' → navigates to Send/Receive tab"
           → scores technical_discovery = pass, error_or_status_capture = pass

Frame seq 40-55:  "Candidate goes to File → Account Settings → 
                   repairs profile" → scores fix_attempt = pass
```

**Key constraints:**
- Frames processed at 1 fps (not continuous — too expensive)
- Only the remote desktop window is captured (not the whole screen)
- Raw footage is never stored — only the structured frame analysis
- Processing happens entirely on-device

### Phase 4: Multi-Modal Fusion

The text model and vision model outputs are combined:

```python
# Fusion layer
text_scores = text_model(transcript, ticket)        # per-criterion from dialogue
action_scores = action_classifier(action_sequence)   # per-criterion from tool use  
vision_scores = vl_model(screen_frames)              # per-criterion from navigation

# Weighted combination
# (weights learned from manager feedback — not hardcoded)
final_scores = {
    "identity_check":     0.5 * text["identity_check"] + 0.5 * action["identity_check"],
    "technical_discovery": 0.3 * text["technical_discovery"] + 
                           0.3 * action["technical_discovery"] + 
                           0.4 * vision["technical_discovery"],
    "customer_tone":       1.0 * text["customer_tone"],  # text-only — tone is in the words
    ...
}
```

### Phase 5: Customer Simulator (AI Acts)

This is the hardest and most valuable piece. If the model can **score** calls, it can also **simulate** callers:

```
Training data:  thousands of real transcripts from candidate-customer interactions
Trained model:  Qwen 1.5B fine-tuned to play the customer role
Input:          "Candidate asks: 'What error message do you see?'"
Output:         "Customer says: 'It says access denied. I need this file by 3pm.'"
```

This would let the system:
- Generate infinite realistic training scenarios without writing pack scripts
- Adapt the customer's behaviour to the candidate's skill level (harder for strong candidates)
- Produce realistic, varied calls instead of scripted sims

A Qwen 0.5B can be fine-tuned for role-play on ~500 real transcripts. The same architecture that scores calls also generates training data for itself.

### Phase 5a: Voice Recording → Voice Model

Every candidate call is already recorded (voice session). This is currently transcribed for text analysis, but the raw audio contains information the transcript loses:

| Audio Feature | What It Reveals | Current Use | Future Use |
|--------------|----------------|------------|------------|
| Tone of voice | Frustration, confidence, hesitation | ❌ Lost in transcription | ✅ Model assesses tone directly |
| Pause length | Hesitation, uncertainty, thinking time | ❌ Not captured | ✅ Timing analysis per response |
| Interruptions | Candidate cut off customer? | ❌ Not measured | ✅ Professionalism scoring |
| Speech rate | Rushed? Calm? Slow? | ❌ Not captured | ✅ Communication style assessment |
| Background noise | Professional environment? | ❌ Not captured | ✅ Context indicator |

**Voice model training pipeline:**

```
Raw call audio
  → WhisperX (diarized transcription, speaker labels, timestamps)
  → Transcript: sent to text model for criteria scoring
  → Audio features: sent to audio encoder (HuBERT/Wav2Vec2)
  → Combined: text + audio features → criterion scores
```

The audio model doesn't need to be large. A lightweight classifier on-top of HuBERT embeddings can detect tone, pace, and interruptions from ~500 labeled calls. This runs in real-time during the call.

**Voice response model (AI plays the customer):**

```
Training data:  thousands of real call recordings from actual support interactions
Trained model:  Qwen 2.5-Audio or CosyVoice 2 (Alibaba's open-source voice model)
Input:          "Candidate says 'Can you try checking your internet connection?'"
Output:         "I already checked that. The wifi is working. It's Outlook that's broken."
                (spoken in appropriate tone, with appropriate pacing)
```

Alibaba's **CosyVoice 2** is Apache 2.0 licensed, supports voice cloning with <10 seconds of reference audio, and runs on a single GPU. Combined with Qwen for dialogue logic, the pipeline is:

```
Qwen 1.5B (dialogue + intent) → CosyVoice 2 (voice synthesis) → natural-sounding customer
```

This means:
- The AI customer sounds like a real person, not a text-to-speech robot
- Multiple customer personas (frustrated, confused, technical, non-technical)
- The caller's emotion adapts to the candidate's handling
- No more scripted sims — every call is unique

**Linking calls to assessment frameworks:**

Every call recording is already linked to an assessment. The pipeline becomes:

```
Call recording
  → WhisperX transcription
  → Text model scores 42 criteria across 10 frameworks
  → Audio model scores tone, pace, interruptions
  → Combined scores stored with assessment
  → Frameworks compute category + total scores
  → Manager reviews, provides feedback
  → Feedback becomes training data for next model iteration
```

No extra step. The recording is captured, processed, scored, and the scores feed the same framework pipeline. The frameworks are the constant — the input modalities (text, then audio, then video) expand over time.

---

### Phase 5b: Action Timeline → Troubleshooting Steps Score

The simulator already records every action the candidate takes:

```json
[
  {"time_s": 5,   "action": "customer_message", "text": "My email isn't working"},
  {"time_s": 12,  "action": "candidate_message", "text": "What's your name?"},
  {"time_s": 25,  "action": "tool_opened", "tool": "outlook"},
  {"time_s": 30,  "action": "action_performed", "action_id": "check_status_bar"},
  {"time_s": 40,  "action": "observation_returned", "text": "Outlook shows 'Working Offline'"},
  {"time_s": 55,  "action": "action_performed", "action_id": "check_network_settings"},
  {"time_s": 70,  "action": "action_performed", "action_id": "toggle_work_offline"},
  {"time_s": 85,  "action": "observation_returned", "text": "Emails start sending"},
  {"time_s": 95,  "action": "action_performed", "action_id": "send_test_email"},
  {"time_s": 105, "action": "candidate_message", "text": "Can you confirm you received the test email?"}
]
```

Currently, this timeline is dumped into the AI prompt as raw text. The AI has to parse it from the transcript noise. Instead, we should structure it into a **troubleshooting path analysis**:

| Action Sequence | Kepner-Tregoe Step | Score |
|----------------|-------------------|-------|
| Checked status bar → saw "Working Offline" | Problem Analysis (defined what IS happening) | ✅ |
| Checked network settings → confirmed connectivity | Distinction Analysis (IS vs IS NOT) | ✅ |
| Toggled Work Offline → emails sent | Tested possible cause → confirmed fix | ✅ |
| Sent test email → verified with customer | Confirmed root cause | ✅ |

**Troubleshooting path classifier:**

```python
# Lightweight classifier (not a full LLM)
# Input: sequence of action IDs with timestamps
# Output: Kepner-Tregoe step completion

actions = [
    ("check_status_bar", 30),
    ("check_network_settings", 55),
    ("toggle_work_offline", 70),
    ("send_test_email", 95),
]

# Feature vector:
# - Did they observe before acting? (observation_returned before action_performed)
# - Did they test one thing at a time? (no overlapping diagnostics)
# - Did they verify? (send_test_email after fix)
# - Time per step (efficient vs meandering)

features = extract_features(actions)
kt_score = lightgbm.predict(features)  # ~1ms inference
```

This runs in <1ms per assessment and feeds directly into the Kepner-Tregoe framework criteria. No AI call needed for structured action analysis.

---

### Phase 5c: Customer Simulator (AI Acts, Voice)

Combining all the pieces:

```
Candidate speaks to AI customer
  → AI customer responds via CosyVoice 2 voice synthesis
  → Candidate performs actions in remote desktop
  → Action timeline scored by troubleshooting classifier
  → Call audio scored by voice model
  → Transcript scored by Qwen text model
  → All scores combined → framework criteria → category scores → total
```

The same system that **assesses** candidates also **simulates** the customer. The more assessments run, the better the customer simulation becomes, which produces more varied training scenarios, which improves the assessment model.

**The flywheel:**

```
More assessments → more action data → better troubleshooting classifier
                 → more call recordings → better voice model
                 → more transcripts → better text model
                 → better customer simulation
                 → more realistic assessments
                 → more assessments run
```

---

## Edge Cases for Testing

Beyond the 5 existing tricky transcripts, these edge cases should be tested to validate the multi-framework architecture:

### Conduct Edge Cases

| Edge Case | Scenario | What It Probes |
|-----------|----------|----------------|
| **E1 — Right fix, wrong reason** | Candidate does the correct fix but for the wrong reason (lucky guess). E.g., rebuilds Outlook profile because "it always fixes it" without checking status first | Kepner-Tregoe: `kt_test_causes` should fail. The fix worked but the diagnostic process was wrong |
| **E2 — Perfect escalation** | Candidate escalates with full SBAR: clear situation, relevant background, accurate assessment, actionable recommendation. Second-line can resolve immediately | SBAR: all 4 criteria should pass. ITIL Incident: escalation timing and context should pass |
| **E3 — Long silence, then fix** | Candidate goes silent for 5+ minutes, then announces the fix without explaining what they did | Customer Experience: `servqual_responsiveness_updates` should fail. Process: `sd_ownership` borderline |
| **E4 — Argues with customer** | Customer insists the issue is X. Candidate argues it's Y without checking either. Customer gets frustrated | Professional conduct fail. Empathy fail. Troubleshooting fail (didn't test either hypothesis) |
| **E5 — Script-bound** | Candidate follows the playbook perfectly but can't handle when the customer deviates from the script | Adaptability assessment. Not captured by current criteria — may need a new criterion |
| **E6 — Over-explains** | Candidate gives a 5-minute technical explanation using jargon. Customer is confused | SBAR: situation/recommendation may pass but assessment is too long. SERVQUAL empathy/individualized fails |
| **E7 — Multi-task** | Candidate handles a chat while on the call. Both interactions get partial attention | Multi-tasking assessment. Current system can't measure this — needs parallel session analysis |
| **E8 — Too slow** | Candidate takes 45 minutes to resolve a 10-minute issue. Steps are correct but meandering | ITIL Incident: initial diagnosis time breached. Timing metrics captured but not yet scored as criteria |

### Technical Edge Cases

| Edge Case | Scenario | What It Probes |
|-----------|----------|----------------|
| **E9 — Fix creates security risk** | Candidate solves the user's problem but disables security controls to do it (e.g., disables firewall, makes admin account) | Security frameworks should fail even though troubleshooting passes. This tests the category separation |
| **E10 — Correct diagnosis, no fix** | Candidate correctly identifies the issue but doesn't know how to fix it. Escalates appropriately | Kepner-Tregoe passes (diagnosis correct). ITIL escalation passes. Resolution frameworks fail. Tests balanced scoring |
| **E11 — Chat-only support** | No call, just ticket updates and chat messages. Candidate handles 3 simultaneous chats | Different assessment mode. Current criteria assume synchronous call. Needs mode-specific thresholds |
| **E12 — Email thread** | Full resolution happens via email. Candidate responds once, user follows instructions | Email mode. No tone/empathy scoring from text alone. Different criteria set needed |
| **E13 — Hardware dispatch** | Candidate diagnoses hardware failure and dispatches replacement. No remote fix | Resolution is indirect. Current criteria expect direct fix. Process frameworks should capture dispatch workflow |
| **E14 — Password reset marathon** | Candidate handles 15 password resets in a shift. Each one is identical | Monotony assessment. Do they follow the same process every time? Consistency scoring |
| **E15 — VPN down, entire company** | Company-wide outage. Candidate handles correctly but SLA is breached due to volume | Major incident handling. Current criteria assume single-user scenario. Needs scale-aware scoring |

---

## Regulatory Analysis (UK)

### UK GDPR

| Article | Relevance | How CX-Train Addresses It |
|---------|-----------|--------------------------|
| Art. 5(1)(c) — Data minimisation | Only collect what's necessary | Raw transcripts kept only until scoring. Screen recordings processed in memory, never stored |
| Art. 5(1)(e) — Storage limitation | Delete when no longer needed | Assessment data retained per customer policy (configurable TTL) |
| Art. 6 — Lawful basis | Need a reason to process | Legitimate interest (assessing candidate readiness for role). Consent obtained at assessment start |
| Art. 9 — Special category data | No health, biometric, or political data collected | The system explicitly avoids collecting protected characteristics |
| Art. 22 — Automated decision-making | No solely automated decisions with legal effects | The model scores criteria. A human manager makes the final hiring/readiness decision. The assessment is assistive, not determinative |
| Art. 35 — DPIA required | High-risk processing needs assessment | Each deployment conducts a DPIA with the customer. The architecture (on-device, no raw data stored) minimizes risk |

### ICO Employment Practices Code

| Requirement | Approach |
|-------------|---------|
| Transparency | Candidates are informed at assessment start: what data is collected, how it's used, how long it's kept |
| Proportionality | Only assess work-relevant criteria. No personality profiling, no health data |
| Human oversight | Every score is reviewable. Managers can override any criterion. The model is assistive |
| Data security | On-device processing. No cloud transmission of raw data. Model weights encrypted at rest |
| Retention | Configurable retention period (default 90 days). Automatic deletion |

### Equality Act 2010

| Risk | Mitigation |
|------|-----------|
| Indirect discrimination via language patterns | The framework criteria are objective (identity verified? impact asked?). They don't penalise accent, dialect, or communication style — only substance |
| Training data bias | Monitor per-criterion scores across demographic groups. If drift detected, rebalance training data |
| Disability accommodations | Candidates can request alternative assessment formats. The system supports multiple interaction modes |

---

## Training Pipeline

### Data Collection

Every time an assessment runs:

```json
{
  "assessment_id": "mvp-abc123",
  "timestamp": "2026-06-27T12:00:00Z",
  "input": {
    "transcript": "CALLER: Hi I can't log in...\nCANDIDATE: What's your name?...",
    "ticket": "Summary: Password reset for James Wilson...",
    "action_sequence": [
      {"action": "check_user_lookup", "time_s": 45},
      {"action": "open_ad_tools", "time_s": 120},
      {"action": "reset_password", "time_s": 200}
    ]
  },
  "labels": {
    "identity_check": "pass",
    "company_check": "pass",
    "issue_clarification": "pass",
    "started_when": "fail",
    "kt_define_problem": "pass",
    "kt_identify_changes": "pass",
    "kt_test_causes": "not_observed",
    "servqual_empathy_acknowledge": "pass",
    "servqual_responsiveness_updates": "pass",
    "sd_proper_opening": "pass",
    "sd_proper_closing": "pass",
    // ... all 42 criteria
  },
  "framework_scores": {
    "callum_baseline_v1": 82,
    "kepner_tregoe": 71,
    "servqual": 100,
    "sbar_communication": 100,
    // ... all 10 frameworks
  },
  "category_scores": {
    "security_compliance": 29,
    "technical_troubleshooting": 77,
    "customer_experience": 100,
    "process_professionalism": 80,
    "msp_custom": 65
  },
  "total_score": 70,
  "manager_feedback": null  // populated when manager reviews
}
```

### Training Dataset Growth

| Assessments | Labeled Examples | Sufficient For |
|-------------|-----------------|----------------|
| 100 | 100 | Initial fine-tune of 0.5B (baseline) |
| 500 | 500 | Reliable text-only scoring, ~85% agreement with prompt AI |
| 1,000 | 1,000 | ~92% agreement, can replace prompt AI for most scenarios |
| 5,000 | 5,000 | ~96% agreement, model outperforms prompt AI on known scenarios |
| 10,000 | 10,000 | Plateau — model matches inter-rater reliability of human managers |

### Fine-Tuning Config

```python
# Using unsloth for efficient LoRA fine-tuning
from unsloth import FastLanguageModel

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="Qwen/Qwen2.5-1.5B-Instruct",
    max_seq_length=8192,  # Truncate long transcripts
    load_in_4bit=True,
)

model = FastLanguageModel.get_peft_model(
    model,
    r=16,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    lora_alpha=32,
    lora_dropout=0.05,
)

# Loss: multi-label BCE per criterion
# Each criterion is a 5-class classification:
# pass, partial, fail, not_observed, not_applicable

# Training
from transformers import TrainingArguments
from trl import SFTTrainer

trainer = SFTTrainer(
    model=model,
    args=TrainingArguments(
        per_device_train_batch_size=4,
        gradient_accumulation_steps=4,
        num_train_epochs=3,
        learning_rate=2e-4,
        fp16=True,
        logging_steps=10,
        save_strategy="epoch",
    ),
    train_dataset=dataset,
    tokenizer=tokenizer,
)
```

### Verification Test

After each training run:

```python
# Run the trained model against the 5 tricky test transcripts
for transcript in [T1, T2, T3, T4, T5]:
    model_score = model.predict(transcript)
    prompt_score = prompt_ai.extract(transcript)
    framework_score = frameworks.score(model_score)
    
    # Check per-criterion agreement
    agreement = criterion_agreement(model_score, prompt_score)
    assert agreement > 0.90, f"T{transcript.id}: {agreement}% agreement < 90%"
    
    # Check framework score drift
    drift = abs(framework_score.total - prompt_expected.total)
    assert drift < 10, f"T{transcript.id}: {drift}pt drift > 10pt"
```

---

## Infrastructure Requirements

### Training (One-Time Per Deployment)

| Resource | Qwen 0.5B | Qwen 1.5B |
|----------|-----------|-----------|
| GPU | RTX 3090/4090 (24GB) or A10 (24GB) | RTX 4090 or A100 (80GB preferred) |
| RAM | 16GB | 32GB |
| Storage | 10GB (dataset + model) | 20GB (dataset + model) |
| Time | ~1 hour for 1K examples | ~3 hours for 1K examples |
| Cost (cloud) | ~$3 (Lambda Labs A10) | ~$10 (Lambda Labs A100) |

### Inference (Per Assessment, After Training)

| Model | Hardware | Latency | Throughput |
|-------|----------|---------|------------|
| Qwen 0.5B (4-bit) | Any CPU | ~50ms | 20/sec |
| Qwen 0.5B (4-bit) | Raspberry Pi 5 | ~200ms | 5/sec |
| Qwen 1.5B (4-bit) | MacBook M1 | ~80ms | 12/sec |
| Qwen 1.5B (4-bit) | RTX 3090 | ~10ms | 100/sec |
| Qwen 7B VL | RTX 4090 | ~500ms (with frames) | 2/sec |

### Deployment Options

| Option | How It Works | Best For |
|--------|-------------|----------|
| **On-prem (customer VM)** | Everything runs on customer's infrastructure. No outbound calls | Enterprise MSPs with compliance requirements |
| **Edge (Raspberry Pi)** | Qwen 0.5B runs on a Pi 5 at each office | Distributed environments with intermittent connectivity |
| **Browser (WebGPU)** | Qwen 0.5B quantized to 4-bit, runs in-browser via WebLLM | Zero-install, fully client-side |
| **Hybrid** | Text model on-device, vision model on GPU server | Balancing privacy with capability |

---

## Comparison: Prompt-Based vs Trained Model

| Dimension | Current (deepseek-v4-flash) | Future (Qwen 0.5B fine-tuned) |
|-----------|---------------------------|-------------------------------|
| Cost per assessment | ~$0.0012 API call | ~$0.00001 electricity |
| Latency | 30-60 seconds | 50-200 milliseconds |
| API dependency | Full (OpenRouter/OpenAI) | None |
| Offline capable | No | Yes |
| Privacy | Data sent to external API | Data never leaves device |
| Consistency | Prompt changes alter behavior | Deterministic — same input = same output |
| Customizable per customer | Prompt engineering per customer | Fine-tune per customer |
| Manager feedback integration | Manual | Automatically becomes training data |
| Screen recording analysis | Impossible (text-only API) | Possible (Qwen 2.5-VL) |
| Cold start | Works immediately | Needs 500+ labeled examples |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Small model accuracy < prompt AI | Medium | High — candidates scored wrong | Keep prompt AI as fallback. Ensemble both. Flag disagreements for human review. Don't replace until >90% agreement |
| Training data too small | Medium | Medium — model doesn't generalize | Phase rollout: start with prompt AI, collect data silently, train when threshold reached |
| Manager feedback loops amplify bias | Low | Medium — model learns manager's blind spots | Monitor per-criterion score distributions. Flag if a manager's corrections show systematic patterns |
| Screen recording privacy complaint | Low | High — regulatory action | Never store raw frames. Process in memory. Delete immediately. Document in DPIA. Obtain explicit consent |
| Model overfits to one scenario type | Medium | Medium — doesn't generalise to new packs | Ensure training data covers all pack types. Regular evaluation on held-out packs |
| Qwen model license changes | Low | High — may need to switch models | Apache 2.0 is perpetual. Keep training pipeline model-agnostic. Mistral, Llama, Phi are alternatives |

---

## Timeline

| Milestone | When | Deliverable |
|-----------|------|-------------|
| Data collection begins | Now | Every assessment run stores (transcript → criteria labels) automatically |
| 100 examples collected | ~1 week of active use | Initial proof-of-concept fine-tune on 0.5B |
| 500 examples collected | ~1 month | First production-quality model. Run in parallel with prompt AI |
| >90% agreement validated | ~2 months | Replace prompt AI for text extraction. Keep as fallback |
| Action sequence classifier built | ~3 months | Add behavioral scoring from simulator event logs |
| Screen recording capture implemented | ~4 months | Record remote desktop sessions (in-memory only) |
| Qwen 2.5-VL 7B fine-tuned | ~6 months | Vision model scores candidate navigation patterns |
| Multi-modal fusion layer built | ~7 months | Combine text + action + vision scores into unified assessment |
| Self-improving loop operational | ~8 months | Manager feedback triggers automated retraining |
| Customer simulator (AI acts) | ~12 months | Qwen fine-tuned to play customer role for scenario generation |

---

## File Structure

```
qwen.md                               ← This file
framestorm.md                          ← Framework research + evolution path
pipelinereport.md                      ← Pipeline test results
lib/mvp/compliance/frameworks/         ← 10 framework definitions (the rubric)
scripts/test-e2e-ai.ts                 ← Data collection harness
scripts/train-qwen.py                  ← Training script (future)
scripts/infer-qwen.py                  ← Inference script (future)
data/training/                         ← Training data storage (future)
data/models/                           ← Fine-tuned model weights (future)
```
