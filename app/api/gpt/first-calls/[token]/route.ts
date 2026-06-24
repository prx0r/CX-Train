import { NextRequest, NextResponse } from 'next/server';
import { getInviteContext } from '@/lib/assessment-data';
import { sameCandidateName, validateGptActionKey } from '@/lib/gpt-action-auth';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!await validateGptActionKey(request.headers.get('x-api-key'))) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  const { token } = await params;
  const context = await getInviteContext(token);
  if ('error' in context) return NextResponse.json({ error: context.error === 'expired' ? 'Assessment code expired' : 'Assessment code not found' }, { status: context.error === 'expired' ? 410 : 404 });
  const candidate = Array.isArray(context.pack.candidates) ? context.pack.candidates[0] : context.pack.candidates;
  const suppliedName = request.nextUrl.searchParams.get('candidate_name') || '';
  if (!candidate || !sameCandidateName(candidate.name, suppliedName)) return NextResponse.json({ error: 'Name does not match this assessment code' }, { status: 403 });
  const supabase = createServerClient();
  const { data: sessions } = await supabase.from('sessions').select('id,candidate_ticket_text,transcript_text,scenarios(title)').eq('assessment_pack_id', context.pack.id).order('created_at');
  const completed = (sessions ?? []).filter((session) => session.candidate_ticket_text).length;
  const unfinished = (sessions ?? []).find((session) => !session.candidate_ticket_text);
  return NextResponse.json({
    assessment: 'First Calls', candidate_name: candidate.name, status: context.pack.status,
    calls_completed: completed, calls_total: 3, complete: completed >= 3,
    next_step: unfinished ? (unfinished.transcript_text ? 'submit_ticket' : 'resume_call') : completed >= 3 ? 'complete' : 'start_call',
    active_session_id: unfinished?.id ?? null,
  });
}
