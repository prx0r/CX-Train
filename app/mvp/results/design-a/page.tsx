import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { evaluateAllFrameworks } from '@/lib/mvp/compliance/evaluator';
import { DEFAULT_FRAMEWORKS } from '@/lib/mvp/compliance/frameworks';
import { computeScoredAssessment, buildCriteriaFromFrameworks, applyAiEvidence } from '@/lib/mvp/results/scoring-calculator';

const FIXTURES_DIR = join(process.cwd(), 'tests', 'fixtures', 'analysis-engine');
const AI_RESULTS_DIR = join(FIXTURES_DIR, 'ai-results');

const RED_FLAG_INFO: Record<string, { label: string; color: string }> = {
  severe_customer_abuse: { label: 'Severe Customer Abuse', color: '#dc2626' },
  unsafe_security_behaviour: { label: 'Unsafe Security Behaviour', color: '#dc2626' },
  unprofessional_conduct: { label: 'Unprofessional Conduct', color: '#d97706' },
  refusal_to_help: { label: 'Refusal to Help', color: '#dc2626' },
  hallucinated_fix: { label: 'Hallucinated Fix', color: '#ea580c' },
  no_troubleshooting: { label: 'No Troubleshooting', color: '#d97706' },
};

/* ── Compute using REAL AI results ── */

function compute(name: string) {
  /* Load AI result (falls back to fixture if AI result not available) */
  const aiPath = join(AI_RESULTS_DIR, `${name}.json`);
  const useAi = existsSync(aiPath);
  const aiData = useAi ? JSON.parse(readFileSync(aiPath, 'utf-8')) : null;

  const fixturePath = join(FIXTURES_DIR, `${name}.json`);
  const fx = JSON.parse(readFileSync(fixturePath, 'utf-8'));

  const transcriptText = fx.transcript.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  const ticketText = [fx.ticket.summary, fx.ticket.description].join('\n');

  /* Build evidence pool from AI results or fallback to fixture expectations */
  const allIds = new Set<string>();
  for (const fw of DEFAULT_FRAMEWORKS) for (const c of fw.criteria) allIds.add(c.id);

  const aiCriteria: Record<string, { status: string; evidence?: string[] }> = {};
  const redFlags: Array<{ type: string; severity?: string; evidence?: string }> = [];
  let flagSet = new Set<string>();

  if (useAi && aiData.ai) {
    /* Use real AI output */
    for (const k of allIds) {
      const aiResult = aiData.ai.criteria?.[k];
      if (aiResult) {
        aiCriteria[k] = {
          status: aiResult.status || 'not_observed',
          evidence: aiResult.evidence || [],
        };
      } else {
        aiCriteria[k] = { status: 'not_observed' };
      }
    }
    for (const rf of (aiData.ai.red_flags || [])) {
      redFlags.push({ type: rf.type, severity: rf.severity || 'medium', evidence: rf.evidence || '' });
      flagSet.add(rf.type);
    }
  } else {
    /* Fallback to fixture expectations */
    const passSet = new Set(fx.expected.must_pass || []);
    const failSet = new Set(fx.expected.must_fail || []);
    flagSet = new Set(fx.expected.must_trigger_red_flags || []);
    for (const k of allIds) {
      if (passSet.has(k)) aiCriteria[k] = { status: 'pass', evidence: [] };
      else if (failSet.has(k)) aiCriteria[k] = { status: 'fail', evidence: [] };
      else aiCriteria[k] = { status: 'not_observed' };
    }
    for (const rf of flagSet) redFlags.push({ type: rf, severity: 'high', evidence: '' });
  }

  const evidencePool = {
    aiCriteria,
    events: [],
    transcriptText,
    ticketText,
    triage: {},
    ticketSubmitted: true,
    triagePerformed: false,
    redFlagsTriggered: Array.from(flagSet),
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

  /* Override evidence with AI-provided quotes (handles shared checkTargets) */
  if (useAi && aiData.ai) {
    applyAiEvidence(criteria, aiData.ai.criteria || {});
  }

  const assessed = computeScoredAssessment(criteria, transcriptText);

  return {
    fx,
    assessed,
    frameworkResults,
    redFlags: redFlags.map(r => r.type),
    criteria,
    useRealAi: useAi && aiData.ai !== null,
  };
}

/* ── Page ── */

export default function ResultsPage({ searchParams }: { searchParams: { t?: string } }) {
  const transcript = searchParams.t || 'tricky-passive-aggressive';
  const { fx, assessed, frameworkResults, redFlags, criteria, useRealAi } = compute(transcript);

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#0f172a' }}>
      <a href="/mvp/results/design-a/list" style={{ fontSize: 12, color: '#64748b', textDecoration: 'none', marginBottom: 16, display: 'block' }}>← All transcripts</a>

      {/* HEADER */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
              {fx.name.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
            </h1>
            <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
              {fx.scenario_id} · {new Date().toLocaleDateString()}
              {useRealAi && <span style={{ color: '#059669', marginLeft: 8 }}>· Real AI analysis</span>}
              {!useRealAi && <span style={{ color: '#d97706', marginLeft: 8 }}>· Fixture data (no AI)</span>}
            </p>
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
              ? `Candidate scored ${assessed.rawScore} (${assessed.validatedScore} validated). Borderline — needs supervision.`
              : `Candidate scored ${assessed.rawScore} (${assessed.validatedScore} validated). Not ready for independent work.`}
          {' '}{assessed.applicableCriteria} criteria across {frameworkResults.length} frameworks.
          <span style={{ color: '#64748b', marginLeft: 4 }}>
            · {assessed.verifiedCount} verified · {assessed.invalidatedCount} irrelevant · {assessed.applicableCriteria - assessed.verifiedCount - assessed.invalidatedCount} not observed
            · <span style={{ color: assessed.evidenceQuality >= 80 ? '#059669' : assessed.evidenceQuality >= 50 ? '#d97706' : '#dc2626', fontWeight: 600 }}>
                evidence quality {assessed.evidenceQuality}%
              </span>
          </span>
        </div>
      </div>

      {/* FRAMEWORK BREAKDOWN */}
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Framework Breakdown</h2>

      {frameworkResults.map((fw: any) => {
        const fwCriteria = fw.criteriaResults.filter((c: any) => c.status !== 'not_applicable');
        const total = fwCriteria.length;
        const passed = fwCriteria.filter((c: any) => c.status === 'pass').length;
        const invalidated = fwCriteria.filter((c: any) => {
          const cr = criteria.find(cr => cr.id === c.criterionId);
          return cr?.evidenceStatus === 'invalidated';
        }).length;
        const relevant = total - invalidated;
        const relevantPassed = Math.min(passed, relevant);
        const score = relevant > 0 ? Math.round((relevantPassed / relevant) * 100) : 0;

        /* Group criteria by subcategory */
        const groups = new Map<string, { label: string; criteria: any[] }>();
        for (const c of fwCriteria) {
          const key = c.subcategory || 'General';
          if (!groups.has(key)) groups.set(key, { label: key, criteria: [] });
          groups.get(key)!.criteria.push(c);
        }

        return (
          <details key={fw.frameworkId} style={{ marginBottom: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <summary style={{ cursor: 'pointer', padding: '12px 16px', fontSize: 13, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                <span style={{ color: score >= 70 ? '#059669' : '#dc2626', marginRight: 8 }}>{score >= 70 ? '✓' : '✗'}</span>
                {fw.frameworkName}
                <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 6, fontWeight: 400 }}>
                  {' '}{groups.size} areas · {passed}/{total}
                </span>
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: score >= 70 ? '#059669' : score >= 50 ? '#d97706' : '#dc2626' }}>{score}%</span>
            </summary>
            <div style={{ padding: '4px 16px 12px', fontSize: 11 }}>
              {(() => {
                const renderCriterion = (c: any) => {
                  const critRecord = criteria.find(cr => cr.id === c.criterionId);
                  const evStatus = critRecord?.evidenceStatus;
                  let bgColor = 'transparent', borderColor = 'transparent';
                  let statusDisplay: string, statusColor: string, statusBg: string;

                  if (evStatus === 'verified' && c.status === 'pass') {
                    bgColor = '#f0fdf4'; borderColor = '#bbf7d0';
                    statusDisplay = '1'; statusColor = '#059669'; statusBg = '#d1fae5';
                  } else if (evStatus === 'verified' && c.status === 'fail') {
                    bgColor = '#fef2f2'; borderColor = '#fecaca';
                    statusDisplay = '0'; statusColor = '#dc2626'; statusBg = '#fee2e2';
                  } else {
                    statusDisplay = '–'; statusColor = '#94a3b8'; statusBg = '#f1f5f9';
                  }

                  return (
                    <div key={c.criterionId} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                      padding: '4px 8px', marginBottom: 1, borderRadius: 4,
                      background: bgColor, border: `1px solid ${borderColor}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flex: 1, minWidth: 0 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 18, height: 18, borderRadius: 3, fontSize: 10, fontWeight: 700,
                          flexShrink: 0, marginTop: 1, background: statusBg, color: statusColor,
                        }}>{statusDisplay}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: '#1e293b', fontSize: 11 }}>{c.label.split(' — ').slice(1).join(' — ') || c.label}</div>
                          {critRecord?.description && (
                            <div style={{ fontSize: 9, color: '#64748b', marginTop: 1, lineHeight: 1.2 }}>
                              {critRecord.description}
                            </div>
                          )}
                          {evStatus === 'verified' && critRecord?.evidenceQuote && (
                            <div style={{ fontSize: 9, color: '#059669', marginTop: 1, fontStyle: 'italic', wordBreak: 'break-word' }}>
                              "{critRecord.evidenceQuote.substring(0, 80)}{critRecord.evidenceQuote.length > 80 ? '...' : ''}"
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                };

                const groupEntries = Array.from(groups.entries());
                return groupEntries.map(([groupKey, group]) => {
                  const groupTotal = group.criteria.length;
                  const groupPassed = group.criteria.filter(c => c.status === 'pass').length;
                  return (
                    <details key={groupKey} style={{ marginBottom: 4 }} open>
                      <summary style={{ cursor: 'pointer', padding: '6px 8px', borderRadius: 4, background: '#f8fafc', fontSize: 11, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{groupKey}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: groupPassed === groupTotal ? '#059669' : groupPassed > 0 ? '#d97706' : '#dc2626' }}>
                          {groupPassed}/{groupTotal}
                        </span>
                      </summary>
                      <div style={{ padding: '4px 0 4px 12px' }}>
                        {group.criteria.map(renderCriterion)}
                      </div>
                    </details>
                  );
                });
              })()}
            </div>
          </details>
        );
      })}
    </div>
  );
}
