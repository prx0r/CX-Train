import { describe, it } from 'node:test';
import assert from 'node:assert';
import { scanForSensitive, extractFacts } from '../lib/callum-actions';
import { verifyCallumActionAuth } from '../lib/actions-auth';

describe('Callum Actions — sensitivity scan', () => {
  it('detects obvious passwords', () => {
    const result = scanForSensitive('My password is Secret123!');
    assert.ok(result.hasSensitive, 'should detect password');
    assert.ok(result.matchedPatterns.length > 0);
  });

  it('detects API keys', () => {
    const result = scanForSensitive('API key: sk-abc123def456');
    assert.ok(result.hasSensitive);
  });

  it('detects MFA codes with value', () => {
    const result = scanForSensitive('MFA: 123456');
    assert.ok(result.hasSensitive);
  });

  it('detects MFA code pattern', () => {
    const result = scanForSensitive('MFA code 123456');
    assert.ok(result.hasSensitive);
  });

  it('detects password references', () => {
    const result = scanForSensitive('current password is Passw0rd!');
    assert.ok(result.hasSensitive);
  });

  it('passes clean text', () => {
    const result = scanForSensitive('User says they cannot log in. Error: account locked.');
    assert.ok(!result.hasSensitive, 'clean text should pass');
  });
});

describe('Callum Actions — fact extraction', () => {
  it('extracts client hint from "at Company" pattern', () => {
    const facts = extractFacts('User at Acme Corp cannot log in');
    assert.ok(facts.clientHint?.toLowerCase().includes('acme'));
  });

  it('extracts symptoms from ticket text', () => {
    const facts = extractFacts('Cannot log in. Error 1053. Account locked.');
    assert.ok(facts.symptoms.length >= 1);
  });

  it('extracts classification hint for login issues', () => {
    const facts = extractFacts('Password not working, cannot sign in');
    assert.ok(facts.classificationHint?.toLowerCase().includes('login') ||
              facts.classificationHint?.toLowerCase().includes('password'));
  });
});

describe('Callum Auth — API key verification', () => {
  const KEY = 'test-key-123';

  it('rejects missing auth header', () => {
    const old = process.env.CALLUM_ACTIONS_KEY;
    process.env.CALLUM_ACTIONS_KEY = 'test-key-123';
    const req = new Request('http://localhost', { headers: {} });
    assert.ok(!verifyCallumActionAuth(req));
    if (old) process.env.CALLUM_ACTIONS_KEY = old;
  });

  it('rejects wrong key', () => {
    const old = process.env.CALLUM_ACTIONS_KEY;
    process.env.CALLUM_ACTIONS_KEY = 'test-key-123';
    const req = new Request('http://localhost', {
      headers: { authorization: 'Bearer wrong-key' },
    });
    assert.ok(!verifyCallumActionAuth(req));
    if (old) process.env.CALLUM_ACTIONS_KEY = old;
  });

  it('accepts correct key', () => {
    const old = process.env.CALLUM_ACTIONS_KEY;
    process.env.CALLUM_ACTIONS_KEY = 'test-key-123';
    const req = new Request('http://localhost', {
      headers: { authorization: 'Bearer test-key-123' },
    });
    assert.ok(verifyCallumActionAuth(req));
    if (old) process.env.CALLUM_ACTIONS_KEY = old;
  });

  it('rejects when key is not configured', () => {
    const old = process.env.CALLUM_ACTIONS_KEY;
    delete process.env.CALLUM_ACTIONS_KEY;
    const req = new Request('http://localhost', {
      headers: { authorization: 'Bearer some-key' },
    });
    assert.ok(!verifyCallumActionAuth(req));
    if (old) process.env.CALLUM_ACTIONS_KEY = old;
  });
});
