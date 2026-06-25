'use client';

interface TimelineEntry {
  action_id: string | null;
  label: string | null;
  result_text: string | null;
  formatted_time: string;
  is_red_flag: boolean;
}

export default function SimTimeline({ timeline }: { timeline: TimelineEntry[] }) {
  if (!timeline || timeline.length === 0) {
    return <div className="text-xs text-gray-500 italic">No actions yet</div>;
  }

  return (
    <div className="space-y-1">
      {timeline.map((t, i) => (
        <div key={i} className={`flex gap-2 text-xs ${t.is_red_flag ? 'text-red-400' : 'text-gray-300'}`}>
          <span className="text-gray-500 w-10 shrink-0 font-mono">{t.formatted_time}</span>
          <span className={t.is_red_flag ? 'text-red-400' : ''}>
            {t.label}
            {t.result_text && !t.is_red_flag && <span className="text-gray-500"> → {t.result_text}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
