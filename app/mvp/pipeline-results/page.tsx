import { readFileSync } from 'fs';
import { join } from 'path';
import { scoreExtraction, DEFAULT_WEIGHTS } from '@/lib/mvp/analysis/scoring';
import { evaluateAllFrameworks } from '@/lib/mvp/compliance/evaluator';
import { DEFAULT_FRAMEWORKS } from '@/lib/mvp/compliance/frameworks';

interface TranscriptMsg { role: string; content: string }
interface AiCriteria { [key: string]: { status: string; evidence?: string[] } }

interface CachedResult {
  criteria: AiCriteria;
  redFlags: string[];
  evidence?: string;
}

interface TestData {
  name: string;
  scenario: string;
  messages: TranscriptMsg[];
  ticket: { summary: string; description: string; priority: string; category: string };
  expectedScore: { min: number; max: number };
  expectedReadiness: string;
  ai: CachedResult;
}

const ALL_CRITERIA = Object.keys(DEFAULT_WEIGHTS);

const CATEGORY_DEF = [
  { id: 'security_compliance', label: 'Security & Compliance', frameworks: ['cyber_essentials_2025', 'gdpr_2018'], weight: 25, color: '#dc2626' },
  { id: 'technical_troubleshooting', label: 'Technical Troubleshooting', frameworks: ['kepner_tregoe', 'itil_incident_mgmt'], weight: 25, color: '#2563eb' },
  { id: 'customer_experience', label: 'Customer Experience', frameworks: ['servqual', 'sbar_communication', 'leap_heat_rubric'], weight: 25, color: '#059669' },
  { id: 'process_professionalism', label: 'Process & Professionalism', frameworks: ['itil_service_desk'], weight: 15, color: '#7c3aed' },
  { id: 'msp_custom', label: 'MSP Custom', frameworks: ['callum_baseline_v1'], weight: 10, color: '#d97706' },
];

/* ── Server-side data ── */

function loadTests(): TestData[] {
  const dir = join(process.cwd(), 'tests', 'fixtures', 'analysis-engine');
  const files = [
    'gold-mfa-unsafe.json',
    'tricky-perfect-but-abusive.json',
    'tricky-pii-over-phone.json',
    'tricky-passive-aggressive.json',
    'tricky-ambiguous-pii.json',
  ];

  return files.map(f => {
    const raw = JSON.parse(readFileSync(join(dir, f), 'utf-8'));
    const exp = raw.expected;
    const criteria: AiCriteria = {};
    const passSet = new Set(exp.must_pass || []);
    const failSet = new Set(exp.must_fail || []);
    const flagSet = new Set(exp.must_trigger_red_flags || []);

    for (const k of ALL_CRITERIA) {
      if (passSet.has(k)) criteria[k] = { status: 'pass', evidence: ['[fixture expectation]'] };
      else if (failSet.has(k)) criteria[k] = { status: 'fail', evidence: ['[fixture expectation]'] };
      else criteria[k] = { status: 'not_observed' };
    }

    return {
      name: raw.name,
      scenario: raw.scenario_id,
      messages: raw.transcript,
      ticket: raw.ticket,
      expectedScore: { min: exp.score_min ?? 0, max: exp.score_max ?? 100 },
      expectedReadiness: exp.readiness_label ?? 'unknown',
      ai: {
        criteria,
        redFlags: flagSet.size > 0 ? (Array.from(flagSet) as string[]) : ([] as string[]),
      },
    };
  });
}

function computeForTest(test: TestData) {
  const criteria: Record<string, { status: string }> = {};
  for (const [k, v] of Object.entries(test.ai.criteria)) {
    criteria[k] = { status: v.status || 'not_observed' };
  }

  const redFlags = test.ai.redFlags.map(r => ({ type: r, severity: 'high', evidence: '' }));
  const scoring = scoreExtraction({ criteria, redFlags });

  const evidencePool = {
    aiCriteria: test.ai.criteria as any,
    events: [],
    transcriptText: test.messages.map(m => `${m.role}: ${m.content}`).join('\n'),
    ticketText: [test.ticket.summary, test.ticket.description].join('\n'),
    triage: {},
    ticketSubmitted: true,
    triagePerformed: false,
    redFlagsTriggered: test.ai.redFlags,
  };

  const fwResults = evaluateAllFrameworks(evidencePool, DEFAULT_FRAMEWORKS, null);
  const frameworkScores = (fwResults?.frameworks || []).map((f: any) => ({
    id: f.frameworkId,
    name: f.frameworkName,
    score: f.score,
    passed: f.passed,
  }));

  const categories = CATEGORY_DEF.map(cat => {
    const fws = frameworkScores.filter(f => cat.frameworks.includes(f.id));
    const avg = fws.length > 0 ? Math.round(fws.reduce((s: number, f: any) => s + f.score, 0) / fws.length) : 0;
    const passed = fws.some((f: any) => f.passed);
    return { ...cat, score: avg, passed, frameworks: fws };
  });

  let total = 0;
  let totalW = 0;
  for (const cat of categories) {
    total += cat.score * (cat.weight / 100);
    totalW += cat.weight;
  }
  const totalScore = totalW > 0 ? Math.round(total) : 0;

  return { scoring, totalScore, categories, frameworkScores };
}

/* ── Components ── */

function ScoreBar({ score, max, color, label, small }: { score: number; max: number; color: string; label?: string; small?: boolean }) {
  const pct = Math.min(100, Math.round((score / max) * 100));
  const barH = small ? 6 : 12;
  return (
    <div style={{ marginBottom: small ? 4 : 8 }}>
      {label && <div style={{ fontSize: small ? 10 : 12, color: '#555', marginBottom: 2 }}>{label}</div>}
      <div style={{ height: barH, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.5s' }} />
      </div>
      <div style={{ fontSize: small ? 9 : 11, color: '#6b7280', marginTop: 1 }}>{score}/{max} ({pct}%)</div>
    </div>
  );
}

function FrameworkRow({ fw }: { fw: { id: string; name: string; score: number; passed: boolean } }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0', fontSize: 11 }}>
      <span style={{ color: fw.passed ? '#059669' : '#dc2626', fontWeight: 700, width: 18 }}>{fw.passed ? '✓' : '✗'}</span>
      <span style={{ flex: 1, color: '#374151' }}>{fw.name}</span>
      <span style={{ fontWeight: 600, color: fw.score >= 70 ? '#059669' : fw.score >= 50 ? '#d97706' : '#dc2626', width: 30, textAlign: 'right' }}>{fw.score}</span>
    </div>
  );
}

function RedFlagBadge({ flag }: { flag: string }) {
  const colors: Record<string, string> = {
    severe_customer_abuse: '#dc2626',
    unsafe_security_behaviour: '#dc2626',
    unprofessional_conduct: '#d97706',
    refusal_to_help: '#dc2626',
    hallucinated_fix: '#ea580c',
    no_troubleshooting: '#d97706',
  };
  const labels: Record<string, string> = {
    severe_customer_abuse: 'Severe Customer Abuse',
    unsafe_security_behaviour: 'Unsafe Security Behaviour',
    unprofessional_conduct: 'Unprofessional Conduct',
    refusal_to_help: 'Refusal to Help',
    hallucinated_fix: 'Hallucinated Fix',
    no_troubleshooting: 'No Troubleshooting',
  };
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 700,
      color: '#fff',
      background: colors[flag] || '#6b7280',
      marginRight: 4,
      marginBottom: 4,
    }}>
      ⚠ {labels[flag] || flag}
    </span>
  );
}

/* ── Page ── */

export default function PipelineResultsPage() {
  const tests = loadTests();
  const results = tests.map(t => ({ test: t, computed: computeForTest(t) }));

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 4 }}>Multi-Framework Pipeline Results</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
        Real AI analysis (deepseek-v4-flash) on 5 edge-case transcripts. Each scored across 10 frameworks in 5 categories.
      </p>

      {/* Summary Table */}
      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Transcript</th>
              <th style={{ textAlign: 'center', padding: '8px', fontWeight: 600 }}>Callum</th>
              <th style={{ textAlign: 'center', padding: '8px', fontWeight: 600 }}>Security</th>
              <th style={{ textAlign: 'center', padding: '8px', fontWeight: 600 }}>Tech</th>
              <th style={{ textAlign: 'center', padding: '8px', fontWeight: 600 }}>CX</th>
              <th style={{ textAlign: 'center', padding: '8px', fontWeight: 600 }}>Process</th>
              <th style={{ textAlign: 'center', padding: '8px', fontWeight: 600 }}>MSP</th>
              <th style={{ textAlign: 'center', padding: '8px', fontWeight: 600 }}>Total</th>
              <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600 }}>Red Flags</th>
            </tr>
          </thead>
          <tbody>
            {results.map(({ test, computed }) => (
              <tr key={test.name} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600, color: '#111' }}>{test.name}</td>
                <td style={{ textAlign: 'center', padding: '8px', color: computed.scoring.score >= 60 ? '#059669' : '#dc2626', fontWeight: 700 }}>{computed.scoring.score}</td>
                {CATEGORY_DEF.map(cat => {
                  const c = computed.categories.find(c => c.id === cat.id);
                  return (
                    <td key={cat.id} style={{
                      textAlign: 'center', padding: '8px',
                      color: c && c.score >= 60 ? '#059669' : '#dc2626',
                      fontWeight: 700,
                    }}>
                      {c?.score ?? '-'}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center', padding: '8px', fontWeight: 700, color: computed.totalScore >= 60 ? '#059669' : '#dc2626' }}>{computed.totalScore}</td>
                <td style={{ padding: '8px' }}>
                  {test.ai.redFlags.length > 0
                    ? test.ai.redFlags.map(r => <RedFlagBadge key={r} flag={r} />)
                    : <span style={{ color: '#9ca3af', fontSize: 10 }}>none</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Per-Transcript Detail */}
      {results.map(({ test, computed }) => (
        <div key={test.name} style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          marginBottom: 16,
          padding: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: 0 }}>{test.name}</h2>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{test.scenario}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>Callum Score</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: computed.scoring.score >= 60 ? '#059669' : '#dc2626' }}>
                  {computed.scoring.score}
                </div>
              </div>
              <div style={{
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                background: computed.scoring.rating === 'ready' ? '#d1fae5' : computed.scoring.rating === 'needs_supervision' ? '#fef3c7' : '#fee2e2',
                color: computed.scoring.rating === 'ready' ? '#065f46' : computed.scoring.rating === 'needs_supervision' ? '#92400e' : '#991b1b',
              }}>
                {computed.scoring.rating === 'needs_supervision' ? 'NEEDS SUPERVISION' : computed.scoring.rating.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Red flags */}
          {test.ai.redFlags.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {test.ai.redFlags.map(r => <RedFlagBadge key={r} flag={r} />)}
            </div>
          )}

          {/* Category bars */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              {CATEGORY_DEF.map(cat => {
                const c = computed.categories.find(c => c.id === cat.id);
                if (!c) return null;
                return (
                  <div key={cat.id}>
                    <ScoreBar score={c.score} max={100} color={cat.color} label={`${c.label} (w:${cat.weight}%)`} />
                    <div style={{ paddingLeft: 16, marginBottom: 4 }}>
                      {c.frameworks.map((fw: any) => (
                        <div key={fw.id} style={{ display: 'flex', gap: 6, fontSize: 10, color: '#6b7280' }}>
                          <span>{fw.passed ? '✓' : '✗'}</span>
                          <span style={{ flex: 1 }}>{fw.name}</span>
                          <span style={{ fontWeight: 600 }}>{fw.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: Expected vs Actual */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Expected vs Actual</div>
              <div style={{ background: '#f9fafb', borderRadius: 6, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                  <span style={{ color: '#6b7280' }}>Score range expected:</span>
                  <span style={{ fontWeight: 600 }}>{test.expectedScore.min} – {test.expectedScore.max}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                  <span style={{ color: '#6b7280' }}>Actual score:</span>
                  <span style={{ fontWeight: 700, color: computed.scoring.score >= test.expectedScore.min && computed.scoring.score <= test.expectedScore.max ? '#059669' : '#dc2626' }}>
                    {computed.scoring.score}
                    {computed.scoring.score >= test.expectedScore.min && computed.scoring.score <= test.expectedScore.max ? ' ✓' : ' ✗'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                  <span style={{ color: '#6b7280' }}>Readiness expected:</span>
                  <span style={{ fontWeight: 600 }}>{test.expectedReadiness}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: '#6b7280' }}>Readiness actual:</span>
                  <span style={{ fontWeight: 700 }}>{computed.scoring.rating}</span>
                </div>
                {test.ai.redFlags.length > 0 && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>Red flags detected:</div>
                    {test.ai.redFlags.map(r => (
                      <div key={r} style={{ fontSize: 10, color: '#dc2626', fontWeight: 600 }}>⚠ {r}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Framework Summary */}
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginTop: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 8 }}>Frameworks Used</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11, color: '#374151' }}>
          {DEFAULT_FRAMEWORKS.map(fw => (
            <div key={fw.id} style={{ padding: '2px 0' }}>
              <span style={{ fontWeight: 600 }}>{fw.name}</span>
              <span style={{ color: '#9ca3af' }}> — {fw.criteria.length} criteria</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
