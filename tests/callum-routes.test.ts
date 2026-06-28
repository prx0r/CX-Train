import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { initTables, closeDb, getDb } from '../lib/mvp/db';
import { createCallumProposal, confirmCallumProposal, rejectCallumProposal, TRAINING_ASSIGNMENT_PROPOSAL_SCHEMA_VERSION } from '../lib/mvp/callum/proposals';
import { ensureDefaultCapabilitiesRegistered } from '../lib/mvp/capabilities';
import { createMvpAssessment } from '../lib/mvp/assessments/create';
import { getCallumManagerProfile, resolveManagerProfile } from '../lib/mvp/callum/manager-profile';

process.env.MVP_SQLITE_PATH = `/tmp/callum-routes-${process.pid}.db`;

after(() => {
  closeDb();
  try { fs.unlinkSync(path.resolve(process.cwd(), process.env.MVP_SQLITE_PATH!)); } catch {}
});

function mockRequest(headers?: Record<string, string>): any {
  return {
    headers: {
      get: (name: string) => (headers || {})[name] || null,
    },
  };
}

test('status code mapping: confirm missing proposal returns NOT_FOUND', () => {
  initTables();
  const result = confirmCallumProposal({ proposalId: 'nonexistent', managerProfileId: 'manager-default-v1' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'NOT_FOUND');
});

test('status code mapping: confirm wrong manager returns FORBIDDEN', () => {
  initTables();
  const proposal = createCallumProposal({
    proposalType: 'create_training_assignment',
    managerProfileId: 'manager-a',
    payloadSchemaVersion: TRAINING_ASSIGNMENT_PROPOSAL_SCHEMA_VERSION,
    payload: { assignmentType: 'training_drill', assessmentPackId: 'pack-outlook-sim-v2' },
  });
  const result = confirmCallumProposal({ proposalId: proposal.id, managerProfileId: 'manager-b' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'FORBIDDEN');
});

test('status code mapping: confirm expired proposal returns EXPIRED', () => {
  initTables();
  const proposal = createCallumProposal({
    proposalType: 'create_training_assignment',
    managerProfileId: 'manager-default-v1',
    payloadSchemaVersion: TRAINING_ASSIGNMENT_PROPOSAL_SCHEMA_VERSION,
    payload: { assignmentType: 'training_drill', assessmentPackId: 'pack-outlook-sim-v2' },
    ttlMinutes: -1,
  });
  const result = confirmCallumProposal({ proposalId: proposal.id, managerProfileId: 'manager-default-v1' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'EXPIRED');
});

test('status code mapping: double-confirm returns NOT_PENDING', async () => {
  initTables();
  ensureDefaultCapabilitiesRegistered();
  const source = createMvpAssessment({ candidateName: 'Double', assignmentType: 'hiring_exam', baseUrl: 'http://localhost:3000' });
  const draft = await ensureDefaultCapabilitiesRegistered(); void draft;
  const cap = (await import('../lib/mvp/capabilities')).invokeCapability;
  const draftResult = await cap('draft_training_assignment', { assessmentId: source.assessment_id, assessmentPackId: 'pack-outlook-sim-v2' }, { managerProfileId: 'manager-default-v1' });
  assert.equal(draftResult.ok, true);
  const proposal = (draftResult.output as any);

  const first = confirmCallumProposal({ proposalId: proposal.id, managerProfileId: 'manager-default-v1', baseUrl: 'http://localhost:3000' });
  assert.equal(first.ok, true);

  const second = confirmCallumProposal({ proposalId: proposal.id, managerProfileId: 'manager-default-v1', baseUrl: 'http://localhost:3000' });
  assert.equal(second.ok, false);
  assert.equal(second.code, 'NOT_PENDING');
});

test('status code mapping: stale proposal returns STALE', async () => {
  initTables();
  ensureDefaultCapabilitiesRegistered();
  const source = createMvpAssessment({ candidateName: 'Stale Test', assignmentType: 'hiring_exam', baseUrl: 'http://localhost:3000' });
  const cap = (await import('../lib/mvp/capabilities')).invokeCapability;
  const draftResult = await cap('draft_training_assignment', { assessmentId: source.assessment_id, assessmentPackId: 'pack-outlook-sim-v2' }, { managerProfileId: 'manager-default-v1' });
  assert.equal(draftResult.ok, true);
  const proposal = (draftResult.output as any);

  getDb().prepare('UPDATE assessments SET status = ? WHERE id = ?').run('reviewed', source.assessment_id);

  const result = confirmCallumProposal({ proposalId: proposal.id, managerProfileId: 'manager-default-v1', baseUrl: 'http://localhost:3000' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'STALE');
});

test('status code mapping: reject returns proper codes', () => {
  initTables();
  const proposal = createCallumProposal({
    proposalType: 'create_training_assignment',
    managerProfileId: 'manager-a',
    payloadSchemaVersion: TRAINING_ASSIGNMENT_PROPOSAL_SCHEMA_VERSION,
    payload: { assignmentType: 'training_drill', assessmentPackId: 'pack-outlook-sim-v2' },
  });

  const forbidden = rejectCallumProposal({ proposalId: proposal.id, managerProfileId: 'manager-b' });
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.code, 'FORBIDDEN');

  const notFound = rejectCallumProposal({ proposalId: 'nonexistent', managerProfileId: 'manager-a' });
  assert.equal(notFound.ok, false);
  assert.equal(notFound.code, 'NOT_FOUND');
});

test('manager profile resolver falls back to default', () => {
  const req = mockRequest({});
  assert.equal(getCallumManagerProfile(req), 'manager-default-v1');
});

test('manager profile resolver reads x-manager-profile-id header', () => {
  const req = mockRequest({ 'x-manager-profile-id': 'manager-custom' });
  assert.equal(getCallumManagerProfile(req), 'manager-custom');
});

test('resolveManagerProfile prefers explicit value', () => {
  assert.equal(resolveManagerProfile('explicit-manager'), 'explicit-manager');
  assert.equal(resolveManagerProfile(null), 'manager-default-v1');
  assert.equal(resolveManagerProfile(undefined), 'manager-default-v1');
});

test('double-reject returns NOT_PENDING (atomicity check)', () => {
  initTables();
  const proposal = createCallumProposal({
    proposalType: 'create_training_assignment',
    managerProfileId: 'manager-default-v1',
    payloadSchemaVersion: TRAINING_ASSIGNMENT_PROPOSAL_SCHEMA_VERSION,
    payload: { assignmentType: 'training_drill', assessmentPackId: 'pack-outlook-sim-v2' },
  });

  const first = rejectCallumProposal({ proposalId: proposal.id, managerProfileId: 'manager-default-v1' });
  assert.equal(first.ok, true);

  const second = rejectCallumProposal({ proposalId: proposal.id, managerProfileId: 'manager-default-v1' });
  assert.equal(second.ok, false);
  assert.equal(second.code, 'NOT_PENDING');
});

test('concurrent confirmation atomicity - only one succeeds', async () => {
  initTables();
  ensureDefaultCapabilitiesRegistered();
  const source = createMvpAssessment({ candidateName: 'Concurrency', assignmentType: 'hiring_exam', baseUrl: 'http://localhost:3000' });
  const cap = (await import('../lib/mvp/capabilities')).invokeCapability;
  const draftResult = await cap('draft_training_assignment', { assessmentId: source.assessment_id, assessmentPackId: 'pack-outlook-sim-v2' }, { managerProfileId: 'manager-default-v1' });
  assert.equal(draftResult.ok, true);
  const proposal = (draftResult.output as any);

  const beforeCount = (getDb().prepare('SELECT COUNT(*) as c FROM assessments').get() as { c: number }).c;

  const results = await Promise.all([
    confirmCallumProposal({ proposalId: proposal.id, managerProfileId: 'manager-default-v1', baseUrl: 'http://localhost:3000' }),
    confirmCallumProposal({ proposalId: proposal.id, managerProfileId: 'manager-default-v1', baseUrl: 'http://localhost:3000' }),
    confirmCallumProposal({ proposalId: proposal.id, managerProfileId: 'manager-default-v1', baseUrl: 'http://localhost:3000' }),
  ]);

  const okCount = results.filter((r): r is { ok: true; status: 'executed' | 'rejected'; proposal: any; result?: unknown } => r.ok).length;
  const notPendingCount = results.filter(r => !r.ok && (r as any).code === 'NOT_PENDING').length;

  assert.equal(okCount, 1, 'Exactly one confirmation should succeed');
  assert.equal(notPendingCount, 2, 'Other two should get NOT_PENDING');

  const afterCount = (getDb().prepare('SELECT COUNT(*) as c FROM assessments').get() as { c: number }).c;
  assert.equal(afterCount, beforeCount + 1, 'Only one assessment should be created');
});
