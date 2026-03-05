interface BossBattleBannerProps {
  unlocked: boolean;
  passed: boolean;
}

export function BossBattleBanner({ unlocked, passed }: BossBattleBannerProps) {
  if (passed) {
    return (
      <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center">
        <span className="text-2xl">🏆</span>
        <p className="font-semibold text-emerald-400 mt-2">Final challenge passed</p>
        <p className="text-zinc-400 text-sm">You&apos;ve completed the pathway.</p>
      </div>
    );
  }

  if (unlocked) {
    return (
      <div className="p-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-center">
        <span className="text-2xl">🔓</span>
        <p className="font-semibold text-amber-400 mt-2">Final challenge unlocked</p>
        <p className="text-zinc-400 text-sm">
          Complete stages 1–8 to unlock. Type &quot;final challenge&quot; in the Call Simulator.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-center">
      <span className="text-2xl">🔒</span>
      <p className="font-medium text-zinc-400 mt-2">Final challenge locked</p>
      <p className="text-zinc-500 text-sm">
        Complete stages 1–8 to unlock.
      </p>
    </div>
  );
}
