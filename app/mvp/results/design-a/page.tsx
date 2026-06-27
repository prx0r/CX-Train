import { readFileSync } from 'fs';
import { join } from 'path';
import { scoreExtraction, DEFAULT_WEIGHTS } from '@/lib/mvp/analysis/scoring';
import { evaluateAllFrameworks } from '@/lib/mvp/compliance/evaluator';
import { DEFAULT_FRAMEWORKS } from '@/lib/mvp/compliance/frameworks';
import { computeScoredAssessment, DEFAULT_CATEGORY_DEFS } from '@/lib/mvp/results/scoring-calculator';
import type { ValidationFlags } from '@/lib/mvp/results/scoring-calculator';

const FIXTURES_DIR = join(process.cwd(), 'tests', 'fixtures', 'analysis-engine');
const ALL_W = Object.keys(DEFAULT_WEIGHTS);

const RED_FLAG_INFO: Record<string, { label: string; color: string }> = {
  severe_customer_abuse: { label: 'Severe Customer Abuse', color: '#dc2626' },
  unsafe_security_behaviour: { label: 'Unsafe Security Behaviour', color: '#dc2626' },
  unprofessional_conduct: { label: 'Unprofessional Conduct', color: '#d97706' },
  refusal_to_help: { label: 'Refusal to Help', color: '#dc2626' },
  hallucinated_fix: { label: 'Hallucinated Fix', color: '#ea580c' },
  no_troubleshooting: { label: 'No Troubleshooting', color: '#d97706' },
};

const CAT_COLORS: Record<string, string> = {
  security_compliance: '#dc2626',
  technical_troubleshooting: '#2563eb',
  customer_experience: '#059669',
  process_professionalism: '#7c3aed',
  msp_custom: '#d97706',
};

/* ── Server-side computation ── */

function compute(name: string) {
  const fx = JSON.parse(readFileSync(join(FIXTURES_DIR, `${name}.json`), 'utf-8'));
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

  /* Build the data structure the calculator expects */
  const frameworkResults = (fwResults?.frameworks || []).map((f: any) => ({
    id: f.frameworkId,
    name: f.frameworkName,
    category: f.frameworkId, // not used yet
    score: f.score,
    criteria: (f.criteriaResults || []).map((c: any) => ({
      id: c.criterionId,
      label: c.label,
      status: c.status,
      weight: c.pointsMax || 1,
      evidence: c.evidence ? [c.evidence] : [],
    })),
  }));

  /* Use the transparent calculator */
  const assessed = computeScoredAssessment(frameworkResults, DEFAULT_CATEGORY_DEFS);

  return { fx, scoring, assessed, redFlags: Array.from(flagSet) as string[] };
}

/* ── Sub-components ── */

function Bar({ score, max, color, height = 8 }: { score: number; max: number; color: string; height?: number }) {
  const pct = Math.min(100, Math.round((score / max) * 100));
  return (
    <div style={{ height, background: '#e5e7eb', borderRadius: height, overflow: 'hidden', width: '100%' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: height }} />
    </div>
  );
}

/* ── Page ── */

export default function ResultsPage({ searchParams }: { searchParams: { t?: string } }) {
  const transcript = searchParams.t || 'tricky-passive-aggressive';
  const { fx, scoring, assessed, redFlags } = compute(transcript);

  const transcriptText = fx.transcript.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#111' }}>
      <a href="/mvp/results/design-a/list" style={{ fontSize: 12, color: '#6b7280', textDecoration: 'none', marginBottom: 16, display: 'block' }}>← All transcripts</a>

      {/* ── HEADER ── */}
      <div style={{
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, marginBottom: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#0f172a' }}>
              {fx.name.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
            </h1>
            <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
              {fx.scenario_id} · {new Date().toLocaleDateString()}
            </p>
            {redFlags.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {redFlags.map((r: string) => (
                  <span key={r} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, color: '#fff', background: RED_FLAG_INFO[r]?.color || '#6b7280' }}>
                    ⚠ {RED_FLAG_INFO[r]?.label || r}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>RAW SCORE</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: assessed.totalScore >= 60 ? '#059669' : '#dc2626' }}>{assessed.totalScore}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>VALIDATED</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: assessed.validatedScore >= 60 ? '#059669' : '#dc2626' }}>{assessed.validatedScore}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '4px 12px', borderRadius: 6, background: assessed.validation.confidence >= 80 ? '#d1fae5' : assessed.validation.confidence >= 60 ? '#fef3c7' : '#fee2e2' }}>
              <div style={{ fontSize: 10, color: '#64748b' }}>CONFIDENCE</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: assessed.validation.confidence >= 80 ? '#065f46' : assessed.validation.confidence >= 60 ? '#92400e' : '#991b1b' }}>
                {assessed.validation.confidence}%
              </div>
            </div>
            <div style={{ padding: '4px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: scoring.rating === 'ready' ? '#d1fae5' : scoring.rating === 'needs_supervision' ? '#fef3c7' : '#fee2e2', color: scoring.rating === 'ready' ? '#065f46' : scoring.rating === 'needs_supervision' ? '#92400e' : '#991b1b' }}>
              {scoring.rating.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Validation warnings */}
        {assessed.validation.warnings.length > 0 && (
          <div style={{ marginTop: 12, padding: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>Validation Warnings</div>
            {assessed.validation.warnings.map((w, i) => (
              <div key={i} style={{ fontSize: 10, color: '#b91c1c', marginBottom: 2 }}>⚠ {w}</div>
            ))}
          </div>
        )}
        {assessed.validation.extremeFlags.length > 0 && (
          <div style={{ marginTop: 8, padding: 10, background: '#fefce8', border: '1px solid #fde68a', borderRadius: 6 }}>
            {assessed.validation.extremeFlags.map((f, i) => (
              <div key={i} style={{ fontSize: 10, color: '#92400e' }}>⚠ {f}</div>
            ))}
          </div>
        )}
      </div>

      {/* ── SCORE MATH BREAKDOWN ── */}
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Score Breakdown</h2>
      <p style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>
        Each criterion has a weight. Framework score = (earned / max) × 100. Category = weighted average of its frameworks. Total = weighted average of categories.
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {assessed.categories.map(cat => (
          <div key={cat.id} style={{
            flex: '1 1 150px', minWidth: 140,
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#0f172a' }}>{cat.label}</span>
              <span style={{ fontSize: 11, color: '#64748b' }}>({cat.weight}%)</span>
            </div>
            <Bar score={cat.rawScore} max={100} color={CAT_COLORS[cat.id] || '#6b7280'} height={6} />
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: cat.rawScore >= 70 ? '#059669' : cat.rawScore >= 50 ? '#d97706' : '#dc2626' }}>
              {cat.rawScore}
            </div>
            <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 4 }}>
              contributes {cat.weightedContribution.toFixed(1)} to total
            </div>
          </div>
        ))}
      </div>

      {/* ── DETAILED FRAMEWORK BREAKDOWN ── */}
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Framework Details</h2>
      <div style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
        {assessed.categories.map(cat => (
          <details key={cat.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0 12px' }}>
            <summary style={{ cursor: 'pointer', padding: '10px 0', fontSize: 13, fontWeight: 600, color: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                <span style={{ color: cat.rawScore >= 60 ? '#059669' : '#dc2626', marginRight: 8 }}>{cat.rawScore >= 60 ? '✓' : '✗'}</span>
                {cat.label}
              </span>
              <span style={{ fontSize: 12, color: cat.rawScore >= 60 ? '#059669' : '#dc2626', fontWeight: 700 }}>{cat.rawScore}/100</span>
            </summary>
            <div style={{ padding: '0 0 12px 16px', borderLeft: '2px solid #e2e8f0', marginLeft: 4 }}>
              {cat.frameworks.map(fw => (
                <details key={fw.id} style={{ marginBottom: 6 }}>
                  <summary style={{ cursor: 'pointer', padding: '4px 0', fontSize: 11, color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                      <span style={{ color: fw.rawScore >= 70 ? '#059669' : '#dc2626', fontWeight: 700, marginRight: 4 }}>
                        {fw.rawScore >= 70 ? '✓' : '✗'}
                      </span>
                      {fw.name}
                      <span style={{ color: '#94a3b8', marginLeft: 4 }}>(weight: {fw.weight}% of category)</span>
                    </span>
                    <span style={{ fontWeight: 600, color: fw.rawScore >= 70 ? '#059669' : fw.rawScore >= 50 ? '#d97706' : '#dc2626' }}>
                      {fw.rawScore}/100
                    </span>
                  </summary>
                  <div style={{ padding: '4px 0 2px 12px', fontSize: 10 }}>
                    {/* Math: sum(earned) / sum(max) × 100 */}
                    <div style={{ color: '#94a3b8', marginBottom: 6, fontSize: 9 }}>
                      {fw.criteria.filter((c: any) => c.status !== 'not_applicable').reduce((s: number, c: any) => s + c.earned, 0).toFixed(0)} earned / {fw.criteria.filter((c: any) => c.status !== 'not_applicable').reduce((s: number, c: any) => s + c.maxPossible, 0).toFixed(0)} max = {fw.rawScore}/100
                    </div>
                    {fw.criteria.map(c => (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flex: 1 }}>
                          <span style={{
                            display: 'inline-block', width: 14, height: 14, borderRadius: 3,
                            background: c.status === 'pass' ? '#d1fae5' : c.status === 'fail' ? '#fee2e2' : '#f1f5f9',
                            color: c.status === 'pass' ? '#059669' : c.status === 'fail' ? '#dc2626' : '#94a3b8',
                            fontSize: 9, lineHeight: '14px', textAlign: 'center', fontWeight: 700,
                          }}>
                            {c.status === 'pass' ? '✓' : c.status === 'fail' ? '✗' : '–'}
                          </span>
                          <span style={{ color: '#334155' }}>{c.label}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ color: '#94a3b8', fontSize: 9 }}>
                            ×{c.multiplier.toFixed(1)} of {c.weight}pts
                          </span>
                          <span style={{
                            fontWeight: 600, fontSize: 11, width: 24, textAlign: 'right',
                            color: c.status === 'pass' ? '#059669' : c.status === 'fail' ? '#dc2626' : '#94a3b8',
                          }}>
                            {c.status === 'not_applicable' ? '—' : c.earned.toFixed(0)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </details>
        ))}
      </div>

      {/* ── VALIDATION PASS DETAIL ── */}
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Validation Pass</h2>
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          {([
            { label: 'Relevance Ratio', value: `${assessed.validation.relevanceRatio}%`, desc: '% of criteria that were applicable', good: assessed.validation.relevanceRatio >= 50 },
            { label: 'Un-evidenced Passes', value: String(assessed.validation.lowEvidenceCount), desc: 'pass criteria missing evidence quotes', good: assessed.validation.lowEvidenceCount === 0 },
            { label: 'Category Balance', value: `σ=${assessed.validation.categoryImbalance}`, desc: 'standard deviation across categories', good: assessed.validation.categoryImbalance < 30 },
          ] as const).map(v => (
            <div key={v.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 10 }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>{v.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: v.good ? '#059669' : '#d97706' }}>{v.value}</div>
              <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>{v.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: 10, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Confidence Calculation</div>
          <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.6 }}>
            Base confidence: 100%<br />
            {assessed.validation.lowEvidenceCount > 0 && <>− {assessed.validation.lowEvidenceCount} un-evidenced passes × 5% = −{assessed.validation.lowEvidenceCount * 5}%<br /></>}
            {assessed.validation.categoryImbalance > 20 && <>− ({assessed.validation.categoryImbalance} imbalance − 20) × 2% = −{(assessed.validation.categoryImbalance - 20) * 2}%<br /></>}
            {assessed.validation.relevanceRatio < 60 && <>− (60 − {assessed.validation.relevanceRatio}%) × 1% = −{60 - assessed.validation.relevanceRatio}%<br /></>}
            <strong>Final confidence: {assessed.validation.confidence}%</strong><br />
            {assessed.validation.confidence >= 80
              ? '✓ High confidence — validated score matches raw score'
              : `⚠ Lower confidence — validated score adjusted toward 50 (${assessed.totalScore} → ${assessed.validatedScore})`}
          </div>
        </div>
      </div>

      {/* ── TRANSCRIPT ── */}
      <details>
        <summary style={{ fontSize: 12, color: '#64748b', cursor: 'pointer', fontWeight: 600, padding: '8px 0' }}>
          View Transcript ({fx.transcript.length} messages)
        </summary>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 12, marginTop: 4, fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: '#334155' }}>
          {transcriptText}
        </div>
      </details>
    </div>
  );
}
