import { NextRequest, NextResponse } from 'next/server';
import { initTables } from '@/lib/mvp/db';
import { rejectCallumProposal } from '@/lib/mvp/callum/proposals';
import { getCallumManagerProfile, resolveManagerProfile } from '@/lib/mvp/callum/manager-profile';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    initTables();

    const body = await request.json().catch(() => ({}));
    const managerProfileId = resolveManagerProfile(body.managerProfileId || getCallumManagerProfile(request));

    const result = rejectCallumProposal({
      proposalId: params.id,
      managerProfileId,
    });

    if (!result.ok) {
      const status = result.code === 'NOT_FOUND' ? 404
        : result.code === 'FORBIDDEN' ? 403
          : result.code === 'NOT_PENDING' ? 409
            : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[Callum] Reject proposal error:', err);
    return NextResponse.json({ ok: false, code: 'REJECT_FAILED', message: String(err) }, { status: 500 });
  }
}
