import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { StatCard } from '@/components/admin/StatCard';
import { SessionFeed } from '@/components/admin/SessionFeed';
import { TraineesTable } from '@/components/admin/TraineesTable';
import Link from 'next/link';
import { WeakestCheckpointsChart } from '@/components/admin/WeakestCheckpointsChart';
import { SessionsOverTimeChart } from '@/components/admin/SessionsOverTimeChart';
import { ScoreDistributionChart } from '@/components/admin/ScoreDistributionChart';
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
    .select('score, passed, created_at')
    .gte('created_at', weekAgo.toISOString());

  const sessionsThisWeek = weekSessions?.length ?? 0;
  const avgScoreThisWeek =
    weekSessions?.length && weekSessions.filter((s) => s.score != null).length
      ? Math.round(
          weekSessions.reduce((a, s) => a + (s.score ?? 0), 0) /
            weekSessions.filter((s) => s.score != null).length
        )
      : 0;

  // Cleared for live
  const { count: clearedCount } = await supabase
    .from('trainee_progress')
    .select('*', { count: 'exact', head: true })
    .eq('cleared_for_live', true);

  // Sessions over time (last 14 days)
  const { data: twoWeeksSessions } = await supabase
    .from('sessions')
    .select('created_at, passed')
    .gte('created_at', new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString());

  const byDate: Record<string, { sessions: number; passed: number }> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    byDate[key] = { sessions: 0, passed: 0 };
  }
  for (const s of twoWeeksSessions ?? []) {
    const key = s.created_at.slice(0, 10);
    if (byDate[key]) {
      byDate[key].sessions++;
      if (s.passed) byDate[key].passed++;
    }
  }
  const sessionsOverTimeData = Object.entries(byDate).map(([date, v]) => ({
    date: new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    sessions: v.sessions,
    passed: v.passed,
  }));

  // Score distribution (last 30 days)
  const { data: monthSessionsForDist } = await supabase
    .from('sessions')
    .select('score')
    .gte('created_at', monthAgo.toISOString())
    .not('score', 'is', null);

  const ranges = [
    { range: '0-49', min: 0, max: 49, fill: '#ef4444' },
    { range: '50-74', min: 50, max: 74, fill: '#f59e0b' },
    { range: '75-89', min: 75, max: 89, fill: '#7dd3fc' },
    { range: '90-100', min: 90, max: 100, fill: '#22c55e' },
  ];
  const scoreDistData = ranges.map((r) => ({
    ...r,
    count:
      monthSessionsForDist?.filter(
        (s) => (s.score ?? 0) >= r.min && (s.score ?? 0) <= r.max
      ).length ?? 0,
  }));

  // Weakest checkpoints (last 30 days)
  const { data: monthSessions } = await supabase
    .from('sessions')
    .select('checkpoints')
    .gte('created_at', monthAgo.toISOString());

  const checkpointFailRates: { key: string; passRate: number; failCount: number }[] = [];
  for (const key of CHECKPOINT_KEYS) {
    const total = monthSessions?.length ?? 0;
    const passed =
      monthSessions?.filter(
        (s) => (s.checkpoints as Record<string, boolean>)?.[key] === true
      ).length ?? 0;
    const passRate = total > 0 ? (passed / total) * 100 : 0;
    checkpointFailRates.push({ key, passRate, failCount: total - passed });
  }
  checkpointFailRates.sort((a, b) => a.passRate - b.passRate);
  const weakestFive = checkpointFailRates.slice(0, 5).map((c) => ({
    name: c.key.replace(/_/g, ' ').slice(0, 14),
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Overview</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Platform statistics and training metrics. Go to Trainees to see individual progress, bot feedback, and ticket screenshots.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard title="Trainees" value={traineeCount ?? 0} />
        <StatCard title="Sessions this week" value={sessionsThisWeek} />
        <StatCard title="Avg score (7d)" value={`${avgScoreThisWeek}%`} />
        <StatCard title="Cleared for live" value={clearedCount ?? 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 p-6">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
            Sessions over time
          </h2>
          <SessionsOverTimeChart data={sessionsOverTimeData} />
        </div>
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 p-6">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
            Score distribution (30d)
          </h2>
          <ScoreDistributionChart data={scoreDistData} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 p-6">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
            Weakest checkpoints (30d)
          </h2>
          <WeakestCheckpointsChart data={weakestFive} />
        </div>
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 p-6">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
            Recent sessions
          </h2>
          <SessionFeed
            sessions={(recentSessions ?? []).map((s) => ({
              ...s,
              users: Array.isArray(s.users) ? s.users[0] : s.users,
            }))}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 p-6">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
          Trainee pathway progress
        </h2>
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
    </div>
  );
}
