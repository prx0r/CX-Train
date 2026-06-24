import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { requireManagerTenant } from '@/lib/assessment-data';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const body = await request.json();
    const name = String(body.candidate_name || '').trim();
    const email = String(body.candidate_email || '').trim() || null;
    if (!name || name.length > 120 || (email && email.length > 254)) {
      return NextResponse.json({ error: 'Invalid assessment details' }, { status: 400 });
    }

    const tenantId = await requireManagerTenant(user);
    const supabase = createServerClient();
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .insert({ tenant_id: tenantId, name, email })
      .select('id')
      .single();
    if (candidateError || !candidate) throw candidateError || new Error('Candidate creation failed');

    const { data: pack, error: packError } = await supabase
      .from('assessment_packs')
      .insert({
        tenant_id: tenantId,
        candidate_id: candidate.id,
        created_by: user.id,
        mode: 'onboarding',
        difficulty: 'candidate',
        scenario_count: 3,
        title: 'First Calls',
        status: 'invited',
      })
      .select('id')
      .single();
    if (packError || !pack) throw packError || new Error('Assessment creation failed');

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { error: inviteError } = await supabase.from('assessment_invites').insert({
      assessment_pack_id: pack.id,
      token,
      candidate_email: email,
      expires_at: expiresAt,
    });
    if (inviteError) throw inviteError;

    return NextResponse.json({ assessment_pack_id: pack.id, invite_url: `/assessment/${token}` }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create assessment';
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: status === 500 ? 'Unable to create assessment' : message }, { status });
  }
}
