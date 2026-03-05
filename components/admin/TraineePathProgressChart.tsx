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
  sessions: number;
  stage: number;
  fill: string;
}

interface TraineePathProgressChartProps {
  data: DataPoint[];
}

export function TraineePathProgressChart({ data }: TraineePathProgressChartProps) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 60 }}>
          <XAxis type="number" stroke="#71717a" fontSize={11} />
          <YAxis type="category" dataKey="name" width={55} stroke="#71717a" fontSize={11} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '8px',
            }}
            formatter={(value: number, _name: string, props: { payload?: { stage?: number } }) => [
              `${value} sessions to reach stage ${props.payload?.stage ?? 8}`,
              'Sessions',
            ]}
          />
          <Bar dataKey="sessions" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
