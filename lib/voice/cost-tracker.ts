import { VOICE_PROVIDER_COSTS } from './providers';
import type { VoiceSession } from './providers';

export function estimateCost(session: VoiceSession): number {
  const sttRates = VOICE_PROVIDER_COSTS[session.sttProvider] ?? VOICE_PROVIDER_COSTS.mock;
  const ttsRates = VOICE_PROVIDER_COSTS[session.ttsProvider] ?? VOICE_PROVIDER_COSTS.mock;
  const llmRates = VOICE_PROVIDER_COSTS[session.roleplayProvider] ?? VOICE_PROVIDER_COSTS.mock;
  const evalRates = VOICE_PROVIDER_COSTS[session.evaluationProvider] ?? VOICE_PROVIDER_COSTS.mock;

  return (
    session.sttSeconds * sttRates.sttPerSecond +
    session.ttsSeconds * ttsRates.ttsPerSecond +
    session.llmInputTokens * llmRates.llmPerInputToken +
    session.llmOutputTokens * llmRates.llmPerOutputToken +
    session.evaluationTokens * evalRates.llmPerInputToken
  );
}
