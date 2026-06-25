import { SimActionConfig, SimPackConfig, SimToolId } from './types';

const OUTLOOK_TOOLS: SimToolId[] = ['customer_chat', 'ticket', 'outlook', 'browser', 'cmd', 'notes'];

const OUTLOOK_ACTIONS: SimActionConfig[] = [
  {
    id: 'open_outlook',
    tool: 'outlook',
    label: 'Open Outlook',
    result: 'Outlook is open. Outbox shows 3 unsent messages.',
    state_patch: { outlook_open: true },
    visible_state_patch: { outlook_open: true, outbox_count: 3 },
    score_tags: ['tool_accessed'],
  },
  {
    id: 'check_outlook_status',
    tool: 'outlook',
    label: 'Check Outlook status',
    result: 'Outlook is showing Working Offline.',
    requires_state: { outlook_open: true },
    visible_state_patch: { outlook_status: 'Working Offline' },
    score_tags: ['technical_discovery', 'error_or_status_capture'],
  },
  {
    id: 'toggle_work_offline',
    tool: 'outlook',
    label: 'Turn off Work Offline',
    result: 'Work Offline is now disabled.',
    requires_state: { outlook_open: true },
    state_patch: { outlook_mode: 'online' },
    visible_state_patch: { outlook_status: 'Online' },
    score_tags: ['technical_resolution'],
  },
  {
    id: 'send_test_email',
    tool: 'outlook',
    label: 'Send test email',
    result: 'The test email sends successfully and the Outbox clears.',
    requires_state: { outlook_mode: 'online' },
    state_patch: { test_email_sent: true, outbox_count: 0, issue_resolved: true },
    visible_state_patch: { outbox_count: 0, test_email_sent: true },
    score_tags: ['verification', 'first_call_resolution'],
  },
  {
    id: 'check_outbox',
    tool: 'outlook',
    label: 'Check Outbox',
    result: 'The Outbox contains 3 unsent messages.',
    requires_state: { outlook_open: true },
    visible_state_patch: { outbox_count: 3 },
    score_tags: ['technical_discovery'],
  },
  {
    id: 'open_browser',
    tool: 'browser',
    label: 'Open browser',
    result: 'Browser is open.',
    state_patch: { browser_open: true },
    visible_state_patch: { browser_open: true },
  },
  {
    id: 'check_webmail',
    tool: 'browser',
    label: 'Check webmail',
    result: 'Webmail opens and can send email successfully.',
    requires_state: { browser_open: true },
    visible_state_patch: { webmail_can_send: true },
    score_tags: ['scope_isolation', 'technical_discovery'],
  },
  {
    id: 'run_ping',
    tool: 'cmd',
    label: 'Run basic connectivity check',
    result: 'Ping succeeds. Internet connectivity is working.',
    score_tags: ['scope_isolation'],
  },
  {
    id: 'reinstall_outlook',
    tool: 'outlook',
    label: 'Reinstall Outlook',
    result: 'This is excessive before basic checks and would waste time.',
    red_flag: 'over_fixing_without_evidence',
  },
  {
    id: 'delete_mail_profile',
    tool: 'outlook',
    label: 'Delete mail profile',
    result: 'This is a risky/destructive step before basic checks.',
    red_flag: 'destructive_action_without_evidence',
  },
  {
    id: 'escalate_without_basic_checks',
    tool: 'ticket',
    label: 'Escalate without basic checks',
    result: 'Escalation is premature because basic checks have not been completed.',
    red_flag: 'escalate_without_basic_checks',
  },
];

export const OUTLOOK_SIM_PACK_ID = 'pack-outlook-sim-v1';

export function getOutlookSimPackConfig(): SimPackConfig {
  return { tools: OUTLOOK_TOOLS, actions: OUTLOOK_ACTIONS };
}

export function getOutlookSimInitialState(): Record<string, unknown> {
  return {
    outlook_open: false,
    outlook_mode: 'offline',
    outbox_count: 3,
    webmail_can_send: true,
    test_email_sent: false,
    issue_resolved: false,
    ticket_note_submitted: false,
    browser_open: false,
  };
}

export function getOutlookSimSuccessConditions(): Record<string, unknown> {
  return {
    outlook_mode: 'online',
    outbox_count: 0,
    test_email_sent: true,
    ticket_note_submitted: true,
  };
}

export function getSafeVisibleState(state: Record<string, unknown>): Record<string, unknown> {
  const visible: Record<string, unknown> = {};
  const safeKeys = ['outlook_open', 'outlook_mode', 'outbox_count', 'webmail_can_send', 'test_email_sent', 'issue_resolved', 'browser_open', 'outlook_status'];
  for (const key of safeKeys) {
    if (key in state) visible[key] = state[key];
  }
  return visible;
}

export function getSafeActions(state: Record<string, unknown>, allActions: SimActionConfig[]): { id: string; tool: SimToolId; label: string }[] {
  return allActions
    .filter(a => {
      if (!a.requires_state) return true;
      if (a.red_flag) return true;
      for (const [key, val] of Object.entries(a.requires_state)) {
        if (state[key] !== val) return false;
      }
      return true;
    })
    .filter(a => !a.red_flag) // hide red flag actions from candidate
    .map(a => ({ id: a.id, tool: a.tool, label: a.label }));
}
