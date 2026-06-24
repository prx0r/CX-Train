import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { requireManagerTenant } from '@/lib/assessment-data';
import { createServerClient } from '@/lib/supabase';
import type { FinalReadiness } from '@/lib/types';

const READINESS = new Set<FinalReadiness>(['strong_hire','possible_hire','risky_hire','not_recommended','ready_low_risk_calls','ready_with_supervision','triage_only','not_ready']);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin();
    const tenantId = await requireManagerTenant(user);
    const { id } = await params;
    const body = await request.json();
    const managerScore = Number(body.manager_score);
    const readiness = body.final_readiness as FinalReadiness;
    if (!Number.isInteger(managerScore) || managerScore < 0 || managerScore > 100 || !READINESS.has(readiness)) return NextResponse.json({ error: 'Invalid review' }, { status: 400 });
    if (body.agreed_with_ai === false && !String(body.override_reason || '').trim()) return NextResponse.json({ error: 'Explain why you are overriding the AI result' }, { status: 400 });
    const supabase = createServerClient();
    const { data: pack } = await supabase.from('assessment_packs').select('id').eq('id', id).eq('tenant_id', tenantId).single();
    if (!pack) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    const { data: sessions } = await supabase.from('sessions').select('readiness_score').eq('assessment_pack_id', id).eq('tenant_id', tenantId);
    const aiScore = Math.round((sessions ?? []).reduce((sum, item) => sum + (item.readiness_score ?? 0), 0) / Math.max(1, sessions?.length ?? 0));
    const review = { assessment_pack_id: id, manager_id: user.id, ai_score: aiScore, manager_score: managerScore, agreed_with_ai: Boolean(body.agreed_with_ai), override_reason: String(body.override_reason || '').trim() || null, manager_notes: String(body.manager_notes || '').trim() || null, final_readiness: readiness };
    const { error } = await supabase.from('manager_reviews').insert(review);
    if (error) return NextResponse.json({ error: 'Unable to save review' }, { status: 500 });
    await supabase.from('assessment_packs').update({ status: 'reviewed', final_recommendation: readiness }).eq('id', id).eq('tenant_id', tenantId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return NextResponse.json({ error: message === 'Unauthorized' ? message : 'Unable to save review' }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
