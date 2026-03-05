import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import Link from 'next/link';
import { ScoreBadge } from '@/components/shared/ScoreBadge';

export default async function AdminSessionsPage() {
  await requireAdmin();
  const supabase = createServerClient();

  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      id, score, passed, pathway_stage, hostname_gathered, impact_gathered, bot_id, created_at,
      users (name)
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-slate-100 mb-8">Sessions</h1>
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full">
          <thead className="bg-slate-800/50">
            <tr>
              <th className="text-left p-4 text-slate-400 font-medium">Tech</th>
              <th className="text-left p-4 text-slate-400 font-medium">Stage</th>
              <th className="text-left p-4 text-slate-400 font-medium">Score</th>
              <th className="text-left p-4 text-slate-400 font-medium">Critical</th>
              <th className="text-left p-4 text-slate-400 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {(sessions ?? []).map((s) => (
              <tr key={s.id} className="border-t border-slate-700/50 hover:bg-slate-800/30">
                <td className="p-4">
                  <Link
                    href={`/dashboard/admin/sessions/${s.id}`}
                    className="font-medium text-blue-400 hover:text-blue-300"
                  >
                    {(s as { users?: { name: string } }).users?.name ?? 'Unknown'}
                  </Link>
                </td>
                <td className="p-4 text-slate-400">{s.pathway_stage ?? '-'}</td>
                <td className="p-4">
                  <ScoreBadge score={s.score ?? 0} passed={s.passed ?? false} size="sm" />
                </td>
                <td className="p-4">
                  {(s.hostname_gathered === false || s.impact_gathered === false) && (
                    <span className="text-red-400 text-sm">Yes</span>
                  )}
                </td>
                <td className="p-4 text-slate-500 text-sm">
                  {new Date(s.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
