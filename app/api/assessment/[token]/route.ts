import { NextResponse } from 'next/server';
import { getInviteContext } from '@/lib/assessment-data';
import { createServerClient } from '@/lib/supabase';

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const context = await getInviteContext(token);
  if ('error' in context) return NextResponse.json({ error: context.error === 'expired' ? 'Invite expired' : 'Invite not found' }, { status: context.error === 'expired' ? 410 : 404 });
  const supabase = createServerClient();
  const { count } = await supabase
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('assessment_pack_id', context.pack.id)
    .not('candidate_ticket_text', 'is', null);
  const candidate = Array.isArray(context.pack.candidates) ? context.pack.candidates[0] : context.pack.candidates;
  return NextResponse.json({
    title: context.pack.title,
    mode: context.pack.mode,
    scenario_count: context.pack.scenario_count,
    status: context.pack.status,
    candidate_name: candidate?.name,
    calls_completed: count ?? 0,
  });
}
