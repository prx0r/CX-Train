import { NextRequest, NextResponse } from 'next/server';
import { initTables } from '@/lib/mvp/db';
import { resolveSimAssessment, resolveSimSession, SimResolutionError } from '@/lib/mvp/sim/resolver';

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    initTables();

    let view;
    try {
      view = resolveSimAssessment(params.token);
    } catch (err) {
      if (err instanceof SimResolutionError) {
        return NextResponse.json({ error: err.message }, { status: err.code === 'NOT_A_SIM_ASSESSMENT' ? 404 : 500 });
      }
      throw err;
    }

    if (!view.session_id) {
      return NextResponse.json({ error: 'No session found' }, { status: 404 });
    }

    if (!view.sim) {
      return NextResponse.json({ error: 'Remote tools not enabled for this pack' }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      data: view.sim,
    });
  } catch (err) {
    console.error('[MVP] Get sim error:', err);
    return NextResponse.json({ error: 'Failed to get sim state' }, { status: 500 });
  }
}
