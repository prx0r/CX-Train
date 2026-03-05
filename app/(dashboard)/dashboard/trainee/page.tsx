import { requireAuth } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { PathwayProgress } from '@/components/trainee/PathwayProgress';
import { BossBattleBanner } from '@/components/trainee/BossBattleBanner';
import { LiveClearanceBadge } from '@/components/trainee/LiveClearanceBadge';
import { SessionCard } from '@/components/trainee/SessionCard';
import { CHECKPOINT_KEYS } from '@/lib/types';

export default async function TraineeProgressPage() {
  const user = await requireAuth();
  const supabase = createServerClient();

  const { data: progress } = await supabase
    .from('trainee_progress')
    .select('*')
    .eq('user_id', user.id)
    .eq('bot_id', 'call_sim')
    .single();

  const { data: recentSessions } = await supabase
    .from('sessions')
    .select(`
      id, score, passed, pathway_stage, created_at,
      personalities (name, avatar_emoji)
    `)
    .eq('user_id', user.id)
    .eq('bot_id', 'call_sim')
    .order('created_at', { ascending: false })
    .limit(5);

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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">My Progress</h1>
      <p className="text-connexion-grey mb-8">Welcome back, {user.name}</p>

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

        {weaknesses.length > 0 && (
          <div className="p-4 bg-connexion-accent/10 border border-connexion-accent/30 rounded-xl">
            <h3 className="font-medium text-connexion-accent mb-2">Weakness spotlight</h3>
            <p className="text-sm text-connexion-grey">
              You&apos;ve missed &quot;{weaknesses[0]}&quot; in {weaknessCount[weaknesses[0]!.replace(/ /g, '_')] ?? 0} of your last 5 calls. Focus on this next session.
            </p>
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Recent sessions</h2>
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
        </div>
      </div>
    </div>
  );
}
