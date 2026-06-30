import { NextRequest, NextResponse } from 'next/server';
import { loadTaxonomy } from '@/lib/taxonomy';

/**
 * Get a single taxonomy item by ID.
 * GET /api/taxonomy/item/{id}
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taxonomy = await loadTaxonomy();
    const item = taxonomy.items.find(i => i.id === params.id);
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    return NextResponse.json({ item });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
