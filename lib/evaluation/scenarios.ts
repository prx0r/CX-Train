import type { RubricItem } from '../types';

export const FIRST_CALLS_SCENARIO_TITLES = ['Password/login issue', 'Outlook not sending', 'Printer not printing'] as const;

export const SCENARIO_RUBRICS: Record<string, RubricItem[]> = {
  'Password/login issue': [
    { key: 'confirm_user', label: 'Confirmed user identity', weight: 10 },
    { key: 'confirm_company', label: 'Confirmed company', weight: 10 },
    { key: 'capture_device_or_hostname', label: 'Captured device/hostname', weight: 10 },
    { key: 'ask_when_started', label: 'Asked when issue started', weight: 10 },
    { key: 'ask_scope_one_or_many', label: 'Checked scope (one or many)', weight: 15 },
    { key: 'ask_business_impact', label: 'Assessed business impact', weight: 15 },
    { key: 'ask_deadline', label: 'Asked about deadline', weight: 5 },
    { key: 'ask_error_message', label: 'Asked for error message', weight: 10 },
    { key: 'ask_recent_changes', label: 'Asked about recent changes', weight: 10 },
    { key: 'set_next_steps', label: 'Set next step expectations', weight: 5 },
  ],
  'Outlook not sending': [
    { key: 'confirm_user', label: 'Confirmed user identity', weight: 10 },
    { key: 'confirm_company', label: 'Confirmed company', weight: 10 },
    { key: 'capture_device_or_hostname', label: 'Captured device/hostname', weight: 10 },
    { key: 'ask_when_started', label: 'Asked when issue started', weight: 10 },
    { key: 'ask_scope_one_or_many', label: 'Checked scope (one or many)', weight: 15 },
    { key: 'ask_business_impact', label: 'Assessed business impact', weight: 15 },
    { key: 'ask_deadline', label: 'Asked about deadline', weight: 5 },
    { key: 'ask_error_message', label: 'Asked for error message', weight: 10 },
    { key: 'ask_recent_changes', label: 'Asked about recent changes', weight: 10 },
    { key: 'ask_workaround', label: 'Asked about workaround', weight: 5 },
    { key: 'set_next_steps', label: 'Set next step expectations', weight: 5 },
  ],
  'Printer not printing': [
    { key: 'confirm_user', label: 'Confirmed user identity', weight: 10 },
    { key: 'confirm_company', label: 'Confirmed company', weight: 5 },
    { key: 'capture_device_or_hostname', label: 'Captured device/hostname', weight: 10 },
    { key: 'ask_when_started', label: 'Asked when issue started', weight: 10 },
    { key: 'ask_scope_one_or_many', label: 'Checked scope (one or many)', weight: 15 },
    { key: 'ask_business_impact', label: 'Assessed business impact', weight: 15 },
    { key: 'ask_deadline', label: 'Asked about deadline', weight: 10 },
    { key: 'ask_error_message', label: 'Asked for error message', weight: 10 },
    { key: 'ask_recent_changes', label: 'Asked about recent changes', weight: 10 },
    { key: 'ask_workaround', label: 'Asked about workaround', weight: 5 },
    { key: 'set_next_steps', label: 'Set next step expectations', weight: 5 },
  ],
};

export function getRubric(scenarioTitle: string, dbRubric: unknown): RubricItem[] {
  if (Array.isArray(dbRubric) && dbRubric.length > 0 && typeof dbRubric[0] === 'object' && 'weight' in dbRubric[0]) {
    return dbRubric as RubricItem[];
  }
  return SCENARIO_RUBRICS[scenarioTitle] ?? [];
}

export function getTotalWeight(rubric: RubricItem[]): number {
  return rubric.reduce((sum, item) => sum + item.weight, 0);
}
