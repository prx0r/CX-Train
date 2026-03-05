import type { Checkpoints } from './types';

// Checkpoint weights for score calculation (mirrors GPT scoring)
const CHECKPOINT_WEIGHTS: Record<string, number> = {
  name_verified: 5,
  company_confirmed: 5,
  hostname_gathered: 12,
  location_confirmed: 4,
  issue_defined: 8,
  last_working_asked: 6,
  recent_changes_asked: 6,
  exact_error_asked: 6,
  reboot_asked: 5,
  scope_determined: 8,
  impact_determined: 10,
  priority_assigned: 10,
  ticket_expectation_set: 6,
  timeframe_given: 6,
  callback_window_given: 9,
};

const TOTAL_WEIGHT = Object.values(CHECKPOINT_WEIGHTS).reduce((a, b) => a + b, 0);

export function calculateScoreFromCheckpoints(checkpoints: Checkpoints): number {
  let earned = 0;
  for (const [key, weight] of Object.entries(CHECKPOINT_WEIGHTS)) {
    if (checkpoints[key as keyof Checkpoints] === true) {
      earned += weight;
    }
  }
  return Math.round((earned / TOTAL_WEIGHT) * 100);
}

export function getCheckpointContribution(
  checkpoint: string,
  passed: boolean
): { weight: number; earned: number; percentage: number } {
  const weight = CHECKPOINT_WEIGHTS[checkpoint] ?? 0;
  const earned = passed ? weight : 0;
  const percentage = Math.round((earned / TOTAL_WEIGHT) * 100);
  return { weight, earned, percentage };
}

export { CHECKPOINT_WEIGHTS, TOTAL_WEIGHT };
