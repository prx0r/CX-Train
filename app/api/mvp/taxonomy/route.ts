import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mvp/db';
import crypto from 'crypto';

export async function GET() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM taxonomy_items ORDER BY source_id ASC').all();
  const byType: Record<string, number> = {};
  for (const r of rows as any[]) {
    byType[r.type] = (byType[r.type] || 0) + 1;
  }
  return NextResponse.json({ results: rows, total: rows.length, byType });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const action = formData.get('action') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const XLSX = require('xlsx');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets['Sheet1'];
    if (!ws) {
      return NextResponse.json({ error: 'No Sheet1 found in the uploaded file. Please ensure it is named "Sheet1".' }, { status: 400 });
    }

    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];

    if (rows.length === 0) {
      return NextResponse.json({ error: 'XLSX file is empty or has no data rows.' }, { status: 400 });
    }

    const db = getDb();

    if (action === 'replace') {
      db.prepare('DELETE FROM taxonomy_items').run();
    }

    const insert = db.prepare(`INSERT OR IGNORE INTO taxonomy_items
      (id, source_id, board_name, type, sub_type, item, definition_scope, playbook, keywords, helpdesk_tier, escalation_guidance)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    let inserted = 0;
    let skipped = 0;

    const tx = db.transaction(() => {
      for (const r of rows) {
        const safeId = 'tax-' + crypto.createHash('md5').update(
          String(r.ID || '') + String(r.Type || '') + String(r.SubType || '') + String(r.Item || '')
        ).digest('hex').slice(0, 12);

        const result = insert.run(
          safeId,
          r.ID || null,
          r.Board_Name || 'Tier 1 Service Board',
          r.Type || '',
          r.SubType || '',
          r.Item || '',
          r['definition scope'] || '',
          r.Playbook || '',
          r.keywords || '',
          r['Helpdesk Tier'] || '',
          r['Escalation Guidance'] || ''
        );

        if (result.changes > 0) {
          inserted++;
        } else {
          skipped++;
        }
      }
    });

    tx();

    const typeCounts: Record<string, number> = {};
    const allRows = db.prepare('SELECT type FROM taxonomy_items').all() as any[];
    for (const r of allRows) {
      typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;
    }

    return NextResponse.json({
      ok: true,
      total: rows.length,
      inserted,
      skipped,
      typeCounts,
    });
  } catch (err) {
    console.error('[Taxonomy] Upload error:', err);
    return NextResponse.json({ error: `Failed to process file: ${(err as Error).message}` }, { status: 500 });
  }
}
