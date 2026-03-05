import { requireAuth } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { SessionCard } from '@/components/trainee/SessionCard';
import Link from 'next/link';

export default async function TraineeHistoryPage() {
  const user = await requireAuth();
  const supabase = createServerClient();

  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      id, score, passed, pathway_stage, created_at,
      personalities (name, avatar_emoji)
    `)
    .eq('user_id', user.id)
    .eq('bot_id', 'call_sim')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-slate-100 mb-8">Session history</h1>
      <div className="space-y-3">
        {(sessions ?? []).map((s) => (
          <Link key={s.id} href={`/dashboard/trainee/sessions/${s.id}`}>
            <SessionCard
              session={{
                id: s.id,
                score: s.score ?? 0,
                passed: s.passed ?? false,
                pathway_stage: s.pathway_stage,
                created_at: s.created_at,
                personality: s.personalities as { name: string; avatar_emoji: string } | null,
              }}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
