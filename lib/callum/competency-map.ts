/**
 * Lightweight bridge between Callum Action metadata and existing competencies.
 *
 * Maps detected weaknesses from ticket-assist queries to the 14 support-workflow
 * competencies so the dashboard can recommend targeted training.
 */

export interface WeaknessSignal {
  competency_id: string;
  reason: string;
  severity: 'high' | 'medium' | 'low';
}

export type CallumMetadata = {
  missing_information?: string[];
  unsupported_or_inferred_claims?: string[];
  recommended_action?: string;
  confidence?: string;
  flag_type?: string;
  detected_topic?: string;
  recommended_owner?: string;
  sla_priority?: string;
};

/**
 * Map a single Callum answer's metadata to competency weaknesses.
 */
export function mapAnswerToCompetencies(meta: CallumMetadata): WeaknessSignal[] {
  const signals: WeaknessSignal[] = [];

  /* Missing information → diagnosis competencies */
  for (const mi of meta.missing_information || []) {
    const m = mi.toLowerCase();
    if (/impact|business|urgency|deadline|workaround/.test(m)) {
      signals.push({ competency_id: 'impact-discovery', reason: `Missing: ${mi}`, severity: 'medium' });
    }
    if (/scope|user.*multiple|one.*many/.test(m)) {
      signals.push({ competency_id: 'scope-discovery', reason: `Missing: ${mi}`, severity: 'medium' });
    }
    if (/error|screenshot|message|code/.test(m)) {
      signals.push({ competency_id: 'evidence-gathering', reason: `Missing: ${mi}`, severity: 'medium' });
    }
    if (/device|hostname|system/.test(m)) {
      signals.push({ competency_id: 'evidence-gathering', reason: `Missing: ${mi}`, severity: 'low' });
    }
    if (/when|started|time|began|timeline/.test(m)) {
      signals.push({ competency_id: 'evidence-gathering', reason: `Missing: ${mi}`, severity: 'low' });
    }
    if (/workaround/.test(m)) {
      signals.push({ competency_id: 'hypothesis-testing', reason: `Missing: ${mi}`, severity: 'medium' });
    }
  }

  /* Unsupported/inferred claims → evidence-gathering / hypothesis-testing */
  for (const claim of meta.unsupported_or_inferred_claims || []) {
    const c = claim.toLowerCase();
    if (/no.*matching.*taxonomy/.test(c) || /general.*msp.*reasoning/.test(c)) {
      signals.push({ competency_id: 'evidence-gathering', reason: `Unsupported claim: ${claim}`, severity: 'high' });
    }
    if (/inference|guessing|assumed/.test(c)) {
      signals.push({ competency_id: 'hypothesis-testing', reason: `Inference used: ${claim}`, severity: 'medium' });
    }
    if (/sensitive.*content/.test(c)) {
      signals.push({ competency_id: 'evidence-gathering', reason: `Sensitivity warning: ${claim}`, severity: 'high' });
    }
  }

  /* Flagged escalation → escalation-quality */
  if (meta.flag_type === 'wrong_escalation') {
    signals.push({ competency_id: 'escalation-quality', reason: 'Flagged: wrong escalation recommendation', severity: 'high' });
  }

  /* Manager review needed → escalation-quality + call-control */
  if (meta.recommended_action === 'manager_review') {
    signals.push({ competency_id: 'escalation-quality', reason: 'Manager review needed — uncertainty about next step', severity: 'medium' });
    signals.push({ competency_id: 'call-control', reason: 'Could not determine clear ownership or action', severity: 'low' });
  }

  /* Low confidence answers → general weakness */
  if (meta.confidence === 'low') {
    signals.push({ competency_id: 'evidence-gathering', reason: 'Low confidence answer — insufficient evidence to classify', severity: 'medium' });
  }

  /* SLA priority issues */
  if (meta.sla_priority && meta.flag_type === 'wrong_classification') {
    signals.push({ competency_id: 'priority-triage', reason: `SLA priority questioned: ${meta.sla_priority}`, severity: 'medium' });
  }

  return signals;
}

/**
 * Aggregate signals from multiple answers into training recommendations.
 */
export function aggregateCompetencyWeaknesses(
  allSignals: WeaknessSignal[][],
): Array<{ competency_id: string; count: number; reasons: string[]; avg_severity: string }> {
  const grouped: Record<string, { count: number; reasons: string[]; severities: number[] }> = {};

  const severityScore = { high: 3, medium: 2, low: 1 };

  for (const answerSignals of allSignals) {
    for (const s of answerSignals) {
      if (!grouped[s.competency_id]) {
        grouped[s.competency_id] = { count: 0, reasons: [], severities: [] };
      }
      grouped[s.competency_id].count++;
      if (!grouped[s.competency_id].reasons.includes(s.reason)) {
        grouped[s.competency_id].reasons.push(s.reason);
      }
      grouped[s.competency_id].severities.push(severityScore[s.severity]);
    }
  }

  return Object.entries(grouped)
    .map(([competency_id, g]) => {
      const avg = g.severities.reduce((a, b) => a + b, 0) / g.severities.length;
      const avgSeverity = avg >= 2.5 ? 'high' : avg >= 1.5 ? 'medium' : 'low';
      return { competency_id, count: g.count, reasons: g.reasons.slice(0, 3), avg_severity: avgSeverity };
    })
    .sort((a, b) => b.count - a.count);
}

/**
 * Get human-readable competency info.
 */
export const COMPETENCY_LABELS: Record<string, { name: string; category: string; suggestedPacks: string[] }> = {
  'call-control': { name: 'Call Control', category: 'call_handling', suggestedPacks: ['Outlook', 'VPN triage'] },
  'customer-empathy': { name: 'Customer Empathy', category: 'call_handling', suggestedPacks: ['Printer down', 'Phishing'] },
  'plain-english': { name: 'Plain English', category: 'call_handling', suggestedPacks: ['New starter', 'Shared mailbox'] },
  'active-listening': { name: 'Active Listening', category: 'call_handling', suggestedPacks: ['All packs'] },
  'impact-discovery': { name: 'Impact Discovery', category: 'diagnosis', suggestedPacks: ['Outlook', 'VPN', 'Password reset'] },
  'scope-discovery': { name: 'Scope Discovery', category: 'diagnosis', suggestedPacks: ['Printer', 'VPN'] },
  'evidence-gathering': { name: 'Evidence Gathering', category: 'diagnosis', suggestedPacks: ['All packs'] },
  'hypothesis-testing': { name: 'Hypothesis Testing', category: 'diagnosis', suggestedPacks: ['Outlook work offline', 'VPN'] },
  'remote-session': { name: 'Remote Session', category: 'diagnosis', suggestedPacks: ['Outlook work offline'] },
  'ticket-documentation': { name: 'Ticket Documentation', category: 'process', suggestedPacks: ['All packs'] },
  'priority-triage': { name: 'Priority Triage', category: 'process', suggestedPacks: ['SLA scenarios', 'Outlook', 'VPN'] },
  'escalation-quality': { name: 'Escalation Quality', category: 'process', suggestedPacks: ['Phishing', 'Printer', 'Password reset'] },
  'fix-verification': { name: 'Fix Verification', category: 'process', suggestedPacks: ['Printer', 'Password reset'] },
  'next-step-setting': { name: 'Next Step Setting', category: 'process', suggestedPacks: ['All packs'] },
};
