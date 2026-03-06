import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { StatCard } from '@/components/admin/StatCard';
import { SessionFeed } from '@/components/admin/SessionFeed';
import { TraineesTable } from '@/components/admin/TraineesTable';
import { SessionsByStageChart } from '@/components/admin/SessionsByStageChart';
import { SessionsOverTimeChart } from '@/components/admin/SessionsOverTimeChart';
import { ScoreDistributionChart } from '@/components/admin/ScoreDistributionChart';
import { TraineeScoresOverTimeChart } from '@/components/admin/TraineeScoresOverTimeChart';
import { TrainingHoursPerUserChart } from '@/components/admin/TrainingHoursPerUserChart';
import { TraineeWeaknessesStrengths } from '@/components/admin/TraineeWeaknessesStrengths';
import { CHECKPOINT_KEYS } from '@/lib/types';
import {
  CHECKPOINT_WEAKNESS_STATEMENTS,
  CHECKPOINT_STRENGTH_STATEMENTS,
} from '@/lib/checkpoint-statements';

const TRAINEE_COLORS: Record<string, string> = {
  Tom: '#7dd3fc',
  Fernando: '#34d399',
  Jake: '#fbbf24',
  Nathan: '#a78bfa',
};

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

  // Sessions by pathway stage (call_sim, last 30 days)
  const { data: stageSessions } = await supabase
    .from('sessions')
    .select('pathway_stage')
    .eq('bot_id', 'call_sim')
    .gte('created_at', monthAgo.toISOString())
    .not('pathway_stage', 'is', null);

  const stageCounts: Record<number, number> = {};
  for (let s = 1; s <= 10; s++) stageCounts[s] = 0;
  for (const sess of stageSessions ?? []) {
    const stage = Math.min(10, Math.max(1, sess.pathway_stage ?? 1));
    stageCounts[stage] = (stageCounts[stage] ?? 0) + 1;
  }
  const sessionsByStageData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((stage) => ({
    stage,
    count: stageCounts[stage] ?? 0,
    label: `Stage ${stage}`,
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

  // Sessions with user for trainee charts (call_sim only)
  const { data: traineeSessions } = await supabase
    .from('sessions')
    .select('user_id, score, pathway_stage, checkpoints, created_at, duration_seconds')
    .eq('bot_id', 'call_sim')
    .order('created_at', { ascending: true });

  const traineeNames = (trainees ?? []).map((t) => t.name).filter(Boolean);
  const traineeById = Object.fromEntries((trainees ?? []).map((t) => [t.id, t]));

  // Build cumulative avg scores over session index per trainee
  const scoresByUser: Record<string, number[]> = {};
  for (const s of traineeSessions ?? []) {
    if (!s.user_id || s.score == null) continue;
    if (!scoresByUser[s.user_id]) scoresByUser[s.user_id] = [];
    scoresByUser[s.user_id].push(s.score);
  }
  const maxSessions = Math.max(0, ...Object.values(scoresByUser).map((a) => a.length));
  const traineeScoresOverTimeData: { session: number; [k: string]: number | string }[] = [];
  for (let i = 1; i <= Math.min(maxSessions, 20); i++) {
    const row: { session: number; [k: string]: number | string } = { session: i };
    for (const [uid, scores] of Object.entries(scoresByUser)) {
      const name = traineeById[uid]?.name;
      if (!name) continue;
      const slice = scores.slice(0, i);
      const avg = slice.length
        ? Math.round(slice.reduce((a, v) => a + v, 0) / slice.length)
        : null;
      if (avg != null) row[name] = avg;
    }
    traineeScoresOverTimeData.push(row);
  }

  // Total training hours per user (duration_seconds, fallback ~5 min when null)
  const DEFAULT_SESSION_SECONDS = 300;
  const totalSecondsByUser: Record<string, number> = {};
  for (const s of traineeSessions ?? []) {
    if (!s.user_id) continue;
    const sec = s.duration_seconds ?? DEFAULT_SESSION_SECONDS;
    totalSecondsByUser[s.user_id] = (totalSecondsByUser[s.user_id] ?? 0) + sec;
  }
  const trainingHoursData = traineeNames.map((name) => {
    const t = (trainees ?? []).find((x) => x.name === name);
    if (!t) return { name, hours: 0, fill: '#71717a' };
    const sec = totalSecondsByUser[t.id] ?? 0;
    return {
      name,
      hours: Math.round((sec / 3600) * 10) / 10,
      fill: TRAINEE_COLORS[name] ?? '#71717a',
    };
  });

  // Per-trainee weaknesses and strengths from checkpoints
  const traineeCheckpointStats: Record<string, Record<string, { pass: number; total: number }>> = {};
  for (const s of traineeSessions ?? []) {
    if (!s.user_id || !s.checkpoints) continue;
    if (!traineeCheckpointStats[s.user_id]) traineeCheckpointStats[s.user_id] = {};
    const cp = s.checkpoints as Record<string, boolean>;
    for (const key of CHECKPOINT_KEYS) {
      if (!traineeCheckpointStats[s.user_id][key]) traineeCheckpointStats[s.user_id][key] = { pass: 0, total: 0 };
      traineeCheckpointStats[s.user_id][key].total++;
      if (cp[key] === true) traineeCheckpointStats[s.user_id][key].pass++;
    }
  }
  const traineeWeaknessesStrengths = traineeNames.map((name) => {
    const t = (trainees ?? []).find((x) => x.name === name);
    if (!t) return { id: '', name, weaknesses: [], strengths: [] };
    const stats = traineeCheckpointStats[t.id] ?? {};
    const rates = Object.entries(stats)
      .filter(([, v]) => v.total >= 2)
      .map(([key, v]) => ({ key, rate: v.pass / v.total }));
    rates.sort((a, b) => a.rate - b.rate);
    const weaknessKeys = rates.slice(0, 3).filter((r) => r.rate < 0.8).map((r) => r.key);
    const strengthKeys = rates.slice(-3).filter((r) => r.rate >= 0.8).map((r) => r.key).reverse();
    const weaknesses = weaknessKeys.map(
      (k) => CHECKPOINT_WEAKNESS_STATEMENTS[k] ?? k.replace(/_/g, ' ')
    );
    const strengths = strengthKeys.map(
      (k) => CHECKPOINT_STRENGTH_STATEMENTS[k] ?? k.replace(/_/g, ' ')
    );
    return { id: t.id, name, weaknesses, strengths };
  });

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
            Avg scores over time (by trainee)
          </h2>
          {traineeScoresOverTimeData.length > 0 ? (
            <TraineeScoresOverTimeChart data={traineeScoresOverTimeData} traineeNames={traineeNames} />
          ) : (
            <p className="text-zinc-500 text-sm py-8 text-center">No session data yet</p>
          )}
        </div>
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 p-6">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
            Total training hours per user
          </h2>
          {trainingHoursData.length > 0 ? (
            <TrainingHoursPerUserChart data={trainingHoursData} />
          ) : (
            <p className="text-zinc-500 text-sm py-8 text-center">No training data yet</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 p-6">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
            Trainee weaknesses & strengths
          </h2>
          <TraineeWeaknessesStrengths trainees={traineeWeaknessesStrengths} />
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

      <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 p-6 mb-10">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
          Sessions by pathway stage (30d, call sim)
        </h2>
        <SessionsByStageChart data={sessionsByStageData} />
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
