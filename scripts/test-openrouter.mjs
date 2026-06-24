#!/usr/bin/env node
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });
dotenv.config();

const API_KEY = process.env.AI_API_KEY || '';
const BASE_URL = process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1';
const MODEL = process.env.AI_CALLER_MODEL || 'openrouter/free';

async function main() {
  const errors = [];

  if (!API_KEY) errors.push('AI_API_KEY is not set in environment');
  if (!process.env.AI_CALLER_MODEL) errors.push('AI_CALLER_MODEL is not set (will use default)');

  if (errors.length > 0) {
    for (const e of errors) console.error('FAIL:', e);
    process.exit(1);
  }

  console.log('Testing OpenRouter connection...');
  console.log('  Base URL:', BASE_URL);
  console.log('  Model:   ', MODEL);
  console.log('  Key set: ', API_KEY ? 'yes' : 'no');
  console.log();

  const body = {
    model: MODEL,
    messages: [
      { role: 'user', content: 'Reply with exactly one word: "ok".' },
    ],
    max_tokens: 10,
    temperature: 0,
  };

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (response.status === 401) {
      console.error('FAIL: OpenRouter returned 401 — API key is invalid or expired.');
      process.exit(1);
    }

    if (response.status === 429) {
      console.error('FAIL: OpenRouter returned 429 — rate limited.');
      process.exit(1);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown');
      console.error('FAIL: OpenRouter returned HTTP', response.status, text.slice(0, 500));
      process.exit(1);
    }

    const data = await response.json();

    if (data.error) {
      console.error('FAIL: OpenRouter API error:', data.error.message);
      process.exit(1);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error('FAIL: OpenRouter returned no choices');
      process.exit(1);
    }

    console.log('PASS: OpenRouter responded with:', JSON.stringify(content.trim()));
    console.log('PASS: API key is valid. Free models are reachable.');
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('FAIL: Request failed:', message);
    process.exit(1);
  }
}

main();
