import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  await requireAdmin();
  const supabase = createServerClient();
  const { data } = await supabase
    .from('taxonomy_changes')
    .select('*')
    .order('created_at', { ascending: false });
  return NextResponse.json(data ?? []);
}
