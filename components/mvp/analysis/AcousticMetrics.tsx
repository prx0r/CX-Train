'use client';

interface AcousticAnalysis {
  durationMs?: number;
  talkRatio?: number;
  silenceRatio?: number;
  longestSilenceMs?: number;
  silenceSegments?: number;
  avgRms?: number;
  peakRms?: number;
  rmsVariance?: number;
}

interface TurnTimeline {
  avgResponseLatencyMs?: number;
  maxResponseLatencyMs?: number;
  minResponseLatencyMs?: number;
  totalCustomerTurns?: number;
  totalCandidateTurns?: number;
  candidateTalkRatio?: number;
}

interface DiarizationData {
  numSpeakers?: number;
  speakerLabels?: string[];
  perSpeakerMetrics?: Record<string, { totalTalkMs: number; talkRatio: number; segmentCount: number }>;
}

function timingGrade(ms: number): { label: string; color: string } {
  if (ms < 500) return { label: 'Very Fast', color: 'text-yellow-400' };
  if (ms < 1500) return { label: 'Responsive', color: 'text-green-400' };
  if (ms < 3000) return { label: 'Normal', color: 'text-blue-400' };
  if (ms < 6000) return { label: 'Hesitant', color: 'text-orange-400' };
  return { label: 'Very Slow', color: 'text-red-400' };
}

function ProgressBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-gray-400 w-24 shrink-0">{label}</span>}
      <div className="h-2 bg-gray-700 rounded-full flex-1 overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-300 w-12 text-right font-mono">{typeof value === 'number' ? value.toFixed(1) : value}</span>
    </div>
  );
}

export function AcousticMetrics({ analysis }: { analysis: AcousticAnalysis | null }) {
  if (!analysis) {
    return (
      <div className="border border-dashed border-gray-600 rounded-lg p-6 text-center">
        <p className="text-sm text-gray-400">No acoustic analysis available</p>
        <p className="text-xs text-gray-500 mt-1">Audio analysis requires a recorded call with microphone input.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-2">
        <ProgressBar value={analysis.talkRatio ?? 0} max={1} label="Talk Ratio" />
        <ProgressBar value={analysis.silenceRatio ?? 0} max={1} label="Silence Ratio" />
        <ProgressBar value={(analysis.longestSilenceMs ?? 0) / 10000} max={1} label="Longest Pause" />
        <ProgressBar value={analysis.avgRms ?? 0} max={0.5} label="Avg Loudness" />
        <ProgressBar value={analysis.rmsVariance ?? 0} max={0.1} label="Loudness Variance" />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-gray-400">
        <div>Duration: {((analysis.durationMs ?? 0) / 1000).toFixed(1)}s</div>
        <div>Silence Segments: {analysis.silenceSegments ?? 0}</div>
        <div>Peak Loudness: {analysis.peakRms?.toFixed(3) ?? 'N/A'}</div>
      </div>
    </div>
  );
}

export function TurnTimingMetrics({ timeline }: { timeline: TurnTimeline | null }) {
  if (!timeline) {
    return (
      <div className="border border-dashed border-gray-600 rounded-lg p-6 text-center">
        <p className="text-sm text-gray-400">No turn timing data</p>
      </div>
    );
  }

  const grade = timingGrade(timeline.avgResponseLatencyMs ?? 0);

  return (
    <div>
      <div className="space-y-2">
        <ProgressBar value={(timeline.avgResponseLatencyMs ?? 0) / 6000} max={1} label="Avg Response" />
        <ProgressBar value={timeline.candidateTalkRatio ?? 0} max={1} label="Your Talk %" />
      </div>
      <div className="text-xs text-gray-400 mt-2 space-y-1">
        <p>Response Speed: <span className={grade.color}>{grade.label}</span> ({timeline.avgResponseLatencyMs}ms)</p>
        <p>Max Pause: {timeline.maxResponseLatencyMs}ms</p>
        <p>Turns: {(timeline.totalCustomerTurns ?? 0) + (timeline.totalCandidateTurns ?? 0)}</p>
      </div>
    </div>
  );
}

export function DiarizationMetrics({ diarization }: { diarization: DiarizationData | null }) {
  if (!diarization?.perSpeakerMetrics) {
    return null;
  }

  return (
    <div>
      <div className="space-y-1 text-xs text-gray-400">
        {Object.entries(diarization.perSpeakerMetrics).map(([speaker, metrics]) => (
          <p key={speaker}>
            <span className="font-medium text-gray-300 capitalize">{speaker}:</span>{' '}
            {(metrics.talkRatio * 100).toFixed(0)}% talk time, {metrics.segmentCount} segments
          </p>
        ))}
      </div>
    </div>
  );
}
