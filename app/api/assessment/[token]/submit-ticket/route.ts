import { NextResponse } from 'next/server';
import { getInviteContext } from '@/lib/assessment-data';
import { combineCallAndTicketScore, getFirstCallsReadiness, scoreTicket } from '@/lib/assessment-scoring';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const context = await getInviteContext(token);
  if ('error' in context) return NextResponse.json({ error: context.error === 'expired' ? 'Invite expired' : 'Invite not found' }, { status: context.error === 'expired' ? 410 : 404 });
  const body = await request.json();
  const sessionId = String(body.session_id || '');
  const ticket = String(body.candidate_ticket_text || '').trim();
  if (!sessionId || ticket.length < 30) return NextResponse.json({ error: 'Write a useful ticket summary before continuing' }, { status: 400 });

  const supabase = createServerClient();
  const { data: session } = await supabase.from('sessions')
    .select('id, score, transcript_text, candidate_ticket_text, score_breakdown')
    .eq('id', sessionId).eq('assessment_pack_id', context.pack.id).eq('tenant_id', context.pack.tenant_id).single();
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  if (!session.transcript_text) return NextResponse.json({ error: 'Submit the call before the ticket' }, { status: 409 });
  if (session.candidate_ticket_text) return NextResponse.json({ error: 'Ticket has already been submitted' }, { status: 409 });

  const ticketScore = scoreTicket(ticket, session.transcript_text);
  const readinessScore = combineCallAndTicketScore(session.score ?? 0, ticketScore.score);
  const criticalMisses = ((session.score_breakdown as { critical_misses?: string[] } | null)?.critical_misses ?? []).concat(ticketScore.score < 40 ? ['usable_ticket'] : []);
  const readinessLabel = getFirstCallsReadiness(readinessScore, criticalMisses);
  const { error } = await supabase.from('sessions').update({
    candidate_ticket_text: ticket,
    ticket_assessed: true,
    ticket_score: ticketScore,
    readiness_score: readinessScore,
    readiness_label: readinessLabel,
  }).eq('id', session.id).eq('assessment_pack_id', context.pack.id);
  if (error) return NextResponse.json({ error: 'Unable to save ticket' }, { status: 500 });

  const { count } = await supabase.from('sessions').select('id', { count: 'exact', head: true })
    .eq('assessment_pack_id', context.pack.id).not('candidate_ticket_text', 'is', null);
  const complete = (count ?? 0) >= context.pack.scenario_count;
  if (complete) {
    const { data: sessions } = await supabase.from('sessions').select('readiness_score, score_breakdown, ticket_score').eq('assessment_pack_id', context.pack.id);
    const average = Math.round((sessions ?? []).reduce((sum, item) => sum + (item.readiness_score ?? 0), 0) / Math.max(1, sessions?.length ?? 0));
    const misses = (sessions ?? []).flatMap((item) => ((item.score_breakdown as { critical_misses?: string[] } | null)?.critical_misses ?? []));
    if ((sessions ?? []).some((item) => (item.ticket_score as { score?: number } | null)?.score != null && (item.ticket_score as { score: number }).score < 40)) misses.push('usable_ticket');
    await supabase.from('assessment_packs').update({ status: 'completed', completed_at: new Date().toISOString(), final_recommendation: getFirstCallsReadiness(average, misses) }).eq('id', context.pack.id).eq('tenant_id', context.pack.tenant_id);
  }
  return NextResponse.json({ success: true, ticket_score: ticketScore, readiness_score: readinessScore, complete });
}
