import { NextRequest, NextResponse } from 'next/server';
import { loadTaxonomy, searchTaxonomyItems } from '@/lib/taxonomy';

/**
 * Search the taxonomy source of truth.
 * GET /api/taxonomy/search?q=account+lockout&limit=5
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const limit = parseInt(searchParams.get('limit') || '5', 10);

  if (!q) {
    return NextResponse.json({ error: 'Missing query parameter q' }, { status: 400 });
  }

  try {
    const taxonomy = await loadTaxonomy();
    const results = searchTaxonomyItems(taxonomy, q, limit);
    return NextResponse.json({ results, total: results.length, query: q });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
