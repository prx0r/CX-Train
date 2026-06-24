import { runAiTask, parseJsonResponse } from '@/lib/ai/provider';

export async function extractAssessmentEvidence(
  transcript: string,
  requiredCheckpoints: Record<string, boolean>
): Promise<{
  checkpoint_results?: Record<string, { passed: boolean; evidence?: string }>;
  feedback_text?: string;
  extraction_error?: string;
  model_failed?: boolean;
} | null> {
  const keys = Object.keys(requiredCheckpoints).filter((key) => requiredCheckpoints[key]);
  const result = await runAiTask('evaluator', {
    messages: [
      {
        role: 'system',
        content: `You evaluate MSP service-desk call transcripts. Return JSON only with checkpoint_results and feedback_text. checkpoint_results must contain every supplied key as {"passed": boolean, "evidence": "exact short transcript evidence or why missing"}. Do not infer actions that are not in the transcript. Penalise unsafe advice, invented fixes and unsupported promises.`,
      },
      {
        role: 'user',
        content: `Required checkpoint keys: ${JSON.stringify(keys)}\n\nTranscript:\n${transcript.slice(0, 30000)}`,
      },
    ],
    responseFormat: 'json_object',
    temperature: 0.1,
    maxTokens: 2500,
  });

  if (!result.success) {
    console.error(`[evidence-extraction] Model failed for transcript (${transcript.length} chars): ${result.error}`);
    const emptyResults: Record<string, { passed: boolean; evidence?: string }> = {};
    for (const key of keys) {
      emptyResults[key] = { passed: false, evidence: 'Evaluation unavailable — model could not be reached' };
    }
    return {
      checkpoint_results: emptyResults,
      feedback_text: 'Evaluation failed due to model unavailability. The transcript is preserved for manual review.',
      extraction_error: result.error || 'model_unavailable',
      model_failed: true,
    };
  }

  const parsed = parseJsonResponse<{
    checkpoint_results?: Record<string, { passed?: unknown; evidence?: unknown }>;
    feedback_text?: string;
  }>(result.content);

  if (!parsed.data || typeof parsed.data.checkpoint_results !== 'object' || !parsed.data.checkpoint_results) {
    console.error(`[evidence-extraction] Invalid JSON from evaluator model: ${result.content.slice(0, 500)}`);
    const emptyResults: Record<string, { passed: boolean; evidence?: string }> = {};
    for (const key of keys) {
      emptyResults[key] = { passed: false, evidence: 'Evaluation unavailable — model returned invalid response' };
    }
    return {
      checkpoint_results: emptyResults,
      feedback_text: 'Evaluation failed: the AI returned an unparseable response. The transcript is preserved for manual review.',
      extraction_error: 'invalid_json_from_model',
      model_failed: true,
    };
  }

  const checkpointResults = parsed.data.checkpoint_results as Record<string, { passed?: unknown; evidence?: unknown }>;

  const validationErrors: string[] = [];
  for (const key of keys) {
    if (typeof checkpointResults[key]?.passed !== 'boolean') {
      validationErrors.push(`Missing or invalid "passed" for checkpoint: ${key}`);
    }
    if (typeof checkpointResults[key]?.evidence !== 'string') {
      validationErrors.push(`Missing or invalid "evidence" for checkpoint: ${key}`);
    }
  }

  if (validationErrors.length > 0) {
    console.error(`[evidence-extraction] Validation errors: ${validationErrors.join('; ')}`);
    for (const key of keys) {
      if (typeof checkpointResults[key]?.passed !== 'boolean') {
        checkpointResults[key] = { passed: false, evidence: 'Checkpoint could not be evaluated' };
      }
      if (typeof checkpointResults[key]?.evidence !== 'string') {
        checkpointResults[key] = { ...checkpointResults[key], evidence: 'No evidence available' };
      }
    }
    return {
      checkpoint_results: checkpointResults as Record<string, { passed: boolean; evidence: string }>,
      feedback_text: parsed.data.feedback_text || `${validationErrors.length} checkpoint(s) had missing data; defaulted to unchecked.`,
      extraction_error: 'partial_model_failure',
    };
  }

  return {
    checkpoint_results: checkpointResults as Record<string, { passed: boolean; evidence: string }>,
    feedback_text: parsed.data.feedback_text,
  };
}
