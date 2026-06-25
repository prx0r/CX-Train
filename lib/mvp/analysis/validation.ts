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
): { data: any; warnings: string[] } {
  const warnings: string[] = [];
  const sourceText = normalizeForGrounding([
    sources.transcriptText || '',
    sources.ticketText || '',
  ].join('\n'));

  if (!extraction || typeof extraction !== 'object') {
    return { data: extraction, warnings: ['Evidence grounding skipped: extraction is not an object'] };
  }

  if (!sourceText) {
    return { data: extraction, warnings: ['Evidence grounding skipped: no transcript or ticket text available'] };
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
        warnings.push(`Criterion "${key}" had ${evidence.length - groundedEvidence.length} ungrounded evidence quote(s) removed`);
      }

      c.evidence = groundedEvidence;

      const status = typeof c.status === 'string' ? c.status.toLowerCase().trim() : 'not_observed';
      if ((status === 'pass' || status === 'partial') && groundedEvidence.length === 0) {
        warnings.push(`Criterion "${key}" downgraded from "${c.status}" to "not_observed" because no evidence quote was grounded`);
        c.status = 'not_observed';
      }
    }
  }

  if (extraction.ticket_assessment && typeof extraction.ticket_assessment === 'object') {
    const evidence = extraction.ticket_assessment.evidence;
    if (typeof evidence === 'string' && evidence.trim() && !isGroundedQuote(evidence, sourceText)) {
      warnings.push('Ticket assessment evidence was ungrounded and removed');
      extraction.ticket_assessment.evidence = '';
    }
  }

  if (Array.isArray(extraction.red_flags)) {
    for (const flag of extraction.red_flags) {
      if (!flag || typeof flag !== 'object') continue;
      if (typeof flag.evidence === 'string' && flag.evidence.trim() && !isGroundedQuote(flag.evidence, sourceText)) {
        warnings.push(`Red flag "${flag.type || 'unknown'}" has ungrounded evidence`);
      }
    }
  }

  return { data: extraction, warnings };
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
