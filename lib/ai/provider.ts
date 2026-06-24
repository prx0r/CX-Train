const MODEL_BY_TASK: Record<string, string | undefined> = {
  caller: process.env.AI_CALLER_MODEL,
  evaluator: process.env.AI_EVALUATOR_MODEL,
  ticket: process.env.AI_TICKET_MODEL,
  report: process.env.AI_REPORT_MODEL,
};

const BASE_URL = process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1';
const API_KEY = process.env.AI_API_KEY || '';

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
}

function getModel(task: string): string {
  const model = MODEL_BY_TASK[task];
  if (!model) {
    throw new Error(`No model configured for task "${task}". Set AI_${task.toUpperCase()}_MODEL env var.`);
  }
  return model;
}

export async function runAiTask(
  task: 'caller' | 'evaluator' | 'ticket' | 'report',
  opts: RunAiTaskOptions
): Promise<RunAiTaskResult> {
  const start = Date.now();
  const model = getModel(task);

  if (!API_KEY) {
    return { success: false, content: '', model, error: 'AI_API_KEY is not configured', durationMs: Date.now() - start };
  }

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 2048,
  };

  if (opts.responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' };
  }

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
      return { success: false, content: '', model, error: 'OpenRouter returned 401 — check your API key', durationMs: Date.now() - start };
    }

    if (response.status === 429) {
      return { success: false, content: '', model, error: 'OpenRouter returned 429 — rate limited. Wait and retry.', durationMs: Date.now() - start };
    }

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown');
      return { success: false, content: '', model, error: `OpenRouter HTTP ${response.status}: ${text.slice(0, 500)}`, durationMs: Date.now() - start };
    }

    const data = await response.json() as {
      choices?: { message?: { content?: string } }[];
      error?: { message: string };
    };

    if (data.error) {
      return { success: false, content: '', model, error: `OpenRouter error: ${data.error.message}`, durationMs: Date.now() - start };
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { success: false, content: '', model, error: 'OpenRouter returned no choices', durationMs: Date.now() - start };
    }

    return { success: true, content: content.trim(), model, durationMs: Date.now() - start };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, content: '', model, error: `OpenRouter request failed: ${message}`, durationMs: Date.now() - start };
  }
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
