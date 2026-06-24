const MODEL_BY_TASK: Record<string, string | undefined> = {
  caller: process.env.AI_CALLER_MODEL,
  evaluator: process.env.AI_EVALUATOR_MODEL,
  ticket: process.env.AI_TICKET_MODEL,
  report: process.env.AI_REPORT_MODEL,
};

const FALLBACK_CALLER = process.env.AI_FALLBACK_MODEL || '';
const BASE_URL = process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1';
const API_KEY = process.env.AI_API_KEY || '';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface RunAiTaskOptions {
  messages: Message[];
  responseFormat?: 'json_object' | 'text';
  temperature?: number;
  maxTokens?: number;
}

interface RunAiTaskResult {
  success: boolean;
  content: string;
  model: string;
  error?: string;
  durationMs: number;
  retryable?: boolean;
}

function getModel(task: string): string {
  const model = MODEL_BY_TASK[task];
  if (!model) {
    throw new Error(`No model configured for task "${task}". Set AI_${task.toUpperCase()}_MODEL env var.`);
  }
  return model;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function attemptRequest(
  model: string,
  opts: RunAiTaskOptions,
  start: number
): Promise<RunAiTaskResult> {
  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 2048,
  };

  if (opts.responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (response.status === 401) {
    return { success: false, content: '', model, error: 'OpenRouter returned 401 — check your API key', durationMs: Date.now() - start };
  }

  if (response.status === 429) {
    return { success: false, content: '', model, error: 'OpenRouter 429 — rate limited', durationMs: Date.now() - start, retryable: true };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => 'unknown');
    return { success: false, content: '', model, error: `OpenRouter HTTP ${response.status}: ${text.slice(0, 500)}`, durationMs: Date.now() - start };
  }

  const data = await response.json() as {
    choices?: { message?: { content?: string | null; reasoning?: string; reasoning_details?: { type: string; text: string }[] } }[];
    error?: { message: string };
  };

  if (data.error) {
    return { success: false, content: '', model, error: `OpenRouter error: ${data.error.message}`, durationMs: Date.now() - start };
  }

  const msg = data.choices?.[0]?.message;
  let content = msg?.content || '';

  // Some free models (e.g. DeepSeek R1) put the response in the reasoning field
  if (!content && msg?.reasoning && typeof msg.reasoning === 'string') {
    content = msg.reasoning;
  }
  if (!content && Array.isArray(msg?.reasoning_details)) {
    const last = msg.reasoning_details.filter(r => r.type === 'reasoning.text').pop();
    if (last?.text) content = last.text;
  }

  if (!content) {
    return { success: false, content: '', model, error: 'OpenRouter returned no choices', durationMs: Date.now() - start };
  }

  return { success: true, content: content.trim(), model, durationMs: Date.now() - start };
}

export async function runAiTask(
  task: 'caller' | 'evaluator' | 'ticket' | 'report',
  opts: RunAiTaskOptions
): Promise<RunAiTaskResult> {
  const start = Date.now();

  if (!API_KEY) {
    return { success: false, content: '', model: 'none', error: 'AI_API_KEY is not configured', durationMs: Date.now() - start };
  }

  let model: string;
  try {
    model = getModel(task);
  } catch (err) {
    return { success: false, content: '', model: 'none', error: err instanceof Error ? err.message : 'Unknown config error', durationMs: Date.now() - start };
  }

  let lastError = '';

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const currentModel = attempt === 0 ? model : (FALLBACK_CALLER || model);
    if (attempt > 0) {
      console.log(`[AI] Retry ${attempt} for task "${task}" with model "${currentModel}"`);
      await sleep(RETRY_DELAY_MS);
    }

    try {
      const result = await attemptRequest(currentModel, opts, start);
      if (result.success) return result;

      lastError = result.error || 'unknown error';

      if (result.retryable) continue;

      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = msg;
      console.error(`[AI] Attempt ${attempt + 1} failed for task "${task}": ${msg}`);
    }
  }

  return { success: false, content: '', model, error: `All retries exhausted for task "${task}": ${lastError}`, durationMs: Date.now() - start };
}

export function parseJsonResponse<T>(content: string): { data: T | null; error: string | null } {
  const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    const data = JSON.parse(cleaned) as T;
    return { data, error: null };
  } catch {
    return { data: null, error: 'Invalid JSON returned from model' };
  }
}
