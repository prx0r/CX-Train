interface PathwayProgressProps {
  currentStage: number;
  highestStagePassed: number;
  bossBattleUnlocked: boolean;
  bossBattlePassed: boolean;
}

export function PathwayProgress({
  currentStage,
  highestStagePassed,
  bossBattleUnlocked,
  bossBattlePassed,
}: PathwayProgressProps) {
  return (
    <div className="bg-connexion-black-soft/80 border border-connexion-grey-muted/30 rounded-xl p-6">
      <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">Structured pathway</h2>
      <div className="flex items-center gap-2 flex-wrap">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((stage) => {
          const isBoss = stage === 10;
          const passed = isBoss ? bossBattlePassed : stage <= highestStagePassed;
          const current = stage === currentStage || (isBoss && bossBattleUnlocked && !bossBattlePassed);
          const locked = isBoss ? !bossBattleUnlocked : stage > highestStagePassed + 1;
          return (
            <div
              key={stage}
              className={`w-10 h-10 rounded-lg flex items-center justify-center font-medium text-sm ${
                passed
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                  : current
                    ? 'bg-sky-400/20 text-sky-400 border-2 border-sky-400'
                    : locked
                      ? 'bg-zinc-900 text-zinc-600 border border-zinc-800'
                      : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700'
              }`}
            >
              {passed ? '✓' : isBoss ? '★' : stage}
            </div>
          );
        })}
      </div>
      <p className="text-zinc-500 text-sm mt-2">
        Stage {currentStage} of 10 • Highest passed: {highestStagePassed} • ★ = Final challenge
      </p>
    </div>
  );
}
