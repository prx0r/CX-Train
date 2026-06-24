'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface Message {
  role: string;
  content: string;
}

interface Checkpoints {
  [key: string]: boolean;
}

interface AnalysisResult {
  status: string;
  overall_score?: number;
  readiness_label?: string;
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
  checkpoints?: Checkpoints;
  evidence_quotes?: string[];
  ticket_score?: number;
  ticket_feedback?: string;
  error?: string;
}

export default function ManagerDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [feedbackLabel, setFeedbackLabel] = useState('');
  const [feedbackScore, setFeedbackScore] = useState('');
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<any>(null);

  async function load() {
    try {
      const res = await fetch(`/api/mvp/assessments/${id}`);
      const apiData = await res.json();
      setData(apiData);
      if (apiData.result) {
        setAnalysisResult({
          status: 'analysed',
          overall_score: apiData.result.overall_score,
          readiness_label: apiData.result.readiness_label,
          summary: apiData.result.summary,
          strengths: apiData.result.strengths_json ? JSON.parse(apiData.result.strengths_json) : [],
          weaknesses: apiData.result.weaknesses_json ? JSON.parse(apiData.result.weaknesses_json) : [],
          checkpoints: apiData.result.checkpoint_json ? JSON.parse(apiData.result.checkpoint_json) : {},
          ticket_score: apiData.result.ticket_score,
        });
      }
      if (apiData.feedback) {
        setFeedbackResult(apiData.feedback);
        setFeedbackSent(true);
      }
    } catch (e) {
      console.error('Failed to load assessment detail', e);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function runAnalysis() {
    setAnalysing(true);
    try {
      const res = await fetch(`/api/mvp/assessments/${id}/analyse`, { method: 'POST' });
      const result = await res.json();
      setAnalysisResult(result);
      // Reload to get fresh data
      await load();
    } catch (e) {
      console.error('Analysis failed', e);
    }
    setAnalysing(false);
  }

  async function submitFeedback() {
    try {
      const res = await fetch(`/api/mvp/assessments/${id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_label: feedbackLabel,
          manager_score: feedbackScore ? parseInt(feedbackScore) : null,
          notes: feedbackNotes,
        }),
      });
      const result = await res.json();
      setFeedbackResult(result);
      setFeedbackSent(true);
      await load();
    } catch (e) {
      console.error('Feedback failed', e);
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!data) return <div className="p-8 text-center text-red-400">Assessment not found</div>;

  const { assessment, messages, ticket, result, scenario, criteria } = data;

  const statusColors: Record<string, string> = {
    draft: 'text-yellow-400', invited: 'text-blue-400', in_progress: 'text-cyan-400',
    completed: 'text-green-400', analysed: 'text-emerald-300', reviewed: 'text-purple-400',
  };
  const readinessColors: Record<string, string> = {
    ready: 'text-green-400', needs_supervision: 'text-yellow-400', not_ready: 'text-red-400', analysis_failed: 'text-gray-500',
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <a href="/mvp" className="text-blue-400 text-sm hover:underline">&larr; Back to dashboard</a>
      <h1 className="text-2xl font-bold mt-2 mb-1">{assessment.candidate_name}</h1>
      <p className="text-sm text-gray-500 mb-4">
        {assessment.title} &middot;{' '}
        <span className={statusColors[assessment.status] || ''}>{assessment.status}</span>
        {scenario && <span> &middot; Scenario: {scenario.title}</span>}
      </p>

      {/* Invite link */}
      {assessment.invite_token && (
        <div className="bg-gray-900 border border-gray-800 rounded p-3 mb-4 text-sm">
          <strong>Invite link:</strong>{' '}
          <span className="text-blue-400">{typeof window !== 'undefined' ? `${window.location.origin}/mvp/assessment/${assessment.invite_token}` : `/mvp/assessment/${assessment.invite_token}`}</span>
        </div>
      )}

      {/* Transcript */}
      <div className="bg-gray-900 border border-gray-800 rounded p-4 mb-4">
        <h2 className="text-lg font-semibold mb-3">Transcript ({messages?.length || 0} messages)</h2>
        {(!messages || messages.length === 0) && <p className="text-gray-500 text-sm">No messages yet.</p>}
        {messages?.map((m: Message, i: number) => (
          <div key={i} className={`mb-2 ${m.role === 'candidate' ? 'text-right' : ''}`}>
            <span className={`inline-block rounded px-3 py-2 text-sm max-w-[85%] ${
              m.role === 'candidate' ? 'bg-blue-600/30 text-blue-200' : 'bg-gray-800 text-gray-200'
            }`}>
              <span className="text-xs opacity-60 block mb-1">
                {m.role === 'candidate' ? assessment.candidate_name : 'Caller (Sarah)'}
              </span>
              {m.content}
            </span>
          </div>
        ))}
      </div>

      {/* Ticket */}
      {ticket && (
        <div className="bg-gray-900 border border-gray-800 rounded p-4 mb-4">
          <h2 className="text-lg font-semibold mb-2">Ticket</h2>
          <div className="bg-gray-800 rounded p-3 text-sm whitespace-pre-wrap">{ticket.candidate_ticket_text}</div>
        </div>
      )}

      {/* Analysis */}
      <div className="bg-gray-900 border border-gray-800 rounded p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Analysis</h2>
          <button
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
            onClick={runAnalysis}
            disabled={analysing}
          >
            {analysing ? 'Analysing...' : 'Run Analysis'}
          </button>
        </div>

        {!analysisResult && <p className="text-gray-500 text-sm">Click &quot;Run Analysis&quot; to evaluate the candidate against standard criteria.</p>}

        {analysisResult?.status === 'analysis_failed' && (
          <div className="bg-red-900/30 border border-red-700 rounded p-3 text-sm text-red-300">
            Analysis failed: {analysisResult.error || 'Model returned invalid data'}
          </div>
        )}

        {analysisResult?.overall_score !== undefined && (
          <div>
            <div className="flex gap-6 mb-3">
              <div>
                <span className="text-sm text-gray-400">Score</span>
                <div className={`text-3xl font-bold ${readinessColors[analysisResult.readiness_label || ''] || ''}`}>
                  {analysisResult.overall_score}/100
                </div>
              </div>
              <div>
                <span className="text-sm text-gray-400">Readiness</span>
                <div className={`text-lg font-semibold ${readinessColors[analysisResult.readiness_label || ''] || ''}`}>
                  {analysisResult.readiness_label?.replace('_', ' ') || 'Unknown'}
                </div>
              </div>
              {analysisResult.ticket_score !== undefined && (
                <div>
                  <span className="text-sm text-gray-400">Ticket Score</span>
                  <div className="text-lg font-semibold">{analysisResult.ticket_score}/100</div>
                </div>
              )}
            </div>

            {analysisResult.summary && (
              <div className="bg-gray-800 rounded p-3 mb-3 text-sm">{analysisResult.summary}</div>
            )}

            {analysisResult.strengths && analysisResult.strengths.length > 0 && (
              <div className="mb-3">
                <h3 className="text-sm text-green-400 font-semibold mb-1">Strengths</h3>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {analysisResult.strengths.map((s: string, i: number) => (
                    <li key={i} className="text-gray-300">{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysisResult.weaknesses && analysisResult.weaknesses.length > 0 && (
              <div className="mb-3">
                <h3 className="text-sm text-red-400 font-semibold mb-1">Weaknesses</h3>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {analysisResult.weaknesses.map((w: string, i: number) => (
                    <li key={i} className="text-gray-300">{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysisResult.checkpoints && (
              <div className="mb-3">
                <h3 className="text-sm text-gray-400 font-semibold mb-1">Checkpoints</h3>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {Object.entries(analysisResult.checkpoints).map(([key, val]) => (
                    <div key={key} className={`px-2 py-1 rounded ${val ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
                      {key.replace(/_/g, ' ')}: {val ? '✓' : '✗'}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysisResult.evidence_quotes && analysisResult.evidence_quotes.length > 0 && (
              <div>
                <h3 className="text-sm text-gray-400 font-semibold mb-1">Evidence Quotes</h3>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {analysisResult.evidence_quotes.map((q: string, i: number) => (
                    <li key={i} className="text-gray-400 italic">&ldquo;{q}&rdquo;</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manager feedback */}
      <div className="bg-gray-900 border border-gray-800 rounded p-4 mb-4">
        <h2 className="text-lg font-semibold mb-3">Manager Feedback</h2>

        {feedbackSent && feedbackResult ? (
          <div className="bg-green-900/30 border border-green-700 rounded p-3 text-sm text-green-300">
            Feedback submitted: {feedbackResult.status} &mdash; Label: {feedbackLabel}
          </div>
        ) : (
          <div>
            <div className="mb-3">
              <label className="text-sm text-gray-400 block mb-1">Label</label>
              <select
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm w-full"
                value={feedbackLabel}
                onChange={e => setFeedbackLabel(e.target.value)}
              >
                <option value="">Select label...</option>
                <option value="agree">Agree</option>
                <option value="too_harsh">Too harsh</option>
                <option value="too_generous">Too generous</option>
                <option value="wrong">Wrong</option>
                <option value="useful">Useful</option>
                <option value="not_useful">Not useful</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="text-sm text-gray-400 block mb-1">Override score (0-100, optional)</label>
              <input
                type="number"
                min="0"
                max="100"
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm w-full"
                value={feedbackScore}
                onChange={e => setFeedbackScore(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="text-sm text-gray-400 block mb-1">Notes</label>
              <textarea
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm w-full min-h-[80px]"
                value={feedbackNotes}
                onChange={e => setFeedbackNotes(e.target.value)}
                placeholder="Optional notes about the assessment..."
              />
            </div>
            <button
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
              onClick={submitFeedback}
              disabled={!feedbackLabel}
            >
              Submit Feedback
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
