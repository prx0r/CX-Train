import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { evaluateAllFrameworks } from '@/lib/mvp/compliance/evaluator';
import { DEFAULT_FRAMEWORKS } from '@/lib/mvp/compliance/frameworks';
import { computeScoredAssessment, buildCriteriaFromFrameworks, applyAiEvidence } from '@/lib/mvp/results/scoring-calculator';
import { validateEvidenceGrounding } from '@/lib/mvp/analysis/validation';

const FIXTURES_DIR = join(process.cwd(), 'tests', 'fixtures', 'analysis-engine');
const AI_RESULTS_DIR = join(FIXTURES_DIR, 'ai-results');

const TICKET_FIELDS: Record<string, { label: string; keywords: string[] }> = {
  ticket_user_company: { label: 'User & company identification', keywords: ['user', 'name', 'company', 'requester'] },
  ticket_issue_summary: { label: 'Issue summary', keywords: ['issue', 'problem', 'summary'] },
  ticket_impact: { label: 'Business impact', keywords: ['impact', 'blocked', 'deadline', 'client'] },
  ticket_urgency: { label: 'Urgency/deadline', keywords: ['urgent', 'priority', 'deadline', 'sla'] },
  ticket_checks_attempted: { label: 'Diagnostic checks attempted', keywords: ['checked', 'tried', 'attempted', 'verified', 'tested', 'diagnos'] },
  ticket_next_step: { label: 'Next step / follow-up plan', keywords: ['next step', 'follow up', 'will', 'action', 'pending'] },
};

function analyzeTicket(fx: any, frameworkResults: any[], criteria: any[]): { ticketFindings: string[]; ticketPassed: number; ticketTotal: number } {
  const ticketText = [fx.ticket?.summary || '', fx.ticket?.description || ''].join('\n').toLowerCase();
  const findings: string[] = [];
  let passed = 0, total = 0;

  for (const fw of frameworkResults) {
    for (const c of fw.criteriaResults || []) {
      if (!TICKET_FIELDS[c.criterionId]) continue;
      total++;
      const field = TICKET_FIELDS[c.criterionId];
      const found = field.keywords.some(kw => ticketText.includes(kw));
      if (found) {
        passed++;
      } else {
        const match = fw.criteriaResults.find((cr: any) => cr.criterionId === c.criterionId);
        findings.push(`${field.label}: ${match?.evidence === 'pass' ? 'present' : 'missing'}`);
      }
    }
  }
  return { ticketFindings: findings, ticketPassed: passed, ticketTotal: total };
}

function buildSummary(fx: any, frameworkResults: any[], redFlags: string[], criteria: any[]): { strengths: string[]; misses: string[]; coaching: string[] } {
  const strengths: string[] = [];
  const misses: string[] = [];
  const coaching: string[] = [];

  /* Find top strengths: frameworks with high scores */
  const sorted = [...frameworkResults].sort((a: any, b: any) => {
    const aPass = a.criteriaResults.filter((c: any) => c.status === 'pass').length;
    const bPass = b.criteriaResults.filter((c: any) => c.status === 'pass').length;
    return bPass - aPass;
  });
  for (const fw of sorted.slice(0, 3)) {
    const passCt = fw.criteriaResults.filter((c: any) => c.status === 'pass').length;
    const total = fw.criteriaResults.filter((c: any) => c.status !== 'not_applicable').length;
    if (total > 0 && passCt / total >= 0.7) {
      const passedCriterion = fw.criteriaResults.find((c: any) => c.status === 'pass');
      const label = passedCriterion?.label?.split(' — ')[0] || fw.frameworkName;
      const quote = criteria.find((cr: any) => {
        const match = fw.criteriaResults.find((fc: any) => fc.criterionId === cr.id && fc.status === 'pass');
        return match && cr.evidenceQuote;
      })?.evidenceQuote;
      strengths.push(`${label}: ${passCt}/${total} passed${quote ? ` — "${quote.substring(0, 80)}"` : ''}`);
    }
  }

  /* Find top misses: failed criteria with evidence */
  for (const fw of frameworkResults) {
    const fails = fw.criteriaResults.filter((c: any) => c.status === 'fail');
    for (const f of fails.slice(0, 2)) {
      const critRecord = criteria.find((cr: any) => cr.id === f.criterionId);
      const subcat = f.subcategory || fw.frameworkName;
      const evidence = critRecord?.evidenceQuote || f.evidence || '';
      misses.push(`${subcat}: ${f.label.split(' — ').slice(1).join(' — ') || f.label.split(' — ')[0]}${evidence ? ` (${evidence.substring(0, 60)})` : ''}`);
      coaching.push(`Coach on "${subcat}": ${f.label.split(' — ').slice(-1)[0] || f.label}`);
    }
  }

  /* Add red flag coaching */
  for (const rf of redFlags) {
    const info = RED_FLAG_INFO[rf];
    if (info) {
      misses.push(`⚠ ${info.label}`);
      coaching.push(`Address ${info.label.toLowerCase()} — this is a critical failure that requires immediate coaching.`);
    }
  }

  return { strengths: strengths.slice(0, 5), misses: misses.slice(0, 5), coaching: coaching.slice(0, 5) };
}

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

  const aiCriteria: Record<string, any> = {};
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
          explanation: aiResult.notes || aiResult.explanation || undefined,
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

  /* Populate events from fixture data */
  const events: Array<{ event_type: string; action_id?: string; taxonomy_tags?: string[]; text?: string | null }> = [];
  if (fx.ticket) {
    events.push({ event_type: 'ticket_submitted', text: fx.ticket.summary || 'Ticket submitted' });
    events.push({ event_type: 'ticket_triage_submitted', taxonomy_tags: ['ticket_triage_submitted'], text: 'Triage completed' });
  }
  if (fx.transcript?.some((m: any) => m.content?.toLowerCase().includes('lock') || m.content?.toLowerCase().includes('reset'))) {
    events.push({ event_type: 'red_flag_triggered', action_id: 'red_flag_triggered', text: 'Security action detected' });
  }

  const evidencePool = {
    aiCriteria,
    events,
    transcriptText,
    ticketText,
    triage: {},
    ticketSubmitted: !!fx.ticket,
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

  /* Run evidence grounding validation */
  const validation = useAi && aiData.ai
    ? validateEvidenceGrounding(aiData.ai, { transcriptText, ticketText })
    : { data: null, warnings: [], details: [] };

  /* Analyze ticket content against expected fields */
  const { ticketFindings, ticketPassed, ticketTotal } = analyzeTicket(fx, frameworkResults, criteria);

  /* Build summary insights */
  const summary = buildSummary(fx, frameworkResults, redFlags.map(r => r.type), criteria);

  return {
    fx,
    assessed,
    frameworkResults,
    redFlags: redFlags.map(r => r.type),
    criteria,
    useRealAi: useAi && aiData.ai !== null,
    validationDetails: validation.details,
    validationWarnings: validation.warnings,
    ticketFindings,
    ticketPassed,
    ticketTotal,
    summary,
  };
}

/* ── Page ── */

export default function ResultsPage({ searchParams }: { searchParams: { t?: string } }) {
  const transcript = searchParams.t || 'tricky-passive-aggressive';
  const { fx, assessed, frameworkResults, redFlags, criteria, useRealAi, validationDetails, validationWarnings, ticketFindings, ticketPassed, ticketTotal, summary } = compute(transcript);

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

      {/* SUMMARY INSIGHTS */}
      {summary.strengths.length > 0 || summary.misses.length > 0 ? (
        <div style={{ marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {summary.strengths.length > 0 && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#065f46', marginBottom: 6 }}>✅ Strengths</div>
              {summary.strengths.map((s: string, i: number) => (
                <div key={i} style={{ fontSize: 10, color: '#047857', marginBottom: 3, lineHeight: 1.4 }}>{s}</div>
              ))}
            </div>
          )}
          {summary.misses.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', marginBottom: 6 }}>✗ Biggest Misses</div>
              {summary.misses.map((m: string, i: number) => (
                <div key={i} style={{ fontSize: 10, color: '#b91c1c', marginBottom: 3, lineHeight: 1.4 }}>{m}</div>
              ))}
            </div>
          )}
          {summary.coaching.length > 0 && (
            <div style={{ gridColumn: '1 / -1', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>🎯 Coaching Focus</div>
              {summary.coaching.map((c: string, i: number) => (
                <div key={i} style={{ fontSize: 10, color: '#a16207', marginBottom: 3, lineHeight: 1.4 }}>{c}</div>
              ))}
            </div>
          )}
          {ticketTotal > 0 && (
            <div style={{ gridColumn: '1 / -1', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#075985', marginBottom: 6 }}>🎫 Ticket Quality ({ticketPassed}/{ticketTotal})</div>
              {ticketFindings.length > 0 ? ticketFindings.map((f: string, i: number) => (
                <div key={i} style={{ fontSize: 10, color: '#0369a1', marginBottom: 2, lineHeight: 1.4 }}>{f}</div>
              )) : (
                <div style={{ fontSize: 10, color: '#0369a1' }}>All ticket fields present</div>
              )}
            </div>
          )}
        </div>
      ) : null}

      {/* VALIDATION DETAILS */}
      {useRealAi && validationDetails && validationDetails.length > 0 && (
        <details style={{ marginBottom: 12, background: '#fff8f0', border: '1px solid #fed7aa', borderRadius: 8, fontSize: 11 }}>
          <summary style={{ cursor: 'pointer', padding: '10px 14px', fontWeight: 600, color: '#9a3412' }}>
            🔍 Evidence Validation — {validationWarnings.length} warning{validationWarnings.length !== 1 ? 's' : ''}
            <span style={{ fontWeight: 400, marginLeft: 8, color: '#c2410c' }}>
              ({validationDetails.filter((d: any) => d.severity === 'critical').length} critical, {validationDetails.filter((d: any) => d.severity === 'warning').length} warning, {validationDetails.filter((d: any) => d.severity === 'info').length} info)
            </span>
          </summary>
          <div style={{ padding: '4px 14px 12px' }}>
            {validationDetails.map((d: any, i: number) => {
              const color = d.severity === 'critical' ? '#dc2626' : d.severity === 'warning' ? '#d97706' : '#64748b';
              const icon = d.severity === 'critical' ? '✗' : d.severity === 'warning' ? '⚠' : 'ℹ';
              return (
                <div key={i} style={{ display: 'flex', gap: 6, padding: '3px 0', color }}>
                  <span style={{ flexShrink: 0 }}>{icon}</span>
                  <span>{d.message}</span>
                  {d.criterion && <span style={{ color: '#94a3b8', fontSize: 10 }}>({d.criterion})</span>}
                </div>
              );
            })}
          </div>
        </details>
      )}

      {!useRealAi && (
        <div style={{ marginBottom: 12, padding: '8px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 11, color: '#92400e' }}>
          ⚠️ Using fixture expectations — not real AI extraction. Validation only runs with real AI data.
        </div>
      )}

      {/* FRAMEWORK BREAKDOWN */}
      {(() => {
        /* Build type map for framework lookups */
        const fwTypeMap: Record<string, string> = {};
        for (const fw of DEFAULT_FRAMEWORKS) fwTypeMap[fw.id] = fw.type;
        const isSkills = (id: string) => fwTypeMap[id] === 'skills_framework' || fwTypeMap[id] === 'baseline';
        const isCompliance = (id: string) => fwTypeMap[id] === 'compliance_standard';

        const skillsFrameworks = frameworkResults.filter((fw: any) => isSkills(fw.frameworkId));
        const complianceFrameworks = frameworkResults.filter((fw: any) => isCompliance(fw.frameworkId));

        const renderFramework = (fw: any) => {
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
                      bgColor = '#fafafa'; borderColor = '#e5e7eb';
                      statusDisplay = '–'; statusColor = '#94a3b8'; statusBg = '#f1f5f9';
                    }

                    return (
                      <div key={c.criterionId} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                        padding: '4px 8px', marginBottom: 2, borderRadius: 4,
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
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 1 }}>
                              {evStatus === 'verified' && critRecord?.evidenceQuote && (
                                <span style={{ fontSize: 9, color: '#059669', fontStyle: 'italic', wordBreak: 'break-word' }}>
                                  📝 "{critRecord.evidenceQuote.substring(0, 80)}{critRecord.evidenceQuote.length > 80 ? '...' : ''}"
                                </span>
                              )}
                              {c.explanation && (
                                <span style={{ fontSize: 9, color: '#64748b', wordBreak: 'break-word' }}>
                                  💬 {c.explanation.substring(0, 120)}{c.explanation.length > 120 ? '...' : ''}
                                </span>
                              )}
                            </div>
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
        };

        return (
          <>
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, marginTop: 20 }}>🧰 Skills Assessment</h2>
            {skillsFrameworks.length > 0 ? skillsFrameworks.map(renderFramework) : <p style={{ fontSize: 12, color: '#94a3b8' }}>No skills frameworks assessed for this scenario.</p>}

            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, marginTop: 20 }}>📋 Compliance Standards</h2>
            {complianceFrameworks.length > 0 ? complianceFrameworks.map(renderFramework) : <p style={{ fontSize: 12, color: '#94a3b8' }}>No compliance standards assessed for this scenario.</p>}
          </>
        );
      })()}
    </div>
  );
}
