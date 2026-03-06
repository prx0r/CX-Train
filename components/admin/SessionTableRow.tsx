'use client';

import { useRouter } from 'next/navigation';
import { ScoreBadge } from '@/components/shared/ScoreBadge';

interface SessionTableRowProps {
  session: {
    id: string;
    score: number | null;
    passed: boolean | null;
    pathway_stage: number | null;
    hostname_gathered: boolean | null;
    impact_gathered: boolean | null;
    created_at: string;
    users?: { name?: string } | { name?: string }[] | null;
  };
}

export function SessionTableRow({ session }: SessionTableRowProps) {
  const router = useRouter();
  const userName = (() => {
    const u = session.users;
    if (Array.isArray(u)) return u[0]?.name;
    return (u as { name?: string } | null)?.name;
  })();

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/dashboard/admin/sessions/${session.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          router.push(`/dashboard/admin/sessions/${session.id}`);
        }
      }}
      className="border-t border-slate-700/50 cursor-pointer transition-colors hover:bg-slate-800/50 focus:bg-slate-800/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-inset"
    >
      <td className="p-4">
        <span className="font-medium text-blue-400">{userName ?? 'Unknown'}</span>
      </td>
      <td className="p-4 text-slate-400">{session.pathway_stage ?? '-'}</td>
      <td className="p-4">
        <ScoreBadge score={session.score ?? 0} passed={session.passed ?? false} size="sm" />
      </td>
      <td className="p-4">
        {(session.hostname_gathered === false || session.impact_gathered === false) && (
          <span className="text-red-400 text-sm">Yes</span>
        )}
      </td>
      <td className="p-4 text-slate-500 text-sm">
        {new Date(session.created_at).toLocaleString()}
      </td>
    </tr>
  );
}
