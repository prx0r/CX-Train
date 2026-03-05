interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
}

export function StatCard({ title, value, subtitle }: StatCardProps) {
  return (
    <div className="bg-connexion-black-soft/80 border border-connexion-grey-muted/30 rounded-xl p-6">
      <p className="text-connexion-grey text-sm font-medium">{title}</p>
      <p className="text-2xl font-bold text-slate-100 mt-1">{value}</p>
      {subtitle && <p className="text-connexion-grey-muted text-sm mt-1">{subtitle}</p>}
    </div>
  );
}
