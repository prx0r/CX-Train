# Compliance Pathway -- Product Vision & Architecture

> Multi-layered compliance-as-a-service for MSPs.
> AI-scored assessments, automated audits, training rollouts, compliance chatbot, and live regulatory intelligence.

---

## 1. Product Thesis

MSPs sell compliance. Cyber Essentials, ISO 27001, GDPR, SOC 2 -- these are not optional for UK/EU MSP clients. Every MSP has to prove their technicians are trained on the relevant compliance frameworks. Currently this is done via:

- Annual PowerPoint training + quiz (box-ticking, no real assessment)
- Manager gut-feel about who "knows the stuff"
- External auditors who charge £££ to review ticket samples
- Spreadsheets tracking who took what training when

**Callum's play:** Make compliance measurable, auditable, and sellable. The MSP can go to their client and say:

> "Our entire first-line team is Callum-certified on Cyber Essentials, ISO 27001, and GDPR. Here's the certification report. Our audit pass rate on real tickets is 94%. We're in the top 12% of MSPs in our region for compliance."

---

## 2. Compliance Profile Architecture

### 2.1 Compliance Frameworks (System-Defined)

The system maintains a registry of supported compliance frameworks in `lib/mvp/compliance/frameworks.ts`:

```typescript
export interface ComplianceFramework {
  id: string;
  name: string;                    // "Cyber Essentials"
  version: string;                 // "2025"
  region: string[];               // ["UK", "EU"]
  category: 'security' | 'data_protection' | 'service_management' | 'access_control';
  description: string;
  renewalPeriodMonths: number;    // 12
  criteria: ComplianceCriterion[];
  mappedStandards: string[];      // ["ISO 27001 A.5.15", "OWASP V2.2"]
}

export interface ComplianceCriterion {
  id: string;
  label: string;                  // "Firewall configuration is documented and reviewed"
  requirement: string;            // What the compliance standard demands
  evidenceType: 'ticket_check' | 'knowledge_question' | 'simulated_action' | 'audit_field';
  evidenceSource: string;         // Which ticket field, action, or question assesses this
  weight: number;                 // How heavily this criterion counts
  criticalForPass: boolean;       // Must-pass for compliance certification
  remediationGuidance: string;    // What to do if failed
}
```

Example -- Cyber Essentials snippet:

```typescript
export const CYBER_ESSENTIALS_2025: ComplianceFramework = {
  id: 'cyber_essentials_2025',
  name: 'Cyber Essentials',
  version: '2025',
  region: ['UK'],
  category: 'security',
  description: 'UK government-backed scheme to protect against common cyber threats.',
  renewalPeriodMonths: 12,
  criteria: [
    {
      id: 'ce_firewall_config',
      label: 'Firewall configuration is documented and reviewed',
      requirement: 'Boundary firewalls and internet gateways must be configured securely and documented.',
      evidenceType: 'audit_field',
      evidenceSource: 'connectwise.configuration.firewall_rules',
      weight: 10, criticalForPass: true,
      remediationGuidance: 'Document firewall rules in IT Glue. Ensure ingress rules are deny-by-default.',
    },
    {
      id: 'ce_secure_config',
      label: 'Secure configuration of devices',
      requirement: 'Computers and network devices must be configured securely with unnecessary software removed.',
      evidenceType: 'knowledge_question',
      evidenceSource: 'question_ce_secure_config',
      weight: 10, criticalForPass: true,
      remediationGuidance: 'Review device configuration policy. Remove default accounts and unnecessary services.',
    },
    {
      id: 'ce_access_control',
      label: 'User access control',
      requirement: 'User accounts are assigned only to authorised individuals with minimum necessary privileges.',
      evidenceType: 'simulated_action',
      evidenceSource: 'action_grant_access_without_authorization',
      weight: 10, criticalForPass: true,
      remediationGuidance: 'Ensure all access requests include manager authorization. Review admin account list.',
    },
    {
      id: 'ce_malware_protection',
      label: 'Malware protection',
      requirement: 'Malware protection must be installed and kept up to date on all devices.',
      evidenceType: 'knowledge_question',
      evidenceSource: 'question_ce_malware',
      weight: 5, criticalForPass: false,
      remediationGuidance: 'Verify endpoint protection deployment across all managed devices.',
    },
    {
      id: 'ce_patch_management',
      label: 'Patch management',
      requirement: 'Software on devices must be kept up to date with the latest security patches.',
      evidenceType: 'audit_field',
      evidenceSource: 'connectwise.configuration.patch_status',
      weight: 10, criticalForPass: true,
      remediationGuidance: 'Implement automated patching schedule. Review devices with overdue patches.',
    },
  ],
  mappedStandards: ['ISO 27001 A.5.15', 'ISO 27001 A.8.8', 'OWASP V2.2'],
};
```

### 2.2 Supported Frameworks (Initial Set)

| Framework | Region | Renewal | Category |
|-----------|--------|---------|----------|
| Cyber Essentials 2025 | UK | 12 months | Security |
| Cyber Essentials Plus 2025 | UK | 12 months | Security |
| ISO 27001:2022 | Global | 36 months | Security |
| ISO 20000-1:2018 | Global | 36 months | Service Mgmt |
| GDPR / UK DPA 2018 | UK/EU | Ongoing | Data Protection |
| NIS2 Directive | EU | Ongoing | Security |
| SOC 2 Type II | US/Global | 12 months | Security/Availability |
| Essential Eight | Australia | Ongoing | Security |
| PCI DSS 4.0 | Global | 12 months | Data Protection |
| HIPAA (if offering to US healthcare MSPs) | US | Ongoing | Data Protection |

### 2.3 Manager Compliance Profiles

Managers create compliance profiles that bundle frameworks relevant to their MSP:

```typescript
export interface ManagerComplianceProfile {
  id: string;
  managerId: string;
  label: string;                          // "Sydney Dental -- SOC 2 & GDPR"
  frameworks: string[];                   // ["soc2_type2", "gdpr_2018"]
  assignedTechnicians: string[];          // technician IDs
  teamPassThreshold: number;              // 80 (80% of techs must pass)
  reassessmentIntervalMonths: number;     // 3
  auditEnabled: boolean;                  // Connect ConnectWise audit?
  psaCredentialsRef?: string;             // Encrypted reference to PSA credentials
  created_at: string;
  updated_at: string;
}
```

---

## 3. Assessment-Based Compliance Scoring

### 3.1 How It Works

When a candidate takes an assessment, the system scores them against EVERY registered compliance framework. The compliance score is separate from the Callum Rating -- it answers "does this person's performance align with [framework]?" not "is this person good at their job?"

```
Callum Rating                  Compliance Score
─────────────                  ────────────────
PASS 78/100                    Cyber Essentials: 85% ✓
"Good diagnosis."              ISO 27001: 72% -
                               GDPR: 91% ✓
```

A candidate can get a low Callum Rating but high compliance (they followed the security checklist perfectly but had poor customer communication). Or vice versa (great with customers, sloppy about security).

### 3.2 Compliance Score Computation

For each compliance framework, the system evaluates each criterion against the candidate's performance:

```
For each ComplianceCriterion:
  evidenceSource maps to:
    'ticket_check'     -> check candidate's submitted ticket for this evidence
    'knowledge_question' -> check candidate's transcript for this topic
    'simulated_action' -> check if candidate performed (or avoided) this action
    'audit_field'      -> N/A for assessments (requires PSA access)

  status = does evidence exist and is it compliant?
    'pass' if evidence is present and correct
    'fail' if evidence is absent or incorrect
    'not_assessable' if criterion requires PSA audit data

  complianceScore = (passedCriteria / assessableCriteria) x 100
  certified = complianceScore >= framework.passThreshold AND all critical criteria pass
```

### 3.3 Compliance Certification Report

After assessment completion, the system generates:

```
┌─────────────────────────────────────────────────────────────┐
│ COMPLIANCE CERTIFICATION REPORT                             │
│                                                             │
│ Candidate: James Wilson        Date: 2026-06-27             │
│ Assessment: Password Reset     Callum Rating: PASS 78/100   │
│                                                             │
│ ── Cyber Essentials 2025 ────────────────────────────── ✓ 85%│
│   ✓ Firewall configuration documented                       │
│   ✓ Secure device configuration                             │
│   ✓ User access control (verified identity, no unsafe reset) │
│   ✗ Malware protection (not assessed in this pack)           │
│   ✓ Patch management (asked about recent changes)            │
│                                                             │
│ ── GDPR / UK DPA 2018 ──────────────────────────────── ✓ 91%│
│   ✓ Identity verification before accessing personal data     │
│   ✓ Data minimisation (only collected necessary info)        │
│   ✓ No unauthorised data sharing                             │
│   ! Breach notification awareness (partial -- mentioned      │
│     escalation but not specific breach process)              │
│                                                             │
│ Total frameworks certified: 2 of 2                          │
│ Certification valid until: 2026-12-27 (6 months)             │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Manager Standards Alignment & Advisory

### 4.1 Standards Alignment Analysis

Callum analyzes the manager's custom criteria, taxonomy playbook steps, and scoring overlay and compares them against industry standards:

```typescript
export interface StandardsAlignmentReport {
  managerId: string;
  frameworkId: string;
  overallAlignment: number;            // 0-100, how well the manager's standards map to the framework
  coveredCriteria: string[];           // Framework criteria the manager already covers
  missingCriteria: string[];           // Framework criteria the manager doesn't cover
  redundantCriteria: string[];         // Manager criteria that don't map to any framework
  recommendations: AlignmentRecommendation[];
}

export interface AlignmentRecommendation {
  type: 'add_criterion' | 'modify_criterion' | 'add_training' | 'adopt_playbook';
  priority: 'critical' | 'high' | 'medium' | 'informational';
  currentState: string;              // What the manager has now
  targetState: string;               // What alignment would look like
  impact: string;                    // Business impact of making this change
  effort: 'low' | 'medium' | 'high'; // How much work to implement
  suggestedCriterion?: ComplianceCriterion;  // If adding a new criterion
}
```

### 4.2 Advisory Outputs

The manager sees a dashboard:

```
┌──────────────────────────────────────────────────────────────┐
│ ALIGNMENT ADVISORY                Last updated: 2026-06-27    │
│                                                                │
│ Your standards (Sydney Dental) are:                            │
│   Cyber Essentials 2025     ████████░░  72% aligned            │
│   GDPR / UK DPA 2018        █████████░  88% aligned            │
│   ISO 27001:2022            ██████░░░░  58% aligned            │
│                                                                │
│ ── Recommendations ─────────────────────────────────────────── │
│                                                                │
│ [CRITICAL] ISO 27001 -- Access Control                         │
│ Your playbook doesn't check MFA re-sync for password resets.   │
│ ISO 27001 A.5.15 requires documented access control procedures.│
│ SUGGESTION: Add playbook step "Verify MFA device is synced"    │
│ One-click: [Add to playbook]                                   │
│                                                                │
│ [HIGH] Cyber Essentials -- Patch Management                    │
│ You require "asked about recent changes" but Cyber Essentials  │
│ also expects documented patch status on affected devices.      │
│ SUGGESTION: Add custom criterion "Checked device patch level"  │
│ for remote desktop packs. [Add criterion]                      │
│                                                                │
│ [INFO] GDPR -- Breach Notification                             │
│ Your standards don't mention breach notification timeframe.    │
│ GDPR Article 33 requires notification within 72 hours.         │
│ SUGGESTION: Add breach notification question to GDPR training. │
│ [Create training module]                                       │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 One-Click Adoption

When the manager clicks "[Add to playbook]" or "[Add criterion]", the system:

1. Creates the new taxonomy playbook step or scoring criterion
2. Maps it to the relevant compliance framework criterion
3. Adds it to the manager's scoring overlay
4. Updates the alignment score
5. Logs the adoption for future recommendations ("17% of MSPs in your region have adopted this recommendation")

---

## 5. Automated Compliance Audits (PSA Integration)

### 5.1 Audit Architecture

If the manager provides ConnectWise (or IT Glue) credentials, Callum can run automated compliance audits against real tickets:

```
┌──────────────────────────────────────────────────────────────────┐
│                     COMPLIANCE AUDIT ENGINE                       │
│                                                                  │
│  PSA Credentials ──→ Pull recent tickets ──→ Apply compliance    │
│  (encrypted,                                      framework      │
│   OAuth/token)                                    criteria       │
│                                                         │         │
│  IT Glue API ──→ Pull configurations ──→ Map to criteria│         │
│  (documentation,  (firewalls, devices,   (are firewall  │         │
│   passwords)       user accounts)        rules documented?)│      │
│                                                    │              │
│                                            ┌───────▼──────────┐  │
│                                            │   AUDIT REPORT    │  │
│                                            │                   │  │
│                                            │ 500 tickets       │  │
│                                            │ Cyber Essentials  │  │
│                                            │ Pass: 87%         │  │
│                                            │                   │  │
│                                            │ Top 3 gaps:       │  │
│                                            │ 1. Access control │  │
│                                            │    (13% fail)     │  │
│                                            │ 2. Patch confirm  │  │
│                                            │    (9% fail)      │  │
│                                            │ 3. Malware status │  │
│                                            │    (5% fail)      │  │
│                                            └───────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 Audit Scope

| Data Source | What Gets Audited |
|-------------|------------------|
| ConnectWise tickets | Identity checks in ticket descriptions, access control documentation, escalation paths |
| ConnectWise configurations | Firewall rules, patch status, device configurations |
| ConnectWise agreements | SLA compliance, response times, resolution times |
| IT Glue documents | Firewall configuration docs, password policies, SOPs |
| IT Glue passwords | Password rotation compliance, MFA status |
| RMM tool (if integrated) | Endpoint protection status, patch deployment, disk encryption |

### 5.3 Audit Report Example

```
┌──────────────────────────────────────────────────────────────┐
│ CYBER ESSENTIALS 2025 -- AUDIT REPORT                         │
│ Suite 3, Level 12, 45 Clarence St, Sydney                    │
│                                                              │
│ Audit period: 2026-03-27 to 2026-06-27                       │
│ Tickets audited: 500                      Pass rate: 87%     │
│ Configurations audited: 42 devices        Pass rate: 91%     │
│                                                              │
│ ── CRITERION RESULTS ─────────────────────────────────────── │
│                                                              │
│ ✓ Firewall configuration        94%   (2 devices unpatched)  │
│ ✓ Secure device configuration   91%   (3 devices w/ defaults)│
│ ✗ User access control           87%   (65 tickets lacked     │
│                                         identity verification)│
│ ✓ Malware protection            98%                          │
│ ✗ Patch management              85%   (6 devices > 14d late) │
│                                                              │
│ ── OVERALL ───────────────────────────────────────────────── │
│ Cyber Essentials 2025: PASS (87% >= 80% threshold)           │
│                                                              │
│ RECOMMENDATIONS:                                             │
│ [HIGH] 65 tickets without identity verification -- recommend │
│        mandatory identity check training for 4 technicians    │
│ [HIGH] 6 devices with overdue patches -- SVR-042, FLR-018,   │
│        MKT-007, ACC-022, ACC-031, DEV-009                    │
│ [MED]  3 devices with default admin accounts active           │
│                                                              │
│ Next audit: 2026-09-27                                       │
└──────────────────────────────────────────────────────────────┘
```

### 5.4 Audit vs Assessment -- Two Data Streams

| | Assessment | Audit |
|---|---|---|
| **Data source** | Simulated call + ticket | Real ConnectWise tickets |
| **What it tests** | Can the candidate do it right? | Did the candidate actually do it right? |
| **Frequency** | On-demand (training drills) | Scheduled (monthly/quarterly) |
| **Purpose** | Training, hiring, certification | Compliance evidence, gap analysis |
| **Who sees it** | Candidate + manager | Manager + external auditor (if shared) |

Both feed the same compliance profiles and contribute to the manager's compliance posture score.

---

## 6. Training Rollout & Assignment

### 6.1 Compliance Training Profiles

A manager creates a compliance training profile that combines frameworks with assessment packs:

```typescript
export interface ComplianceTrainingProfile {
  id: string;
  managerId: string;
  label: string;                          // "Cyber Essentials Q3 2026 Rollout"
  frameworks: string[];                   // ["cyber_essentials_2025"]
  assignedPacks: string[];               // Which sim packs to use
  assignedTechnicians: string[];          // Who needs to take this
  dueDate: string;                        // ISO date
  recurring: boolean;
  recurringIntervalMonths?: number;       // 3 for quarterly retraining
  notifyOnAssignment: boolean;
  notifyOnCompletion: boolean;
  autoEscalateOnFail: boolean;            // Escalate to manager if tech fails
}
```

### 6.2 Rollout Dashboard

```
┌──────────────────────────────────────────────────────────────────┐
│ COMPLIANCE TRAINING                                               │
│                                                                    │
│ Profile: Cyber Essentials Q3 2026      Due: 2026-09-30            │
│ Frameworks: Cyber Essentials 2025       Packs: Password Reset,     │
│                                                   VPN Disconnected │
│                                                                    │
│ ── Technician Progress ────────────────────────────────────────── │
│                                                                    │
│ James Wilson      PASS 85%   ✓ Certified    Completed 06-27        │
│ Sarah Chen        PASS 91%   ✓ Certified    Completed 06-24        │
│ Michael Brown     FAIL 52%   ✗ Not Certified Started 06-25         │
│   → Missed: Firewall config, Access control                       │
│   → Auto-assigned remedial pack: "Firewall Configuration Basics"   │
│ Emily Davis       Not Started               Assigned 06-20         │
│ Ahmed Khan        PASS 78%   ✓ Certified    Completed 06-22        │
│                                                                    │
│ ── Summary ────────────────────────────────────────────────────── │
│ Certified: 4/5 (80%)          Required pass rate: 80%              │
│ Average score: 81%            Time remaining: 95 days               │
│                                                                    │
│ [Export Report]  [Send Reminders]  [Auto-assign Remedial]           │
└──────────────────────────────────────────────────────────────────┘
```

### 6.3 Remedial Training Auto-Assignment

When a technician fails a compliance assessment:

1. System identifies which specific criteria they failed
2. Maps failed criteria to recommended packs
3. Auto-assigns remedial training packs with a deadline
4. Notifies the manager
5. Tracks the retake and whether they pass

### 6.4 Manager Report Generation

The manager can generate and download:

- **Individual compliance certificate** (PDF) -- "James Wilson is Cyber Essentials 2025 certified"
- **Team compliance report** (PDF) -- Summary of all techs, pass/fail, gaps
- **Auditor-ready evidence pack** -- Assessment transcripts, ticket evidence, compliance mapping
- **Client-facing report** -- "Our team is 94% compliant on ISO 27001. Certified by Callum AI."

---

## 7. Compliance Chatbot -- Callum Compliance Assistant

### 7.1 Chatbot Architecture

A dedicated compliance-focused AI chatbot that managers can query:

```
┌─────────────────────────────────────────────────────┐
│ CALLUM COMPLIANCE ASSISTANT                          │
│                                                     │
│  "What's new with Cyber Essentials in 2026?"         │
│                                                     │
│  ───────────────────────────────────────────────    │
│                                                     │
│  The 2026 Cyber Essentials update (effective         │
│  January 2026) introduced three key changes:         │
│                                                     │
│  1. Multi-factor authentication (MFA) is now          │
│     mandatory for all cloud service admin accounts.  │
│     Previously it was only "recommended."            │
│                                                     │
│  2. Password policies must require a minimum of      │
│     12 characters (up from 8). This aligns with      │
│     NCSC guidance updated December 2025.             │
│                                                     │
│  3. Supply chain risk assessment is now required     │
│     for any third-party accessing your data.         │
│                                                     │
│  Your team: 6 of 8 technicians are certified on      │
│  the 2025 framework. 2 need retraining on the new    │
│  2026 requirements.                                  │
│                                                     │
│  [Assign retraining to 2 technicians]                 │
│  [View full 2026 Cyber Essentials spec]               │
│  [Compare with ISO 27001 changes]                    │
│                                                     │
│  ───────────────────────────────────────────────    │
│  Type your question...                               │
└─────────────────────────────────────────────────────┘
```

### 7.2 Chatbot Capabilities

| Capability | Example Query | Response |
|-----------|--------------|----------|
| **Regulation lookup** | "What does ISO 27001 A.5.15 require?" | Explains the clause, maps it to Callum criteria |
| **Gap analysis** | "How does my team compare to Cyber Essentials?" | Shows current team compliance score vs framework |
| **Change impact** | "NIS2 is coming -- what do I need to change?" | Analyzes manager's current standards vs NIS2, lists gaps |
| **Training advice** | "Which of my techs need GDPR retraining?" | Lists techs whose last GDPR cert is older than 6 months |
| **Evidence lookup** | "Show me evidence for James Wilson's access control audit" | Pulls specific ticket data that demonstrates compliance |
| **Audit prep** | "What do I need for a Cyber Essentials Plus audit next month?" | Checklist of evidence needed, gaps to close |
| **Cross-framework** | "Does Cyber Essentials cover everything in ISO 27001?" | Maps CE criteria to ISO 27001, shows overlap and gaps |
| **News analysis** | "What changed in UK data protection law this month?" | Summarizes recent regulatory changes with impact analysis |

### 7.3 Chatbot Knowledge Sources

The chatbot is powered by:

1. **Structured compliance data** -- `lib/mvp/compliance/frameworks.ts` (all framework definitions)
2. **Manager's own data** -- Their standards, taxonomy, team scores, audit results
3. **Live web search** -- AI searches for recent compliance news via OpenRouter/web search capability
4. **Cached regulatory changes** -- Weekly cron pulls updates from NCSC, ICO, ISO, IEC, ENISA
5. **Product docs** -- Callum's own scoring methodology mapped to standards

---

## 8. Compliance Intelligence Feed

### 8.1 Regulatory Change Monitoring

A cron job runs weekly to pull regulatory updates:

```typescript
// lib/mvp/compliance/intelligence.ts

export interface RegulatoryUpdate {
  id: string;
  source: string;                    // "NCSC", "ICO", "ISO", "ENISA", "UK Gov"
  title: string;
  summary: string;
  url: string;
  affectedFrameworks: string[];     // Which frameworks this impacts
  severity: 'critical' | 'high' | 'medium' | 'informational';
  publishedAt: string;
  effectiveDate?: string;
  actionRequired: boolean;
  suggestedAction?: string;
}
```

Sources monitored:
- NCSC (National Cyber Security Centre) -- UK cyber guidance
- ICO (Information Commissioner's Office) -- UK data protection
- UK Gov -- Cyber Essentials updates, Digital Services Act
- ISO -- New standards, amendments, withdrawals
- ENISA -- EU cybersecurity agency updates
- IEC -- Electrical/electronic standards
- Australian Cyber Security Centre -- Essential Eight updates
- NIST (US) -- Framework updates (for US-market MSPs)

### 8.2 Intelligence Dashboard

```
┌──────────────────────────────────────────────────────────────────┐
│ COMPLIANCE INTELLIGENCE                  Last updated: 2 hours ago │
│                                                                    │
│ [Filter: All ▼]  [Filter: UK Only]  [Severity: Critical Only]     │
│                                                                    │
│ ── CRITICAL ────────────────────────────────────────────────────  │
│                                                                    │
│ 🚨 Jun 24  NIS2 enforcement begins October 2026                    │
│     ENISA       For UK MSPs serving EU clients, the NIS2 Directive │
│                 introduces mandatory incident reporting and supply  │
│                 chain security assessments.                        │
│                 → Your supply chain criteria: not yet configured    │
│                 [Configure supply chain criteria]                  │
│                                                                    │
│ ── HIGH ────────────────────────────────────────────────────────  │
│                                                                    │
│ ⚠ Jun 18   Cyber Essentials 2026 update published                  │
│     UK Gov      Key changes: MFA mandatory for cloud admin,         │
│                 password minimum 12 chars, supply chain risk.      │
│                 → 2 of your technicians need retraining             │
│                 [Create Cyber Essentials 2026 training profile]    │
│                                                                    │
│ ⚠ Jun 12   ICO issues new guidance on AI and data protection       │
│     ICO         The ICO has released guidance on lawful bases for   │
│                 AI training data, impact assessments, and automated │
│                 decision-making transparency.                       │
│                 → Your AI assessment data: compliant if anonymised  │
│                 [View guidance]  [Check your data practices]        │
│                                                                    │
│ ── MEDIUM ─────────────────────────────────────────────────────── │
│                                                                    │
│ ● Jun 5    ISO/IEC 27002:2022 Amendment 1 published                │
│     ISO         Minor update to information security controls for   │
│                 cloud services. Adds guidance on cloud-sec.         │
│                 → No immediate action required for your team         │
│                                                                    │
│ ● May 28   Australian Essential Eight maturity level update         │
│     ACSC        Maturity Level 3 now requires continuous monitoring  │
│                 and automated response for all eight strategies.    │
│                 → N/A (your region: UK)                              │
│                                                                    │
│ ── INFORMATIONAL ─────────────────────────────────────────────────│
│                                                                    │
│ i May 15   HDI publishes 2026 Service Desk Benchmark Report        │
│     HDI         Industry benchmarking data: average FCR 72%,         │
│                 average ticket quality 83%, avg AHT 8.2 min.       │
│                 → Your team: FCR 78%, ticket quality 87% (above avg)│
│                                                                    │
│ [View all 47 updates]  [Export to PDF]  [Configure alerts]          │
└──────────────────────────────────────────────────────────────────┘
```

### 8.3 Alert Configuration

Managers can configure:
- Which frameworks they care about
- Severity thresholds for alerts
- How they want to be notified (email, dashboard badge, Slack/Teams webhook)
- Auto-action: "If a Cyber Essentials update is published, automatically create a retraining profile for my team"

---

## 9. Compliance Advertising (Manager-Facing)

### 9.1 Compliance Credentials for Marketing

Managers can use Callum as a credential they can share with clients:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│      SYDNEY DENTAL -- COMPLIANCE CREDENTIALS         │
│                                                     │
│  This MSP's technical team is Callum-certified:      │
│                                                     │
│  ✓ Cyber Essentials 2026   12/12 techs certified    │
│  ✓ GDPR / UK DPA 2018      12/12 techs certified    │
│  ✓ ISO 27001:2022          10/12 techs certified    │
│                                                     │
│  Audit pass rate (last 500 tickets): 94%             │
│  Last audit: 2026-06-27                              │
│  Top 12% of MSPs in NSW for compliance               │
│                                                     │
│  Verified by Callum AI                               │
│  Certificate ID: CALLUM-CERT-AU-2026-08923           │
│  Verification URL: callum.ai/verify/08923            │
└─────────────────────────────────────────────────────┘
```

### 9.2 Shareable Compliance Reports

The manager can generate a URL that clients or prospects can access:

```
/certification/{orgId}/verify
```

This shows:
- Current compliance status per framework
- Number of certified technicians
- Last audit date and pass rate
- Percentile ranking against peer MSPs
- Certificate expiry date
- Digital signature for verification

This becomes a sales tool: "Before you sign a contract with us, check our compliance credentials at this link."

---

## 10. Database Schema

```sql
-- Compliance frameworks (system-defined, not manager-defined)
CREATE TABLE IF NOT EXISTS compliance_frameworks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  region_json TEXT NOT NULL,           -- ["UK", "EU"]
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  criteria_json TEXT NOT NULL,          -- Array of ComplianceCriterion
  mapped_standards_json TEXT NOT NULL,
  pass_threshold INTEGER NOT NULL DEFAULT 80,
  renewal_period_months INTEGER NOT NULL DEFAULT 12,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Manager compliance profiles
CREATE TABLE IF NOT EXISTS manager_compliance_profiles (
  id TEXT PRIMARY KEY,
  manager_id TEXT NOT NULL,
  label TEXT NOT NULL,
  framework_ids_json TEXT NOT NULL,     -- ["cyber_essentials_2025", "gdpr_2018"]
  assigned_technician_ids_json TEXT,
  team_pass_threshold INTEGER NOT NULL DEFAULT 80,
  reassessment_interval_months INTEGER NOT NULL DEFAULT 3,
  psa_integration_enabled INTEGER NOT NULL DEFAULT 0,
  psa_credentials_ref TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Per-assessment compliance scores
CREATE TABLE IF NOT EXISTS compliance_assessment_scores (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  framework_id TEXT NOT NULL,
  score INTEGER NOT NULL,              -- 0-100
  passed INTEGER NOT NULL DEFAULT 0,
  criteria_results_json TEXT NOT NULL,  -- Per-criterion pass/fail
  certified_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (assessment_id) REFERENCES assessments(id)
);

-- Compliance audits (PSA integration)
CREATE TABLE IF NOT EXISTS compliance_audit_runs (
  id TEXT PRIMARY KEY,
  manager_id TEXT NOT NULL,
  framework_id TEXT NOT NULL,
  psa_system TEXT NOT NULL,            -- 'connectwise' | 'halopsa' | etc.
  tickets_audited INTEGER NOT NULL DEFAULT 0,
  configurations_audited INTEGER NOT NULL DEFAULT 0,
  overall_pass_rate REAL,
  criteria_results_json TEXT,
  gap_report_json TEXT,
  recommendations_json TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

-- Compliance training profiles
CREATE TABLE IF NOT EXISTS compliance_training_profiles (
  id TEXT PRIMARY KEY,
  manager_id TEXT NOT NULL,
  label TEXT NOT NULL,
  framework_ids_json TEXT NOT NULL,
  assigned_pack_ids_json TEXT NOT NULL,
  assigned_technician_ids_json TEXT NOT NULL,
  due_date TEXT NOT NULL,
  recurring INTEGER NOT NULL DEFAULT 0,
  recurring_interval_months INTEGER,
  notify_on_assignment INTEGER NOT NULL DEFAULT 1,
  notify_on_completion INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Regulatory intelligence feed
CREATE TABLE IF NOT EXISTS regulatory_updates (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  url TEXT,
  affected_frameworks_json TEXT,       -- ["cyber_essentials_2025", "iso_27001_2022"]
  severity TEXT NOT NULL CHECK(severity IN ('critical','high','medium','informational')),
  published_at TEXT NOT NULL,
  effective_date TEXT,
  action_required INTEGER NOT NULL DEFAULT 0,
  suggested_action TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Manager alert preferences for regulatory updates
CREATE TABLE IF NOT EXISTS manager_compliance_alerts (
  manager_id TEXT PRIMARY KEY,
  enabled_frameworks_json TEXT,         -- Which frameworks to alert on
  min_severity TEXT NOT NULL DEFAULT 'high',
  notification_method TEXT NOT NULL DEFAULT 'dashboard',
  webhook_url TEXT,
  auto_create_training_on_update INTEGER NOT NULL DEFAULT 0
);
```

---

## 11. Revenue Model

| Tier | Features | Pricing Model |
|------|----------|---------------|
| **Compliance Basic** | Assessment-based compliance scoring, certification reports, 1 framework | Included with Callum |
| **Compliance Pro** | All frameworks, standards alignment advisory, training rollout, team compliance dashboard | Per-technician/month |
| **Compliance Enterprise** | PSA audit integration, compliance chatbot, regulatory intelligence feed, custom framework builder, auditor-ready evidence packs | Per-organization/month |
| **Compliance Intelligence** | Regulatory change monitoring, automated retraining triggers, cross-framework mapping, peer benchmarking | Add-on to Enterprise |

---

## 12. Implementation Phases

| Phase | What | Timeline |
|-------|------|----------|
| **Phase 1** | Framework registry (`compliance_frameworks` table), per-assessment compliance scoring, Cyber Essentials + GDPR initial frameworks | Now |
| **Phase 2** | Manager compliance profiles, training rollouts, team compliance dashboard | Q3 2026 |
| **Phase 3** | Standards alignment advisory, one-click adoption, certification verification URLs | Q4 2026 |
| **Phase 4** | PSA audit integration (ConnectWise first), audit reports, automated re-audit scheduling | Q1 2027 |
| **Phase 5** | Compliance chatbot, regulatory intelligence feed, alert configuration | Q2 2027 |
| **Phase 6** | Custom framework builder, cross-framework intelligence, client-facing credential portal | Q3 2027 |

---

## 13. What Makes This a Moat

1. **Data network effect** — More assessments → better compliance mapping → more accurate recommendations → more managers adopt → more assessments

2. **PSA integration lock-in** — Once a manager connects ConnectWise and starts getting automated audits, switching costs are high

3. **Regulatory intelligence** — Staying current with compliance changes is hard. Callum does it programmatically and surfaces the relevant bits.

4. **Compliance-as-credential** — When managers use Callum certification in their own sales process ("our team is Cyber Essentials certified by Callum"), the product becomes embedded in their business model.

5. **Cross-framework intelligence** — No competitor maps a single assessment run against 10+ compliance frameworks simultaneously. This is a legitimate technical moat.

---

## 14. Honest Assessment -- What's Real vs Aspirational

### 14.1 What UK MSPs Would Actually Pay For (Today)

| Product | Willingness to Pay | Reason |
|---------|-------------------|--------|
| **Assessment-based compliance scoring** (candidate takes test, gets Cyber Essentials score) | **High** | This is what they're already doing with manual quiz tools. Callum automates it. Immediate cost saving on assessor time. |
| **Team compliance dashboard** (see which techs are certified, expiry dates, retraining needed) | **High** | Spreadsheet replacement. Every MSP manager has this problem. Currently solved with Excel + Outlook reminders. |
| **Compliance chatbot** ("what changed in Cyber Essentials?") | **Medium** | Nice-to-have, not must-have. Managers who care about compliance already follow NCSC/IASME. But it's a sticky feature that keeps them logging in. |
| **Automated PSA audits** (import ConnectWise tickets, check against compliance criteria) | **Very High -- IF it works** | This is the killer feature. Every MSP dreads the audit. If Callum can pull 500 tickets and say "87% compliant, here are the 65 that failed," that's worth hundreds per month. It's also the hardest to build reliably. |
| **Standards alignment advisory** ("your playbook is 72% aligned to Cyber Essentials -- add MFA check") | **Medium-High** | Good for sales demos. Shows the product is "smart." In practice, managers adopt slowly. The one-click adoption is critical. |
| **Regulatory intelligence feed** | **Low-Medium** | Most MSPs already get this from their compliance partners or NCSC emails. Callum's version needs to be clearly better -- the per-team impact analysis ("2 of your techs need retraining") is the differentiator. |
| **Compliance advertising** ("our team is Callum-certified") | **Medium -- if the market recognizes Callum** | This requires building the Callum brand first. Nobody cares about a certification from a tool they haven't heard of. Year 2-3 play. |

### 14.2 Pricing Psychology

UK MSPs are cost-conscious. The typical UK MSP has 5-50 employees, £500K-£5M revenue. They pay:

- £50-150/user/month for RMM
- £30-80/user/month for PSA (ConnectWise)
- £5-20/endpoint/month for endpoint protection
- £320+VAT for Cyber Essentials certification (one-off per org)

A Callum compliance add-on priced at **£15-25/tech/month** would be competitive. For a 10-tech MSP, that's £150-250/month. For the compliance features (training + audits + dashboard), that's reasonable vs hiring a compliance officer at £40K/year.

The enterprise play (PSA audit + chatbot + intelligence) could be **£50-75/tech/month** for larger MSPs (50+ techs) who have dedicated compliance staff.

### 14.3 What's Technically Feasible Today

| Feature | Feasibility | Notes |
|---------|-----------|-------|
| Assessment → compliance scoring | **Done (Phase A)** | The scoring engine already exists. Adding a framework overlay is a data problem, not an engineering problem. |
| Team compliance dashboard | **Phase B** | CRUD on `compliance_training_profiles` + a dashboard page. Standard web dev. |
| PSA ticket import | **Phase D -- HARD** | ConnectWise has a REST API. Pulling tickets is straightforward. BUT: rate limits, pagination, authentication (OAuth or API keys), and the ticket schema varies per ConnectWise version. Also: GDPR/data residency -- are we storing client ticket data? Needs a DPA. |
| PSA → compliance scoring | **Phase D -- HARD** | Mapping ConnectWise ticket fields to compliance criteria is fragile. Different MSPs use ConnectWise differently. The field mapping engine needs to be configurable, not hardcoded. |
| IT Glue document push | **Phase E -- VERY HARD** | IT Glue API exists but pushing documentation programmatically is risky. IT Glue is a documentation SYSTEM OF RECORD -- incorrect automated writes could corrupt their knowledge base. Better approach: generate reports in PDF/HTML and let the manager manually upload or approve the push. |
| Compliance chatbot | **Phase E -- EASIER THAN IT LOOKS** | It's an AI prompt with a knowledge base. The compliance frameworks are structured data. An LLM with access to the framework JSON + the manager's team data can answer most questions. The regulatory intelligence feed is the hard part (keeping it current). |
| Regulatory change monitoring | **Phase E -- MEDIUM** | RSS feeds from NCSC, ICO, ISO, ENISA exist. A cron job that pulls, categorizes, and maps to frameworks is buildable. The "impact on YOUR team" analysis requires the team dashboard to exist first. |
| Certification verification URL | **Phase C** | Just a public page with a digital signature. Standard web dev. The hard part is building enough brand credibility that anyone cares. |

### 14.4 The Data Residency / GDPR Problem

This is the elephant in the room and MUST be solved before PSA integration:

**Scenario:** Sydney Dental MSP gives Callum their ConnectWise API key. Callum pulls 500 tickets containing real customer names, company names, issues, and sometimes PII. Those tickets are processed by Callum's servers.

**Questions that must be answered:**
1. Where is the ticket data stored? (UK/EU servers required for GDPR)
2. Is it encrypted at rest and in transit?
3. Is the MSP's client aware their data is being processed by Callum?
4. Does Callum have a DPA (Data Processing Agreement) with the MSP?
5. Does Callum need to be ISO 27001 certified itself to process MSP client data?
6. What happens if there's a breach of Callum's servers containing MSP client ticket data?

**The honest answer:** This is solvable but it's real work. You need:
- UK-hosted infrastructure (AWS London, Azure UK South)
- A proper DPA template (lawyer-reviewed)
- Encryption at rest (AES-256)
- Data retention policy: "Ticket data processed for audit, results stored, raw tickets deleted after 30 days"
- SOC 2 Type II or ISO 27001 certification for Callum itself (ironic but necessary)

**Without this**, the PSA audit feature is limited to "export your tickets as CSV and upload them" -- which defeats the purpose.

### 14.5 The Realistic Timeline

```
Year 1 (now-Q4 2026):
  - Assessment-based compliance scoring (Phase A-B)
  - Team compliance dashboard
  - Certification verification page
  - 2-3 frameworks (Cyber Essentials, GDPR, ISO 27001 basics)

Year 2 (2027):
  - Standards alignment advisory
  - Compliance chatbot (basic)
  - Regulatory intelligence feed
  - 5+ frameworks
  - PSA integration (ConnectWise) -- with data residency solved
  - DPA + UK hosting sorted

Year 3 (2028):
  - Audit automation (PSA + IT Glue)
  - Custom framework builder
  - Cross-framework intelligence
  - Callum brand recognition for compliance certification
  - Client-facing credential portal
```

### 14.6 The Real Moat

Forget the AI for a moment. The real moat is:

1. **Assessment data at scale** -- Nobody else has labeled MSP call assessment data mapped to compliance frameworks. Every assessment Callum runs makes the compliance scoring more accurate.

2. **PSA integration** -- Once an MSP connects ConnectWise, Callum is embedded in their operations. Switching costs are high. This is the same moat that ConnectWise itself uses.

3. **Framework currency** -- Staying current with 10+ compliance frameworks across multiple jurisdictions is genuinely hard. If Callum does this programmatically and surfaces what matters, that's a moat.

4. **Team-level compliance** -- Nobody offers "which of my techs are Cyber Essentials compliant?" as a product. It's always org-level certification. Individual-level compliance scoring is unique.

5. **The audit replacement** -- If Callum can genuinely replace a human compliance auditor reviewing tickets, that's a £££ saving per audit. External Cyber Essentials Plus audits cost £1,500-5,000 depending on org size. If Callum can pre-audit and find the gaps before the real auditor arrives, that alone is worth £100/month.

### 14.7 What We Should NOT Build

| Don't Build | Why |
|-------------|-----|
| A full GRC platform | Competing with LogicGate, OneTrust, etc. is a different business. Callum is assessment + audit for tech teams, not enterprise risk management. |
| PSA integration for every PSA | Start with ConnectWise. Add Autotask/HaloPSA only when you have 10+ paying ConnectWise customers. |
| Custom framework builder (Phase 1) | Custom frameworks are a power user feature. 90% of MSPs need Cyber Essentials + GDPR + ISO 27001. Focus on making those 3 perfect. |
| Automated IT Glue documentation push | Too risky. Generate reports, let the manager approve. Manual push with AI-generated content is safer. |
| SOC 2 certification for Callum | Expensive and slow. Do it in Year 2-3 when enterprise MSPs demand it. GDPR compliance + UK hosting + DPA is sufficient for Year 1. |
| Client-facing compliance portal | Year 3. First build the tool for the MSP. Then build the tool for the MSP's clients. |

---

## 15. Implementation: Multi-Framework Scoring Pipeline

### 15.1 Architecture Principle

The current "standard rubric" (18 core + 4 critical criteria from `scoringspec.md`) **is a framework**. It's just the default one. We rename it to the **Callum Baseline Framework**. Managers can override it via their scoring overlay to create their own **Manager Framework**. And external compliance frameworks (Cyber Essentials, ISO 27001, GDPR) are **additional evaluators** that read the same evidence pool.

```
                    ┌──────────────────────────────┐
                    │      EVIDENCE POOL           │
                    │  (one per assessment,         │
                    │   immutable after analysis)   │
                    │                              │
                    │  - AI-extracted criteria      │
                    │  - Sim events (deterministic) │
                    │  - Ticket field values        │
                    │  - Triage classification      │
                    │  - Transcript text            │
                    │  - Timeline / action log      │
                    └──────────────┬───────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
   ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
   │  Manager     │       │  Cyber        │       │  ISO 27001   │
   │  Framework   │       │  Essentials   │       │  Evaluator   │
   │  Evaluator   │       │  Evaluator    │       │              │
   │  (callum +   │       │  (5 criteria) │       │  (8 criteria)│
   │   overlay)   │       │              │       │              │
   └──────┬───────┘       └──────┬───────┘       └──────┬───────┘
          │                      │                      │
          ▼                      ▼                      ▼
   Manager Score          CE Score              ISO Score
   78/100 · PASS          85/100 · ✓            72/100 · -
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │   COMBINED CALLUM      │
                    │   COMPLIANCE SCORE     │
                    │                        │
                    │   Weighted aggregate:   │
                    │   Manager × 1.0        │
                    │   CyberEss × 0.3       │
                    │   ISO27001 × 0.3       │
                    │   GDPR × 0.2           │
                    │                        │
                    │   Overall: 82/100      │
                    └────────────────────────┘
```

### 15.2 Framework Evaluator -- Common Interface

Every framework evaluator implements the same interface:

```typescript
// lib/mvp/compliance/evaluator.ts

export interface FrameworkCriterion {
  id: string;                    // "ce_firewall_config"
  label: string;                 // "Firewall configuration is documented"
  weight: number;                // 10
  category: string;              // "security" | "access_control" | "documentation"
  critical: boolean;              // Must pass for certification

  /* How to check this criterion. One of: */
  checkType: 'ai_criteria'      // Check against AI-extracted criteria statuses
           | 'event_check'       // Check against sim event taxonomy tags
           | 'ticket_field'      // Check against candidate's ticket content
           | 'triage_check'      // Check against triage classification
           | 'transcript_keyword'// AI checks transcript for specific keywords
           | 'action_performed'  // Check if candidate performed a specific action
           | 'action_not_performed'; // Check if candidate AVOIDED a specific action

  /* The evidence source identifier */
  checkTarget: string;           // "identity_check" | "communication.user_confirmation" | "ticket.impact_noted" | "action_grant_access_without_authorization"

  /* For ai_criteria: what status counts as pass */
  passIf: 'pass' | 'pass_or_partial' | 'not_fail';

  /* Description for audit trail */
  evidenceDescription: string;   // "Candidate must confirm caller identity before proceeding"
}

export interface FrameworkDefinition {
  id: string;                    // "callum_baseline_v1"
  name: string;                  // "Callum Baseline Framework"
  version: string;               // "1.0"
  type: 'baseline'              // The Callum default rubric
      | 'manager_overlay'       // Manager's customized version
      | 'compliance_standard';  // External standard (Cyber Essentials, ISO, etc.)
  category: 'call_quality' | 'security' | 'data_protection' | 'service_mgmt';
  criteria: FrameworkCriterion[];
  passThreshold: number;         // 60 for Callum, 80 for Cyber Essentials
  weight: number;                // Contribution to combined score (0-1)
  description: string;
  standardsAlignments?: string[]; // "ITIL 4 Incident Management", "OWASP V2.2"
}

export interface FrameworkResult {
  frameworkId: string;
  frameworkName: string;
  score: number;                 // 0-100
  passed: boolean;               // >= passThreshold
  criticalFailures: string[];    // Which critical criteria failed
  criteriaResults: Array<{
    criterionId: string;
    label: string;
    status: 'pass' | 'fail' | 'not_assessable';
    evidence: string;            // Quote or event that proves the status
    pointsEarned: number;
    pointsMax: number;
  }>;
  summary: string;               // One-line summary for this framework
}
```

### 15.3 The Callum Baseline Framework (Current 18 + 4)

This is our existing rubric, expressed in the framework format:

```typescript
// lib/mvp/compliance/frameworks/callum-baseline.ts

export const CALLUM_BASELINE_V1: FrameworkDefinition = {
  id: 'callum_baseline_v1',
  name: 'Callum Baseline Framework',
  version: '1.0',
  type: 'baseline',
  category: 'call_quality',
  passThreshold: 60,
  weight: 1.0,  // Always 100% weight in combined score
  description: 'Standard Callum assessment rubric. 18 core binary criteria + 4 critical criteria + exceptional service bonus. Aligned to ITIL 4, HDI 4.0.',
  standardsAlignments: ['ITIL 4 Incident Management', 'ITIL 4 Service Desk', 'HDI Call Monitoring 4.0'],

  criteria: [
    // ── Critical (4) ──
    {
      id: 'submitted_ticket', label: 'Submitted a ticket',
      weight: 0, critical: true, category: 'fundamentals',
      checkType: 'event_check',
      checkTarget: 'ticket_submitted',
      passIf: 'pass',
      evidenceDescription: 'A ticket was submitted via the Submit for Review button',
    },
    {
      id: 'performed_triage', label: 'Performed ticket triage',
      weight: 0, critical: true, category: 'fundamentals',
      checkType: 'event_check',
      checkTarget: 'ticket_triage_submitted',
      passIf: 'pass',
      evidenceDescription: 'Candidate classified the ticket via the triage panel',
    },
    {
      id: 'safety', label: 'No unsafe actions',
      weight: 0, critical: true, category: 'fundamentals',
      checkType: 'action_not_performed',
      checkTarget: 'red_flag_triggered',
      passIf: 'pass',
      evidenceDescription: 'Candidate did not perform any red-flagged actions',
    },
    {
      id: 'next_steps', label: 'Customer knows next steps',
      weight: 1, critical: true, category: 'fundamentals',
      checkType: 'ai_criteria',
      checkTarget: 'next_steps',
      passIf: 'pass',
      evidenceDescription: 'Candidate set clear next steps with the customer',
    },
    // ── Call Control (4) ──
    {
      id: 'identity_check', label: 'Confirmed caller identity',
      weight: 1, critical: false, category: 'call_control',
      checkType: 'ai_criteria', checkTarget: 'identity_check', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate asked or confirmed who they were speaking to',
    },
    {
      id: 'company_check', label: 'Confirmed company/client',
      weight: 1, critical: false, category: 'call_control',
      checkType: 'ai_criteria', checkTarget: 'company_check', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate confirmed the client/company name',
    },
    {
      id: 'customer_tone', label: 'Professional, respectful tone',
      weight: 1, critical: false, category: 'call_control',
      checkType: 'ai_criteria', checkTarget: 'customer_tone', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate maintained professional tone throughout',
    },
    {
      id: 'customer_communication', label: 'Clear communication',
      weight: 1, critical: false, category: 'call_control',
      checkType: 'ai_criteria', checkTarget: 'customer_communication', passIf: 'pass_or_partial',
      evidenceDescription: 'Customer understood what was happening at all times',
    },
    // ── Diagnosis (7) ──
    {
      id: 'issue_clarification', label: 'Clarified the exact issue',
      weight: 1, critical: false, category: 'diagnosis',
      checkType: 'ai_criteria', checkTarget: 'issue_clarification', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate restated the problem and got confirmation',
    },
    {
      id: 'started_when', label: 'Asked when it started',
      weight: 1, critical: false, category: 'diagnosis',
      checkType: 'ai_criteria', checkTarget: 'started_when', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate established the timeline of the issue',
    },
    {
      id: 'impact', label: 'Asked about business impact',
      weight: 1, critical: false, category: 'diagnosis',
      checkType: 'ai_criteria', checkTarget: 'impact', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate asked how the issue affects work',
    },
    {
      id: 'urgency', label: 'Asked about urgency/deadline',
      weight: 1, critical: false, category: 'diagnosis',
      checkType: 'ai_criteria', checkTarget: 'urgency', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate asked about deadlines or time pressure',
    },
    {
      id: 'scope', label: 'Asked scope (one or many users)',
      weight: 1, critical: false, category: 'diagnosis',
      checkType: 'ai_criteria', checkTarget: 'scope', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate asked whether the issue affects one user or many',
    },
    {
      id: 'error_or_status_capture', label: 'Captured error/status details',
      weight: 1, critical: false, category: 'diagnosis',
      checkType: 'ai_criteria', checkTarget: 'error_or_status_capture', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate captured specific error messages or status information',
    },
    {
      id: 'recent_changes', label: 'Asked about recent changes',
      weight: 1, critical: false, category: 'diagnosis',
      checkType: 'ai_criteria', checkTarget: 'recent_changes', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate asked if anything changed recently',
    },
    // ── Resolution (3) ──
    {
      id: 'technical_discovery', label: 'Performed technical investigation',
      weight: 1, critical: false, category: 'resolution',
      checkType: 'ai_criteria', checkTarget: 'technical_discovery', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate used tools, ran checks, applied structured troubleshooting',
    },
    {
      id: 'customer_communication', label: 'Kept customer informed',
      weight: 1, critical: false, category: 'resolution',
      checkType: 'ai_criteria', checkTarget: 'customer_communication', passIf: 'pass_or_partial',
      evidenceDescription: 'Customer knew the plan and what was happening',
    },
    {
      id: 'escalation_judgement', label: 'Appropriate escalation',
      weight: 1, critical: false, category: 'resolution',
      checkType: 'ai_criteria', checkTarget: 'escalation_judgement', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate escalated when necessary, did not escalate prematurely',
    },
    // ── Ticket Quality (6) ──
    {
      id: 'ticket_user_company', label: 'Ticket: user + company',
      weight: 1, critical: false, category: 'ticket_quality',
      checkType: 'ticket_field', checkTarget: 'ticket_user_company', passIf: 'pass_or_partial',
      evidenceDescription: 'Ticket contains requester name and company',
    },
    {
      id: 'ticket_issue_summary', label: 'Ticket: clear issue summary',
      weight: 1, critical: false, category: 'ticket_quality',
      checkType: 'ticket_field', checkTarget: 'ticket_issue_summary', passIf: 'pass_or_partial',
      evidenceDescription: 'Ticket has a clear one-line summary of the issue',
    },
    {
      id: 'ticket_impact', label: 'Ticket: business impact',
      weight: 1, critical: false, category: 'ticket_quality',
      checkType: 'ticket_field', checkTarget: 'ticket_impact', passIf: 'pass_or_partial',
      evidenceDescription: 'Ticket documents the business impact',
    },
    {
      id: 'ticket_urgency', label: 'Ticket: urgency/deadline',
      weight: 1, critical: false, category: 'ticket_quality',
      checkType: 'ticket_field', checkTarget: 'ticket_urgency', passIf: 'pass_or_partial',
      evidenceDescription: 'Ticket records urgency level or deadline',
    },
    {
      id: 'ticket_checks_attempted', label: 'Ticket: checks attempted',
      weight: 1, critical: false, category: 'ticket_quality',
      checkType: 'ticket_field', checkTarget: 'ticket_checks_attempted', passIf: 'pass_or_partial',
      evidenceDescription: 'Ticket lists the checks/diagnostics performed',
    },
    {
      id: 'ticket_next_step', label: 'Ticket: next step',
      weight: 1, critical: false, category: 'ticket_quality',
      checkType: 'ticket_field', checkTarget: 'ticket_next_step', passIf: 'pass_or_partial',
      evidenceDescription: 'Ticket documents the next action or follow-up',
    },
  ],
};
```

### 15.4 Cyber Essentials 2025 Framework (Example External Standard)

```typescript
// lib/mvp/compliance/frameworks/cyber-essentials-2025.ts

export const CYBER_ESSENTIALS_2025: FrameworkDefinition = {
  id: 'cyber_essentials_2025',
  name: 'Cyber Essentials 2025',
  version: '2025',
  type: 'compliance_standard',
  category: 'security',
  passThreshold: 80,
  weight: 0.3,  // 30% contribution to combined compliance score
  description: 'UK government-backed cyber security certification. Five technical controls: firewalls, secure configuration, access control, malware protection, patch management.',
  standardsAlignments: ['NCSC Cyber Essentials', 'ISO 27001 A.5.15'],

  criteria: [
    {
      id: 'ce_firewall_config', label: 'Firewall configuration awareness',
      weight: 10, critical: true, category: 'security',
      checkType: 'transcript_keyword',
      checkTarget: 'firewall|network security|boundary|internet gateway',
      passIf: 'pass',  // AI checks transcript for firewall/network awareness
      evidenceDescription: 'Candidate demonstrated awareness of network boundary security in their questioning or ticket',
    },
    {
      id: 'ce_secure_config', label: 'Secure device configuration',
      weight: 10, critical: true, category: 'security',
      checkType: 'transcript_keyword',
      checkTarget: 'default settings|unnecessary software|admin account|secure config',
      passIf: 'pass',
      evidenceDescription: 'Candidate considered device security posture in their investigation',
    },
    {
      id: 'ce_access_control', label: 'User access control verified',
      weight: 10, critical: true, category: 'access_control',
      checkType: 'ai_criteria',
      checkTarget: 'identity_check',
      passIf: 'pass',  // Maps directly to the existing identity_check criterion
      evidenceDescription: 'Candidate verified the caller identity before proceeding',
    },
    {
      id: 'ce_unauthorized_access_prevented', label: 'No unauthorized access granted',
      weight: 10, critical: true, category: 'access_control',
      checkType: 'action_not_performed',
      checkTarget: 'action_grant_access_without_authorization',
      passIf: 'pass',
      evidenceDescription: 'Candidate did not grant access/privileges without proper authorization',
    },
    {
      id: 'ce_malware_awareness', label: 'Malware protection awareness',
      weight: 5, critical: false, category: 'security',
      checkType: 'transcript_keyword',
      checkTarget: 'antivirus|malware|endpoint protection|virus',
      passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate mentioned or checked endpoint protection status',
    },
    {
      id: 'ce_patch_management', label: 'Patch/recent update awareness',
      weight: 10, critical: true, category: 'security',
      checkType: 'ai_criteria',
      checkTarget: 'recent_changes',
      passIf: 'pass_or_partial',  // Maps to recent_changes criterion
      evidenceDescription: 'Candidate asked about recent changes that could relate to security patches',
    },
    {
      id: 'ce_documentation', label: 'Findings documented in ticket',
      weight: 5, critical: false, category: 'documentation',
      checkType: 'ai_criteria',
      checkTarget: 'ticket_checks_attempted',
      passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate documented their security-relevant checks in the ticket',
    },
  ],
};
```

### 15.5 The Multi-Framework Evaluator

The engine that runs ALL frameworks against the same evidence pool:

```typescript
// lib/mvp/compliance/multi-evaluator.ts

export interface EvidencePool {
  /* AI-extracted criteria statuses from transcript analysis */
  aiCriteria: Record<string, { status: string; evidence: string[] }>;

  /* Sim/assessment events with taxonomy tags */
  events: Array<{
    event_type: string;
    action_id?: string;
    taxonomy_tags?: string[];
    text?: string;
  }>;

  /* Full transcript text for keyword searches */
  transcriptText: string;

  /* Candidate's submitted ticket content */
  ticketText: string;

  /* Triage classification */
  triage: Record<string, string>;

  /* Exceptional service bonus (already computed) */
  exceptionalServiceScore: number;

  /* Did the candidate submit a ticket? */
  ticketSubmitted: boolean;

  /* Did the candidate perform triage? */
  triagePerformed: boolean;

  /* Any red flags triggered? */
  redFlagsTriggered: string[];
}

export interface CombinedComplianceResult {
  /* Per-framework results */
  frameworks: FrameworkResult[];

  /* Weighted aggregate score */
  combinedScore: number;
  combinedVerdict: 'PASS' | 'FAIL';

  /* Which frameworks were certified */
  certifiedFrameworks: string[];
  failedFrameworks: string[];

  /* Overall summary */
  summary: string;
}

export function evaluateAllFrameworks(
  evidence: EvidencePool,
  frameworks: FrameworkDefinition[],
  managerOverlay?: Partial<FrameworkDefinition>,
): CombinedComplianceResult {

  const results: FrameworkResult[] = [];

  for (const fw of frameworks) {
    const result = evaluateSingleFramework(evidence, fw);
    results.push(result);
  }

  /* Weighted combined score */
  let weightedSum = 0;
  let totalWeight = 0;
  for (const result of results) {
    const fw = frameworks.find(f => f.id === result.frameworkId);
    const weight = fw?.weight ?? 0;
    weightedSum += result.score * weight;
    totalWeight += weight;
  }
  const combinedScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  const certifiedFrameworks = results
    .filter(r => r.passed)
    .map(r => r.frameworkName);

  const failedFrameworks = results
    .filter(r => !r.passed)
    .map(r => r.frameworkName);

  const combinedVerdict = certifiedFrameworks.length >= results.length / 2 ? 'PASS' : 'FAIL';

  return {
    frameworks: results,
    combinedScore,
    combinedVerdict,
    certifiedFrameworks,
    failedFrameworks,
    summary: `${combinedVerdict} ${combinedScore}/100 — ${certifiedFrameworks.length}/${results.length} frameworks certified: ${certifiedFrameworks.join(', ')}`,
  };
}

export function evaluateSingleFramework(
  evidence: EvidencePool,
  fw: FrameworkDefinition,
): FrameworkResult {

  let earnedTotal = 0;
  let maxTotal = 0;
  const criticalFailures: string[] = [];
  const criteriaResults: FrameworkResult['criteriaResults'] = [];

  for (const criterion of fw.criteria) {
    let status: 'pass' | 'fail' | 'not_assessable' = 'not_assessable';
    let evidenceStr = '';

    switch (criterion.checkType) {

      case 'ai_criteria': {
        const aiResult = evidence.aiCriteria[criterion.checkTarget];
        if (!aiResult) { status = 'not_assessable'; break; }
        const s = aiResult.status.toLowerCase();
        if (criterion.passIf === 'pass') status = (s === 'pass') ? 'pass' : 'fail';
        else if (criterion.passIf === 'pass_or_partial') status = (s === 'pass' || s === 'partial') ? 'pass' : 'fail';
        else if (criterion.passIf === 'not_fail') status = (s !== 'fail') ? 'pass' : 'fail';
        evidenceStr = aiResult.evidence?.join('; ') || s;
        break;
      }

      case 'event_check': {
        const found = evidence.events.some(e =>
          e.event_type === criterion.checkTarget ||
          e.taxonomy_tags?.includes(criterion.checkTarget)
        );
        status = found ? 'pass' : 'fail';
        evidenceStr = found ? `Event "${criterion.checkTarget}" found in session timeline` : 'Event not found';
        break;
      }

      case 'ticket_field': {
        const found = evidence.ticketText.toLowerCase().includes(criterion.checkTarget.replace(/_/g, ' '));
        status = found ? 'pass' : 'fail';
        evidenceStr = found ? 'Content found in submitted ticket' : 'Content not found in submitted ticket';
        break;
      }

      case 'transcript_keyword': {
        const patterns = criterion.checkTarget.split('|').map(p => p.trim().toLowerCase());
        const found = patterns.some(p => evidence.transcriptText.toLowerCase().includes(p));
        status = found ? 'pass' : 'fail';
        evidenceStr = found ? 'Keyword found in transcript' : 'Keyword not found in transcript';
        break;
      }

      case 'action_performed': {
        const found = evidence.events.some(e => e.action_id === criterion.checkTarget);
        status = found ? 'pass' : 'fail';
        evidenceStr = found ? `Action "${criterion.checkTarget}" performed` : 'Action not performed';
        break;
      }

      case 'action_not_performed': {
        const found = evidence.events.some(e => e.action_id === criterion.checkTarget);
        status = found ? 'fail' : 'pass';
        evidenceStr = found ? `PROHIBITED action "${criterion.checkTarget}" was performed` : 'Action correctly avoided';
        break;
      }

      case 'triage_check': {
        const found = Object.values(evidence.triage).some(v =>
          String(v).toLowerCase().includes(criterion.checkTarget.toLowerCase())
        );
        status = found ? 'pass' : 'fail';
        evidenceStr = found ? 'Found in triage classification' : 'Not found in triage classification';
        break;
      }
    }

    const earned = status === 'pass' ? criterion.weight : 0;
    if (status !== 'not_assessable') {
      earnedTotal += earned;
      maxTotal += criterion.weight;
    }

    if (criterion.critical && status === 'fail') {
      criticalFailures.push(criterion.id);
    }

    criteriaResults.push({
      criterionId: criterion.id,
      label: criterion.label,
      status,
      evidence: evidenceStr,
      pointsEarned: earned,
      pointsMax: criterion.weight,
    });
  }

  const score = maxTotal > 0 ? Math.round((earnedTotal / maxTotal) * 100) : 0;
  const passed = score >= fw.passThreshold && criticalFailures.length === 0;

  return {
    frameworkId: fw.id,
    frameworkName: fw.name,
    score,
    passed,
    criticalFailures,
    criteriaResults,
    summary: passed
      ? `PASS ${score}/100 — All critical criteria met`
      : `FAIL ${score}/100 — Critical failures: ${criticalFailures.join(', ')}`,
  };
}
```

### 15.6 Wiring Into the Analysis Pipeline

The existing `runBaseCallumAnalysis()` gets extended at the point AFTER evidence extraction but BEFORE scoring:

```typescript
// In runBaseCallumAnalysis.ts -- After AI evidence extraction, before scoring

// Step 1.5: Build evidence pool
const evidencePool: EvidencePool = {
  aiCriteria: groundedExtraction.criteria,
  events: context.evidence_timeline?.map(e => ({
    event_type: e.event_type,
    action_id: (e as any).action_id,
    taxonomy_tags: (e as any).taxonomy_tags,
    text: e.text ?? undefined,
  })) ?? [],
  transcriptText: context.transcript_text,
  ticketText: context.submitted_ticket ?? '',
  triage: {},  // Populated from triage events if available
  exceptionalServiceScore,
  ticketSubmitted: !!context.submitted_ticket,
  triagePerformed: performedTriage,
  redFlagsTriggered: (groundedExtraction.red_flags || []).map(f => f.type),
};

// Step 1.6: Load active frameworks
const activeFrameworks = [
  CALLUM_BASELINE_V1,  // Always included -- this IS the current rubric
  CYBER_ESSENTIALS_2025,
  GDPR_2018,
  ISO_27001_2022,
  // More frameworks loaded from DB if manager has them enabled
];

// Step 1.7: Evaluate all frameworks
const complianceResult = evaluateAllFrameworks(
  evidencePool,
  activeFrameworks,
  managerOverlay,  // Manager's custom overrides applied to Callum Baseline
);

// Step 2: Deterministic scoring (now uses the Manager Framework result directly)
// The Manager Framework result IS the Callum Rating from scoringspec.md
const managerFrameworkResult = complianceResult.frameworks.find(
  f => f.frameworkId === 'callum_baseline_v1'
);

// Store all framework results in assessment_results
db.prepare(`INSERT INTO compliance_assessment_scores ...`).run(...);

// Pass compliance data to buildCandidateAnalysis
candidateAnalysis = buildCandidateAnalysis(analysisResults, pack, complianceResult);
```

### 15.7 Manager Framework = Callum Baseline + Overlay

The manager doesn't create a framework from scratch. They start with the **Callum Baseline Framework** (which is what we currently have -- 18 core + 4 critical). They then customize it via their **scoring overlay**:

```
Callum Baseline Framework (18 core + 4 critical)
       │
       ▼
   Manager Overlay
   ├── Weight adjustments (ticket_quality × 2.0)
   ├── Critical overrides (company_check → critical)
   ├── Custom criteria (+ "checked_kb" = 1pt)
   ├── Disabled criteria (- "started_when")
   └── Pass threshold (65 not 60)
       │
       ▼
   Manager Framework
   (evaluated just like any other framework)
```

This means:
- The **Callum Rating** in the UI = the Manager Framework result
- The **Callum For You** from scoringspec.md = also the Manager Framework (just renamed)
- The **Callum Baseline** is always computed but shown as a reference
- The combined **Compliance Score** weights the Manager Framework at 100% and external frameworks at 30-50%

### 15.8 Files to Create

| File | Purpose |
|------|---------|
| `lib/mvp/compliance/evaluator.ts` | `FrameworkDefinition`, `FrameworkResult`, `EvidencePool`, `evaluateAllFrameworks()`, `evaluateSingleFramework()` |
| `lib/mvp/compliance/frameworks/index.ts` | Re-export all framework definitions |
| `lib/mvp/compliance/frameworks/callum-baseline.ts` | The current 18+4 rubric expressed as a `FrameworkDefinition` |
| `lib/mvp/compliance/frameworks/cyber-essentials-2025.ts` | Cyber Essentials 2025 framework (7 criteria mapped to evidence sources) |
| `lib/mvp/compliance/frameworks/gdpr-2018.ts` | GDPR/UK DPA 2018 framework |
| `lib/mvp/compliance/frameworks/iso-27001-2022.ts` | ISO 27001:2022 framework |
| `lib/mvp/compliance/frameworks/hdi-quality.ts` | HDI Support Center Standard 4.0 framework |
| `lib/mvp/compliance/frameworks/owasp-asvs.ts` | OWASP ASVS 4.0 framework |

### 15.9 Files to Modify

| File | Change |
|------|--------|
| `lib/mvp/analysis/runBaseCallumAnalysis.ts` | After evidence extraction: build EvidencePool, load frameworks, evaluateAllFrameworks, store results, pass to buildCandidateAnalysis |
| `lib/mvp/analysis/types.ts` | Add `ComplianceResult` to `StructuredOutput` or as a sibling |
| `components/mvp/results/AssessmentResults.tsx` | Show combined compliance score + per-framework badges + expandable per-framework breakdown |
| `components/mvp/simulator/ServiceDeskSimulatorShell.tsx` | Pass compliance data to AssessmentResults |
| `app/api/mvp/assessment/[token]/ticket/route.ts` | Store compliance results in DB |
| `lib/mvp/db.ts` | Add `compliance_assessment_scores` table migration |
| `lib/mvp/sim/packConfig.ts` & packs | No change — packs define actions and scenario. Frameworks evaluate the evidence from those actions. |

### 15.10 The Display -- What the Candidate Sees

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   ┌────────────────────────────────────────────────────────┐ │
│   │  YOUR RESULTS                                          │ │
│   │                                                        │ │
│   │  PASS · 82/100                                         │ │
│   │  "Good diagnosis and complete ticket. Well informed     │ │
│   │   customer. Work on asking about recent changes."       │ │
│   │                                                        │ │
│   │  Category Breakdown           Frameworks                │ │
│   │  Call Control   4/4  ████    ┌──────────────────────┐  │ │
│   │  Diagnosis      5/7  ███░░   │ ✓ ITIL 4   ✓ GDPR   │  │ │
│   │  Resolution     3/3  ████    │ ✓ OWASP    ✗ CyberE │  │ │
│   │  Ticket Quality 6/6  ████    │ △ ISO 27001         │  │ │
│   │  Bonus         +6/10         └──────────────────────┘  │ │
│   │                                                        │ │
│   │  COMPLIANCE: 2/3 frameworks certified                  │ │
│   │  Cyber Essentials: 72% — ✗ Not certified               │ │
│   │    ✗ Firewall configuration (not assessed)             │ │
│   │    ✗ Malware awareness (not mentioned)                 │ │
│   │    ✓ Access control (identity verified)                │ │
│   │  GDPR: 91% — ✓ Certified                               │ │
│   │  ISO 27001: 82% — △ Partially meets                   │ │
│   └────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 15.11 Database

```sql
-- Per-assessment compliance results (one row per framework per assessment)
CREATE TABLE IF NOT EXISTS compliance_assessment_results (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  framework_id TEXT NOT NULL,
  score INTEGER NOT NULL,              -- 0-100
  passed INTEGER NOT NULL DEFAULT 0,   -- Boolean
  criteria_results_json TEXT NOT NULL, -- Per-criterion pass/fail/not_assessable
  critical_failures_json TEXT,         -- Which critical criteria failed
  evidence_pool_snapshot_json TEXT,    -- Frozen EvidencePool at analysis time
  certified_until TEXT,                -- Expiry date for certification validity
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (assessment_id) REFERENCES assessments(id)
);

CREATE INDEX IF NOT EXISTS idx_compliance_assessment
ON compliance_assessment_results(assessment_id);

CREATE INDEX IF NOT EXISTS idx_compliance_framework
ON compliance_assessment_results(framework_id);
```

### 15.12 Rollout Order

| Step | What | When |
|------|------|------|
| 1 | Create `lib/mvp/compliance/` directory structure | Now |
| 2 | Implement `evaluator.ts` with `EvidencePool`, `evaluateAllFrameworks()`, `evaluateSingleFramework()` | Now |
| 3 | Convert current 18+4 rubric into `CallumBaselineV1` FrameworkDefinition | Now |
| 4 | Wire into `runBaseCallumAnalysis.ts` — evaluate Callum Baseline using the new evaluator (parallel run with existing scoring to verify identical results) | Now |
| 5 | Create Cyber Essentials 2025 framework (7 criteria) | Now |
| 6 | Create GDPR 2018 framework | This week |
| 7 | Update `AssessmentResults.tsx` to show per-framework badges + expandable breakdown | This week |
| 8 | Create remaining frameworks (ISO 27001, OWASP, HDI) | Next week |
| 9 | Manager overlay integration — Manager Framework = Callum Baseline + overlay | After step 4 validates |
| 10 | Combined compliance scoring + display | After step 5 |
