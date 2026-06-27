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
