'use client';

export interface CriterionResult {
  id: string;
  label: string;
  category: string;
  status: 'pass' | 'partial' | 'fail';
  weight: number;
  earned: number;
  max: number;
}

export interface CategoryScore {
  id: string;
  label: string;
  score: number;
  maxScore: number;
  percent: number;
  criteria: CriterionResult[];
}

export interface ScoringScale {
  ready: { label: string; minScore: number; description: string };
  needsSupervision: { label: string; minScore: number; description: string };
  notReady: { label: string; maxScore: number; description: string };
}

export interface FrameworkDisplay {
  id: string;
  name: string;
  score: number;
  passed: boolean;
  summary: string;
  criticalFailures: string[];
  criteria: Array<{ id: string; label: string; status: string; evidence: string; earned: number; max: number }>;
}

export interface CandidateAnalysisResult {
  overall_score: number;
  verdict: 'PASS' | 'FAIL';
  criticalFailure: string | null;
  summary: string;
  verdictLine: string;
  strengths: string[];
  improvements: string[];
  diagnostic_checklist?: Record<string, boolean>;
  narrative?: {
    summary: string;
    ticket_feedback: string;
    coaching_focus: string[];
  };
  categoryScores?: CategoryScore[];
  whatCostYouMost?: Array<{ label: string; pointsLost: number; category: string }>;
  bonus: number;
  coreEarned: number;
  maxCore: number;
  compliance?: {
    combinedScore: number;
    combinedVerdict: string;
    certifiedFrameworks: string[];
    failedFrameworks: string[];
    frameworks: FrameworkDisplay[];
  };
}

const VERDICT_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  PASS: { bg: '#e8f3ec', text: '#0f5132', border: '#0f5132' },
  FAIL: { bg: '#fff4f2', text: '#842029', border: '#842029' },
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

export default function AssessmentResults({ analysis, onRetake, onReview, reviewMode }: {
  analysis: CandidateAnalysisResult | null;
  onRetake?: () => void;
  onReview?: () => void;
  reviewMode?: boolean;
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

  const verdictStyle = VERDICT_STYLES[analysis.verdict] || VERDICT_STYLES.FAIL;
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
        {onReview && (
          <button onClick={onReview} style={{
            padding: '4px 12px', background: 'transparent', color: '#b8b8b8', border: '1px solid #555',
            borderRadius: 2, fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}>
            {reviewMode ? 'Back to Results' : 'Review Breakdown'}
          </button>
        )}
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
          <div style={{ fontSize: 36, fontWeight: 700, color: verdictStyle.text, lineHeight: 1 }}>{scorePct}</div>
          <div style={{ fontSize: 10, color: '#525252', textTransform: 'uppercase', fontWeight: 600 }}>/100</div>
        </div>
        <div style={{
          padding: '5px 14px', borderRadius: 2, fontSize: 13, fontWeight: 700,
          background: verdictStyle.bg, color: verdictStyle.text, border: `1px solid ${verdictStyle.border}`,
          letterSpacing: '0.5px',
        }}>
          {analysis.verdict}
        </div>
        <div style={{
          flex: 1, fontSize: 12, color: analysis.verdict === 'PASS' ? '#0f5132' : '#842029',
          lineHeight: 1.4, borderLeft: '1px solid #cfcfcf', paddingLeft: 16, fontWeight: 600,
        }}>
          {analysis.verdictLine || analysis.summary}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {reviewMode ? (
          <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Section title="How Scoring Works" color="#111">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <div style={{ padding: '6px 8px', borderRadius: 2, borderLeft: `3px solid ${analysis.verdict === 'PASS' ? '#0f5132' : '#842029'}`, background: '#f9f9f9' }}>
                  <div style={{ fontWeight: 700, color: '#111' }}>Core Score: {analysis.coreEarned}/{analysis.maxCore} binary criteria passed</div>
                  <div style={{ color: '#525252' }}>Each criterion = 1pt. Did you do it? Yes = 1, No = 0. Partial = 0.5.</div>
                </div>
                {analysis.bonus > 0 && (
                  <div style={{ padding: '6px 8px', borderRadius: 2, borderLeft: '3px solid #7a4f00', background: '#f9f9f9' }}>
                    <div style={{ fontWeight: 700, color: '#111' }}>Exceptional Service Bonus: +{analysis.bonus}/10</div>
                    <div style={{ color: '#525252' }}>AI-evaluated: empathy, proactiveness, clarity, anticipation of needs.</div>
                  </div>
                )}
                <div style={{ padding: '6px 8px', borderRadius: 2, borderLeft: `3px solid ${analysis.verdict === 'PASS' ? '#0f5132' : '#842029'}`, background: '#f9f9f9' }}>
                  <div style={{ fontWeight: 700, color: '#111' }}>PASS ≥ 60 · FAIL {'<'} 60 or critical failure</div>
                  <div style={{ color: '#525252' }}>Critical failures: no ticket, no triage, safety violation, no next steps. Auto-fail: abuse, security, refusal, hallucinated fix.</div>
                </div>
              </div>
            </Section>

            <Section title="Category Breakdown" color="#111">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {analysis.categoryScores?.map(cat => (
                  <div key={cat.id} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#222', marginBottom: 2 }}>
                      <span style={{ fontWeight: 700 }}>{cat.label}</span>
                      <span>{cat.score}/{cat.maxScore} pts ({cat.percent}%)</span>
                    </div>
                    <div style={{ height: 6, background: '#efefef', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, cat.percent)}%`, background: cat.percent >= 80 ? '#0f5132' : cat.percent >= 60 ? '#7a4f00' : '#842029', borderRadius: 3 }} />
                    </div>
                    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {cat.criteria.filter(c => c.max > 0).map(c => (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '2px 4px', borderRadius: 2, background: c.status === 'pass' ? '#f7f7f7' : '#fff4f2' }}>
                          <span style={{ color: c.status === 'pass' ? '#0f5132' : '#842029', fontWeight: 700 }}>{c.status === 'pass' ? '✓' : c.status === 'partial' ? '●' : '✗'}</span>
                          <span style={{ flex: 1, color: '#222' }}>{c.label}</span>
                          <span style={{ color: '#525252' }}>{c.earned}/{c.max}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="What Cost You Most" color="#842029">
              {analysis.whatCostYouMost && analysis.whatCostYouMost.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {analysis.whatCostYouMost.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid #efefef', fontSize: 12 }}>
                      <span style={{ color: '#842029', fontWeight: 700 }}>−{item.pointsLost}</span>
                      <span style={{ flex: 1, color: '#222' }}>{item.label}</span>
                      <span style={{ color: '#525252', fontSize: 10, textTransform: 'capitalize' }}>{item.category.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#0f5132' }}>No points lost — all criteria passed.</div>
              )}
            </Section>

            <Section title="Full Criteria Checklist" color="#525252">
              {diagSteps.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {diagSteps.map(f => (
                    <div key={f.key} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
                      borderBottom: '1px solid #efefef', fontSize: 12,
                    }}>
                      <span style={{ color: f.passed ? '#0f5132' : '#842029', fontWeight: 700, width: 16 }}>
                        {f.passed ? '✓' : '✗'}
                      </span>
                      <span style={{ flex: 1, color: '#222' }}>{f.label}</span>
                      <span style={{
                        padding: '1px 6px', borderRadius: 2, fontSize: 10, fontWeight: 700,
                        background: f.passed ? '#e8f3ec' : '#fff4f2',
                        color: f.passed ? '#0f5132' : '#842029',
                      }}>
                        {f.passed ? 'Pass' : 'Fail'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100, margin: '0 auto' }}>

          {/* Category scores bars */}
          {analysis.categoryScores && analysis.categoryScores.length > 0 && (
            <Section title="Category Scores" color="#111">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {analysis.categoryScores.filter(c => c.maxScore > 0 && c.id !== 'fundamentals').map(cat => (
                  <div key={cat.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#222', marginBottom: 2 }}>
                      <span style={{ fontWeight: 700 }}>{cat.label}</span>
                      <span>{cat.score}/{cat.maxScore} pts ({cat.percent}%)</span>
                    </div>
                    <div style={{ height: 8, background: '#efefef', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, cat.percent)}%`, background: cat.percent >= 80 ? '#0f5132' : cat.percent >= 60 ? '#7a4f00' : '#842029', borderRadius: 3, transition: 'width 0.5s' }} />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px', marginTop: 3 }}>
                      {cat.criteria.filter(c => c.max > 0).map(c => (
                        <span key={c.id} style={{ fontSize: 10, color: c.status === 'pass' ? '#0f5132' : '#842029', padding: '1px 4px', background: c.status === 'pass' ? '#e8f3ec' : '#fff4f2', borderRadius: 2 }}>
                          {c.status === 'pass' ? '✓' : c.status === 'partial' ? '◐' : '✗'} {c.label} ({c.earned}/{c.max})
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {analysis.bonus > 0 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#7a4f00', marginBottom: 2 }}>
                      <span style={{ fontWeight: 700 }}>Exceptional Service Bonus</span>
                      <span>+{analysis.bonus}/10</span>
                    </div>
                    <div style={{ height: 8, background: '#efefef', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(analysis.bonus / 10) * 100}%`, background: '#7a4f00', borderRadius: 3 }} />
                    </div>
                  </div>
                )}
                {analysis.criticalFailure && (
                  <div style={{ padding: '6px 10px', background: '#fff4f2', borderRadius: 2, border: '1px solid #d99a91', fontSize: 12, color: '#842029' }}>
                    <strong>Critical Failure:</strong> {analysis.criticalFailure}
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Compliance Frameworks — informational, not part of Callum score */}
          {analysis.compliance && analysis.compliance.frameworks && analysis.compliance.frameworks.length > 0 && (
            <Section title="Compliance Standards — For Information" color="#525252">
              <div style={{ fontSize: 11, color: '#525252', marginBottom: 6 }}>
                Your Callum score above is the primary assessment. The compliance scores below show how you would score against recognised industry standards. These do not affect your Callum Rating.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {analysis.compliance.frameworks.map(fw => (
                  <div key={fw.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 2 }}>
                      <span style={{ color: fw.passed ? '#0f5132' : '#842029', fontWeight: 700 }}>{fw.passed ? '✓' : '✗'}</span>
                      <span style={{ fontWeight: 600, color: '#222', flex: 1 }}>{fw.name}</span>
                      <span style={{ fontWeight: 700, color: fw.score >= 80 ? '#0f5132' : fw.score >= 60 ? '#7a4f00' : '#842029' }}>{fw.score}%</span>
                    </div>
                    <div style={{ height: 4, background: '#efefef', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, fw.score)}%`, background: fw.score >= 80 ? '#0f5132' : fw.score >= 60 ? '#7a4f00' : '#842029', borderRadius: 2 }} />
                    </div>
                    {fw.criticalFailures && fw.criticalFailures.length > 0 && (
                      <div style={{ fontSize: 10, color: '#842029', marginTop: 1 }}>Missed: {fw.criticalFailures.join(', ')}</div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* What cost you most + improvements in two-column */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* LEFT COLUMN — what went wrong */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Most Impactful */}
              {analysis.whatCostYouMost && analysis.whatCostYouMost.length > 0 && (
                <Section title="What cost you the most points" color="#842029">
                  {analysis.whatCostYouMost.map((item, i) => (
                    <Row key={i} icon={`−${item.pointsLost}`} color="#842029" label={`${item.label} (${item.category.replace(/_/g, ' ')})`} />
                  ))}
                </Section>
              )}

              {!analysis.whatCostYouMost?.length && failures.length > 0 && (
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
      )}
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
