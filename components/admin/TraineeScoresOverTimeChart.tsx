'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';

const TRAINEE_COLORS: Record<string, string> = {
  Tom: '#7dd3fc',
  Fernando: '#34d399',
  Jake: '#fbbf24',
  Nathan: '#a78bfa',
};

interface DataPoint {
  session: number;
  [traineeName: string]: number | string;
}

interface TraineeScoresOverTimeChartProps {
  data: DataPoint[];
  traineeNames: string[];
}

export function TraineeScoresOverTimeChart({ data, traineeNames }: TraineeScoresOverTimeChartProps) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="session" stroke="#71717a" fontSize={12} />
          <YAxis domain={[0, 100]} stroke="#71717a" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '8px',
            }}
          />
          <Legend />
          {traineeNames.map((name) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={TRAINEE_COLORS[name] ?? '#71717a'}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
