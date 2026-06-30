'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CallRecordingPlayer } from '@/components/mvp/analysis/CallRecordingPlayer';
import { AcousticMetrics, TurnTimingMetrics, DiarizationMetrics } from '@/components/mvp/analysis/AcousticMetrics';
import { TranscriptView } from '@/components/mvp/analysis/TranscriptView';
import { AssessmentOverview } from '@/components/mvp/analysis/AssessmentOverview';
import { CompetencyBreakdown } from '@/components/mvp/analysis/CompetencyBreakdown';
import { RetakeComparison } from '@/components/mvp/analysis/RetakeComparison';
import { Logo } from '@/components/shared/Logo';

interface MessageRow {
  role: string;
  content: string;
  created_at: string;
}

interface AssessmentResultRow {
  overall_score: number | null;
  readiness_label: string;
  summary: string | null;
  strengths_json: string | null;
  weaknesses_json: string | null;
  raw_model_json: string | null;
}

interface RecordingAnalysis {
  durationMs?: number;
  talkRatio?: number;
  silenceRatio?: number;
  longestSilenceMs?: number;
  silenceSegments?: number;
  avgRms?: number;
  peakRms?: number;
  rmsVariance?: number;
  diarization?: {
    numSpeakers?: number;
    speakerLabels?: string[];
    perSpeakerMetrics?: Record<string, { totalTalkMs: number; talkRatio: number; segmentCount: number }>;
  };
  emotionalTrajectory?: unknown;
  emotionalEvidence?: unknown;
}

interface CategoryScore {
  id: string;
  label: string;
  score: number;
  maxScore: number;
  percent: number;
  criteria: Array<{ id: string; label: string; status: string; earned: number; max: number }>;
}

interface WhatCostYouMost {
  label: string;
  pointsLost: number;
  category: string;
}

interface PackCustomer {
  name: string;
  company: string;
  role: string;
  temperament: string;
  opening_line: string;
  subject: string;
}

interface PackSnapshot {
  pack_id: string;
  pack_title: string;
  customer: PackCustomer;
  hidden_truth?: {
    root_cause: string;
    correct_fix: string;
    ideal_diagnostic_path: string[];
  };
  severity?: string;
  level?: number;
  queue_title?: string;
}

interface AssessmentData {
  assessment: {
    id: string;
    candidate_name: string;
    candidate_user_id?: string | null;
    invite_token: string;
    status: string;
    assignment_type: string;
    created_at: string;
    completed_at: string | null;
  };
  session: { id: string } | null;
  messages: MessageRow[];
  result: AssessmentResultRow | null;
  recordingPath?: string | null;
  recordingAnalysis?: RecordingAnalysis | null;
  categoryScores?: CategoryScore[];
  evidenceTimeline?: unknown[];
  timingMetrics?: { avgResponseLatencyMs?: number; maxResponseLatencyMs?: number; minResponseLatencyMs?: number } | null;
  sessionEventCount?: number;
  packSnapshot?: PackSnapshot | null;
  packCustomer?: PackCustomer | null;
}

export default function AnalysisReportPage() {
  const params = useParams();
  const assessmentId = params.assessmentId as string;

  const [data, setData] = useState<AssessmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/mvp/assessments/${assessmentId}`);
        if (!res.ok) throw new Error('Assessment not found');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [assessmentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-connexion-black flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading analysis...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-connexion-black flex items-center justify-center">
        <div className="text-red-400 text-sm">{error || 'Analysis not found'}</div>
      </div>
    );
  }

  const { assessment, messages, result, recordingPath, recordingAnalysis, categoryScores, session, evidenceTimeline, timingMetrics, packSnapshot, packCustomer } = data;

  const candidateName = assessment.candidate_name || 'Candidate';
  const token = assessment.invite_token;
  const scenarioTitle = packSnapshot?.pack_title || '';
  const customer = packCustomer || null;

  /* Build CandidateAnalysisResult-shaped data from the raw result */
  const analysisResult = result ? {
    overall_score: result.overall_score ?? 0,
    verdict: (result.readiness_label?.toUpperCase() === 'READY' ? 'PASS' :
              result.readiness_label === 'needs_supervision' ? 'FAIL' :
              result.readiness_label === 'not_ready' ? 'FAIL' : 'FAIL') as 'PASS' | 'FAIL',
    criticalFailure: null as string | null,
    summary: result.summary ?? '',
    verdictLine: `${result.readiness_label ?? 'N/A'} ${result.overall_score ?? '--'}/100`,
    strengths: result.strengths_json ? JSON.parse(result.strengths_json) : [],
    improvements: result.weaknesses_json ? JSON.parse(result.weaknesses_json) : [],
    categoryScores: categoryScores ?? [],
    whatCostYouMost: [] as WhatCostYouMost[],
    bonus: 0,
    coreEarned: 0,
    maxCore: 0,
  } : null;

  const narrative = result?.raw_model_json ? (() => {
    try {
      const parsed = JSON.parse(result.raw_model_json);
      if (parsed.narrative) {
        return {
          summary: parsed.narrative.summary ?? '',
          strengths: parsed.narrative.strengths ?? [],
          improvements: parsed.narrative.improvements ?? [],
          most_costly_miss: parsed.narrative.most_costly_miss ?? '',
          ticket_feedback: parsed.narrative.ticket_feedback ?? '',
          coaching_focus: parsed.narrative.coaching_focus ?? [],
        };
      }
    } catch {}
    return undefined;
  })() : undefined;

  const acousticAnalysis = recordingAnalysis ? {
    durationMs: recordingAnalysis.durationMs,
    talkRatio: recordingAnalysis.talkRatio,
    silenceRatio: recordingAnalysis.silenceRatio,
    longestSilenceMs: recordingAnalysis.longestSilenceMs,
    silenceSegments: recordingAnalysis.silenceSegments,
    avgRms: recordingAnalysis.avgRms,
    peakRms: recordingAnalysis.peakRms,
    rmsVariance: recordingAnalysis.rmsVariance,
  } : null;

  const turnTimeline = timingMetrics ? {
    avgResponseLatencyMs: timingMetrics.avgResponseLatencyMs,
    maxResponseLatencyMs: timingMetrics.maxResponseLatencyMs,
    minResponseLatencyMs: timingMetrics.minResponseLatencyMs,
    totalCustomerTurns: messages.filter(m => m.role === 'caller').length,
    totalCandidateTurns: messages.filter(m => m.role === 'candidate').length,
    candidateTalkRatio: acousticAnalysis?.talkRatio ?? 0,
  } : null;

  const diarizationData = recordingAnalysis?.diarization ?? null;

  const s: React.CSSProperties = {
    background: '#1a1a2e',
    border: '1px solid #2d2d4a',
    borderRadius: 12,
    padding: 20,
  };
  const h2: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 };

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-gray-100">
      {/* Header */}
      <header style={{
        background: '#16162a', borderBottom: '1px solid #2d2d4a',
        padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Logo size={20} showLabel />
        <span style={{ fontSize: 10, color: '#7dd3fc', background: '#1e3a5f', padding: '2px 8px', borderRadius: 4 }}>
          {assessment.assignment_type === 'hiring_exam' ? 'HIRING ASSESSMENT' : 'TRAINING DRILL'}
        </span>
        <span style={{ fontSize: 12, color: '#64748b', borderLeft: '1px solid #2d2d4a', paddingLeft: 12 }}>
          Candidate Report
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{candidateName}</span>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
        {/* Page title */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px' }}>Call Analysis Report</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            {candidateName} · {assessment.created_at?.slice(0, 10) ?? 'N/A'} · {assessment.status}
            {session && <span> · Session: {session.id.slice(0, 8)}...</span>}
          </p>
        </div>

        {/* Scenario info from simpack */}
        {customer && (
          <div style={{ ...s, marginBottom: 16 }}>
            <h2 style={h2}>Scenario</h2>
            {scenarioTitle && <p style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 12 }}>{scenarioTitle}</p>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Customer</span>
                <p style={{ fontSize: 13, color: '#f1f5f9', margin: '2px 0' }}>{customer.name}</p>
              </div>
              <div>
                <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Company</span>
                <p style={{ fontSize: 13, color: '#f1f5f9', margin: '2px 0' }}>{customer.company}</p>
              </div>
              <div>
                <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Role</span>
                <p style={{ fontSize: 13, color: '#f1f5f9', margin: '2px 0' }}>{customer.role}</p>
              </div>
              <div>
                <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Temperament</span>
                <p style={{ fontSize: 13, color: '#f1f5f9', margin: '2px 0' }}>
                  <span style={{
                    padding: '1px 6px', borderRadius: 4, fontSize: 11,
                    background: customer.temperament === 'stressed' || customer.temperament === 'frustrated' ? '#7f1d1d' :
                               customer.temperament === 'anxious' || customer.temperament === 'worried' ? '#713f12' : '#1e3a5f',
                    color: customer.temperament === 'stressed' || customer.temperament === 'frustrated' ? '#fca5a5' :
                           customer.temperament === 'anxious' || customer.temperament === 'worried' ? '#fde68a' : '#93c5fd',
                  }}>
                    {customer.temperament}
                  </span>
                </p>
              </div>
              {customer.subject && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Issue</span>
                  <p style={{ fontSize: 13, color: '#cbd5e1', margin: '2px 0' }}>{customer.subject}</p>
                </div>
              )}
            </div>
            {packSnapshot?.hidden_truth?.root_cause && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: '#1e293b', borderRadius: 8 }}>
                <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Root Cause</span>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0' }}>{packSnapshot.hidden_truth.root_cause}</p>
                {packSnapshot.hidden_truth.correct_fix && (
                  <>
                    <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 8, display: 'block' }}>Correct Fix</span>
                    <p style={{ fontSize: 12, color: '#86efac', margin: '2px 0' }}>{packSnapshot.hidden_truth.correct_fix}</p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Recording player */}
        <div style={{ ...s, marginBottom: 16 }}>
          <h2 style={h2}>Recording</h2>
          <CallRecordingPlayer token={token} recordingPath={recordingPath} />
        </div>

        {/* Assessment overview */}
        <div style={{ ...s, marginBottom: 16 }}>
          <h2 style={h2}>Assessment</h2>
          <AssessmentOverview
            result={analysisResult}
            narrative={narrative ?? null}
          />
        </div>

        {/* Competency breakdown */}
        <div style={{ ...s, marginBottom: 16 }}>
          <h2 style={h2}>Competency Breakdown</h2>
          <CompetencyBreakdown attemptId={assessmentId} />
          <RetakeComparison attemptId={assessmentId} userId={assessment.candidate_user_id} />
        </div>

        {/* Acoustics + Transcript side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div style={s}>
            <h2 style={h2}>Acoustic & Turn Metrics</h2>
            <AcousticMetrics analysis={acousticAnalysis} />
            {turnTimeline && (
              <>
                <div style={{ borderTop: '1px solid #2d2d4a', margin: '16px 0' }} />
                <TurnTimingMetrics timeline={turnTimeline} />
              </>
            )}
            {diarizationData && (
              <>
                <div style={{ borderTop: '1px solid #2d2d4a', margin: '16px 0' }} />
                <h3 style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Speaker Diarization</h3>
                <DiarizationMetrics diarization={diarizationData as any} />
              </>
            )}
          </div>
          <div style={s}>
            <h2 style={h2}>Transcript</h2>
            <TranscriptView messages={messages} />
          </div>
        </div>

        {/* Evidence timeline (if available) */}
        {evidenceTimeline && evidenceTimeline.length > 0 && (
          <div style={{ ...s, marginBottom: 16 }}>
            <h2 style={h2}>Session Timeline ({evidenceTimeline.length} events)</h2>
            <p style={{ fontSize: 12, color: '#64748b' }}>
              {evidenceTimeline.length} events recorded during the session.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
