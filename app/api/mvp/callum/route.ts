import { NextRequest, NextResponse } from 'next/server';
import { initTables, seedDefaults } from '@/lib/mvp/db';
import { validateCallumPageContext, type CallumPageContext } from '@/lib/mvp/contracts/page-context';
import { getOrCreateCallumThread, appendCallumMessage } from '@/lib/mvp/callum/memory';
import { ensureDefaultCapabilitiesRegistered, invokeCapability } from '@/lib/mvp/capabilities';
import type { ManagerAssessmentContext } from '@/lib/mvp/contracts/assessment';
import { getCallumManagerProfile, resolveManagerProfile } from '@/lib/mvp/callum/manager-profile';

type CallumIntent = 'explain_assessment' | 'suggest_next_training' | 'navigate' | 'general_question';

function classifyIntent(message: string): CallumIntent {
  const m = message.toLowerCase();
  if (/\b(open|show|go to|navigate)\b/.test(m)) return 'navigate';
  if (/\b(assign|training|drill|retry|practice|improve)\b/.test(m)) return 'suggest_next_training';
  if (/\b(why|score|failed|fail|low|wrong|explain|cost)\b/.test(m)) return 'explain_assessment';
  return 'general_question';
}

function resolveNavigation(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('standards')) return '/mvp/standards';
  if (m.includes('system')) return '/mvp/system';
  if (m.includes('settings')) return '/mvp/settings';
  if (m.includes('assessment')) return '/mvp/assessments';
  if (m.includes('dashboard') || m.includes('home')) return '/mvp';
  return '/mvp/assessments';
}

function firstAssessmentId(pageContext: CallumPageContext | null): string | null {
  if (pageContext?.entity?.type === 'assessment' && pageContext.entity.id) {
    return pageContext.entity.id;
  }
  return null;
}

function summarizeFailedCriteria(ctx: ManagerAssessmentContext): string[] {
  const structured = ctx.result?.structured as any;
  const criteria = structured?.evidence_extraction?.criteria || {};
  const failed = Object.entries(criteria)
    .filter(([, value]: [string, any]) => value?.status === 'fail' || value?.status === 'not_observed')
    .slice(0, 5)
    .map(([key, value]: [string, any]) => {
      const note = typeof value?.notes === 'string' ? `: ${value.notes}` : '';
      return `${key}${note}`;
    });
  return failed;
}

function buildAssessmentExplanation(ctx: ManagerAssessmentContext): string {
  const score = ctx.result?.overallScore;
  const label = ctx.result?.readinessLabel || 'unknown';
  const summary = ctx.result?.summary || 'No narrative summary is available.';
  const structured = ctx.result?.structured as any;
  const gates: string[] = structured?.deterministic_score?.triggeredDealbreakers || [];
  const failedRequired: string[] = structured?.deterministic_score?.failedRequiredChecks || [];
  const failedCriteria = summarizeFailedCriteria(ctx);

  const parts = [
    `${ctx.assessment.candidateName} is currently marked ${label}${typeof score === 'number' ? ` with ${score}/100` : ''}.`,
    summary,
  ];

  if (gates.length > 0) {
    parts.push(`Main caps or dealbreakers: ${gates.slice(0, 4).join(', ')}.`);
  }
  if (failedRequired.length > 0) {
    parts.push(`Required misses: ${failedRequired.slice(0, 4).join(', ')}.`);
  }
  if (failedCriteria.length > 0) {
    parts.push(`Evidence gaps I would coach first: ${failedCriteria.join('; ')}.`);
  }
  if (ctx.dataGaps.length > 0) {
    parts.push(`Data gaps: ${ctx.dataGaps.join('; ')}.`);
  }

  return parts.join('\n\n');
}

function chooseTrainingPack(ctx: ManagerAssessmentContext, packs: Array<{ id: string; title: string }>): string {
  if (ctx.assessment.assessmentPackId && packs.some(p => p.id === ctx.assessment.assessmentPackId)) {
    return ctx.assessment.assessmentPackId;
  }
  return packs[0]?.id || 'pack-outlook-sim-v2';
}

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

    const managerProfileId = resolveManagerProfile(body.managerProfileId || getCallumManagerProfile(request));
    const pageContextResult = body.pageContext
      ? validateCallumPageContext(body.pageContext)
      : { valid: true, data: null, errors: [] as any[] };

    if (!pageContextResult.valid) {
      return NextResponse.json({ error: 'Invalid pageContext', details: pageContextResult.errors }, { status: 400 });
    }

    const pageContext = pageContextResult.data || null;
    const thread = getOrCreateCallumThread({
      threadId: body.threadId || null,
      managerProfileId,
      pageContext,
    });

    appendCallumMessage({
      threadId: thread.id,
      role: 'user',
      content: message,
      metadata: { pageContext },
    });

    const intent = classifyIntent(message);

    if (intent === 'navigate') {
      const targetRoute = resolveNavigation(message);
      const response = { type: 'navigation', threadId: thread.id, message: `Opening ${targetRoute}.`, targetRoute };
      appendCallumMessage({ threadId: thread.id, role: 'assistant', content: response.message, metadata: response });
      return NextResponse.json(response);
    }

    const assessmentId = firstAssessmentId(pageContext);
    let assessmentContext: ManagerAssessmentContext | null = null;
    if (assessmentId) {
      const loaded = await invokeCapability('get_assessment_review_context', { assessmentId }, {
        managerProfileId,
        threadId: thread.id,
        pageContext,
      });
      assessmentContext = (loaded.ok ? loaded.output : null) as ManagerAssessmentContext | null;
    }

    if (intent === 'suggest_next_training') {
      if (!assessmentContext) {
        const response = {
          type: 'answer',
          threadId: thread.id,
          message: 'I need an assessment page context before I can suggest a targeted training assignment.',
        };
        appendCallumMessage({ threadId: thread.id, role: 'assistant', content: response.message, metadata: response });
        return NextResponse.json(response);
      }

      const packsResult = await invokeCapability('list_sim_packs', {}, { managerProfileId, threadId: thread.id, pageContext });
      const packs = (packsResult.ok ? packsResult.output : []) as Array<{ id: string; title: string }>;
      const assessmentPackId = chooseTrainingPack(assessmentContext, packs);
      const proposal = await invokeCapability('draft_training_assignment', {
        assessmentId: assessmentContext.assessment.id,
        assessmentPackId,
        rationale: `Based on ${assessmentContext.assessment.candidateName}'s assessment result.`,
      }, { managerProfileId, threadId: thread.id, pageContext });

      if (!proposal.ok) {
        return NextResponse.json({ error: proposal.error || 'Failed to create proposal' }, { status: 500 });
      }

      const created = proposal.output as any;
      const packTitle = packs.find(p => p.id === assessmentPackId)?.title || assessmentPackId;
      const response = {
        type: 'proposed_action',
        threadId: thread.id,
        pendingActionId: created.id,
        message: `I recommend assigning ${packTitle} as a focused training drill. It is saved as a pending proposal, not executed.`,
        action: {
          type: 'create_training_assignment',
          payload: created.payload,
        },
      };
      appendCallumMessage({ threadId: thread.id, role: 'assistant', content: response.message, metadata: response });
      return NextResponse.json(response);
    }

    if (assessmentContext) {
      const messageOut = buildAssessmentExplanation(assessmentContext);
      const response = {
        type: 'answer',
        threadId: thread.id,
        message: messageOut,
        confidence: assessmentContext.result ? 'high' : 'low',
        dataGaps: assessmentContext.dataGaps,
      };
      appendCallumMessage({ threadId: thread.id, role: 'assistant', content: response.message, metadata: response });
      return NextResponse.json(response);
    }

    const response = {
      type: 'answer',
      threadId: thread.id,
      message: 'I can help with assessment reviews, training proposals, and navigation. Open an assessment review page and ask what went wrong or what to assign next.',
      confidence: 'medium',
      dataGaps: ['No page entity context was provided'],
    };
    appendCallumMessage({ threadId: thread.id, role: 'assistant', content: response.message, metadata: response });
    return NextResponse.json(response);
  } catch (err) {
    console.error('[Callum] API error:', err);
    return NextResponse.json({ error: 'Callum request failed', detail: String(err) }, { status: 500 });
  }
}
