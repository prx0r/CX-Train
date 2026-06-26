'use client';

export interface CandidateAnalysisResult {
  overall_score: number;
  readiness_label: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  diagnostic_checklist?: Record<string, boolean>;
  narrative?: {
    summary: string;
    ticket_feedback: string;
    coaching_focus: string[];
  };
}

const RATING_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  ready: { bg: '#e8f3ec', text: '#0f5132', label: 'Ready' },
  needs_supervision: { bg: '#f6e8b1', text: '#7a4f00', label: 'Needs Supervision' },
  not_ready: { bg: '#fff4f2', text: '#842029', label: 'Not Ready' },
};

const CRITERIA_LABELS: Record<string, string> = {
  identity_check: 'Confirmed caller identity',
  company_check: 'Confirmed company',
  issue_clarification: 'Clarified the issue',
  started_when: 'Asked when it started',
  impact: 'Asked about business impact',
  urgency: 'Asked about urgency',
  scope: 'Asked scope (one or many)',
  technical_discovery: 'Performed technical discovery',
  error_or_status_capture: 'Captured error messages',
  recent_changes: 'Asked about recent changes',
  next_steps: 'Set next steps',
  customer_tone: 'Professional tone',
  professional_conduct: 'Professional conduct',
  customer_communication: 'Clear communication',
  ticket_user_company: 'Ticket: user + company',
  ticket_issue_summary: 'Ticket: issue summary',
  ticket_impact: 'Ticket: impact',
  ticket_urgency: 'Ticket: urgency',
  ticket_checks_attempted: 'Ticket: checks attempted',
  ticket_next_step: 'Ticket: next step',
  escalation_judgement: 'Escalation judgement',
  safety: 'Safety awareness',
};

export default function AssessmentResults({ analysis, onRetake }: {
  analysis: CandidateAnalysisResult | null;
  onRetake?: () => void;
}) {
  if (!analysis) {
    return (
      <div style={{ height: '100vh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#2f2f2f', borderRadius: 2, padding: 48, maxWidth: 440, textAlign: 'center', border: '1px solid #4a4a4a' }}>
          <div style={{ fontSize: 48, marginBottom: 16, color: '#4ade80' }}>✓</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#4ade80', margin: '0 0 8px' }}>Assessment Complete</h2>
          <p style={{ color: '#999', fontSize: 14, margin: 0 }}>Your ticket has been submitted. You may close this window.</p>
        </div>
      </div>
    );
  }

  const rating = RATING_STYLES[analysis.readiness_label] || RATING_STYLES.not_ready;
  const scorePct = analysis.overall_score;
  const diagSteps = analysis.diagnostic_checklist
    ? Object.entries(analysis.diagnostic_checklist).map(([key, passed]) => ({
        key,
        label: CRITERIA_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        passed,
      })).sort((a, b) => Number(a.passed) - Number(b.passed))
    : [];

  const failures = diagSteps.filter(s => !s.passed);
  const passes = diagSteps.filter(s => s.passed);

  return (
    <div style={{ height: '100vh', background: '#e8e8e8', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'Arial, Helvetica, sans-serif', color: '#111' }}>
      {/* Top bar */}
      <div style={{ height: 44, background: '#111', display: 'flex', alignItems: 'center', padding: '0 18px', flexShrink: 0, gap: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #fff' }} />
          Connexion PSA
        </span>
        <span style={{ fontSize: 10, color: '#b8b8b8', background: '#2f2f2f', padding: '2px 7px', borderRadius: 2, border: '1px solid #4a4a4a' }}>
          Training Drill
        </span>
        <span style={{ fontSize: 10, color: '#b8b8b8', borderLeft: '1px solid #555', paddingLeft: 10 }}>Assessment Results</span>
        <div style={{ flex: 1 }} />
        {onRetake && (
          <button onClick={onRetake} style={{
            padding: '4px 12px', background: '#fff', color: '#111', border: 'none',
            borderRadius: 2, fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}>
            Retake Assessment
          </button>
        )}
      </div>

      {/* Score bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #b8b8b8', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
        <div style={{ textAlign: 'center', minWidth: 80 }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: scorePct >= 80 ? '#0f5132' : scorePct >= 60 ? '#7a4f00' : '#842029', lineHeight: 1 }}>{scorePct}</div>
          <div style={{ fontSize: 10, color: '#525252', textTransform: 'uppercase', fontWeight: 600 }}>Score</div>
        </div>
        <div style={{
          padding: '4px 12px', borderRadius: 2, fontSize: 12, fontWeight: 700,
          background: rating.bg, color: rating.text, border: `1px solid ${rating.text}`,
        }}>
          {rating.label}
        </div>
        <div style={{ flex: 1, fontSize: 12, color: '#525252', lineHeight: 1.4, borderLeft: '1px solid #cfcfcf', paddingLeft: 16 }}>
          {analysis.summary}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 1100, margin: '0 auto' }}>

          {/* LEFT COLUMN — what went wrong */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Most Impactful */}
            {failures.length > 0 && (
              <Section title="What cost you the most points" color="#842029">
                {failures.slice(0, 5).map(f => (
                  <Row key={f.key} icon="✗" color="#842029" label={f.label} />
                ))}
              </Section>
            )}

            {/* Improvements from AI */}
            {analysis.improvements.length > 0 && (
              <Section title="What to do differently next time" color="#842029">
                {analysis.improvements.map((s, i) => (
                  <Row key={i} icon="→" color="#842029" label={s} />
                ))}
              </Section>
            )}

            {/* Coaching focus */}
            {analysis.narrative?.coaching_focus && analysis.narrative.coaching_focus.length > 0 && (
              <Section title="Coaching focus" color="#111">
                {analysis.narrative.coaching_focus.map((f, i) => (
                  <Row key={i} icon="●" color="#111" label={f} />
                ))}
              </Section>
            )}
          </div>

          {/* RIGHT COLUMN — what went well + details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Strengths */}
            {analysis.strengths.length > 0 && (
              <Section title="What went well" color="#0f5132">
                {analysis.strengths.map((s, i) => (
                  <Row key={i} icon="✓" color="#0f5132" label={s} />
                ))}
              </Section>
            )}

            {/* All criteria compact */}
            {passes.length > 0 && (
              <Section title="All criteria" color="#525252">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
                  {passes.map(f => (
                    <div key={f.key} style={{ fontSize: 11, color: '#0f5132', padding: '2px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>✓</span> {f.label}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Ticket feedback */}
            {analysis.narrative?.ticket_feedback && (
              <Section title="Ticket notes" color="#525252">
                <div style={{ fontSize: 12, color: '#222', lineHeight: 1.5 }}>{analysis.narrative.ticket_feedback}</div>
              </Section>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #b8b8b8', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #cfcfcf', background: '#f4f4f4' }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color }}>
          {title}
        </span>
      </div>
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {children}
      </div>
    </div>
  );
}

function Row({ icon, color, label }: { icon: string; color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, padding: '3px 0', borderBottom: '1px solid #efefef', lineHeight: 1.4 }}>
      <span style={{ color, fontWeight: 700, flexShrink: 0, minWidth: 14 }}>{icon}</span>
      <span style={{ color: '#222' }}>{label}</span>
    </div>
  );
}
