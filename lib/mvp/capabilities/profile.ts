import type { CapabilityDefinition } from '../contracts/capability';
import { getOrCreateProfile, updateProfile, buildProfileSystemPrompt } from '../callum/manager-profile';

export const updateCallumProfileCapability: CapabilityDefinition<
  {
    tone?: string;
    humourLevel?: string;
    detailLevel?: string;
    feedbackStyle?: string;
    customInstructions?: string;
  },
  { profile: ReturnType<typeof getOrCreateProfile>; systemPrompt: string }
> = {
  name: 'update_callum_profile',
  domain: 'memory',
  access: 'propose',
  requiresConfirmation: false,
  inputSchemaVersion: 'update-callum-profile-input-v1',
  outputSchemaVersion: 'callum-profile-v1',
  description: 'Change how Callum behaves — tone, humour, detail level, or set custom instructions.',
  inputFields: {
    tone: { type: 'string', description: 'direct | friendly | empathetic | professional', optional: true },
    humourLevel: { type: 'string', description: 'none | low | medium | high', optional: true },
    detailLevel: { type: 'string', description: 'concise | normal | detailed', optional: true },
    feedbackStyle: { type: 'string', description: 'gentle | balanced | direct', optional: true },
    customInstructions: { type: 'string', description: 'Free-form instructions for how Callum should behave', optional: true },
  },
  async handler(input, ctx) {
    const updates: Record<string, string> = {};
    if (input.tone) updates.tone = input.tone;
    if (input.humourLevel) updates.humourLevel = input.humourLevel;
    if (input.detailLevel) updates.detailLevel = input.detailLevel;
    if (input.feedbackStyle) updates.feedbackStyle = input.feedbackStyle;
    if (input.customInstructions !== undefined) updates.customInstructions = input.customInstructions;

    const profile = updateProfile(ctx.managerProfileId, updates);
    return { profile, systemPrompt: buildProfileSystemPrompt(profile) };
  },
};
