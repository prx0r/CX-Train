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
  description: 'Draft a training assignment proposal based on an assessment result. Creates a pending proposal that requires manager confirmation.',
  inputFields: {
    assessmentId: { type: 'string', description: 'The source assessment ID to base training on', optional: true },
    assessmentPackId: { type: 'string', description: 'Pack ID for the training drill (e.g. pack-outlook-sim-v2)' },
    rationale: { type: 'string', description: 'Why this training was suggested', optional: true },
    feedbackEnabled: { type: 'boolean', description: 'Enable in-session feedback during the drill', optional: true },
    maxAttempts: { type: 'number', description: 'Maximum retry attempts allowed', optional: true },
  },
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
