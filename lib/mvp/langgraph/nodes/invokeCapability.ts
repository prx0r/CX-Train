import type { GraphState } from '../state';
import { invokeCapability as invokeRegisteredCapability } from '../../capabilities';

async function summarizeFailedCriteria(ctx: any): Promise<string[]> {
  const structured = ctx?.result?.structured;
  const criteria = structured?.evidence_extraction?.criteria || {};
  return Object.entries(criteria)
    .filter(([, v]: [string, any]) => v?.status === 'fail' || v?.status === 'not_observed')
    .slice(0, 5)
    .map(([key, v]: [string, any]) => {
      const note = typeof v?.notes === 'string' ? `: ${v.notes}` : '';
      return `${key}${note}`;
    });
}

function buildAssessmentExplanation(ctx: any): string {
  const score = ctx?.result?.overallScore;
  const label = ctx?.result?.readinessLabel || 'unknown';
  const summary = ctx?.result?.summary || 'No narrative summary is available.';
  const structured = ctx?.result?.structured;
  const gates: string[] = structured?.deterministic_score?.triggeredDealbreakers || [];
  const failedRequired: string[] = structured?.deterministic_score?.failedRequiredChecks || [];
  const failedCriteria: string[] = [];  // populated async below

  const parts = [
    `${ctx?.assessment?.candidateName || 'Candidate'} is currently marked ${label}${typeof score === 'number' ? ` with ${score}/100` : ''}.`,
    summary,
  ];

  if (gates.length > 0) parts.push(`Main caps or dealbreakers: ${gates.slice(0, 4).join(', ')}.`);
  if (failedRequired.length > 0) parts.push(`Required misses: ${failedRequired.slice(0, 4).join(', ')}.`);
  if (ctx?.dataGaps?.length > 0) parts.push(`Data gaps: ${ctx.dataGaps.join('; ')}.`);

  return parts.join('\n\n');
}

function chooseTrainingPack(ctx: any, packs: Array<{ id: string; title: string }>): string {
  if (ctx?.assessment?.assessmentPackId && packs.some(p => p.id === ctx.assessment.assessmentPackId)) {
    return ctx.assessment.assessmentPackId;
  }
  return packs[0]?.id || 'pack-outlook-sim-v2';
}

export async function invokeCapabilityNode(state: GraphState): Promise<Partial<GraphState>> {
  if (!state.intent) {
    return { errors: [...state.errors, 'No intent to route'] };
  }

  if (state.intent === 'navigate') {
    return {};
  }

  if (state.intent === 'general_question') {
    let message = 'I can help with assessment reviews, training proposals, and navigation. Open an assessment review page and ask what went wrong or what to assign next.';
    if (!state.assessmentContext) {
      message = 'I need an assessment page context before I can help. Open an assessment review page and ask me about it.';
    }
    return {
      activeCapability: null,
    };
  }

  if (state.intent === 'explain_assessment') {
    if (!state.assessmentContext) {
      return {
        activeCapability: null,
        errors: [...state.errors, 'No assessment context available for explanation'],
      };
    }
    return {
      activeCapability: {
        name: 'get_assessment_review_context',
        input: { assessmentId: state.assessmentContext.assessment.id },
        result: { ok: true, output: state.assessmentContext },
      },
    };
  }

  if (state.intent === 'suggest_next_training') {
    if (!state.assessmentContext) {
      return {
        activeCapability: null,
        errors: [...state.errors, 'Need assessment context to suggest training'],
      };
    }

    const packsResult = await invokeRegisteredCapability('list_sim_packs', {}, {
      managerProfileId: state.managerProfileId,
      threadId: state.thread?.id || state.threadId || '',
      pageContext: state.pageContext,
    });

    const packs = (packsResult.ok ? packsResult.output : []) as Array<{ id: string; title: string }>;
    const assessmentPackId = chooseTrainingPack(state.assessmentContext, packs);

    const proposal = await invokeRegisteredCapability('draft_training_assignment', {
      assessmentId: state.assessmentContext.assessment.id,
      assessmentPackId,
      rationale: `Based on ${state.assessmentContext.assessment.candidateName}'s assessment result.`,
    }, {
      managerProfileId: state.managerProfileId,
      threadId: state.thread?.id || state.threadId || '',
      pageContext: state.pageContext,
    });

    return {
      activeCapability: {
        name: 'draft_training_assignment',
        input: { assessmentId: state.assessmentContext.assessment.id, assessmentPackId },
        result: proposal as any,
      },
    };
  }

  return {};
}
