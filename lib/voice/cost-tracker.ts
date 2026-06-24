import { VOICE_PROVIDER_COSTS } from './providers';

export interface CostLog {
  sttSeconds: number;
  ttsSeconds: number;
  llmInputTokens: number;
  llmOutputTokens: number;
  evaluationTokens: number;
  estimatedCostUsd: number;
}

export function estimateCost(
  provider: string,
  sttSeconds: number,
  ttsSeconds: number,
  llmInputTokens: number,
  llmOutputTokens: number,
  evaluationTokens: number,
): number {
  const rates = VOICE_PROVIDER_COSTS[provider] ?? VOICE_PROVIDER_COSTS.mock;
  return (
    sttSeconds * rates.sttPerSecond +
    ttsSeconds * rates.ttsPerSecond +
    llmInputTokens * rates.llmPerInputToken +
    llmOutputTokens * rates.llmPerOutputToken +
    evaluationTokens * rates.llmPerInputToken
  );
}
