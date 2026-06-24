import { NextResponse } from 'next/server';
import { getInviteContext, publicScenario } from '@/lib/assessment-data';
import { createServerClient } from '@/lib/supabase';

export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const context = await getInviteContext(token);
  if ('error' in context) return NextResponse.json({ error: context.error === 'expired' ? 'Invite expired' : 'Invite not found' }, { status: context.error === 'expired' ? 410 : 404 });
  const supabase = createServerClient();
  const { data: existing } = await supabase
    .from('sessions')
    .select('id, scenario_id, transcript_text, candidate_ticket_text, scenarios(*)')
    .eq('assessment_pack_id', context.pack.id)
    .order('created_at');
  const unfinished = (existing ?? []).find((session) => !session.candidate_ticket_text);
  if (unfinished) {
    const scenario = Array.isArray(unfinished.scenarios) ? unfinished.scenarios[0] : unfinished.scenarios;
    return NextResponse.json({ session_id: unfinished.id, scenario: publicScenario(scenario ?? {}), step: unfinished.transcript_text ? 'ticket' : 'call', call_number: (existing ?? []).indexOf(unfinished) + 1 });
  }
  if ((existing?.length ?? 0) >= context.pack.scenario_count) {
    return NextResponse.json({ complete: true });
  }

  const usedIds = new Set((existing ?? []).map((session) => session.scenario_id));
  const { data: scenarios } = await supabase.from('scenarios').select('*').eq('active', true).order('created_at');
  const available = (scenarios ?? []).filter((scenario) => !usedIds.has(scenario.id));
  const scenario = available.find((item) => item.difficulty === context.pack.difficulty) ?? available[0];
  if (!scenario) return NextResponse.json({ error: 'No scenarios available' }, { status: 409 });

  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      tenant_id: context.pack.tenant_id,
      assessment_pack_id: context.pack.id,
      scenario_id: scenario.id,
      issue_family: scenario.issue_family,
      intensity: scenario.intensity,
      checkpoints: {},
    })
    .select('id')
    .single();
  if (error || !session) return NextResponse.json({ error: 'Unable to start call' }, { status: 500 });
  await Promise.all([
    supabase.from('assessment_packs').update({ status: 'in_progress' }).eq('id', context.pack.id),
    supabase.from('assessment_invites').update({ used_at: new Date().toISOString() }).eq('id', context.invite.id).is('used_at', null),
  ]);
  return NextResponse.json({ session_id: session.id, scenario: publicScenario(scenario), step: 'call', call_number: (existing?.length ?? 0) + 1 });
}
