import type { GraphState } from '../state';
import { invokeCapability as invokeRegisteredCapability } from '../../capabilities';
import { runAiTask } from '../../../ai/provider';

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
    const systemPrompt = `You are Callum, an AI training and assessment assistant for a service desk training platform.

You help managers:
- Explain assessment results (scores, strengths, weaknesses)
- Suggest targeted training based on performance
- Navigate the platform

Keep answers concise and practical. You have access to deepseek-v4-flash for reasoning.

${state.assessmentContext ? `Current assessment context: ${state.assessmentContext.assessment.candidateName} (${state.assessmentContext.result?.readinessLabel || 'no result yet'})` : 'No specific assessment is loaded. Offer general help.'}`;

    const result = await runAiTask('callum', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: state.message },
      ],
      temperature: 0.3,
      maxTokens: 1024,
    });

    return {
      activeCapability: {
        name: 'general_llm_response',
        input: { message: state.message },
        result: result.success
          ? { ok: true, output: result.content }
          : { ok: false, error: result.error || 'AI call failed' },
      },
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
