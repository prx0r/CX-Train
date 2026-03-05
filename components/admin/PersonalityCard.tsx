interface PersonalityCardProps {
  personality: {
    id: string;
    name: string;
    archetype: string;
    intensity: number;
    description: string | null;
    avatar_emoji: string;
    stats: { total_calls: number; avg_score: number; critical_fail_rate: number };
    active: boolean;
  };
  botId: string;
}

export function PersonalityCard({ personality }: PersonalityCardProps) {
  const { name, archetype, intensity, description, avatar_emoji, stats, active } = personality;
  return (
    <div
      className={`p-4 rounded-xl border ${
        active ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-800/20 border-slate-800 opacity-60'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{avatar_emoji || '👤'}</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-100">{name}</p>
          <span className="inline-block mt-1 px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">
            {archetype}
          </span>
          <div className="flex gap-1 mt-2">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full ${i <= intensity ? 'bg-amber-400' : 'bg-slate-600'}`}
              />
            ))}
          </div>
          {description && (
            <p className="text-slate-500 text-sm mt-2 line-clamp-2">{description}</p>
          )}
          <div className="flex gap-4 mt-3 text-xs text-slate-400">
            <span>{stats.total_calls} calls</span>
            <span>Avg {Math.round(stats.avg_score)}%</span>
            <span>Crit fail {Math.round(stats.critical_fail_rate * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
