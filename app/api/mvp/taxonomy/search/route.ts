import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mvp/db';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '';
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);
  const db = getDb();
  const pattern = `%${q}%`;
  const rows = db.prepare(`
    SELECT * FROM taxonomy_items
    WHERE type LIKE ? OR sub_type LIKE ? OR item LIKE ? OR definition_scope LIKE ? OR keywords LIKE ?
    ORDER BY source_id ASC
    LIMIT ?
  `).all(pattern, pattern, pattern, pattern, pattern, Math.min(limit, 200));
  return NextResponse.json({ results: rows, query: q, total: rows.length });
}
