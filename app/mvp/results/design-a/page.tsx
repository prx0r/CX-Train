import { readFileSync } from 'fs';
import { join } from 'path';
import { evaluateAllFrameworks } from '@/lib/mvp/compliance/evaluator';
import { DEFAULT_FRAMEWORKS } from '@/lib/mvp/compliance/frameworks';
import { computeScoredAssessment, buildCriteriaFromFrameworks } from '@/lib/mvp/results/scoring-calculator';

const FIXTURES_DIR = join(process.cwd(), 'tests', 'fixtures', 'analysis-engine');

const RED_FLAG_INFO: Record<string, { label: string; color: string }> = {
  severe_customer_abuse: { label: 'Severe Customer Abuse', color: '#dc2626' },
  unsafe_security_behaviour: { label: 'Unsafe Security Behaviour', color: '#dc2626' },
  unprofessional_conduct: { label: 'Unprofessional Conduct', color: '#d97706' },
  refusal_to_help: { label: 'Refusal to Help', color: '#dc2626' },
  hallucinated_fix: { label: 'Hallucinated Fix', color: '#ea580c' },
  no_troubleshooting: { label: 'No Troubleshooting', color: '#d97706' },
};

function compute(name: string) {
  const fx = JSON.parse(readFileSync(join(FIXTURES_DIR, `${name}.json`), 'utf-8'));
  const exp = fx.expected;
  const passSet = new Set(exp.must_pass || []);
  const failSet = new Set(exp.must_fail || []);
  const flagSet = new Set(exp.must_trigger_red_flags || []);
  const transcriptText = fx.transcript.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  const ticketText = [fx.ticket.summary, fx.ticket.description].join('\n');

  /* Build evidence pool from fixture expectations */
  const allCriteria: Record<string, { status: string }> = {};
  const allIds = new Set<string>();
  for (const fw of DEFAULT_FRAMEWORKS) {
    for (const c of fw.criteria) allIds.add(c.id);
  }
  for (const k of allIds) {
    if (passSet.has(k)) allCriteria[k] = { status: 'pass' };
    else if (failSet.has(k)) allCriteria[k] = { status: 'fail' };
    else allCriteria[k] = { status: 'not_observed' };
  }

  const evidencePool = {
    aiCriteria: allCriteria as any,
    events: [],
    transcriptText,
    ticketText,
    triage: {},
    ticketSubmitted: true,
    triagePerformed: false,
    redFlagsTriggered: Array.from(flagSet) as string[],
  };

  const fwResults = evaluateAllFrameworks(evidencePool, DEFAULT_FRAMEWORKS, null);
  const frameworkResults = (fwResults?.frameworks || []).map((f: any) => ({
    frameworkId: f.frameworkId,
    frameworkName: f.frameworkName,
    criteriaResults: (f.criteriaResults || []).map((c: any) => ({
      criterionId: c.criterionId,
      label: c.label,
      status: c.status,
      evidence: c.evidence,
      pointsEarned: c.pointsEarned,
      pointsMax: c.pointsMax,
    })),
  }));

  const criteria = buildCriteriaFromFrameworks(frameworkResults);
  const assessed = computeScoredAssessment(criteria);

  return { fx, assessed, frameworkResults, redFlags: Array.from(flagSet) as string[] };
}

export default function ResultsPage({ searchParams }: { searchParams: { t?: string } }) {
  const transcript = searchParams.t || 'tricky-passive-aggressive';
  const { fx, assessed, frameworkResults, redFlags } = compute(transcript);

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#0f172a' }}>
      <a href="/mvp/results/design-a/list" style={{ fontSize: 12, color: '#64748b', textDecoration: 'none', marginBottom: 16, display: 'block' }}>← All transcripts</a>

      {/* HEADER */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{fx.name.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</h1>
            <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>{fx.scenario_id} · {new Date().toLocaleDateString()}</p>
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>RAW</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: assessed.rawScore >= 60 ? '#059669' : '#dc2626' }}>{assessed.rawScore}</div>
            </div>
            {assessed.findings.length > 0 && (
              <>
                <div style={{ width: 1, height: 40, background: '#e2e8f0' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>VALIDATED</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: assessed.validatedScore >= 60 ? '#059669' : '#dc2626' }}>
                    {assessed.validatedScore}
                    {assessed.rawScore !== assessed.validatedScore && (
                      <span style={{ fontSize: 11, color: '#f59e0b', marginLeft: 4 }}>(−{assessed.rawScore - assessed.validatedScore})</span>
                    )}
                  </div>
                </div>
              </>
            )}
            {assessed.validatedScore < assessed.rawScore && (
              <div style={{ padding: '4px 10px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, fontSize: 10, color: '#92400e', maxWidth: 180 }}>
                {assessed.findings.length} criteria flagged — {assessed.pointsAtRisk}pts at risk. Validated score is raw minus flagged contributions.
              </div>
            )}
            <div style={{
              padding: '4px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700,
              background: assessed.validatedScore >= 70 ? '#d1fae5' : assessed.validatedScore >= 50 ? '#fef3c7' : '#fee2e2',
              color: assessed.validatedScore >= 70 ? '#065f46' : assessed.validatedScore >= 50 ? '#92400e' : '#991b1b',
            }}>
              {assessed.validatedScore >= 70 ? 'READY' : assessed.validatedScore >= 50 ? 'BORDERLINE' : 'NOT READY'}
            </div>
          </div>
        </div>

        {redFlags.length > 0 && (
          <div style={{ marginBottom: 12, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {redFlags.map((r: string) => (
              <span key={r} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, color: '#fff', background: RED_FLAG_INFO[r]?.color || '#6b7280' }}>
                ⚠ {RED_FLAG_INFO[r]?.label || r}
              </span>
            ))}
          </div>
        )}

        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
          {assessed.validatedScore >= 70
            ? `Candidate scored ${assessed.rawScore} (${assessed.validatedScore} validated). Ready for independent work.`
            : assessed.validatedScore >= 50
              ? `Candidate scored ${assessed.rawScore} (${assessed.validatedScore} validated). Borderline — needs supervision on specific areas.`
              : `Candidate scored ${assessed.rawScore} (${assessed.validatedScore} validated). Not ready for independent work.`}
          {' '}{assessed.applicableCriteria} criteria were applicable across {frameworkResults.length} frameworks.
        </div>

        {/* Validation Findings */}
        {assessed.findings.length > 0 && (
          <div style={{ marginTop: 12, padding: 12, background: '#fefce8', border: '1px solid #fde68a', borderRadius: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>
              {assessed.findings.length} Criteria Flagged — Scores May Be Overstated
            </div>
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>
              These criteria were marked as pass or fail but have no supporting evidence quotes. The validated score excludes their contribution.
            </div>
            {assessed.findings.map(f => (
              <div key={f.criterionId} style={{ fontSize: 11, padding: '4px 8px', background: '#fff', border: '1px solid #fde68a', borderRadius: 4, marginBottom: 4 }}>
                <strong style={{ color: '#92400e' }}>{f.label}</strong>
                <span style={{ color: '#64748b' }}> ({f.frameworkName})</span>
                <span style={{ color: '#92400e' }}> — {f.reason}</span>
                <span style={{ color: '#64748b', fontSize: 10, marginLeft: 4 }}>({f.pointsAtRisk}pts at risk)</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FRAMEWORK BREAKDOWN */}
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Framework Breakdown</h2>

      {frameworkResults.map((fw: any) => {
        const totalPoints = fw.criteriaResults.reduce((s: number, c: any) => s + (c.status === 'not_applicable' ? 0 : c.pointsMax), 0);
        const earnedPoints = fw.criteriaResults.reduce((s: number, c: any) => s + (c.status === 'not_applicable' ? 0 : c.pointsEarned), 0);
        const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

        return (
          <details key={fw.frameworkId} style={{ marginBottom: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <summary style={{ cursor: 'pointer', padding: '12px 16px', fontSize: 13, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                <span style={{ color: score >= 70 ? '#059669' : '#dc2626', marginRight: 8 }}>{score >= 70 ? '✓' : '✗'}</span>
                {fw.frameworkName}
                <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 8, fontWeight: 400 }}>
                  {earnedPoints}/{totalPoints}pts
                </span>
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: score >= 70 ? '#059669' : score >= 50 ? '#d97706' : '#dc2626' }}>{score}%</span>
            </summary>
            <div style={{ padding: '4px 16px 12px', fontSize: 11 }}>
              {fw.criteriaResults.map((c: any) => {
                const finding = assessed.findings.find(f => f.criterionId === c.criterionId);
                const isFlagged = !!finding;

                return (
                  <div key={c.criterionId} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 8px', marginBottom: 2, borderRadius: 4,
                    background: isFlagged ? '#fffbeb' : 'transparent',
                    border: isFlagged ? '1px solid #fde68a' : '1px solid transparent',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 18, height: 18, borderRadius: 4, fontSize: 10, fontWeight: 700,
                        background: c.status === 'pass' ? '#d1fae5' : c.status === 'fail' ? '#fee2e2' : '#f1f5f9',
                        color: c.status === 'pass' ? '#059669' : c.status === 'fail' ? '#dc2626' : '#94a3b8',
                      }}>
                        {c.status === 'pass' ? '✓' : c.status === 'fail' ? '✗' : '–'}
                      </span>
                      <div>
                        <span style={{ color: '#1e293b' }}>{c.label}</span>
                        {finding && (
                          <div style={{ fontSize: 9, color: '#d97706', marginTop: 1 }}>⚠ {finding.reason}</div>
                        )}
                      </div>
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 9, whiteSpace: 'nowrap' }}>
                      {c.status} · {c.pointsEarned}/{c.pointsMax}
                      {isFlagged && <span style={{ color: '#d97706', fontWeight: 600, marginLeft: 4 }}>FLAGGED</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}
