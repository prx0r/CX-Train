import assert from 'node:assert/strict';
import test from 'node:test';
import { createSession, getSession, addTurn, updateSessionStatus, getHistory } from '../lib/voice/session';
import { MockSttProvider } from '../lib/voice/stt';
import { MockTtsProvider } from '../lib/voice/tts';
import { MockClientBrain } from '../lib/voice/client-brain';
import { estimateCost } from '../lib/voice/cost-tracker';

test('createSession creates a new voice session', () => {
  const session = createSession({
    assessmentSessionId: 'test-session-1',
    inviteToken: 'abc123',
    scenarioId: 'scenario-1',
    scenarioTitle: 'Outlook not sending',
    candidateName: 'Tom',
  });
  assert.ok(session.id);
  assert.equal(session.status, 'in_progress');
  assert.equal(session.currentTurnIndex, 0);
  assert.equal(session.history.length, 0);
  assert.equal(session.estimatedCostUsd, 0);
});

test('getSession retrieves a created session', () => {
  const session = createSession({
    assessmentSessionId: 'test-session-2',
    inviteToken: 'abc456',
    scenarioId: 'scenario-1',
    scenarioTitle: 'Password/login issue',
    candidateName: 'Alice',
  });
  const retrieved = getSession(session.id);
  assert.ok(retrieved);
  assert.equal(retrieved?.candidateName, 'Alice');
  assert.equal(retrieved?.scenarioTitle, 'Password/login issue');
});

test('getSession returns undefined for unknown id', () => {
  const session = getSession('nonexistent');
  assert.equal(session, undefined);
});

test('addTurn stores a candidate turn and increments turn index', () => {
  const session = createSession({
    assessmentSessionId: 'test-session-3',
    inviteToken: 'abc789',
    scenarioId: 'scenario-1',
    scenarioTitle: 'Outlook not sending',
    candidateName: 'Bob',
  });
  const turn = addTurn({
    sessionId: session.id,
    speaker: 'candidate',
    text: 'Hello, this is Bob from Acme.',
    sttModel: 'mock',
    sttConfidence: 0.95,
    audioDurationMs: 2000,
  });
  assert.ok(turn);
  assert.equal(turn?.turnIndex, 1);
  assert.equal(turn?.speaker, 'candidate');

  const updated = getSession(session.id);
  assert.equal(updated?.currentTurnIndex, 1);
  assert.equal(updated?.history.length, 1);
});

test('addTurn stores a client turn', () => {
  const session = createSession({
    assessmentSessionId: 'test-session-4',
    inviteToken: 'abc000',
    scenarioId: 'scenario-1',
    scenarioTitle: 'Printer not printing',
    candidateName: 'Carol',
  });
  addTurn({ sessionId: session.id, speaker: 'candidate', text: 'Hello?', sttModel: 'mock' });
  const turn = addTurn({
    sessionId: session.id,
    speaker: 'client',
    text: "Hi, I can't print.",
    ttsModel: 'mock',
    llmModel: 'mock',
    llmInputTokens: 50,
    llmOutputTokens: 30,
  });
  assert.ok(turn);
  assert.equal(turn?.speaker, 'client');
  assert.equal(turn?.turnIndex, 2);

  const updated = getSession(session.id);
  assert.equal(updated?.llmInputTokens, 50);
  assert.equal(updated?.llmOutputTokens, 30);
});

test('addTurn returns null for unknown session', () => {
  const turn = addTurn({ sessionId: 'nonexistent', speaker: 'candidate', text: 'test' });
  assert.equal(turn, null);
});

test('updateSessionStatus changes status', () => {
  const session = createSession({
    assessmentSessionId: 'test-session-5',
    inviteToken: 'abc111',
    scenarioId: 'scenario-1',
    scenarioTitle: 'Outlook not sending',
    candidateName: 'Dave',
  });
  assert.ok(updateSessionStatus(session.id, 'ended'));
  const updated = getSession(session.id);
  assert.equal(updated?.status, 'ended');
  assert.ok(updated?.endedAt);
});

test('updateSessionStatus returns false for unknown session', () => {
  assert.equal(updateSessionStatus('nonexistent', 'completed'), false);
});

test('getHistory returns turns in order', () => {
  const session = createSession({
    assessmentSessionId: 'test-session-6',
    inviteToken: 'abc222',
    scenarioId: 'scenario-1',
    scenarioTitle: 'Printer not printing',
    candidateName: 'Eve',
  });
  addTurn({ sessionId: session.id, speaker: 'candidate', text: 'Hello', sttModel: 'mock' });
  addTurn({ sessionId: session.id, speaker: 'client', text: 'Hi, printer issue.', ttsModel: 'mock' });
  addTurn({ sessionId: session.id, speaker: 'candidate', text: 'What error?', sttModel: 'mock' });

  const history = getHistory(session.id);
  assert.equal(history.length, 3);
  assert.equal(history[0].speaker, 'candidate');
  assert.equal(history[0].text, 'Hello');
  assert.equal(history[1].speaker, 'client');
  assert.equal(history[2].speaker, 'candidate');
});

// ── Provider tests ────────────────────────────────────────────────────

test('MockSttProvider returns text with confidence', async () => {
  const stt = new MockSttProvider();
  const result = await stt.transcribe('fakebase64', 'audio/wav');
  assert.ok(typeof result.text === 'string');
  assert.ok(result.text.length > 0);
  assert.ok((result.confidence ?? 0) > 0);
  assert.equal(result.model, 'mock');
});

test('MockTtsProvider returns silent audio base64', async () => {
  const tts = new MockTtsProvider();
  const result = await tts.speak('Hello, this is a test.');
  assert.ok(typeof result.audioBase64 === 'string');
  assert.ok(result.audioBase64.length > 0);
  assert.ok(result.durationMs > 0);
  assert.equal(result.model, 'mock/silence');

  // Verify it decodes to a valid WAV
  const buffer = Buffer.from(result.audioBase64, 'base64');
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buffer.toString('ascii', 8, 12), 'WAVE');
});

test('MockClientBrain returns a response for first turn', async () => {
  const brain = new MockClientBrain();
  const result = await brain.nextClientTurn(
    { scenarioId: 's1', scenarioTitle: 'Outlook not sending', hiddenFacts: {}, callerPersona: 'Frustrated user', intensity: 2 },
    [],
  );
  assert.ok(typeof result.text === 'string');
  assert.ok(result.text.length > 0);
  assert.ok(result.labels?.includes('call_opening'));
});

test('MockClientBrain returns followups for subsequent turns', async () => {
  const brain = new MockClientBrain();
  const config = { scenarioId: 's1', scenarioTitle: 'Outlook not sending', hiddenFacts: {}, callerPersona: 'Frustrated user', intensity: 2 };

  const first = await brain.nextClientTurn(config, [{ speaker: 'candidate', text: 'Hello?' }]);
  assert.ok(first.text.length > 0);

  const second = await brain.nextClientTurn(config, [
    { speaker: 'candidate', text: 'Hello?' },
    { speaker: 'client', text: first.text },
    { speaker: 'candidate', text: 'When did this start?' },
  ]);
  assert.ok(second.text.length > 0);
});

// ── Cost tracker tests ─────────────────────────────────────────────────

test('estimateCost returns 0 for mock provider', () => {
  const cost = estimateCost('mock', 60, 30, 1000, 500, 200);
  assert.equal(cost, 0);
});

test('estimateCost returns positive for openai', () => {
  const cost = estimateCost('openai', 60, 30, 1000, 500, 200);
  assert.ok(cost > 0);
});

test('estimateCost scales with usage', () => {
  const small = estimateCost('openai', 10, 5, 100, 50, 20);
  const large = estimateCost('openai', 100, 50, 1000, 500, 200);
  assert.ok(large > small);
});
