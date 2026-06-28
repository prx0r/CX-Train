import crypto from 'crypto';
import { getDb } from '../db';
import { makeId } from '../query';

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
  status: string;
  payload: Record<string, unknown>;
  expiresAt: string | null;
  sourceContextHash: string | null;
}

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
    status: 'pending',
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
    status: row.status,
    payload: JSON.parse(row.payload_json || '{}'),
    expiresAt: row.expires_at,
    sourceContextHash: row.source_context_hash,
  };
}
