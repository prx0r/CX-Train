'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

interface ScoreChartProps {
  data: { session: number; score: number; passed: boolean }[];
}

export function ScoreChart({ data }: ScoreChartProps) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="session" stroke="#71717a" />
          <YAxis domain={[0, 100]} stroke="#71717a" />
          <Tooltip
            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
            formatter={(value: number, _name: string, props: { payload?: { passed?: boolean } }) => [
              `${value}% ${props.payload?.passed ? '(passed)' : '(failed)'}`,
              'Score',
            ]}
          />
          <ReferenceLine y={75} stroke="#f59e0b" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#7dd3fc"
            strokeWidth={2}
            dot={{ fill: '#7dd3fc', r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
