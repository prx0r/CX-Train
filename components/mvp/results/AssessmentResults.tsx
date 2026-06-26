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

const RATING_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  ready: { bg: '#e8f3ec', text: '#0f5132', label: 'Ready' },
  needs_supervision: { bg: '#f6e8b1', text: '#7a4f00', label: 'Needs Supervision' },
  not_ready: { bg: '#fff4f2', text: '#842029', label: 'Not Ready' },
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

  const rating = RATING_COLORS[analysis.readiness_label] || RATING_COLORS.not_ready;
  const scorePct = analysis.overall_score;
  const scoreColor = scorePct >= 80 ? '#0f5132' : scorePct >= 60 ? '#7a4f00' : '#842029';
  const diagSteps = analysis.diagnostic_checklist
    ? Object.entries(analysis.diagnostic_checklist).map(([key, passed]) => ({
        key,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        passed,
      }))
    : [];

  return (
    <div style={{ height: '100vh', background: '#dcdcdc', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'Arial, Helvetica, sans-serif', color: '#111' }}>
      <div style={{ height: 46, background: '#111', display: 'flex', alignItems: 'center', padding: '0 18px', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>Assessment Results</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: '#b8b8b8' }}>Connexion PSA</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px', maxWidth: 800, margin: '0 auto', width: '100%' }}>
        {/* Score header */}
        <div style={{ background: '#fff', border: '1px solid #b8b8b8', borderRadius: 3, padding: 20, marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>{scorePct}</div>
          <div style={{ fontSize: 14, color: '#525252', marginTop: 4 }}>out of 100</div>
          <div style={{
            display: 'inline-block', marginTop: 10, padding: '4px 14px', borderRadius: 3,
            background: rating.bg, color: rating.text, fontSize: 14, fontWeight: 700,
            border: `1px solid ${rating.text}`,
          }}>
            {rating.label}
          </div>
        </div>

        {/* Narrative summary */}
        {analysis.narrative?.summary && (
          <div style={{ background: '#fff', border: '1px solid #b8b8b8', borderRadius: 3, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#525252', marginBottom: 8 }}>Summary</div>
            <div style={{ fontSize: 13, color: '#222', lineHeight: 1.6 }}>{analysis.narrative.summary}</div>
          </div>
        )}

        {/* Diagnostic checklist */}
        {diagSteps.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #b8b8b8', borderRadius: 3, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#525252', marginBottom: 8 }}>Diagnostic Steps</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {diagSteps.map(step => (
                <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 0', borderBottom: '1px solid #efefef' }}>
                  <span style={{ color: step.passed ? '#0f5132' : '#842029', fontWeight: 700, minWidth: 20 }}>
                    {step.passed ? '✓' : '✗'}
                  </span>
                  <span style={{ color: step.passed ? '#0f5132' : '#842029' }}>{step.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Strengths */}
        {analysis.strengths.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #b8b8b8', borderRadius: 3, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#0f5132', marginBottom: 8 }}>What went well</div>
            {analysis.strengths.map((s, i) => (
              <div key={i} style={{ fontSize: 13, color: '#222', padding: '3px 0', paddingLeft: 10, borderLeft: '3px solid #8db99b' }}>
                ✓ {s}
              </div>
            ))}
          </div>
        )}

        {/* Improvements */}
        {analysis.improvements.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #b8b8b8', borderRadius: 3, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#842029', marginBottom: 8 }}>Areas to improve</div>
            {analysis.improvements.map((s, i) => (
              <div key={i} style={{ fontSize: 13, color: '#222', padding: '3px 0', paddingLeft: 10, borderLeft: '3px solid #d99a91' }}>
                {s}
              </div>
            ))}
          </div>
        )}

        {/* Ticket feedback */}
        {analysis.narrative?.ticket_feedback && (
          <div style={{ background: '#fff', border: '1px solid #b8b8b8', borderRadius: 3, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#525252', marginBottom: 8 }}>Ticket Feedback</div>
            <div style={{ fontSize: 13, color: '#222', lineHeight: 1.5 }}>{analysis.narrative.ticket_feedback}</div>
          </div>
        )}

        {/* Coaching focus */}
        {analysis.narrative?.coaching_focus && analysis.narrative.coaching_focus.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #b8b8b8', borderRadius: 3, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#525252', marginBottom: 8 }}>Coaching Focus</div>
            {analysis.narrative.coaching_focus.map((f, i) => (
              <div key={i} style={{ fontSize: 13, color: '#222', padding: '3px 0', paddingLeft: 10, borderLeft: '3px solid #111' }}>{f}</div>
            ))}
          </div>
        )}

        {/* Retake */}
        {onRetake && (
          <div style={{ textAlign: 'center', padding: 10 }}>
            <button onClick={onRetake} style={{
              padding: '10px 28px', borderRadius: 3, border: '1px solid #111',
              background: '#111', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
              Retake Assessment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
