import fs from 'fs';
import path from 'path';

interface FailureMode {
  id: string;
  label: string;
  definition: string;
  operational_consequence: string;
  evidence_patterns: string[];
  coaching_action: string;
  severity: 'critical' | 'major' | 'minor';
  category: 'discovery' | 'ticket' | 'communication' | 'process' | 'technical';
}

interface TicketQualityExample {
  id: string;
  category: string;
  priority: string;
  summary: string;
  description: string;
  quality_flags: string[];
  quality_score: number;
  notes: string;
}

interface SupportUtteranceExample {
  id: string;
  role: 'customer' | 'agent';
  message: string;
  context: string;
  quality_tags: string[];
}

interface ManagerScoredTicketExample {
  source: string;
  external_id: string;
  scores: Record<string, number>;
  observed_ticket_features: Record<string, boolean>;
  callcallum_interpretation: {
    possible_quality_signals: string[];
    limitations: string[];
  };
}

// --- Failure Modes ---

const failureModes: FailureMode[] = [
  {
    id: 'missing_affected_user',
    label: 'Missing affected user',
    definition: 'Ticket does not identify which user(s) are affected by the issue.',
    operational_consequence: 'Second line cannot verify user identity or contact them for follow-up.',
    evidence_patterns: [
      'Ticket says "user" or "customer" without name',
      'No user ID or email in ticket',
      'Candidate did not ask caller name during call',
    ],
    coaching_action: 'Train first-line to always capture the affected user name, email, and contact method at the start of every interaction.',
    severity: 'critical',
    category: 'discovery',
  },
  {
    id: 'missing_affected_device',
    label: 'Missing affected device',
    definition: 'Ticket does not specify which device, system, or application is affected.',
    operational_consequence: 'Technician must contact user to determine device details before starting work.',
    evidence_patterns: [
      'Ticket says "computer" or "laptop" without hostname or model',
      'No IP address or asset tag recorded',
      'No application name or version specified',
    ],
    coaching_action: 'Train first-line to capture device hostname, OS, IP address, and application version when applicable.',
    severity: 'critical',
    category: 'discovery',
  },
  {
    id: 'missing_scope',
    label: 'Missing affected scope',
    definition: 'Ticket does not state whether the issue affects one user, multiple users, one device, one site, or a wider service.',
    operational_consequence: 'Second line may repeat discovery questions or misprioritise the issue.',
    evidence_patterns: [
      'Ticket describes issue without stating scope',
      'No indication of single-user vs. widespread',
      'No site or location information',
    ],
    coaching_action: 'Train first-line to document affected user(s), device(s), service, and business impact.',
    severity: 'major',
    category: 'discovery',
  },
  {
    id: 'missing_business_impact',
    label: 'Missing business impact',
    definition: 'Ticket does not describe what the user cannot do as a result of the issue.',
    operational_consequence: 'Priority may be mis-set and second line lacks context for urgency.',
    evidence_patterns: [
      'Ticket says "not working" without impact description',
      'No mention of deadline, client, or revenue impact',
      'No documentation of blocked tasks',
    ],
    coaching_action: 'Train first-line to ask "What are you unable to do because of this?" and document the answer in the ticket.',
    severity: 'critical',
    category: 'discovery',
  },
  {
    id: 'missing_error_message',
    label: 'Missing error message or status',
    definition: 'Ticket does not record any error message, error code, or system status.',
    operational_consequence: 'Second line lacks diagnostic starting point.',
    evidence_patterns: [
      'Ticket says "error" without the actual message',
      'No error code captured',
      'No screenshot or exact wording of error',
    ],
    coaching_action: 'Train first-line to always capture the exact error message, code, or system status before escalating.',
    severity: 'major',
    category: 'technical',
  },
  {
    id: 'missing_troubleshooting_steps',
    label: 'Missing troubleshooting steps attempted',
    definition: 'Ticket does not document what troubleshooting was already attempted by the user or first-line.',
    operational_consequence: 'Second line may repeat already-done steps, wasting time.',
    evidence_patterns: [
      'Ticket says "troubleshot" without specifics',
      'No list of steps already tried',
      'No documentation of results of attempted fixes',
    ],
    coaching_action: 'Train first-line to document every troubleshooting step attempted and its result, even if unsuccessful.',
    severity: 'major',
    category: 'process',
  },
  {
    id: 'missing_escalation_reason',
    label: 'Missing escalation reason',
    definition: 'Escalated ticket does not explain why first-line cannot resolve.',
    operational_consequence: 'Second line lacks context and may reject or delay escalation.',
    evidence_patterns: [
      'Ticket says "escalating" without reason',
      'No indication of what was attempted before escalation',
      'No specific request for second-line action',
    ],
    coaching_action: 'Train first-line to always include specific reason for escalation, what was tried, and what second-line action is needed.',
    severity: 'critical',
    category: 'process',
  },
  {
    id: 'unclear_resolution',
    label: 'Unclear resolution',
    definition: 'Ticket does not clearly describe what was done to resolve the issue.',
    operational_consequence: 'Knowledge base cannot be built from resolved tickets; issue may recur without known fix.',
    evidence_patterns: [
      'Ticket says "fixed" or "resolved" without details',
      'No root cause documented',
      'No resolution steps recorded',
    ],
    coaching_action: 'Train first-line to document the root cause and exact resolution steps before closing a ticket.',
    severity: 'major',
    category: 'ticket',
  },
  {
    id: 'poor_closure_confirmation',
    label: 'Poor closure confirmation',
    definition: 'Ticket is closed without confirming with the user that the issue is resolved.',
    operational_consequence: 'User may still be affected, leading to re-opened tickets and poor satisfaction.',
    evidence_patterns: [
      'No customer confirmation before closure',
      'Ticket closed based on technical fix alone',
      'No follow-up message to user',
    ],
    coaching_action: 'Train first-line to always confirm resolution with the user before closing a ticket.',
    severity: 'major',
    category: 'communication',
  },
  {
    id: 'multi_assignee_handoff',
    label: 'Multi-assignee handoff without context',
    definition: 'Ticket is reassigned multiple times without carrying context forward.',
    operational_consequence: 'Each new assignee must re-do discovery, causing user frustration.',
    evidence_patterns: [
      'Multiple assignee changes in history',
      'No handover notes between assignees',
      'Context lost with each reassignment',
    ],
    coaching_action: 'Train first-line to write clear handover notes when reassigning, including what has been done and what remains.',
    severity: 'major',
    category: 'process',
  },
  {
    id: 'long_unresolved_time',
    label: 'Long time in unresolved state',
    definition: 'Ticket remains in open/unresolved state for extended period without update.',
    operational_consequence: 'User perceives neglect; SLA likely breached.',
    evidence_patterns: [
      'Ticket open for days without assignee action',
      'No status updates during long resolution',
      'Gaps between status changes exceed SLA thresholds',
    ],
    coaching_action: 'Train first-line to provide regular status updates on long-running tickets, even if no resolution is ready.',
    severity: 'minor',
    category: 'process',
  },
  {
    id: 'priority_category_mismatch',
    label: 'Priority/category mismatch',
    definition: 'Assigned priority or category does not match the described severity or issue type.',
    operational_consequence: 'Ticket may be routed incorrectly or receive insufficient attention.',
    evidence_patterns: [
      'High-impact issue assigned low priority',
      'Category does not match described symptoms',
      'Priority set before scope/impact determined',
    ],
    coaching_action: 'Train first-line to set priority and category based on documented impact and scope, not assumption.',
    severity: 'major',
    category: 'ticket',
  },
  {
    id: 'vague_customer_update',
    label: 'Vague customer update',
    definition: 'Update to customer is vague and does not communicate status, timeline, or next steps.',
    operational_consequence: 'Customer remains uncertain and may escalate unnecessarily.',
    evidence_patterns: [
      'Update says "working on it" without specifics',
      'No ETA or timeline provided',
      'No explanation of current status',
    ],
    coaching_action: 'Train first-line to provide structured updates: what is being done, what is the ETA, what the customer should expect next.',
    severity: 'minor',
    category: 'communication',
  },
];

// --- Ticket Quality Examples ---

const ticketQualityExamples: TicketQualityExample[] = [
  {
    id: 'tq-missing-user',
    category: 'identity_access',
    priority: 'medium',
    summary: 'User cannot log in',
    description: 'User reported they cannot log in. Password reset attempted. Issue unresolved.',
    quality_flags: ['missing_affected_user', 'missing_scope', 'missing_business_impact', 'unclear_resolution'],
    quality_score: 15,
    notes: 'No user name, no scope, no impact, no resolution detail. Typical low-quality ticket from dataset.',
  },
  {
    id: 'tq-good-password-reset',
    category: 'identity_access',
    priority: 'high',
    summary: 'User James Wilson (Mercer & Tate Law) cannot log into M365 after password change. Account locked due to sync failure.',
    description: 'User: James Wilson, Mercer & Tate Law. Device: Windows desktop. Issue: Password changed yesterday, now cannot log into Outlook, Teams, document management. Scope: Single user. Impact: Cannot access email or documents for court filing. Urgency: Deadline 3pm today. Error: Invalid credentials. MFA prompts appear but password rejected. Diagnosis: Account locked after password change sync failure. Action: Reset sync, unlock account.',
    quality_flags: [],
    quality_score: 95,
    notes: 'Exemplary ticket with all required fields. Derived from authored scenario, inspired by realistic dataset patterns.',
  },
  {
    id: 'tq-vague-escalation',
    category: 'email_client',
    priority: 'medium',
    summary: 'Outlook issue - escalating to L2',
    description: 'User is having Outlook issues. Tried basic troubleshooting. Please escalate to second line.',
    quality_flags: ['missing_affected_user', 'missing_error_message', 'missing_troubleshooting_steps', 'missing_escalation_reason'],
    quality_score: 10,
    notes: 'No user, no error, no troubleshooting steps documented, no escalation reason. Common pattern in helpdesk data.',
  },
  {
    id: 'tq-partial-discovery-printer',
    category: 'hardware_printer',
    priority: 'medium',
    summary: 'HP LaserJet not printing at Westside Medical Centre',
    description: 'Printer: HP LaserJet Pro M404dn. Error: "Offline — Check Connection". Started: 2 hours ago. Other details pending.',
    quality_flags: ['missing_scope', 'missing_business_impact'],
    quality_score: 55,
    notes: 'Captured device and error but missed scope (multiple users affected) and impact (patient forms).',
  },
];

// --- Support Utterance Examples ---

const supportUtteranceExamples: SupportUtteranceExample[] = [
  {
    id: 'su-vague-start',
    role: 'customer',
    message: 'My email is not working. Can you fix it?',
    context: 'Opening message — customer reports email issue without details',
    quality_tags: ['vague', 'no_scope', 'no_error'],
  },
  {
    id: 'su-good-discovery-agent',
    role: 'agent',
    message: 'I understand this is urgent. When did this start, and what happens when you try to send an email?',
    context: 'Agent probing for timing and error details',
    quality_tags: ['good_discovery', 'urgency_acknowledgement', 'specific_question'],
  },
  {
    id: 'su-vague-agent-response',
    role: 'agent',
    message: 'Okay, I will log a ticket. Someone will get back to you.',
    context: 'Agent closes without troubleshooting or documenting',
    quality_tags: ['no_discovery', 'no_troubleshooting', 'vague_next_steps'],
  },
  {
    id: 'su-customer-impact',
    role: 'customer',
    message: 'I have a court filing deadline at 3pm today. I cannot access any of my documents.',
    context: 'Customer provides impact and urgency when prompted',
    quality_tags: ['impact_provided', 'urgency_provided', 'specific_deadline'],
  },
  {
    id: 'su-agent-scope-probe',
    role: 'agent',
    message: 'Is it just you affected, or are others in your firm having this issue too?',
    context: 'Agent probing for scope of outage',
    quality_tags: ['good_discovery', 'scope_probe'],
  },
  {
    id: 'su-customer-vague-update',
    role: 'customer',
    message: 'It is still not working. I tried what you said.',
    context: 'Customer providing vague update after attempted fix',
    quality_tags: ['vague_update', 'no_detail'],
  },
  {
    id: 'su-agent-structured-update',
    role: 'agent',
    message: 'I have identified the cause — your account password did not sync properly. I am resetting it now and will send a temporary password to your manager. You should be able to log in within 5 minutes.',
    context: 'Agent provides clear diagnosis, action, and timeline',
    quality_tags: ['good_update', 'cause_stated', 'action_stated', 'timeline_provided'],
  },
  {
    id: 'su-agent-no-escalation-context',
    role: 'agent',
    message: 'This needs to be escalated to L2.',
    context: 'Agent escalates without providing context or reason',
    quality_tags: ['no_escalation_reason', 'no_context'],
  },
];

// --- Manager-scored Ticket Examples (inspired by Mendeley structure) ---

const managerScoredExamples: ManagerScoredTicketExample[] = [
  {
    source: 'mendeley_helpdesk_tickets_v2',
    external_id: 'calibration-example-001',
    scores: {
      target_1: 4,
      target_2: 3,
      target_3: 5,
    },
    observed_ticket_features: {
      category_present: true,
      priority_present: true,
      resolution_time_available: true,
      messages_available: true,
      manager_score_available: true,
    },
    callcallum_interpretation: {
      possible_quality_signals: [
        'Ticket has category and priority — enables routing',
        'Resolution time available — enables SLA tracking',
        'Manager scored — possible calibration reference',
      ],
      limitations: [
        'Manager scoring target names need interpretation before use',
        'Scores are for a different appraisal model, not CallCallum readiness',
        'Original scoring context and rubric are not available in this derived record',
        'Cannot map target_1/2/3 to CallCallum criteria without original rubric',
      ],
    },
  },
  {
    source: 'mendeley_helpdesk_tickets_v2',
    external_id: 'calibration-example-002',
    scores: {
      target_1: 2,
      target_2: 2,
      target_3: 3,
    },
    observed_ticket_features: {
      category_present: true,
      priority_present: false,
      resolution_time_available: true,
      messages_available: false,
      manager_score_available: true,
    },
    callcallum_interpretation: {
      possible_quality_signals: [
        'Category present helps routing',
        'Missing priority may indicate incomplete triage',
        'No messages available — limited evidence for assessment',
      ],
      limitations: [
        'Low scores across all targets — suggests quality issues',
        'Cannot determine what targets measure without original documentation',
        'Missing priority in original dataset may be intentional or a data quality issue',
      ],
    },
  },
];

// --- File Writers ---

function writeJson(data: unknown, filepath: string): void {
  const dir = path.dirname(filepath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`  Wrote ${filepath}`);
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function main(): void {
  console.log('Building support-quality bank...');

  // Write failure mode bank
  const failureModeBank = {
    _meta: {
      generated_at: new Date().toISOString(),
      source_datasets: ['mendeley_helpdesk_tickets_v2'],
      description: 'Failure-mode taxonomy derived from external helpdesk dataset patterns and CallCallum assessment experience',
      total_modes: failureModes.length,
    },
    failure_modes: failureModes,
  };
  writeJson(failureModeBank, 'data/derived/failure-mode-bank.seed.json');

  // Write ticket quality examples
  const ticketBank = {
    _meta: {
      generated_at: new Date().toISOString(),
      source_datasets: ['mendeley_helpdesk_tickets_v2', 'callcallum_authored_scenarios'],
      description: 'Ticket quality examples inspired by external dataset patterns. These are not assessment truth — they are reference material.',
      total_examples: ticketQualityExamples.length,
    },
    examples: ticketQualityExamples.map(ex => ({
      ...ex,
      id: ex.id || generateId('tq'),
    })),
  };
  writeJson(ticketBank, 'data/derived/ticket-quality-examples.seed.json');

  // Write support utterance examples
  const utteranceBank = {
    _meta: {
      generated_at: new Date().toISOString(),
      source_datasets: ['mendeley_helpdesk_tickets_v2', 'callcallum_authored_scenarios'],
      description: 'Support utterance examples demonstrating quality signals and anti-patterns.',
      total_examples: supportUtteranceExamples.length,
    },
    examples: supportUtteranceExamples,
  };
  writeJson(utteranceBank, 'data/derived/support-utterance-examples.seed.json');

  // Write manager-scored ticket examples
  const managerScoredBank = {
    _meta: {
      generated_at: new Date().toISOString(),
      source_datasets: ['mendeley_helpdesk_tickets_v2'],
      description: 'Calibration examples inspired by Mendeley scored_issues_snapshot_sample.xlsx. These scores are NOT CallCallum readiness scores.',
      warning: 'Mendeley manager scores are for an unknown appraisal model. Do not use as CallCallum readiness scoring.',
      total_examples: managerScoredExamples.length,
    },
    examples: managerScoredExamples,
  };
  writeJson(managerScoredBank, 'data/derived/manager-scored-ticket-examples.seed.json');

  console.log('\nSupport-quality bank build complete.');
  console.log(`  Failure modes: ${failureModes.length}`);
  console.log(`  Ticket examples: ${ticketQualityExamples.length}`);
  console.log(`  Utterance examples: ${supportUtteranceExamples.length}`);
  console.log(`  Manager-scored examples: ${managerScoredExamples.length}`);
}

main();
