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
