import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { requireManagerTenant } from '@/lib/assessment-data';
import { createServerClient } from '@/lib/supabase';
import type { FinalReadiness } from '@/lib/types';

const READINESS = new Set<FinalReadiness>(['ready_low_risk_calls','ready_with_supervision','not_ready']);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin();
    const tenantId = await requireManagerTenant(user);
    const { id } = await params;
    const body = await request.json();
    const supabase = createServerClient();
    const { data: pack } = await supabase.from('assessment_packs').select('id,final_recommendation').eq('id', id).eq('tenant_id', tenantId).single();
    if (!pack) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });

    if (body.phase === 'ai_feedback') {
      const rating = Number(body.ai_feedback_rating);
      const comment = String(body.ai_feedback_comment || '').trim();
      if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !comment) return NextResponse.json({ error: 'Rate the AI analysis and add a comment' }, { status: 400 });
      const { data: review } = await supabase.from('manager_reviews').select('id').eq('assessment_pack_id', id).eq('manager_id', user.id).order('created_at', { ascending: false }).limit(1).single();
      if (!review) return NextResponse.json({ error: 'Complete the independent manager review first' }, { status: 409 });
      const { error } = await supabase.from('manager_reviews').update({ ai_feedback_rating: rating, ai_feedback_comment: comment, reviewed_ai_at: new Date().toISOString() }).eq('id', review.id).eq('manager_id', user.id);
      return error ? NextResponse.json({ error: 'Unable to save AI feedback' }, { status: 500 }) : NextResponse.json({ success: true });
    }

    const managerRating = Number(body.manager_rating);
    const managerScore = managerRating * 10;
    const readiness = body.final_readiness as FinalReadiness;
    if (!Number.isInteger(managerRating) || managerRating < 1 || managerRating > 10 || !READINESS.has(readiness)) return NextResponse.json({ error: 'Invalid review' }, { status: 400 });
    const { data: sessions } = await supabase.from('sessions').select('readiness_score').eq('assessment_pack_id', id).eq('tenant_id', tenantId);
    const aiScore = Math.round((sessions ?? []).reduce((sum, item) => sum + (item.readiness_score ?? 0), 0) / Math.max(1, sessions?.length ?? 0));
    const agreedWithAi = readiness === pack.final_recommendation;
    const review = { assessment_pack_id: id, manager_id: user.id, ai_score: aiScore, ai_readiness: pack.final_recommendation, manager_score: managerScore, agreed_with_ai: agreedWithAi, override_reason: agreedWithAi ? null : 'Independent manager recommendation differed before AI reveal.', manager_notes: String(body.manager_notes || '').trim() || null, final_readiness: readiness };
    const { error } = await supabase.from('manager_reviews').insert(review);
    if (error) return NextResponse.json({ error: 'Unable to save review' }, { status: 500 });
    await supabase.from('assessment_packs').update({ status: 'reviewed', final_recommendation: readiness }).eq('id', id).eq('tenant_id', tenantId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return NextResponse.json({ error: message === 'Unauthorized' ? message : 'Unable to save review' }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
