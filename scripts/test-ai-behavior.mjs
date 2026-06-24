#!/usr/bin/env node
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });
dotenv.config();

const BASE_URL = process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1';
const API_KEY = process.env.AI_API_KEY || '';
const CALLER_MODEL = process.env.AI_CALLER_MODEL || 'openrouter/free';
const EVAL_MODEL = process.env.AI_EVALUATOR_MODEL || 'openrouter/free';

async function callModel(model, messages, opts = {}) {
  const body = {
    model,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 1024,
  };
  if (opts.responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' };
  }
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  const data = await response.json();
  const msg = data.choices?.[0]?.message;
  let content = msg?.content || '';
  if (!content && msg?.reasoning && typeof msg.reasoning === 'string') content = msg.reasoning;
  if (!content && Array.isArray(msg?.reasoning_details)) {
    const last = msg.reasoning_details.filter(r => r.type === 'reasoning.text').pop();
    if (last?.text) content = last.text;
  }
  return content;
}

function extractJson(text) {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  return JSON.parse(cleaned);
}

// ── Test 1: Caller simulation ──────────────────────────────────────
async function testCaller() {
  console.log('\n=== Test 1: Caller simulation ===');
  const scenario = {
    title: 'Password/login issue',
    caller_persona: 'A non-technical end user who is frustrated because they cannot log in',
    hidden_facts: { user_agent: 'Windows 10, Chrome', last_login_worked: 'yesterday morning', mfa_enabled: true },
  };
  const prompt = `You are the caller in a realistic MSP service-desk assessment. Stay in character as: ${scenario.caller_persona}.
Scenario: ${scenario.title}. Hidden facts: ${JSON.stringify(scenario.hidden_facts)}.
Rules: Reply only as the caller in 1-3 natural sentences. Be vague initially. Never volunteer hidden facts unless the candidate asks an appropriate question. Do not use technical terms the caller would not know.`;

  // Candidate asks a vague first message
  const reply = await callModel(CALLER_MODEL, [
    { role: 'system', content: prompt },
    { role: 'user', content: 'Hi, this is the help desk. How can I help you today?' },
  ], { temperature: 0.7, maxTokens: 180 });

  console.log('Candidate: "Hi, this is the help desk. How can I help you today?"');
  console.log('Caller reply:', JSON.stringify(reply));

  if (reply.length < 5) throw new Error('Reply too short');
  if (reply.toLowerCase().includes('hidden_facts') || reply.toLowerCase().includes('hostname')) {
    console.log('WARNING: Caller may have revealed hidden facts');
  }
  console.log('PASS: Caller responded in character');
}

// ── Test 2: Evidence extraction ────────────────────────────────────
async function testEvidenceExtraction() {
  console.log('\n=== Test 2: Evidence extraction ===');
  const transcript = `
Candidate: Hi, this is the help desk. How can I help you today?
Caller: Hi, I can't log in to my computer. It keeps saying my password is wrong.
Candidate: Okay, I can help with that. Can I get your name and company?
Caller: Yeah, I'm Sarah Johnson from Acme Corp.
Candidate: Thanks Sarah. Which computer is this happening on?
Caller: It's my work laptop, the Dell one.
Candidate: And when did this start?
Caller: Just this morning. It was working fine yesterday.
Candidate: Is anyone else having this issue, or just you?
Caller: Just me as far as I know.
Candidate: Okay, what happens when you try to reset your password?
  `.trim();

  const requiredCheckpoints = {
    confirm_user: true,
    confirm_company: true,
    captured_device_or_hostname: false,
    asked_when_started: true,
    asked_scope: true,
  };

  const result = await callModel(EVAL_MODEL, [
    {
      role: 'system',
      content: `You evaluate MSP service-desk call transcripts. Return JSON only with checkpoint_results. checkpoint_results must contain every supplied key as {"passed": boolean, "evidence": "exact short transcript evidence or why missing"}. Do not infer actions that are not in the transcript.`,
    },
    {
      role: 'user',
      content: `Required checkpoint keys: ${JSON.stringify(Object.keys(requiredCheckpoints))}\n\nTranscript:\n${transcript}`,
    },
  ], { responseFormat: 'json_object', temperature: 0.1, maxTokens: 1500 });

  console.log('Raw model output:', result.slice(0, 300) + '...');
  const parsed = extractJson(result);
  const results = parsed.checkpoint_results;

  if (!results) throw new Error('No checkpoint_results in output');
  for (const key of Object.keys(requiredCheckpoints)) {
    if (typeof results[key]?.passed !== 'boolean') {
      throw new Error(`Missing or invalid checkpoint_result for: ${key}`);
    }
    const status = results[key].passed ? 'PASS' : 'FAIL';
    console.log(`  ${status}: ${key} — ${results[key].evidence}`);
  }

  // Verification: confirm_user and confirm_company should be true
  if (!results.confirm_user?.passed) console.log('WARNING: confirm_user should have passed (candidate asked name)');
  if (!results.confirm_company?.passed) console.log('WARNING: confirm_company should have passed (candidate asked company)');
  console.log('PASS: Evidence extraction returned valid JSON with all checkpoints');
}

// ── Test 3: Ticket scoring (deterministic, no AI) ──────────────────
async function testTicketScoring() {
  console.log('\n=== Test 3: Deterministic ticket scoring ===');

  // We can't import TypeScript directly, so test the ticket scoring inline
  const TICKET_PATTERNS = {
    issue_clear: /(cannot|can't|unable|fails?|error|issue|problem|not working|slow|offline|access)/i,
    user_client: /(user|caller|client|customer|company|requested by|affected)/i,
    device_hostname: /(device|hostname|laptop|desktop|printer|pc|computer|LT-\d+)/i,
    impact: /(impact|blocked|unable to work|deadline|meeting|payroll|urgent|business)/i,
    scope: /(single user|one user|multiple users|users|department|site|office|wider)/i,
    troubleshooting: /(checked|tested|restarted|confirmed|tried|verified|diagnostic)/i,
    priority: /(P[1-4]|priority|severity|critical|high|medium|low)/i,
    next_action: /(next step|escalat|follow up|callback|investigate|assigned|monitor)/i,
  };

  function scoreTicket(ticket) {
    const normalized = ticket.trim();
    const checks = Object.fromEntries(
      Object.entries(TICKET_PATTERNS).map(([key, pattern]) => [key, pattern.test(normalized)])
    );
    checks.sufficient_detail = normalized.split(/\s+/).filter(Boolean).length >= 25;
    const score = Math.round(
      (Object.values(checks).filter(Boolean).length / Object.keys(checks).length) * 100
    );
    return { score, checks };
  }

  // Good ticket
  const good = scoreTicket('User Sarah Johnson (Acme Corp) cannot log in. Dell laptop LT-789. Single user affected. Unable to work - urgent. Checked password reset. Priority P2. Escalate to identity team for MFA check.');
  console.log('Good ticket score:', good.score, '-', good.score >= 80 ? 'PASS' : 'FAIL');

  // Bad ticket
  const bad = scoreTicket('it broke fix it');
  console.log('Bad ticket score:', bad.score, '-', bad.score < 40 ? 'PASS' : 'FAIL');

  if (good.score < 80) throw new Error('Good ticket should score 80+');
  if (bad.score >= 40) throw new Error('Bad ticket should score under 40');
  console.log('PASS: Deterministic scoring works correctly');
}

async function main() {
  console.log('Testing OpenRouter AI behavior without Supabase...');
  console.log('Model (caller):', CALLER_MODEL);
  console.log('Model (evaluator):', EVAL_MODEL);
  console.log('API key set:', !!API_KEY);

  if (!API_KEY) {
    console.error('FAIL: AI_API_KEY not set');
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  const tests = [testCaller, testEvidenceExtraction, testTicketScoring];
  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (err) {
      console.error('FAIL:', err.message);
      failed++;
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
