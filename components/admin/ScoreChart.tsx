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
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="session" stroke="#64748b" />
          <YAxis domain={[0, 100]} stroke="#64748b" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
            formatter={(value: number, _name: string, props: { payload?: { passed?: boolean } }) => [
              `${value}% ${props.payload?.passed ? '(passed)' : '(failed)'}`,
              'Score',
            ]}
          />
          <ReferenceLine y={75} stroke="#f59e0b" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
