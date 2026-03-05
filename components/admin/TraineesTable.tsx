import Link from 'next/link';
import { ScoreBadge } from '@/components/shared/ScoreBadge';

interface Trainee {
  id: string;
  name: string;
  email: string;
  trainee_progress?: {
    current_stage: number;
    boss_battle_unlocked: boolean;
    boss_battle_passed: boolean;
    cleared_for_live: boolean;
    avg_score: number;
  }[];
}

interface TraineesTableProps {
  trainees: Trainee[];
}

export function TraineesTable({ trainees }: TraineesTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700">
      <table className="w-full">
        <thead className="bg-slate-800/50">
          <tr>
            <th className="text-left p-4 text-slate-400 font-medium">Name</th>
            <th className="text-left p-4 text-slate-400 font-medium">Email</th>
            <th className="text-left p-4 text-slate-400 font-medium">Stage</th>
            <th className="text-left p-4 text-slate-400 font-medium">Avg Score</th>
            <th className="text-left p-4 text-slate-400 font-medium">Boss Battle</th>
            <th className="text-left p-4 text-slate-400 font-medium">Cleared</th>
          </tr>
        </thead>
        <tbody>
          {trainees.map((t) => {
            const progress = t.trainee_progress?.[0];
            return (
              <tr key={t.id} className="border-t border-slate-700/50 hover:bg-slate-800/30">
                <td className="p-4">
                  <Link
                    href={`/dashboard/admin/trainees/${t.id}`}
                    className="font-medium text-blue-400 hover:text-blue-300"
                  >
                    {t.name}
                  </Link>
                </td>
                <td className="p-4 text-slate-400">{t.email}</td>
                <td className="p-4">
                  {progress ? `${progress.current_stage}/10` : '-'}
                </td>
                <td className="p-4">
                  {progress ? (
                    <ScoreBadge score={Math.round(progress.avg_score)} size="sm" />
                  ) : (
                    '-'
                  )}
                </td>
                <td className="p-4">
                  {progress?.boss_battle_passed ? (
                    <span className="text-green-400">Passed</span>
                  ) : progress?.boss_battle_unlocked ? (
                    <span className="text-amber-400">Unlocked</span>
                  ) : (
                    <span className="text-slate-500">Locked</span>
                  )}
                </td>
                <td className="p-4">
                  {progress?.cleared_for_live ? (
                    <span className="inline-flex px-2 py-1 bg-green-500/20 text-green-400 rounded text-sm font-medium">
                      Yes
                    </span>
                  ) : (
                    <span className="text-slate-500">No</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
