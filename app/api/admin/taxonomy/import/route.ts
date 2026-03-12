import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n|;|\|/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function toBool(value: string | undefined): boolean {
  if (!value) return false;
  return ['true', 'yes', 'y', '1'].includes(value.toLowerCase().trim());
}

function slugifyId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    if (!rows.length) {
      return NextResponse.json({ error: 'No rows found' }, { status: 400 });
    }

    const mapped = rows.map((row) => {
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        const norm = normalizeHeader(key);
        normalized[norm] = String(value ?? '').trim();
      }

      const title = normalized.title || normalized.item || '';
      const description = normalized.description || normalized.definition || '';
      const category = normalized.category || normalized.classification || '';
      const subcategory = normalized.subcategory || normalized.sub_type || normalized.subtype || '';

      const id = normalized.id || slugifyId(`${category}_${subcategory}_${title}`);

      return {
        id,
        category,
        subcategory,
        title,
        description,
        triage_questions: splitList(normalized.triage_questions || normalized.questions),
        triage_steps: splitList(normalized.triage_steps || normalized.playbook),
        resolution_steps: splitList(normalized.resolution_steps || normalized.resolution),
        escalation_policy: normalized.escalation_policy || normalized.escalation || '',
        severity_guidance: normalized.severity_guidance || normalized.severity || '',
        impact_guidance: normalized.impact_guidance || normalized.impact || '',
        first_call_resolution: toBool(normalized.first_call_resolution || normalized.fcr),
        owner: normalized.owner || '',
        examples: splitList(normalized.examples),
        last_reviewed: normalized.last_reviewed || normalized.reviewed || null,
        updated_at: new Date().toISOString(),
      };
    });

    const cleaned = mapped.filter((row) => row.category && row.subcategory && row.title && row.description);
    if (!cleaned.length) {
      return NextResponse.json({ error: 'No valid rows after mapping' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Clear existing taxonomy
    await supabase.from('taxonomy_items').delete().neq('id', '');

    // Insert in chunks
    const chunkSize = 200;
    for (let i = 0; i < cleaned.length; i += chunkSize) {
      const chunk = cleaned.slice(i, i + chunkSize);
      const { error } = await supabase.from('taxonomy_items').insert(chunk);
      if (error) {
        return NextResponse.json({ error: 'Failed to insert taxonomy items' }, { status: 500 });
      }
    }

    await supabase.from('taxonomy_changes').insert({
      change_type: 'import',
      proposed_by: admin.email || admin.name || admin.id,
      reason: `Imported ${cleaned.length} rows from ${file.name}`,
      status: 'applied',
      applied_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, inserted: cleaned.length });
  } catch (err) {
    console.error('Taxonomy import error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
