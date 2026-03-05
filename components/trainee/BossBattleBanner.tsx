interface BossBattleBannerProps {
  unlocked: boolean;
  passed: boolean;
}

export function BossBattleBanner({ unlocked, passed }: BossBattleBannerProps) {
  if (passed) {
    return (
      <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-xl text-center">
        <span className="text-2xl">🏆</span>
        <p className="font-semibold text-green-400 mt-2">Boss battle passed!</p>
        <p className="text-slate-400 text-sm">You&apos;ve completed the pathway.</p>
      </div>
    );
  }

  if (unlocked) {
    return (
      <div className="p-6 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center">
        <span className="text-2xl">🔓</span>
        <p className="font-semibold text-amber-400 mt-2">Boss battle unlocked</p>
        <p className="text-slate-400 text-sm">
          You&apos;ve completed all 10 stages. Type &quot;boss battle&quot; in the Call Simulator to begin your final challenge.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-xl text-center">
      <span className="text-2xl">🔒</span>
      <p className="font-medium text-slate-400 mt-2">Boss battle locked</p>
      <p className="text-slate-500 text-sm">
        Complete stages 1–8 to unlock the boss battle.
      </p>
    </div>
  );
}
