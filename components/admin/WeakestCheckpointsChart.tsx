'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface ChartData {
  name: string;
  passRate: number;
  fill: string;
}

interface WeakestCheckpointsChartProps {
  data: ChartData[];
}

export function WeakestCheckpointsChart({ data }: WeakestCheckpointsChartProps) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
          <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} stroke="#71717a" />
          <YAxis type="category" dataKey="name" width={80} stroke="#71717a" />
          <Tooltip
            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
            formatter={(v: number) => [`${v}% pass rate`, '']}
          />
          <Bar dataKey="passRate" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
