import type { CapabilityDefinition } from '../contracts/capability';
import { getManagerAssessmentContext } from '../manager/context';

export const getAssessmentReviewContextCapability: CapabilityDefinition<
  { assessmentId: string },
  ReturnType<typeof getManagerAssessmentContext>
> = {
  name: 'get_assessment_review_context',
  domain: 'assessment',
  access: 'read',
  requiresConfirmation: false,
  inputSchemaVersion: 'get-assessment-review-context-input-v1',
  outputSchemaVersion: 'manager-assessment-context-v1',
  description: 'Load full assessment review context including score, transcript, ticket, events, and recording analysis for a given assessment ID.',
  inputFields: {
    assessmentId: { type: 'string', description: 'The assessment ID to load context for' },
  },
  async handler(input, ctx) {
    if (!input?.assessmentId) throw new Error('assessmentId is required');
    return getManagerAssessmentContext(ctx.managerProfileId, input.assessmentId);
  },
};
