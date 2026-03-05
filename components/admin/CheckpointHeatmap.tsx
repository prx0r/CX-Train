'use client';

import { CHECKPOINT_KEYS } from '@/lib/types';

const CHECKPOINT_LABELS: Record<string, string> = {
  name_verified: 'Name',
  company_confirmed: 'Company',
  hostname_gathered: 'Hostname',
  location_confirmed: 'Location',
  issue_defined: 'Issue',
  last_working_asked: 'Last working',
  recent_changes_asked: 'Recent changes',
  exact_error_asked: 'Exact error',
  reboot_asked: 'Reboot',
  scope_determined: 'Scope',
  impact_determined: 'Impact',
  priority_assigned: 'Priority',
  ticket_expectation_set: 'Ticket expect',
  timeframe_given: 'Timeframe',
  callback_window_given: 'Callback',
};

interface CheckpointHeatmapProps {
  sessions: { id: string; checkpoints: Record<string, boolean>; created_at: string }[];
  maxSessions?: number;
}

export function CheckpointHeatmap({ sessions, maxSessions = 10 }: CheckpointHeatmapProps) {
  const displaySessions = sessions.slice(0, maxSessions);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left p-2 text-slate-400 text-xs font-medium w-24">Session</th>
              {CHECKPOINT_KEYS.map((key) => (
                <th
                  key={key}
                  className="p-2 text-slate-400 text-xs font-medium text-center min-w-[4rem]"
                  title={key}
                >
                  {CHECKPOINT_LABELS[key] || key.slice(0, 8)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displaySessions.map((session, i) => (
              <tr key={session.id} className="border-t border-slate-700/50">
                <td className="p-2 text-slate-500 text-xs">
                  #{displaySessions.length - i}
                </td>
                {CHECKPOINT_KEYS.map((key) => {
                  const passed = (session.checkpoints as Record<string, boolean>)?.[key] === true;
                  return (
                    <td key={key} className="p-1 text-center">
                      <div
                        className={`w-8 h-8 mx-auto rounded flex items-center justify-center ${
                          passed ? 'bg-green-500/30 text-green-400' : 'bg-red-500/30 text-red-400'
                        }`}
                        title={`${CHECKPOINT_LABELS[key] || key}: ${passed ? 'Passed' : 'Failed'}`}
                      >
                        {passed ? '✓' : '✗'}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
