import { NextRequest, NextResponse } from 'next/server';
import { getInviteContext } from '@/lib/assessment-data';
import { sameCandidateName, validateGptActionKey } from '@/lib/gpt-action-auth';
import { createServerClient } from '@/lib/supabase';

const TITLES = ['Password/login issue', 'Outlook not sending', 'Printer not printing'];

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!await validateGptActionKey(request.headers.get('x-api-key'))) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  const { token } = await params; const body = await request.json(); const context = await getInviteContext(token);
  if ('error' in context) return NextResponse.json({ error: context.error === 'expired' ? 'Assessment code expired' : 'Assessment code not found' }, { status: context.error === 'expired' ? 410 : 404 });
  const candidate = Array.isArray(context.pack.candidates) ? context.pack.candidates[0] : context.pack.candidates;
  if (!candidate || !sameCandidateName(candidate.name, String(body.candidate_name || ''))) return NextResponse.json({ error: 'Name does not match this assessment code' }, { status: 403 });
  const supabase = createServerClient();
  const { data: existing } = await supabase.from('sessions').select('id,scenario_id,transcript_text,candidate_ticket_text,scenarios(*)').eq('assessment_pack_id',context.pack.id).order('created_at');
  const unfinished = (existing ?? []).find((session) => !session.candidate_ticket_text);
  if (unfinished) {
    const scenario = Array.isArray(unfinished.scenarios) ? unfinished.scenarios[0] : unfinished.scenarios;
    return NextResponse.json({ error: 'Finish the current call and ticket before starting another', session_id: unfinished.id, call_number: (existing ?? []).indexOf(unfinished)+1, needs_ticket: Boolean(unfinished.transcript_text), scenario: scenario ? { title:scenario.title,issue_family:scenario.issue_family,caller_persona:scenario.caller_persona,intensity:scenario.intensity } : null }, { status: 409 });
  }
  if ((existing?.length ?? 0) >= 3) return NextResponse.json({ complete: true });
  const used = new Set((existing ?? []).map((session) => session.scenario_id));
  const { data: scenarios } = await supabase.from('scenarios').select('*').in('title',TITLES).eq('active',true);
  const map = new Map((scenarios ?? []).map((scenario) => [scenario.title, scenario]));
  const scenario = TITLES.map((title) => map.get(title)).find((item) => item && !used.has(item.id));
  if (!scenario) return NextResponse.json({ error: 'First Calls scenarios are not configured' }, { status: 409 });
  const { data: session, error } = await supabase.from('sessions').insert({ tenant_id:context.pack.tenant_id,assessment_pack_id:context.pack.id,scenario_id:scenario.id,issue_family:scenario.issue_family,intensity:scenario.intensity,checkpoints:{} }).select('id').single();
  if (error || !session) return NextResponse.json({ error:'Unable to start call' },{status:500});
  await Promise.all([supabase.from('assessment_packs').update({status:'in_progress'}).eq('id',context.pack.id),supabase.from('assessment_invites').update({used_at:new Date().toISOString()}).eq('id',context.invite.id).is('used_at',null)]);
  return NextResponse.json({ session_id:session.id, call_number:(existing?.length??0)+1, calls_total:3, scenario:{title:scenario.title,issue_family:scenario.issue_family,caller_persona:scenario.caller_persona,intensity:scenario.intensity} });
}
