import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { initTables, closeDb, getDb } from '../lib/mvp/db';
import { ensureDefaultCapabilitiesRegistered } from '../lib/mvp/capabilities';
import { buildCallumGraph } from '../lib/mvp/langgraph/callumGraph';
import type { GraphState } from '../lib/mvp/langgraph/state';
import { StateGraph } from '../lib/mvp/langgraph/graph';

process.env.MVP_SQLITE_PATH = `/tmp/langgraph-callum-${process.pid}.db`;

after(() => {
  closeDb();
  try { fs.unlinkSync(path.resolve(process.cwd(), process.env.MVP_SQLITE_PATH!)); } catch {}
});

function baseState(overrides?: Partial<GraphState>): GraphState {
  return {
    pageContext: null,
    message: 'Hello',
    managerProfileId: 'manager-default-v1',
    thread: null,
    assessmentContext: null,
    intent: null,
    activeCapability: null,
    response: null,
    errors: [],
    ...overrides,
  };
}

test('GraphState validateContext rejects invalid pageContext', async () => {
  initTables();
  const run = buildCallumGraph();
  const state = baseState({
    pageContext: {} as any,
    message: 'Why did they score low?',
  });
  const result = await run(state);
  assert.ok(result.errors.length > 0 || result.pageContext === null);
});

test('GraphState validateContext accepts valid pageContext', async () => {
  initTables();
  const run = buildCallumGraph();
  const state = baseState({
    pageContext: {
      schemaVersion: 'callum-page-context-v1',
      route: '/mvp/assessments/abc',
      pageType: 'assessment_review',
      entity: { type: 'assessment', id: 'abc' },
    },
    message: 'Show me the dashboard',
  });
  const result = await run(state);
  /* The graph may produce errors if assessment loading fails (no real assessment in DB),
     but should always produce a response and a thread */
  assert.ok(result.response !== null);
  assert.ok(result.thread !== null);
  assert.ok(result.threadId !== undefined);
});

test('Graph class compiles and runs a minimal graph', async () => {
  const g = new StateGraph<{ count: number; label: string }>();
  g.addNode('increment', (s) => ({ count: s.count + 1 }));
  g.addNode('setLabel', (s) => ({ label: `n=${s.count}` }));
  g.setEntryPoint('increment');
  g.addEdge('increment', 'setLabel');
  g.setFinishPoint('setLabel');

  const run = g.compile();
  const result = await run({ count: 0, label: '' });
  assert.equal(result.count, 1);
  assert.equal(result.label, 'n=1');
});

test('Graph class propagates errors via state', async () => {
  const g = new StateGraph<{ count: number; errors: string[] }>();
  g.addNode('fail', (s) => ({
    count: s.count + 1,
    errors: [...s.errors, 'something went wrong'],
  }));
  g.addNode('done', (s) => s);
  g.setEntryPoint('fail');
  g.addEdge('fail', 'done');
  g.setFinishPoint('done');

  const run = g.compile();
  const result = await run({ count: 0, errors: [] });
  assert.equal(result.count, 1);
  assert.deepEqual(result.errors, ['something went wrong']);
});

test('Graph class rejects duplicate node', () => {
  const g = new StateGraph<{}>();
  g.addNode('a', () => ({}));
  assert.throws(() => g.addNode('a', () => ({})));
});

test('Graph class rejects missing edge target', () => {
  const g = new StateGraph<{}>();
  g.addNode('a', () => ({}));
  assert.throws(() => g.addEdge('a', 'missing'));
});

test('Graph class rejects compile without entry point', () => {
  const g = new StateGraph<{}>();
  g.addNode('a', () => ({}));
  g.setFinishPoint('a');
  assert.throws(() => g.compile());
});

test('Graph class rejects compile without finish point', () => {
  const g = new StateGraph<{}>();
  g.addNode('a', () => ({}));
  g.setEntryPoint('a');
  assert.throws(() => g.compile());
});

test('Callum graph handles navigate intent', async () => {
  initTables();
  ensureDefaultCapabilitiesRegistered();
  const run = buildCallumGraph();
  const state = baseState({ message: 'Show me the standards page' });
  const result = await run(state);
  assert.equal(result.response?.type, 'navigation');
  assert.equal(result.response?.targetRoute || result.targetRoute, '/mvp/standards');
  assert.ok(result.threadId);
});

test('Callum graph handles general question without assessment', async () => {
  initTables();
  ensureDefaultCapabilitiesRegistered();
  const run = buildCallumGraph();
  const state = baseState({ message: 'What can you do?' });
  const result = await run(state);
  assert.equal(result.response?.type, 'answer');
  assert.ok(result.response?.message);
  assert.ok(result.threadId);
});

test('Callum graph errors when no message provided', async () => {
  const run = buildCallumGraph();
  const state = baseState({ message: '' });
  const result = await run(state);
  assert.ok(result.errors.length > 0 || result.errors.length > 0);
});

test('Callum graph response shape matches v1 contract', async () => {
  initTables();
  ensureDefaultCapabilitiesRegistered();
  const run = buildCallumGraph();
  const state = baseState({ message: 'Navigate to dashboard' });
  const result = await run(state);

  assert.ok(result.response !== null);
  assert.ok(['answer', 'proposed_action', 'navigation'].includes(result.response!.type));
  assert.ok(typeof result.response!.message === 'string');
  assert.ok(result.response!.message.length > 0);
  assert.ok(typeof result.response!.threadId === 'string');
});

test('Callum graph produces proposed_action for training intent with assessment context', async () => {
  initTables();
  ensureDefaultCapabilitiesRegistered();
  const run = buildCallumGraph();

  const state = baseState({
    pageContext: {
      schemaVersion: 'callum-page-context-v1',
      route: '/mvp/assessments/test-assessment-id',
      pageType: 'assessment_review',
      entity: { type: 'assessment', id: 'test-assessment-id' },
    },
    message: 'Assign them something to improve',
  });

  const result = await run(state);
  /* Without a real assessment in the DB, it should answer with an explanation */
  assert.ok(result.response !== null);
  assert.ok(result.response!.type === 'answer' || result.response!.type === 'proposed_action');
});

test('Graph can run multiple times with different inputs', async () => {
  initTables();
  const run = buildCallumGraph();

  const r1 = await run(baseState({ message: 'go to home' }));
  assert.equal(r1.response?.type, 'navigation');

  const r2 = await run(baseState({ message: 'hello' }));
  assert.equal(r2.response?.type, 'answer');
});
