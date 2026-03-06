// Human-readable statements for checkpoint strengths/weaknesses (inferred from pass rates)

export const CHECKPOINT_WEAKNESS_STATEMENTS: Record<string, string> = {
  name_verified: 'Often skips caller verification',
  company_confirmed: 'Sometimes misses company confirmation',
  hostname_gathered: 'Struggles to capture device/hostname',
  location_confirmed: 'Forgets to confirm location',
  issue_defined: 'Rushes to solution before defining issue',
  last_working_asked: "Doesn't always ask when it last worked",
  recent_changes_asked: 'Skips recent changes question',
  exact_error_asked: 'Misses exact error message',
  reboot_asked: 'Forgets to ask about reboot',
  scope_determined: 'Unclear scope assessment',
  impact_determined: 'Weak on business impact assessment',
  priority_assigned: 'Struggles with priority assignment',
  ticket_expectation_set: 'Misses setting ticket expectations',
  timeframe_given: 'Inconsistent on timeframe',
  callback_window_given: "Doesn't always set callback window",
};

export const CHECKPOINT_STRENGTH_STATEMENTS: Record<string, string> = {
  name_verified: 'Strong caller verification',
  company_confirmed: 'Consistently confirms company',
  hostname_gathered: 'Reliably captures device info',
  location_confirmed: 'Always confirms location',
  issue_defined: 'Clearly defines issue before troubleshooting',
  last_working_asked: 'Routinely asks when it last worked',
  recent_changes_asked: 'Consistently checks for recent changes',
  exact_error_asked: 'Captures exact error messages',
  reboot_asked: 'Always asks about reboot',
  scope_determined: 'Clear scope assessment',
  impact_determined: 'Strong business impact assessment',
  priority_assigned: 'Accurate priority assignment',
  ticket_expectation_set: 'Sets clear ticket expectations',
  timeframe_given: 'Consistent on timeframe',
  callback_window_given: 'Reliably sets callback window',
};
