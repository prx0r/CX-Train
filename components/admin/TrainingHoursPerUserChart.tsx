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

interface DataPoint {
  name: string;
  hours: number;
  fill: string;
}

interface TrainingHoursPerUserChartProps {
  data: DataPoint[];
}

export function TrainingHoursPerUserChart({ data }: TrainingHoursPerUserChartProps) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 60 }}>
          <XAxis type="number" stroke="#71717a" fontSize={11} tickFormatter={(v) => `${v}h`} />
          <YAxis type="category" dataKey="name" width={55} stroke="#71717a" fontSize={11} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '8px',
            }}
            formatter={(value: number) => [`${value.toFixed(1)} hours`, 'Training time']}
          />
          <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
