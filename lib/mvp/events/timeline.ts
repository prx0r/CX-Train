import { SessionEvent, TimingMetrics, EvidenceTimelineEntry } from './types';

export function buildEvidenceTimeline(
  events: SessionEvent[],
): EvidenceTimelineEntry[] {
  if (events.length === 0) return [];

  const firstTs = events[0].started_at_ms || events[0].ended_at_ms || 0;

  return events.map(e => {
    const ts = e.started_at_ms || e.ended_at_ms || 0;
    const offset = ts - firstTs;
    const secs = Math.floor(offset / 1000);
    const mins = Math.floor(secs / 60);
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

    return {
      sequence_index: e.sequence_index,
      event_type: e.event_type,
      actor: e.actor,
      formatted_time: formatted,
      text: e.text,
      label: e.label,
      result_text: e.result_text,
      is_red_flag: e.event_type === 'red_flag_triggered',
      timestamp_ms: e.started_at_ms || e.ended_at_ms,
      duration_ms: e.duration_ms,
    };
  });
}

export function summariseTimelineForAnalysis(events: SessionEvent[]): string {
  const lines: string[] = ['Evidence timeline:'];
  const timeline = buildEvidenceTimeline(events);
  for (const entry of timeline) {
    const detail = entry.text || entry.result_text || '';
    lines.push(`  ${entry.formatted_time} [${entry.event_type}] ${entry.actor}: ${entry.label || ''} ${detail}`.trim());
  }
  return lines.join('\n');
}

export function calculateTimingMetrics(events: SessionEvent[]): TimingMetrics {
  const metrics: TimingMetrics = {
    total_duration_ms: null,
    time_to_first_candidate_response_ms: null,
    time_to_first_action_ms: null,
    time_to_first_relevant_check_ms: null,
    time_to_resolution_ms: null,
    time_to_ticket_submit_ms: null,
  };

  if (events.length === 0) return metrics;

  const firstEvent = events[0];
  const startTs = firstEvent.started_at_ms || firstEvent.ended_at_ms || 0;
  const lastEvent = events[events.length - 1];

  // Total duration: from first event to last event end
  const endTs = lastEvent.ended_at_ms || lastEvent.started_at_ms || startTs;
  if (endTs > startTs) {
    metrics.total_duration_ms = endTs - startTs;
  }

  // Time to first candidate response
  const firstCandidateMsg = events.find(e => e.event_type === 'candidate_message');
  if (firstCandidateMsg && firstCandidateMsg.started_at_ms && startTs) {
    metrics.time_to_first_candidate_response_ms = firstCandidateMsg.started_at_ms - startTs;
  }

  // Time to first action
  const firstAction = events.find(e => e.event_type === 'action_performed');
  if (firstAction && firstAction.started_at_ms && startTs) {
    metrics.time_to_first_action_ms = firstAction.started_at_ms - startTs;
  }

  // Time to first relevant check (status check, webmail, ping)
  const relevantChecks = events.filter(e =>
    e.event_type === 'action_performed' &&
    (e.action_id === 'check_outlook_status' || e.action_id === 'check_webmail' || e.action_id === 'run_ping')
  );
  if (relevantChecks.length > 0 && relevantChecks[0].started_at_ms && startTs) {
    metrics.time_to_first_relevant_check_ms = relevantChecks[0].started_at_ms - startTs;
  }

  // Time to resolution (test_email_sent or issue_resolved)
  const resolutionEvents = events.filter(e =>
    e.event_type === 'observation_returned' &&
    (e.action_id === 'send_test_email' || e.result_text?.toLowerCase().includes('success'))
  );
  if (resolutionEvents.length > 0 && resolutionEvents[0].started_at_ms && startTs) {
    metrics.time_to_resolution_ms = resolutionEvents[0].started_at_ms - startTs;
  }

  // Time to ticket submit
  const ticketSubmit = events.find(e => e.event_type === 'ticket_submitted');
  if (ticketSubmit && ticketSubmit.started_at_ms && startTs) {
    metrics.time_to_ticket_submit_ms = ticketSubmit.started_at_ms - startTs;
  }

  return metrics;
}
