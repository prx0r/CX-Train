import { SimActionConfig, SimActionResult } from './types';

export function applyAction(
  state: Record<string, unknown>,
  action: SimActionConfig,
): SimActionResult {
  const state_before = { ...state };
  const state_after = { ...state };

  // Apply state patch
  if (action.state_patch) {
    for (const [key, val] of Object.entries(action.state_patch)) {
      state_after[key] = val;
    }
  }

  // Build visible state
  const visible_state: Record<string, unknown> = {};
  const safeKeys = ['outlook_open', 'outlook_mode', 'outbox_count', 'webmail_can_send', 'test_email_sent', 'issue_resolved', 'browser_open', 'outlook_status'];
  for (const key of safeKeys) {
    if (key in state_after) visible_state[key] = state_after[key];
  }
  if (action.visible_state_patch) {
    for (const [key, val] of Object.entries(action.visible_state_patch)) {
      visible_state[key] = val;
    }
  }

  return {
    action_id: action.id,
    label: action.label,
    result_text: action.result,
    state_before,
    state_after,
    visible_state,
    red_flag: action.red_flag,
  };
}
