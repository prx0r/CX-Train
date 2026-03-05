import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import { CheckpointHeatmap } from '@/components/admin/CheckpointHeatmap';
import { CheckpointList } from '@/components/shared/CheckpointList';
import { ScoreBadge } from '@/components/shared/ScoreBadge';
import { ClearedForLiveToggle } from '@/components/admin/ClearedForLiveToggle';
import { ScoreChart } from '@/components/admin/ScoreChart';
import Link from 'next/link';

export default async function AdminTraineeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = createServerClient();

  const { data: user } = await supabase.from('users').select('*').eq('id', id).single();
  if (!user) notFound();

  const { data: progress } = await supabase
    .from('trainee_progress')
    .select('*')
    .eq('user_id', id)
    .eq('bot_id', 'call_sim')
    .single();

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', id)
    .eq('bot_id', 'call_sim')
    .order('created_at', { ascending: false })
    .limit(20);

  const scoreChartData = (sessions ?? [])
    .reverse()
    .map((s, i) => ({
      session: i + 1,
      score: s.score ?? 0,
      passed: s.passed,
      fill: s.passed ? '#22c55e' : '#ef4444',
    }));

  // Personality breakdown
  const sessionsWithPersonality = (sessions ?? []).filter((s) => s.personality_id);
  const personalityIds = Array.from(new Set(sessionsWithPersonality.map((s) => s.personality_id)));
  const { data: personalities } = await supabase
    .from('personalities')
    .select('id, name, archetype')
    .in('id', personalityIds);

  const personalityStats: { name: string; archetype: string; avgScore: number; attempts: number; criticalFails: number }[] = [];
  for (const p of personalities ?? []) {
    const personSessions = sessionsWithPersonality.filter((s) => s.personality_id === p.id);
    const avgScore =
      personSessions.length > 0
        ? Math.round(
            personSessions.reduce((a, s) => a + (s.score ?? 0), 0) / personSessions.length
          )
        : 0;
    const criticalFails = personSessions.filter(
      (s) => s.hostname_gathered === false || s.impact_gathered === false
    ).length;
    personalityStats.push({
      name: p.name,
      archetype: p.archetype,
      avgScore,
      attempts: personSessions.length,
      criticalFails,
    });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{user.name}</h1>
          <p className="text-slate-400">{user.email}</p>
        </div>
        <div className="flex items-center gap-4">
          <ClearedForLiveToggle
            userId={id}
            botId="call_sim"
            cleared={progress?.cleared_for_live ?? false}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800/50 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Total sessions</p>
          <p className="text-xl font-bold">{progress?.total_sessions ?? 0}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Avg score</p>
          <ScoreBadge score={Math.round(progress?.avg_score ?? 0)} size="lg" />
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Current stage</p>
          <p className="text-xl font-bold">{progress?.current_stage ?? 1}/10</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Boss battle</p>
          <p className="text-lg font-medium">
            {progress?.boss_battle_passed
              ? 'Passed'
              : progress?.boss_battle_unlocked
                ? 'Unlocked'
                : 'Locked'}
          </p>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Checkpoint heatmap</h2>
        <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-4 overflow-x-auto">
          <CheckpointHeatmap sessions={sessions ?? []} maxSessions={10} />
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Score over time</h2>
        <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-4">
          <ScoreChart data={scoreChartData} />
        </div>
      </div>

      {personalityStats.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Personality breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {personalityStats.map((p) => (
              <div
                key={p.name}
                className="bg-slate-800/50 border border-slate-700 rounded-xl p-4"
              >
                <p className="font-medium text-slate-100">{p.name}</p>
                <p className="text-slate-500 text-sm">{p.archetype}</p>
                <div className="mt-2 flex gap-4">
                  <span>
                    <ScoreBadge score={p.avgScore} size="sm" />
                  </span>
                  <span className="text-slate-400 text-sm">{p.attempts} attempts</span>
                  {p.criticalFails > 0 && (
                    <span className="text-red-400 text-sm">{p.criticalFails} critical fails</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Session history</h2>
        <div className="space-y-2">
          {(sessions ?? []).map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/admin/sessions/${s.id}`}
              className="block p-4 bg-slate-800/30 border border-slate-700 rounded-lg hover:border-slate-600 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-slate-400">
                  Stage {s.pathway_stage} • {new Date(s.created_at).toLocaleString()}
                </span>
                <ScoreBadge score={s.score ?? 0} passed={s.passed ?? false} size="sm" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
