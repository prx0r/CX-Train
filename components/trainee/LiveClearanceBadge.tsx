interface LiveClearanceBadgeProps {
  cleared: boolean;
}

export function LiveClearanceBadge({ cleared }: LiveClearanceBadgeProps) {
  if (cleared) {
    return (
      <div className="p-6 bg-green-500/20 border-2 border-green-500/50 rounded-xl text-center">
        <span className="text-3xl">✅</span>
        <p className="font-bold text-green-400 text-xl mt-2">Cleared for live calls</p>
        <p className="text-green-300/80 text-sm mt-1">You&apos;re ready to handle real client calls.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-xl">
      <p className="text-slate-400 text-sm">
        Complete all pathways and pass the boss battle to unlock live call clearance. Your manager will review your progress and grant clearance when you&apos;re ready.
      </p>
    </div>
  );
}
