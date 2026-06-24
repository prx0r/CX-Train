import type { EvaluationOutput, RubricItem } from '../types';
import { EVALUATOR_SYSTEM_PROMPT } from './prompts';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

export interface EvaluationInput {
  scenarioTitle: string;
  scenarioDescription: string;
  hiddenFacts: Record<string, unknown>;
  requiredCheckpoints: Record<string, boolean>;
  rubric: RubricItem[];
  transcript: string;
  turns: { speaker: string; text: string; turnIndex: number }[];
  ticket: string;
}

export interface EvaluationResult {
  output: EvaluationOutput;
  rawJson: string;
  model: string;
  promptVersion: string;
  rubricVersion: string;
  valid: boolean;
  errors: string[];
  provider: string;
}

function defaultEvaluation(errorMessage: string): EvaluationOutput {
  return {
    callSummary: `Evaluation failed: ${errorMessage}`,
    checkpointEvidence: [],
    skillLabels: [],
    riskLabels: [],
    scenarioLabels: [],
    dataQualityLabels: ['do_not_train'],
    coachingNotes: [],
  };
}

export function validateEvaluationOutput(json: unknown): { output: EvaluationOutput; errors: string[] } {
  const errors: string[] = [];
  const obj = (json ?? {}) as Record<string, unknown>;

  if (typeof obj.call_summary !== 'string') errors.push('call_summary must be a string');

  const checkpointEvidence: EvaluationOutput['checkpointEvidence'] = [];
  if (Array.isArray(obj.checkpoint_evidence)) {
    for (const item of obj.checkpoint_evidence) {
      const ce = item as Record<string, unknown>;
      if (typeof ce.checkpoint_key !== 'string') { errors.push('checkpoint_evidence item missing checkpoint_key'); continue; }
      if (!['observed', 'partially_observed', 'missed', 'not_applicable'].includes(String(ce.status))) { errors.push(`checkpoint ${ce.checkpoint_key}: invalid status`); continue; }
      checkpointEvidence.push({
        checkpointKey: String(ce.checkpoint_key),
        status: ce.status as EvaluationOutput['checkpointEvidence'][0]['status'],
        evidenceQuote: ce.evidence_quote != null ? String(ce.evidence_quote) : null,
        turnIndex: ce.turn_index != null ? Number(ce.turn_index) : null,
        reason: ce.reason != null ? String(ce.reason) : undefined,
        confidence: typeof ce.confidence === 'number' ? ce.confidence : 0,
      });
    }
  }

  const skillLabels: EvaluationOutput['skillLabels'] = [];
  if (Array.isArray(obj.skill_labels)) {
    for (const item of obj.skill_labels) {
      const sl = item as Record<string, unknown>;
      skillLabels.push({
        label: String(sl.label ?? ''),
        confidence: typeof sl.confidence === 'number' ? sl.confidence : 0,
        evidenceQuote: sl.evidence_quote != null ? String(sl.evidence_quote) : null,
      });
    }
  }

  const riskLabels: EvaluationOutput['riskLabels'] = [];
  if (Array.isArray(obj.risk_labels)) {
    for (const item of obj.risk_labels) {
      const rl = item as Record<string, unknown>;
      riskLabels.push({
        label: String(rl.label ?? ''),
        severity: (['low', 'medium', 'high'].includes(String(rl.severity)) ? String(rl.severity) : 'medium') as EvaluationOutput['riskLabels'][0]['severity'],
        confidence: typeof rl.confidence === 'number' ? rl.confidence : 0,
        evidenceQuote: rl.evidence_quote != null ? String(rl.evidence_quote) : null,
      });
    }
  }

  const scenarioLabels: string[] = Array.isArray(obj.scenario_labels) ? obj.scenario_labels.map(String) : [];
  const dataQualityLabels: string[] = Array.isArray(obj.data_quality_labels) ? obj.data_quality_labels.map(String) : [];
  const coachingNotes: string[] = Array.isArray(obj.coaching_notes) ? obj.coaching_notes.map(String) : [];

  return {
    output: {
      callSummary: String(obj.call_summary ?? ''),
      checkpointEvidence,
      skillLabels,
      riskLabels,
      scenarioLabels,
      dataQualityLabels,
      coachingNotes,
    },
    errors,
  };
}

export async function evaluateTranscript(
  input: EvaluationInput,
  _apiKey: string,
  openAIApiKey?: string
): Promise<EvaluationResult> {
  const model = 'callcallum-evaluator-v1';
  const promptVersion = '1.1.0';
  const rubricVersion = '1.0.0';

  const userPrompt = buildUserPrompt(input);

  let rawJson: string;
  let provider = 'mock';

  if (openAIApiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAIApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: EVALUATOR_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        return {
          output: defaultEvaluation(`LLM API error: ${response.status} ${errorText}`),
          rawJson: `API error: ${response.status}`,
          model,
          promptVersion,
          rubricVersion,
          valid: false,
          errors: [`API returned ${response.status}`],
          provider: 'openai',
        };
      }
      const data = await response.json() as { choices?: { message?: { content?: string } }[] };
      rawJson = data?.choices?.[0]?.message?.content ?? '{}';
      provider = 'openai';
    } catch (err) {
      return {
        output: defaultEvaluation(`LLM call failed: ${err instanceof Error ? err.message : String(err)}`),
        rawJson: `fetch error: ${err instanceof Error ? err.message : String(err)}`,
        model,
        promptVersion,
        rubricVersion,
        valid: false,
        errors: [`LLM fetch error: ${err instanceof Error ? err.message : String(err)}`],
        provider: 'openai',
      };
    }
  } else {
    const evaluatorModel = process.env.EVALUATOR_MODEL ?? 'openai/gpt-4o-mini';
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (openRouterKey) {
      try {
        const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openRouterKey}`,
            'HTTP-Referer': 'https://callcallum.app',
            'X-Title': 'CallCallum',
          },
          body: JSON.stringify({
            model: evaluatorModel,
            messages: [
              { role: 'system', content: EVALUATOR_SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' },
          }),
        });
        if (!response.ok) {
          const errorText = await response.text();
          return {
            output: defaultEvaluation(`OpenRouter eval error: ${response.status} ${errorText}`),
            rawJson: `API error: ${response.status}`,
            model: `openrouter/${evaluatorModel}`,
            promptVersion,
            rubricVersion,
            valid: false,
            errors: [`API returned ${response.status}`],
            provider: 'openrouter',
          };
        }
        const data = await response.json() as { usage?: { prompt_tokens: number; completion_tokens: number }; choices?: { message?: { content?: string } }[] };
        rawJson = data?.choices?.[0]?.message?.content ?? '{}';
        provider = 'openrouter';
      } catch (err) {
        return {
          output: defaultEvaluation(`OpenRouter eval failed: ${err instanceof Error ? err.message : String(err)}`),
          rawJson: `fetch error: ${err instanceof Error ? err.message : String(err)}`,
          model: `openrouter/${evaluatorModel}`,
          promptVersion,
          rubricVersion,
          valid: false,
          errors: [`LLM fetch error: ${err instanceof Error ? err.message : String(err)}`],
          provider: 'openrouter',
        };
      }
    } else {
      rawJson = buildMockEvaluation(input);
    }
  }

  try {
    const parsed = JSON.parse(rawJson);
    const { output, errors } = validateEvaluationOutput(parsed);
    return {
      output,
      rawJson,
      model,
      promptVersion,
      rubricVersion,
      valid: errors.length === 0,
      errors,
      provider,
    };
  } catch {
    return {
      output: defaultEvaluation('Invalid JSON from evaluator'),
      rawJson,
      model,
      promptVersion,
      rubricVersion,
      valid: false,
      errors: ['Failed to parse evaluator JSON output'],
      provider,
    };
  }
}

function buildUserPrompt(input: EvaluationInput): string {
  const checkpointLines = Object.entries(input.requiredCheckpoints)
    .filter(([, required]) => required)
    .map(([key]) => {
      const rubricItem = input.rubric.find((r) => r.key === key);
      const label = rubricItem?.label ?? key.replace(/_/g, ' ');
      return `  - ${key}: "${label}"`;
    })
    .join('\n');

  const turnLines = input.turns
    .map((t) => `[turn ${t.turnIndex}] ${t.speaker === 'candidate' ? 'Candidate' : 'Caller'}: ${t.text}`)
    .join('\n');

  return `## Scenario
Title: ${input.scenarioTitle}
Description: ${input.scenarioDescription}

## Hidden Facts (for context — never reveal these)
${JSON.stringify(input.hiddenFacts, null, 2)}

## Required Checkpoints
${checkpointLines}

## Transcript
${turnLines}

## Ticket Written by Candidate
${input.ticket || '(no ticket provided)'}

## Instructions
Produce a JSON evaluation following the schema. Return valid JSON only.`;
}

function buildMockEvaluation(input: EvaluationInput): string {
  const requiredKeys = Object.keys(input.requiredCheckpoints).filter((k) => input.requiredCheckpoints[k]);
  const checkpointEvidence = requiredKeys.map((key) => {
    const rubricItem = input.rubric.find((r) => r.key === key);
    const turnIndex = input.turns.find((t) =>
      t.text.toLowerCase().includes(key.replace(/^(ask_|capture_|confirm_|check_)/, '').replace(/_/g, ' '))
    )?.turnIndex ?? null;
    const observed = turnIndex !== null;
    return {
      checkpoint_key: key,
      status: observed ? 'observed' : 'missed',
      evidence_quote: observed ? input.turns.find((t) => t.turnIndex === turnIndex)?.text ?? null : null,
      turn_index: turnIndex,
      reason: observed ? `Candidate addressed ${rubricItem?.label ?? key}` : `No evidence of ${rubricItem?.label ?? key}`,
      confidence: observed ? 0.85 : 0.92,
    };
  });

  const skillLabels = [];
  if (checkpointEvidence.some((c) => c.status === 'observed' && (c.checkpoint_key.includes('confirm_user') || c.checkpoint_key.includes('confirm_company')))) {
    skillLabels.push({ label: 'confirmed_identity', confidence: 0.9, evidence_quote: null });
  }
  if (checkpointEvidence.some((c) => c.status === 'observed' && c.checkpoint_key.includes('business_impact'))) {
    skillLabels.push({ label: 'checked_impact', confidence: 0.85, evidence_quote: null });
  }

  const riskLabels = [];
  if (checkpointEvidence.some((c) => c.status === 'missed' && c.checkpoint_key.includes('scope'))) {
    riskLabels.push({ label: 'missed_scope_check', severity: 'high', confidence: 0.9, evidence_quote: null });
  }
  if (checkpointEvidence.some((c) => c.status === 'missed' && c.checkpoint_key.includes('impact'))) {
    riskLabels.push({ label: 'missed_impact_check', severity: 'high', confidence: 0.88, evidence_quote: null });
  }

  const scenarioLabel = input.scenarioTitle.toLowerCase().includes('password') ? 'password_reset'
    : input.scenarioTitle.toLowerCase().includes('outlook') ? 'outlook'
    : input.scenarioTitle.toLowerCase().includes('printer') ? 'printer' : 'email';

  return JSON.stringify({
    call_summary: `Candidate handled a ${input.scenarioTitle} call. They ${checkpointEvidence.filter((c) => c.status === 'observed').length} of ${checkpointEvidence.length} checkpoints.`,
    checkpoint_evidence: checkpointEvidence,
    skill_labels: skillLabels,
    risk_labels: riskLabels,
    scenario_labels: [scenarioLabel, 'single_user_issue', 'medium_urgency', 'first_line'],
    data_quality_labels: ['usable_for_training'],
    coaching_notes: riskLabels.map((r) => `Address: ${r.label.replace(/_/g, ' ')}`),
  });
}
