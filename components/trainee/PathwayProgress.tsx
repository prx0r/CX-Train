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
      <h2 className="text-lg font-semibold text-slate-100 mb-4">Pathway progress</h2>
      <div className="flex items-center gap-2 flex-wrap">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((stage) => {
          const isBoss = stage === 10;
          const passed = isBoss ? bossBattlePassed : stage <= highestStagePassed;
          const current = stage === currentStage || (isBoss && bossBattleUnlocked && !bossBattlePassed);
          const locked = isBoss ? !bossBattleUnlocked : stage > highestStagePassed + 1;
          return (
            <div
              key={stage}
              className={`w-10 h-10 rounded-lg flex items-center justify-center font-medium ${
                passed
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : current
                    ? 'bg-connexion-accent/20 text-connexion-accent border-2 border-connexion-accent'
                    : locked
                      ? 'bg-connexion-black-soft text-connexion-grey-muted border border-connexion-grey-muted/50'
                      : 'bg-connexion-black-soft/50 text-connexion-grey border border-connexion-grey-muted/50'
              }`}
            >
              {passed ? '✓' : stage}
            </div>
          );
        })}
      </div>
      <p className="text-connexion-grey-muted text-sm mt-2">
        Stage {currentStage} of 10 • Highest passed: {highestStagePassed}
      </p>
    </div>
  );
}
