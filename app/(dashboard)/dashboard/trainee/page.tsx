import { requireAuth } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import Link from 'next/link';
import { PathwayProgress } from '@/components/trainee/PathwayProgress';
import { BossBattleBanner } from '@/components/trainee/BossBattleBanner';
import { LiveClearanceBadge } from '@/components/trainee/LiveClearanceBadge';
import { SessionCard } from '@/components/trainee/SessionCard';
import { ScoreBadge } from '@/components/shared/ScoreBadge';
import { CHECKPOINT_KEYS } from '@/lib/types';

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default async function TraineeProgressPage() {
  const user = await requireAuth();
  const supabase = createServerClient();

  const { data: progress } = await supabase
    .from('trainee_progress')
    .select('*')
    .eq('user_id', user.id)
    .eq('bot_id', 'call_sim')
    .single();

  const { data: allSessionsForTime } = await supabase
    .from('sessions')
    .select('duration_seconds')
    .eq('user_id', user.id)
    .eq('bot_id', 'call_sim');

  const totalCallTime =
    allSessionsForTime?.reduce((a, s) => a + (s.duration_seconds ?? 0), 0) ?? 0;

  const { data: recentSessions } = await supabase
    .from('sessions')
    .select(`
      id, score, passed, pathway_stage, created_at, duration_seconds,
      personalities (name, avatar_emoji)
    `)
    .eq('user_id', user.id)
    .eq('bot_id', 'call_sim')
    .order('created_at', { ascending: false })
    .limit(8);


  // Personalities spoken to (from recent sessions)
  const personalitySet = new Set<string>();
  for (const s of recentSessions ?? []) {
    const p = Array.isArray(s.personalities) ? s.personalities[0] : s.personalities;
    if (p?.name) personalitySet.add(`${(p as { avatar_emoji?: string }).avatar_emoji ?? '👤'} ${p.name}`);
  }

  // Weakness spotlight
  const { data: lastFive } = await supabase
    .from('sessions')
    .select('checkpoints')
    .eq('user_id', user.id)
    .eq('bot_id', 'call_sim')
    .order('created_at', { ascending: false })
    .limit(5);

  const weaknessCount: Record<string, number> = {};
  for (const s of lastFive ?? []) {
    const cp = s.checkpoints as Record<string, boolean>;
    for (const key of CHECKPOINT_KEYS) {
      if (cp?.[key] === false) {
        weaknessCount[key] = (weaknessCount[key] ?? 0) + 1;
      }
    }
  }
  const weaknesses = Object.entries(weaknessCount)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key.replace(/_/g, ' '));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-white tracking-tight">My Progress</h1>
        <p className="text-zinc-500 text-sm mt-1">Welcome back, {user.name}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Total call time</p>
          <p className="text-xl font-semibold text-white mt-1">
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
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Sessions</p>
          <p className="text-xl font-semibold text-white mt-1">{progress?.total_sessions ?? 0}</p>
        </div>
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Stage</p>
          <p className="text-xl font-semibold text-white mt-1">
            {progress?.current_stage ?? 1}/10
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <LiveClearanceBadge cleared={progress?.cleared_for_live ?? false} />

        <PathwayProgress
          currentStage={progress?.current_stage ?? 1}
          highestStagePassed={progress?.highest_stage_passed ?? 0}
          bossBattleUnlocked={progress?.boss_battle_unlocked ?? false}
          bossBattlePassed={progress?.boss_battle_passed ?? false}
        />

        <BossBattleBanner
          unlocked={progress?.boss_battle_unlocked ?? false}
          passed={progress?.boss_battle_passed ?? false}
        />

        {personalitySet.size > 0 && (
          <div>
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
              Personalities you&apos;ve spoken to
            </h2>
            <div className="flex flex-wrap gap-2">
              {Array.from(personalitySet).map((p) => (
                <span
                  key={p}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800/80 text-zinc-300 text-sm"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {weaknesses.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
            <h3 className="font-medium text-amber-400 mb-2">Focus area</h3>
            <p className="text-sm text-zinc-400">
              You&apos;ve missed &quot;{weaknesses[0]}&quot; in{' '}
              {weaknessCount[weaknesses[0]!.replace(/ /g, '_')] ?? 0} of your last 5 calls.
            </p>
          </div>
        )}

        <div>
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
            Recent sessions
          </h2>
          <div className="space-y-3">
            {(recentSessions ?? []).map((s) => (
              <SessionCard
                key={s.id}
                session={{
                  id: s.id,
                  score: s.score ?? 0,
                  passed: s.passed ?? false,
                  pathway_stage: s.pathway_stage,
                  created_at: s.created_at,
                  personality: Array.isArray(s.personalities) ? s.personalities[0] : s.personalities,
                }}
              />
            ))}
          </div>
          <Link
            href="/dashboard/trainee/history"
            className="inline-block mt-4 text-sky-400 hover:text-sky-300 text-sm font-medium"
          >
            View all history →
          </Link>
        </div>
      </div>
    </div>
  );
}
