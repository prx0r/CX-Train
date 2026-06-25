import { SimEvent } from './types';

export interface TimelineEntry {
  sequence_index: number;
  timestamp_ms: number | null;
  formatted_time: string;
  actor: string;
  action_id: string | null;
  label: string | null;
  result_text: string | null;
  event_type: string;
  is_red_flag: boolean;
}

export function buildTimeline(events: SimEvent[]): TimelineEntry[] {
  if (events.length === 0) return [];

  const firstTs = events[0].timestamp_ms || 0;

  return events
    .filter(e => e.event_type !== 'sim_started' && e.event_type !== 'sim_completed')
    .map(e => {
      const offset = e.timestamp_ms ? e.timestamp_ms - firstTs : 0;
      const secs = Math.floor(offset / 1000);
      const mins = Math.floor(secs / 60);
      const formatted = `${String(mins).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
      return {
        sequence_index: e.sequence_index,
        timestamp_ms: e.timestamp_ms,
        formatted_time: formatted,
        actor: e.actor,
        action_id: e.action_id,
        label: e.label,
        result_text: e.result_text,
        event_type: e.event_type,
        is_red_flag: e.event_type === 'red_flag_triggered',
      };
    });
}

export function buildSimSummary(events: SimEvent[]): string {
  const lines: string[] = ['Recent support actions:'];
  for (const ev of events) {
    if (ev.event_type === 'action_performed' || ev.event_type === 'observation_returned') {
      if (ev.label && ev.result_text) {
        lines.push(`- ${ev.label} → ${ev.result_text}`);
      }
    }
  }
  return lines.join('\n');
}
