import crypto from 'crypto';
import { getDb } from '../db';
import { makeId } from '../query';
import { getManagerAssessmentContext } from '../manager/context';
import { createMvpAssessment } from '../assessments/create';

export const TRAINING_ASSIGNMENT_PROPOSAL_SCHEMA_VERSION = 'training-assignment-proposal-v1';

export interface CreateProposalInput {
  proposalType: string;
  managerProfileId: string;
  sourceThreadId?: string | null;
  sourceContext?: unknown;
  payloadSchemaVersion: string;
  payload: Record<string, unknown>;
  validationResult?: unknown;
  ttlMinutes?: number;
}

export interface CallumProposal {
  id: string;
  proposalType: string;
  managerProfileId: string;
  sourceThreadId: string | null;
  status: string;
  payloadSchemaVersion: string;
  payload: Record<string, unknown>;
  expiresAt: string | null;
  sourceContextHash: string | null;
}

export type ProposalResolution =
  | { ok: true; status: 'executed' | 'rejected'; proposal: CallumProposal; result?: unknown }
  | { ok: false; code: string; message: string; proposal?: CallumProposal };

export function hashContext(context: unknown): string | null {
  if (context == null) return null;
  return crypto.createHash('sha256').update(JSON.stringify(context)).digest('hex');
}

export function createCallumProposal(input: CreateProposalInput): CallumProposal {
  const db = getDb();
  const id = makeId();
  const expiresAt = input.ttlMinutes
    ? new Date(Date.now() + input.ttlMinutes * 60_000).toISOString()
    : new Date(Date.now() + 24 * 60 * 60_000).toISOString();
  const sourceContextHash = hashContext(input.sourceContext);

  db.prepare(`
    INSERT INTO callum_proposals (
      id, proposal_type, created_by, manager_profile_id, source_thread_id, source_context_hash,
      payload_schema_version, payload_json, status, validation_result_json, expires_at, created_at
    ) VALUES (?, ?, 'callum', ?, ?, ?, ?, ?, 'pending', ?, ?, datetime('now'))
  `).run(
    id,
    input.proposalType,
    input.managerProfileId,
    input.sourceThreadId || null,
    sourceContextHash,
    input.payloadSchemaVersion,
    JSON.stringify(input.payload),
    input.validationResult ? JSON.stringify(input.validationResult) : null,
    expiresAt,
  );

  return {
    id,
    proposalType: input.proposalType,
    managerProfileId: input.managerProfileId,
    sourceThreadId: input.sourceThreadId || null,
    status: 'pending',
    payloadSchemaVersion: input.payloadSchemaVersion,
    payload: input.payload,
    expiresAt,
    sourceContextHash,
  };
}

export function getCallumProposal(id: string): CallumProposal | null {
  const row = getDb().prepare('SELECT * FROM callum_proposals WHERE id = ?').get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    proposalType: row.proposal_type,
    managerProfileId: row.manager_profile_id,
    sourceThreadId: row.source_thread_id,
    status: row.status,
    payloadSchemaVersion: row.payload_schema_version,
    payload: JSON.parse(row.payload_json || '{}'),
    expiresAt: row.expires_at,
    sourceContextHash: row.source_context_hash,
  };
}

function markProposalStatus(
  id: string,
  status: string,
  extra?: { validationResult?: unknown; approved?: boolean; executed?: boolean; resolved?: boolean },
): void {
  const sets = ['status = ?', 'validation_result_json = COALESCE(?, validation_result_json)'];
  const values: unknown[] = [
    status,
    extra?.validationResult ? JSON.stringify(extra.validationResult) : null,
  ];

  if (extra?.approved) sets.push('approved_at = datetime(\'now\')');
  if (extra?.executed) sets.push('executed_at = datetime(\'now\')');
  if (extra?.resolved) sets.push('resolved_at = datetime(\'now\')');

  values.push(id);
  getDb().prepare(`UPDATE callum_proposals SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

function isExpired(proposal: CallumProposal, now = new Date()): boolean {
  return !!proposal.expiresAt && new Date(proposal.expiresAt).getTime() <= now.getTime();
}

function validateTrainingAssignmentPayload(payload: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (payload.assignmentType !== 'training_drill') errors.push('assignmentType must be training_drill');
  if (typeof payload.assessmentPackId !== 'string' || !payload.assessmentPackId) errors.push('assessmentPackId is required');
  if (payload.maxAttempts != null && (typeof payload.maxAttempts !== 'number' || payload.maxAttempts < 1)) {
    errors.push('maxAttempts must be a positive number');
  }
  return { valid: errors.length === 0, errors };
}

function currentSourceContextHash(proposal: CallumProposal): string | null {
  const sourceAssessmentId = proposal.payload.sourceAssessmentId;
  if (typeof sourceAssessmentId !== 'string' || !sourceAssessmentId) return null;
  const context = getManagerAssessmentContext(proposal.managerProfileId, sourceAssessmentId);
  return context ? hashContext(context) : null;
}

export function rejectCallumProposal(params: {
  proposalId: string;
  managerProfileId: string;
}): ProposalResolution {
  const proposal = getCallumProposal(params.proposalId);
  if (!proposal) return { ok: false, code: 'NOT_FOUND', message: 'Proposal not found' };
  if (proposal.managerProfileId !== params.managerProfileId) {
    return { ok: false, code: 'FORBIDDEN', message: 'Proposal belongs to another manager profile', proposal };
  }
  if (proposal.status !== 'pending') {
    return { ok: false, code: 'NOT_PENDING', message: `Proposal is already ${proposal.status}`, proposal };
  }

  markProposalStatus(proposal.id, 'rejected', { resolved: true });
  return { ok: true, status: 'rejected', proposal: getCallumProposal(proposal.id)! };
}

export function confirmCallumProposal(params: {
  proposalId: string;
  managerProfileId: string;
  baseUrl?: string;
}): ProposalResolution {
  const proposal = getCallumProposal(params.proposalId);
  if (!proposal) return { ok: false, code: 'NOT_FOUND', message: 'Proposal not found' };

  if (proposal.managerProfileId !== params.managerProfileId) {
    return { ok: false, code: 'FORBIDDEN', message: 'Proposal belongs to another manager profile', proposal };
  }

  if (proposal.status !== 'pending') {
    return { ok: false, code: 'NOT_PENDING', message: `Proposal is already ${proposal.status}`, proposal };
  }

  if (isExpired(proposal)) {
    markProposalStatus(proposal.id, 'expired', { resolved: true });
    return { ok: false, code: 'EXPIRED', message: 'Proposal has expired', proposal: getCallumProposal(proposal.id)! };
  }

  if (proposal.sourceContextHash) {
    const currentHash = currentSourceContextHash(proposal);
    if (!currentHash || currentHash !== proposal.sourceContextHash) {
      markProposalStatus(proposal.id, 'stale', {
        validationResult: { valid: false, reason: 'source_context_hash_changed', currentHash },
        resolved: true,
      });
      return {
        ok: false,
        code: 'STALE',
        message: 'Proposal is based on stale context. Regenerate it before executing.',
        proposal: getCallumProposal(proposal.id)!,
      };
    }
  }

  if (proposal.proposalType !== 'create_training_assignment'
    || proposal.payloadSchemaVersion !== TRAINING_ASSIGNMENT_PROPOSAL_SCHEMA_VERSION) {
    return { ok: false, code: 'UNSUPPORTED_TYPE', message: 'Unsupported proposal type or schema version', proposal };
  }

  const validation = validateTrainingAssignmentPayload(proposal.payload);
  if (!validation.valid) {
    markProposalStatus(proposal.id, 'failed', { validationResult: validation, resolved: true });
    return { ok: false, code: 'INVALID_PAYLOAD', message: validation.errors.join('; '), proposal: getCallumProposal(proposal.id)! };
  }

  try {
    const sourceAssessmentId = proposal.payload.sourceAssessmentId;
    const sourceContext = typeof sourceAssessmentId === 'string'
      ? getManagerAssessmentContext(proposal.managerProfileId, sourceAssessmentId)
      : null;
    const candidateName = typeof proposal.payload.candidateName === 'string'
      ? proposal.payload.candidateName
      : sourceContext?.assessment.candidateName
        ? `${sourceContext.assessment.candidateName} Training`
        : 'Training Candidate';

    markProposalStatus(proposal.id, 'approved', { approved: true });
    const result = createMvpAssessment({
      candidateName,
      candidateEmail: typeof proposal.payload.candidateEmail === 'string' ? proposal.payload.candidateEmail : null,
      managerProfileId: proposal.managerProfileId,
      assignmentType: 'training_drill',
      assessmentPackId: proposal.payload.assessmentPackId as string,
      baseUrl: params.baseUrl,
    });
    markProposalStatus(proposal.id, 'executed', { executed: true, resolved: true });
    return { ok: true, status: 'executed', proposal: getCallumProposal(proposal.id)!, result };
  } catch (err) {
    markProposalStatus(proposal.id, 'failed', {
      validationResult: { valid: false, reason: err instanceof Error ? err.message : String(err) },
      resolved: true,
    });
    return {
      ok: false,
      code: 'EXECUTION_FAILED',
      message: err instanceof Error ? err.message : String(err),
      proposal: getCallumProposal(proposal.id)!,
    };
  }
}
