import { NextResponse } from 'next/server';
import { loadTaxonomy } from '@/lib/taxonomy';

/**
 * Get all taxonomy items (for browser).
 * GET /api/taxonomy/all
 */
export async function GET() {
  try {
    const taxonomy = await loadTaxonomy();
    return NextResponse.json({ items: taxonomy.items, total: taxonomy.items.length, version: taxonomy.version });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
