import { CHECKPOINT_KEYS } from '@/lib/types';
import { getCheckpointContribution } from '@/lib/scoring';

const CHECKPOINT_LABELS: Record<string, string> = {
  name_verified: 'Name verified',
  company_confirmed: 'Company confirmed',
  hostname_gathered: 'Hostname gathered',
  location_confirmed: 'Location confirmed',
  issue_defined: 'Issue defined',
  last_working_asked: 'Last working asked',
  recent_changes_asked: 'Recent changes asked',
  exact_error_asked: 'Exact error asked',
  reboot_asked: 'Reboot asked',
  scope_determined: 'Scope determined',
  impact_determined: 'Impact determined',
  priority_assigned: 'Priority assigned',
  ticket_expectation_set: 'Ticket expectation set',
  timeframe_given: 'Timeframe given',
  callback_window_given: 'Callback window given',
};

interface CheckpointListProps {
  checkpoints: Record<string, boolean>;
  showWeights?: boolean;
}

export function CheckpointList({ checkpoints, showWeights = false }: CheckpointListProps) {
  return (
    <ul className="space-y-2">
      {CHECKPOINT_KEYS.map((key) => {
        const passed = checkpoints?.[key] === true;
        const contrib = showWeights ? getCheckpointContribution(key, passed) : null;
        return (
          <li
            key={key}
            className={`flex items-center justify-between p-2 rounded ${
              passed ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}
          >
            <span>{CHECKPOINT_LABELS[key] || key}</span>
            <span className="flex items-center gap-2">
              {showWeights && contrib && (
                <span className="text-slate-500 text-xs">
                  {contrib.percentage}% ({contrib.weight}pts)
                </span>
              )}
              {passed ? '✓' : '✗'}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
