import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { StatCard } from '@/components/admin/StatCard';
import { SessionFeed } from '@/components/admin/SessionFeed';
import { TraineesTable } from '@/components/admin/TraineesTable';
import Link from 'next/link';
import { WeakestCheckpointsChart } from '@/components/admin/WeakestCheckpointsChart';
import { CHECKPOINT_KEYS } from '@/lib/types';

export default async function AdminOverviewPage() {
  await requireAdmin();
  const supabase = createServerClient();

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Total trainees
  const { count: traineeCount } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'trainee');

  // Sessions this week
  const { data: weekSessions } = await supabase
    .from('sessions')
    .select('score, passed')
    .gte('created_at', weekAgo.toISOString());

  const sessionsThisWeek = weekSessions?.length ?? 0;
  const avgScoreThisWeek =
    weekSessions?.length && weekSessions.filter((s) => s.score != null).length
      ? Math.round(
          (weekSessions.reduce((a, s) => a + (s.score ?? 0), 0) /
            weekSessions.filter((s) => s.score != null).length)
        )
      : 0;

  // Cleared for live
  const { count: clearedCount } = await supabase
    .from('trainee_progress')
    .select('*', { count: 'exact', head: true })
    .eq('cleared_for_live', true);

  // Weakest checkpoints (last 30 days)
  const { data: monthSessions } = await supabase
    .from('sessions')
    .select('checkpoints')
    .gte('created_at', monthAgo.toISOString());

  const checkpointFailRates: { key: string; passRate: number; failCount: number }[] = [];
  for (const key of CHECKPOINT_KEYS) {
    const total = monthSessions?.length ?? 0;
    const passed = monthSessions?.filter(
      (s) => (s.checkpoints as Record<string, boolean>)?.[key] === true
    ).length ?? 0;
    const failCount = total - passed;
    const passRate = total > 0 ? (passed / total) * 100 : 0;
    checkpointFailRates.push({ key, passRate, failCount });
  }
  checkpointFailRates.sort((a, b) => a.passRate - b.passRate);
  const weakestFive = checkpointFailRates.slice(0, 5).map((c) => ({
    name: c.key.replace(/_/g, ' ').slice(0, 12),
    passRate: Math.round(c.passRate),
    fill: c.passRate < 50 ? '#ef4444' : c.passRate < 75 ? '#f59e0b' : '#22c55e',
  }));

  // Recent sessions
  const { data: recentSessions } = await supabase
    .from('sessions')
    .select(`
      id, score, passed, hostname_gathered, impact_gathered, pathway_stage, bot_id, created_at,
      users (name)
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  // Trainees with progress
  const { data: trainees } = await supabase
    .from('users')
    .select(`
      id, name, email,
      trainee_progress!left (current_stage, boss_battle_unlocked, boss_battle_passed, cleared_for_live, avg_score, bot_id)
    `)
    .eq('role', 'trainee');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-slate-100 mb-8">Admin Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total trainees" value={traineeCount ?? 0} />
        <StatCard title="Sessions this week" value={sessionsThisWeek} />
        <StatCard title="Avg score (this week)" value={`${avgScoreThisWeek}%`} />
        <StatCard title="Cleared for live" value={clearedCount ?? 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">
            Weakest checkpoints (last 30 days)
          </h2>
          <WeakestCheckpointsChart data={weakestFive} />
        </div>
        <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Recent sessions</h2>
          <SessionFeed
            sessions={(recentSessions ?? []).map((s) => ({
              ...s,
              users: Array.isArray(s.users) ? s.users[0] : s.users,
            }))}
          />
        </div>
      </div>

      <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Trainee pathway progress</h2>
        <TraineesTable
          trainees={(trainees ?? []).map((t) => {
            const progress = Array.isArray(t.trainee_progress) ? t.trainee_progress : [t.trainee_progress].filter(Boolean);
            const callSimProgress = progress.filter((p: { bot_id?: string }) => p?.bot_id === 'call_sim');
            return { ...t, trainee_progress: callSimProgress };
          })}
        />
      </div>
    </div>
  );
}
