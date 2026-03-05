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
          className="block p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg hover:border-slate-600 transition"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-slate-100">
                {Array.isArray(s.users) ? s.users[0]?.name : s.users?.name ?? 'Unknown'}
              </span>
              <span className="text-slate-500 ml-2">Stage {s.pathway_stage ?? '-'}</span>
            </div>
            <div className="flex items-center gap-3">
              {(s.hostname_gathered === false || s.impact_gathered === false) && (
                <span className="text-xs text-red-400 font-medium">Critical fail</span>
              )}
              <ScoreBadge score={s.score ?? 0} passed={s.passed ?? false} size="sm" />
            </div>
          </div>
          <p className="text-slate-500 text-xs mt-1">
            {new Date(s.created_at).toLocaleString()}
          </p>
        </Link>
      ))}
    </div>
  );
}
