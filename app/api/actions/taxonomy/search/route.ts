import { NextRequest, NextResponse } from 'next/server';
import { loadTaxonomy, searchTaxonomyItems } from '@/lib/taxonomy';
import { verifyActionsKey } from '@/lib/callum-auth';

/**
 * Search taxonomy for GPT Actions.
 * GET /api/actions/taxonomy/search?q=account+lockout&limit=5
 */
export async function GET(req: NextRequest) {
  const auth = verifyActionsKey(req);
  if (!auth.valid) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const limit = parseInt(searchParams.get('limit') || '5', 10);
  if (!q) return NextResponse.json({ error: 'Missing q' }, { status: 400 });

  try {
    const taxonomy = await loadTaxonomy();
    const results = searchTaxonomyItems(taxonomy, q, limit);
    return NextResponse.json({
      matches: results.map(r => ({
        taxonomy_item_id: r.id,
        classification_path: `${r.category} / ${r.type} / ${r.subType} / ${r.item}`,
        category: r.category,
        type: r.type,
        subType: r.subType,
        item: r.item,
        definition_scope: r.definition_scope?.slice(0, 500),
        playbook_steps: r.playbook_steps?.split(/\.\s+/).filter(s => s.trim().length > 5).slice(0, 10),
        helpdesk_tier: r.helpdesk_tier,
        escalation_guidance: r.escalation_guidance?.slice(0, 500),
        confidence: r.helpdesk_tier ? 'high' : 'medium',
      })),
      total: results.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
