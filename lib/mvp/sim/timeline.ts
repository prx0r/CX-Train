import { SimTimelineEntry } from './types';

interface TimelineEvent {
  sequence_index?: number;
  sequence?: number;
  event_type: string;
  actor: string;
  label?: string | null;
  result_text?: string | null;
  text?: string | null;
  started_at_ms?: number | null;
  timestamp_ms?: number | null;
}

export function buildTimeline(events: TimelineEvent[]): SimTimelineEntry[] {
  if (events.length === 0) return [];

  const firstTs = events[0].started_at_ms || 0;

  return events
    .filter(e => e.event_type !== 'sim_started' && e.event_type !== 'sim_completed')
    .map(e => {
      const ts = e.started_at_ms || e.timestamp_ms || 0;
      const offset = ts ? ts - firstTs : 0;
      const secs = Math.floor(offset / 1000);
      const mins = Math.floor(secs / 60);
      const formatted = `${String(mins).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
      return {
        sequence: e.sequence ?? e.sequence_index ?? 0,
        event_type: e.event_type,
        actor: e.actor,
        formatted_time: formatted,
        label: e.label || null,
        result_text: e.result_text || null,
        is_red_flag: e.event_type === 'red_flag_triggered',
        started_at_ms: ts,
      };
    });
}

export function buildSimSummary(events: TimelineEvent[]): string {
  const lines: string[] = ['Recent support actions:'];
  for (const ev of events) {
    if (ev.event_type === 'action_performed' || ev.event_type === 'observation_returned') {
      if (ev.label && ev.result_text) {
        lines.push(`- ${ev.label} → ${ev.result_text}`);
      }
    } else if (ev.event_type === 'customer_message' && ev.text) {
      lines.push(`- Customer: "${ev.text}"`);
    } else if (ev.event_type === 'candidate_message' && ev.text) {
      lines.push(`- Candidate: "${ev.text}"`);
    }
  }
  return lines.join('\n');
}
