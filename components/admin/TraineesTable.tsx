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
    level?: number;
    level_points?: number;
  }[];
}

interface TraineesTableProps {
  trainees: Trainee[];
}

export function TraineesTable({ trainees }: TraineesTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800/60">
      <table className="w-full">
        <thead className="bg-zinc-900/50">
          <tr>
            <th className="text-left p-4 text-zinc-500 text-xs font-medium uppercase tracking-wider">Name</th>
            <th className="text-left p-4 text-zinc-500 text-xs font-medium uppercase tracking-wider">Email</th>
            <th className="text-left p-4 text-zinc-500 text-xs font-medium uppercase tracking-wider">Stage</th>
            <th className="text-left p-4 text-zinc-500 text-xs font-medium uppercase tracking-wider">Level</th>
            <th className="text-left p-4 text-zinc-500 text-xs font-medium uppercase tracking-wider">Avg Score</th>
            <th className="text-left p-4 text-zinc-500 text-xs font-medium uppercase tracking-wider">Final</th>
            <th className="text-left p-4 text-zinc-500 text-xs font-medium uppercase tracking-wider">Cleared</th>
          </tr>
        </thead>
        <tbody>
          {trainees.map((t) => {
            const progress = t.trainee_progress?.[0];
            return (
              <tr key={t.id} className="border-t border-zinc-800/60 hover:bg-zinc-900/30">
                <td className="p-4">
                  <Link
                    href={`/dashboard/admin/trainees/${t.id}`}
                    className="font-medium text-sky-400 hover:text-sky-300"
                  >
                    {t.name}
                  </Link>
                </td>
                <td className="p-4 text-zinc-400 text-sm">{t.email}</td>
                <td className="p-4 text-white">
                  {progress ? `${progress.current_stage}/10` : '-'}
                </td>
                <td className="p-4 text-white">
                  {progress ? `L${progress.level ?? 1} • ${progress.level_points ?? 0}` : '-'}
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
                    <span className="text-emerald-400">Passed</span>
                  ) : progress?.boss_battle_unlocked ? (
                    <span className="text-amber-400">Unlocked</span>
                  ) : (
                    <span className="text-zinc-500">Locked</span>
                  )}
                </td>
                <td className="p-4">
                  {progress?.cleared_for_live ? (
                    <span className="inline-flex px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">
                      Yes
                    </span>
                  ) : (
                    <span className="text-zinc-500">No</span>
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
