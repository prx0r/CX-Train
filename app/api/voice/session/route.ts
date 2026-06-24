import { NextRequest, NextResponse } from 'next/server';
import { getInviteContext, safeScenario } from '@/lib/assessment-data';
import { sameCandidateName, validateGptActionKey } from '@/lib/gpt-action-auth';
import { createServerClient } from '@/lib/supabase';
import { createSession } from '@/lib/voice/session';

export async function POST(request: NextRequest) {
  try {
    if (!await validateGptActionKey(request.headers.get('x-api-key'))) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    const token = String(body.token || '');
    const candidateName = String(body.candidate_name || '');

    if (!token) return NextResponse.json({ error: 'Assessment token required' }, { status: 400 });
    if (!candidateName) return NextResponse.json({ error: 'Candidate name required' }, { status: 400 });

    const context = await getInviteContext(token);
    if ('error' in context) {
      return NextResponse.json({
        error: context.error === 'expired' ? 'Assessment code expired' : 'Assessment code not found',
      }, { status: context.error === 'expired' ? 410 : 404 });
    }

    const candidate = Array.isArray(context.pack.candidates) ? context.pack.candidates[0] : context.pack.candidates;
    if (!candidate || !sameCandidateName(candidate.name, candidateName)) {
      return NextResponse.json({ error: 'Name does not match this assessment code' }, { status: 403 });
    }

    const supabase = createServerClient();
    const { data: existing } = await supabase
      .from('sessions')
      .select('id,scenario_id,candidate_ticket_text,scenarios(*)')
      .eq('assessment_pack_id', context.pack.id)
      .order('created_at');

    const used = new Set((existing ?? []).map((s) => s.scenario_id));
    const TITLES = ['Password/login issue', 'Outlook not sending', 'Printer not printing'] as const;
    const { data: scenarios } = await supabase.from('scenarios').select('*').in('title', TITLES).eq('active', true);
    const map = new Map((scenarios ?? []).map((s) => [s.title, s]));
    const scenario = TITLES.map((title) => map.get(title)).find((item) => item && !used.has(item.id));

    if (!scenario) {
      const completedCount = (existing ?? []).filter((s) => s.candidate_ticket_text).length;
      if (completedCount >= 3) {
        return NextResponse.json({ error: 'All calls completed', complete: true }, { status: 409 });
      }
      return NextResponse.json({ error: 'No available scenario' }, { status: 409 });
    }

    const { data: session, error } = await supabase.from('sessions').insert({
      tenant_id: context.pack.tenant_id,
      assessment_pack_id: context.pack.id,
      scenario_id: scenario.id,
      issue_family: scenario.issue_family,
      intensity: scenario.intensity,
      checkpoints: {},
    }).select('id').single();

    if (error || !session) {
      return NextResponse.json({ error: 'Unable to create session' }, { status: 500 });
    }

    await supabase.from('assessment_packs').update({ status: 'in_progress' }).eq('id', context.pack.id);

    const voiceSession = createSession({
      assessmentSessionId: session.id,
      inviteToken: token,
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      candidateName: candidate.name,
    });

    return NextResponse.json({
      voiceSessionId: voiceSession.id,
      assessmentSessionId: session.id,
      scenario: safeScenario(scenario),
      scenarioTitle: scenario.title,
      candidateName: candidate.name,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
