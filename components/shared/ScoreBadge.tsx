interface ScoreBadgeProps {
  score: number;
  passed?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ScoreBadge({ score, passed = true, size = 'md' }: ScoreBadgeProps) {
  const sizeClasses = {
    sm: 'text-sm px-2 py-0.5',
    md: 'text-base px-3 py-1',
    lg: 'text-lg px-4 py-2',
  };
  const color = passed ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-red-500/20 text-red-400 border-red-500/50';
  return (
    <span
      className={`inline-flex items-center font-semibold rounded-lg border ${sizeClasses[size]} ${color}`}
    >
      {score}%
    </span>
  );
}
