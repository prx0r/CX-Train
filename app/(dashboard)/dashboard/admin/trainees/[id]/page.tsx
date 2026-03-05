import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import Image from 'next/image';
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

function getTodayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
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

  const { data: todaySessions } = await supabase
    .from('sessions')
    .select('score, passed, duration_seconds, feedback_text, pathway_stage')
    .eq('user_id', id)
    .eq('bot_id', 'call_sim')
    .gte('created_at', getTodayStart());

  const totalCallTime =
    sessions?.reduce((a, s) => a + (s.duration_seconds ?? 0), 0) ?? 0;

  const todayCalls = todaySessions?.length ?? 0;
  const todayPasses = todaySessions?.filter((s) => s.passed).length ?? 0;
  const todayAvg =
    todaySessions?.length && todaySessions.filter((s) => s.score != null).length
      ? Math.round(
          todaySessions.reduce((a, s) => a + (s.score ?? 0), 0) /
            todaySessions.filter((s) => s.score != null).length
        )
      : null;
  const todayTime = todaySessions?.reduce((a, s) => a + (s.duration_seconds ?? 0), 0) ?? 0;

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

  // Bot feedback (all sessions with feedback)
  const sessionsWithFeedback = (sessions ?? []).filter((s) => s.feedback_text);

  // Live suitability advisory
  const avgScore = Math.round(progress?.avg_score ?? 0);
  const cleared = progress?.cleared_for_live ?? false;
  const recentPassRate =
    (sessions ?? []).length > 0
      ? ((sessions ?? []).filter((s) => s.passed).length / (sessions ?? []).length) * 100
      : 0;

  let suitabilityText = '';
  let suitabilityColor = 'zinc';
  if (cleared) {
    suitabilityText =
      'Cleared for live calls. Trainee has met the pathway requirements and is approved for customer-facing work.';
    suitabilityColor = 'emerald';
  } else if (avgScore >= 85 && recentPassRate >= 80) {
    suitabilityText =
      'Strong candidate. Consider clearing for live once final challenge is passed.';
    suitabilityColor = 'sky';
  } else if (avgScore >= 75) {
    suitabilityText =
      'On track. Focus on consistency—ensure impact and hostname are gathered on every call before clearing.';
    suitabilityColor = 'amber';
  } else {
    suitabilityText =
      'Needs more practice. Review checkpoint heatmap and bot feedback before considering live clearance.';
    suitabilityColor = 'red';
  }

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

      {/* Progress today */}
      {todayCalls > 0 && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-5 mb-10">
          <h2 className="text-sm font-medium text-sky-300 uppercase tracking-wider mb-3">
            Progress today
          </h2>
          <div className="flex flex-wrap gap-6">
            <span className="text-white font-medium">{todayCalls} calls</span>
            <span className="text-zinc-400">{todayPasses} passed</span>
            {todayAvg != null && (
              <span className="text-zinc-400">Avg score: {todayAvg}%</span>
            )}
            {todayTime > 0 && (
              <span className="text-zinc-400">
                Call time: {formatDuration(todayTime)}
              </span>
            )}
          </div>
          {todaySessions?.[0]?.feedback_text && (
            <p className="text-zinc-400 text-sm mt-3 italic">
              Latest feedback: &quot;{todaySessions[0].feedback_text}&quot;
            </p>
          )}
        </div>
      )}

      {/* Live suitability */}
      <div
        className={`rounded-xl border p-5 mb-10 ${
          suitabilityColor === 'emerald'
            ? 'border-emerald-500/30 bg-emerald-500/10'
            : suitabilityColor === 'sky'
              ? 'border-sky-500/30 bg-sky-500/10'
              : suitabilityColor === 'amber'
                ? 'border-amber-500/30 bg-amber-500/10'
                : 'border-red-500/30 bg-red-500/10'
        }`}
      >
        <h2 className="text-sm font-medium uppercase tracking-wider mb-2">
          Suitability for live calls
        </h2>
        <p
          className={
            suitabilityColor === 'emerald'
              ? 'text-emerald-300'
              : suitabilityColor === 'sky'
                ? 'text-sky-300'
                : suitabilityColor === 'amber'
                  ? 'text-amber-300'
                  : 'text-red-300'
          }
        >
          {suitabilityText}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
            Total sessions
          </p>
          <p className="text-2xl font-semibold text-white mt-1">
            {progress?.total_sessions ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
            Total call time
          </p>
          <p className="text-2xl font-semibold text-white mt-1">
            {formatDuration(totalCallTime)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
            Overall score
          </p>
          <div className="mt-1">
            <ScoreBadge score={Math.round(progress?.avg_score ?? 0)} size="lg" />
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
            Current stage
          </p>
          <p className="text-2xl font-semibold text-white mt-1">
            {progress?.current_stage ?? 1}/10
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
            Final challenge
          </p>
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

      {/* Bot feedback */}
      {sessionsWithFeedback.length > 0 && (
        <div className="mb-10">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
            Bot feedback
          </h2>
          <p className="text-zinc-500 text-sm mb-4">
            Feedback from the Call Simulator GPT after each session.
          </p>
          <div className="space-y-3">
            {sessionsWithFeedback.slice(0, 12).map((s) => {
              const p = Array.isArray(s.personalities) ? s.personalities[0] : s.personalities;
              return (
                <Link
                  key={s.id}
                  href={`/dashboard/admin/sessions/${s.id}`}
                  className="block rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4 hover:border-zinc-700 transition"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-zinc-400 text-sm">
                      Stage {s.pathway_stage} • {new Date(s.created_at).toLocaleString()}
                      {p && (
                        <span className="ml-2">
                          {(p as { avatar_emoji?: string }).avatar_emoji} {p.name}
                        </span>
                      )}
                    </span>
                    <ScoreBadge score={s.score ?? 0} passed={s.passed ?? false} size="sm" />
                  </div>
                  <p className="text-zinc-300 text-sm">{s.feedback_text}</p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Exemplar tickets with screenshots */}
      {exemplarTickets.length > 0 && (
        <div className="mb-10">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
            Exemplar tickets
          </h2>
          <p className="text-zinc-500 text-sm mb-4">
            Tickets raised by the trainee with bot feedback (score ≥85%).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {exemplarTickets.slice(0, 6).map((s) => (
              <Link
                key={s.id}
                href={`/dashboard/admin/sessions/${s.id}`}
                className="block rounded-xl border border-zinc-800/60 bg-zinc-900/50 overflow-hidden hover:border-zinc-700 transition"
              >
                {s.ticket_screenshot_url && (
                  <div className="aspect-video bg-zinc-800 relative">
                    <img
                      src={s.ticket_screenshot_url}
                      alt="Ticket screenshot"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-zinc-400 text-sm">
                      Stage {s.pathway_stage} • {new Date(s.created_at).toLocaleDateString()}
                    </span>
                    <ScoreBadge score={s.score ?? 0} passed={s.passed ?? false} size="sm" />
                  </div>
                  {s.feedback_text && (
                    <p className="text-zinc-400 text-sm line-clamp-2">{s.feedback_text}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {exemplarTickets.length === 0 && (sessions?.length ?? 0) > 0 && (
        <div className="mb-10 rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-6">
          <p className="text-zinc-500 text-sm">
            Exemplar tickets appear when trainees complete sessions with ticket assessment and
            scores ≥85%.
          </p>
        </div>
      )}

      <div className="mb-10">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
          Score over time
        </h2>
        <p className="text-zinc-500 text-sm mb-4">
          Overall progress judged by scores from the bot across sessions.
        </p>
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4">
          <ScoreChart data={scoreChartData} />
        </div>
      </div>

      <div className="mb-10">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
          Checkpoint heatmap
        </h2>
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4 overflow-x-auto">
          <CheckpointHeatmap sessions={sessions ?? []} maxSessions={10} />
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
