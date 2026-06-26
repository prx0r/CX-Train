'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import ServiceDeskSimulatorShell from '@/components/mvp/simulator/ServiceDeskSimulatorShell';
import type { SimulatorCapabilities } from '@/lib/mvp/assignment-types';

interface Message { role: string; content: string; }
interface TicketData { id: string; title: string; requester_name: string; company: string; department: string; severity: string; status: string; description: string; }
interface AssessmentData { id: string; title: string; candidate_name: string; status: string; assignment_type: string; created_at: string; }
interface ApiResponse {
  ok: boolean;
  data: {
    assessment: AssessmentData;
    assignment_runtime: { shell: string; mode_label: string; capabilities: SimulatorCapabilities };
    ticket: TicketData;
    call: { status: string; caller_name: string; caller_company: string };
    messages: Message[];
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
    return <div style={{ height: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 14 }}>Loading...</div>;
  }

  if (error || !assessmentData) {
    return <div style={{ height: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', fontSize: 14 }}>{error || 'Assessment not found'}</div>;
  }

  const { assessment, assignment_runtime, ticket, messages } = assessmentData;

  return (
    <ServiceDeskSimulatorShell
      token={token}
      assignmentType={assessment.assignment_type}
      capabilities={assignment_runtime.capabilities}
      initialMessages={messages}
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
