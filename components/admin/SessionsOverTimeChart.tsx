'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface DataPoint {
  date: string;
  sessions: number;
  passed: number;
}

interface SessionsOverTimeChartProps {
  data: DataPoint[];
}

export function SessionsOverTimeChart({ data }: SessionsOverTimeChartProps) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="sessionsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7dd3fc" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#7dd3fc" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="date" stroke="#71717a" fontSize={12} />
          <YAxis stroke="#71717a" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#a1a1aa' }}
            formatter={(value: number, name: string) => [
              value,
              name === 'sessions' ? 'Sessions' : 'Passed',
            ]}
          />
          <Area
            type="monotone"
            dataKey="sessions"
            stroke="#7dd3fc"
            strokeWidth={2}
            fill="url(#sessionsGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
