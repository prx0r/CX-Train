import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { validateCallumPageContext } from '../lib/mvp/contracts/page-context';
import { validateSimPackDraft } from '../lib/mvp/contracts/sim-pack-draft';
import { ensureDefaultCapabilitiesRegistered, invokeCapability } from '../lib/mvp/capabilities';
import { registerCapability } from '../lib/mvp/capabilities/registry';
import { initTables, closeDb } from '../lib/mvp/db';
import { getCallumProposal, confirmCallumProposal, rejectCallumProposal, createCallumProposal, TRAINING_ASSIGNMENT_PROPOSAL_SCHEMA_VERSION } from '../lib/mvp/callum/proposals';
import { createMvpAssessment } from '../lib/mvp/assessments/create';
import { getManagerAssessmentContext } from '../lib/mvp/manager/context';
import { getDb } from '../lib/mvp/db';

process.env.MVP_SQLITE_PATH = `/tmp/callum-contracts-${process.pid}.db`;

after(() => {
  closeDb();
  try { fs.unlinkSync(path.resolve(process.cwd(), process.env.MVP_SQLITE_PATH!)); } catch {}
});

test('Callum page context validates and normalizes assessment context', () => {
  const result = validateCallumPageContext({
    route: '/mvp/assessments/abc',
    pageType: 'assessment_review',
    assessmentId: 'abc',
    visibleSections: ['score_summary', 123, 'ticket'],
  });

  assert.equal(result.valid, true);
  assert.equal(result.data?.schemaVersion, 'callum-page-context-v1');
  assert.deepEqual(result.data?.entity, { type: 'assessment', id: 'abc' });
  assert.deepEqual(result.data?.visibleSections, ['score_summary', 'ticket']);
});

test('Callum page context rejects missing route', () => {
  const result = validateCallumPageContext({ pageType: 'assessment_review' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.path === 'route'));
});

test('Unknown page type normalizes safely', () => {
  const result = validateCallumPageContext({ route: '/mvp/weird', pageType: 'new_page_type' });
  assert.equal(result.valid, true);
  assert.equal(result.data?.pageType, 'unknown');
});

test('Sim pack draft validator accepts authoring shape and rejects incomplete drafts', () => {
  const valid = validateSimPackDraft({
    title: 'Outlook send receive issue',
    description: 'Candidate must diagnose Outlook not sending.',
    mode: 'call_plus_remote',
    level: 1,
    severity: 'P3',
    customer: {
      name: 'Sarah Thompson',
      company: 'Alder & Co',
      role: 'Accountant',
      temperament: 'stressed',
      openingLine: 'Outlook is not sending and I need help.',
    },
    hiddenTruth: {
      rootCause: 'Outlook is in Work Offline mode',
      correctFix: 'Disable Work Offline and send a test email',
      idealDiagnosticPath: ['check status bar', 'disable work offline', 'send test email'],
      factsOnlyRevealAfter: {},
    },
    expectedBehaviours: ['ask impact'],
    requiredTicketFields: ['user', 'impact'],
    redFlags: ['reinstall Office without evidence'],
    taxonomyClassification: ['incident.email.outlook'],
  });

  assert.equal(valid.valid, true);
  assert.equal(valid.data?.schemaVersion, 'sim-pack-draft-v1');

  const invalid = validateSimPackDraft({ title: 'Missing everything else' });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.length > 3);
});

test('Capability registry rejects unknown capabilities', async () => {
  ensureDefaultCapabilitiesRegistered();
  const result = await invokeCapability('does_not_exist', {}, { managerProfileId: 'manager-default-v1' });
  assert.equal(result.ok, false);
  assert.match(result.error || '', /Unknown capability/);
});

test('Execute capability requiring confirmation cannot run directly through generic registry', async () => {
  registerCapability({
    name: `dangerous_test_execute_${process.pid}`,
    domain: 'assessment',
    access: 'execute',
    requiresConfirmation: true,
    inputSchemaVersion: 'dangerous-input-v1',
    outputSchemaVersion: 'dangerous-output-v1',
    async handler() {
      return { shouldNotRun: true };
    },
  });

  const result = await invokeCapability(`dangerous_test_execute_${process.pid}`, {}, { managerProfileId: 'manager-default-v1' });
  assert.equal(result.ok, false);
  assert.match(result.error || '', /requires a confirmed proposal/);
});

test('Draft training assignment capability stores a pending proposal', async () => {
  initTables();
  ensureDefaultCapabilitiesRegistered();

  const result = await invokeCapability('draft_training_assignment', {
    assessmentId: 'assessment-1',
    assessmentPackId: 'pack-outlook-sim-v2',
    rationale: 'Candidate missed verification.',
  }, {
    managerProfileId: 'manager-default-v1',
    pageContext: { assessmentId: 'assessment-1' },
  });

  assert.equal(result.ok, true);
  const proposal = result.output as any;
  assert.equal(proposal.status, 'pending');
  assert.equal(proposal.proposalType, 'create_training_assignment');
  assert.equal(proposal.payload.assessmentPackId, 'pack-outlook-sim-v2');

  const persisted = getCallumProposal(proposal.id);
  assert.ok(persisted);
  assert.equal(persisted?.status, 'pending');
  assert.equal(persisted?.payload.assessmentPackId, 'pack-outlook-sim-v2');
});

test('Manager context reports data gaps when evidence is missing', () => {
  initTables();
  const created = createMvpAssessment({
    candidateName: 'No Evidence Candidate',
    assignmentType: 'hiring_exam',
    baseUrl: 'http://localhost:3000',
  });

  const ctx = getManagerAssessmentContext('manager-default-v1', created.assessment_id);
  assert.ok(ctx);
  assert.ok(ctx?.dataGaps.includes('No analysis result is available yet'));
  assert.ok(ctx?.dataGaps.includes('No submitted ticket is available'));
});

test('Confirming a pending training proposal executes assessment creation once', async () => {
  initTables();
  ensureDefaultCapabilitiesRegistered();
  const source = createMvpAssessment({
    candidateName: 'Confirm Candidate',
    assignmentType: 'hiring_exam',
    baseUrl: 'http://localhost:3000',
  });

  const draft = await invokeCapability('draft_training_assignment', {
    assessmentId: source.assessment_id,
    assessmentPackId: 'pack-outlook-sim-v2',
    rationale: 'Needs practice.',
  }, { managerProfileId: 'manager-default-v1' });

  assert.equal(draft.ok, true);
  const proposal = draft.output as any;
  const before = (getDb().prepare('SELECT COUNT(*) as c FROM assessments').get() as { c: number }).c;
  const confirmed = confirmCallumProposal({
    proposalId: proposal.id,
    managerProfileId: 'manager-default-v1',
    baseUrl: 'http://localhost:3000',
  });

  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.ok && confirmed.status, 'executed');
  const after = (getDb().prepare('SELECT COUNT(*) as c FROM assessments').get() as { c: number }).c;
  assert.equal(after, before + 1);
  assert.equal(getCallumProposal(proposal.id)?.status, 'executed');

  const second = confirmCallumProposal({
    proposalId: proposal.id,
    managerProfileId: 'manager-default-v1',
    baseUrl: 'http://localhost:3000',
  });
  assert.equal(second.ok, false);
  assert.equal(!second.ok && second.code, 'NOT_PENDING');
});

test('Rejecting a pending proposal prevents later confirmation', () => {
  initTables();
  const proposal = createCallumProposal({
    proposalType: 'create_training_assignment',
    managerProfileId: 'manager-default-v1',
    payloadSchemaVersion: TRAINING_ASSIGNMENT_PROPOSAL_SCHEMA_VERSION,
    payload: {
      assignmentType: 'training_drill',
      assessmentPackId: 'pack-outlook-sim-v2',
      maxAttempts: 3,
    },
  });

  const rejected = rejectCallumProposal({ proposalId: proposal.id, managerProfileId: 'manager-default-v1' });
  assert.equal(rejected.ok, true);
  assert.equal(getCallumProposal(proposal.id)?.status, 'rejected');

  const confirmRejected = confirmCallumProposal({ proposalId: proposal.id, managerProfileId: 'manager-default-v1' });
  assert.equal(confirmRejected.ok, false);
  assert.equal(!confirmRejected.ok && confirmRejected.code, 'NOT_PENDING');
});

test('Expired proposal cannot execute', () => {
  initTables();
  const proposal = createCallumProposal({
    proposalType: 'create_training_assignment',
    managerProfileId: 'manager-default-v1',
    payloadSchemaVersion: TRAINING_ASSIGNMENT_PROPOSAL_SCHEMA_VERSION,
    payload: {
      assignmentType: 'training_drill',
      assessmentPackId: 'pack-outlook-sim-v2',
      maxAttempts: 3,
    },
    ttlMinutes: -1,
  });

  const result = confirmCallumProposal({ proposalId: proposal.id, managerProfileId: 'manager-default-v1' });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, 'EXPIRED');
  assert.equal(getCallumProposal(proposal.id)?.status, 'expired');
});

test('Stale proposal cannot execute when source context hash changes', async () => {
  initTables();
  ensureDefaultCapabilitiesRegistered();
  const source = createMvpAssessment({
    candidateName: 'Stale Candidate',
    assignmentType: 'hiring_exam',
    baseUrl: 'http://localhost:3000',
  });

  const draft = await invokeCapability('draft_training_assignment', {
    assessmentId: source.assessment_id,
    assessmentPackId: 'pack-outlook-sim-v2',
  }, { managerProfileId: 'manager-default-v1' });
  assert.equal(draft.ok, true);
  const proposal = draft.output as any;

  getDb().prepare('UPDATE assessments SET status = ? WHERE id = ?').run('reviewed', source.assessment_id);

  const result = confirmCallumProposal({
    proposalId: proposal.id,
    managerProfileId: 'manager-default-v1',
    baseUrl: 'http://localhost:3000',
  });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, 'STALE');
  assert.equal(getCallumProposal(proposal.id)?.status, 'stale');
});

test('Proposal from one manager cannot be confirmed by another profile', () => {
  initTables();
  const proposal = createCallumProposal({
    proposalType: 'create_training_assignment',
    managerProfileId: 'manager-a',
    payloadSchemaVersion: TRAINING_ASSIGNMENT_PROPOSAL_SCHEMA_VERSION,
    payload: {
      assignmentType: 'training_drill',
      assessmentPackId: 'pack-outlook-sim-v2',
      maxAttempts: 3,
    },
  });

  const result = confirmCallumProposal({ proposalId: proposal.id, managerProfileId: 'manager-b' });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, 'FORBIDDEN');
  assert.equal(getCallumProposal(proposal.id)?.status, 'pending');
});

test('Candidate assessment routes do not import manager context', () => {
  const candidateRoutes = [
    'app/api/mvp/assessment/[token]/route.ts',
    'app/api/mvp/assessment/[token]/message/route.ts',
    'app/api/mvp/assessment/[token]/ticket/route.ts',
  ];

  for (const route of candidateRoutes) {
    const content = fs.readFileSync(path.resolve(process.cwd(), route), 'utf-8');
    assert.equal(content.includes('@/lib/mvp/manager/context'), false, `${route} imports manager context`);
    assert.equal(content.includes('lib/mvp/manager/context'), false, `${route} imports manager context`);
  }
});
