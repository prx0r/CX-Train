import { NextRequest, NextResponse } from 'next/server';
import { initTables } from '@/lib/mvp/db';
import { failWithCustomCode } from '@/lib/mvp/api/responses';
import { createMvpAssessment } from '@/lib/mvp/assessments/create';

export async function POST(request: NextRequest) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'http://localhost:3000';

    const body = await request.json();
    try {
      const result = createMvpAssessment({
        candidateName: body.candidate_name,
        candidateEmail: body.candidate_email || null,
        managerProfileId: body.manager_profile_id || 'manager-default-v1',
        assignmentType: body.assignmentType || body.assignment_type || 'hiring_exam',
        assessmentPackId: body.assessmentPackId || body.assessment_pack_id || null,
        baseUrl,
      });
      return NextResponse.json(result);
    } catch (err: any) {
      if (err?.code === 'TRAINING_SHIFT_NOT_AVAILABLE') {
      return failWithCustomCode('TRAINING_SHIFT_NOT_AVAILABLE', 'Training Shift assignments are not yet available. Coming soon.', 400);
      }
      return NextResponse.json({ error: err?.message || 'Failed to create assessment' }, { status: 400 });
    }
  } catch (err) {
    console.error('[MVP] Create assessment error:', err);
    return NextResponse.json({ error: 'Failed to create assessment' }, { status: 500 });
  }
}

export async function GET() {
  try {
    initTables();
    const { getAllAssessments } = await import('@/lib/mvp/query');
    const assessments = getAllAssessments();
    return NextResponse.json({ assessments });
  } catch (err) {
    console.error('[MVP] List assessments error:', err);
    return NextResponse.json({ error: 'Failed to list assessments' }, { status: 500 });
  }
}
