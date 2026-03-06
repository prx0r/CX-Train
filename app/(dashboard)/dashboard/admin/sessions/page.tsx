import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { SessionTableRow } from '@/components/admin/SessionTableRow';

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
              <SessionTableRow key={s.id} session={s} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
