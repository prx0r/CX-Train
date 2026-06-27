# Vision 2 — The MSP Standards Control Plane

> **Old framing:** "CallCallum trains helpdesk candidates."
> **New framing:** "CallCallum is the MSP standards and control plane for humans and AI."

The training simulator is the first product surface. Underneath is the thing that tells every human tech, AI assistant, ConnectWise workflow, ChatGPT prompt, ticket reviewer, and future agent:

**"This is how this MSP wants support work done."**

---

## Why This Fits the Future MSP Stack

ConnectWise, Kaseya, Microsoft, and others are already moving toward built-in AI for ticket triage, summarisation, workflow assistance, automation, and agent governance:

- **ConnectWise Sidekick/PSA** — AI-assisted ticket triage, summaries, replies, support workflows
- **Kaseya** — "Agentic IT management platform" strategy
- **Microsoft Copilot Studio** — Governance, DLP, human oversight, approvals, audit logging for agents

**The gap is not "can AI summarise a ticket?"**

The gap is:

> *"Summarise and act according to our MSP's standards, for this client, under these rules, with this manager's expectations, and with auditable evidence."*

**That is CallCallum.**

---

## The Model's Real Job

The Qwen model should become a **standards interpreter + judge + policy compiler**.

**Input:**
```json
{
  "mspProcedures": "...",
  "clientRules": "...",
  "ticketTaxonomy": "...",
  "escalationRules": "...",
  "noteStandards": "...",
  "tonePreferences": "...",
  "managerFeedback": "...",
  "scenarioTruth": "...",
  "transcript": "...",
  "actionTimeline": [],
  "ticketState": {}
}
```

**Output:**
```json
{
  "correctClassification": "incident > email > outlook",
  "expectedNextStep": "check_work_offline_status",
  "missingEvidence": ["scope_checked", "test_email_sent"],
  "noteQualityScore": 72,
  "escalationDecision": "approved_with_context",
  "approvalRequired": false,
  "policyViolations": [],
  "suggestedTrainingDrill": "outlook-work-offline",
  "automationReadiness": "supervised"
}
```

This output can feed into **anything**:
- ConnectWise
- HaloPSA
- Autotask
- Kaseya
- Microsoft Copilot
- ChatGPT
- Claude
- Internal custom agents
- Your own training simulator

CallCallum becomes less like "another AI app" and more like the **MSP's operational constitution**.

---

## The Six Product Layers

### 1. Standards Repository

The MSP inputs their operating model as structured data:

| Input | Example |
|-------|---------|
| Ticket categories/types/subtypes | Incident > Email > Outlook |
| Priority/SLA rules | P1 = 1hr response, 4hr resolution |
| Escalation rules | Lockout > 15min → escalate to L2 |
| Note templates | Every ticket must have: user, issue, diagnosis, resolution, verification |
| Client-specific rules | Acme Corp: never discuss pricing on phone |
| "Never do this" rules | Never share passwords, never disable MFA |
| Approved diagnostic paths | Outlook issue → check status bar → check network → check webmail |
| Tone/customer handling preferences | Always use name, acknowledge frustration, confirm before acting |
| Manager judgement examples | Historical corrections stored as labelled training data |

This becomes the **source of truth** that everything else references.

### 2. Procedure Packs

Each procedure becomes structured, testable, and versioned:

```json
{
  "procedure": "Outlook not sending",
  "requiredEvidence": [
    "scope_checked",
    "outbox_checked",
    "work_offline_state_checked"
  ],
  "safeActions": [
    "disable_work_offline",
    "send_test_email"
  ],
  "forbiddenShortcuts": [
    "reinstall_office_before_evidence",
    "delete_profile_without_approval"
  ],
  "closeCriteria": [
    "test_email_sent",
    "outbox_empty",
    "customer_confirmed"
  ]
}
```

This is much better than vague SOP documents. Each pack is machine-readable, testable, and improvable through manager feedback.

### 3. Training / Simulation Layer

This is CX-Train today. Humans and AI agents are tested against the standards.

The simulator is **not the final product** — it is the **calibration engine**.

Every trainee attempt, every AI simulation, every manager correction produces data that refines the standards. The sim creates the data that makes the standards real.

### 4. QA / Review Layer

Real tickets are reviewed against the same standards:

- "This ticket was closed, but no verification evidence was recorded."
- "The note does not include root cause."
- "The tech escalated, but did not include device/user/context."

This can sell before full automation. An MSP can paste a transcript + ticket and get a standards-aligned QA score immediately — no simulation required.

### 5. AI Policy Middleware

This is the big future piece.

When ChatGPT, ConnectWise AI, or Copilot suggests an action or response, CallCallum checks it:

```
AI suggestion
  → CallCallum standards check
    → allow / warn / block / require approval
      → log decision with evidence
```

This is the **managerial control suite** for AI in the MSP. Without it, AI tools operate without guardrails. With it, the MSP's standards are enforced across every AI touchpoint.

### 6. Automation Readiness

For each workflow, CallCallum can classify automation readiness:

| Ticket Type | Readiness |
|-------------|-----------|
| Password reset intake | ✅ Ready for AI-assisted workflow |
| Outlook work offline | ✅ Ready for supervised automation |
| Mailbox permission changes | 👤 Human approval required |
| Data-loss tickets | 🚫 Never autonomous |
| VIP client tickets | 👤 Extra approval required |

This is valuable because MSPs **do not know what they can safely automate**. CallCallum tells them — based on evidence from thousands of assessed scenarios.

---

## The Killer Positioning

> **"CallCallum lets MSPs define, test, and enforce how support work should be done — across humans, AI copilots, and future agents."**

Or sharper:

> **"The standards layer for AI-native MSPs."**

---

## Competitive Positioning

| Competitor | What They Do | CallCallum's Role |
|------------|-------------|-------------------|
| **ConnectWise AI** | Does the work faster | Decides if the work is correct and safe |
| **Kaseya AI** | Automates workflows | Enforces workflow standards |
| **Microsoft Copilot** | Summarises tickets | Ensures summaries match MSP format requirements |
| **ChatGPT plugins** | Generates responses | Validates responses against client tone rules |
| **Internal automations** | Executes scripts | Checks pre/post conditions and required approvals |

CallCallum does not compete with these tools. It **sits above them** as a governance and standards layer.

---

## How the Training Sim Fits

Without the sim, "standards" are just documents that collect dust.

With the sim:

```
procedure → scenario → human attempts → AI attempts → 
  manager corrections → refined standard → better AI instructions
```

That is the flywheel. The manager is not just reviewing trainees — they are **training the standards layer itself**.

Every correction updates the standard. Every assessed call improves the model. The sim is the engine that converts human judgement into machine-enforceable policy.

---

## Build Order

### Phase 1: Standards Profile Schema (Now)
Define a `StandardsProfile` schema — the MSP's operating model as structured data.

```typescript
interface StandardsProfile {
  ticketCategories: TaxonomyDefinition[];
  escalationRules: EscalationRule[];
  noteStandards: NoteFieldRequirement[];
  clientRules: ClientOverride[];
  forbiddenActions: string[];
  approvedDiagnosticPaths: DiagnosticPath[];
  tonePreferences: ToneConfig;
  managerHistory: CorrectionExample[];
}
```

### Phase 2: Standards-Referenced Scoring (Next)
Map every scenario and rubric to the `StandardsProfile`. Hiring and training scores derive from the standards layer, not from hardcoded criteria.

### Phase 3: Manager Override / Correction UI (Next)
Every manager correction updates the standard. Build the feedback loop.

### Phase 4: Ticket QA Mode (Soon)
Paste transcript + ticket note → score against standards. No simulation needed.

### Phase 5: AI Suggestion Checker (Future)
Paste "AI proposed next step" → CallCallum says safe / unsafe / missing evidence / requires approval.

### Phase 6: PSA Integration (Future)
Start read-only: pull tickets, review notes, suggest standards-aligned improvements. Then write: auto-populate notes, suggest next steps, flag policy violations.

---

## Summary

| Layer | What It Does | Current Status |
|-------|-------------|----------------|
| 1. Standards Repository | Structured MSP operating model | ❌ Not built |
| 2. Procedure Packs | Machine-readable, testable SOPs | ✅ Partially built (sim packs) |
| 3. Training/Sim Layer | Calibrate humans and AI against standards | ✅ Built (CX-Train) |
| 4. QA/Review Layer | Score real tickets against standards | 🔧 In progress (results page) |
| 5. AI Policy Middleware | Gate AI suggestions against standards | ❌ Not built |
| 6. Automation Readiness | Classify workflows by automation safety | ❌ Not built |

The important reframing:

The app is not:

> Sim app → maybe AI agent later

It is:

```
Standards Layer
  ├── Human training sim
  ├── Candidate assessment
  ├── Ticket QA
  ├── AI suggestion review
  ├── Workflow readiness
  └── Future agent governance
```

That is much more coherent, and it gives every feature a clear home.

---

## Competitive Landscape — What Already Exists

There are generic AI training simulators for customer support, but none dominate the MSP niche:

| Product | What It Does | Gap |
|---------|-------------|-----|
| **Intryc** | Simulations with helpdesk actions (macros, custom fields, statuses, escalation paths) | Generic customer support, not MSP-specific |
| **CXMaster** | Free AI chat scenarios for empathy, de-escalation, customer service skills | No ticket simulation, no MSP rubric, no hiring exam mode |
| **Total Sem** | MSP helpdesk bootcamp with VM troubleshooting, AI-scored communication | Training course, not a repeatable assessment platform |
| **ConnectWise Certify** | Role-based training/certifications for TSP/MSP teams | Platform adoption training, not readiness assessment |

So the category exists in fragments. **No dominant product is specifically:**

> MSP manager assessment standard + realistic ticket/call simulator + candidate hiring exam + training feedback engine + compliance evidence + AI-assisted triage pack.

---

## The Actual CallCallum Gap

The gap is not "AI can help the service desk."

The gap is:

> **MSP managers do not have a consistent, evidence-based way to assess whether a human can actually do the work.**

Right now hiring is probably:
```
CV → awkward interview → maybe technical questions → maybe gut feel → hire
  → discover on live calls whether they panic, overtalk, skip notes, mis-prioritise, or escalate badly
```

CallCallum changes that to:
```
candidate receives realistic MSP ticket/call
  → handles customer + ticket + notes + triage
    → system logs transcript/actions/notes
      → scorer checks against MSP rubric
        → manager reviews evidence
          → candidate gets benchmarked
```

That is valuable even if no automation ever happens.

---

## The Product Should Become the MSP Assessment Standard

> **CallCallum is the practical assessment standard for MSP support readiness.**

Not CompTIA. Not generic helpdesk training. Not "can you answer IT trivia?"

More like:

- Can you speak to a user?
- Can you clarify the issue?
- Can you triage urgency?
- Can you use a ticket properly?
- Can you document clearly?
- Can you avoid unsafe shortcuts?
- Can you verify the fix?
- Can you escalate with useful context?
- Can you use AI without blindly trusting it?

**That last one is important.**

---

## The AI-Assisted Service Desk Pack

Instead of trying to become the automation engine, make an **AI-Assisted Service Desk Pack**.

The trainee is allowed to use an AI assistant during the sim. But the assessment is:

> *Did they use AI responsibly?*

Score things like:

| Criterion | What It Measures |
|-----------|-----------------|
| AI question quality | Did they ask the AI a useful, specific question? |
| Context provided | Did they give enough ticket context for a useful answer? |
| Verification | Did they check AI suggestions against actual evidence? |
| Hallucination catching | Did they spot wrong or invented steps? |
| Note integrity | Did they avoid copying a bad note blindly? |
| Conversation control | Did they keep control of the customer interaction? |
| Generic answer awareness | Did they know when the AI response was too vague? |
| Documentation honesty | Did they document what actually happened, not what the AI guessed? |

This is very timely because **frontier MSPs will absolutely give techs AI tools**. The new skill is not "never use AI." The skill is:

> *Use AI as a junior assistant, not as your brain.*

That could be a killer differentiator.

---

## Compliance / Evidence Angle

CallCallum should produce an assessment record:

```
Candidate: Alex
Scenario: Outlook not sending
Mode: hiring exam
Transcript: saved
Ticket note: saved
Action timeline: saved
Rubric version: v1.3
Score: 78
Manager override: yes/no
Evidence:
  - asked scope question
  - checked ticket details
  - identified work offline
  - verified test email
  - note missed root cause
```

This becomes useful for:

- Fairer hiring
- Repeatable onboarding
- Probation evidence
- Manager calibration
- Compliance training
- Reducing "gut feel" hiring
- Showing why someone passed/failed
- Proving training happened

**This is much less crowded than automation.**

---

## The Sharper Product Stack

CallCallum should be defined as five products:

### 1. Hiring Exams

Voice/ticket simulations for candidates. No feedback shown to candidate. Manager gets score and evidence.

### 2. Training Drills

Single-ticket practice. Immediate AI feedback. Retry loop.

### 3. Training Shift

Multiple tickets, prioritisation, triage, note quality, queue pressure. This is the "real MSP flight simulator."

### 4. Ticket/Call QA

Upload or paste a real ticket note or call transcript. Score it against the same rubric.

### 5. AI-Assisted Pack

Trainee uses AI during the ticket. Score whether they checked, challenged, and controlled the AI.

That is coherent.

---

## Where You Should Not Go Yet

Avoid these for now:

- Autonomous AI actions
- Remote desktop control
- RMM script execution
- PSA automation engine
- Replacing ConnectWise/Kaseya AI
- Full AI support agent
- Heavy compliance platform
- Full SOP/documentation repository

Those are distractions. You can integrate later, but the product should first win the manager's pain:

> *"I need to know if this person can actually handle support work."*

---

## The First Niche to Dominate

Don't say "customer support training simulator."

Say:

> **MSP L1 support readiness assessment.**

Even narrower:

> **Voice + ticket simulation for hiring and onboarding first-line MSP technicians.**

That is specific enough to sell. Then expand:

```
Hiring assessment → onboarding drills → training shift → real ticket QA
  → AI-assisted triage training → benchmark standard
```

---

## The Moat in This Direction

The moat becomes:

- Realistic MSP scenario packs
- Scoring rubrics managers trust
- Benchmark data across candidates
- Labelled examples of good/bad ticket handling
- Manager-specific calibration
- Evidence-backed assessments
- AI-use competency scoring
- Scenario outcomes correlated with real job performance

This is better than "we trained a model." The model supports the assessment. **The assessment standard is the product.**

---

## Final Positioning

The gap for CallCallum is:

> MSPs are getting AI tools faster than they are getting reliable ways to assess, train, and govern the humans using them.

CallCallum should become:

> **The MSP human-readiness and AI-readiness assessment platform.**

The product direction:

```
Training simulator
+ hiring assessment
+ feedback engine
+ manager rubric
+ compliance evidence
+ AI-assisted triage training pack
```

This is a much cleaner lane than automation. And it fits what you have already built.

---

# Part 2: Compliance Training, Skill Profiles, and Adaptive Drills

## 1. Compliance Training Should Become Practical Simulation

CallCallum should not treat compliance training as passive video completion or multiple-choice checkbox learning.

The product should turn compliance, cyber awareness, and service desk risk training into **realistic call-and-ticket simulations** where the learner must actively recognise risk, handle the customer conversation, make triage decisions, document the ticket, and escalate correctly.

Instead of asking:

> *"Do you know what phishing is?"*

CallCallum should test:

> *"Can you recognise a phishing-related call, ask the right questions, avoid unsafe action, create a useful ticket, and escalate with the right context?"*

## 2. Compliance Scenario Packs

CallCallum should support dedicated compliance and security-readiness packs. These should look and feel like normal MSP service desk calls, not abstract training quizzes.

### Phishing Report Pack

The user reports a suspicious email. The trainee must gather evidence, avoid clicking unsafe links, ask for headers/screenshots if appropriate, classify the ticket correctly, and escalate according to the MSP's security process.

### Password Reset / Identity Verification Pack

The caller requests a password reset. The trainee must verify identity according to procedure and avoid being socially engineered.

### Suspicious Login / Account Compromise Pack

The customer reports unusual login activity. The trainee must recognise possible compromise, gather impact details, escalate correctly, and avoid treating it as a routine password issue.

### Permissions Change Pack

The caller requests access to a mailbox, folder, SharePoint site, finance system, or admin function. The trainee must identify authorisation requirements before making or recommending changes.

### Data Loss / Deletion Pack

The customer reports missing files or accidental deletion. The trainee must avoid destructive action, gather timeline/context, preserve evidence, and escalate appropriately.

### VIP / High-Impact Escalation Pack

The issue affects a senior user, board meeting, finance deadline, or major client process. The trainee must correctly assess business impact and urgency.

### AI-Assisted Triage Pack

The trainee is allowed to use an AI assistant during the scenario, but is assessed on whether they verify the AI output, catch wrong suggestions, avoid blindly copying notes, and remain responsible for the final action.

## 3. Compliance Evidence Output

Each completed compliance scenario should produce an audit-ready assessment record:

- Learner identity
- Scenario name and version
- Rubric version
- Date completed
- Transcript
- Action timeline
- Ticket fields (summary, category, impact, urgency, priority)
- Internal note / live note
- Final ticket note
- Score breakdown
- Evidence for each score
- Failed criteria
- Manager review status
- Manager override and comment
- Remediation assigned
- Retest result if applicable

This allows an MSP to prove not just that training was assigned, but that the user **practically demonstrated competence**.

## 4. Training Compliance Matrix

CallCallum should build a compliance/readiness matrix for each user:

| Skill / Scenario Area | Status | Last Score | Last Attempt | Retest Needed |
|-----------------------|--------|-----------|-------------|---------------|
| Phishing triage | Passed | 84 | 2026-06-27 | No |
| Identity verification | Failed | 52 | 2026-06-27 | Yes |
| Password reset safety | Needs review | 66 | 2026-06-27 | Yes |
| Ticket note quality | Passed | 81 | 2026-06-27 | No |
| AI-assisted triage | Not assessed | — | — | Yes |

This turns training into a **living readiness profile** rather than a completion checkbox.

## 5. Longitudinal Skill Profile

CallCallum should accumulate performance over time. Every candidate, trainee, or technician should gradually build a profile of strengths, weaknesses, repeated mistakes, and improvement trends.

The profile should track:

- Call handling
- Diagnostic questioning
- Evidence gathering
- Urgency classification
- Ticket taxonomy accuracy
- Escalation quality
- Identity verification
- Security awareness
- Note quality
- Customer communication
- AI-use judgement
- Verification before closure
- Unsafe shortcut tendency
- Improvement after feedback

The profile should help managers answer:

- Is this person ready for real client calls?
- Where do they repeatedly fail?
- Are they improving?
- Which scenarios should they practise next?
- Are they safe to handle security-sensitive tickets?
- Can they use AI responsibly?
- Do they need manager review before live work?

## 6. Focus Drills — Adaptive Remediation

CallCallum should generate targeted remedial assessments based on a user's past weak spots.

**Working name: Focus Drill.**

A Focus Drill is a personalised scenario generated from the learner's previous failures. It combines several of their recurring weak areas into one realistic call.

**Example:**

If a trainee repeatedly fails on identity verification, escalation context, and ticket note quality, CallCallum could generate a Focus Drill where:

- A caller requests a password reset
- The caller gives incomplete identity information
- The issue has a hidden security risk
- The trainee must decide whether to proceed, challenge, or escalate
- The final ticket note must include clear evidence and escalation context

The goal is not to punish the learner. The goal is to create **deliberate practice** around the exact behaviours they need to improve.

## 7. Focus Drill Generation Requirements

A Focus Drill should be generated from:

- Previous assessment scores
- Failed rubric criteria
- Manager feedback
- Repeated unsafe actions
- Missing note components
- Scenario categories previously failed
- Weak communication behaviours
- AI misuse patterns if applicable

The generated drill should include:

- Scenario title
- Customer persona
- Initial ticket
- Hidden risk
- Required evidence
- Expected actions
- Unsafe actions
- Escalation triggers
- Note requirements
- Scoring rubric
- Pass/fail thresholds
- Manager review prompt

## 8. Manager Controls

Managers should be able to:

- Assign compliance packs
- Assign Focus Drills
- Set pass thresholds
- Require retests
- Mark a learner as ready/not ready
- Override AI scoring
- Add custom feedback
- View historical progress
- Export assessment evidence
- See team-level weak spots
- Generate training plans from recurring failures

Manager feedback should feed the learner profile and improve future drill generation.

## 9. Team-Level Insights

CallCallum should also identify patterns across the team:

- "5/8 trainees failed to verify identity before password reset."
- "Most users recognise phishing but fail to gather useful escalation evidence."
- "Ticket notes are consistently missing verification."
- "AI-assisted trainees are copying AI-generated notes without checking them."
- "New hires are over-escalating low-risk Outlook issues."

These insights can guide future training, documentation updates, and manager coaching.

## 10. Product Positioning

This expands CallCallum beyond hiring assessment into practical service desk readiness and compliance evidence.

> CallCallum replaces passive compliance videos and generic quizzes with realistic MSP call simulations that prove technicians can recognise risk, follow procedure, communicate clearly, and document correctly.

The key promise:

> **Do not just prove that training was completed. Prove that the technician can perform safely under realistic support conditions.**

## 11. Strategic Boundary

CallCallum should not become a full GRC platform or PSA analytics product. It should not compete directly with Kaseya, ConnectWise, Rewst, Pia, or IT Glue on automation, documentation storage, or ticket analytics.

The product should focus on:

- Human readiness
- Practical assessment
- Compliance training evidence
- Manager-reviewed scoring
- Adaptive remedial drills
- AI-assisted support training
- Service desk call/ticket simulation
- Proof of competence before live client work

This keeps CallCallum focused on the gap that large PSA/RMM vendors are less likely to solve deeply: **practical, evidence-based human assessment for MSP support work.**

---

# Part 3: MSP Skills Passport — Portable Proof-of-Skill Profiles

> **Phase 3, not immediate MVP.** But the data model should not block it.

CallCallum becomes a **portable proof-of-skill profile** for MSP support workers.

Not a CV. Not a generic job board. A practical evidence record:

> *"I have handled these simulated calls, these ticket types, these security scenarios, these AI-assisted triage drills, and here are the transcripts, audio, notes, and scores."*

That is much stronger than someone saying "I'm good at customer service and IT support."

## The Product Category

**MSP Skills Passport** (or **CallCallum Profile**).

A candidate can build a profile before they have a job. They complete:

- Hiring-style voice assessments
- Outlook/VPN/printer/shared drive drills
- Phishing/security call packs
- AI-assisted triage packs
- Ticket-note quality assessments
- Escalation scenarios
- Training shift simulations

Their profile then shows:

```
Call handling:          82
Ticket notes:           76
Security awareness:     91
Escalation quality:     68
AI-assisted triage:     74
Identity verification:  88
Weak area:              escalation context
Best scenario:          phishing report
```

This turns CallCallum into a **proof-of-readiness platform**.

## Why This Could Work

MSPs have a hiring problem: it is hard to know if someone can actually handle live calls until they are already hired. Your product gives managers **evidence before the hire**.

Instead of:

> CV → interview → vibes → hire → discover they freeze on calls

CallCallum becomes:

> Profile → practical call evidence → manager review → interview → hire

The evidence is the moat.

## Candidate Profile Spec

Each user should eventually have:

```typescript
interface CandidateProfile {
  id: string;
  name: string;
  location?: string;
  timezone?: string;
  lookingForWork: boolean;
  workPreferences: {
    remote: boolean;
    hybrid: boolean;
    onsite: boolean;
    fullTime: boolean;
    partTime: boolean;
    contract: boolean;
  };
  targetRoles: string[];  // "L1 Support", "Service Desk Analyst", etc.
  publicSummary: string;
  assessmentHistory: AssessmentEvidence[];
  skillProfile: Record<string, number>;  // dimension → score
  audioSamples: string[];   // shared with consent
  transcriptSamples: string[];
  ticketNoteSamples: string[];
  managerEndorsements: ManagerEndorsement[];
  shareSettings: ShareSettings;
}
```

**Important:** the public profile should not automatically expose everything. The candidate controls what companies can see.

## Evidence Library

Every assessment becomes a shareable evidence object:

```typescript
interface AssessmentEvidence {
  scenarioName: string;
  scenarioType: string;
  dateCompleted: string;
  score: number;
  rubricVersion: string;
  transcript?: string;        // shared with consent
  audioRecording?: string;    // shared with consent
  actionTimeline?: string;
  finalTicketNote?: string;
  aiReview?: AIReviewSummary;
  managerReview?: ManagerReview;
  candidateReflection?: string;
  shareable: boolean;
}
```

A candidate could share a clean version:

> *"Show this company my phishing call, Outlook call, and Training Shift result."*

Not:

> *"Every company can see all my raw recordings forever."*

That matters legally and ethically.

## Company Profile Spec

MSPs can create company profiles:

```typescript
interface CompanyProfile {
  id: string;
  companyName: string;
  location?: string;
  remotePolicy: string;
  hiringStatus: 'open' | 'closed';
  rolesHiringFor: string[];
  hiringCriteria: HiringCriteria[];
  preferredScoreThresholds: Record<string, number>;
  managerUsers: string[];
}
```

Example hiring criteria:

```
Role: L1 MSP Support
Required:
  - Outlook Not Sending assessment
  - Password Reset / Identity Verification assessment
  - Phishing Report assessment
  - Ticket Note Quality score above 70
  - Call Handling score above 65
Optional:
  - AI-Assisted Triage Pack
```

Then candidates can apply with evidence, not just a CV.

## Hiring Pipeline

**Company side:**

1. Applicants → review CallCallum Profile
2. Listen to selected calls
3. Read transcripts and ticket notes
4. AI summary of candidate strengths and risks
5. Invite to company-specific assessment
6. Interview
7. AI interview transcript review (assistive only)
8. Manager decision

The AI can assist, but the manager should remain the decision-maker. UK regulators are actively warning employers that AI and automation in recruitment need transparency, safeguards, and proper human involvement, especially when tools score online assessments.

## Candidate Consent Model

This has to be built right from the start.

**Public profile:**
- Name, location, summary
- Assessment names and scores (no raw data)

**Private evidence (shared with consent only):**
- Transcripts
- Audio recordings
- Full AI reviews
- Manager comments
- Interview recordings

**Sharing model:**

```
Share with company X
  → choose specific evidence items
  → set expiry date
  → revoke access at any time
  → audit log of who viewed what
```

Do not make raw audio or transcripts publicly visible by default. Interview recordings and assessment recordings are sensitive personal data in practice, and recruitment AI analysis is a trust and compliance issue. The ICO's 2026 recruitment guidance is very clear that candidates need transparency around AI and automation in hiring.

## The AI Hiring Review

Powerful, but needs guardrails.

AI can produce:

```
Candidate summary:
  - Strong customer reassurance
  - Good phishing awareness
  - Weak escalation notes
  - Tends to close before verification
  - Improved after feedback across 3 attempts
```

But avoid:

> *"Automatically reject candidate."*

The system should say:

> *"AI assists the reviewer. Final hiring decisions are made by the company."*

That keeps it safer and more trustable.

## No Hiring Fees

Do not become a recruiter charging placement fees. Instead:

| Role | Model |
|------|-------|
| Candidates | Free profile |
| MSPs | Subscription to run assessments, manage candidates, access opted-in profiles |

> *"No recruiter fee. Hire from practical support evidence."*

That is attractive to small MSPs.

## The Real Flywheel

This creates a huge flywheel:

```
Candidates complete assessments
  → profiles become stronger
    → companies trust CallCallum evidence
      → companies assign more assessments
        → more labelled call/ticket data
          → better scoring
            → better candidate profiles
              → better hiring outcomes
```

And over time:

> Candidate profile → hired → later job performance → validate assessment predictions

That is very powerful.

## But Don't Build Marketplace First

A two-sided marketplace is hard because you need candidates and companies at the same time.

The correct order:

| Phase | What | When |
|-------|------|------|
| 1 | **Manager-assigned assessments** (current MVP) | Now |
| 2 | **Candidate profiles** — let candidates see their own history, share a private link | After MVP |
| 3 | **Company hiring portal** — companies manage applicants, assign assessments | Phase 3 |
| 4 | **Public/opt-in talent pool** — candidates mark themselves as looking for work | Phase 4 |
| 5 | **CallCallum hiring network** — companies search and filter opted-in profiles | Phase 5 |

For now, just make sure your data model does not block this later.

## Implementation Requirements

Data model additions:

```typescript
// New entities (future, but design the schema now)
interface CandidateProfile {
  userId: string;
  lookingForWork: boolean;
  targetRoles: string[];
  skillProfile: JSON;         // dimension → score
  shareSettings: JSON;
  createdAt: string;
  updatedAt: string;
}

interface AssessmentVisibility {
  assessmentId: string;
  candidateId: string;
  sharedWithCompanyId?: string;
  shareExpiry?: string;
  consentGrantedAt: string;
  consentRevokedAt?: string;
}

interface CompanyProfile {
  orgId: string;
  hiringStatus: string;
  rolesHiringFor: string[];
  hiringCriteria: JSON;
  preferredThresholds: JSON;
}
```

## The Cleanest Positioning

> **CallCallum is the practical skills passport for MSP support workers, and the evidence-based hiring system for MSP managers.**

This fits perfectly with the training simulator:

- The simulator creates the evidence
- The profile stores the evidence
- The company portal uses the evidence to hire and train better
