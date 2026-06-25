import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mvp/db';

export async function GET() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM taxonomy_items ORDER BY source_id ASC').all();
  const byType: Record<string, number> = {};
  for (const r of rows as any[]) {
    byType[r.type] = (byType[r.type] || 0) + 1;
  }
  return NextResponse.json({ results: rows, total: rows.length, byType });
}
