import type { GraphState, GraphResponse } from '../state';
import type { ManagerAssessmentContext } from '../../contracts/assessment';

function summarizeFailedCriteria(ctx: ManagerAssessmentContext): string[] {
  const structured = ctx.result?.structured as any;
  const criteria = structured?.evidence_extraction?.criteria || {};
  return Object.entries(criteria)
    .filter(([, value]: [string, any]) => value?.status === 'fail' || value?.status === 'not_observed')
    .slice(0, 5)
    .map(([key, value]: [string, any]) => {
      const note = typeof value?.notes === 'string' ? `: ${value.notes}` : '';
      return `${key}${note}`;
    });
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

export function produceResponseNode(state: GraphState): Partial<GraphState> {
  if (state.errors.length > 0) {
    const response: GraphResponse = {
      type: 'answer',
      threadId: state.thread?.id || state.threadId || '',
      message: `I ran into some issues: ${state.errors.join('; ')}`,
      confidence: 'low',
      dataGaps: [],
    };
    return { response };
  }

  if (state.intent === 'navigate' && state.targetRoute) {
    const response: GraphResponse = {
      type: 'navigation',
      threadId: state.thread?.id || state.threadId || '',
      message: `Opening ${state.targetRoute}.`,
      targetRoute: state.targetRoute,
    };
    return { response };
  }

  if (state.intent === 'suggest_next_training') {
    const cap = state.activeCapability;
    if (cap?.result?.ok && cap.name === 'draft_training_assignment') {
      const created = cap.result.output as any;
      const response: GraphResponse = {
        type: 'proposed_action',
        threadId: state.thread?.id || state.threadId || '',
        pendingActionId: created.id,
        message: `I recommend assigning a focused training drill. It is saved as a pending proposal, not executed.`,
        action: {
          type: 'create_training_assignment',
          payload: created.payload,
        },
      };
      return { response };
    }

    const response: GraphResponse = {
      type: 'answer',
      threadId: state.thread?.id || state.threadId || '',
      message: 'I need an assessment page context before I can suggest a targeted training assignment.',
      dataGaps: ['No assessment context'],
    };
    return { response };
  }

  if (state.intent === 'explain_assessment' && state.assessmentContext) {
    const messageOut = buildAssessmentExplanation(state.assessmentContext);
    const response: GraphResponse = {
      type: 'answer',
      threadId: state.thread?.id || state.threadId || '',
      message: messageOut,
      confidence: state.assessmentContext.result ? 'high' : 'low',
      dataGaps: state.assessmentContext.dataGaps,
    };
    return { response };
  }

  /* General question — use the AI response from invokeCapability if available */
  if (state.intent === 'general_question') {
    const cap = state.activeCapability;
    let message: string;
    if (cap?.result?.ok && cap.name === 'general_llm_response') {
      message = cap.result.output as string;
    } else if (cap?.result && !cap.result.ok) {
      message = `I tried to answer but hit an issue: ${(cap.result as any).error || 'Unknown error'}`;
    } else {
      message = state.assessmentContext
        ? `I'm reviewing ${state.assessmentContext.assessment.candidateName}'s assessment. Ask me about their score, weaknesses, or suggested next training.`
        : 'I can help with assessment reviews, training suggestions, and platform navigation. What would you like to know?';
    }

    const response: GraphResponse = {
      type: 'answer',
      threadId: state.thread?.id || state.threadId || '',
      message,
      confidence: cap?.result?.ok ? 'high' : 'medium',
      dataGaps: !state.assessmentContext ? ['No page entity context was provided'] : [],
    };
    return { response };
  }

  const response: GraphResponse = {
    type: 'answer',
    threadId: state.thread?.id || state.threadId || '',
    message: state.assessmentContext
      ? 'I can help with assessment reviews, training proposals, and navigation.'
      : 'I can help with assessment reviews, training proposals, and navigation. Open an assessment review page and ask what went wrong or what to assign next.',
    confidence: 'medium',
    dataGaps: !state.assessmentContext ? ['No page entity context was provided'] : [],
  };
  return { response };
}
