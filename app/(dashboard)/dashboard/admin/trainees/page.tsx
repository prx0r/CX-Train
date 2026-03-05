import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { TraineesTable } from '@/components/admin/TraineesTable';

export default async function AdminTraineesPage() {
  await requireAdmin();
  const supabase = createServerClient();

  const { data: trainees } = await supabase
    .from('users')
    .select(`
      id, name, email,
      trainee_progress!left (current_stage, boss_battle_unlocked, boss_battle_passed, cleared_for_live, avg_score, bot_id)
    `)
    .eq('role', 'trainee')
    .order('name');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-slate-100 mb-8">Trainees</h1>
      <TraineesTable
        trainees={(trainees ?? []).map((t) => {
          const progress = Array.isArray(t.trainee_progress) ? t.trainee_progress : [t.trainee_progress].filter(Boolean);
          const callSimProgress = progress.filter((p: { bot_id?: string }) => p?.bot_id === 'call_sim');
          return { ...t, trainee_progress: callSimProgress };
        })}
      />
    </div>
  );
}
