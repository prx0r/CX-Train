import { NextRequest, NextResponse } from 'next/server';
import { getDb, initTables } from '@/lib/mvp/db';
import { getAssessment, getResult, makeId } from '@/lib/mvp/query';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    initTables();

    const assessment = getAssessment(params.id);
    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const body = await request.json();
    const managerLabel = body.manager_label || '';
    const managerScore = body.manager_score != null ? body.manager_score : null;
    const notes = body.notes || '';
    const criterionOverrides: Array<{
      criterion_id: string;
      original_status: string;
      manager_status: string;
      original_score?: number;
      manager_score?: number;
      manager_comment?: string;
    }> = body.criterion_overrides || [];

    const validLabels = ['agree', 'too_harsh', 'too_generous', 'wrong', 'useful', 'not_useful'];
    if (!validLabels.includes(managerLabel)) {
      return NextResponse.json({ error: `Invalid label. Must be one of: ${validLabels.join(', ')}` }, { status: 400 });
    }

    const result = getResult(assessment.id);
    const db = getDb();
    const feedbackId = makeId();

    db.prepare(`INSERT INTO manager_feedback (id, assessment_id, result_id, manager_label, manager_score, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`).run(
      feedbackId, assessment.id, result?.id || null, managerLabel, managerScore, notes
    );

    // Store criterion-level overrides
    for (const override of criterionOverrides) {
      if (!override.criterion_id || !override.manager_status) continue;
      db.prepare(`INSERT INTO manager_criterion_feedback (id, feedback_id, criterion_id, original_status, manager_status, original_score, manager_score, manager_comment, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(
        makeId(), feedbackId, override.criterion_id, override.original_status || 'unknown',
        override.manager_status, override.original_score ?? 0, override.manager_score ?? 0,
        override.manager_comment || null
      );
    }

    // If a manager score override is given, store it but preserve original
    if (result && managerScore != null) {
      const newReadiness = managerScore >= 80 ? 'ready' : managerScore >= 60 ? 'needs_supervision' : 'not_ready';
      db.prepare('UPDATE assessment_results SET overall_score = ? WHERE id = ?').run(managerScore, result.id);
    }

    db.prepare('UPDATE assessments SET status = ? WHERE id = ?').run('reviewed', assessment.id);

    return NextResponse.json({
      status: 'reviewed',
      feedback_id: feedbackId,
    });
  } catch (err) {
    console.error('[MVP] Feedback error:', err);
    return NextResponse.json({ error: 'Failed to store feedback' }, { status: 500 });
  }
}
