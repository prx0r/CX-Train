import { NextRequest, NextResponse } from 'next/server';
import { initTables, seedDefaults } from '@/lib/mvp/db';
import { ensureDefaultCapabilitiesRegistered } from '@/lib/mvp/capabilities';
import { getCallumManagerProfile, resolveManagerProfile } from '@/lib/mvp/callum/manager-profile';
import { buildCallumGraph } from '@/lib/mvp/langgraph/callumGraph';
import type { GraphState } from '@/lib/mvp/langgraph/state';

export async function POST(request: NextRequest) {
  try {
    initTables();
    seedDefaults();
    ensureDefaultCapabilitiesRegistered();

    const body = await request.json();
    const message = String(body.message || '').trim();
    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const managerProfileId = resolveManagerProfile(
      body.managerProfileId || getCallumManagerProfile(request)
    );

    const initialState: GraphState = {
      pageContext: body.pageContext || null,
      message,
      threadId: body.threadId || undefined,
      managerProfileId,
      thread: null,
      assessmentContext: null,
      intent: null,
      activeCapability: null,
      response: null,
      errors: [],
    };

    const runGraph = buildCallumGraph();
    const finalState = await runGraph(initialState);

    if (finalState.errors.length > 0 && !finalState.response) {
      return NextResponse.json({
        error: 'Graph execution failed',
        details: finalState.errors,
      }, { status: 500 });
    }

    return NextResponse.json(finalState.response);
  } catch (err) {
    console.error('[Callum v2] API error:', err);
    return NextResponse.json({ error: 'Callum request failed', detail: String(err) }, { status: 500 });
  }
}
