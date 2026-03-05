import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import { CheckpointHeatmap } from '@/components/admin/CheckpointHeatmap';
import { ScoreBadge } from '@/components/shared/ScoreBadge';
import { ClearedForLiveToggle } from '@/components/admin/ClearedForLiveToggle';
import { ScoreChart } from '@/components/admin/ScoreChart';
import Link from 'next/link';

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

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
    .select(`
      *,
      personalities (id, name, archetype, avatar_emoji)
    `)
    .eq('user_id', id)
    .eq('bot_id', 'call_sim')
    .order('created_at', { ascending: false })
    .limit(25);

  const totalCallTime =
    sessions?.reduce((a, s) => a + (s.duration_seconds ?? 0), 0) ?? 0;

  const scoreChartData = (sessions ?? [])
    .slice()
    .reverse()
    .map((s, i) => ({
      session: i + 1,
      score: s.score ?? 0,
      passed: s.passed,
      fill: s.passed ? '#22c55e' : '#ef4444',
    }));

  // Personalities spoken to
  const personalityMap = new Map<
    string,
    { name: string; archetype: string; emoji: string; count: number; avgScore: number }
  >();
  for (const s of sessions ?? []) {
    const p = Array.isArray(s.personalities) ? s.personalities[0] : s.personalities;
    if (p) {
      const existing = personalityMap.get(p.id);
      const score = s.score ?? 0;
      if (existing) {
        existing.count++;
        existing.avgScore = Math.round(
          (existing.avgScore * (existing.count - 1) + score) / existing.count
        );
      } else {
        personalityMap.set(p.id, {
          name: p.name,
          archetype: p.archetype,
          emoji: (p as { avatar_emoji?: string }).avatar_emoji ?? '👤',
          count: 1,
          avgScore: score,
        });
      }
    }
  }
  const personalities = Array.from(personalityMap.values());

  // Exemplar tickets (sessions with ticket assessed and high score)
  const exemplarTickets = (sessions ?? []).filter(
    (s) => s.ticket_assessed && (s.score ?? 0) >= 85
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">{user.name}</h1>
          <p className="text-zinc-500 text-sm mt-1">{user.email}</p>
        </div>
        <ClearedForLiveToggle
          userId={id}
          botId="call_sim"
          cleared={progress?.cleared_for_live ?? false}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Total sessions</p>
          <p className="text-2xl font-semibold text-white mt-1">{progress?.total_sessions ?? 0}</p>
        </div>
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Total call time</p>
          <p className="text-2xl font-semibold text-white mt-1">
            {formatDuration(totalCallTime)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Overall score</p>
          <div className="mt-1">
            <ScoreBadge score={Math.round(progress?.avg_score ?? 0)} size="lg" />
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Current stage</p>
          <p className="text-2xl font-semibold text-white mt-1">{progress?.current_stage ?? 1}/10</p>
        </div>
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Final challenge</p>
          <p className="text-lg font-medium text-white mt-1">
            {progress?.boss_battle_passed
              ? 'Passed'
              : progress?.boss_battle_unlocked
                ? 'Unlocked'
                : 'Locked'}
          </p>
        </div>
      </div>

      {personalities.length > 0 && (
        <div className="mb-10">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
            Personalities spoken to
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {personalities.map((p) => (
              <div
                key={p.name}
                className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{p.emoji}</span>
                  <div>
                    <p className="font-medium text-white">{p.name}</p>
                    <p className="text-zinc-500 text-xs">{p.archetype}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <ScoreBadge score={p.avgScore} size="sm" />
                  <span className="text-zinc-500 text-xs">{p.count} calls</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {exemplarTickets.length > 0 && (
        <div className="mb-10">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
            Exemplar tickets
          </h2>
          <div className="space-y-3">
            {exemplarTickets.slice(0, 5).map((s) => (
              <Link
                key={s.id}
                href={`/dashboard/admin/sessions/${s.id}`}
                className="block rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4 hover:border-zinc-700 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 text-sm">
                    Stage {s.pathway_stage} • {new Date(s.created_at).toLocaleDateString()}
                  </span>
                  <ScoreBadge score={s.score ?? 0} passed={s.passed ?? false} size="sm" />
                </div>
                {s.feedback_text && (
                  <p className="text-zinc-500 text-sm mt-2 line-clamp-2">{s.feedback_text}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {exemplarTickets.length === 0 && (sessions?.length ?? 0) > 0 && (
        <div className="mb-10 rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-6">
          <p className="text-zinc-500 text-sm">
            Exemplar tickets will appear here when trainees complete sessions with ticket screenshots and scores ≥85%.
          </p>
        </div>
      )}

      <div className="mb-10">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
          Checkpoint heatmap
        </h2>
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4 overflow-x-auto">
          <CheckpointHeatmap sessions={sessions ?? []} maxSessions={10} />
        </div>
      </div>

      <div className="mb-10">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
          Score over time
        </h2>
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4">
          <ScoreChart data={scoreChartData} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
          Session history
        </h2>
        <div className="space-y-2">
          {(sessions ?? []).map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/admin/sessions/${s.id}`}
              className="block rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4 hover:border-zinc-700 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-sm">
                  Stage {s.pathway_stage} • {new Date(s.created_at).toLocaleString()}
                  {s.duration_seconds != null && (
                    <span className="text-zinc-500 ml-2">
                      ({formatDuration(s.duration_seconds)})
                    </span>
                  )}
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
