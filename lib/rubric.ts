export type RubricCategory =
  | 'professionalism'
  | 'friendliness'
  | 'qualification'
  | 'setting_expectations'
  | 'obtaining_symptoms';

export interface RubricItem {
  key: string;
  label: string;
  weight: number;
}

export const RUBRIC: Record<RubricCategory, RubricItem[]> = {
  professionalism: [
    { key: 'calm_controlled_language', label: 'Calm, controlled language', weight: 2 },
    { key: 'no_overpromise', label: 'No over-promising', weight: 2 },
    { key: 'ownership_next_step', label: 'Clear ownership of next steps', weight: 2 },
    { key: 'no_fake_actions', label: 'No invented tools/actions', weight: 2 },
    { key: 'structured_summary', label: 'Structured summary before closing', weight: 2 },
  ],
  friendliness: [
    { key: 'polite_greeting', label: 'Polite greeting', weight: 2 },
    { key: 'used_name', label: 'Used caller name', weight: 2 },
    { key: 'empathy_statement', label: 'Empathy statement', weight: 2 },
    { key: 'courteous_close', label: 'Courteous close', weight: 2 },
    { key: 'positive_tone', label: 'Positive tone throughout', weight: 2 },
  ],
  qualification: [
    { key: 'asked_scope', label: 'Asked scope', weight: 2 },
    { key: 'asked_impact', label: 'Asked impact', weight: 2 },
    { key: 'clarified_severity', label: 'Clarified severity', weight: 2 },
    { key: 'validated_priority_against_sla', label: 'Validated priority against SLA', weight: 2 },
    { key: 'confirmed_workaround', label: 'Confirmed workaround status', weight: 2 },
  ],
  setting_expectations: [
    { key: 'stated_ticket_logging', label: 'Stated ticket will be logged', weight: 2 },
    { key: 'provided_response_time', label: 'Provided response timeframe', weight: 2 },
    { key: 'provided_resolution_or_review', label: 'Provided resolution/review expectation', weight: 2 },
    { key: 'provided_callback_window', label: 'Provided callback window', weight: 2 },
    { key: 'set_next_step_owner', label: 'Set next step and owner', weight: 2 },
  ],
  obtaining_symptoms: [
    { key: 'asked_symptoms', label: 'Asked for symptoms', weight: 2 },
    { key: 'asked_last_working', label: 'Asked when last working', weight: 2 },
    { key: 'asked_recent_changes', label: 'Asked about recent changes', weight: 2 },
    { key: 'asked_exact_error', label: 'Asked for exact error', weight: 2 },
    { key: 'asked_reboot_or_basic_check', label: 'Asked for basic check if relevant', weight: 2 },
  ],
};

export const RUBRIC_MAX_SCORE = 10;
