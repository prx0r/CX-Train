import { NextRequest } from 'next/server';
import { getDb } from '../db';

const DEFAULT_MANAGER_PROFILE_ID = 'manager-default-v1';

export interface CallumProfile {
  id: string;
  managerProfileId: string;
  assistantName: string;
  tone: string;
  humourLevel: string;
  detailLevel: string;
  feedbackStyle: string;
  customInstructions: string | null;
}

export function getCallumManagerProfile(request: NextRequest): string {
  const header = request.headers.get('x-manager-profile-id');
  if (header) return header;
  return DEFAULT_MANAGER_PROFILE_ID;
}

export function resolveManagerProfile(
  overrideFromBody: string | null | undefined,
): string {
  return overrideFromBody || DEFAULT_MANAGER_PROFILE_ID;
}

export function getOrCreateProfile(managerProfileId: string): CallumProfile {
  const db = getDb();
  let profile = db.prepare('SELECT * FROM manager_callum_profiles WHERE manager_profile_id = ?').get(managerProfileId) as CallumProfile | undefined;

  if (!profile) {
    const id = `profile-${managerProfileId}`;
    db.prepare(`INSERT INTO manager_callum_profiles (id, manager_profile_id, assistant_name, tone, humour_level, detail_level, feedback_style, created_at, updated_at)
      VALUES (?, ?, 'Callum', 'direct', 'low', 'normal', 'balanced', datetime('now'), datetime('now'))`).run(id, managerProfileId);
    profile = db.prepare('SELECT * FROM manager_callum_profiles WHERE id = ?').get(id) as CallumProfile;
  }

  return profile;
}

export function updateProfile(
  managerProfileId: string,
  updates: Partial<Pick<CallumProfile, 'tone' | 'humourLevel' | 'detailLevel' | 'feedbackStyle' | 'customInstructions'>>,
): CallumProfile {
  const db = getDb();
  const sets: string[] = ['updated_at = datetime(\'now\')'];
  const values: unknown[] = [];

  const fieldMap: Record<string, string> = {
    tone: 'tone',
    humourLevel: 'humour_level',
    detailLevel: 'detail_level',
    feedbackStyle: 'feedback_style',
    customInstructions: 'custom_instructions',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if ((updates as any)[key] !== undefined) {
      sets.push(`${col} = ?`);
      values.push((updates as any)[key]);
    }
  }

  values.push(managerProfileId);
  db.prepare(`UPDATE manager_callum_profiles SET ${sets.join(', ')} WHERE manager_profile_id = ?`).run(...values);
  return getOrCreateProfile(managerProfileId);
}

export function buildProfileSystemPrompt(profile: CallumProfile): string {
  const parts = [
    `You are Callum, an AI assistant.`,
    `Tone: ${profile.tone}.`,
    `Humour: ${profile.humourLevel}.`,
    `Detail level: ${profile.detailLevel}.`,
    `Feedback style: ${profile.feedbackStyle}.`,
  ];
  if (profile.customInstructions) {
    parts.push(`Custom instructions: ${profile.customInstructions}`);
  }
  return parts.join('\n');
}
