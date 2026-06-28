import type { CapabilityDefinition } from '../contracts/capability';
import {
  createCallumProposal,
  TRAINING_ASSIGNMENT_PROPOSAL_SCHEMA_VERSION,
} from '../callum/proposals';
import { getManagerAssessmentContext } from '../manager/context';

export interface DraftTrainingAssignmentInput {
  assessmentId?: string;
  assessmentPackId: string;
  assignmentType?: 'training_drill';
  feedbackEnabled?: boolean;
  maxAttempts?: number;
  rationale?: string;
}

export const draftTrainingAssignmentCapability: CapabilityDefinition<DraftTrainingAssignmentInput, unknown> = {
  name: 'draft_training_assignment',
  domain: 'training',
  access: 'propose',
  requiresConfirmation: false,
  inputSchemaVersion: 'draft-training-assignment-input-v1',
  outputSchemaVersion: TRAINING_ASSIGNMENT_PROPOSAL_SCHEMA_VERSION,
  async handler(input, ctx) {
    if (!input?.assessmentPackId) throw new Error('assessmentPackId is required');
    const sourceContext = input.assessmentId
      ? getManagerAssessmentContext(ctx.managerProfileId, input.assessmentId)
      : null;
    return createCallumProposal({
      proposalType: 'create_training_assignment',
      managerProfileId: ctx.managerProfileId,
      sourceThreadId: ctx.threadId || null,
      sourceContext: sourceContext || ctx.pageContext,
      payloadSchemaVersion: TRAINING_ASSIGNMENT_PROPOSAL_SCHEMA_VERSION,
      payload: {
        assignmentType: 'training_drill',
        assessmentPackId: input.assessmentPackId,
        feedbackEnabled: input.feedbackEnabled ?? true,
        maxAttempts: input.maxAttempts ?? 3,
        sourceAssessmentId: input.assessmentId || null,
        candidateName: sourceContext?.assessment.candidateName || null,
        rationale: input.rationale || null,
      },
      validationResult: { valid: true, warnings: [] },
      ttlMinutes: 60 * 24,
    });
  },
};
