import { NextRequest, NextResponse } from 'next/server';
import { loadTaxonomy, generateScenarioFromTaxonomy } from '@/lib/taxonomy';

/**
 * Generate a training scenario from a taxonomy item.
 * POST /api/taxonomy/scenario
 * Body: { item_id: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { item_id } = body;
    if (!item_id) {
      return NextResponse.json({ error: 'Missing item_id' }, { status: 400 });
    }

    const taxonomy = await loadTaxonomy();
    const item = taxonomy.items.find(i => i.id === item_id);
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const scenario = generateScenarioFromTaxonomy(item);
    return NextResponse.json({
      item_id: item.id,
      item_name: item.item,
      classification: `${item.category} / ${item.type} / ${item.subType} / ${item.item}`,
      scenario,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * List all taxonomy items that can become scenarios.
 * GET /api/taxonomy/scenario
 */
export async function GET() {
  try {
    const taxonomy = await loadTaxonomy();
    const scenarios = taxonomy.items.map(item => ({
      id: item.id,
      classification: `${item.category} / ${item.type} / ${item.subType} / ${item.item}`,
      tier: item.helpdesk_tier || 'Unset',
      hasPlaybook: (item.playbook_steps || '').length > 20,
      hasEscalation: (item.escalation_guidance || '').length > 5,
      scenario: generateScenarioFromTaxonomy(item),
    }));
    return NextResponse.json({ scenarios, total: scenarios.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
