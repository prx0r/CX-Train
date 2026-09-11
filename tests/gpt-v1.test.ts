import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/* Isolated tmp DB per file run. Must precede lib imports. */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gptv1-'));
process.env.MVP_SQLITE_PATH = path.join(tmp, 'test.db');

import { getDb, initTables, seedDefaults } from '../lib/mvp/db';
import * as V1 from '../lib/gpt/v1';
import { createCallumProposal } from '../lib/mvp/callum/proposals';

before(() => {
  initTables();
  seedDefaults();
  getDb().prepare(
    `INSERT INTO taxonomy_items (id, type, sub_type, item, definition_scope, keywords)
     VALUES ('taxonomy-1','Incident','Email','Outlook offline mode stuck','outlook offline','outlook, offline, outbox')`
  ).run();
});

describe('auth boundary (unit: verifyActionsKey contract)', () => {
  it('documents Bearer requirement for v2 ops', async () => {
    const { verifyActionsKey } = await import('../lib/callum-auth');
    assert.equal(verifyActionsKey({ headers: new Headers() } as any).valid, false);
  });
});

describe('v2 ops', () => {
  it('create -> review(full) -> candidateReport(stripped)', () => {
    const created = V1.createAssessment({ candidate_name: 'Test GPT' }, 'http://x');
    assert.equal(created.status, 200);
    const full = V1.managerReport(created.body.assessment_id || created.body.id);
    assert.equal(full.status, 200);
    const stripped = V1.candidateReport(created.body.assessment_id || created.body.id);
    assert.equal(stripped.status, 200);
    const raw = JSON.stringify(full.body);
    const clean = JSON.stringify(stripped.body);
    assert.match(raw, /hidden_facts_json/);
    for (const leak of ['hidden_truth', 'root_cause', 'correct_fix',
                        'hidden_facts_json', 'caller_behaviour_prompt',
                        'ideal_ticket_hints', 'ALDER-LT-023',
                        'standards_snapshot_json', 'criteria_json',
                        'good_ticket_example']) {
      assert.doesNotMatch(clean, new RegExp(leak));
    }
    assert.match(clean, /Test GPT/);
  });

  it('feedback label enum enforced', () => {
    const created = V1.createAssessment({ candidate_name: 'Fb' }, 'http://x');
    const id = created.body.assessment_id || created.body.id;
    const bad = V1.saveFeedback(id, { manager_label: 'meh' });
    assert.equal(bad.status, 400);
    const good = V1.saveFeedback(id, { manager_label: 'agree', manager_score: 90, notes: 'n' });
    assert.equal(good.status, 200);
  });

  it('standards round-trip', () => {
    const w = V1.writeStandards({ required_ticket_fields: ['summary'] });
    assert.equal(w.status, 200);
    const r = V1.readStandards();
    assert.equal(r.status, 200);
  });

  it('confirm/reject lifecycle', () => {
    const mk = () => createCallumProposal({
      proposalType: 'create_training_assignment',
      managerProfileId: 'manager-default-v1',
      payloadSchemaVersion: 'training-assignment-proposal-v1',
      payload: { assignmentType: 'training_drill', assessmentPackId: 'pack-outlook-sim-v2' },
    });
    const c = V1.confirmProposal(mk().id, {}, 'http://x');
    assert.equal(c.status, 200);
    const r = V1.rejectProposal(mk().id, {});
    assert.equal(r.status, 200);
    assert.equal(V1.confirmProposal('missing', {}, 'http://x').status, 404);
  });

  it('triage + taxonomy search + scenario', async () => {
    const t = await V1.triage('Outlook will not send, mails stuck in outbox');
    assert.equal(t.status, 200);
    const s = V1.searchTaxonomy('outlook', 10);
    assert.equal(s.status, 200);
    assert.ok(s.body.total >= 1);
    const g = await V1.generateScenario('taxonomy-102');
    assert.equal(g.status, 200);
    assert.equal((await V1.generateScenario('nope')).status, 404);  });
});
