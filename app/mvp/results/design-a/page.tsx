import { readFileSync } from 'fs';
import { join } from 'path';
import { scoreExtraction, DEFAULT_WEIGHTS } from '@/lib/mvp/analysis/scoring';
import { evaluateAllFrameworks } from '@/lib/mvp/compliance/evaluator';
import { DEFAULT_FRAMEWORKS } from '@/lib/mvp/compliance/frameworks';

const FIXTURES_DIR = join(process.cwd(), 'tests', 'fixtures', 'analysis-engine');
const ALL_W = Object.keys(DEFAULT_WEIGHTS);

const CATS = [
  { id: 'security_compliance', label: 'Security & Compliance', fws: ['cyber_essentials_2025', 'gdpr_2018'], weight: 25, color: '#dc2626' },
  { id: 'technical_troubleshooting', label: 'Technical Troubleshooting', fws: ['kepner_tregoe', 'itil_incident_mgmt'], weight: 25, color: '#2563eb' },
  { id: 'customer_experience', label: 'Customer Experience', fws: ['servqual', 'sbar_communication', 'leap_heat_rubric'], weight: 25, color: '#059669' },
  { id: 'process_professionalism', label: 'Process & Professionalism', fws: ['itil_service_desk'], weight: 15, color: '#7c3aed' },
  { id: 'msp_custom', label: 'MSP Custom', fws: ['callum_baseline_v1'], weight: 10, color: '#d97706' },
];

const RED_FLAG_INFO: Record<string, { label: string; color: string }> = {
  severe_customer_abuse: { label: 'Severe Customer Abuse', color: '#dc2626' },
  unsafe_security_behaviour: { label: 'Unsafe Security Behaviour', color: '#dc2626' },
  unprofessional_conduct: { label: 'Unprofessional Conduct', color: '#d97706' },
  refusal_to_help: { label: 'Refusal to Help', color: '#dc2626' },
  hallucinated_fix: { label: 'Hallucinated Fix', color: '#ea580c' },
  no_troubleshooting: { label: 'No Troubleshooting', color: '#d97706' },
};

/* ── Server-side computation ── */

function loadTranscript(name: string) {
  const raw = JSON.parse(readFileSync(join(FIXTURES_DIR, `${name}.json`), 'utf-8'));
  return raw;
}

function compute(name: string) {
  const fx = loadTranscript(name);
  const exp = fx.expected;
  const passSet = new Set(exp.must_pass || []);
  const failSet = new Set(exp.must_fail || []);
  const flagSet = new Set(exp.must_trigger_red_flags || []);

  const criteria: Record<string, { status: string }> = {};
  for (const k of ALL_W) {
    if (passSet.has(k)) criteria[k] = { status: 'pass' };
    else if (failSet.has(k)) criteria[k] = { status: 'fail' };
    else criteria[k] = { status: 'not_observed' };
  }

  const redFlags = Array.from(flagSet).map(r => ({ type: r as string, severity: 'high', evidence: '' }));
  const scoring = scoreExtraction({ criteria, redFlags });

  const evidencePool = {
    aiCriteria: criteria as any,
    events: [],
    transcriptText: fx.transcript.map((m: any) => `${m.role}: ${m.content}`).join('\n'),
    ticketText: [fx.ticket.summary, fx.ticket.description].join('\n'),
    triage: {},
    ticketSubmitted: true,
    triagePerformed: false,
    redFlagsTriggered: Array.from(flagSet) as string[],
  };

  const fwResults = evaluateAllFrameworks(evidencePool, DEFAULT_FRAMEWORKS, null);
  const fwScores = (fwResults?.frameworks || []).map((f: any) => ({
    id: f.frameworkId,
    name: f.frameworkName,
    score: f.score,
    passed: f.passed,
    criteria: (f.criteriaResults || []).map((c: any) => ({
      id: c.criterionId,
      label: c.label,
      status: c.status,
      evidence: c.evidence,
      earned: c.pointsEarned,
      max: c.pointsMax,
    })),
  }));

  const categories = CATS.map(cat => {
    const matched = fwScores.filter(f => cat.fws.includes(f.id));
    const avg = matched.length > 0 ? Math.round(matched.reduce((s: number, f: any) => s + f.score, 0) / matched.length) : 0;
    const passed = matched.some((f: any) => f.passed);
    return { ...cat, score: avg, passed, frameworks: matched };
  });

  let total = 0;
  for (const c of categories) total += c.score * (c.weight / 100);
  const totalScore = Math.round(total);

  return { fx, scoring, totalScore, categories, fwScores, redFlags: Array.from(flagSet) as string[] };
}

/* ── Component ── */

function ScoreBadge({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const fontSize = size === 'lg' ? 36 : size === 'md' ? 24 : 16;
  const color = score >= 70 ? '#059669' : score >= 50 ? '#d97706' : '#dc2626';
  const label = score >= 70 ? 'Good' : score >= 50 ? 'Needs Work' : 'Unsatisfactory';
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize, fontWeight: 700, color, lineHeight: 1 }}>{score}</div>
      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>/ 100 · {label}</div>
    </div>
  );
}

function ReadinessBadge({ readiness }: { readiness: string }) {
  const colors: Record<string, { bg: string; text: string; label: string }> = {
    ready: { bg: '#d1fae5', text: '#065f46', label: 'READY' },
    needs_supervision: { bg: '#fef3c7', text: '#92400e', label: 'NEEDS SUPERVISION' },
    not_ready: { bg: '#fee2e2', text: '#991b1b', label: 'NOT READY' },
  };
  const c = colors[readiness] || colors.not_ready;
  return (
    <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: c.bg, color: c.text }}>
      {c.label}
    </span>
  );
}

function Bar({ score, max, color, height = 8 }: { score: number; max: number; color: string; height?: number }) {
  const pct = Math.min(100, Math.round((score / max) * 100));
  return (
    <div style={{ height, background: '#e5e7eb', borderRadius: height, overflow: 'hidden', width: '100%' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: height, transition: 'width 0.3s' }} />
    </div>
  );
}

/* ── Page ── */

export default function ResultsDesignA({ searchParams }: { searchParams: { t?: string } }) {
  const transcript = searchParams.t || 'tricky-passive-aggressive';
  const { fx, scoring, totalScore, categories, fwScores, redFlags } = compute(transcript);

  const strengths = [
    { icon: '🛡️', text: 'Security protocols followed correctly — identity verified before proceeding' },
    { icon: '🔍', text: 'Issue clarified and diagnostic steps performed' },
    { icon: '📋', text: 'Ticket documented with all required fields' },
  ];
  const weaknesses = [
    { icon: '🗣️', text: 'Tone was dismissive — audible sighs and condescending language' },
    { icon: '🔬', text: 'Root cause not systematically explored — jumped to solution' },
    { icon: '📊', text: 'Business impact and urgency not fully established' },
  ];
  const nextSteps = [
    { icon: '🎯', text: 'Practice Kepner-Tregoe IS/IS NOT method for structured diagnosis' },
    { icon: '💬', text: 'Use LEAP framework on every call: Listen, Empathize, Apologize, Problem-solve' },
    { icon: '📝', text: 'Document business impact and next steps in every ticket' },
  ];

  const transcriptText = fx.transcript.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  const showRaw = searchParams.raw === '1';

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#111' }}>

      {/* ── BACK LINK ── */}
      <a href="/mvp/results" style={{ fontSize: 12, color: '#6b7280', textDecoration: 'none', display: 'block', marginBottom: 16 }}>
        ← Back to results
      </a>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#111' }}>
            {fx.name.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
          </h1>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>
            Assessment · {fx.scenario_id} · {new Date().toLocaleDateString()}
          </p>
          {redFlags.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {redFlags.map((r: string) => (
                <span key={r} style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, color: '#fff', background: RED_FLAG_INFO[r]?.color || '#6b7280' }}>
                  ⚠ {RED_FLAG_INFO[r]?.label || r}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <ScoreBadge score={scoring.score} size="lg" />
          <ReadinessBadge readiness={scoring.rating} />
        </div>
      </div>

      {/* ── QUICK TAKEAWAYS ── */}
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#065f46', marginBottom: 6 }}>Quick Takeaways</div>
        <div style={{ fontSize: 12, color: '#166534', lineHeight: 1.6 }}>
          {scoring.rating === 'not_ready' ? (
            <>
              This candidate showed technical competence but significant conduct issues prevented a passing score.
              The troubleshooting was adequate but the dismissive tone and lack of systematic diagnosis method
              indicate they are not yet ready for independent client-facing work. Focus coaching on customer interaction
              skills and structured problem-solving methodology.
            </>
          ) : scoring.rating === 'needs_supervision' ? (
            <>
              The candidate handled most aspects of the call competently. Minor gaps in diagnostic methodology
              and documentation completeness need addressing. With targeted coaching on structured problem-solving
              (Kepner-Tregoe method) and communication frameworks (SBAR for escalations), this candidate
              should be ready for independent work within weeks.
            </>
          ) : (
            <>
              The candidate demonstrated strong performance across all assessment categories. Security protocols
              followed, customer handled professionally, issue resolved effectively, and ticket documented thoroughly.
              Ready for independent client-facing work.
            </>
          )}
        </div>
      </div>

      {/* ── STRENGTHS | WEAKNESSES | NEXT STEPS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
        {[
          { title: 'Strengths', items: strengths, color: '#059669', bg: '#f0fdf4' },
          { title: 'To Improve', items: weaknesses, color: '#dc2626', bg: '#fef2f2' },
          { title: 'Next Steps', items: nextSteps, color: '#2563eb', bg: '#eff6ff' },
        ].map(section => (
          <div key={section.title} style={{ background: section.bg, borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: section.color, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {section.title}
            </div>
            {section.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, fontSize: 11, color: '#374151', marginBottom: 6, lineHeight: 1.4 }}>
                <span>{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ── CATEGORY SCORES ── */}
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Category Scores</h2>
      <div style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
        {categories.map(cat => (
          <div key={cat.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: cat.passed ? '#059669' : '#dc2626', fontSize: 14, fontWeight: 700 }}>{cat.passed ? '✓' : '✗'}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{cat.label}</span>
                <span style={{ fontSize: 10, color: '#9ca3af' }}>({cat.weight}% of total)</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: cat.score >= 70 ? '#059669' : cat.score >= 50 ? '#d97706' : '#dc2626' }}>{cat.score}</span>
            </div>
            <Bar score={cat.score} max={100} color={cat.color} height={6} />

            {/* Framework breakdowns */}
            <div style={{ marginTop: 8 }}>
              {cat.frameworks.map((fw: any) => (
                <details key={fw.id} style={{ marginBottom: 4 }}>
                  <summary style={{ fontSize: 11, color: '#6b7280', cursor: 'pointer', padding: '2px 0' }}>
                    <span style={{ color: fw.passed ? '#059669' : '#dc2626', fontWeight: 600 }}>{fw.passed ? '✓' : '✗'}</span>
                    {' '}{fw.name}
                    <span style={{ float: 'right', fontWeight: 600, color: fw.score >= 70 ? '#059669' : fw.score >= 50 ? '#d97706' : '#dc2626' }}>{fw.score}/100</span>
                  </summary>
                  <div style={{ padding: '6px 0 2px 12px', borderLeft: '2px solid #e5e7eb', marginLeft: 4 }}>
                    {fw.criteria.map((c: any) => (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', fontSize: 10, borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ color: c.status === 'pass' ? '#059669' : c.status === 'fail' ? '#dc2626' : '#9ca3af', fontWeight: 700 }}>
                            {c.status === 'pass' ? '✓' : c.status === 'fail' ? '✗' : '–'}
                          </span>
                          <span style={{ color: '#374151' }}>{c.label}</span>
                        </div>
                        <span style={{ color: '#9ca3af', fontSize: 9 }}>
                          {c.status} · {c.earned}/{c.max}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── TRANSCRIPT ── */}
      <details>
        <summary style={{ fontSize: 12, color: '#6b7280', cursor: 'pointer', fontWeight: 600, padding: '8px 0' }}>
          View Transcript ({fx.transcript.length} messages)
        </summary>
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: 12, marginTop: 4, fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: '#374151' }}>
          {transcriptText}
        </div>
      </details>

      {/* ── FOOTER ── */}
      <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #e5e7eb', fontSize: 10, color: '#9ca3af', textAlign: 'center' }}>
        CX-Train Assessment Engine · Frameworks: {DEFAULT_FRAMEWORKS.length} · Categories: {CATS.length} · Criteria: {ALL_W.length}
      </div>
    </div>
  );
}
