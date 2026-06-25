export default function DashboardCard({
  label,
  value,
  footnote,
  color = 'blue',
  disabled = false,
}: {
  label: string;
  value: string | number;
  footnote?: string;
  color?: 'blue' | 'green' | 'yellow' | 'purple' | 'gray';
  disabled?: boolean;
}) {
  const colorMap: Record<string, string> = {
    blue: 'border-blue-700/40 bg-blue-950/30 text-blue-300',
    green: 'border-green-700/40 bg-green-950/30 text-green-300',
    yellow: 'border-yellow-700/40 bg-yellow-950/30 text-yellow-300',
    purple: 'border-purple-700/40 bg-purple-950/30 text-purple-300',
    gray: 'border-gray-700/40 bg-gray-900/50 text-gray-400',
  };

  return (
    <div
      className={`rounded border p-4 flex flex-col ${
        disabled ? 'opacity-50' : ''
      } ${colorMap[color] || colorMap.blue}`}
    >
      <span className="text-xs uppercase tracking-wider opacity-70 mb-1">{label}</span>
      <span className="text-2xl font-bold">{value}</span>
      {footnote && <span className="text-xs mt-1 opacity-60">{footnote}</span>}
      {disabled && <span className="text-xs mt-1 opacity-40">Coming next</span>}
    </div>
  );
}
