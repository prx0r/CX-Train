import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { TraineesTable } from '@/components/admin/TraineesTable';
import Link from 'next/link';

export default async function AdminTraineesPage() {
  await requireAdmin();
  const supabase = createServerClient();

  const { data: trainees } = await supabase
    .from('users')
    .select(`
      id, name, email,
      trainee_progress!left (current_stage, boss_battle_unlocked, boss_battle_passed, cleared_for_live, avg_score, level, level_points, bot_id)
    `)
    .eq('role', 'trainee')
    .order('name');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Trainees</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Click a trainee to see their stats, bot feedback, ticket screenshots, and suitability for live calls.
        </p>
      </div>

      <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 mb-8">
        <p className="text-sky-200/90 text-sm">
          <strong>Tip:</strong> Each trainee has a dedicated page with overall progress, scores over time, 
          feedback from each bot, exemplar tickets they&apos;ve raised, and a live-call suitability recommendation.
        </p>
      </div>

      <TraineesTable
        trainees={(trainees ?? []).map((t) => {
          const progress = Array.isArray(t.trainee_progress)
            ? t.trainee_progress
            : [t.trainee_progress].filter(Boolean);
          const callSimProgress = progress.filter(
            (p: { bot_id?: string }) => p?.bot_id === 'call_sim'
          );
          return { ...t, trainee_progress: callSimProgress };
        })}
      />
    </div>
  );
}
