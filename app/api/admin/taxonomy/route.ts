import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  await requireAdmin();
  const supabase = createServerClient();
  const { data } = await supabase.from('taxonomy_items').select('*').order('category').order('title');
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  await requireAdmin();
  const body = await request.json();
  if (!body.id || !body.category || !body.subcategory || !body.title || !body.description) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.from('taxonomy_items').insert(body).select('*').single();
  if (error) {
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
  }
  return NextResponse.json(data);
}
