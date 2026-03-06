import Link from 'next/link';
import { ScoreBadge } from '@/components/shared/ScoreBadge';

interface Session {
  id: string;
  score: number | null;
  passed: boolean | null;
  hostname_gathered: boolean | null;
  impact_gathered: boolean | null;
  pathway_stage: number | null;
  bot_id: string;
  created_at: string;
  users?: { name: string } | { name: string }[] | null;
}

interface SessionFeedProps {
  sessions: Session[];
}

export function SessionFeed({ sessions }: SessionFeedProps) {
  return (
    <div className="space-y-2">
      {sessions.map((s) => (
        <Link
          key={s.id}
          href={`/dashboard/admin/sessions/${s.id}`}
          className="block rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4 hover:border-zinc-700 hover:bg-zinc-800/40 transition"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-white">
                {Array.isArray(s.users) ? s.users[0]?.name : s.users?.name ?? 'Unknown'}
              </span>
              <span className="text-zinc-500 ml-2 text-sm">Stage {s.pathway_stage ?? '-'}</span>
            </div>
            <div className="flex items-center gap-3">
              {(s.hostname_gathered === false || s.impact_gathered === false) && (
                <span className="text-xs text-red-400 font-medium">Critical fail</span>
              )}
              <ScoreBadge score={s.score ?? 0} passed={s.passed ?? false} size="sm" />
            </div>
          </div>
          <p className="text-zinc-500 text-xs mt-1">
            {new Date(s.created_at).toLocaleString()}
          </p>
        </Link>
      ))}
    </div>
  );
}
