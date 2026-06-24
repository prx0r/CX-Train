import { runAiTask, parseJsonResponse } from '@/lib/ai/provider';

export async function extractAssessmentEvidence(
  transcript: string,
  requiredCheckpoints: Record<string, boolean>
) {
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

  if (!result.success) return null;
  const parsed = parseJsonResponse<{
    checkpoint_results?: Record<string, { passed?: unknown; evidence?: unknown }>;
    feedback_text?: string;
  }>(result.content);
  if (!parsed.data || typeof parsed.data.checkpoint_results !== 'object' || !parsed.data.checkpoint_results) return null;
  const checkpointResults = parsed.data.checkpoint_results as Record<string, { passed?: unknown; evidence?: unknown }>;
  if (keys.some((key) => typeof checkpointResults[key]?.passed !== 'boolean' || typeof checkpointResults[key]?.evidence !== 'string')) return null;
  return parsed.data as {
    checkpoint_results: Record<string, { passed: boolean; evidence?: string }>;
    feedback_text?: string;
  };
}
