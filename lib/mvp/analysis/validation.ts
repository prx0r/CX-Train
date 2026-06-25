export function parseExtractionJson(raw: string): { data: any | null; error: string | null; warnings: string[] } {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { data: null, error: 'Invalid JSON from evidence extraction model', warnings: [] };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { data: null, error: 'Evidence extraction response is not an object', warnings: [] };
  }

  const warnings: string[] = [];

  if (!parsed.criteria || typeof parsed.criteria !== 'object') {
    return { data: null, error: 'Evidence extraction missing criteria object', warnings: [] };
  }

  const validStatuses = new Set(['pass', 'partial', 'fail', 'not_applicable', 'not_observed']);

  for (const [key, criterion] of Object.entries(parsed.criteria)) {
    const c = criterion as any;
    if (!c || typeof c !== 'object') {
      warnings.push(`Criterion "${key}" is not a valid object, marking as not_observed`);
      parsed.criteria[key] = { status: 'not_observed', severity: 'low', evidence: [], notes: '' };
      continue;
    }
    if (!c.status || !validStatuses.has(c.status)) {
      warnings.push(`Criterion "${key}" has invalid status "${c.status}", marking as not_observed`);
      c.status = 'not_observed';
    }
    if (!c.evidence || !Array.isArray(c.evidence)) {
      c.evidence = [];
    }
    if (!c.notes) {
      c.notes = '';
    }
    if (!c.severity) {
      c.severity = 'low';
    }
  }

  if (!parsed.missed_questions || !Array.isArray(parsed.missed_questions)) {
    parsed.missed_questions = [];
  }

  if (!parsed.red_flags || !Array.isArray(parsed.red_flags)) {
    parsed.red_flags = [];
  }

  if (!parsed.ticket_assessment || typeof parsed.ticket_assessment !== 'object') {
    parsed.ticket_assessment = { status: 'not_observed', missing_fields: [], evidence: '' };
  }

  return { data: parsed, error: null, warnings };
}

export function validateEvidenceGrounding(
  extraction: any,
  sources: { transcriptText?: string | null; ticketText?: string | null },
): { data: any; warnings: string[]; details: Array<{ severity: 'info' | 'warning' | 'critical'; source: 'transcript' | 'ticket' | 'analysis'; code: string; criterion?: string; message: string }> } {
  const warnings: string[] = [];
  const details: Array<{ severity: 'info' | 'warning' | 'critical'; source: 'transcript' | 'ticket' | 'analysis'; code: string; criterion?: string; message: string }> = [];
  const sourceText = normalizeForGrounding([
    sources.transcriptText || '',
    sources.ticketText || '',
  ].join('\n'));

  if (!extraction || typeof extraction !== 'object') {
    const message = 'Evidence grounding skipped: extraction is not an object';
    details.push({ severity: 'critical', source: 'analysis', code: 'invalid_extraction', message });
    return { data: extraction, warnings: [message], details };
  }

  if (!sourceText) {
    const message = 'Evidence grounding skipped: no transcript or ticket text available';
    details.push({ severity: 'critical', source: 'analysis', code: 'missing_sources', message });
    return { data: extraction, warnings: [message], details };
  }

  if (extraction.criteria && typeof extraction.criteria === 'object') {
    for (const [key, criterion] of Object.entries(extraction.criteria)) {
      const c = criterion as any;
      if (!c || typeof c !== 'object') continue;

      const evidence = Array.isArray(c.evidence) ? c.evidence : [];
      const groundedEvidence = evidence.filter((quote: unknown) => {
        if (typeof quote !== 'string' || quote.trim().length === 0) return false;
        return isGroundedQuote(quote, sourceText);
      });

      if (groundedEvidence.length !== evidence.length) {
        const message = `Criterion "${key}" had ${evidence.length - groundedEvidence.length} ungrounded evidence quote(s) removed`;
        warnings.push(message);
        details.push({ severity: 'warning', source: 'transcript', code: 'removed_quote', criterion: key, message });
      }

      c.evidence = groundedEvidence;

      const status = typeof c.status === 'string' ? c.status.toLowerCase().trim() : 'not_observed';
      if ((status === 'pass' || status === 'partial') && groundedEvidence.length === 0) {
        const message = `Criterion "${key}" downgraded from "${c.status}" to "not_observed" because no evidence quote was grounded`;
        warnings.push(message);
        details.push({ severity: 'critical', source: 'analysis', code: 'downgraded_status', criterion: key, message });
        c.status = 'not_observed';
      }
    }
  }

  if (extraction.ticket_assessment && typeof extraction.ticket_assessment === 'object') {
    const evidence = extraction.ticket_assessment.evidence;
    if (typeof evidence === 'string' && evidence.trim() && !isGroundedQuote(evidence, sourceText)) {
      const message = 'Ticket assessment evidence was ungrounded and removed';
      warnings.push(message);
      details.push({ severity: 'warning', source: 'ticket', code: 'ticket_evidence_removed', message });
      extraction.ticket_assessment.evidence = '';
    }
  }

  if (Array.isArray(extraction.red_flags)) {
    for (const flag of extraction.red_flags) {
      if (!flag || typeof flag !== 'object') continue;
      if (typeof flag.evidence === 'string' && flag.evidence.trim() && !isGroundedQuote(flag.evidence, sourceText)) {
        const message = `Red flag "${flag.type || 'unknown'}" has ungrounded evidence`;
        warnings.push(message);
        details.push({ severity: 'critical', source: 'analysis', code: 'ungrounded_red_flag', message });
      }
    }
  }

  return { data: extraction, warnings, details };
}

function normalizeForGrounding(value: string): string {
  return value
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function isGroundedQuote(quote: string, normalizedSourceText: string): boolean {
  const normalizedQuote = normalizeForGrounding(quote)
    .replace(/^candidate:\s*/, '')
    .replace(/^caller:\s*/, '')
    .trim();

  if (!normalizedQuote) return false;
  if (normalizedSourceText.includes(normalizedQuote)) return true;

  const words = normalizedQuote.split(/\s+/).filter(Boolean);
  if (words.length < 6) return false;

  const overlap = words.filter(word => normalizedSourceText.includes(word)).length;
  return overlap / words.length >= 0.85;
}

export function parseNarrativeJson(raw: string): { data: any | null; error: string | null } {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== 'object') {
      return { data: null, error: 'Narrative response is not an object' };
    }
    return { data: parsed, error: null };
  } catch {
    return { data: null, error: 'Invalid JSON from narrative feedback model' };
  }
}

export function buildFallbackNarrative(extraction: any, score: number, rating: string): any {
  const criteriaCount = extraction?.criteria ? Object.keys(extraction.criteria).length : 0;
  const failedCount = extraction?.criteria
    ? Object.values(extraction.criteria as Record<string, any>).filter((c: any) => c.status === 'fail').length
    : 0;

  return {
    summary: `Candidate scored ${score}/100 (${rating}). ${criteriaCount} criteria evaluated, ${failedCount} failed checks.`,
    strengths: [],
    improvements: [],
    most_costly_miss: 'See criteria breakdown for details.',
    ticket_feedback: extraction?.ticket_assessment?.evidence || 'No ticket feedback available.',
    better_phrasing_examples: [],
    manager_standard_fit: {
      status: score >= 60 ? 'partial' : 'fail',
      notes: ['Fallback narrative generated; narrative AI call failed.'],
    },
    coaching_focus: [],
  };
}

export function validateNarrativeQuality(
  narrative: any,
  score: number,
  rating: string,
): { data: any; warnings: string[] } {
  const warnings: string[] = [];
  const data = narrative && typeof narrative === 'object' ? { ...narrative } : {};

  if (!isUsefulText(data.summary)) {
    warnings.push('Narrative summary was missing or too thin');
    data.summary = `Candidate scored ${score}/100 (${rating}). Review the scored criteria, fail gates, and evidence validation warnings before manager sign-off.`;
  }

  if (!Array.isArray(data.strengths)) {
    warnings.push('Narrative strengths were not an array');
    data.strengths = [];
  }

  if (!Array.isArray(data.improvements)) {
    warnings.push('Narrative improvements were not an array');
    data.improvements = [];
  }

  if (score < 100 && data.improvements.length === 0) {
    warnings.push('Narrative improvements were empty for a non-perfect score');
    data.improvements = ['Review the missed or partially demonstrated criteria and coach the candidate on the highest-impact gap.'];
  }

  if (!isUsefulText(data.ticket_feedback)) {
    warnings.push('Narrative ticket feedback was missing or too thin');
    data.ticket_feedback = 'Review whether the ticket captures user, company, impact, urgency, checks attempted, and next step with evidence from the call.';
  }

  if (!Array.isArray(data.better_phrasing_examples)) {
    warnings.push('Narrative phrasing examples were not an array');
    data.better_phrasing_examples = [];
  }

  if (!data.manager_standard_fit || typeof data.manager_standard_fit !== 'object') {
    warnings.push('Narrative manager_standard_fit was missing');
    data.manager_standard_fit = { status: score >= 80 ? 'pass' : score >= 60 ? 'partial' : 'fail', notes: [] };
  }
  if (!Array.isArray(data.manager_standard_fit.notes)) {
    warnings.push('Narrative manager_standard_fit notes were not an array');
    data.manager_standard_fit.notes = [];
  }
  if (data.manager_standard_fit.notes.length === 0 && score < 100) {
    data.manager_standard_fit.notes = ['Manager review should confirm the score against local standards and evidence grounding warnings.'];
  }

  if (!Array.isArray(data.coaching_focus)) {
    warnings.push('Narrative coaching_focus was not an array');
    data.coaching_focus = [];
  }
  if (data.coaching_focus.length === 0 && score < 80) {
    data.coaching_focus = ['Address the most costly missed criteria before retesting.'];
  }

  return { data, warnings };
}

function isUsefulText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length >= 20;
}
