'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import SimulationWorkspace from '@/components/mvp/workspace/SimulationWorkspace';
import type { SimulatorCapabilities } from '@/lib/mvp/assignment-types';
import type { ModeConfig, WorkspaceMode } from '@/lib/mvp/workspace/types';

interface Message { role: string; content: string; }
interface TicketData { id: string; title: string; requester_name: string; company: string; department: string; severity: string; status: string; description: string; }
interface AssessmentData { id: string; title: string; candidate_name: string; status: string; assignment_type: string; created_at: string; }
interface HiringPack { id: string; title: string; customer: { name: string; company: string; openingLine: string; issue: string; role: string; temperament: string }; }
interface ApiResponse {
  ok: boolean;
  data: {
    assessment: AssessmentData;
    assignment_runtime: { shell: string; mode?: WorkspaceMode; mode_label: string; capabilities: SimulatorCapabilities; mode_config?: ModeConfig };
    ticket: TicketData;
    call: { status: string; caller_name: string; caller_company: string };
    messages: Message[];
    candidate_analysis?: Record<string, unknown>;
    hiring_pack?: HiringPack | null;
  };
}

export default function CandidatePage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assessmentData, setAssessmentData] = useState<ApiResponse['data'] | null>(null);

  useEffect(() => {
    fetch(`/api/mvp/assessment/${token}`)
      .then(r => r.json())
      .then((data: ApiResponse) => {
        if (data.ok && data.data) {
          setAssessmentData(data.data);
        } else {
          setError('Assessment not found');
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load assessment');
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return <div style={{ height: '100vh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6f6f6f', fontSize: 14 }}>Loading...</div>;
  }

  if (error || !assessmentData) {
    return <div style={{ height: '100vh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#842029', fontSize: 14 }}>{error || 'Assessment not found'}</div>;
  }

  const { assessment, assignment_runtime, ticket, messages, candidate_analysis, hiring_pack } = assessmentData;

  return (
    <SimulationWorkspace
      token={token}
      mode={assignment_runtime.mode}
      modeConfig={assignment_runtime.mode_config}
      assignmentType={assessment.assignment_type}
      capabilities={assignment_runtime.capabilities}
      initialMessages={messages}
      initialAnalysis={candidate_analysis as any}
      hiringPack={hiring_pack || undefined}
      ticket={{
        id: ticket.id,
        title: ticket.title,
        requesterName: ticket.requester_name,
        company: ticket.company,
        department: ticket.department,
        severity: ticket.severity,
        status: ticket.status,
        description: ticket.description,
      }}
    />
  );
}
