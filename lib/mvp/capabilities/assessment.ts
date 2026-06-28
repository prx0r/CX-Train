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
  async handler(input, ctx) {
    if (!input?.assessmentId) throw new Error('assessmentId is required');
    return getManagerAssessmentContext(ctx.managerProfileId, input.assessmentId);
  },
};
