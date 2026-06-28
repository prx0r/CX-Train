'use client';

import { useEffect, useState } from 'react';
import type { CandidateAnalysisResult } from '@/components/mvp/results/AssessmentResults';

interface UseTicketSubmissionParams {
  token: string;
  ticketTitle: string;
  internalNotes: string[];
  liveNotes: string[];
  initialAnalysis?: CandidateAnalysisResult | null;
  onError: (message: string) => void;
  onInitialAnalysisLoaded?: () => void;
}

export function useTicketSubmission({
  token,
  ticketTitle,
  internalNotes,
  liveNotes,
  initialAnalysis,
  onError,
  onInitialAnalysisLoaded,
}: UseTicketSubmissionParams) {
  const [uncertainties, setUncertainties] = useState('');
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<CandidateAnalysisResult | null>(null);
  const [reviewMode, setReviewMode] = useState(false);

  useEffect(() => {
    if (initialAnalysis) {
      setTicketSubmitted(true);
      setAnalysisResults(initialAnalysis);
      onInitialAnalysisLoaded?.();
    }
  }, [initialAnalysis, onInitialAnalysisLoaded]);

  async function submitTicket() {
    const allNotes = [
      ...internalNotes.map(note => `[Internal] ${note}`),
      ...liveNotes.map(note => `[Live] ${note}`),
    ].join('\n');
    const ticketContent = allNotes || `Assessment completed — ${ticketTitle}`;

    setAnalysing(true);
    try {
      const res = await fetch(`/api/mvp/assessment/${token}/ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket: ticketContent,
          uncertainties: uncertainties.trim(),
          notes: { internal: internalNotes, live: liveNotes },
        }),
      });
      const data = await res.json();
      if (data.status === 'completed') {
        setTicketSubmitted(true);
        if (data.candidate_analysis) {
          setAnalysisResults(data.candidate_analysis);
        }
      } else {
        onError(data.error || 'Failed to submit ticket');
      }
    } catch {
      onError('Failed to submit ticket');
    } finally {
      setAnalysing(false);
    }
  }

  return {
    analysisResults,
    analysing,
    reviewMode,
    setReviewMode,
    setUncertainties,
    submitTicket,
    ticketSubmitted,
    uncertainties,
  };
}
