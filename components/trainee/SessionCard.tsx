import Link from 'next/link';
import { ScoreBadge } from '@/components/shared/ScoreBadge';

interface SessionCardProps {
  session: {
    id: string;
    score: number;
    passed: boolean;
    pathway_stage: number | null;
    created_at: string;
    personality: { name: string; avatar_emoji: string } | null;
  };
}

export function SessionCard({ session }: SessionCardProps) {
  return (
    <div className="p-4 rounded-xl border border-zinc-800/60 bg-zinc-900/50 hover:border-zinc-700 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-zinc-500 text-sm">Stage {session.pathway_stage ?? '-'}</span>
          {session.personality && (
            <span className="ml-2 text-zinc-400">
              {session.personality.avatar_emoji} {session.personality.name}
            </span>
          )}
        </div>
        <ScoreBadge score={session.score} passed={session.passed} size="sm" />
      </div>
      <p className="text-zinc-500 text-xs mt-1">
        {new Date(session.created_at).toLocaleString()}
      </p>
    </div>
  );
}
