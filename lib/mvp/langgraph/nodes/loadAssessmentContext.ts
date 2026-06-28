import type { GraphState } from '../state';
import { invokeCapability } from '../../capabilities';

export async function loadAssessmentContextNode(state: GraphState): Promise<Partial<GraphState>> {
  if (!state.pageContext?.entity || state.pageContext.entity.type !== 'assessment') {
    return {};
  }

  const assessmentId = state.pageContext.entity.id;
  if (!assessmentId) return {};

  const result = await invokeCapability('get_assessment_review_context', { assessmentId }, {
    managerProfileId: state.managerProfileId,
    threadId: state.thread?.id || state.threadId || '',
    pageContext: state.pageContext,
  });

  if (!result.ok) {
    return {
      assessmentContext: null,
      errors: [...state.errors, `Failed to load assessment context: ${result.error}`],
    };
  }

  return { assessmentContext: result.output as any };
}
