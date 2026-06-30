import { NextResponse } from 'next/server';
import { loadTaxonomy, validateTaxonomy } from '@/lib/taxonomy';

/**
 * Validate taxonomy completeness.
 * GET /api/taxonomy/validate
 */
export async function GET() {
  try {
    const taxonomy = await loadTaxonomy();
    const report = validateTaxonomy(taxonomy);
    return NextResponse.json(report);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
