import { callChutesAI } from '@/lib/ai/chutes';

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const cleaned = value.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function extractAssessmentEvidence(
  transcript: string,
  requiredCheckpoints: Record<string, boolean>
) {
  const keys = Object.keys(requiredCheckpoints).filter((key) => requiredCheckpoints[key]);
  const result = await callChutesAI([
    {
      role: 'system',
      content: `You evaluate MSP service-desk call transcripts. Return JSON only with checkpoint_results and feedback_text. checkpoint_results must contain every supplied key as {"passed": boolean, "evidence": "exact short transcript evidence or why missing"}. Do not infer actions that are not in the transcript. Penalise unsafe advice, invented fixes and unsupported promises.`,
    },
    {
      role: 'user',
      content: `Required checkpoint keys: ${JSON.stringify(keys)}\n\nTranscript:\n${transcript.slice(0, 30000)}`,
    },
  ], { responseFormat: 'json', temperature: 0.1, maxTokens: 2500, context: 'assessment-evidence' });

  if (!result.success) return null;
  const parsed = parseJsonObject(result.data);
  if (!parsed || typeof parsed.checkpoint_results !== 'object') return null;
  return parsed as {
    checkpoint_results: Record<string, { passed: boolean; evidence?: string }>;
    feedback_text?: string;
  };
}
