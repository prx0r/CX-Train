import crypto from 'crypto';
import { createServerClient } from '@/lib/supabase';

export interface CreateInviteInput {
  tenantId: string;
  managerId: string;
  candidateName: string;
  candidateEmail?: string;
  assessmentPackId: string;
  expiresInDays?: number;
}

export interface CreateInviteResult {
  rawToken: string;
  inviteLink: string;
  invite: {
    id: string;
    candidateName: string;
    candidateEmail: string | null;
    status: string;
    expiresAt: string;
  };
}

export interface ValidatedInvite {
  id: string;
  tenantId: string;
  assessmentPackId: string;
  candidateName: string;
  candidateEmail: string | null;
  managerId: string;
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createInvite(input: CreateInviteInput): Promise<CreateInviteResult> {
  const supabase = createServerClient();
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (input.expiresInDays ?? 7));

  const { data: invite, error } = await supabase.from('candidate_invites').insert({
    tenant_id: input.tenantId,
    manager_id: input.managerId,
    assessment_pack_id: input.assessmentPackId,
    candidate_name: input.candidateName,
    candidate_email: input.candidateEmail ?? null,
    token_hash: tokenHash,
    status: 'pending',
    expires_at: expiresAt.toISOString(),
  }).select('id, candidate_name, candidate_email, status, expires_at').single();

  if (error || !invite) throw new Error(`Failed to create invite: ${error?.message ?? 'unknown'}`);

  const link = `${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/candidate/invite/${rawToken}`;

  return {
    rawToken,
    inviteLink: link,
    invite: {
      id: invite.id,
      candidateName: invite.candidate_name,
      candidateEmail: invite.candidate_email,
      status: invite.status,
      expiresAt: invite.expires_at,
    },
  };
}

export async function validateInviteToken(rawToken: string): Promise<ValidatedInvite | { error: string; reason: string }> {
  const tokenHash = hashToken(rawToken);
  const supabase = createServerClient();

  const { data: invite } = await supabase
    .from('candidate_invites')
    .select('id, tenant_id, assessment_pack_id, candidate_name, candidate_email, manager_id, status, expires_at')
    .eq('token_hash', tokenHash)
    .single();

  if (!invite) return { error: 'invalid', reason: 'Invite not found' };

  if (invite.status === 'revoked') return { error: 'revoked', reason: 'This invite has been revoked by your manager' };
  if (invite.status === 'completed') return { error: 'completed', reason: 'This assessment has already been completed' };

  const expiresAt = new Date(invite.expires_at);
  if (expiresAt.getTime() <= Date.now()) return { error: 'expired', reason: 'This invite has expired' };

  return {
    id: invite.id,
    tenantId: invite.tenant_id,
    assessmentPackId: invite.assessment_pack_id,
    candidateName: invite.candidate_name,
    candidateEmail: invite.candidate_email,
    managerId: invite.manager_id,
  };
}

export async function revokeInvite(inviteId: string): Promise<boolean> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from('candidate_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId);
  return !error;
}

export async function markInviteStarted(inviteId: string): Promise<boolean> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from('candidate_invites')
    .update({ status: 'started', started_at: new Date().toISOString() })
    .eq('id', inviteId);
  return !error;
}

export async function markInviteCompleted(inviteId: string): Promise<boolean> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from('candidate_invites')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', inviteId);
  return !error;
}
