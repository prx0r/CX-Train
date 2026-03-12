import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id } = await params;
  const supabase = createServerClient();
  const { data } = await supabase.from('taxonomy_items').select('*').eq('id', id).single();
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  const { id } = await params;
  const body = await request.json();
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('taxonomy_items')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  await supabase.from('taxonomy_changes').insert({
    change_type: 'update',
    proposed_by: admin.email || admin.name || admin.id,
    reason: 'Admin edit',
    item: data,
    target_id: id,
    status: 'applied',
    applied_at: new Date().toISOString(),
  });
  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  const { id } = await params;
  const supabase = createServerClient();
  const { error } = await supabase.from('taxonomy_items').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  await supabase.from('taxonomy_changes').insert({
    change_type: 'delete',
    proposed_by: admin.email || admin.name || admin.id,
    reason: 'Admin delete',
    target_id: id,
    status: 'applied',
    applied_at: new Date().toISOString(),
  });
  return NextResponse.json({ success: true });
}
