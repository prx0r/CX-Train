import { NextRequest, NextResponse } from 'next/server';
import { loadTaxonomy, searchTaxonomyItems } from '@/lib/taxonomy';

/**
 * Search taxonomy for GPT Actions.
 * GET /api/actions/taxonomy/search?q=account+lockout&limit=5
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const limit = parseInt(searchParams.get('limit') || '5', 10);
  if (!q) return NextResponse.json({ error: 'Missing q' }, { status: 400 });

  try {
    const taxonomy = await loadTaxonomy();
    const results = searchTaxonomyItems(taxonomy, q, limit);
    return NextResponse.json({
      results: results.map(r => ({
        id: r.id,
        classification: `${r.category} / ${r.type} / ${r.subType} / ${r.item}`,
        definition: r.definition_scope?.slice(0, 300),
        playbook: r.playbook_steps?.slice(0, 300),
        owner: r.helpdesk_tier,
        escalation: r.escalation_guidance?.slice(0, 300),
        keywords: r.keywords,
      })),
      total: results.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
