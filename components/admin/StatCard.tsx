interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
}

export function StatCard({ title, value, subtitle }: StatCardProps) {
  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
      <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-semibold text-white mt-1">{value}</p>
      {subtitle && <p className="text-zinc-500 text-sm mt-1">{subtitle}</p>}
    </div>
  );
}
