import { NextRequest, NextResponse } from 'next/server';
import { loadTaxonomy, appendChangeLog } from '@/lib/taxonomy';
import crypto from 'crypto';

/**
 * Propose a taxonomy change.
 * POST /api/taxonomy/propose-change
 * Body: { change_type, proposed_by, reason, item?, target_id? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { change_type, proposed_by, reason, item, target_id } = body;

    if (!change_type || !proposed_by || !reason) {
      return NextResponse.json({ error: 'Missing required fields: change_type, proposed_by, reason' }, { status: 400 });
    }

    if (!['add', 'update', 'delete'].includes(change_type)) {
      return NextResponse.json({ error: 'change_type must be add, update, or delete' }, { status: 400 });
    }

    /* Load current taxonomy to capture before state */
    const taxonomy = await loadTaxonomy();
    let beforeJson = null;
    let afterJson = null;

    if (change_type === 'update' && target_id) {
      const existing = taxonomy.items.find(i => i.id === target_id);
      if (existing) beforeJson = existing;
      if (item) afterJson = item;
    }

    if (change_type === 'delete' && target_id) {
      const existing = taxonomy.items.find(i => i.id === target_id);
      if (existing) beforeJson = existing;
    }

    if (change_type === 'add' && item) {
      afterJson = item;
    }

    const proposal = {
      id: crypto.randomBytes(16).toString('hex'),
      change_type,
      proposed_by,
      reason,
      taxonomy_item_id: target_id || item?.id || null,
      before_json: beforeJson ? JSON.stringify(beforeJson) : null,
      after_json: afterJson ? JSON.stringify(afterJson) : null,
      status: 'proposed',
      created_at: new Date().toISOString(),
    };

    await appendChangeLog(proposal);

    return NextResponse.json({
      proposal,
      message: `Change proposal created. Status: proposed. Use approve endpoint to apply.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
