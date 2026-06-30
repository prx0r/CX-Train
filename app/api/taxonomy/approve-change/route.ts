import { NextRequest, NextResponse } from 'next/server';
import { loadTaxonomy, saveTaxonomy, readChangeLog, appendChangeLog } from '@/lib/taxonomy';
import crypto from 'crypto';

/**
 * Approve and apply a taxonomy change.
 * POST /api/taxonomy/approve-change
 * Body: { proposal_id, approved_by }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { proposal_id, approved_by } = body;

    if (!proposal_id || !approved_by) {
      return NextResponse.json({ error: 'Missing proposal_id or approved_by' }, { status: 400 });
    }

    const changes = await readChangeLog();
    const proposal = changes.find(c => c.id === proposal_id);

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    if (proposal.status !== 'proposed') {
      return NextResponse.json({ error: `Proposal already ${proposal.status}` }, { status: 400 });
    }

    /* Apply the change */
    const taxonomy = await loadTaxonomy();

    if (proposal.change_type === 'add' && proposal.item) {
      taxonomy.items.push(proposal.item);
    }

    if (proposal.change_type === 'update' && proposal.target_id && proposal.item) {
      const idx = taxonomy.items.findIndex(i => i.id === proposal.target_id);
      if (idx >= 0) taxonomy.items[idx] = proposal.item;
    }

    if (proposal.change_type === 'delete' && proposal.target_id) {
      taxonomy.items = taxonomy.items.filter(i => i.id !== proposal.target_id);
    }

    taxonomy.last_updated = new Date().toISOString();
    taxonomy.version = String(parseFloat(taxonomy.version) + 0.1);

    await saveTaxonomy(taxonomy);

    /* Mark proposal as applied */
    proposal.status = 'applied';
    proposal.approved_by = approved_by;
    proposal.applied_at = new Date().toISOString();

    /* Re-append the updated proposal (approval is an append-only log) */
    await appendChangeLog({
      ...proposal,
      change_type: proposal.change_type as any,
      proposed_by: proposal.proposed_by || '',
      reason: proposal.reason || `Approved by ${approved_by}`,
    });

    return NextResponse.json({
      message: `Change applied. Taxonomy now has ${taxonomy.items.length} items (v${taxonomy.version}).`,
      version: taxonomy.version,
      item_count: taxonomy.items.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
