import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { validateCallumPageContext } from '../lib/mvp/contracts/page-context';
import { validateSimPackDraft } from '../lib/mvp/contracts/sim-pack-draft';
import { ensureDefaultCapabilitiesRegistered, invokeCapability } from '../lib/mvp/capabilities';
import { initTables, closeDb } from '../lib/mvp/db';
import { getCallumProposal } from '../lib/mvp/callum/proposals';

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
