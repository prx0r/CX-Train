'use client';

import { useState } from 'react';
import AssessmentResults from '@/components/mvp/results/AssessmentResults';
import type { CandidateAnalysisResult } from '@/components/mvp/results/AssessmentResults';

const MOCK_RESULTS: CandidateAnalysisResult = {
  overall_score: 42,
  verdict: 'FAIL',
  criticalFailure: 'Customer left without next steps',
  summary: 'The candidate missed most communication and diagnostic steps. The technical fix was correct but not verified with the customer.',
  verdictLine: 'FAIL 42/100 — Customer left without next steps. Ticket missing urgency, impact, and verification.',
  bonus: 0,
  coreEarned: 8,
  maxCore: 20,
  strengths: [
    'Successfully identified Outlook as the affected application',
    'Correctly disabled Work Offline mode',
  ],
  improvements: [
    'Did not ask about business impact — invoices were needed urgently',
    'Did not ask about scope — whether one user or many were affected',
    'Did not verify the fix with the customer — sent test email but did not confirm receipt',
    'Did not check webmail to isolate the issue to the desktop client',
    'Did not document next steps or expected resolution timeline',
    'Ticket missing urgency, impact, and device details',
  ],
  diagnostic_checklist: {
    identity_check: true,
    company_check: false,
    issue_clarification: true,
    started_when: false,
    impact: false,
    urgency: false,
    scope: false,
    technical_discovery: true,
    error_or_status_capture: true,
    recent_changes: false,
    next_steps: false,
    customer_tone: true,
    professional_conduct: true,
    customer_communication: false,
    ticket_user_company: true,
    ticket_issue_summary: true,
    ticket_impact: false,
    ticket_urgency: false,
    ticket_checks_attempted: true,
    ticket_next_step: false,
    escalation_judgement: true,
    safety: true,
  },
  narrative: {
    summary: 'The candidate understood the technical issue and performed the correct fix, but missed several critical communication and documentation steps. The biggest miss was not verifying the fix with the customer — a key step in first-call resolution. The ticket was also missing urgency and impact details which are essential for triage and prioritisation.',
    ticket_feedback: 'The ticket summary mentions the fix but lacks business context. No urgency indicator, no impact assessment, and no mention of verification steps taken. Should include: requester name, company, device, impact, urgency, checks performed, root cause, resolution steps, and verification confirmed.',
    coaching_focus: [
      'Always ask about business impact — helps prioritise and demonstrates customer awareness',
      'Verify every fix with the customer before closing — "Can you confirm the email sent?"',
      'Document impact and urgency in every ticket — enables correct triage and escalation',
      'Use the scope question early — "Is this affecting one person or multiple people?"',
    ],
  },
};

export default function ResultsPrototypePage() {
  const [analysis, setAnalysis] = useState<CandidateAnalysisResult>(MOCK_RESULTS);

  return <AssessmentResults analysis={analysis} onRetake={() => {}} />;
}
