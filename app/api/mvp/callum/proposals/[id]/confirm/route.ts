import { NextRequest, NextResponse } from 'next/server';
import { initTables, seedDefaults } from '@/lib/mvp/db';
import { confirmCallumProposal } from '@/lib/mvp/callum/proposals';

const DEFAULT_MANAGER_PROFILE_ID = 'manager-default-v1';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    initTables();
    seedDefaults();

    const body = await request.json().catch(() => ({}));
    const managerProfileId = body.managerProfileId || DEFAULT_MANAGER_PROFILE_ID;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'http://localhost:3000';

    const result = confirmCallumProposal({
      proposalId: params.id,
      managerProfileId,
      baseUrl,
    });

    if (!result.ok) {
      const status = result.code === 'NOT_FOUND' ? 404
        : result.code === 'FORBIDDEN' ? 403
          : result.code === 'EXPIRED' || result.code === 'STALE' || result.code === 'NOT_PENDING' ? 409
            : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[Callum] Confirm proposal error:', err);
    return NextResponse.json({ ok: false, code: 'CONFIRM_FAILED', message: String(err) }, { status: 500 });
  }
}
